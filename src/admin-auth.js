import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { writeJsonFileSafe } from "./storage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const ADMIN_FILE = join(DATA_DIR, "admin.json");

function stripUnsafe(value) {
  return String(value ?? "").trim();
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

function parseHash(stored) {
  const [salt, hash] = String(stored ?? "").split(":");
  if (!salt || !hash) return null;
  return { salt, hash };
}

export async function getStoredAdminAccount() {
  try {
    const raw = await readFile(ADMIN_FILE, "utf8");
    const account = JSON.parse(raw);
    if (!account || typeof account !== "object") return null;
    return {
      email: stripUnsafe(account.email).toLowerCase(),
      passwordHash: stripUnsafe(account.passwordHash),
      createdAt: stripUnsafe(account.createdAt) || null,
      updatedAt: stripUnsafe(account.updatedAt) || null,
    };
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function hasAdminAccount() {
  return Boolean(await getStoredAdminAccount());
}

export function verifyPasswordAgainstHash(password, passwordHash) {
  const parsed = parseHash(passwordHash);
  if (!parsed) return false;
  const candidateHex = hashPassword(password, parsed.salt);
  const a = Buffer.from(candidateHex, "hex");
  const b = Buffer.from(parsed.hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function verifyAdminCredentials({ email, password }) {
  const account = await getStoredAdminAccount();
  if (!account) return false;
  const inputEmail = stripUnsafe(email).toLowerCase();
  if (!inputEmail || inputEmail !== account.email) return false;
  return verifyPasswordAgainstHash(password, account.passwordHash);
}

export async function createAdminAccount({ email, password }) {
  const normalizedEmail = stripUnsafe(email).toLowerCase();
  const normalizedPassword = stripUnsafe(password);

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Valid email is required.");
  }
  if (normalizedPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const exists = await hasAdminAccount();
  if (exists) {
    throw new Error("Admin account already exists.");
  }

  const salt = randomBytes(16).toString("hex");
  const hash = hashPassword(normalizedPassword, salt);
  const now = new Date().toISOString();
  const payload = {
    email: normalizedEmail,
    passwordHash: `${salt}:${hash}`,
    createdAt: now,
    updatedAt: now,
  };

  await writeJsonFileSafe(ADMIN_FILE, payload);
  return { email: normalizedEmail, createdAt: now };
}

