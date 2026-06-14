import { getAdapter } from "../discovery-adapters/registry.js";
import { saveDiscoveryRun } from "./qualified-business-store.js";
import { newDiscoveryRunId, nowIso } from "./shared.js";
import { ingestAdapterResults } from "../pipeline/ingest-discovery.js";

function appendLog(run, message) {
  run.logs.push({ at: nowIso(), message });
  if (run.logs.length > 500) run.logs.shift();
}

export async function executeBusinessDiscoveryRun(config, { runId: providedRunId, onProgress } = {}) {
  const industry = String(config.industry ?? "").trim();
  const city = String(config.city ?? "").trim();
  const state = String(config.state ?? "").trim().toUpperCase();
  const maxBusinesses = Math.min(200, Math.max(1, Number(config.maxBusinesses) || 25));
  const adapterId = config.adapterId ?? "google_maps";

  if (!industry) throw new Error("Industry is required.");
  if (!city) throw new Error("City is required.");

  const adapter = getAdapter(adapterId);
  if (!adapter) throw new Error(`Unknown discovery adapter: ${adapterId}`);
  if (!adapter.enabled) throw new Error(`Discovery adapter ${adapterId} is not enabled.`);

  const runId = providedRunId || newDiscoveryRunId();
  const searchCity = state ? `${city}, ${state}` : city;
  const run = {
    id: runId,
    industry,
    city,
    state,
    maxBusinesses,
    adapterId,
    campaignId: config.campaignId ?? null,
    status: "running",
    startedAt: nowIso(),
    finishedAt: null,
    businessesFound: 0,
    qualifiedCount: 0,
    rejectedCount: 0,
    duplicateCount: 0,
    businessIds: [],
    logs: [],
    error: null,
  };

  await saveDiscoveryRun(run);
  appendLog(run, `Starting discovery via ${adapter.name}: ${industry} in ${searchCity} (max ${maxBusinesses})`);
  onProgress?.({ ...run });

  try {
    const discoveries = await adapter.discover({
      industry,
      city,
      state,
      maxResults: maxBusinesses,
    });

    appendLog(run, `${adapter.name} returned ${discoveries.length} businesses`);
    onProgress?.({ ...run });

    const { stats, results } = await ingestAdapterResults(adapterId, discoveries, { runId });

    for (const result of results) {
      if (result.action === "added") {
        run.businessIds.push(result.record.id);
        if (result.qualification?.qualificationStatus === "qualified") {
          run.qualifiedCount += 1;
        } else {
          run.rejectedCount += 1;
        }
      }
    }

    run.businessesFound = stats.businessesAdded;
    run.duplicateCount = stats.duplicatesResolved;

    run.status = "completed";
    run.finishedAt = nowIso();
    appendLog(
      run,
      `Done. Added ${stats.businessesAdded}, duplicates ${stats.duplicatesResolved}, errors ${stats.errors}`,
    );
    await saveDiscoveryRun(run);
    onProgress?.({ ...run, progress: 1 });
    return run;
  } catch (err) {
    run.status = "failed";
    run.error = err.message;
    run.finishedAt = nowIso();
    appendLog(run, `Failed: ${err.message}`);
    await saveDiscoveryRun(run);
    onProgress?.({ ...run });
    throw err;
  }
}
