import { resolveConfig } from "./config.js";

const runtimeConfig = resolveConfig();

export async function geocodeAddress(address) {
  const errors = [];

  if (runtimeConfig.openCageApiKey) {
    try {
      const url = new URL("https://api.opencagedata.com/geocode/v1/json");
      url.searchParams.set("q", address);
      url.searchParams.set("key", runtimeConfig.openCageApiKey);
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycode", "us");
      url.searchParams.set("no_annotations", "1");

      const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`OpenCage HTTP ${response.status}`);
      }

      const payload = await response.json();
      const result = payload?.results?.[0];
      const lat = Number.parseFloat(result?.geometry?.lat);
      const lng = Number.parseFloat(result?.geometry?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return {
          lat,
          lng,
          display: result?.formatted || address
        };
      }
      errors.push("OpenCage returned no matches");
    } catch (error) {
      errors.push(error.message || "OpenCage lookup failed");
    }
  } else {
    errors.push("OpenCage key not configured");
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", address);
    url.searchParams.set("limit", "1");

    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}`);
    }
    const results = await response.json();
    if (Array.isArray(results) && results.length) {
      return {
        lat: Number.parseFloat(results[0].lat),
        lng: Number.parseFloat(results[0].lon),
        display: results[0].display_name
      };
    }
    errors.push("Nominatim returned no matches");
  } catch (error) {
    errors.push(error.message || "Nominatim lookup failed");
  }

  try {
    const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
    url.searchParams.set("address", address);
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("format", "json");

    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Census HTTP ${response.status}`);
    }
    const payload = await response.json();
    const matches = payload?.result?.addressMatches || [];
    if (matches.length) {
      return {
        lat: Number.parseFloat(matches[0].coordinates?.y),
        lng: Number.parseFloat(matches[0].coordinates?.x),
        display: matches[0].matchedAddress || address
      };
    }
    errors.push("Census returned no matches");
  } catch (error) {
    errors.push(error.message || "Census lookup failed");
  }

  throw new Error(`Could not geocode that address. ${errors.join("; ")}`);
}

export function getDeviceLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}

export function coordsLookUS(lat, lng) {
  return lat >= 10 && lat <= 72 && lng >= -170 && lng <= -50;
}
