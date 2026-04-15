import {
  AVAILABILITY_OPTIONS,
  BACKGROUND_OPTIONS,
  CERTIFICATION_OPTIONS,
  CLASS_SIZE_OPTIONS,
  CUSTOM_CURRICULUM_OPTIONS,
  DISCIPLINE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  HAZMAT_SPECIALTY_OPTIONS,
  INDUSTRY_EXPERIENCE_OPTIONS,
  REGION_OPTIONS,
  STATE_OPTIONS,
  SUBMITTER_TYPE,
  TABLE_NAME,
  TRAINING_TYPE_OPTIONS,
  TRAVEL_CAPABILITY_OPTIONS
} from "./constants.js";
import { normalizeTrainerRecord, trainerToDbRow } from "./trainer-schema.js";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase-client.js";
import { resolveConfig } from "./config.js";
import { createCheckbox, createOption, setStatus, uid } from "./utils.js";

function el(id) {
  return document.getElementById(id);
}

const ui = {
  form: el("submissionForm"),
  status: el("status"),
  useDevice: el("useDevice"),
  lat: el("lat"),
  lng: el("lng"),
  address: el("address")
};
const runtimeConfig = resolveConfig();

function getChecked(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
}

function buildFieldOptions() {
  const checkboxMounts = {
    discipline: el("disciplineOptions"),
    hazmatSpecialties: el("hazmatOptions"),
    certifications: el("certificationOptions"),
    background: el("backgroundOptions"),
    industryExperience: el("industryOptions"),
    trainingType: el("trainingTypeOptions")
  };

  const checkboxData = {
    discipline: DISCIPLINE_OPTIONS,
    hazmatSpecialties: HAZMAT_SPECIALTY_OPTIONS,
    certifications: CERTIFICATION_OPTIONS,
    background: BACKGROUND_OPTIONS,
    industryExperience: INDUSTRY_EXPERIENCE_OPTIONS,
    trainingType: TRAINING_TYPE_OPTIONS
  };

  Object.entries(checkboxData).forEach(([field, options]) => {
    options.forEach((value) => checkboxMounts[field].appendChild(createCheckbox(field, value)));
  });

  const selects = {
    travelCapability: [el("travelCapability"), TRAVEL_CAPABILITY_OPTIONS],
    state: [el("state"), STATE_OPTIONS],
    region: [el("region"), REGION_OPTIONS],
    experienceLevel: [el("experienceLevel"), EXPERIENCE_LEVEL_OPTIONS],
    classSize: [el("classSize"), CLASS_SIZE_OPTIONS],
    customCurriculum: [el("customCurriculum"), CUSTOM_CURRICULUM_OPTIONS],
    availability: [el("availability"), AVAILABILITY_OPTIONS],
    submitterType: [el("submitterType"), SUBMITTER_TYPE]
  };

  function appendOptionsIfMissing(select, options) {
    const existingValues = new Set(Array.from(select.options).map((option) => option.value));
    options.forEach((value) => {
      if (!existingValues.has(value)) {
        select.appendChild(createOption(value));
      }
    });
  }

  Object.values(selects).forEach(([select, options]) => {
    appendOptionsIfMissing(select, options);
  });
  el("submitterType").value = "self-submitted";
}

async function geocodeAddress(address) {
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

function getDeviceLocation() {
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

function formPayload() {
  return {
    id: uid(),
    name: el("name").value,
    org: el("org").value,
    email: el("email").value,
    phone: el("phone").value,
    specialty: el("specialty").value,
    topics: el("topics").value,
    notes: el("notes").value,
    locationLabel: "",
    discipline: getChecked("discipline"),
    hazmatSpecialties: getChecked("hazmatSpecialties"),
    travelCapability: el("travelCapability").value,
    state: el("state").value,
    region: el("region").value,
    certifications: getChecked("certifications"),
    experienceLevel: el("experienceLevel").value,
    background: getChecked("background"),
    industryExperience: getChecked("industryExperience"),
    trainingType: getChecked("trainingType"),
    classSize: el("classSize").value,
    customCurriculum: el("customCurriculum").value,
    availability: el("availability").value,
    recordStatus: "pending",
    submitterType: el("submitterType").value || "self-submitted",
    visibility: "admin-only",
    submittedAt: new Date().toISOString(),
    reviewedAt: "",
    reviewedBy: "",
    rejectionReason: ""
  };
}

function coordsLookUs(lat, lng) {
  return lat >= 10 && lat <= 72 && lng >= -170 && lng <= -50;
}

async function resolveCoordinates(payload) {
  if (ui.useDevice.value === "yes") {
    setStatus(ui.status, "Requesting device GPS permission...");
    const device = await getDeviceLocation();
    payload.lat = device.lat;
    payload.lng = device.lng;
    payload.locationLabel = "Device GPS";
    return payload;
  }

  if (ui.address.value.trim()) {
    setStatus(ui.status, "Geocoding address...");
    const geo = await geocodeAddress(ui.address.value.trim());
    payload.lat = geo.lat;
    payload.lng = geo.lng;
    payload.locationLabel = geo.display;
    return payload;
  }

  const lat = Number.parseFloat(ui.lat.value);
  const lng = Number.parseFloat(ui.lng.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Provide address, enable device GPS, or valid latitude/longitude.");
  }

  payload.lat = lat;
  payload.lng = lng;
  payload.locationLabel = "Manual coordinates";
  return payload;
}

async function submitTrainer(event) {
  event.preventDefault();

  if (!hasSupabaseConfig()) {
    setStatus(ui.status, "Supabase config missing. Configure window.TRAINER_LOCATOR_CONFIG first.", "bad");
    return;
  }

  const base = formPayload();
  if (!base.name.trim()) {
    setStatus(ui.status, "Trainer name is required.", "bad");
    return;
  }

  try {
    setStatus(ui.status, "Submitting trainer profile...");
    const payload = await resolveCoordinates(base);
    if (!coordsLookUs(payload.lat, payload.lng)) {
      throw new Error("Coordinates appear outside typical U.S. bounds.");
    }

    const normalized = normalizeTrainerRecord(payload, { forSubmission: true });
    const row = trainerToDbRow(normalized);

    const supabase = getSupabaseClient();
    const { error } = await supabase.from(TABLE_NAME).insert(row);
    if (error) {
      throw new Error(error.message);
    }

    ui.form.reset();
    el("submitterType").value = "self-submitted";
    setStatus(ui.status, "Your trainer profile has been submitted and is awaiting review by the Super Admin.", "ok");
  } catch (error) {
    setStatus(ui.status, error.message || "Submission failed.", "bad");
  }
}

function init() {
  buildFieldOptions();
  ui.form.addEventListener("submit", submitTrainer);
}

init();
