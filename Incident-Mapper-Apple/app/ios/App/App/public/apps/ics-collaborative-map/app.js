(() => {
  const config = window.ICS_COLLAB_CONFIG || {};
  const API_BASE_URL = (config.apiBaseUrl || "").replace(/\/$/, "");
  const runtimeConfig = {
    supabaseUrl: (config.supabaseUrl || "").replace(/\/$/, ""),
    supabaseAnonKey: config.supabaseAnonKey || "",
    publicBaseUrl: (config.publicBaseUrl || "").replace(/\/$/, "")
  };
  const STORAGE_KEYS = {
    commanderAuth: "icsCollabCommanderAuth",
    participantAuth: "icsCollabParticipantAuth"
  };
  const POLL_INTERVAL_MS = 4000;
  const UPDATE_FLUSH_MS = 10000;
  const WEATHER_REFRESH_MS = 5 * 60 * 1000;
  const WEATHER_API_BASE_URL = (config.weatherApiBaseUrl || "https://api.open-meteo.com/v1/forecast").replace(/\/$/, "");
  const ICON_MANIFEST_URL = "./icon-manifest.json";
  const ICON_MARKER_OBJECT_TYPE = "IconMarker";
  const ICS_ROLES = [
    "Incident Commander",
    "Operations Section Chief",
    "Planning Section Chief",
    "Logistics Section Chief",
    "Safety Officer",
    "HazMat Group Supervisor",
    "Division Supervisor",
    "Resource Unit Leader",
    "Air Monitoring Team",
    "Decontamination Group"
  ];
  const OBJECT_TEMPLATES = [
    { objectType: "IncidentCommand", label: "Incident Command Post", category: "Command", geometryType: "point", color: "#f3c613", defaults: { incidentName: "", ICName: "", channel: "" } },
    { objectType: "Staging", label: "Staging Area", category: "Command", geometryType: "point", color: "#0d6efd", defaults: { capacity: "", stagingManager: "", apparatusCount: "" } },
    { objectType: "Division", label: "Operational Division", category: "Command", geometryType: "polygon", color: "#3d8bfd", defaults: { divisionName: "", supervisor: "" } },
    { objectType: "AccessRoute", label: "Access Route", category: "Operations", geometryType: "line", color: "#63c174", defaults: {} },
    { objectType: "ExitRoute", label: "Exit Route", category: "Operations", geometryType: "line", color: "#25a18e", defaults: {} },
    { objectType: "Rehab", label: "Medical / Rehab", category: "Operations", geometryType: "point", color: "#94d82d", defaults: { medicUnit: "", capacity: "" } },
    { objectType: "Hydrant", label: "Water Supply / Hydrant", category: "Operations", geometryType: "point", color: "#4dabf7", defaults: { flowRate: "" } },
    { objectType: "HoseLine", label: "Hose Line / Tactical Line", category: "Operations", geometryType: "line", color: "#ff922b", defaults: { diameter: "", assignment: "" } },
    { objectType: "HotZone", label: "Hot Zone", category: "HazMat", geometryType: "polygon", color: "#e03131", defaults: {} },
    { objectType: "WarmZone", label: "Warm Zone", category: "HazMat", geometryType: "polygon", color: "#f08c00", defaults: {} },
    { objectType: "ColdZone", label: "Cold Zone", category: "HazMat", geometryType: "polygon", color: "#1c7ed6", defaults: {} },
    { objectType: "HazardSource", label: "Hazard Source", category: "HazMat", geometryType: "point", color: "#c2255c", defaults: { hazardType: "", product: "" } },
    { objectType: "MonitoringPoint", label: "Air Monitoring Location", category: "HazMat", geometryType: "point", color: "#12b886", defaults: { sensorType: "", value: "", units: "" } },
    { objectType: "DeconCorridor", label: "Decon Corridor", category: "HazMat", geometryType: "line", color: "#15aabf", defaults: {} },
    { objectType: "CollapseZone", label: "Collapse Zone", category: "Safety", geometryType: "polygon", color: "#fa5252", defaults: {} },
    { objectType: "SafetyHazard", label: "Safety Hazard", category: "Safety", geometryType: "polygon", color: "#b23a48", defaults: { severity: "" } },
    { objectType: "EvacuationZone", label: "Evacuation Zone", category: "Safety", geometryType: "polygon", color: "#9775fa", defaults: { evacuationLevel: "" } },
    { objectType: "RIT", label: "RIT Position", category: "Safety", geometryType: "point", color: "#adb5bd", defaults: { crew: "", equipment: "" } }
  ];
  const GUIDED_STEPS = [
    { key: "command", label: "Place Incident Command", objectTypes: ["IncidentCommand"] },
    { key: "staging", label: "Place Staging", objectTypes: ["Staging"] },
    { key: "hazard", label: "Identify Hazard Source", objectTypes: ["HazardSource"] },
    { key: "zone", label: "Draw Collapse or Hot Zone", objectTypes: ["CollapseZone", "HotZone"] },
    { key: "division", label: "Define Divisions", objectTypes: ["Division"] },
    { key: "resources", label: "Assign Initial Resources", objectTypes: ["HoseLine", "Hydrant", "MonitoringPoint", "Rehab", "RIT", "DeconCorridor"] }
  ];
  const MAP_STYLE_OPTIONS = [
    { key: "road", label: "Road", description: "Street-level context", chip: "RD", color: "#6ec1ff" },
    { key: "satellite", label: "Satellite", description: "Aerial imagery", chip: "SAT", color: "#8cc46f" },
    { key: "topo", label: "Topographic", description: "Terrain and contours", chip: "TOP", color: "#e1c26f" }
  ];
  const ICON_CATEGORY_GROUP_OVERRIDES = {
    hazard: "HazMat"
  };

  const ICON_MARKER_TEMPLATE = {
    objectType: ICON_MARKER_OBJECT_TYPE,
    label: "Icon Marker",
    category: "Legacy Icons",
    geometryType: "point",
    color: "#f3c613",
    defaults: {
      notes: "",
      iconId: "",
      iconCategory: "",
      iconLabel: "",
      iconAssetPath: ""
    },
    kind: "icon"
  };
  const templateByType = Object.fromEntries([...OBJECT_TEMPLATES, ICON_MARKER_TEMPLATE].map((template) => [template.objectType, template]));
  const elements = {
    shell: document.querySelector(".shell"),
    landingView: document.getElementById("landingView"),
    appView: document.getElementById("appView"),
    statusBar: document.getElementById("statusBar"),
    signInTabBtn: document.getElementById("signInTabBtn"),
    signUpTabBtn: document.getElementById("signUpTabBtn"),
    commanderAuthBtn: document.getElementById("commanderAuthBtn"),
    commanderSignOutBtn: document.getElementById("commanderSignOutBtn"),
    authFields: document.getElementById("authFields"),
    commanderSignedInSummary: document.getElementById("commanderSignedInSummary"),
    commanderSummaryName: document.getElementById("commanderSummaryName"),
    commanderSummaryEmail: document.getElementById("commanderSummaryEmail"),
    commanderNameInput: document.getElementById("commanderNameInput"),
    commanderEmailInput: document.getElementById("commanderEmailInput"),
    commanderPasswordInput: document.getElementById("commanderPasswordInput"),
    createSessionPanel: document.getElementById("createSessionPanel"),
    createSessionLockedNote: document.getElementById("createSessionLockedNote"),
    createSessionPanelToggle: document.getElementById("createSessionPanelToggle"),
    createSessionPanelBody: document.getElementById("createSessionPanelBody"),
    sessionListPanel: document.getElementById("sessionListPanel"),
    sessionListPanelToggle: document.getElementById("sessionListPanelToggle"),
    sessionListPanelBody: document.getElementById("sessionListPanelBody"),
    commanderSessionList: document.getElementById("commanderSessionList"),
    activeSessionGalleryPanel: document.getElementById("activeSessionGalleryPanel"),
    activeSessionGalleryPanelToggle: document.getElementById("activeSessionGalleryPanelToggle"),
    activeSessionGalleryPanelBody: document.getElementById("activeSessionGalleryPanelBody"),
    activeSessionGallery: document.getElementById("activeSessionGallery"),
    commanderRoleSelect: document.getElementById("commanderRoleSelect"),
    initialIncidentCommanderRoleInput: document.getElementById("initialIncidentCommanderRoleInput"),
    incidentNameInput: document.getElementById("incidentNameInput"),
    opStartInput: document.getElementById("opStartInput"),
    opEndInput: document.getElementById("opEndInput"),
    guidedSetupDefaultInput: document.getElementById("guidedSetupDefaultInput"),
    createSessionBtn: document.getElementById("createSessionBtn"),
    createSessionFocusBadge: document.getElementById("createSessionFocusBadge"),
    createSessionFocusPrompt: document.getElementById("createSessionFocusPrompt"),
    joinCodeInput: document.getElementById("joinCodeInput"),
    joinDisplayNameInput: document.getElementById("joinDisplayNameInput"),
    joinPermissionSelect: document.getElementById("joinPermissionSelect"),
    joinRoleSelect: document.getElementById("joinRoleSelect"),
    joinSessionBtn: document.getElementById("joinSessionBtn"),
    joinLockedNote: document.getElementById("joinLockedNote"),
    joinSessionPanelToggle: document.getElementById("joinSessionPanelToggle"),
    joinSessionPanelBody: document.getElementById("joinSessionPanelBody"),
    whatHappensPanelToggle: document.getElementById("whatHappensPanelToggle"),
    whatHappensPanelBody: document.getElementById("whatHappensPanelBody"),
    paletteContainer: document.getElementById("paletteContainer"),
    participantList: document.getElementById("participantList"),
    guidedSteps: document.getElementById("guidedSteps"),
    startGuidedSetupBtn: document.getElementById("startGuidedSetupBtn"),
    guidedModeBtn: document.getElementById("guidedModeBtn"),
    setIncidentFocusBtn: document.getElementById("setIncidentFocusBtn"),
    centerIncidentBtn: document.getElementById("centerIncidentBtn"),
    weatherLauncherBtn: document.getElementById("weatherLauncherBtn"),
    weatherPanel: document.getElementById("weatherPanel"),
    weatherSourceLabel: document.getElementById("weatherSourceLabel"),
    weatherSummary: document.getElementById("weatherSummary"),
    weatherMeta: document.getElementById("weatherMeta"),
    weatherMetrics: document.getElementById("weatherMetrics"),
    refreshWeatherBtn: document.getElementById("refreshWeatherBtn"),
    viewerCenterIncidentBtn: document.getElementById("viewerCenterIncidentBtn"),
    guidedSetupToggle: document.getElementById("guidedSetupToggle"),
    mapStyleLauncherBtn: document.getElementById("mapStyleLauncherBtn"),
    mapStyleCloseBtn: document.getElementById("mapStyleCloseBtn"),
    mapStyleTray: document.getElementById("mapStyleTray"),
    mapStyleTrayGrid: document.getElementById("mapStyleTrayGrid"),
    leaveSessionBtn: document.getElementById("leaveSessionBtn"),
    sessionSignOutBtn: document.getElementById("sessionSignOutBtn"),
    showViewerQrBtn: document.getElementById("showViewerQrBtn"),
    quickFlowPanel: document.getElementById("quickFlowPanel"),
    sessionPanel: document.getElementById("sessionPanel"),
    sessionPanelToggle: document.getElementById("sessionPanelToggle"),
    participantsPanel: document.getElementById("participantsPanel"),
    participantsPanelToggle: document.getElementById("participantsPanelToggle"),
    palettesPanel: document.getElementById("palettesPanel"),
    palettesPanelToggle: document.getElementById("palettesPanelToggle"),
    copyJoinLinkBtn: document.getElementById("copyJoinLinkBtn"),
    endSessionBtn: document.getElementById("endSessionBtn"),
    sessionMeta: document.getElementById("sessionMeta"),
    sessionFocusPrompt: document.getElementById("sessionFocusPrompt"),
    sessionPeriodPanel: document.getElementById("sessionPeriodPanel"),
    sessionPeriodPanelToggle: document.getElementById("sessionPeriodPanelToggle"),
    incidentCommandPanel: document.getElementById("incidentCommandPanel"),
    incidentCommandPanelToggle: document.getElementById("incidentCommandPanelToggle"),
    sessionIncidentCommanderNameInput: document.getElementById("sessionIncidentCommanderNameInput"),
    updateIncidentCommandBtn: document.getElementById("updateIncidentCommandBtn"),
    sessionOpStartInput: document.getElementById("sessionOpStartInput"),
    sessionOpEndInput: document.getElementById("sessionOpEndInput"),
    updateOperationalPeriodBtn: document.getElementById("updateOperationalPeriodBtn"),
    selectedObjectEmpty: document.getElementById("selectedObjectEmpty"),
    selectedObjectPanel: document.getElementById("selectedObjectPanel"),
    selectedObjectMeta: document.getElementById("selectedObjectMeta"),
    selectedObjectFields: document.getElementById("selectedObjectFields"),
    selectedObjectActions: document.getElementById("selectedObjectActions"),
    saveFieldsBtn: document.getElementById("saveFieldsBtn"),
    editGeometryBtn: document.getElementById("editGeometryBtn"),
    deleteObjectBtn: document.getElementById("deleteObjectBtn"),
    drawControls: document.getElementById("drawControls"),
    drawHintText: document.getElementById("drawHintText"),
    finishGeometryBtn: document.getElementById("finishGeometryBtn"),
    cancelGeometryBtn: document.getElementById("cancelGeometryBtn"),
    rightSidebar: document.getElementById("rightSidebar"),
    rightSidebarCollapseBtn: document.getElementById("rightSidebarCollapseBtn"),
    viewerQrModal: document.getElementById("viewerQrModal"),
    closeViewerQrBtn: document.getElementById("closeViewerQrBtn"),
    viewerQrImage: document.getElementById("viewerQrImage"),
    viewerQrLink: document.getElementById("viewerQrLink"),
    copyViewerLinkBtn: document.getElementById("copyViewerLinkBtn")
  };

  const state = {
    authTab: "signin",
    commanderAuth: loadStoredJSON(STORAGE_KEYS.commanderAuth),
    participantAuth: loadStoredJSON(STORAGE_KEYS.participantAuth),
    activeSession: null,
    actor: null,
    snapshotLoaded: false,
    objects: new Map(),
    participants: [],
    layers: new Map(),
    iconCatalog: { categories: [], icons: [] },
    selectedObjectId: null,
    selectedTemplateType: null,
    drawState: null,
    pendingMutations: new Map(),
    flushTimer: null,
    pollTimer: null,
    lastVersion: 0,
    guidedMode: false,
    qrPayload: null,
    map: null,
    baseLayers: null,
    activeBaseLayerKey: "road",
    objectLayerGroup: null,
    editHandleLayerGroup: null,
    currentLocationMarker: null,
    currentLocation: null,
    previewLayer: null,
    sessionRefreshNonce: 0,
    dragTemplateType: null,
    collapsedPaletteCategories: new Set(),
    collapsedPanels: new Set(["session", "sessionPeriod", "incidentCommand", "participants", "palettes"]),
    collapsedLandingSections: new Set(["createSession", "joinSession", "whatHappens", "activeSessions"]),
    viewerMode: false,
    viewerJoinCode: null,
    rightSidebarCollapsed: false,
    mapStyleTrayOpen: false,
    incidentFocusSignature: "",
    weatherPanelOpen: false,
    weatherLoading: false,
    weatherData: null,
    weatherError: "",
    weatherTargetSignature: "",
    weatherFetchNonce: 0,
    weatherTimer: null
  };

  async function init() {
    await loadIconManifest();
    if (elements.initialIncidentCommanderRoleInput) {
      elements.initialIncidentCommanderRoleInput.value = "Incident Commander";
    }
    populateRoleSelect(elements.joinRoleSelect, "Operations Section Chief", {
      exclude: ["Incident Commander"]
    });
    await hydrateAuthUI();
    wireEvents();
    initMap();
    const url = new URL(window.location.href);
    const joinCode = url.searchParams.get("join");
    state.viewerMode = url.searchParams.get("view") === "1";
    state.viewerJoinCode = state.viewerMode && joinCode ? joinCode.toUpperCase() : null;
    if (joinCode) {
      elements.joinCodeInput.value = joinCode.toUpperCase();
      setStatus(state.viewerMode ? "Viewer link loaded." : "Join code loaded from share link.");
    }
    setDefaultOperationalPeriodInputs();
    if (state.viewerMode && state.viewerJoinCode) {
      await openViewerSession(state.viewerJoinCode);
      return;
    }
    await restorePersistedSession();
    renderAll();
  }

  async function loadIconManifest() {
    try {
      state.iconCatalog = {
        ...(await fetchIconManifestPayload())
      };
    } catch (error) {
      console.warn("Unable to load icon manifest.", error);
      state.iconCatalog = { categories: [], icons: [] };
    }
  }

  async function fetchIconManifestPayload() {
    if (window.ICS_ICON_MANIFEST) {
      return window.ICS_ICON_MANIFEST;
    }
    const response = await fetch(ICON_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Icon manifest request failed (${response.status})`);
    }
    return response.json();
  }

  function wireEvents() {
    elements.signInTabBtn.addEventListener("click", () => setAuthTab("signin"));
    elements.signUpTabBtn.addEventListener("click", () => setAuthTab("signup"));
    elements.commanderAuthBtn.addEventListener("click", onCommanderAuth);
    elements.commanderSignOutBtn.addEventListener("click", signOutCommander);
    elements.createSessionPanelToggle.addEventListener("click", () => toggleLandingSection("createSession"));
    elements.sessionListPanelToggle.addEventListener("click", () => toggleLandingSection("reviewSessions"));
    elements.joinSessionPanelToggle.addEventListener("click", () => toggleLandingSection("joinSession"));
    elements.whatHappensPanelToggle.addEventListener("click", () => toggleLandingSection("whatHappens"));
    elements.activeSessionGalleryPanelToggle.addEventListener("click", () => toggleLandingSection("activeSessions"));
    elements.createSessionBtn.addEventListener("click", onCreateSession);
    elements.joinSessionBtn.addEventListener("click", onJoinSession);
    elements.startGuidedSetupBtn.addEventListener("click", () => toggleGuidedMode(true));
    elements.guidedModeBtn.addEventListener("click", () => toggleGuidedMode(!state.guidedMode));
    elements.setIncidentFocusBtn.addEventListener("click", onSetIncidentFocusAction);
    elements.centerIncidentBtn.addEventListener("click", onCenterIncidentAction);
    elements.weatherLauncherBtn.addEventListener("click", toggleWeatherPanel);
    elements.refreshWeatherBtn.addEventListener("click", () => {
      void refreshWeatherForCurrentTarget({ force: true, silent: false });
    });
    elements.viewerCenterIncidentBtn.addEventListener("click", onCenterIncidentAction);
    elements.guidedSetupToggle.addEventListener("change", (event) => toggleGuidedMode(event.target.checked));
    elements.mapStyleLauncherBtn.addEventListener("click", toggleMapStyleTray);
    elements.mapStyleCloseBtn.addEventListener("click", closeMapStyleTray);
    elements.leaveSessionBtn.addEventListener("click", leaveCurrentSession);
    elements.sessionSignOutBtn.addEventListener("click", signOutCommander);
    elements.showViewerQrBtn.addEventListener("click", showViewerQrModal);
    elements.sessionPanelToggle.addEventListener("click", () => togglePanel("session"));
    elements.sessionPeriodPanelToggle.addEventListener("click", () => togglePanel("sessionPeriod"));
    elements.incidentCommandPanelToggle.addEventListener("click", () => togglePanel("incidentCommand"));
    elements.participantsPanelToggle.addEventListener("click", () => togglePanel("participants"));
    elements.palettesPanelToggle.addEventListener("click", () => togglePanel("palettes"));
    elements.copyJoinLinkBtn.addEventListener("click", copyJoinLink);
    elements.closeViewerQrBtn.addEventListener("click", hideViewerQrModal);
    elements.copyViewerLinkBtn.addEventListener("click", copyViewerLink);
    elements.endSessionBtn.addEventListener("click", endSession);
    elements.updateOperationalPeriodBtn.addEventListener("click", updateOperationalPeriod);
    elements.updateIncidentCommandBtn.addEventListener("click", updateIncidentCommand);
    elements.saveFieldsBtn.addEventListener("click", saveSelectedObjectFields);
    elements.editGeometryBtn.addEventListener("click", startGeometryEdit);
    elements.deleteObjectBtn.addEventListener("click", deleteSelectedObject);
    elements.finishGeometryBtn.addEventListener("click", finishGeometryDraw);
    elements.cancelGeometryBtn.addEventListener("click", cancelGeometryDraw);
    elements.rightSidebarCollapseBtn.addEventListener("click", toggleRightSidebar);
    window.addEventListener("resize", scheduleMapResizeRefresh);
  }

  function initMap() {
    state.map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([39.5, -98.35], 4);
    state.baseLayers = createBaseLayers();
    state.baseLayers[state.activeBaseLayerKey].addTo(state.map);
    L.control.layers(
      {
        Road: state.baseLayers.road,
        Satellite: state.baseLayers.satellite,
        Topographic: state.baseLayers.topo
      },
      {},
      { collapsed: true }
    ).addTo(state.map);
    state.objectLayerGroup = L.layerGroup().addTo(state.map);
    state.editHandleLayerGroup = L.layerGroup().addTo(state.map);
    state.map.on("click", onMapClick);
    state.map.on("baselayerchange", (event) => {
      const nextKey = Object.entries(state.baseLayers || {}).find(([, layer]) => layer === event.layer)?.[0];
      if (nextKey) {
        state.activeBaseLayerKey = nextKey;
        renderMapStyleTray();
      }
    });
    state.map.on("moveend", onMapMoveEnd);
    const mapContainer = state.map.getContainer();
    mapContainer.addEventListener("dragover", onMapDragOver);
    mapContainer.addEventListener("dragleave", onMapDragLeave);
    mapContainer.addEventListener("drop", onMapDrop);
    scheduleMapResizeRefresh();
    requestCurrentLocation({ recenter: true, force: false });
  }

  function createBaseLayers() {
    return {
      road: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 20,
        attribution: "Tiles &copy; Esri",
        crossOrigin: true,
        updateWhenIdle: true,
        keepBuffer: 4
      }),
      satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 20,
        attribution: "Tiles &copy; Esri",
        crossOrigin: true,
        updateWhenIdle: true,
        keepBuffer: 4
      }),
      topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
        subdomains: ["a", "b", "c"],
        attribution: "Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap",
        crossOrigin: true,
        updateWhenIdle: true,
        keepBuffer: 4
      })
    };
  }

  function setBaseLayer(layerKey) {
    if (!state.map || !state.baseLayers || !state.baseLayers[layerKey]) return;
    if (state.baseLayers[state.activeBaseLayerKey]) {
      state.map.removeLayer(state.baseLayers[state.activeBaseLayerKey]);
    }
    state.activeBaseLayerKey = layerKey;
    state.baseLayers[layerKey].addTo(state.map);
    renderMapStyleTray();
  }

  function scheduleMapResizeRefresh() {
    if (!state.map) return;
    requestAnimationFrame(() => {
      if (!state.map) return;
      state.map.invalidateSize(false);
      refreshActiveBaseLayer();
      window.setTimeout(() => {
        if (!state.map) return;
        state.map.invalidateSize(false);
        refreshActiveBaseLayer();
      }, 200);
    });
  }

  function refreshActiveBaseLayer() {
    const activeLayer = state.baseLayers?.[state.activeBaseLayerKey];
    if (!activeLayer) return;
    if (typeof activeLayer.redraw === "function") {
      activeLayer.redraw();
    }
  }

  function requestCurrentLocation({ recenter = false, force = false } = {}) {
    if (!navigator.geolocation || !state.map) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!state.map) return;
        const { latitude, longitude, accuracy } = position.coords;
        const latLng = [latitude, longitude];
        state.currentLocation = {
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || null
        };
        renderCurrentLocationMarker();
        if (state.activeSession) {
          void refreshWeatherForCurrentTarget({ force: false, silent: true });
        }
        const shouldCenter =
          force ||
          recenter ||
          !state.snapshotLoaded ||
          state.objects.size === 0;
        if (shouldCenter) {
          state.map.setView(latLng, 18);
          scheduleMapResizeRefresh();
          setStatus("Centered map on your current location.");
        }
      },
      () => {
        // Leave the default map extent in place when geolocation is unavailable or denied.
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000
      }
    );
  }

  function renderCurrentLocationMarker() {
    if (!state.map || !state.objectLayerGroup || !state.currentLocation) return;
    if (state.currentLocationMarker) {
      state.objectLayerGroup.removeLayer(state.currentLocationMarker);
      state.currentLocationMarker = null;
    }
    const { lat, lng, accuracy } = state.currentLocation;
    state.currentLocationMarker = L.circleMarker([lat, lng], {
      radius: 7,
      color: "#f8f9fa",
      weight: 2,
      fillColor: "#f3c613",
      fillOpacity: 0.95
    })
      .bindTooltip(`Current location${accuracy ? ` (+/- ${Math.round(accuracy)} m)` : ""}`, { direction: "top" })
      .addTo(state.objectLayerGroup);
  }

  async function hydrateAuthUI() {
    await loadRuntimeMetaConfig();
    const authReady = hasSupabaseAuthConfig();
    elements.commanderAuthBtn.disabled = !authReady;
    if (!authReady) {
      setStatus("Session owner auth needs Supabase public config.");
    }
  }

  function setAuthTab(tab) {
    state.authTab = tab;
    elements.signInTabBtn.classList.toggle("active", tab === "signin");
    elements.signUpTabBtn.classList.toggle("active", tab === "signup");
    elements.commanderAuthBtn.textContent = tab === "signin" ? "Sign In" : "Create Account";
  }

  async function onCommanderAuth() {
    if (!hasSupabaseAuthConfig()) {
      setStatus("Supabase auth is not configured for session owner sign-in.");
      return;
    }
    const email = elements.commanderEmailInput.value.trim();
    const password = elements.commanderPasswordInput.value;
    const displayName = elements.commanderNameInput.value.trim();
    if (!displayName || !email || !password) {
      setStatus("Enter a session owner display name, email, and password.");
      return;
    }

    setStatus(state.authTab === "signin" ? "Signing in session owner…" : "Creating session owner account…");
    try {
      const authResponse = state.authTab === "signin"
        ? await supabasePasswordSignIn(email, password)
        : await supabaseSignUp(email, password, displayName);
      if (!authResponse?.access_token) {
        const createdUser = authResponse?.user?.id ? authResponse.user : (authResponse?.id ? authResponse : null);
        if (state.authTab === "signup" && createdUser?.id) {
          const looksLikeExistingEmailResponse = Array.isArray(createdUser.identities)
            && createdUser.identities.length === 0
            && !createdUser.confirmed_at
            && !createdUser.email_confirmed_at;
          if (looksLikeExistingEmailResponse) {
            setStatus("This email may already exist in Supabase or be stuck in a stale signup state. Try Sign In, Reset Password, or use a different email.");
            return;
          }
          const confirmationMessage = createdUser?.confirmed_at
            ? "Session owner account created. Sign in with the new account."
            : "Session owner account created. Check email confirmation settings in Supabase if sign-in is not immediate.";
          setStatus(confirmationMessage);
          return;
        }
        const details = authResponse ? JSON.stringify(authResponse) : "No user or session returned from Supabase.";
        setStatus(`Supabase signup did not return a usable account: ${details}`);
        return;
      }
      state.commanderAuth = normalizeCommanderAuth(authResponse, displayName);
      persistJSON(STORAGE_KEYS.commanderAuth, state.commanderAuth);
      elements.commanderPasswordInput.value = "";
      await refreshCommanderSessions();
      renderAll();
      setStatus(`Signed in as ${state.commanderAuth.displayName || state.commanderAuth.email}.`);
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function supabasePasswordSignIn(email, password) {
    const response = await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify({ email, password })
    });
    return await parseSupabaseAuthResponse(response);
  }

  async function supabaseSignUp(email, password, displayName) {
    const emailRedirectTo = getAuthRedirectUrl();
    const response = await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify({
        email,
        password,
        emailRedirectTo,
        redirect_to: emailRedirectTo,
        data: {
          display_name: displayName
        },
        options: {
          data: {
            display_name: displayName
          },
          emailRedirectTo
        }
      })
    });
    return await parseSupabaseAuthResponse(response);
  }

  async function refreshCommanderTokenIfNeeded() {
    if (!state.commanderAuth || !state.commanderAuth.refreshToken) return;
    const expiresAt = Number(state.commanderAuth.expiresAt || 0);
    if (expiresAt && Date.now() < expiresAt - 60_000) return;
    if (!hasSupabaseAuthConfig()) return;
    const response = await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify({ refresh_token: state.commanderAuth.refreshToken })
    });
    const session = await parseSupabaseAuthResponse(response);
    if (session?.access_token) {
      state.commanderAuth = normalizeCommanderAuth(session, state.commanderAuth.displayName);
      persistJSON(STORAGE_KEYS.commanderAuth, state.commanderAuth);
    }
  }

  async function refreshCommanderSessions() {
    if (!state.commanderAuth?.accessToken) return;
    await refreshCommanderTokenIfNeeded();
    const [sessions, activeSessions] = await Promise.all([
      apiFetch("/v1/ics-collab/sessions", { actorType: "commander" }),
      apiFetch("/v1/ics-collab/sessions/active", { actorType: "commander" })
    ]);
    renderCommanderSessions(Array.isArray(sessions) ? sessions : []);
    renderActiveSessionGallery(Array.isArray(activeSessions) ? activeSessions : []);
    elements.createSessionPanel.classList.remove("hidden");
    elements.sessionListPanel.classList.remove("hidden");
    elements.activeSessionGalleryPanel.classList.remove("hidden");
    elements.commanderSignOutBtn.classList.remove("hidden");
  }

  async function openViewerSession(joinCode) {
    try {
      const response = await apiFetch(`/v1/ics-collab/view/${encodeURIComponent(joinCode)}`, {
        actorType: "public"
      });
      state.viewerMode = true;
      state.viewerJoinCode = joinCode;
      state.actor = {
        id: "viewer",
        displayName: "Viewer",
        permissionTier: "observer",
        icsRole: "Viewer"
      };
      await openSession(response.session, state.actor, "viewer", response.snapshot);
      setStatus(`Viewing ${response.session.incidentName} in read-only mode.`);
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function onCreateSession() {
    if (!state.commanderAuth?.accessToken) {
      setStatus("Sign in as session owner before creating a session.");
      return;
    }
    const incidentName = elements.incidentNameInput.value.trim();
    const ownerName = elements.commanderNameInput.value.trim() || state.commanderAuth.displayName || state.commanderAuth.email || "Owner";
    const operationalPeriodStart = inputValueToISOString(elements.opStartInput.value);
    const operationalPeriodEnd = inputValueToISOString(elements.opEndInput.value);
    if (!incidentName || !operationalPeriodStart || !operationalPeriodEnd) {
      setStatus("Enter incident name and a valid operational period.");
      return;
    }
    setStatus("Creating collaborative session…");
    try {
      state.guidedMode = Boolean(elements.guidedSetupDefaultInput.checked);
      const result = await apiFetch("/v1/ics-collab/sessions", {
        method: "POST",
        actorType: "commander",
        body: {
          incidentName,
          commanderName: ownerName,
          operationalPeriodStart,
          operationalPeriodEnd
        }
      });
      state.qrPayload = result.qrPayload || null;
      await openSession(result.session, result.participant, "commander");
      await refreshCommanderSessions();
      setStatus(`Collaborative session ${result.session.joinCode} is ready.`);
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function onJoinSession() {
    if (!state.commanderAuth?.accessToken) {
      setStatus("Sign in with an account before joining a session.");
      return;
    }
    const joinCode = elements.joinCodeInput.value.trim().toUpperCase();
    const displayName = elements.joinDisplayNameInput.value.trim();
    const permissionTier = elements.joinPermissionSelect.value;
    const icsRole = elements.joinRoleSelect.value;
    if (!joinCode || !displayName || !icsRole) {
      setStatus("Enter a join code, display name, and ICS role.");
      return;
    }
    setStatus("Joining collaborative session…");
    try {
      const result = await apiFetch("/v1/ics-collab/sessions/join", {
        method: "POST",
        actorType: "commander",
        body: { joinCode, displayName, permissionTier, icsRole }
      });
      state.participantAuth = {
        sessionId: result.session.id,
        accessToken: result.token.accessToken,
        expiresAt: result.token.expiresAt,
        displayName: result.participant.displayName,
        participantId: result.participant.id
      };
      persistJSON(STORAGE_KEYS.participantAuth, state.participantAuth);
      state.qrPayload = result.qrPayload || null;
      await openSession(result.session, result.participant, "participant", result.snapshot);
      setStatus(`Joined ${result.session.incidentName} as ${result.participant.displayName}.`);
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function openSession(session, actor, actorType, snapshot) {
    clearPolling();
    state.activeSession = session;
    state.actor = actor;
    state.lastVersion = Number(session.currentVersion || 0);
    state.selectedObjectId = null;
    state.selectedTemplateType = null;
    state.drawState = null;
    state.qrPayload = state.qrPayload || JSON.stringify({ type: "ics_collab_join", joinCode: session.joinCode });
    elements.landingView.classList.add("hidden");
    elements.appView.classList.remove("hidden");
    elements.shell.classList.toggle("viewer-mode", state.viewerMode);
    if (actorType === "participant") {
      persistJSON(STORAGE_KEYS.participantAuth, state.participantAuth);
    }
    const resolvedSnapshot = snapshot || (
      state.viewerMode && state.viewerJoinCode
        ? await apiFetch(`/v1/ics-collab/view/${encodeURIComponent(state.viewerJoinCode)}`, { actorType: "public" })
        : await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(session.id)}/snapshot`, { actorType })
    );
    const payload = resolvedSnapshot.snapshot || resolvedSnapshot;
    if (resolvedSnapshot.actor && !state.actor) {
      state.actor = resolvedSnapshot.actor;
    }
    scheduleMapResizeRefresh();
    requestCurrentLocation({ recenter: true, force: true });
    applySnapshot(payload);
    syncIncidentFocusState({ notify: false });
    renderAll();
    scheduleMapResizeRefresh();
    const centeredOnIncident = centerOnIncidentFocus({ notify: false, fallbackToBounds: false });
    if (!centeredOnIncident) {
      fitMapIfNeeded();
    }
    if (!state.objects.size && !centeredOnIncident) {
      requestCurrentLocation({ recenter: true, force: true });
    }
    scheduleMapResizeRefresh();
    void refreshWeatherForCurrentTarget({ force: true, silent: true });
    startWeatherPolling();
    startPolling();
  }

  function applySnapshot(snapshot) {
    state.snapshotLoaded = true;
    state.objects = new Map();
    (snapshot.objects || []).forEach((object) => {
      if (!object.isDeleted) {
        state.objects.set(object.id, object);
      }
    });
    state.participants = snapshot.participants || [];
    syncMapObjects();
    syncIncidentFocusState({ notify: false });
    if (state.selectedObjectId && !state.objects.has(state.selectedObjectId)) {
      state.selectedObjectId = null;
    }
  }

  function startPolling() {
    clearPolling();
    state.pollTimer = window.setInterval(async () => {
      if (!state.activeSession) return;
      try {
        const previousStatus = effectiveSessionStatus(state.activeSession);
        const deltas = state.viewerMode && state.viewerJoinCode
          ? await apiFetch(`/v1/ics-collab/view/${encodeURIComponent(state.viewerJoinCode)}/deltas?sinceVersion=${encodeURIComponent(String(state.lastVersion))}`, {
            actorType: "public"
          })
          : await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/deltas?sinceVersion=${encodeURIComponent(String(state.lastVersion))}`, {
            actorType: currentActorType()
          });
        if (deltas.session) {
          state.activeSession = deltas.session;
          state.lastVersion = Number(deltas.currentVersion || state.lastVersion);
        }
        const nextStatus = effectiveSessionStatus(state.activeSession);
        if (previousStatus !== nextStatus) {
          if (nextStatus !== "active") {
            cancelGeometryDraw();
          }
          syncMapObjects();
          renderAll();
        }
        if (Array.isArray(deltas.deltas) && deltas.deltas.length > 0) {
          const snapshotResponse = state.viewerMode
            ? await apiFetch(`/v1/ics-collab/view/${encodeURIComponent(state.viewerJoinCode)}`, { actorType: "public" })
            : await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/snapshot`, {
              actorType: currentActorType()
            });
          if (snapshotResponse.session) state.activeSession = snapshotResponse.session;
          if (snapshotResponse.actor) state.actor = snapshotResponse.actor;
          applySnapshot(snapshotResponse.snapshot || snapshotResponse);
          renderAll();
        } else if (!state.viewerMode && state.sessionRefreshNonce % 3 === 0) {
          const participants = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/participants`, {
            actorType: currentActorType()
          });
          state.participants = participants || [];
          renderParticipants();
          renderSessionMeta();
        }
        state.sessionRefreshNonce += 1;
      } catch (error) {
        setStatus(formatError(error));
      }
    }, POLL_INTERVAL_MS);
  }

  function clearPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  async function restorePersistedSession() {
    try {
      if (state.participantAuth?.sessionId && state.participantAuth?.accessToken) {
        const snapshotResponse = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.participantAuth.sessionId)}/snapshot`, {
          actorType: "participant"
        });
        state.actor = snapshotResponse.actor;
        await openSession(snapshotResponse.session, snapshotResponse.actor, "participant", snapshotResponse.snapshot);
        setStatus(`Restored collaborative session for ${snapshotResponse.actor.displayName}.`);
        return;
      }
    } catch (error) {
      clearParticipantAuth();
    }

    try {
      if (state.commanderAuth?.accessToken) {
        await refreshCommanderSessions();
        setStatus(`Session owner ready: ${state.commanderAuth.displayName || state.commanderAuth.email}.`);
      }
    } catch (error) {
      void signOutCommander();
    }
  }

  async function signOutCommander() {
    if (state.activeSession && isCommander()) {
      try {
        await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/leave`, {
          method: "POST",
          actorType: "commander"
        });
      } catch (_error) {
        // Continue clearing local auth even if the leave call fails.
      }
    }
    state.commanderAuth = null;
    persistJSON(STORAGE_KEYS.commanderAuth, null);
    elements.createSessionPanel.classList.add("hidden");
    elements.sessionListPanel.classList.add("hidden");
    elements.activeSessionGalleryPanel.classList.add("hidden");
    elements.commanderSignOutBtn.classList.add("hidden");
    elements.sessionSignOutBtn.classList.add("hidden");
    if (!state.participantAuth) {
      exitActiveWorkspace();
    }
    renderCommanderSessions([]);
    renderActiveSessionGallery([]);
    renderAll();
    setStatus("Session owner signed out.");
  }

  function clearParticipantAuth() {
    state.participantAuth = null;
    persistJSON(STORAGE_KEYS.participantAuth, null);
  }

  function exitActiveWorkspace() {
    clearPolling();
    clearWeatherPolling();
    state.activeSession = null;
    state.actor = null;
    state.objects = new Map();
    state.participants = [];
    state.selectedObjectId = null;
    state.selectedTemplateType = null;
    state.drawState = null;
    state.guidedMode = false;
    state.qrPayload = null;
    state.viewerMode = false;
    state.viewerJoinCode = null;
    state.incidentFocusSignature = "";
    state.weatherPanelOpen = false;
    state.weatherLoading = false;
    state.weatherData = null;
    state.weatherError = "";
    state.weatherTargetSignature = "";
    state.weatherFetchNonce = 0;
    cancelGeometryPreviewOnly();
    syncMapObjects();
    updateDrawControls();
    hideViewerQrModal();
    elements.landingView.classList.remove("hidden");
    elements.appView.classList.add("hidden");
    elements.shell.classList.remove("viewer-mode");
    scheduleMapResizeRefresh();
  }

  async function leaveCurrentSession() {
    if (!state.activeSession || !state.actor) {
      setStatus("No active session to leave.");
      return;
    }
    const sessionId = state.activeSession.id;
    const leavingAsCommander =
      state.actor?.permissionTier === "commander" && Boolean(state.commanderAuth?.accessToken);
    const actorType = currentActorType();
    const shouldRefreshCommanderSessions = leavingAsCommander && Boolean(state.commanderAuth?.accessToken);
    const prompt = leavingAsCommander
      ? "Leave this session and return to your session owner dashboard?"
      : "Leave this session? You can rejoin later with the join code.";
    if (!window.confirm(prompt)) return;

    if (state.participantAuth?.sessionId === sessionId) {
      clearParticipantAuth();
    }
    exitActiveWorkspace();
    renderAll();
    setStatus("Leaving collaborative session…");
    try {
      await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(sessionId)}/leave`, {
        method: "POST",
        actorType
      });
    } catch (error) {
      if (shouldRefreshCommanderSessions) {
        try {
          await refreshCommanderSessions();
        } catch (_refreshError) {
          // Ignore secondary refresh failures here.
        }
      }
      setStatus(`Left locally. ${formatError(error)}`);
      return;
    }
    if (shouldRefreshCommanderSessions) {
      try {
        await refreshCommanderSessions();
      } catch (error) {
        setStatus(formatError(error));
        return;
      }
      setStatus("Left the collaborative session.");
      return;
    }
    setStatus("Left the collaborative session.");
  }

  async function updateOperationalPeriod() {
    if (!isCommander()) {
      setStatus("Only the session owner can update the operational period.");
      return;
    }
    const operationalPeriodStart = inputValueToISOString(elements.sessionOpStartInput.value);
    const operationalPeriodEnd = inputValueToISOString(elements.sessionOpEndInput.value);
    if (!operationalPeriodStart || !operationalPeriodEnd) {
      setStatus("Enter a valid operational period start and end.");
      return;
    }
    try {
      const session = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/operational-period`, {
        method: "PATCH",
        actorType: "commander",
        body: { operationalPeriodStart, operationalPeriodEnd }
      });
      state.activeSession = session;
      renderSessionMeta();
      setStatus("Operational period updated.");
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function updateIncidentCommand() {
    if (!isCommander()) {
      setStatus("Only the session owner can assign the Incident Commander.");
      return;
    }
    const commanderName = elements.sessionIncidentCommanderNameInput.value.trim();
    if (!commanderName) {
      setStatus("Enter the name of the assigned Incident Commander.");
      return;
    }
    try {
      const session = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/incident-command`, {
        method: "PATCH",
        actorType: "commander",
        body: { commanderName }
      });
      state.activeSession = session;
      renderSessionMeta();
      setStatus("Incident Commander assignment updated.");
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function endSession() {
    if (!isCommander()) {
      setStatus("Only the session owner can end the session.");
      return;
    }
    if (!window.confirm("End this collaborative session? It will become read-only for everyone.")) {
      return;
    }
    try {
      const session = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/end`, {
        method: "POST",
        actorType: "commander"
      });
      state.activeSession = session;
      renderAll();
      setStatus("Session ended. The map is now read-only.");
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  function toggleGuidedMode(enabled) {
    state.guidedMode = Boolean(enabled);
    renderGuidedSteps();
    renderGuidedControls();
    setStatus(state.guidedMode ? "Guided setup is active." : "Guided setup hidden.");
  }

  function renderAll() {
    renderCommanderAuthPanels();
    renderLandingSectionCollapses();
    renderIncidentFocusUI();
    renderWeatherUI();
    renderSessionMeta();
    renderParticipants();
    renderPalettes();
    renderMapStyleTray();
    renderGuidedSteps();
    renderSelectedObject();
    updateDrawControls();
    renderGuidedControls();
    renderPanelCollapses();
    renderRightSidebarState();
  }

  function renderGuidedControls() {
    elements.guidedSetupToggle.checked = state.guidedMode;
    elements.guidedModeBtn.textContent = state.guidedMode ? "Hide Guided Setup" : "10-Minute Setup";
    elements.quickFlowPanel.classList.toggle("collapsed", !state.guidedMode);
    elements.appView.classList.toggle("guided-collapsed", !state.guidedMode);
  }

  function toggleLandingSection(sectionKey) {
    if (state.collapsedLandingSections.has(sectionKey)) {
      state.collapsedLandingSections.delete(sectionKey);
    } else {
      state.collapsedLandingSections.add(sectionKey);
    }
    renderLandingSectionCollapses();
  }

  function renderLandingSectionCollapses() {
    syncLandingSectionCollapse(elements.createSessionPanelBody, elements.createSessionPanelToggle, "createSession");
    syncLandingSectionCollapse(elements.sessionListPanelBody, elements.sessionListPanelToggle, "reviewSessions");
    syncLandingSectionCollapse(elements.joinSessionPanelBody, elements.joinSessionPanelToggle, "joinSession");
    syncLandingSectionCollapse(elements.whatHappensPanelBody, elements.whatHappensPanelToggle, "whatHappens");
    syncLandingSectionCollapse(elements.activeSessionGalleryPanelBody, elements.activeSessionGalleryPanelToggle, "activeSessions");
  }

  function syncLandingSectionCollapse(bodyElement, toggleElement, sectionKey) {
    if (!bodyElement || !toggleElement) return;
    const collapsed = state.collapsedLandingSections.has(sectionKey);
    bodyElement.classList.toggle("hidden", collapsed);
    toggleElement.setAttribute("aria-expanded", String(!collapsed));
    const symbol = toggleElement.querySelector(".toggle-symbol");
    if (symbol) {
      symbol.textContent = collapsed ? "+" : "\u2212";
    }
  }

  function renderPanelCollapses() {
    syncPanelCollapse(elements.sessionPanel, elements.sessionPanelToggle, "session");
    syncPanelCollapse(elements.sessionPeriodPanel, elements.sessionPeriodPanelToggle, "sessionPeriod");
    syncPanelCollapse(elements.incidentCommandPanel, elements.incidentCommandPanelToggle, "incidentCommand");
    syncPanelCollapse(elements.participantsPanel, elements.participantsPanelToggle, "participants");
    syncPanelCollapse(elements.palettesPanel, elements.palettesPanelToggle, "palettes");
  }

  function syncPanelCollapse(panelElement, toggleElement, panelKey) {
    if (!panelElement || !toggleElement) return;
    const collapsed = state.collapsedPanels.has(panelKey);
    panelElement.classList.toggle("section-collapsed", collapsed);
    toggleElement.setAttribute("aria-expanded", String(!collapsed));
    const symbol = toggleElement.querySelector(".toggle-symbol");
    if (symbol) {
      symbol.textContent = collapsed ? "+" : "\u2212";
    }
  }

  function renderCommanderAuthPanels() {
    const signedIn = Boolean(state.commanderAuth?.accessToken);
    elements.commanderSignedInSummary.classList.toggle("hidden", !signedIn);
    elements.authFields.classList.toggle("hidden", signedIn);
    if (signedIn) {
      elements.commanderSummaryName.textContent = `Session Owner: ${state.commanderAuth?.displayName || "Signed in"}`;
      elements.commanderSummaryEmail.textContent = state.commanderAuth?.email || "";
    }
    elements.createSessionPanel.classList.toggle("hidden", false);
    elements.createSessionPanel.classList.toggle("locked", !signedIn);
    elements.createSessionLockedNote.classList.toggle("hidden", signedIn);
    elements.sessionListPanel.classList.toggle("hidden", !signedIn);
    elements.activeSessionGalleryPanel.classList.toggle("hidden", !signedIn);
    elements.commanderSignOutBtn.classList.toggle("hidden", !signedIn);
    elements.sessionSignOutBtn.classList.toggle("hidden", !signedIn || !state.activeSession);
    elements.leaveSessionBtn.classList.toggle("hidden", !state.activeSession);
    elements.setIncidentFocusBtn.classList.toggle("hidden", !state.activeSession || !isCommander() || Boolean(getIncidentFocusPoint()));
    elements.centerIncidentBtn.classList.toggle("hidden", !state.activeSession);
    elements.showViewerQrBtn.classList.toggle("hidden", !isCommander() || !state.activeSession || state.viewerMode);
    elements.joinLockedNote.classList.toggle("hidden", signedIn);
    toggleLandingCardAccess(signedIn);
  }

  function incidentFocusSignatureFor(point) {
    if (!point) return "";
    return `${roundCoord(point.lat)},${roundCoord(point.lng)}:${String(point.label || "")}`;
  }

  function getIncidentFocusPoint() {
    const hazardSource = Array.from(state.objects.values()).find((object) => (
      object?.objectType === "HazardSource"
      && object?.geometryType === "point"
      && Number.isFinite(Number(object?.geometry?.lat))
      && Number.isFinite(Number(object?.geometry?.lng))
    ));
    if (!hazardSource) return null;
    return {
      lat: Number(hazardSource.geometry.lat),
      lng: Number(hazardSource.geometry.lng),
      label: hazardSource.fields?.product || hazardSource.fields?.hazardType || "Hazard Source"
    };
  }

  function renderIncidentFocusUI() {
    const focusPoint = getIncidentFocusPoint();
    const focusSet = Boolean(focusPoint);
    if (elements.createSessionFocusBadge) {
      elements.createSessionFocusBadge.textContent = focusSet ? "Incident Focus Set" : "Set Initial Hazard / Focus";
      elements.createSessionFocusBadge.classList.toggle("set", focusSet);
      elements.createSessionFocusBadge.classList.toggle("pending", !focusSet);
    }
    if (elements.createSessionFocusPrompt) {
      elements.createSessionFocusPrompt.textContent = focusSet
        ? `Current focus: ${focusPoint.label}. New participants can center on the incident right away.`
        : "After launch, place a Hazard Source so everyone joins centered on the incident.";
    }
    if (elements.centerIncidentBtn) {
      elements.centerIncidentBtn.disabled = !focusSet && state.layers.size === 0;
      elements.centerIncidentBtn.textContent = focusSet ? "Center on Incident" : "Center Map";
    }
    if (elements.viewerCenterIncidentBtn) {
      elements.viewerCenterIncidentBtn.classList.toggle("hidden", !state.viewerMode || !state.activeSession);
      elements.viewerCenterIncidentBtn.disabled = !focusSet && state.layers.size === 0 && !state.currentLocation;
      elements.viewerCenterIncidentBtn.setAttribute("aria-label", focusSet ? "Center on incident" : "Center map");
      elements.viewerCenterIncidentBtn.title = focusSet ? "Center on Incident" : "Center Map";
    }
    if (elements.setIncidentFocusBtn) {
      elements.setIncidentFocusBtn.disabled = !canCreateObjects();
    }
    if (elements.sessionFocusPrompt) {
      const showPrompt = Boolean(state.activeSession) && isCommander() && !focusSet;
      elements.sessionFocusPrompt.classList.toggle("hidden", !showPrompt);
      elements.sessionFocusPrompt.textContent = showPrompt
        ? "Set initial hazard/focus location by placing a Hazard Source. This helps everyone join centered on the incident."
        : "";
    }
  }

  function toggleWeatherPanel() {
    if (!state.activeSession) return;
    state.weatherPanelOpen = !state.weatherPanelOpen;
    renderWeatherUI();
    if (state.weatherPanelOpen) {
      void refreshWeatherForCurrentTarget({ force: false, silent: true });
    }
  }

  function renderWeatherUI() {
    if (!elements.weatherLauncherBtn || !elements.weatherPanel) return;
    const visible = Boolean(state.activeSession);
    const target = getWeatherTarget();
    elements.weatherLauncherBtn.classList.toggle("hidden", !visible);
    elements.weatherPanel.classList.toggle("hidden", !visible || !state.weatherPanelOpen);
    elements.weatherLauncherBtn.setAttribute("aria-expanded", String(visible && state.weatherPanelOpen));
    elements.weatherLauncherBtn.title = state.weatherPanelOpen ? "Hide Incident Weather" : "Show Incident Weather";
    if (!visible) return;

    elements.weatherSourceLabel.textContent = target
      ? `${target.sourceLabel} · ${target.label}`
      : "Waiting for incident or device location…";
    elements.refreshWeatherBtn.disabled = state.weatherLoading || !target;

    if (state.weatherLoading) {
      elements.weatherSummary.textContent = "Loading weather…";
      elements.weatherMeta.textContent = "Pulling current conditions for the active incident area.";
      elements.weatherMetrics.innerHTML = "";
      return;
    }

    if (state.weatherError) {
      elements.weatherSummary.textContent = "Weather unavailable";
      elements.weatherMeta.textContent = state.weatherError;
      elements.weatherMetrics.innerHTML = "";
      return;
    }

    if (!state.weatherData) {
      elements.weatherSummary.textContent = "No weather loaded yet";
      elements.weatherMeta.textContent = "Open this panel after location is available to pull current conditions.";
      elements.weatherMetrics.innerHTML = "";
      return;
    }

    const { temperatureF, weatherLabel, humidity, windSpeedMph, windDirection, apparentTemperatureF, updatedAt, targetLabel, sourceLabel } = state.weatherData;
    elements.weatherSummary.textContent = `${formatTemperature(temperatureF)} · ${weatherLabel}`;
    elements.weatherMeta.textContent = `Tracking ${targetLabel} · Updated ${formatDateTime(updatedAt)}`;
    elements.weatherMetrics.innerHTML = [
      createWeatherMetricMarkup("Wind", `${directionToCardinal(windDirection)} ${formatWindDirection(windDirection)} @ ${formatWindSpeed(windSpeedMph)}`),
      createWeatherMetricMarkup("Humidity", formatPercent(humidity)),
      createWeatherMetricMarkup("Feels Like", formatTemperature(apparentTemperatureF)),
      createWeatherMetricMarkup("Source", sourceLabel)
    ].join("");
  }

  function createWeatherMetricMarkup(label, value) {
    return `
      <div class="weather-metric">
        <div class="weather-metric-label">${escapeHtml(label)}</div>
        <div class="weather-metric-value">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function getWeatherTarget() {
    const incidentFocus = getIncidentFocusPoint();
    if (incidentFocus) {
      return {
        lat: incidentFocus.lat,
        lng: incidentFocus.lng,
        label: incidentFocus.label,
        source: "incident_focus",
        sourceLabel: "Incident focus"
      };
    }
    if (state.currentLocation) {
      return {
        lat: state.currentLocation.lat,
        lng: state.currentLocation.lng,
        label: "Current location",
        source: "current_location",
        sourceLabel: "Current location"
      };
    }
    if (state.map) {
      const center = state.map.getCenter();
      if (center) {
        return {
          lat: Number(center.lat),
          lng: Number(center.lng),
          label: "Map center",
          source: "map_center",
          sourceLabel: "Map center"
        };
      }
    }
    return null;
  }

  function weatherTargetSignatureFor(target) {
    if (!target) return "";
    return `${target.source}:${roundCoord(target.lat)},${roundCoord(target.lng)}`;
  }

  async function refreshWeatherForCurrentTarget({ force = false, silent = false } = {}) {
    const target = getWeatherTarget();
    if (!target) {
      state.weatherData = null;
      state.weatherError = "No incident location is available yet.";
      renderWeatherUI();
      return false;
    }

    const nextSignature = weatherTargetSignatureFor(target);
    const lastWeatherTime = state.weatherData?.updatedAt ? Date.parse(state.weatherData.updatedAt) : NaN;
    const isFresh = state.weatherData && state.weatherTargetSignature === nextSignature && Number.isFinite(lastWeatherTime) && (Date.now() - lastWeatherTime) < WEATHER_REFRESH_MS;
    if (!force && isFresh) {
      renderWeatherUI();
      return true;
    }

    const currentFetchNonce = ++state.weatherFetchNonce;
    state.weatherLoading = true;
    state.weatherError = "";
    renderWeatherUI();

    try {
      const response = await fetch(buildWeatherUrl(target), { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Weather request failed (${response.status})`);
      }
      const payload = await response.json();
      const current = payload?.current;
      if (!current) {
        throw new Error("Weather service returned no current conditions.");
      }
      if (currentFetchNonce !== state.weatherFetchNonce) return false;
      state.weatherTargetSignature = nextSignature;
      state.weatherData = {
        targetLabel: target.label,
        sourceLabel: target.sourceLabel,
        temperatureF: Number(current.temperature_2m),
        apparentTemperatureF: Number(current.apparent_temperature),
        humidity: Number(current.relative_humidity_2m),
        windSpeedMph: Number(current.wind_speed_10m),
        windDirection: Number(current.wind_direction_10m),
        weatherCode: Number(current.weather_code),
        weatherLabel: weatherCodeToLabel(Number(current.weather_code)),
        updatedAt: current.time || new Date().toISOString()
      };
      state.weatherError = "";
      if (!silent && state.weatherPanelOpen) {
        setStatus(`Updated weather for ${target.sourceLabel.toLowerCase()}.`);
      }
      return true;
    } catch (error) {
      if (currentFetchNonce !== state.weatherFetchNonce) return false;
      state.weatherData = null;
      state.weatherError = formatError(error);
      if (!silent && state.weatherPanelOpen) {
        setStatus(`Weather unavailable. ${formatError(error)}`);
      }
      return false;
    } finally {
      if (currentFetchNonce === state.weatherFetchNonce) {
        state.weatherLoading = false;
        renderWeatherUI();
      }
    }
  }

  function buildWeatherUrl(target) {
    const url = new URL(WEATHER_API_BASE_URL);
    url.searchParams.set("latitude", String(target.lat));
    url.searchParams.set("longitude", String(target.lng));
    url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("precipitation_unit", "inch");
    url.searchParams.set("timezone", "auto");
    return url.toString();
  }

  function onMapMoveEnd() {
    if (!state.activeSession || !state.weatherPanelOpen) return;
    const target = getWeatherTarget();
    if (target?.source === "map_center") {
      void refreshWeatherForCurrentTarget({ force: false, silent: true });
    }
  }

  function startWeatherPolling() {
    clearWeatherPolling();
    state.weatherTimer = window.setInterval(() => {
      if (!state.activeSession) return;
      void refreshWeatherForCurrentTarget({ force: true, silent: true });
    }, WEATHER_REFRESH_MS);
  }

  function clearWeatherPolling() {
    if (state.weatherTimer) {
      clearInterval(state.weatherTimer);
      state.weatherTimer = null;
    }
  }

  function onCenterIncidentAction() {
    centerOnIncidentFocus({ notify: true, fallbackToBounds: true, fallbackToCurrent: true });
  }

  function onSetIncidentFocusAction() {
    if (!canCreateObjects()) {
      setStatus("Only active editors can set the initial incident focus.");
      return;
    }
    beginTemplatePlacement("HazardSource");
    setStatus("Set Initial Focus selected. Tap the map to place the Hazard Source.");
  }

  function syncIncidentFocusState(options = {}) {
    const { notify = false } = options;
    const nextSignature = incidentFocusSignatureFor(getIncidentFocusPoint());
    const previousSignature = state.incidentFocusSignature || "";
    state.incidentFocusSignature = nextSignature;
    if (previousSignature !== nextSignature && state.activeSession) {
      void refreshWeatherForCurrentTarget({ force: true, silent: true });
    }
    if (!notify || !state.activeSession || !previousSignature || previousSignature === nextSignature) {
      return;
    }
    setStatus("Incident focus updated. Use Center on Incident to jump there.");
  }

  function renderMapStyleTray() {
    if (!elements.mapStyleTray || !elements.mapStyleLauncherBtn || !elements.mapStyleTrayGrid) return;
    elements.mapStyleTray.classList.toggle("hidden", !state.mapStyleTrayOpen);
    elements.mapStyleLauncherBtn.setAttribute("aria-expanded", String(state.mapStyleTrayOpen));
    elements.mapStyleTrayGrid.innerHTML = "";
    MAP_STYLE_OPTIONS.forEach((styleOption) => {
      const card = document.createElement("button");
      card.className = `map-style-card ${state.activeBaseLayerKey === styleOption.key ? "active" : ""}`;
      card.type = "button";
      card.dataset.style = styleOption.key;
      card.innerHTML = `
        <span class="map-style-card-preview" aria-hidden="true"></span>
        <span class="map-style-card-chip" style="background:${escapeAttribute(styleOption.color)}">${escapeHtml(styleOption.chip)}</span>
        <span class="map-style-card-label">${escapeHtml(styleOption.label)}</span>
        <span class="map-style-card-kind">${escapeHtml(styleOption.description)}</span>
      `;
      card.addEventListener("click", () => {
        setBaseLayer(styleOption.key);
        closeMapStyleTray();
      });
      elements.mapStyleTrayGrid.appendChild(card);
    });
  }

  function toggleRightSidebar() {
    state.rightSidebarCollapsed = !state.rightSidebarCollapsed;
    renderRightSidebarState();
    scheduleMapResizeRefresh();
  }

  function toggleMapStyleTray() {
    state.mapStyleTrayOpen = !state.mapStyleTrayOpen;
    renderMapStyleTray();
  }

  function closeMapStyleTray() {
    state.mapStyleTrayOpen = false;
    renderMapStyleTray();
  }

  function renderRightSidebarState() {
    elements.appView.classList.toggle("right-sidebar-collapsed", state.rightSidebarCollapsed);
    elements.rightSidebarCollapseBtn.setAttribute("aria-expanded", String(!state.rightSidebarCollapsed));
    elements.rightSidebarCollapseBtn.setAttribute("aria-label", state.rightSidebarCollapsed ? "Expand right panel" : "Collapse right panel");
  }

  function toggleLandingCardAccess(signedIn) {
    const createControls = [
      elements.incidentNameInput,
      elements.commanderRoleSelect,
      elements.opStartInput,
      elements.opEndInput,
      elements.guidedSetupDefaultInput,
      elements.createSessionBtn
    ];
    const joinControls = [
      elements.joinCodeInput,
      elements.joinDisplayNameInput,
      elements.joinPermissionSelect,
      elements.joinRoleSelect,
      elements.joinSessionBtn
    ];
    createControls.forEach((element) => {
      if (element) element.disabled = !signedIn;
    });
    joinControls.forEach((element) => {
      if (element) element.disabled = !signedIn;
    });
  }

  function renderCommanderSessions(sessions) {
    elements.commanderSessionList.innerHTML = "";
    if (!sessions.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No collaborative sessions yet.";
      elements.commanderSessionList.appendChild(empty);
      return;
    }
    sessions.forEach((session) => {
      const card = document.createElement("div");
      card.className = "session-card";
      const title = document.createElement("strong");
      title.textContent = session.incidentName;
      const meta = document.createElement("div");
      meta.className = "muted";
      meta.textContent = `${session.status.toUpperCase()} · ${formatDateTime(session.operationalPeriodStart)} to ${formatDateTime(session.operationalPeriodEnd)}`;
      const row = document.createElement("div");
      row.className = "row";
      const openBtn = document.createElement("button");
      openBtn.className = "secondary";
      openBtn.type = "button";
      openBtn.textContent = "Open";
      openBtn.addEventListener("click", async () => {
        try {
          const snapshot = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(session.id)}/snapshot`, {
            actorType: "commander"
          });
          state.actor = snapshot.actor;
          state.qrPayload = JSON.stringify({ type: "ics_collab_join", joinCode: session.joinCode });
          await openSession(snapshot.session, snapshot.actor, "commander", snapshot.snapshot);
          setStatus(`Opened ${session.incidentName}.`);
        } catch (error) {
          setStatus(formatError(error));
        }
      });
      const copyBtn = document.createElement("button");
      copyBtn.className = "secondary";
      copyBtn.type = "button";
      copyBtn.textContent = "Copy Join";
      copyBtn.addEventListener("click", async () => {
        try {
          await writeToClipboard(session.joinUrl || session.joinCode);
          setStatus("Join link copied.");
        } catch (error) {
          setStatus("Copy failed.");
        }
      });
      row.append(openBtn, copyBtn);
      card.append(title, meta, row);
      elements.commanderSessionList.appendChild(card);
    });
  }

  function renderActiveSessionGallery(sessions) {
    elements.activeSessionGallery.innerHTML = "";
    if (!sessions.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No live incidents right now.";
      elements.activeSessionGallery.appendChild(empty);
      return;
    }
    sessions.forEach((session) => {
      const card = document.createElement("div");
      card.className = "session-card";
      const title = document.createElement("strong");
      title.textContent = session.incidentName;
      const meta = document.createElement("div");
      meta.className = "muted";
      meta.textContent = `Owner: ${session.ownerName} · ${formatDateTime(session.operationalPeriodStart)} to ${formatDateTime(session.operationalPeriodEnd)}`;
      const role = document.createElement("div");
      role.className = "muted";
      role.textContent = `Incident Commander: ${session.commanderName}`;
      const row = document.createElement("div");
      row.className = "row";
      if (session.isOwner) {
        const openBtn = document.createElement("button");
        openBtn.className = "secondary";
        openBtn.type = "button";
        openBtn.textContent = "Open Session";
        openBtn.addEventListener("click", async () => {
          try {
            const snapshot = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(session.id)}/snapshot`, {
              actorType: "commander"
            });
            state.actor = snapshot.actor;
            state.qrPayload = JSON.stringify({ type: "ics_collab_join", joinCode: session.joinCode });
            await openSession(snapshot.session, snapshot.actor, "commander", snapshot.snapshot);
            setStatus(`Opened ${session.incidentName}.`);
          } catch (error) {
            setStatus(formatError(error));
          }
        });
        row.append(openBtn);
      } else {
        const useCodeBtn = document.createElement("button");
        useCodeBtn.className = "secondary";
        useCodeBtn.type = "button";
        useCodeBtn.textContent = "Use Code";
        useCodeBtn.addEventListener("click", () => {
          elements.joinCodeInput.value = session.joinCode;
          elements.joinCodeInput.focus();
          setStatus(`Loaded join code for ${session.incidentName}.`);
        });
        row.append(useCodeBtn);
      }
      card.append(title, meta, role, row);
      elements.activeSessionGallery.appendChild(card);
    });
  }

  function renderSessionMeta() {
    elements.sessionMeta.innerHTML = "";
    if (!state.activeSession) {
      appendMetaRow(elements.sessionMeta, "Status", "No active session");
      elements.sessionPeriodPanel.classList.add("hidden");
      elements.incidentCommandPanel.classList.add("hidden");
      elements.setIncidentFocusBtn.classList.add("hidden");
      elements.copyJoinLinkBtn.classList.add("hidden");
      elements.endSessionBtn.classList.add("hidden");
      elements.centerIncidentBtn.classList.add("hidden");
      return;
    }
    const session = state.activeSession;
    const visibleStatus = effectiveSessionStatus(session);
    const ownerParticipant = state.participants.find((participant) => participant.permissionTier === "commander");
    appendMetaRow(elements.sessionMeta, "Incident", session.incidentName);
    appendMetaRow(elements.sessionMeta, "Session Owner", ownerParticipant ? ownerParticipant.displayName : "Owner");
    appendMetaRow(elements.sessionMeta, "Incident Commander", `${session.commanderName} · ${session.commanderICSRole}`);
    appendMetaRow(elements.sessionMeta, "Status", visibleStatus);
    appendMetaRow(elements.sessionMeta, "Incident Focus", getIncidentFocusPoint() ? "Set" : "Not set");
    appendMetaRow(elements.sessionMeta, "Join Code", session.joinCode);
    appendMetaRow(elements.sessionMeta, "Period", `${formatDateTime(session.operationalPeriodStart)} → ${formatDateTime(session.operationalPeriodEnd)}`);
    elements.copyJoinLinkBtn.classList.toggle("hidden", !session.joinCode);
    elements.endSessionBtn.classList.toggle("hidden", !isCommander());
    elements.sessionPeriodPanel.classList.toggle("hidden", !isCommander());
    elements.incidentCommandPanel.classList.toggle("hidden", !isCommander());
    elements.sessionOpStartInput.value = isoToInputValue(session.operationalPeriodStart);
    elements.sessionOpEndInput.value = isoToInputValue(session.operationalPeriodEnd);
    elements.sessionIncidentCommanderNameInput.value = session.commanderName || "";
  }

  function renderParticipants() {
    elements.participantList.innerHTML = "";
    if (!state.participants.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No participants yet.";
      elements.participantList.appendChild(empty);
      return;
    }
    state.participants.forEach((participant) => {
      const card = document.createElement("div");
      card.className = "participant-card";
      card.innerHTML = `
        <strong>${escapeHtml(participant.displayName)}</strong>
        <div class="muted">${escapeHtml(formatPermissionTier(participant.permissionTier))} · ${escapeHtml(participant.icsRole)}</div>
        <div class="muted">Joined ${escapeHtml(formatDateTime(participant.joinedAt))}</div>
        <div class="muted">Last seen ${escapeHtml(formatDateTime(participant.lastSeenAt))}</div>
      `;
      elements.participantList.appendChild(card);
    });
  }

  function renderPalettes() {
    elements.paletteContainer.innerHTML = "";
    const groups = buildPaletteGroups();
    groups.forEach(({ category, items, emptyMessage }) => {
      const group = document.createElement("div");
      group.className = "palette-group";
      const isCollapsed = state.collapsedPaletteCategories.has(category);
      const header = document.createElement("button");
      header.className = "palette-group-toggle";
      header.type = "button";
      header.setAttribute("aria-expanded", String(!isCollapsed));
      header.innerHTML = `
        <span>${escapeHtml(category)}</span>
        <span class="toggle-symbol">${isCollapsed ? "+" : "\u2212"}</span>
      `;
      header.addEventListener("click", () => togglePaletteCategory(category));
      const grid = document.createElement("div");
      grid.className = `template-grid ${isCollapsed ? "hidden" : ""}`;
      if (!items.length && emptyMessage) {
        const empty = document.createElement("div");
        empty.className = "palette-empty muted";
        empty.textContent = emptyMessage;
        grid.appendChild(empty);
      }
      items.forEach((item) => {
        const button = document.createElement("button");
        const selectionKey = item.selectionKey || item.objectType;
        button.className = `object-template ${item.kind === "icon" ? "icon-template" : ""} ${state.selectedTemplateType === selectionKey ? "active" : ""}`;
        button.type = "button";
        button.disabled = !canCreateObjects();
        button.draggable = canCreateObjects() && item.geometryType === "point";
        button.innerHTML = item.kind === "icon"
          ? `
            <span class="object-template-icon-wrap">
              <img
                class="object-template-icon"
                src="${escapeAttribute(resolveAssetPath(item.assetPath))}"
                alt="${escapeAttribute(item.label)}"
                style="width:${escapeAttribute(String(item.paletteSize || 30))}px;height:${escapeAttribute(String(item.paletteSize || 30))}px"
              />
            </span>
            <span>
              <strong>${escapeHtml(item.label)}</strong>
              <div class="muted">${escapeHtml(item.category)}</div>
            </span>
          `
          : `
            <span>
              <strong>${escapeHtml(item.label)}</strong>
              <div class="muted">${escapeHtml(item.geometryType)}</div>
            </span>
            <span class="map-badge">${escapeHtml(item.objectType.replace(/[a-z]/g, "").slice(0, 3) || item.geometryType[0].toUpperCase())}</span>
          `;
        button.addEventListener("click", () => {
          if (item.kind === "icon") {
            selectIconTemplate(item);
          } else {
            selectTemplate(item.objectType);
          }
        });
        if (item.geometryType === "point") {
          button.addEventListener("dragstart", (event) => onTemplateDragStart(event, selectionKey, button));
          button.addEventListener("dragend", () => onTemplateDragEnd(button));
        }
        grid.appendChild(button);
      });
      group.append(header, grid);
      elements.paletteContainer.appendChild(group);
    });
  }

  function togglePaletteCategory(category) {
    if (state.collapsedPaletteCategories.has(category)) {
      state.collapsedPaletteCategories.delete(category);
    } else {
      state.collapsedPaletteCategories.add(category);
    }
    renderPalettes();
  }

  function togglePanel(panelKey) {
    if (state.collapsedPanels.has(panelKey)) {
      state.collapsedPanels.delete(panelKey);
    } else {
      state.collapsedPanels.add(panelKey);
    }
    renderPanelCollapses();
  }

  function renderGuidedSteps() {
    elements.guidedSteps.innerHTML = "";
    GUIDED_STEPS.forEach((step) => {
      const completed = step.objectTypes.some((type) => Array.from(state.objects.values()).some((object) => object.objectType === type && !object.isDeleted));
      const card = document.createElement("div");
      card.className = "guided-step";
      const selectTemplateType = step.objectTypes.find((type) => templateByType[type]) || step.objectTypes[0];
      const btn = document.createElement("button");
      btn.className = completed ? "secondary" : "primary";
      btn.type = "button";
      btn.textContent = completed ? "Placed" : "Place";
      btn.disabled = completed || !canCreateObjects();
      btn.addEventListener("click", () => {
        toggleGuidedMode(true);
        selectTemplate(selectTemplateType);
      });
      card.innerHTML = `<strong>${escapeHtml(step.label)}</strong><div class="muted">${completed ? "Completed" : "Pending"}</div>`;
      card.appendChild(btn);
      if (!state.guidedMode && !completed) {
        card.classList.add("hidden");
      }
      elements.guidedSteps.appendChild(card);
    });
  }

  function renderSelectedObject() {
    const object = state.selectedObjectId ? state.objects.get(state.selectedObjectId) : null;
    if (!object) {
      elements.selectedObjectEmpty.classList.remove("hidden");
      elements.selectedObjectPanel.classList.add("hidden");
      return;
    }
    elements.selectedObjectEmpty.classList.add("hidden");
    elements.selectedObjectPanel.classList.remove("hidden");
    elements.selectedObjectMeta.innerHTML = "";
    const template = resolveTemplateForObject(object);
    const author = state.participants.find((participant) => participant.id === object.createdByParticipantId);
    appendMetaRow(elements.selectedObjectMeta, "Type", template?.label || object.objectType);
    appendMetaRow(elements.selectedObjectMeta, "Geometry", object.geometryType);
    if (object.objectType === ICON_MARKER_OBJECT_TYPE) {
      appendMetaRow(elements.selectedObjectMeta, "Category", object.fields?.iconCategory || "Legacy Icons");
    }
    appendMetaRow(elements.selectedObjectMeta, "Author", author ? `${author.displayName} · ${author.icsRole}` : object.createdByParticipantId);
    appendMetaRow(elements.selectedObjectMeta, "Created", formatDateTime(object.createdAt));
    appendMetaRow(elements.selectedObjectMeta, "Updated", formatDateTime(object.updatedAt));
    appendMetaRow(elements.selectedObjectMeta, "Version", String(object.version));
    if (object.activeLockParticipantId && object.activeLockParticipantId !== state.actor?.id) {
      appendMetaRow(elements.selectedObjectMeta, "Lock", "Editing by another participant");
    }

    elements.selectedObjectFields.innerHTML = "";
    const fields = collectFieldEntries(object);
    if (!fields.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No extra fields for this object.";
      elements.selectedObjectFields.appendChild(empty);
    } else {
      fields.forEach(([key, value]) => {
        const label = document.createElement("label");
        label.textContent = key;
        const input = document.createElement("input");
        input.type = "text";
        input.value = value ?? "";
        input.dataset.fieldKey = key;
        input.disabled = !canEditObject(object);
        label.appendChild(input);
        elements.selectedObjectFields.appendChild(label);
      });
    }

    const editable = canEditObject(object);
    elements.saveFieldsBtn.textContent = "Save Details";
    elements.saveFieldsBtn.disabled = !editable;
    const canUseGeometryButton = editable && object.geometryType !== "point";
    elements.editGeometryBtn.disabled = !canUseGeometryButton;
    elements.editGeometryBtn.classList.toggle("hidden", object.geometryType === "point");
    elements.deleteObjectBtn.disabled = !editable;
    elements.selectedObjectActions.classList.toggle("hidden", state.viewerMode || !editable);
  }

  function selectTemplate(objectType) {
    beginTemplatePlacement(objectType);
  }

  function selectIconTemplate(iconDefinition) {
    beginIconPlacement(iconDefinition);
  }

  function beginTemplatePlacement(objectType, initialPoint = null) {
    const template = templateByType[objectType];
    if (!template) return;
    state.selectedTemplateType = objectType;
    state.selectedObjectId = null;
    renderPalettes();
    renderSelectedObject();
    if (template.geometryType === "point" && initialPoint) {
      createObject(template, { lat: initialPoint.lat, lng: initialPoint.lng });
      state.drawState = null;
      updateDrawControls();
      return;
    }
    if (template.geometryType === "point") {
      state.drawState = { mode: "create", template, points: [] };
      setStatus(`Selected ${template.label}. Click the map to place it.`);
    } else {
      state.drawState = { mode: "create", template, points: initialPoint ? [initialPoint] : [] };
      setStatus(initialPoint
        ? `Dropped ${template.label}. Add more points, then finish.`
        : `Selected ${template.label}. Draw directly on the map to add ${template.geometryType} points, then finish.`);
    }
    redrawPreviewLayer();
    updateDrawControls();
  }

  function beginIconPlacement(iconDefinition, initialPoint = null) {
    if (!iconDefinition) return;
    const template = createIconTemplate(iconDefinition);
    state.selectedTemplateType = iconDefinition.selectionKey;
    state.selectedObjectId = null;
    renderPalettes();
    renderSelectedObject();
    if (initialPoint) {
      createObject(template, { lat: initialPoint.lat, lng: initialPoint.lng });
      state.drawState = null;
      updateDrawControls();
      return;
    }
    state.drawState = { mode: "create", template, points: [] };
    setStatus(`Selected ${template.label}. Click the map to place it.`);
    redrawPreviewLayer();
    updateDrawControls();
  }

  function onTemplateDragStart(event, objectType, button) {
    if (!canCreateObjects()) return;
    state.dragTemplateType = objectType;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/plain", objectType);
    }
    button.classList.add("dragging");
    document.querySelector(".map-stage")?.classList.add("drag-active");
  }

  function onTemplateDragEnd(button) {
    state.dragTemplateType = null;
    button.classList.remove("dragging");
    document.querySelector(".map-stage")?.classList.remove("drag-active");
  }

  function onMapDragOver(event) {
    if (!state.dragTemplateType || !canCreateObjects()) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    document.querySelector(".map-stage")?.classList.add("drag-active");
  }

  function onMapDragLeave(event) {
    const stage = document.querySelector(".map-stage");
    if (!stage) return;
    if (event.currentTarget === event.target) {
      stage.classList.remove("drag-active");
    }
  }

  function onMapDrop(event) {
    if (!state.dragTemplateType || !state.map) return;
    event.preventDefault();
    document.querySelector(".map-stage")?.classList.remove("drag-active");
    const rect = state.map.getContainer().getBoundingClientRect();
    const containerPoint = L.point(event.clientX - rect.left, event.clientY - rect.top);
    const latLng = state.map.containerPointToLatLng(containerPoint);
    const iconDefinition = findIconBySelectionKey(state.dragTemplateType);
    if (iconDefinition) {
      beginIconPlacement(iconDefinition, {
        lat: roundCoord(latLng.lat),
        lng: roundCoord(latLng.lng)
      });
    } else {
      beginTemplatePlacement(state.dragTemplateType, {
        lat: roundCoord(latLng.lat),
        lng: roundCoord(latLng.lng)
      });
    }
    state.dragTemplateType = null;
  }

  async function onMapClick(event) {
    if (!state.drawState) return;
    if (!canCreateObjects() && state.drawState.mode === "create") {
      setStatus("This session is read-only or you do not have edit access.");
      return;
    }
    if (state.drawState.mode === "edit" && state.drawState.template.geometryType !== "point") {
      return;
    }
    const point = { lat: roundCoord(event.latlng.lat), lng: roundCoord(event.latlng.lng) };
    if (state.drawState.template.geometryType === "point") {
      try {
        if (state.drawState.mode === "edit" && state.drawState.objectId) {
          await queueGeometryUpdate(state.drawState.objectId, { lat: point.lat, lng: point.lng }, true);
          closeSelectedObjectEditor();
          setStatus("Object moved and saved.");
        } else {
          await createObject(state.drawState.template, { lat: point.lat, lng: point.lng });
        }
      } catch (error) {
        setStatus(formatError(error));
      }
      cancelGeometryDraw();
      return;
    }
    state.drawState.points.push(point);
    redrawPreviewLayer();
    updateDrawControls();
  }

  function updateDrawControls() {
    const active = Boolean(state.drawState);
    elements.drawControls.classList.toggle("hidden", !active);
    if (!active) return;
    const { template, mode, points = [] } = state.drawState;
    const minPoints = template.geometryType === "line" ? 2 : (template.geometryType === "polygon" ? 3 : 1);
    elements.finishGeometryBtn.textContent = mode === "edit" ? "Save Shape" : "Finish";
    elements.drawHintText.textContent = mode === "edit"
      ? template.geometryType === "point"
        ? `Move ${template.label} by selecting a new point on the map.`
        : `Drag the corner handles to reshape ${template.label}, then finish to save.`
      : `${template.label}: add ${template.geometryType === "line" ? "line" : template.geometryType === "polygon" ? "polygon" : "point"} geometry.`;
    elements.finishGeometryBtn.disabled = points.length < minPoints;
  }

  function redrawPreviewLayer() {
    redrawPreviewGeometryOnly();
    renderGeometryEditHandles();
  }

  function redrawPreviewGeometryOnly() {
    if (state.previewLayer) {
      state.map.removeLayer(state.previewLayer);
      state.previewLayer = null;
    }
    if (!state.drawState || !state.drawState.points.length) return;
    const latLngs = state.drawState.points.map((point) => [point.lat, point.lng]);
    const color = state.drawState.template.color || "#f3c613";
    if (state.drawState.template.geometryType === "line") {
      state.previewLayer = L.polyline(latLngs, { color, weight: 3, dashArray: "8 6" }).addTo(state.map);
    } else if (state.drawState.template.geometryType === "polygon") {
      state.previewLayer = L.polygon(latLngs, { color, weight: 2, fillColor: color, fillOpacity: 0.18, dashArray: "8 6" }).addTo(state.map);
    } else {
      state.previewLayer = L.circleMarker(latLngs[0], { radius: 8, color, fillColor: color, fillOpacity: 0.75 }).addTo(state.map);
    }
  }

  async function finishGeometryDraw() {
    if (!state.drawState) return;
    const { template, points, mode, objectId } = state.drawState;
    if (template.geometryType === "line" && points.length < 2) return;
    if (template.geometryType === "polygon" && points.length < 3) return;
    try {
      if (mode === "edit" && objectId) {
        await queueGeometryUpdate(objectId, { points: points.slice() }, true);
        closeSelectedObjectEditor();
        setStatus("Geometry updated.");
      } else {
        await createObject(template, { points: points.slice() });
      }
    } catch (error) {
      setStatus(formatError(error));
      return;
    }
    cancelGeometryDraw();
  }

  function cancelGeometryDraw() {
    const lockObjectId = state.drawState?.mode === "edit" ? state.drawState.objectId : null;
    state.drawState = null;
    if (state.previewLayer) {
      state.map.removeLayer(state.previewLayer);
      state.previewLayer = null;
    }
    clearGeometryEditHandles();
    updateDrawControls();
    if (lockObjectId) {
      releaseObjectLock(lockObjectId).catch(() => {});
    }
  }

  async function createObject(template, geometry) {
    const objectId = createLocalID();
    const result = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/mutations`, {
      method: "POST",
      actorType: currentActorType(),
      body: {
        mutations: [{
          clientMutationId: createLocalID(),
          objectId,
          mutationType: "create",
          objectType: template.objectType,
          geometryType: template.geometryType,
          geometry,
          fields: buildInitialFields(template)
        }]
      }
    });
    applyMutationResponse(result);
    setStatus(`${template.label} placed.`);
  }

  function queueGeometryUpdate(objectId, geometry, flushNow) {
    const object = state.objects.get(objectId);
    if (!object) return Promise.resolve();
    return queueUpdateMutation({
      objectId,
      mutationType: "update",
      geometryType: object.geometryType,
      geometry,
      fields: object.fields,
      baseVersion: object.version
    }, flushNow);
  }

  function queueUpdateMutation(mutation, flushNow = false) {
    state.pendingMutations.set(mutation.objectId, {
      clientMutationId: createLocalID(),
      ...mutation
    });
    scheduleFlush();
    if (flushNow) {
      return flushPendingMutations();
    }
    return Promise.resolve();
  }

  function scheduleFlush() {
    if (state.flushTimer) return;
    state.flushTimer = window.setTimeout(() => {
      flushPendingMutations();
    }, UPDATE_FLUSH_MS);
  }

  async function flushPendingMutations() {
    if (state.flushTimer) {
      clearTimeout(state.flushTimer);
      state.flushTimer = null;
    }
    const mutations = Array.from(state.pendingMutations.values());
    if (!mutations.length || !state.activeSession) return;
    state.pendingMutations.clear();
    try {
      const result = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/mutations`, {
        method: "POST",
        actorType: currentActorType(),
        body: { mutations }
      });
      applyMutationResponse(result);
      setStatus("Map changes synced.");
    } catch (error) {
      mutations.forEach((mutation) => state.pendingMutations.set(mutation.objectId, mutation));
      scheduleFlush();
      setStatus(formatError(error));
    }
  }

  function applyMutationResponse(response) {
    if (response.session) {
      state.activeSession = response.session;
      state.lastVersion = Number(response.session.currentVersion || state.lastVersion);
    }
    (response.applied || []).forEach((entry) => {
      if (entry.object?.isDeleted || entry.mutationType === "delete") {
        state.objects.delete(entry.object.id);
      } else if (entry.object) {
        state.objects.set(entry.object.id, entry.object);
      }
      if (entry.version) {
        state.lastVersion = Math.max(state.lastVersion, Number(entry.version));
      }
    });
    syncMapObjects();
    syncIncidentFocusState({ notify: true });
    renderAll();
  }

  function syncMapObjects() {
    const activeIds = new Set();
    state.objects.forEach((object) => {
      activeIds.add(object.id);
      renderObjectLayer(object);
    });
    Array.from(state.layers.keys()).forEach((id) => {
      if (!activeIds.has(id)) {
        state.objectLayerGroup.removeLayer(state.layers.get(id));
        state.layers.delete(id);
      }
    });
  }

  function renderObjectLayer(object) {
    const existing = state.layers.get(object.id);
    if (existing) {
      state.objectLayerGroup.removeLayer(existing);
      state.layers.delete(object.id);
    }
    const template = resolveTemplateForObject(object);
    const color = template?.color || "#f3c613";
    let layer = null;
    if (object.geometryType === "point") {
      const icon = object.objectType === ICON_MARKER_OBJECT_TYPE && object.fields?.iconAssetPath
        ? buildIconMarkerIcon(object, template)
        : L.divIcon({
          className: "",
          html: `<div class="point-marker" style="background:${escapeAttribute(color)}"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });
      layer = L.marker([object.geometry.lat, object.geometry.lng], {
        icon,
        draggable: canEditObject(object) && sessionIsActive()
      });
      if (canEditObject(object) && sessionIsActive()) {
        layer.on("dragstart", async () => {
          if (!sessionIsActive()) {
            setStatus("This session is now read-only.");
            syncMapObjects();
            return;
          }
          try {
            await acquireObjectLock(object, { syncUI: false });
          } catch (error) {
            setStatus(formatError(error));
          }
        });
        layer.on("dragend", async (event) => {
          if (!sessionIsActive()) {
            syncMapObjects();
            setStatus("This session is now read-only.");
            return;
          }
          const latlng = event.target.getLatLng();
          const previousGeometry = { ...object.geometry };
          const nextGeometry = { lat: roundCoord(latlng.lat), lng: roundCoord(latlng.lng) };
          try {
            state.objects.set(object.id, {
              ...object,
              geometry: nextGeometry
            });
            syncMapObjects();
            renderSelectedObject();
            await queueUpdateMutation({
              objectId: object.id,
              mutationType: "update",
              geometryType: "point",
              geometry: nextGeometry,
              fields: object.fields,
              baseVersion: object.version
            }, true);
            closeSelectedObjectEditor();
            setStatus("Object moved and saved.");
          } catch (error) {
            state.objects.set(object.id, {
              ...object,
              geometry: previousGeometry
            });
            setStatus(formatError(error));
            syncMapObjects();
          } finally {
            try {
              await releaseObjectLock(object.id);
            } catch (error) {
              setStatus(formatError(error));
            }
          }
        });
      }
    } else if (object.geometryType === "line") {
      layer = L.polyline(toLeafletLatLngs(object.geometry.points), { color, weight: 4, opacity: 0.9 });
    } else {
      layer = L.polygon(toLeafletLatLngs(object.geometry.points), { color, weight: 2, fillColor: color, fillOpacity: 0.18 });
    }
    layer.on("click", () => {
      state.selectedObjectId = object.id;
      renderSelectedObject();
    });
    const tooltip = buildObjectTooltip(object);
    if (tooltip) layer.bindTooltip(tooltip);
    layer.addTo(state.objectLayerGroup);
    state.layers.set(object.id, layer);
  }

  function fitMapIfNeeded() {
    const layers = Array.from(state.layers.values());
    if (!layers.length) return false;
    const featureGroup = L.featureGroup(layers);
    try {
      state.map.fitBounds(featureGroup.getBounds().pad(0.2), { maxZoom: 16 });
      return true;
    } catch (_error) {
      // Ignore empty bounds.
      return false;
    }
  }

  function centerOnIncidentFocus({ notify = true, fallbackToBounds = false, fallbackToCurrent = false } = {}) {
    if (!state.map) return false;
    const focusPoint = getIncidentFocusPoint();
    if (focusPoint) {
      state.map.setView([focusPoint.lat, focusPoint.lng], 16);
      scheduleMapResizeRefresh();
      if (notify) {
        setStatus(`Centered on incident focus: ${focusPoint.label}.`);
      }
      return true;
    }
    if (fallbackToBounds && fitMapIfNeeded()) {
      if (notify) {
        setStatus("Centered on the mapped incident area.");
      }
      return true;
    }
    if (fallbackToCurrent && state.currentLocation) {
      state.map.setView([state.currentLocation.lat, state.currentLocation.lng], 16);
      scheduleMapResizeRefresh();
      if (notify) {
        setStatus("Centered on your current location.");
      }
      return true;
    }
    if (notify) {
      setStatus("No incident focus is set yet.");
    }
    return false;
  }

  async function saveSelectedObjectFields() {
    const object = state.selectedObjectId ? state.objects.get(state.selectedObjectId) : null;
    if (!object || !canEditObject(object)) {
      setStatus("You cannot edit this object.");
      return;
    }
    if (!sessionIsActive()) {
      setStatus("This session is now read-only.");
      return;
    }
    const inputs = elements.selectedObjectFields.querySelectorAll("[data-field-key]");
    const nextFields = { ...(object.fields || {}) };
    inputs.forEach((input) => {
      nextFields[input.dataset.fieldKey] = input.value;
    });
    await queueUpdateMutation({
      objectId: object.id,
      mutationType: "update",
      geometryType: object.geometryType,
      geometry: object.geometry,
      fields: nextFields,
      baseVersion: object.version
    }, true);
    setStatus("Changes saved.");
  }

  async function startGeometryEdit() {
    const object = state.selectedObjectId ? state.objects.get(state.selectedObjectId) : null;
    if (!object || !canEditObject(object)) {
      setStatus("You cannot edit this geometry.");
      return;
    }
    if (!sessionIsActive()) {
      setStatus("This session is now read-only.");
      return;
    }
    try {
      await acquireObjectLock(object);
      state.selectedTemplateType = object.objectType;
      state.drawState = {
        mode: "edit",
        objectId: object.id,
        template: templateByType[object.objectType] || {
          objectType: object.objectType,
          label: object.objectType,
          geometryType: object.geometryType,
          color: "#f3c613",
          defaults: {}
        },
        points: object.geometryType === "point"
          ? []
          : (object.geometry.points || []).map((point) => ({
            lat: roundCoord(point.lat),
            lng: roundCoord(point.lng)
          }))
      };
      cancelGeometryPreviewOnly();
      redrawPreviewLayer();
      updateDrawControls();
      renderPalettes();
      setStatus(object.geometryType === "point"
        ? "Click a new point on the map to move this object."
        : "Drag the corner handles to reshape this geometry, then finish.");
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  function cancelGeometryPreviewOnly() {
    if (state.previewLayer) {
      state.map.removeLayer(state.previewLayer);
      state.previewLayer = null;
    }
    clearGeometryEditHandles();
  }

  function clearGeometryEditHandles() {
    if (state.editHandleLayerGroup) {
      state.editHandleLayerGroup.clearLayers();
    }
  }

  function renderGeometryEditHandles() {
    clearGeometryEditHandles();
    if (!state.editHandleLayerGroup || !state.drawState || state.drawState.mode !== "edit") return;
    const { template, points = [] } = state.drawState;
    if (!Array.isArray(points) || !points.length || template.geometryType === "point") return;
    points.forEach((point, index) => {
      const handle = L.marker([point.lat, point.lng], {
        draggable: true,
        icon: L.divIcon({
          className: "",
          html: '<div class="geometry-handle"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        }),
        zIndexOffset: 1000
      });
      handle.on("drag", (event) => {
        const latlng = event.target.getLatLng();
        state.drawState.points[index] = {
          lat: roundCoord(latlng.lat),
          lng: roundCoord(latlng.lng)
        };
        redrawPreviewGeometryOnly();
        updateDrawControls();
      });
      handle.on("dragstart", () => {
        state.map?.dragging?.disable();
      });
      handle.on("dragend", () => {
        state.map?.dragging?.enable();
      });
      handle.addTo(state.editHandleLayerGroup);
    });
  }

  async function deleteSelectedObject() {
    const object = state.selectedObjectId ? state.objects.get(state.selectedObjectId) : null;
    if (!object || !canEditObject(object)) {
      setStatus("You cannot delete this object.");
      return;
    }
    if (!sessionIsActive()) {
      setStatus("This session is now read-only.");
      return;
    }
    if (!window.confirm("Delete this map object?")) return;
    try {
      const result = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/mutations`, {
        method: "POST",
        actorType: currentActorType(),
        body: {
          mutations: [{
            clientMutationId: createLocalID(),
            objectId: object.id,
            mutationType: "delete",
            baseVersion: object.version
          }]
        }
      });
      applyMutationResponse(result);
      state.selectedObjectId = null;
      renderSelectedObject();
      setStatus("Object deleted.");
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  function closeSelectedObjectEditor() {
    state.selectedObjectId = null;
    renderSelectedObject();
  }

  async function acquireObjectLock(object, options = {}) {
    const shouldSyncUI = options.syncUI !== false;
    const result = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/objects/${encodeURIComponent(object.id)}/lock`, {
      method: "POST",
      actorType: currentActorType(),
      body: { baseVersion: object.version }
    });
    if (result.object) {
      state.objects.set(result.object.id, result.object);
      if (shouldSyncUI) {
        syncMapObjects();
        renderSelectedObject();
      }
    }
  }

  async function releaseObjectLock(objectId) {
    await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/objects/${encodeURIComponent(objectId)}/lock`, {
      method: "DELETE",
      actorType: currentActorType()
    });
  }

  async function copyJoinLink() {
    if (!state.activeSession) return;
    const joinLink = state.activeSession.joinUrl || `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(state.activeSession.joinCode)}`;
    try {
      await writeToClipboard(joinLink);
      setStatus("Join link copied.");
    } catch (error) {
      setStatus("Unable to copy join link.");
    }
  }

  function buildViewerLink(session = state.activeSession) {
    if (!session?.joinCode) return "";
    const baseUrl = runtimeConfig.publicBaseUrl || `${window.location.origin}${window.location.pathname}`;
    try {
      const url = new URL(baseUrl);
      url.searchParams.set("join", session.joinCode);
      url.searchParams.set("view", "1");
      return url.toString();
    } catch (_error) {
      return `${baseUrl.replace(/\/$/, "")}?join=${encodeURIComponent(session.joinCode)}&view=1`;
    }
  }

  function showViewerQrModal() {
    if (!state.activeSession?.joinCode) return;
    const viewerLink = buildViewerLink();
    elements.viewerQrLink.value = viewerLink;
    elements.viewerQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(viewerLink)}`;
    elements.viewerQrModal.classList.remove("hidden");
  }

  function hideViewerQrModal() {
    elements.viewerQrModal.classList.add("hidden");
  }

  async function copyViewerLink() {
    const viewerLink = buildViewerLink();
    if (!viewerLink) return;
    try {
      await writeToClipboard(viewerLink);
      setStatus("Viewer link copied.");
    } catch (_error) {
      setStatus("Unable to copy viewer link.");
    }
  }

  function currentActorType() {
    if (state.viewerMode) {
      return "public";
    }
    if (state.actor?.permissionTier === "commander" && state.commanderAuth?.accessToken) {
      return "commander";
    }
    if (state.participantAuth?.sessionId === state.activeSession?.id && state.participantAuth?.accessToken) {
      return "participant";
    }
    return "commander";
  }

  function canCreateObjects() {
    return sessionIsActive() && state.actor && state.actor.permissionTier !== "observer";
  }

  function canEditObject(object) {
    if (!sessionIsActive() || !state.actor || state.actor.permissionTier === "observer") return false;
    if (state.actor.permissionTier === "commander") return true;
    return object.createdByParticipantId === state.actor.id;
  }

  function isCommander() {
    return state.actor?.permissionTier === "commander" || currentActorType() === "commander";
  }

  function formatPermissionTier(permissionTier) {
    if (permissionTier === "commander") return "owner";
    return permissionTier;
  }

  function sessionIsActive() {
    return effectiveSessionStatus(state.activeSession) === "active";
  }

  function effectiveSessionStatus(session) {
    if (!session) return "ended";
    if (session.status && session.status !== "active") return session.status;
    const operationalPeriodEnd = session.operationalPeriodEnd ? new Date(session.operationalPeriodEnd) : null;
    if (operationalPeriodEnd && !Number.isNaN(operationalPeriodEnd.getTime()) && operationalPeriodEnd.getTime() <= Date.now()) {
      return "expired";
    }
    return session.status || "active";
  }

  function appendMetaRow(container, label, value) {
    const row = document.createElement("div");
    row.className = "meta-row";
    const left = document.createElement("div");
    left.className = "label";
    left.textContent = label;
    const right = document.createElement("div");
    right.className = "value";
    right.textContent = value;
    row.append(left, right);
    container.appendChild(row);
  }

  function collectFieldEntries(object) {
    const template = resolveTemplateForObject(object);
    const merged = { ...(template?.defaults || {}), ...(object.fields || {}) };
    if (object.objectType === ICON_MARKER_OBJECT_TYPE) {
      delete merged.iconId;
      delete merged.iconCategory;
      delete merged.iconLabel;
      delete merged.iconAssetPath;
    }
    return Object.entries(merged);
  }

  function buildInitialFields(template) {
    const fields = { ...(template.defaults || {}) };
    if (template.objectType === "IncidentCommand") {
      fields.incidentName = fields.incidentName || elements.incidentNameInput.value.trim() || state.activeSession?.incidentName || "";
      fields.ICName = fields.ICName || state.activeSession?.commanderName || state.commanderAuth?.displayName || "";
    }
    return fields;
  }

  function buildObjectTooltip(object) {
    const template = resolveTemplateForObject(object);
    const author = state.participants.find((participant) => participant.id === object.createdByParticipantId);
    const parts = [template?.label || object.objectType];
    if (object.objectType === ICON_MARKER_OBJECT_TYPE && object.fields?.iconCategory) {
      parts.push(object.fields.iconCategory);
    }
    if (author) parts.push(`${author.displayName} · ${author.icsRole}`);
    return parts.join(" | ");
  }

  function buildPaletteGroups() {
    const groups = [];
    const groupByCategory = new Map();

    function ensureGroup(category, emptyMessage = "") {
      if (!groupByCategory.has(category)) {
        const group = { category, items: [], emptyMessage };
        groupByCategory.set(category, group);
        groups.push(group);
      }
      const group = groupByCategory.get(category);
      if (emptyMessage && !group.emptyMessage) {
        group.emptyMessage = emptyMessage;
      }
      return group;
    }

    OBJECT_TEMPLATES.forEach((template) => {
      ensureGroup(template.category).items.push(template);
    });

    const iconCategoriesById = new Map(
      (state.iconCatalog.categories || []).map((category) => [category.id, category])
    );
    const categorizedIcons = new Map();

    (state.iconCatalog.icons || []).forEach((icon) => {
      const categoryId = String(icon.categoryId || "").trim();
      if (!categoryId) return;
      if (!categorizedIcons.has(categoryId)) {
        categorizedIcons.set(categoryId, []);
      }
      categorizedIcons.get(categoryId).push({
        ...icon,
        kind: "icon",
        geometryType: "point",
        selectionKey: `icon:${icon.id}`
      });
    });

    categorizedIcons.forEach((iconItems, categoryId) => {
      const category = iconCategoriesById.get(categoryId);
      const fallbackLabel = iconItems[0]?.category || categoryId;
      const targetCategory = ICON_CATEGORY_GROUP_OVERRIDES[categoryId] || category?.label || fallbackLabel;
      const targetGroup = ensureGroup(targetCategory, "No icons imported for this category yet.");
      if (ICON_CATEGORY_GROUP_OVERRIDES[categoryId]) {
        targetGroup.items.unshift(...iconItems);
      } else {
        targetGroup.items.push(...iconItems);
      }
    });

    (state.iconCatalog.categories || []).forEach((category) => {
      const targetCategory = ICON_CATEGORY_GROUP_OVERRIDES[category.id] || category.label;
      ensureGroup(targetCategory, "No icons imported for this category yet.");
    });

    return groups;
  }

  function createIconTemplate(iconDefinition) {
    return {
      ...ICON_MARKER_TEMPLATE,
      label: iconDefinition.label,
      defaults: {
        ...ICON_MARKER_TEMPLATE.defaults,
        iconId: iconDefinition.id,
        iconCategory: iconDefinition.category,
        iconLabel: iconDefinition.label,
        iconAssetPath: iconDefinition.assetPath,
        iconMarkerSize: iconDefinition.markerSize || 40
      }
    };
  }

  function buildIconMarkerIcon(object, template) {
    const iconSize = Number(object.fields?.iconMarkerSize || 40);
    const safeSize = Number.isFinite(iconSize) && iconSize > 0 ? iconSize : 40;
    return L.divIcon({
      className: "",
      html: `<img class="point-marker-icon" style="width:${escapeAttribute(String(safeSize))}px;height:${escapeAttribute(String(safeSize))}px" src="${escapeAttribute(resolveAssetPath(object.fields.iconAssetPath))}" alt="${escapeAttribute(object.fields.iconLabel || template?.label || "Map icon")}" />`,
      iconSize: [safeSize, safeSize],
      iconAnchor: [safeSize / 2, safeSize / 2]
    });
  }

  function findIconBySelectionKey(selectionKey) {
    return (state.iconCatalog.icons || []).find((icon) => `icon:${icon.id}` === selectionKey) || null;
  }

  function resolveTemplateForObject(object) {
    if (object?.objectType === ICON_MARKER_OBJECT_TYPE) {
      return {
        ...ICON_MARKER_TEMPLATE,
        label: object.fields?.iconLabel || ICON_MARKER_TEMPLATE.label,
        category: object.fields?.iconCategory || ICON_MARKER_TEMPLATE.category,
        assetPath: object.fields?.iconAssetPath || ""
      };
    }
    return templateByType[object?.objectType];
  }

  function resolveAssetPath(assetPath) {
    if (!assetPath) return "";
    try {
      return new URL(assetPath, window.location.href).toString();
    } catch (_error) {
      return assetPath;
    }
  }

  function toLeafletLatLngs(points) {
    return (points || []).map((point) => [point.lat, point.lng]);
  }

  async function apiFetch(path, options = {}) {
    const hasBody = options.body !== undefined;
    const headers = {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    };
    if (options.actorType === "participant" && state.participantAuth?.accessToken) {
      headers.Authorization = `Bearer ${state.participantAuth.accessToken}`;
    } else if (options.actorType === "public") {
      // Public viewer requests are intentionally unauthenticated.
    } else if (state.commanderAuth?.accessToken) {
      await refreshCommanderTokenIfNeeded();
      headers.Authorization = `Bearer ${state.commanderAuth.accessToken}`;
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined
    });
    const payload = await parseJsonSafely(response);
    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function supabaseHeaders() {
    return {
      "Content-Type": "application/json",
      apikey: runtimeConfig.supabaseAnonKey
    };
  }

  async function loadRuntimeMetaConfig() {
    if (hasSupabaseAuthConfig()) return;
    if (!API_BASE_URL) return;
    try {
      const response = await fetch(`${API_BASE_URL}/v1/ics-collab/meta`);
      const payload = await parseJsonSafely(response);
      if (!response.ok) return;
      if (!runtimeConfig.supabaseUrl && payload?.runtimeConfig?.supabaseUrl) {
        runtimeConfig.supabaseUrl = String(payload.runtimeConfig.supabaseUrl).replace(/\/$/, "");
      }
      if (!runtimeConfig.supabaseAnonKey && payload?.runtimeConfig?.supabaseAnonKey) {
        runtimeConfig.supabaseAnonKey = String(payload.runtimeConfig.supabaseAnonKey);
      }
      if (!runtimeConfig.publicBaseUrl && payload?.runtimeConfig?.publicBaseUrl) {
        runtimeConfig.publicBaseUrl = String(payload.runtimeConfig.publicBaseUrl).replace(/\/$/, "");
      }
    } catch (_error) {
      // Non-fatal: join still works without commander auth bootstrap.
    }
  }

  function hasSupabaseAuthConfig() {
    return Boolean(runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey);
  }

  function getAuthRedirectUrl() {
    if (runtimeConfig.publicBaseUrl) return runtimeConfig.publicBaseUrl;
    return `${window.location.origin}${window.location.pathname}`;
  }

  async function parseSupabaseAuthResponse(response) {
    const payload = await parseJsonSafely(response);
    if (!response.ok) {
      const details =
        payload?.msg_description ||
        payload?.error_description ||
        payload?.error ||
        payload?.message ||
        `HTTP ${response.status}`;
      throw new Error(`Supabase auth request failed: ${details}`);
    }
    return payload;
  }

  function normalizeCommanderAuth(session, fallbackDisplayName) {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ? Number(session.expires_at) * 1000 : Date.now() + Number(session.expires_in || 3600) * 1000,
      email: session.user?.email || state.commanderAuth?.email || "",
      displayName: session.user?.user_metadata?.display_name || fallbackDisplayName || session.user?.email || ""
    };
  }

  function setDefaultOperationalPeriodInputs() {
    const start = new Date();
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    elements.opStartInput.value = isoToInputValue(start.toISOString());
    elements.opEndInput.value = isoToInputValue(end.toISOString());
  }

  function setStatus(message) {
    elements.statusBar.textContent = message;
  }

  function formatTemperature(value) {
    if (!Number.isFinite(Number(value))) return "—";
    return `${Math.round(Number(value))}°F`;
  }

  function formatPercent(value) {
    if (!Number.isFinite(Number(value))) return "—";
    return `${Math.round(Number(value))}%`;
  }

  function formatWindSpeed(value) {
    if (!Number.isFinite(Number(value))) return "—";
    return `${Math.round(Number(value))} mph`;
  }

  function formatWindDirection(value) {
    if (!Number.isFinite(Number(value))) return "—";
    return `${Math.round(Number(value))}°`;
  }

  function directionToCardinal(value) {
    if (!Number.isFinite(Number(value))) return "—";
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return directions[Math.round(Number(value) / 45) % 8];
  }

  function weatherCodeToLabel(code) {
    const labelMap = {
      0: "Clear",
      1: "Mostly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Freezing fog",
      51: "Light drizzle",
      53: "Drizzle",
      55: "Heavy drizzle",
      56: "Freezing drizzle",
      57: "Heavy freezing drizzle",
      61: "Light rain",
      63: "Rain",
      65: "Heavy rain",
      66: "Freezing rain",
      67: "Heavy freezing rain",
      71: "Light snow",
      73: "Snow",
      75: "Heavy snow",
      77: "Snow grains",
      80: "Rain showers",
      81: "Heavy rain showers",
      82: "Violent rain showers",
      85: "Snow showers",
      86: "Heavy snow showers",
      95: "Thunderstorm",
      96: "Thunderstorm and hail",
      99: "Severe thunderstorm and hail"
    };
    return labelMap[code] || "Current conditions";
  }

  function formatError(error) {
    if (!error) return "Unknown error.";
    if (typeof error === "string") return error;
    return error.message || "Unknown error.";
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function inputValueToISOString(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function isoToInputValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  }

  function createLocalID() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `local_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function loadStoredJSON(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function persistJSON(key, value) {
    if (value == null) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  async function writeToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const input = document.createElement("textarea");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }

  async function parseJsonSafely(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_error) {
      return { message: text };
    }
  }

  function populateRoleSelect(select, defaultValue, options = {}) {
    if (!select) return;
    const excluded = new Set(options.exclude || []);
    select.innerHTML = "";
    ICS_ROLES.filter((role) => !excluded.has(role)).forEach((role) => {
      const option = document.createElement("option");
      option.value = role;
      option.textContent = role;
      if (role === defaultValue) option.selected = true;
      select.appendChild(option);
    });
  }

  function roundCoord(value) {
    return Math.round(Number(value) * 1000000) / 1000000;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll('"', "&quot;");
  }

  init();
})();
