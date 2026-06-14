import { cleanText, extractEmailsFromHtml, isValidPhoneFormat } from "./shared.js";

export const CONTACT_METHODS = {
  TEXT_FIRST: "text_first",
  EMAIL_FIRST: "email_first",
  PHONE_ONLY: "phone_only",
  FORM_SOCIAL: "form_social_needed",
  NOT_CONTACTABLE: "not_contactable",
};

export function classifyContactMethod({
  phone = "",
  normalizedPhone = "",
  email = "",
  html = null,
  socialUrls = [],
  websiteUrl = "",
  hasContactForm = false,
} = {}) {
  const validPhone = isValidPhoneFormat(phone) || isValidPhoneFormat(normalizedPhone);
  const rawPhone = Boolean(cleanText(phone));
  const hasEmail = Boolean(cleanText(email));

  if (validPhone) {
    return CONTACT_METHODS.TEXT_FIRST;
  }

  if (rawPhone) {
    return CONTACT_METHODS.PHONE_ONLY;
  }

  if (hasEmail) {
    return CONTACT_METHODS.EMAIL_FIRST;
  }

  const emailsFromHtml = html ? extractEmailsFromHtml(html) : [];
  if (emailsFromHtml.length) {
    return CONTACT_METHODS.EMAIL_FIRST;
  }

  const hasSocial = (socialUrls ?? []).length > 0;
  const hasForm = hasContactForm || (html && /<form[\s>]/i.test(html));

  if (hasForm || hasSocial || cleanText(websiteUrl)) {
    return CONTACT_METHODS.FORM_SOCIAL;
  }

  return CONTACT_METHODS.NOT_CONTACTABLE;
}

export function contactMethodLabel(category) {
  const map = {
    text_first: "Text First",
    email_first: "Email First",
    phone_only: "Phone Only",
    form_social_needed: "Form/Social Needed",
    not_contactable: "Not Contactable",
  };
  return map[cleanText(category)] ?? category;
}
