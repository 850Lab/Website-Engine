import {
  listBusinesses as listSchemaBusinesses,
  getBusiness as getSchemaBusiness,
  getBusinessByLegacyId as getSchemaBusinessByLegacyId,
} from "../schema/business.js";

export async function listBusinesses(filters = {}) {
  let rows = await listSchemaBusinesses();
  if (filters.region) {
    const region = String(filters.region);
    rows = rows.filter((row) => row.region === region);
  }
  if (filters.legacyId) {
    const legacyId = String(filters.legacyId);
    rows = rows.filter((row) => row.legacyId === legacyId);
  }
  return rows;
}

export async function getBusiness(id) {
  return getSchemaBusiness(id);
}

export async function getBusinessByLegacyId(legacyId) {
  return getSchemaBusinessByLegacyId(legacyId);
}
