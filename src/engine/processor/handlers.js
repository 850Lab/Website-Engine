import { registerJobHandler } from "./registry.js";

export async function demoEchoHandler(job) {
  return {
    success: true,
    metadata: {
      ...job.metadata,
      demoEchoAt: new Date().toISOString(),
    },
  };
}

export function registerBuiltInHandlers() {
  registerJobHandler("demo.echo", demoEchoHandler, { label: "demo.echo" });
}
