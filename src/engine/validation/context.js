import { ValidationRuntime } from "./runtime.js";
import { ValidationAssertions } from "./assertions.js";
import { isValidationFrameworkManaged } from "./env.js";

export class ValidationContext {
  #phase;
  #runtime;
  #startedAt;
  #errors = [];
  #warnings = [];
  #artifacts = [];
  #cleanupOnFinish;

  constructor({ phase, runtime, cleanupOnFinish = true }) {
    this.#phase = phase;
    this.#runtime = runtime;
    this.#startedAt = Date.now();
    this.#cleanupOnFinish = cleanupOnFinish;
  }

  static async create(phase, options = {}) {
    const runtime = await ValidationRuntime.create(options);
    return new ValidationContext({
      phase,
      runtime,
      cleanupOnFinish: options.cleanupOnFinish ?? !isValidationFrameworkManaged(),
    });
  }

  get phase() {
    return this.#phase;
  }

  get runtimePath() {
    return this.#runtime.root;
  }

  get reportsDir() {
    return this.#runtime.reportsDir;
  }

  get assertions() {
    return new ValidationAssertions((message) => this.fail(message), (message) => this.pass(message));
  }

  fail(message) {
    this.#errors.push(message);
    console.error(`FAIL: ${message}`);
  }

  pass(message) {
    console.log(`PASS: ${message}`);
  }

  warn(message) {
    this.#warnings.push(message);
    console.warn(`WARN: ${message}`);
  }

  addArtifact(path) {
    this.#artifacts.push(path);
  }

  get errors() {
    return [...this.#errors];
  }

  buildResult(status = null) {
    const passed = status?.passed ?? this.#errors.length === 0;
    return {
      phase: this.#phase,
      passed,
      duration: Date.now() - this.#startedAt,
      rootFailures: passed ? [] : [...this.#errors],
      warnings: [...this.#warnings],
      skipped: status?.skipped ?? false,
      artifacts: [...this.#artifacts],
      runtimePath: this.#runtime.root,
    };
  }

  async finish(status = null) {
    const result = this.buildResult(status);
    if (this.#cleanupOnFinish) {
      await this.#runtime.cleanup();
    }
    return result;
  }
}
