import { readFile } from "node:fs/promises";

const ROOT = new URL("../../../", import.meta.url);

async function loadContacts() {
  const file = new URL("data/contacts.json", ROOT);
  const raw = JSON.parse(await readFile(file, "utf8"));
  return Array.isArray(raw) ? raw : raw.contacts || [];
}

export async function discoverBuyerContacts(buyer) {
  const contacts = await loadContacts();

  return contacts
    .filter((contact) => contact.businessId === buyer.id)
    .sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      if (a.isCallable && !b.isCallable) return -1;
      if (!a.isCallable && b.isCallable) return 1;
      return 0;
    });
}
