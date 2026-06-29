import { stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  ensureRuntimeDirectories,
  getRuntimePath,
  readJsonWithRetry,
  writeJsonAtomic,
  writeJsonAtomicWithRetry,
  appendJsonLineWithRetry,
  safeFileExists,
} from "../runtime/index.js";

export class ValidationAssertions {
  #fail;
  #pass;

  constructor(fail, pass) {
    this.#fail = fail;
    this.#pass = pass;
  }

  async isRuntimeDirectory(path) {
    try {
      return (await stat(path)).isDirectory();
    } catch {
      return false;
    }
  }

  async assertRuntimeDirectoryExists(passLabel, ...parts) {
    await ensureRuntimeDirectories();
    const dir = getRuntimePath(...parts);
    if (!(await this.isRuntimeDirectory(dir))) {
      this.#fail(`runtime/${parts.join("/")}/ missing`);
      return false;
    }
    this.#pass(passLabel);
    return true;
  }

  async assertRuntimeIoBasics() {
    await ensureRuntimeDirectories();
    const probePath = getRuntimePath("cache", `validation_probe_${randomUUID().slice(0, 8)}.json`);
    const payload = { probe: true, at: new Date().toISOString() };
    await writeJsonAtomic(probePath, payload);
    const readBack = await readJsonWithRetry(probePath, null);
    if (readBack?.probe !== true) {
      this.#fail("Runtime atomic write/read probe failed");
      return false;
    }
    this.#pass("Runtime atomic IO works");

    await writeJsonAtomicWithRetry(probePath, { probe: "retry" });
    const retryRead = await readJsonWithRetry(probePath, null);
    if (retryRead?.probe !== "retry") {
      this.#fail("Runtime retry write/read probe failed");
      return false;
    }
    this.#pass("Runtime retry IO works");

    const appendPath = getRuntimePath("cache", `validation_append_${randomUUID().slice(0, 8)}.jsonl`);
    await appendJsonLineWithRetry(appendPath, { line: 1 });
    await appendJsonLineWithRetry(appendPath, { line: 2 });
    if (!(await safeFileExists(appendPath))) {
      this.#fail("Runtime append probe failed");
      return false;
    }
    this.#pass("Runtime append IO works");
    return true;
  }
}
