import { stableStringify } from "./canonical_json.js";

function toHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(input) {
  const text = typeof input === "string" ? input : stableStringify(input);
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return `sha256:${toHex(digest)}`;
  }
  throw new Error("SHA-256 is unavailable in this environment");
}
