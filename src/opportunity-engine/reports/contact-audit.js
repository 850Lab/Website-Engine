import { listQualifiedBusinesses } from "../../stage1/qualified-business-store.js";
import { cleanText, isValidPhoneFormat } from "../../stage1/shared.js";
function pct(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function hasPhone(record) {
  return isValidPhoneFormat(record.phone) || isValidPhoneFormat(record.normalizedPhone) || Boolean(cleanText(record.phone));
}

function hasValidPhone(record) {
  return isValidPhoneFormat(record.phone) || isValidPhoneFormat(record.normalizedPhone);
}

function hasEmail(record) {
  return Boolean(cleanText(record.email));
}

export async function buildContactAuditReport() {
  const records = await listQualifiedBusinesses();
  const total = records.length;

  let phoneAvailable = 0;
  let emailAvailable = 0;
  let phoneAndEmail = 0;
  let phoneOnly = 0;
  let emailOnly = 0;
  let noContact = 0;

  const contactMethodCounts = {};
  for (const record of records) {
    const phone = hasPhone(record);
    const validPhone = hasValidPhone(record);
    const email = hasEmail(record);

    if (phone) phoneAvailable += 1;
    if (email) emailAvailable += 1;

    if (phone && email) phoneAndEmail += 1;
    else if (phone) phoneOnly += 1;
    else if (email) emailOnly += 1;
    else noContact += 1;

    const category = record.contactMethodCategory ?? "unknown";
    contactMethodCounts[category] = (contactMethodCounts[category] ?? 0) + 1;
  }

  const qualifiedWithEmail = records.filter(
    (r) => r.qualificationStatus === "qualified" && hasEmail(r),
  ).length;
  const qualifiedPhoneOnlyRoute = records.filter(
    (r) => r.qualificationStatus === "qualified" && r.contactMethodCategory === "text_first",
  ).length;

  const diagnosis = [];
  if (contactMethodCounts.email_first <= 1 && emailAvailable > 1) {
    diagnosis.push({
      finding: "contact_routing_priority",
      severity: "expected",
      detail:
        "Contact routing prioritizes valid mobile phones as text_first before email_first. Businesses with both phone and email are classified text_first, not email_first.",
    });
  }
  if (emailAvailable < total * 0.05) {
    diagnosis.push({
      finding: "low_email_capture_rate",
      severity: "high",
      detail: `Only ${pct(emailAvailable, total)}% of records have a stored email. Website email extraction may be weak or businesses genuinely lack public emails.`,
    });
  } else if (emailAvailable < total * 0.15) {
    diagnosis.push({
      finding: "moderate_email_capture",
      severity: "medium",
      detail: `${pct(emailAvailable, total)}% email capture — review extraction on poor/no-website businesses.`,
    });
  }

  return {
    total,
    phoneAvailable: { count: phoneAvailable, percent: pct(phoneAvailable, total) },
    emailAvailable: { count: emailAvailable, percent: pct(emailAvailable, total) },
    phoneAndEmail: { count: phoneAndEmail, percent: pct(phoneAndEmail, total) },
    phoneOnly: { count: phoneOnly, percent: pct(phoneOnly, total) },
    emailOnly: { count: emailOnly, percent: pct(emailOnly, total) },
    noContactMethod: { count: noContact, percent: pct(noContact, total) },
    contactMethodCategories: contactMethodCounts,
    qualifiedWithEmail,
    qualifiedTextFirst: qualifiedPhoneOnlyRoute,
    diagnosis,
    conclusion:
      emailAvailable <= 1
        ? "Email discovery is likely failing or businesses lack public emails — measure shows very low stored email rate."
        : contactMethodCounts.email_first <= 1 && emailAvailable > 5
          ? "Email extraction works for some records, but routing rules classify phone-bearing businesses as text_first — email_first count is not a reliable email availability metric."
          : "Email availability is limited but measurable; most reachable opportunities route through phone/text.",
  };
}
