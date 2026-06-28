export { DEFAULT_PROCESSOR_ID } from "./registry.js";
export {
  registerJobHandler,
  unregisterJobHandler,
  getJobHandler,
  listJobHandlers,
  clearJobHandlersForTests,
} from "./registry.js";
export { registerBuiltInHandlers, demoEchoHandler } from "./handlers.js";
export { emitProcessorEvent } from "./events.js";
export { processNextJob, executeJob } from "./execute.js";

import { registerBuiltInHandlers } from "./handlers.js";

registerBuiltInHandlers();
