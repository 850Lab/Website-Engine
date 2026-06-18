import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DATA_DIR } from "../storage.js";
import { readJsonDocument, writeJsonDocument } from "../persistence/json-document-store.js";
import { cleanText, nowIso } from "../stage1/shared.js";
import {
  getStoredAdminAccount,
  verifyPasswordAgainstHash,
} from "../admin-auth.js";
import { randomBytes, scryptSync } from "node:crypto";

export const OPERATORS_FILE = join(DATA_DIR, "operators.json");

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

async function readOperatorsDoc() {
  const parsed = await readJsonDocument(OPERATORS_FILE);
  if (!parsed || typeof parsed !== "object") {
    return { version: 1, operators: [] };
  }
  return {
    version: 1,
    operators: Array.isArray(parsed.operators) ? parsed.operators : [],
  };
}

async function writeOperatorsDoc(doc) {
  await writeJsonDocument(OPERATORS_FILE, {
    version: 1,
    operators: doc.operators ?? [],
    updatedAt: nowIso(),
  });
}

export function newOperatorId() {
  return `op_${randomUUID().slice(0, 8)}`;
}

export function sanitizeOperator(record) {
  if (!record) return null;
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    active: Boolean(record.active),
    createdAt: record.createdAt,
  };
}

export async function listOperators() {
  const doc = await readOperatorsDoc();
  return doc.operators
    .filter((row) => row.active !== false)
    .map(sanitizeOperator)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export async function getOperator(id) {
  const doc = await readOperatorsDoc();
  const record = doc.operators.find((row) => row.id === id && row.active !== false);
  return record ? sanitizeOperator(record) : null;
}

export async function getOperatorByEmail(email) {
  const needle = cleanText(email).toLowerCase();
  if (!needle) return null;
  const doc = await readOperatorsDoc();
  const record = doc.operators.find(
    (row) => row.active !== false && cleanText(row.email).toLowerCase() === needle,
  );
  return record ?? null;
}

export async function hasOperators() {
  const doc = await readOperatorsDoc();
  return doc.operators.some((row) => row.active !== false);
}

export async function createOperator({ name, email, password, role = "operator", passwordHash = null }) {
  const operatorName = cleanText(name);
  const operatorEmail = cleanText(email).toLowerCase();
  const operatorPassword = cleanText(password);

  if (!operatorName) throw new Error("Name is required.");
  if (!operatorEmail || !operatorEmail.includes("@")) {
    throw new Error("Valid email is required.");
  }
  if (!passwordHash) {
    if (operatorPassword.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
  }

  const doc = await readOperatorsDoc();
  if (doc.operators.some((row) => cleanText(row.email).toLowerCase() === operatorEmail)) {
    throw new Error("An operator with this email already exists.");
  }

  let storedHash = passwordHash;
  if (!storedHash) {
    const salt = randomBytes(16).toString("hex");
    storedHash = `${salt}:${hashPassword(operatorPassword, salt)}`;
  }

  const record = {
    id: newOperatorId(),
    name: operatorName,
    email: operatorEmail,
    passwordHash: storedHash,
    role: role === "owner" ? "owner" : "operator",
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  doc.operators.push(record);
  await writeOperatorsDoc(doc);
  return sanitizeOperator(record);
}

export async function verifyOperatorCredentials({ email, password }) {
  const record = await getOperatorByEmail(email);
  if (!record) return null;

  const doc = await readOperatorsDoc();
  const stored = doc.operators.find((row) => row.id === record.id);
  if (!stored || !verifyPasswordAgainstHash(password, stored.passwordHash)) {
    return null;
  }
  return sanitizeOperator(stored);
}

export async function migrateLegacyAdminAccountIfNeeded() {
  if (await hasOperators()) return null;

  const admin = await getStoredAdminAccount();
  if (!admin) return null;

  const name = admin.email.split("@")[0] || "Owner";
  return createOperator({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    email: admin.email,
    password: null,
    role: "owner",
    passwordHash: admin.passwordHash,
  });
}
