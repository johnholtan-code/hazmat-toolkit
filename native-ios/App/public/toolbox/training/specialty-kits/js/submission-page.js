import * as constants from "./constants.js";
import * as schema from "./kit-schema.js";
import { getSupabaseClient, hasSupabaseConfig } from "./supabase-client.js";
import { escapeHtml, el } from "./utils.js";
import { geocodeAddress, getDeviceLocation, coordsLookUS } from "./geocoding.js";

function getChecked(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
}

function setStatus(msg, klass = "ok") {
  const statusEl = el("status");
  statusEl.innerHTML = `<strong>Status:</strong> <span class="${klass}">${escapeHtml(msg)}</span>`;
}

const ui = {
  form: el("submissionForm"),
  status: el("status"),
  successMessage: el("successMessage"),
  useDevice: el("useDevice"),
  address: el("address"),
  lat: el("lat"),
  lng: el("lng")
};

// Build form options
function buildFieldOptions() {
  const checkboxMounts = {
    kitTypes: el("kitTypesOptions"),
    hazardFocus: el("hazardFocusOptions"),
    equipmentCapabilities: el("equipmentCapabilitiesOptions")
  };

  const checkboxData = {
    kitTypes: constants.KIT_TYPE_OPTIONS,
    hazardFocus: constants.HAZARD_FOCUS_OPTIONS,
    equipmentCapabilities: constants.EQUIPMENT_CAPABILITIES_OPTIONS
  };

  Object.entries(checkboxData).forEach(([field, options]) => {
    options.forEach((value) => {
      const label = document.createElement("label");
      label.className = "chip";
      label.innerHTML = `
        <input type="checkbox" name="${field}" value="${escapeHtml(value)}" />
        <span>${escapeHtml(value)}</span>
      `;
      checkboxMounts[field].appendChild(label);
    });
  });

  // Build selects
  const selects = {
    kitCategory: [el("kitCategory"), constants.KIT_CATEGORY_OPTIONS],
    state: [el("state"), constants.STATE_OPTIONS],
    region: [el("region"), constants.REGION_OPTIONS],
    deploymentType: [el("deploymentType"), constants.DEPLOYMENT_TYPE_OPTIONS],
    availabilityStatus: [el("availabilityStatus"), constants.AVAILABILITY_STATUS_OPTIONS],
    accessType: [el("accessType"), constants.ACCESS_TYPE_OPTIONS],
    storageEnvironment: [el("storageEnvironment"), constants.STORAGE_ENVIRONMENT_OPTIONS],
    transportCapable: [el("transportCapable"), constants.TRANSPORT_CAPABLE_OPTIONS],
    trailerRequired: [el("trailerRequired"), constants.TRAILER_REQUIRED_OPTIONS],
    responseTeamIncluded: [el("responseTeamIncluded"), constants.RESPONSE_TEAM_INCLUDED_OPTIONS],
    trainingRequired: [el("trainingRequired"), constants.TRAINING_REQUIRED_OPTIONS],
    callBeforeUse: [el("callBeforeUse"), constants.CALL_BEFORE_USE_OPTIONS]
  };

  Object.entries(selects).forEach(([field, [select, options]]) => {
    options.forEach((value) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value;
      select.appendChild(opt);
    });
  });
}

async function resolveCoordinates(kit) {
  if (ui.useDevice.value === "yes") {
    setStatus("Requesting device GPS permission...");
    const device = await getDeviceLocation();
    kit.lat = device.lat;
    kit.lng = device.lng;
    kit.locationLabel = kit.locationLabel || "Device GPS";
    return kit;
  }

  if (ui.address.value.trim()) {
    setStatus("Geocoding address...");
    const geo = await geocodeAddress(ui.address.value.trim());
    kit.lat = geo.lat;
    kit.lng = geo.lng;
    kit.locationLabel = kit.locationLabel || geo.display;
    return kit;
  }

  const lat = Number.parseFloat(ui.lat.value);
  const lng = Number.parseFloat(ui.lng.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Provide address, enable device GPS, or valid latitude/longitude.");
  }

  kit.lat = lat;
  kit.lng = lng;
  kit.locationLabel = kit.locationLabel || "Manual coordinates";
  return kit;
}

async function submitForm(e) {
  e.preventDefault();

  if (!hasSupabaseConfig()) {
    setStatus("Configuration missing. Check console.", "bad");
    return;
  }

  try {
    setStatus("Processing coordinates...");

    // Gather form data
    const formData = new FormData(ui.form);
    let kit = {
      kitName: formData.get("kitName") || "",
      organizationName: formData.get("organizationName") || "",
      contactName: formData.get("contactName") || "",
      phone: formData.get("phone") || "",
      secondaryPhone: formData.get("secondaryPhone") || "",
      email: formData.get("email") || "",
      website: formData.get("website") || "",
      notes: formData.get("notes") || "",

      addressLine1: formData.get("addressLine1") || "",
      addressLine2: formData.get("addressLine2") || "",
      city: formData.get("city") || "",
      state: formData.get("state") || "",
      zip: formData.get("zip") || "",
      region: formData.get("region") || "",
      lat: null,
      lng: null,
      locationLabel: formData.get("locationLabel") || "",
      travelOrServiceAreaNotes: formData.get("travelOrServiceAreaNotes") || "",

      kitCategory: formData.get("kitCategory") || "",
      kitTypes: getChecked("kitTypes"),
      hazardFocus: getChecked("hazardFocus"),
      equipmentCapabilities: getChecked("equipmentCapabilities"),
      deploymentType: formData.get("deploymentType") || "",

      availabilityStatus: formData.get("availabilityStatus") || "",
      accessType: formData.get("accessType") || "",
      storageEnvironment: formData.get("storageEnvironment") || "",
      transportCapable: formData.get("transportCapable") || "",
      trailerRequired: formData.get("trailerRequired") || "",
      responseTeamIncluded: formData.get("responseTeamIncluded") || "",
      trainingRequired: formData.get("trainingRequired") || "",
      hoursOfAvailability: formData.get("hoursOfAvailability") || "",
      callBeforeUse: formData.get("callBeforeUse") || "",

      manufacturer: formData.get("manufacturer") || "",
      modelOrBuild: formData.get("modelOrBuild") || "",
      quantitySummary: formData.get("quantitySummary") || ""
    };

    // Resolve coordinates
    kit = await resolveCoordinates(kit);
    if (!coordsLookUS(kit.lat, kit.lng)) {
      throw new Error("Coordinates appear outside typical U.S. bounds.");
    }

    // Normalize and validate
    const normalized = schema.normalizeKitRecord(kit, { forSubmission: true });
    const dbRow = schema.kitToDbRow(normalized);

    setStatus("Submitting kit...", "ok");

    // Insert into Supabase
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from(constants.TABLE_NAME).insert([dbRow]).select();

    if (error) {
      throw error;
    }

    setStatus("Kit submitted successfully!", "ok");
    ui.successMessage.hidden = false;
    ui.form.hidden = true;
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, "bad");
  }
}

// Event listeners
ui.form.addEventListener("submit", submitForm);

// Init
buildFieldOptions();
