import { getSensor } from "../index.js";
import { registerWebSensor } from "./web-sensor.js";
import { registerDocumentSensor } from "./document-sensor.js";
import { registerCrmSensor } from "./crm-sensor.js";

export function registerDemoSensors() {
  if (!getSensor("sensor_web_demo")) registerWebSensor();
  if (!getSensor("sensor_document_demo")) registerDocumentSensor();
  if (!getSensor("sensor_crm_demo")) registerCrmSensor();
}

export { registerWebSensor, registerDocumentSensor, registerCrmSensor };
