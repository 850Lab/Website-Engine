import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getRepoRoot, setValidationRuntimeDir } from "./env.js";

const RUNTIME_SUBDIRECTORIES = [
  "events",
  "jobs",
  "graph",
  "signals",
  "signals/raw",
  "facts",
  "hypotheses",
  "situations",
  "problems",
  "capability-matches",
  "offers",
  "offer-recommendations",
  "opportunities",
  "scheduler",
  "dispatch",
  "inbox",
  "inbox/observations",
  "inbox/observations/processed",
  "orchestrator",
  "logs",
  "cache",
  "reports",
  "missions",
  "engineering-tasks",
];

export class ValidationRuntime {
  #root = null;
  #owned = false;

  static async create(options = {}) {
    const runtime = new ValidationRuntime();
    await runtime.initialize(options);
    return runtime;
  }

  async initialize(options = {}) {
    const existing = process.env.OPPORTUNITY_VALIDATION_RUNTIME_DIR || process.env.OPPORTUNITY_RUNTIME_DIR;
    if (existing && options.reuseExisting !== false) {
      this.#root = existing;
      this.#owned = false;
      setValidationRuntimeDir(this.#root);
      await this.#ensureLayout();
      return this;
    }

    const parent = options.parentDir || join(getRepoRoot(), "runtime-validation");
    await mkdir(parent, { recursive: true });
    this.#root = await mkdtemp(join(parent, "run-"));
    this.#owned = true;
    setValidationRuntimeDir(this.#root);
    await this.#ensureLayout();
    return this;
  }

  async #ensureLayout() {
    for (const part of RUNTIME_SUBDIRECTORIES) {
      await mkdir(join(this.#root, part), { recursive: true });
    }
  }

  get root() {
    return this.#root;
  }

  get reportsDir() {
    return join(this.#root, "reports");
  }

  get resultPath() {
    return join(this.reportsDir, "validator-result.json");
  }

  isOwned() {
    return this.#owned;
  }

  async cleanup() {
    if (!this.#owned || !this.#root) return;
    await rm(this.#root, { recursive: true, force: true }).catch(() => {});
    this.#root = null;
    this.#owned = false;
  }
}
