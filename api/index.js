import { app, appReady } from "../src/server.js";

export default async function handler(req, res) {
  await appReady;
  return app(req, res);
}
