import { appendEvent } from "../events/index.js";
import { emitPipelineEvent } from "./events.js";

export const RUNTIME_GRAPH_ID = "graph_runtime_main";

export function requireInputRefs(job, label = "job") {
  const inputRefs = Array.isArray(job?.inputRefs) ? job.inputRefs.filter(Boolean) : [];
  if (!inputRefs.length) {
    throw new Error(`${label} requires at least one inputRef`);
  }
  return inputRefs.map(String);
}

export function requireInputRef(job, label = "job") {
  return requireInputRefs(job, label)[0];
}

export function resolveCorrelationId(job, context = {}) {
  return job?.metadata?.correlationId || context.correlationId || null;
}

export async function emitDomainCompletionEvent(type, payload, options = {}) {
  return appendEvent({
    type,
    subjectType: payload.subjectType,
    subjectId: payload.subjectId,
    payload,
    correlationId: options.correlationId,
    causationId: options.causationId ?? null,
  });
}

export async function runPipelineStage(job, context, options) {
  const { stage, jobType, execute } = options;
  const correlationId = resolveCorrelationId(job, context);
  let causationId = context.causationId ?? null;

  async function emitPipeline(type, payload = {}) {
    const event = await emitPipelineEvent(
      type,
      {
        jobId: job.id,
        jobType,
        stage,
        inputRefs: job.inputRefs,
        ...payload,
      },
      { correlationId, causationId, stage, jobType },
    );
    causationId = event.id;
    return event;
  }

  await emitPipeline("pipeline.started");

  try {
    const stageContext = {
      ...context,
      correlationId,
      get causationId() {
        return causationId;
      },
      setCausationId(nextId) {
        causationId = nextId;
      },
      async emitDomain(type, payload) {
        const event = await emitDomainCompletionEvent(type, payload, {
          correlationId,
          causationId,
        });
        causationId = event.id;
        return event;
      },
    };

    const result = await execute(job, stageContext);

    await emitPipeline("pipeline.stage_completed", {
      outputRefs: result.outputRefs || [],
      skipped: result.skipped === true,
    });
    await emitPipeline("pipeline.completed", {
      outputRefs: result.outputRefs || [],
      skipped: result.skipped === true,
    });

    return {
      success: true,
      outputRefs: result.outputRefs || [],
      metadata: result.metadata,
    };
  } catch (error) {
    await emitPipeline("pipeline.failed", {
      error: {
        code: error.code || "PIPELINE_STAGE_FAILED",
        message: error.message,
      },
    });
    return {
      success: false,
      error: {
        code: error.code || "PIPELINE_STAGE_FAILED",
        message: error.message,
        retryable: error.retryable !== false,
      },
    };
  }
}
