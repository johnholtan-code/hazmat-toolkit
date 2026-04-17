/**
 * Utility helpers for kit operations
 */

export function asTrimmedString(value) {
  return String(value ?? "").trim();
}

export function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => asTrimmedString(s))
      .filter((s) => s.length > 0);
  }
  return [];
}

export function uid() {
  return "kit_" + Math.random().toString(36).slice(2, 11) + "_" + Date.now();
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function el(id) {
  return document.getElementById(id);
}

export function formatPhoneNumber(phone) {
  if (!phone) return "";
  const digits = asTrimmedString(phone).replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function buildSearchString(kit) {
  const parts = [
    kit.kitName,
    kit.organizationName,
    kit.contactName,
    kit.city,
    kit.state,
    kit.region,
    kit.kitCategory,
    (kit.kitTypes || []).join(" "),
    (kit.hazardFocus || []).join(" "),
    (kit.equipmentCapabilities || []).join(" "),
    kit.notes
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}
