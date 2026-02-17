function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        out[key] = sortValue(value[key]);
      });
    return out;
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}
