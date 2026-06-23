import { cleanText, normalizePhoneNumber, nowIso } from "../stage1/shared.js";
import { CONTACT_TYPES } from "./constants.js";
import { getRecordById, listRecords, upsertRecord } from "./collection.js";
import { newContactId } from "./ids.js";
import { CONTACTS_FILE } from "./paths.js";
import { validateContact } from "./validate.js";

const COLLECTION_KEY = "contacts";

function normalizeContactValue(type, value) {
  const raw = cleanText(value);
  if (type === "phone" || type === "sms") {
    return normalizePhoneNumber(raw) || raw.toLowerCase();
  }
  if (type === "email") {
    return raw.toLowerCase();
  }
  return raw.toLowerCase();
}

export function buildContact(input = {}) {
  const stamp = nowIso();
  const type = CONTACT_TYPES.includes(input.type) ? input.type : "phone";
  const value = cleanText(input.value);

  return {
    id: cleanText(input.id) || newContactId(),
    businessId: cleanText(input.businessId),
    type,
    value,
    normalizedValue: cleanText(input.normalizedValue) || normalizeContactValue(type, value),
    role: cleanText(input.role) || null,
    isPrimary: Boolean(input.isPrimary),
    isCallable: input.isCallable == null ? type === "phone" : Boolean(input.isCallable),
    verifiedAt: input.verifiedAt || null,
    source: cleanText(input.source) || null,
    createdAt: input.createdAt || stamp,
    updatedAt: stamp,
  };
}

export async function listContacts() {
  return listRecords(CONTACTS_FILE, COLLECTION_KEY);
}

export async function getContact(id) {
  return getRecordById(CONTACTS_FILE, id, COLLECTION_KEY);
}

export async function listContactsForBusiness(businessId) {
  const contacts = await listContacts();
  return contacts.filter((row) => row.businessId === businessId);
}

export async function getPrimaryContact(businessId, type) {
  const contacts = await listContactsForBusiness(businessId);
  return contacts.find((row) => row.type === type && row.isPrimary) ?? null;
}

export async function saveContact(input = {}) {
  const existing = input.id ? await getContact(input.id) : null;
  const record = buildContact({ ...existing, ...input, updatedAt: nowIso() });
  validateContact(record);
  return upsertRecord(CONTACTS_FILE, record, {
    collectionKey: COLLECTION_KEY,
    validate: validateContact,
  });
}
