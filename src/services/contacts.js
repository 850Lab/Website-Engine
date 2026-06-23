import {
  listContacts as listSchemaContacts,
  getContact as getSchemaContact,
  listContactsForBusiness as listSchemaContactsForBusiness,
} from "../schema/contact.js";

export async function listContacts(filters = {}) {
  let rows = await listSchemaContacts();
  if (filters.businessId) {
    rows = rows.filter((row) => row.businessId === filters.businessId);
  }
  if (filters.type) {
    rows = rows.filter((row) => row.type === filters.type);
  }
  return rows;
}

export async function getContact(id) {
  return getSchemaContact(id);
}

export async function listContactsForBusiness(businessId) {
  return listSchemaContactsForBusiness(businessId);
}
