import { buildSearchString } from "./utils.js";

/**
 * Deterministic filter matching for kits.
 * AND across categories, OR within multi-select arrays.
 */

export function getFilterState() {
  return {
    keyword: "",
    kitCategory: "",
    kitType: [],
    hazardFocus: [],
    equipmentCapabilities: [],
    state: "",
    region: "",
    deploymentType: "",
    availabilityStatus: "",
    accessType: "",
    storageEnvironment: "",
    transportCapable: "",
    responseTeamIncluded: "",
    trainingRequired: ""
  };
}

export function kitMatchesFilters(kit, filters) {
  if (!kit) return false;

  // Keyword match (case-insensitive substring)
  if (filters.keyword) {
    const searchStr = buildSearchString(kit);
    const q = filters.keyword.toLowerCase().trim();
    if (!searchStr.includes(q)) return false;
  }

  // Single-select filters (exact match or empty = any)
  if (filters.kitCategory && kit.kitCategory !== filters.kitCategory) return false;
  if (filters.state && kit.state !== filters.state) return false;
  if (filters.region && kit.region !== filters.region) return false;
  if (filters.deploymentType && kit.deploymentType !== filters.deploymentType) return false;
  if (filters.availabilityStatus && kit.availabilityStatus !== filters.availabilityStatus)
    return false;
  if (filters.accessType && kit.accessType !== filters.accessType) return false;
  if (filters.storageEnvironment && kit.storageEnvironment !== filters.storageEnvironment)
    return false;
  if (filters.transportCapable && kit.transportCapable !== filters.transportCapable) return false;
  if (filters.responseTeamIncluded && kit.responseTeamIncluded !== filters.responseTeamIncluded)
    return false;
  if (filters.trainingRequired && kit.trainingRequired !== filters.trainingRequired) return false;

  // Multi-select filters (OR within group, AND across groups)
  if (filters.kitType.length > 0) {
    if (!kit.kitTypes || !kit.kitTypes.some((t) => filters.kitType.includes(t))) return false;
  }
  if (filters.hazardFocus.length > 0) {
    if (!kit.hazardFocus || !kit.hazardFocus.some((h) => filters.hazardFocus.includes(h)))
      return false;
  }
  if (filters.equipmentCapabilities.length > 0) {
    if (
      !kit.equipmentCapabilities ||
      !kit.equipmentCapabilities.some((e) => filters.equipmentCapabilities.includes(e))
    )
      return false;
  }

  return true;
}

export function getFilteredKits(kits, filters) {
  return (kits || []).filter((kit) => kitMatchesFilters(kit, filters));
}

export function resetKitFilters(filters) {
  return getFilterState();
}
