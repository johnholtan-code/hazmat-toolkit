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
    participantAuth: "icsCollabParticipantAuth",
    ics202Draft: "icsCollabIcs202Draft_v1",
    themeMode: "icsCollabThemeMode_v1"
  };
  const POLL_INTERVAL_MS = 4000;
  const UPDATE_FLUSH_MS = 10000;
  const WEATHER_REFRESH_MS = 5 * 60 * 1000;
  const WEATHER_API_BASE_URL = (config.weatherApiBaseUrl || "https://api.open-meteo.com/v1/forecast").replace(/\/$/, "");
  const ICON_MANIFEST_URL = "./icon-manifest.json";
  const themeMediaQuery = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
  const ERG_WIND_BUCKETS = ["low", "moderate", "high"];
  const ICON_MARKER_OBJECT_TYPE = "IconMarker";
  const IS_TOUCH_PREFERRED = Boolean(
    window.matchMedia?.("(pointer: coarse)")?.matches
    || window.navigator?.maxTouchPoints > 0
    || "ontouchstart" in window
  );
  const EQUIPMENT_CATEGORY = "Equipment";
  const CONSUMABLES_CATEGORY = "Consumables";
  const CUSTOM_EQUIPMENT_ID = "custom_equipment";
  const CUSTOM_CONSUMABLE_ID = "custom_consumable";
  const RATE_CATALOGS = window.HAZMAT_RATE_CATALOGS || { equipment: [], consumables: [] };
  const COSTED_RESOURCE_CATEGORIES = new Set([EQUIPMENT_CATEGORY, CONSUMABLES_CATEGORY]);
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
  const VIEWER_QR_ALLOWED_ROLES = new Set([
    "Incident Commander",
    "Operations Section Chief",
    "Planning Section Chief",
    "Logistics Section Chief",
    "Safety Officer",
    "HazMat Group Supervisor"
  ]);
  const MAP_NOTE_OBJECT_TYPE = "MapNote";
  const MAP_NOTE_ALLOWED_ROLES = new Set([
    "Incident Commander",
    "Operations Section Chief",
    "Planning Section Chief",
    "Logistics Section Chief",
    "Safety Officer",
    "HazMat Group Supervisor"
  ]);
  const ISOLATION_ZONE_OBJECT_TYPE = "InitialIsolationZone";
  const PROTECTIVE_ACTION_ZONE_OBJECT_TYPE = "ProtectiveActionZone";
  const MAP_NOTE_FIELD_DEFS = [
    { key: "title", label: "Title", type: "text" },
    { key: "noteText", label: "Note", type: "textarea" },
    { key: "priority", label: "Priority", type: "select", options: [
      { value: "info", label: "Info" },
      { value: "important", label: "Important" },
      { value: "urgent", label: "Urgent" }
    ] }
  ];
  const OBJECT_TEMPLATES = [
    { objectType: "IncidentCommand", label: "Incident Command Post", category: "Command", geometryType: "point", color: "#f3c613", defaults: { incidentName: "", ICName: "", channel: "" } },
    { objectType: "Staging", label: "Staging Area", category: "Command", geometryType: "point", color: "#0d6efd", defaults: { capacity: "", stagingManager: "", apparatusCount: "" } },
    { objectType: "Division", label: "Operational Division", category: "Command", geometryType: "polygon", color: "#3d8bfd", defaults: { divisionName: "", supervisor: "" } },
    { objectType: MAP_NOTE_OBJECT_TYPE, label: "Map Note", category: "Command", geometryType: "point", color: "#ffd400", defaults: { title: "", noteText: "", priority: "info" }, fieldDefs: MAP_NOTE_FIELD_DEFS },
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
    { objectType: ISOLATION_ZONE_OBJECT_TYPE, label: "Initial Isolation Zone", category: "HazMat", geometryType: "polygon", color: "#9ca3af", defaults: {} },
    { objectType: PROTECTIVE_ACTION_ZONE_OBJECT_TYPE, label: "Protective Action Zone", category: "HazMat", geometryType: "polygon", color: "#6b7280", defaults: {} },
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
  const ICS202_OBJECTIVE_EXAMPLES = [
    "Ensure life safety by evacuating the affected area within 30 minutes.",
    "Establish hot, warm, and cold zones and restrict access to essential personnel only.",
    "Initiate continuous air monitoring in downwind areas and report readings every 15 minutes.",
    "Protect exposures and maintain access/egress routes for mutual-aid resources.",
    "Complete responder accountability and confirm rehab/safety coverage for the operational period."
  ];

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
  const COSTED_RESOURCE_FIELD_DEFS = [
    { key: "displayLabel", label: "Item Name", type: "text" },
    { key: "company", label: "Company / Agency", type: "text" },
    { key: "billingModel", label: "Billing Model", type: "select", options: [
      { value: "hourly", label: "Hourly" },
      { value: "quantity", label: "Quantity" }
    ] },
    { key: "unit", label: "Unit", type: "text" },
    { key: "quantity", label: "Quantity", type: "number", step: "0.01", min: "0" },
    { key: "costRate", label: "Cost Rate", type: "number", step: "0.01", min: "0" },
    { key: "costCode", label: "Cost Code", type: "text" },
    { key: "placedAt", label: "Placed Time", type: "datetime-local" },
    { key: "demobilizedAt", label: "Demobilized Time", type: "datetime-local" },
    { key: "notes", label: "Notes", type: "textarea" }
  ];
  const EQUIPMENT_RATE_TEMPLATES = (RATE_CATALOGS.equipment || []).map((entry) => normalizeCostTemplate(entry, EQUIPMENT_CATEGORY));
  const CONSUMABLE_RATE_TEMPLATES = (RATE_CATALOGS.consumables || []).map((entry) => normalizeCostTemplate(entry, CONSUMABLES_CATEGORY));
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
    forgotPasswordRow: document.getElementById("forgotPasswordRow"),
    forgotPasswordBtn: document.getElementById("forgotPasswordBtn"),
    superAdminWorkspaceBtn: document.getElementById("superAdminWorkspaceBtn"),
    departmentAdminPanel: document.getElementById("departmentAdminPanel"),
    departmentAdminPanelToggle: document.getElementById("departmentAdminPanelToggle"),
    departmentAdminPanelBody: document.getElementById("departmentAdminPanelBody"),
    departmentAdminSummary: document.getElementById("departmentAdminSummary"),
    departmentAdminNameInput: document.getElementById("departmentAdminNameInput"),
    departmentAdminEmailInput: document.getElementById("departmentAdminEmailInput"),
    departmentAdminIsAdminInput: document.getElementById("departmentAdminIsAdminInput"),
    departmentAdminIsActiveInput: document.getElementById("departmentAdminIsActiveInput"),
    departmentAdminAddBtn: document.getElementById("departmentAdminAddBtn"),
    departmentAdminMemberList: document.getElementById("departmentAdminMemberList"),
    createSessionPanel: document.getElementById("createSessionPanel"),
    createSessionLockedNote: document.getElementById("createSessionLockedNote"),
    createSessionPanelToggle: document.getElementById("createSessionPanelToggle"),
    createSessionPanelBody: document.getElementById("createSessionPanelBody"),
    sessionListPanel: document.getElementById("sessionListPanel"),
    sessionListPanelToggle: document.getElementById("sessionListPanelToggle"),
    sessionListPanelBody: document.getElementById("sessionListPanelBody"),
    commanderSessionList: document.getElementById("commanderSessionList"),
    scenarioReviewPanel: document.getElementById("scenarioReviewPanel"),
    scenarioReviewPanelToggle: document.getElementById("scenarioReviewPanelToggle"),
    scenarioReviewPanelBody: document.getElementById("scenarioReviewPanelBody"),
    loadScenarioBtn: document.getElementById("loadScenarioBtn"),
    scenarioFileInput: document.getElementById("scenarioFileInput"),
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
    createSessionFocusBlock: document.getElementById("createSessionFocusBlock"),
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
    paletteSearchInput: document.getElementById("paletteSearchInput"),
    clearPaletteSearchBtn: document.getElementById("clearPaletteSearchBtn"),
    paletteContainer: document.getElementById("paletteContainer"),
    printExportBtn: document.getElementById("printExportBtn"),
    isolationToolBtn: document.getElementById("isolationToolBtn"),
    participantList: document.getElementById("participantList"),
    guidedSteps: document.getElementById("guidedSteps"),
    startGuidedSetupBtn: document.getElementById("startGuidedSetupBtn"),
    guidedModeBtn: document.getElementById("guidedModeBtn"),
    afterActionModeBtn: document.getElementById("afterActionModeBtn"),
    exportCostCsvBtn: document.getElementById("exportCostCsvBtn"),
    exportCostPdfBtn: document.getElementById("exportCostPdfBtn"),
    ics202WorkspaceBtn: document.getElementById("ics202WorkspaceBtn"),
    setIncidentFocusBtn: document.getElementById("setIncidentFocusBtn"),
    centerIncidentBtn: document.getElementById("centerIncidentBtn"),
    closeScenarioReviewBtn: document.getElementById("closeScenarioReviewBtn"),
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
    themeModeSelect: document.getElementById("themeModeSelect"),
    leaveSessionBtn: document.getElementById("leaveSessionBtn"),
    sessionSignOutBtn: document.getElementById("sessionSignOutBtn"),
    showViewerQrBtn: document.getElementById("showViewerQrBtn"),
    toggleViewerAccessBtn: document.getElementById("toggleViewerAccessBtn"),
    quickFlowPanel: document.getElementById("quickFlowPanel"),
    quickFlowPanelToggle: document.getElementById("quickFlowPanelToggle"),
    quickFlowPanelBody: document.getElementById("quickFlowPanelBody"),
    afterActionPanelToggle: document.getElementById("afterActionPanelToggle"),
    afterActionPanelBody: document.getElementById("afterActionPanelBody"),
    incidentOverviewPanel: document.getElementById("incidentOverviewPanel"),
    incidentOverviewPanelToggle: document.getElementById("incidentOverviewPanelToggle"),
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
    afterActionPanel: document.getElementById("afterActionPanel"),
    loadPlaybackBtn: document.getElementById("loadPlaybackBtn"),
    exitPlaybackBtn: document.getElementById("exitPlaybackBtn"),
    exportTrainingScenarioBtn: document.getElementById("exportTrainingScenarioBtn"),
    editScenarioBtn: document.getElementById("editScenarioBtn"),
    playbackEmptyState: document.getElementById("playbackEmptyState"),
    playbackControls: document.getElementById("playbackControls"),
    playbackToggleBtn: document.getElementById("playbackToggleBtn"),
    playbackRestartBtn: document.getElementById("playbackRestartBtn"),
    playbackStepBackBtn: document.getElementById("playbackStepBackBtn"),
    playbackStepForwardBtn: document.getElementById("playbackStepForwardBtn"),
    playbackSpeedSelect: document.getElementById("playbackSpeedSelect"),
    playbackScrubber: document.getElementById("playbackScrubber"),
    playbackMeta: document.getElementById("playbackMeta"),
    costSummaryPanel: document.getElementById("costSummaryPanel"),
    costSummaryBody: document.getElementById("costSummaryBody"),
    viewerQrModal: document.getElementById("viewerQrModal"),
    closeViewerQrBtn: document.getElementById("closeViewerQrBtn"),
    viewerQrImage: document.getElementById("viewerQrImage"),
    viewerQrLink: document.getElementById("viewerQrLink"),
    copyViewerLinkBtn: document.getElementById("copyViewerLinkBtn"),
    ics202Workspace: document.getElementById("ics202Workspace"),
    ics202BackBtn: document.getElementById("ics202BackBtn"),
    ics202SaveBtn: document.getElementById("ics202SaveBtn"),
    ics202PrintBtn: document.getElementById("ics202PrintBtn"),
    ics202ExportPdfBtn: document.getElementById("ics202ExportPdfBtn"),
    ics202ClearBtn: document.getElementById("ics202ClearBtn"),
    ics202ValidationBanner: document.getElementById("ics202ValidationBanner"),
    ics202ValidationTitle: document.getElementById("ics202ValidationTitle"),
    ics202ValidationList: document.getElementById("ics202ValidationList"),
    ics202IncidentName: document.getElementById("ics202IncidentName"),
    ics202IncidentNumber: document.getElementById("ics202IncidentNumber"),
    ics202OpStartDate: document.getElementById("ics202OpStartDate"),
    ics202OpStartTime: document.getElementById("ics202OpStartTime"),
    ics202OpEndDate: document.getElementById("ics202OpEndDate"),
    ics202OpEndTime: document.getElementById("ics202OpEndTime"),
    ics202AddObjectiveBtn: document.getElementById("ics202AddObjectiveBtn"),
    ics202ObjectiveExampleSelect: document.getElementById("ics202ObjectiveExampleSelect"),
    ics202InsertObjectiveExampleBtn: document.getElementById("ics202InsertObjectiveExampleBtn"),
    ics202ObjectivesList: document.getElementById("ics202ObjectivesList"),
    ics202CommandEmphasis: document.getElementById("ics202CommandEmphasis"),
    ics202SituationalAwareness: document.getElementById("ics202SituationalAwareness"),
    ics202SiteSafetyYes: document.getElementById("ics202SiteSafetyYes"),
    ics202SiteSafetyNo: document.getElementById("ics202SiteSafetyNo"),
    ics202SiteSafetyLocationField: document.getElementById("ics202SiteSafetyLocationField"),
    ics202SiteSafetyLocation: document.getElementById("ics202SiteSafetyLocation"),
    ics202Attachment203: document.getElementById("ics202Attachment203"),
    ics202Attachment204: document.getElementById("ics202Attachment204"),
    ics202Attachment205: document.getElementById("ics202Attachment205"),
    ics202Attachment205A: document.getElementById("ics202Attachment205A"),
    ics202Attachment206: document.getElementById("ics202Attachment206"),
    ics202Attachment207: document.getElementById("ics202Attachment207"),
    ics202Attachment208: document.getElementById("ics202Attachment208"),
    ics202AttachmentMapChart: document.getElementById("ics202AttachmentMapChart"),
    ics202AttachmentWeather: document.getElementById("ics202AttachmentWeather"),
    ics202AttachmentOtherEnabled: document.getElementById("ics202AttachmentOtherEnabled"),
    ics202AttachmentOtherField: document.getElementById("ics202AttachmentOtherField"),
    ics202AttachmentOtherText: document.getElementById("ics202AttachmentOtherText"),
    ics202PreparedByName: document.getElementById("ics202PreparedByName"),
    ics202PreparedByPosition: document.getElementById("ics202PreparedByPosition"),
    ics202PreparedByDateTime: document.getElementById("ics202PreparedByDateTime"),
    ics202ApprovedByName: document.getElementById("ics202ApprovedByName"),
    ics202ApprovedBySignature: document.getElementById("ics202ApprovedBySignature"),
    ics202ApprovedByDateTime: document.getElementById("ics202ApprovedByDateTime"),
    ics202Summary: document.getElementById("ics202Summary"),
    ics202PrintRoot: document.getElementById("ics202PrintRoot"),
    superAdminWorkspace: document.getElementById("superAdminWorkspace"),
    superAdminBackBtn: document.getElementById("superAdminBackBtn"),
    superAdminRefreshBtn: document.getElementById("superAdminRefreshBtn"),
    superAdminTabOverview: document.getElementById("superAdminTabOverview"),
    superAdminTabOrganizations: document.getElementById("superAdminTabOrganizations"),
    superAdminTabUsers: document.getElementById("superAdminTabUsers"),
    superAdminTabAccess: document.getElementById("superAdminTabAccess"),
    superAdminOverviewPanel: document.getElementById("superAdminOverviewPanel"),
    superAdminOrganizationsPanel: document.getElementById("superAdminOrganizationsPanel"),
    superAdminUsersPanel: document.getElementById("superAdminUsersPanel"),
    superAdminAccessPanel: document.getElementById("superAdminAccessPanel"),
    superAdminOverviewStats: document.getElementById("superAdminOverviewStats"),
    superAdminRecentOrganizations: document.getElementById("superAdminRecentOrganizations"),
    superAdminOrgNameInput: document.getElementById("superAdminOrgNameInput"),
    superAdminCountyNameInput: document.getElementById("superAdminCountyNameInput"),
    superAdminSeatLimitInput: document.getElementById("superAdminSeatLimitInput"),
    superAdminLicenseStatusSelect: document.getElementById("superAdminLicenseStatusSelect"),
    superAdminFirstAdminNameInput: document.getElementById("superAdminFirstAdminNameInput"),
    superAdminFirstAdminEmailInput: document.getElementById("superAdminFirstAdminEmailInput"),
    superAdminCreateOrgBtn: document.getElementById("superAdminCreateOrgBtn"),
    superAdminOrganizationsList: document.getElementById("superAdminOrganizationsList"),
    superAdminUsersOrgFilter: document.getElementById("superAdminUsersOrgFilter"),
    superAdminUsersList: document.getElementById("superAdminUsersList"),
    superAdminStandingSourceSelect: document.getElementById("superAdminStandingSourceSelect"),
    superAdminStandingTargetList: document.getElementById("superAdminStandingTargetList"),
    superAdminCreateStandingAccessBtn: document.getElementById("superAdminCreateStandingAccessBtn"),
    superAdminStandingAccessList: document.getElementById("superAdminStandingAccessList"),
    superAdminAccessList: document.getElementById("superAdminAccessList"),
    map: document.getElementById("map"),
    mapPrintRoot: document.getElementById("mapPrintRoot"),
    printExportModal: document.getElementById("printExportModal"),
    closePrintExportBtn: document.getElementById("closePrintExportBtn"),
    printMapBtn: document.getElementById("printMapBtn"),
    exportMapPdfBtn: document.getElementById("exportMapPdfBtn"),
    printExportModalNote: document.getElementById("printExportModalNote"),
    isolationToolModal: document.getElementById("isolationToolModal"),
    closeIsolationToolBtn: document.getElementById("closeIsolationToolBtn"),
    cancelIsolationToolBtn: document.getElementById("cancelIsolationToolBtn"),
    startIsolationPlacementBtn: document.getElementById("startIsolationPlacementBtn"),
    isolationDistanceInput: document.getElementById("isolationDistanceInput"),
    evacuationDistanceInput: document.getElementById("evacuationDistanceInput"),
    distanceUnitSelect: document.getElementById("distanceUnitSelect"),
    isolationErgMaterialInput: document.getElementById("isolationErgMaterialInput"),
    isolationErgMaterialList: document.getElementById("isolationErgMaterialList"),
    isolationErgSuggestions: document.getElementById("isolationErgSuggestions"),
    isolationSpillSizeSelect: document.getElementById("isolationSpillSizeSelect"),
    isolationTimeOfDaySelect: document.getElementById("isolationTimeOfDaySelect"),
    isolationTransportContainerField: document.getElementById("isolationTransportContainerField"),
    isolationTransportContainerSelect: document.getElementById("isolationTransportContainerSelect"),
    isolationWindBucketField: document.getElementById("isolationWindBucketField"),
    isolationWindBucketSelect: document.getElementById("isolationWindBucketSelect"),
    isolationErgHint: document.getElementById("isolationErgHint"),
    windDirectionInput: document.getElementById("windDirectionInput"),
    isolationUseLiveWindToggle: document.getElementById("isolationUseLiveWindToggle"),
    isolationManualOverrideToggle: document.getElementById("isolationManualOverrideToggle"),
    isolationManualWindField: document.getElementById("isolationManualWindField"),
    isolationWindHint: document.getElementById("isolationWindHint")
  };

  const state = {
    authTab: "signin",
    commanderAuth: loadStoredJSON(STORAGE_KEYS.commanderAuth),
    participantAuth: loadStoredJSON(STORAGE_KEYS.participantAuth),
    superAdminContext: null,
    superAdminData: {
      overview: null,
      organizations: [],
      users: [],
      access: [],
      standingAccess: []
    },
    organizationContext: null,
    organizationRoster: [],
    organizationSummary: null,
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
    paletteCollapseInitialized: false,
    paletteSearchQuery: "",
    collapsedPanels: new Set(["session", "sessionPeriod", "incidentCommand", "participants", "palettes"]),
    collapsedModePanels: new Set(["quickFlow", "afterAction"]),
    collapsedLandingSections: new Set(["departmentAdmin", "createSession", "joinSession", "whatHappens", "activeSessions", "reviewScenario"]),
    viewerMode: false,
    viewerJoinCode: null,
    scenarioReview: null,
    rightSidebarCollapsed: false,
    mapStyleTrayOpen: false,
    themeMode: "auto",
    incidentFocusSignature: "",
    weatherPanelOpen: false,
    weatherLoading: false,
    weatherData: null,
    weatherError: "",
    weatherTargetSignature: "",
    weatherFetchNonce: 0,
    weatherTimer: null,
    ergCatalog: { materials: [], lookup: new Map() },
    pendingIsolationConfig: null,
    isolationEditContext: null,
    afterActionPanelVisible: false,
    playbackMode: false,
    playbackHistory: [],
    playbackSessionId: null,
    playbackEntries: [],
    playbackIndex: 0,
    playbackTimer: null,
    playbackSpeedMs: 900,
    playbackSavedSnapshot: null,
    ics202Open: false,
    ics202Draft: null,
    superAdminOpen: false,
    superAdminTab: "overview",
    superAdminUsersOrgFilter: "",
    superAdminStandingSourceFilter: "",
    superAdminStandingTargetFilters: [],
    ics202ObjectiveDragIndex: -1
  };

  async function init() {
    loadThemeMode();
    if (themeMediaQuery) {
      const onSchemeChange = () => {
        if (state.themeMode === "auto") {
          applyThemeMode("auto", { persist: false });
        }
      };
      if (typeof themeMediaQuery.addEventListener === "function") {
        themeMediaQuery.addEventListener("change", onSchemeChange);
      } else if (typeof themeMediaQuery.addListener === "function") {
        themeMediaQuery.addListener(onSchemeChange);
      }
    }
    await loadIconManifest();
    loadErgIsolationCatalog();
    ensureIcs202Draft();
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

  function loadErgIsolationCatalog() {
    const materials = Array.isArray(window.ICS_ERG_ISOLATION_DATA?.materials) ? window.ICS_ERG_ISOLATION_DATA.materials : [];
    const lookup = new Map();
    materials.forEach((material) => {
      const register = (value) => {
        const key = normalizeErgLookupKey(value);
        if (key && !lookup.has(key)) lookup.set(key, material);
      };
      register(material.displayName);
      register(material.unNumber);
      register(`UN${material.unNumber}`);
      register(`UN ${material.unNumber}`);
      register(`${material.displayName} (UN${material.unNumber})`);
      (material.materialNames || []).forEach(register);
    });
    state.ergCatalog = { materials, lookup };
    populateErgMaterialOptions();
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

  function isScenarioReviewMode() {
    return Boolean(state.scenarioReview?.active);
  }

  function scenarioReviewCanEdit() {
    return Boolean(state.scenarioReview?.active && state.scenarioReview?.editable);
  }

  function getWorkspaceSession() {
    if (state.activeSession) return state.activeSession;
    if (!isScenarioReviewMode()) return null;
    return {
      id: state.scenarioReview.id,
      incidentName: state.scenarioReview.incidentName,
      commanderName: state.commanderAuth?.displayName || "Scenario Reviewer",
      commanderICSRole: "Scenario Review",
      status: state.scenarioReview.editable ? "editable" : "review",
      currentVersion: 0
    };
  }

  function openNativeFilePicker(inputEl, failureMessage) {
    if (!inputEl) {
      setStatus(failureMessage || "File picker unavailable.");
      return;
    }
    try {
      inputEl.click();
    } catch (_error) {
      setStatus(failureMessage || "Unable to open file picker.");
    }
  }

  function onLoadScenarioFile() {
    if (!state.commanderAuth?.accessToken) {
      setStatus("Sign in first to review a scenario file.");
      return;
    }
    elements.scenarioFileInput.value = "";
    openNativeFilePicker(elements.scenarioFileInput, "Unable to open scenario file picker.");
  }

  function onScenarioFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      setStatus("Load canceled.");
      return;
    }
    loadScenarioFromFile(file);
  }

  function loadScenarioFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        openScenarioReviewWorkspace(parsed, file.name);
      } catch (_error) {
        setStatus("Invalid scenario file.");
      }
    };
    reader.onerror = () => {
      setStatus("Failed to read scenario file.");
    };
    reader.readAsText(file);
  }

  function openScenarioReviewWorkspace(payload, fileName) {
    const imported = buildScenarioReviewFromPayload(payload, fileName);
    clearPolling();
    clearWeatherPolling();
    stopPlaybackTimer();
    state.activeSession = null;
    state.viewerMode = false;
    state.viewerJoinCode = null;
    state.qrPayload = null;
    state.scenarioReview = imported;
    state.actor = imported.localActor;
    state.participants = imported.participants;
    state.objects = imported.objects;
    state.selectedObjectId = null;
    state.selectedTemplateType = null;
    state.drawState = null;
    state.incidentFocusSignature = "";
    state.weatherPanelOpen = false;
    state.weatherLoading = false;
    state.weatherData = null;
    state.weatherError = "";
    state.weatherTargetSignature = "";
    state.weatherFetchNonce = 0;
    state.playbackHistory = deepClone(imported.mutations);
    state.playbackEntries = deepClone(imported.playbackEntries);
    state.playbackSessionId = imported.id;
    state.playbackIndex = 0;
    state.playbackMode = false;
    state.playbackSavedSnapshot = null;
    state.ics202Open = false;
    cancelGeometryPreviewOnly();
    syncMapObjects();
    elements.landingView.classList.add("hidden");
    elements.appView.classList.remove("hidden");
    elements.shell.classList.remove("viewer-mode");
    renderAll();
    centerOnIncidentFocus({ notify: false, fallbackToBounds: true, fallbackToCurrent: false });
    void refreshWeatherForCurrentTarget({ force: true, silent: true });
    setStatus(`Loaded scenario file: ${fileName}`);
  }

  function buildScenarioReviewFromPayload(payload, fileName) {
    const parsed = payload && typeof payload === "object" ? payload : {};
    const snapshotObjects = Array.isArray(parsed?.snapshot?.objects)
      ? parsed.snapshot.objects
      : Array.isArray(parsed?.objects)
        ? parsed.objects
        : [];
    const importedParticipants = Array.isArray(parsed?.participants) ? parsed.participants : [];
    const localActor = {
      id: state.commanderAuth?.email || "scenario-review-local",
      displayName: state.commanderAuth?.displayName || "Scenario Reviewer",
      permissionTier: "commander",
      icsRole: "Scenario Review",
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };
    const participants = importedParticipants.some((participant) => participant?.id === localActor.id)
      ? deepClone(importedParticipants)
      : [...deepClone(importedParticipants), localActor];
    const objects = new Map(
      snapshotObjects
        .filter((object) => object && !object.isDeleted)
        .map((object) => [object.id, deepClone(object)])
    );
    const mutations = Array.isArray(parsed?.mutations) ? parsed.mutations : [];
    return {
      active: true,
      editable: false,
      id: `scenario-review-${Date.now()}`,
      fileName,
      importedAt: new Date().toISOString(),
      incidentName: parsed?.incidentName || parsed?.session?.incidentName || stripScenarioExtension(fileName),
      originalPayload: deepClone(parsed),
      reviewSnapshot: { objects: snapshotObjects.map((object) => deepClone(object)) },
      objects,
      participants,
      localActor,
      mutations: deepClone(mutations),
      playbackEntries: mutations.length ? buildPlaybackEntries(mutations) : buildScenarioSnapshotEntries(snapshotObjects)
    };
  }

  function buildScenarioSnapshotEntries(objects) {
    return (Array.isArray(objects) ? objects : []).map((object, index) => ({
      id: index + 1,
      version: index + 1,
      mutationType: "create",
      objectId: object.id,
      participantId: object.createdByParticipantId || "",
      createdAt: object.createdAt || new Date().toISOString(),
      object: deepClone(object),
      label: getObjectDisplayLabel(object, resolveTemplateForObject(object)),
      category: getPlaybackCategory(object),
      focusPoint: getObjectFocusPoint(object)
    }));
  }

  function stripScenarioExtension(fileName) {
    return String(fileName || "Scenario")
      .replace(/\.scenario\.json$/i, "")
      .replace(/\.json$/i, "");
  }

  function closeScenarioReview() {
    if (!isScenarioReviewMode()) return;
    state.ics202Open = false;
    exitActiveWorkspace();
    renderAll();
    setStatus("Scenario review closed.");
  }

  function promoteScenarioReviewToEditable() {
    if (!isScenarioReviewMode()) return;
    state.scenarioReview.editable = true;
    state.selectedObjectId = null;
    state.playbackSavedSnapshot = null;
    renderAll();
    setStatus("Scenario is now an editable local copy.");
  }

  function wireEvents() {
    elements.signInTabBtn.addEventListener("click", () => setAuthTab("signin"));
    elements.signUpTabBtn.addEventListener("click", () => setAuthTab("signup"));
    elements.commanderAuthBtn.addEventListener("click", onCommanderAuth);
    elements.commanderSignOutBtn.addEventListener("click", signOutCommander);
    elements.forgotPasswordBtn?.addEventListener("click", onForgotPassword);
    elements.superAdminWorkspaceBtn?.addEventListener("click", openSuperAdminWorkspace);
    elements.departmentAdminPanelToggle?.addEventListener("click", () => toggleLandingSection("departmentAdmin"));
    elements.departmentAdminAddBtn?.addEventListener("click", onAddOrganizationMember);
    elements.createSessionPanelToggle.addEventListener("click", () => toggleLandingSection("createSession"));
    elements.sessionListPanelToggle.addEventListener("click", () => toggleLandingSection("reviewSessions"));
    elements.scenarioReviewPanelToggle.addEventListener("click", () => toggleLandingSection("reviewScenario"));
    elements.joinSessionPanelToggle.addEventListener("click", () => toggleLandingSection("joinSession"));
    elements.whatHappensPanelToggle.addEventListener("click", () => toggleLandingSection("whatHappens"));
    elements.activeSessionGalleryPanelToggle.addEventListener("click", () => toggleLandingSection("activeSessions"));
    elements.loadScenarioBtn.addEventListener("click", onLoadScenarioFile);
    elements.scenarioFileInput.addEventListener("change", onScenarioFileSelected);
    elements.paletteSearchInput.addEventListener("input", onPaletteSearchInput);
    elements.clearPaletteSearchBtn.addEventListener("click", clearPaletteSearch);
    elements.createSessionBtn.addEventListener("click", onCreateSession);
    elements.guidedSetupDefaultInput.addEventListener("change", renderCreateSessionFocusVisibility);
    elements.joinSessionBtn.addEventListener("click", onJoinSession);
    elements.startGuidedSetupBtn.addEventListener("click", () => toggleGuidedMode(true));
    elements.guidedModeBtn.addEventListener("click", () => toggleGuidedMode(!state.guidedMode));
    elements.afterActionModeBtn.addEventListener("click", onAfterActionModeAction);
    elements.printExportBtn.addEventListener("click", showPrintExportModal);
    elements.isolationToolBtn.addEventListener("click", openIsolationToolModal);
    elements.exportCostCsvBtn.addEventListener("click", exportCostCsv);
    elements.exportCostPdfBtn.addEventListener("click", exportCostPdf);
    elements.closePrintExportBtn.addEventListener("click", hidePrintExportModal);
    elements.printMapBtn.addEventListener("click", printMapExport);
    elements.exportMapPdfBtn.addEventListener("click", exportMapPdf);
    elements.closeIsolationToolBtn.addEventListener("click", closeIsolationToolModal);
    elements.cancelIsolationToolBtn.addEventListener("click", closeIsolationToolModal);
    elements.startIsolationPlacementBtn.addEventListener("click", beginIsolationPlacementFlow);
    elements.isolationErgMaterialInput?.addEventListener("input", () => {
      renderIsolationErgSuggestions();
      renderIsolationErgControls({ autofill: Boolean(getSelectedErgMaterial()) });
    });
    elements.isolationErgMaterialInput?.addEventListener("focus", () => {
      renderIsolationErgSuggestions();
    });
    elements.isolationErgMaterialInput?.addEventListener("change", () => {
      renderIsolationErgControls({ autofill: Boolean(getSelectedErgMaterial()) });
    });
    elements.isolationErgMaterialInput?.addEventListener("blur", () => {
      window.setTimeout(() => hideIsolationErgSuggestions(), 120);
    });
    elements.isolationSpillSizeSelect?.addEventListener("change", () => renderIsolationErgControls({ autofill: true }));
    elements.isolationTimeOfDaySelect?.addEventListener("change", () => renderIsolationErgControls({ autofill: true }));
    elements.isolationTransportContainerSelect?.addEventListener("change", () => renderIsolationErgControls({ autofill: true }));
    elements.isolationWindBucketSelect?.addEventListener("change", () => renderIsolationErgControls({ autofill: true }));
    elements.distanceUnitSelect?.addEventListener("change", () => renderIsolationErgControls({ autofill: Boolean(getSelectedErgMaterial()) }));
    elements.isolationUseLiveWindToggle?.addEventListener("change", renderIsolationWindControls);
    elements.isolationManualOverrideToggle?.addEventListener("change", renderIsolationWindControls);
    elements.ics202WorkspaceBtn.addEventListener("click", openIcs202Workspace);
    elements.setIncidentFocusBtn.addEventListener("click", onSetIncidentFocusAction);
    elements.centerIncidentBtn.addEventListener("click", onCenterIncidentAction);
    elements.closeScenarioReviewBtn.addEventListener("click", closeScenarioReview);
    elements.weatherLauncherBtn.addEventListener("click", toggleWeatherPanel);
    elements.refreshWeatherBtn.addEventListener("click", () => {
      void refreshWeatherForCurrentTarget({ force: true, silent: false });
    });
    elements.viewerCenterIncidentBtn.addEventListener("click", onCenterIncidentAction);
    elements.guidedSetupToggle.addEventListener("change", (event) => toggleGuidedMode(event.target.checked));
    elements.mapStyleLauncherBtn.addEventListener("click", toggleMapStyleTray);
    elements.mapStyleCloseBtn.addEventListener("click", closeMapStyleTray);
    elements.themeModeSelect?.addEventListener("change", (event) => {
      applyThemeMode(event.target.value, { notify: true });
    });
    elements.leaveSessionBtn.addEventListener("click", leaveCurrentSession);
    elements.sessionSignOutBtn.addEventListener("click", signOutCommander);
    elements.showViewerQrBtn.addEventListener("click", showViewerQrModal);
    elements.toggleViewerAccessBtn?.addEventListener("click", toggleViewerAccess);
    elements.incidentOverviewPanelToggle.addEventListener("click", () => togglePanel("incidentOverview"));
    elements.sessionPanelToggle.addEventListener("click", () => togglePanel("session"));
    elements.sessionPeriodPanelToggle.addEventListener("click", () => togglePanel("sessionPeriod"));
    elements.incidentCommandPanelToggle.addEventListener("click", () => togglePanel("incidentCommand"));
    elements.participantsPanelToggle.addEventListener("click", () => togglePanel("participants"));
    elements.palettesPanelToggle.addEventListener("click", () => togglePanel("palettes"));
    elements.quickFlowPanelToggle.addEventListener("click", () => toggleModePanel("quickFlow"));
    elements.afterActionPanelToggle.addEventListener("click", () => toggleModePanel("afterAction"));
    elements.copyJoinLinkBtn.addEventListener("click", copyJoinLink);
    elements.closeViewerQrBtn.addEventListener("click", hideViewerQrModal);
    elements.printExportModal.addEventListener("click", (event) => {
      if (event.target === elements.printExportModal) {
        hidePrintExportModal();
      }
    });
    elements.isolationToolModal.addEventListener("click", (event) => {
      if (event.target === elements.isolationToolModal) {
        closeIsolationToolModal();
      }
    });
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
    elements.loadPlaybackBtn.addEventListener("click", loadPlaybackHistory);
    elements.exitPlaybackBtn.addEventListener("click", exitPlaybackMode);
    elements.exportTrainingScenarioBtn.addEventListener("click", exportTrainingScenario);
    elements.editScenarioBtn.addEventListener("click", promoteScenarioReviewToEditable);
    elements.playbackToggleBtn.addEventListener("click", togglePlaybackRunning);
    elements.playbackRestartBtn.addEventListener("click", restartPlayback);
    elements.playbackStepBackBtn.addEventListener("click", () => renderPlaybackFrame(state.playbackIndex - 1));
    elements.playbackStepForwardBtn.addEventListener("click", () => renderPlaybackFrame(state.playbackIndex + 1));
    elements.playbackSpeedSelect.addEventListener("change", (event) => {
      state.playbackSpeedMs = Number(event.target.value || 900);
      if (state.playbackMode && state.playbackTimer) {
        startPlaybackTimer();
      }
    });
    elements.playbackScrubber.addEventListener("input", (event) => {
      renderPlaybackFrame(Number(event.target.value || 0));
    });
    elements.superAdminBackBtn?.addEventListener("click", closeSuperAdminWorkspace);
    elements.superAdminRefreshBtn?.addEventListener("click", () => {
      void refreshSuperAdminWorkspace({ notify: true });
    });
    elements.superAdminTabOverview?.addEventListener("click", () => setSuperAdminTab("overview"));
    elements.superAdminTabOrganizations?.addEventListener("click", () => setSuperAdminTab("organizations"));
    elements.superAdminTabUsers?.addEventListener("click", () => setSuperAdminTab("users"));
    elements.superAdminTabAccess?.addEventListener("click", () => setSuperAdminTab("access"));
    elements.superAdminCreateOrgBtn?.addEventListener("click", onCreateSuperAdminOrganization);
    elements.superAdminUsersOrgFilter?.addEventListener("change", (event) => {
      state.superAdminUsersOrgFilter = String(event.target.value || "");
      renderSuperAdminUsers();
    });
    elements.superAdminStandingSourceSelect?.addEventListener("change", (event) => {
      state.superAdminStandingSourceFilter = String(event.target.value || "");
      state.superAdminStandingTargetFilters = [];
      renderSuperAdminAccess();
    });
    elements.superAdminCreateStandingAccessBtn?.addEventListener("click", onCreateStandingOrganizationAccess);
    bindIcs202Events();
    window.addEventListener("resize", scheduleMapResizeRefresh);
  }

  function initMap() {
    state.map = L.map("map", {
      zoomControl: true,
      preferCanvas: true,
      minZoom: 3,
      maxZoom: 19
    }).setView([39.5, -98.35], 4);
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
        maxZoom: 19,
        maxNativeZoom: 19,
        attribution: "Tiles &copy; Esri",
        crossOrigin: true,
        updateWhenIdle: true,
        keepBuffer: 4
      }),
      satellite: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        maxNativeZoom: 19,
        attribution: "Tiles &copy; Esri",
        crossOrigin: true,
        updateWhenIdle: true,
        keepBuffer: 4
      }),
      topo: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
        maxNativeZoom: 17,
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
    elements.commanderAuthBtn.disabled = !authReady || Boolean(state.commanderAuth?.accessToken);
    if (!authReady) {
      setStatus("Session owner auth needs Supabase public config.");
    }
    renderCommanderAuthPanels();
  }

  function resolveThemeMode(mode) {
    if (mode === "light") return "light";
    if (mode === "dark") return "dark";
    return themeMediaQuery?.matches ? "dark" : "light";
  }

  function applyThemeMode(mode, options = {}) {
    const normalized = (mode === "light" || mode === "dark" || mode === "auto") ? mode : "auto";
    const persist = options.persist !== false;
    const notify = options.notify === true;
    state.themeMode = normalized;
    const resolved = resolveThemeMode(normalized);
    document.body.dataset.theme = resolved;
    if (elements.themeModeSelect) elements.themeModeSelect.value = normalized;
    if (persist) {
      window.localStorage.setItem(STORAGE_KEYS.themeMode, normalized);
    }
    if (notify) {
      const label = normalized === "auto" ? `Auto (${resolved})` : resolved[0].toUpperCase() + resolved.slice(1);
      setStatus(`Theme: ${label}`);
    }
  }

  function loadThemeMode() {
    const saved = window.localStorage.getItem(STORAGE_KEYS.themeMode) || "auto";
    applyThemeMode(saved, { persist: false });
  }

  function setAuthTab(tab) {
    state.authTab = tab;
    elements.signInTabBtn.classList.toggle("active", tab === "signin");
    elements.signUpTabBtn.classList.toggle("active", tab === "signup");
    if (!state.commanderAuth?.accessToken) {
      elements.commanderAuthBtn.textContent = tab === "signin" ? "Sign In" : "Create Account";
    }
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
    return await parseSupabaseAuthResponse(response, { flow: "signin" });
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
    return await parseSupabaseAuthResponse(response, { flow: "signup" });
  }

  async function supabaseRequestPasswordReset(email) {
    const emailRedirectTo = getAuthRedirectUrl();
    const response = await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/recover`, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify({
        email,
        redirectTo: emailRedirectTo
      })
    });
    const payload = await parseJsonSafely(response);
    if (!response.ok) {
      const details =
        payload?.msg_description ||
        payload?.error_description ||
        payload?.error ||
        payload?.message ||
        `HTTP ${response.status}`;
      throw new Error(`Password reset request failed: ${details}`);
    }
    return payload;
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

  async function onForgotPassword() {
    if (!hasSupabaseAuthConfig()) {
      setStatus("Supabase auth is not configured for password reset.");
      return;
    }
    const email = elements.commanderEmailInput.value.trim();
    if (!email) {
      setStatus("Enter the email address first, then tap Forgot Password.");
      elements.commanderEmailInput.focus();
      return;
    }
    setStatus("Sending password reset email…");
    try {
      await supabaseRequestPasswordReset(email);
      setStatus("Check your email for a reset link.");
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function refreshCommanderSessions() {
    if (!state.commanderAuth?.accessToken) return;
    await refreshCommanderTokenIfNeeded();
    await loadSuperAdminContext();
    const orgContext = await loadOrganizationContext();
    if (!orgContext) {
      renderCommanderSessions([]);
      renderActiveSessionGallery([]);
      renderCommanderAuthPanels();
      return;
    }
    if (orgContext.isAdmin) {
      await refreshOrganizationAdminData();
    } else {
      state.organizationSummary = null;
    }
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
    renderCommanderAuthPanels();
  }

  async function loadSuperAdminContext() {
    if (!state.commanderAuth?.accessToken) {
      state.superAdminContext = null;
      state.superAdminData = { overview: null, organizations: [], users: [], access: [], standingAccess: [] };
      return null;
    }
    try {
      const result = await apiFetch("/v1/ics-collab/super-admin/context", { actorType: "commander" });
      state.superAdminContext = result?.profile || null;
      return state.superAdminContext;
    } catch (_error) {
      state.superAdminContext = null;
      state.superAdminData = { overview: null, organizations: [], users: [], access: [], standingAccess: [] };
      return null;
    }
  }

  async function loadOrganizationContext() {
    if (!state.commanderAuth?.accessToken) {
      state.organizationContext = null;
      state.organizationRoster = [];
      return null;
    }
    try {
      const result = await apiFetch("/v1/ics-collab/org/me", { actorType: "commander" });
      state.organizationContext = result?.membership || null;
      state.organizationRoster = Array.isArray(result?.roster) ? result.roster : [];
      return state.organizationContext;
    } catch (error) {
      state.organizationContext = {
        error: formatError(error),
        licenseStatus: "inactive",
        isActive: false
      };
      state.organizationRoster = [];
      state.organizationSummary = null;
      return null;
    }
  }

  async function refreshOrganizationAdminData() {
    if (!state.commanderAuth?.accessToken || !state.organizationContext?.isAdmin || !hasActiveOrganizationAccess()) {
      state.organizationSummary = null;
      return null;
    }
    const result = await apiFetch("/v1/ics-collab/admin/organization", { actorType: "commander" });
    state.organizationSummary = result?.organization || null;
    state.organizationRoster = Array.isArray(result?.roster) ? result.roster : [];
    return result;
  }

  async function refreshSuperAdminWorkspace(options = {}) {
    if (!state.commanderAuth?.accessToken || !state.superAdminContext?.email) {
      state.superAdminData = { overview: null, organizations: [], users: [], access: [], standingAccess: [] };
      return null;
    }
    try {
      const [overview, organizations, users, access, standingAccess] = await Promise.all([
        apiFetch("/v1/ics-collab/super-admin/overview", { actorType: "commander" }),
        apiFetch("/v1/ics-collab/super-admin/organizations", { actorType: "commander" }),
        apiFetch("/v1/ics-collab/super-admin/users", { actorType: "commander" }),
        apiFetch("/v1/ics-collab/super-admin/access", { actorType: "commander" }),
        apiFetch("/v1/ics-collab/super-admin/standing-access", { actorType: "commander" })
      ]);
      state.superAdminData = {
        overview: overview || null,
        organizations: Array.isArray(organizations) ? organizations : [],
        users: Array.isArray(users) ? users : [],
        access: Array.isArray(access) ? access : [],
        standingAccess: Array.isArray(standingAccess) ? standingAccess : []
      };
      renderSuperAdminWorkspace();
      if (options.notify) {
        setStatus("Super admin workspace refreshed.");
      }
      return state.superAdminData;
    } catch (error) {
      setStatus(formatError(error));
      return null;
    }
  }

  async function onAddOrganizationMember() {
    if (!state.organizationContext?.isAdmin || !hasActiveOrganizationAccess()) {
      setStatus("Department admin access is required.");
      return;
    }
    const displayName = elements.departmentAdminNameInput.value.trim();
    const email = elements.departmentAdminEmailInput.value.trim().toLowerCase();
    const isAdmin = Boolean(elements.departmentAdminIsAdminInput.checked);
    const isActive = Boolean(elements.departmentAdminIsActiveInput.checked);
    if (!displayName || !email) {
      setStatus("Enter the user name and email address.");
      return;
    }
    setStatus("Adding department user…");
    try {
      const result = await apiFetch("/v1/ics-collab/admin/organization/members", {
        method: "POST",
        actorType: "commander",
        body: { displayName, email, isAdmin, isActive }
      });
      state.organizationSummary = result?.organization || state.organizationSummary;
      state.organizationRoster = Array.isArray(result?.roster) ? result.roster : state.organizationRoster;
      elements.departmentAdminNameInput.value = "";
      elements.departmentAdminEmailInput.value = "";
      elements.departmentAdminIsAdminInput.checked = false;
      elements.departmentAdminIsActiveInput.checked = true;
      renderDepartmentAdminPanel();
      setStatus(`Added ${displayName} to ${state.organizationContext.organizationName}.`);
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function updateOrganizationMember(memberId, updates, successMessage) {
    if (!state.organizationContext?.isAdmin || !hasActiveOrganizationAccess()) {
      setStatus("Department admin access is required.");
      return;
    }
    try {
      const result = await apiFetch(`/v1/ics-collab/admin/organization/members/${encodeURIComponent(memberId)}`, {
        method: "PATCH",
        actorType: "commander",
        body: updates
      });
      state.organizationSummary = result?.organization || state.organizationSummary;
      state.organizationRoster = Array.isArray(result?.roster) ? result.roster : state.organizationRoster;
      renderDepartmentAdminPanel();
      setStatus(successMessage);
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function onCreateSuperAdminOrganization() {
    if (!state.superAdminContext?.email) {
      setStatus("Super admin access is required.");
      return;
    }
    const organizationName = elements.superAdminOrgNameInput?.value.trim();
    const countyName = elements.superAdminCountyNameInput?.value.trim();
    const seatLimit = elements.superAdminSeatLimitInput?.value.trim();
    const licenseStatus = elements.superAdminLicenseStatusSelect?.value || "active";
    const firstAdminName = elements.superAdminFirstAdminNameInput?.value.trim();
    const firstAdminEmail = elements.superAdminFirstAdminEmailInput?.value.trim().toLowerCase();
    if (!organizationName) {
      setStatus("Enter the department or station name.");
      return;
    }
    if ((firstAdminName && !firstAdminEmail) || (!firstAdminName && firstAdminEmail)) {
      setStatus("Enter both the first admin name and email, or leave both blank.");
      return;
    }
    setStatus("Creating department license…");
    try {
      await apiFetch("/v1/ics-collab/super-admin/organizations", {
        method: "POST",
        actorType: "commander",
        body: {
          organizationName,
          countyName: countyName || undefined,
          seatLimit: seatLimit || null,
          licenseStatus,
          firstAdminName: firstAdminName || undefined,
          firstAdminEmail: firstAdminEmail || undefined
        }
      });
      if (elements.superAdminOrgNameInput) elements.superAdminOrgNameInput.value = "";
      if (elements.superAdminCountyNameInput) elements.superAdminCountyNameInput.value = "";
      if (elements.superAdminSeatLimitInput) elements.superAdminSeatLimitInput.value = "";
      if (elements.superAdminLicenseStatusSelect) elements.superAdminLicenseStatusSelect.value = "active";
      if (elements.superAdminFirstAdminNameInput) elements.superAdminFirstAdminNameInput.value = "";
      if (elements.superAdminFirstAdminEmailInput) elements.superAdminFirstAdminEmailInput.value = "";
      await refreshSuperAdminWorkspace();
      setSuperAdminTab("organizations");
      setStatus(`${organizationName} is now provisioned.`);
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function updateSuperAdminOrganization(organizationId, payload, successMessage) {
    if (!state.superAdminContext?.email) {
      setStatus("Super admin access is required.");
      return;
    }
    try {
      await apiFetch(`/v1/ics-collab/super-admin/organizations/${encodeURIComponent(organizationId)}`, {
        method: "PATCH",
        actorType: "commander",
        body: payload
      });
      await refreshSuperAdminWorkspace();
      setStatus(successMessage);
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function addSuperAdminOrganizationMember(organizationId, payload, successMessage) {
    if (!state.superAdminContext?.email) {
      setStatus("Super admin access is required.");
      return;
    }
    try {
      await apiFetch(`/v1/ics-collab/super-admin/organizations/${encodeURIComponent(organizationId)}/members`, {
        method: "POST",
        actorType: "commander",
        body: payload
      });
      await refreshSuperAdminWorkspace();
      setStatus(successMessage);
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function updateSuperAdminUser(memberId, payload, successMessage) {
    if (!state.superAdminContext?.email) {
      setStatus("Super admin access is required.");
      return;
    }
    try {
      await apiFetch(`/v1/ics-collab/super-admin/users/${encodeURIComponent(memberId)}`, {
        method: "PATCH",
        actorType: "commander",
        body: payload
      });
      await refreshSuperAdminWorkspace();
      setStatus(successMessage);
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function onCreateStandingOrganizationAccess() {
    if (!state.superAdminContext?.email) {
      setStatus("Super admin access is required.");
      return;
    }
    const sourceOrganizationId = String(elements.superAdminStandingSourceSelect?.value || "").trim();
    const targetOrganizationIds = Array.from(new Set((state.superAdminStandingTargetFilters || []).map((value) => String(value).trim()).filter(Boolean)));
    if (!sourceOrganizationId || !targetOrganizationIds.length) {
      setStatus("Choose a source department and at least one target department.");
      return;
    }
    if (targetOrganizationIds.includes(sourceOrganizationId)) {
      setStatus("A department cannot grant standing access to itself.");
      return;
    }
    setStatus(`Granting standing access to ${targetOrganizationIds.length} department${targetOrganizationIds.length === 1 ? "" : "s"}…`);
    try {
      const targetLabels = new Map(
        (Array.isArray(state.superAdminData.organizations) ? state.superAdminData.organizations : []).map((organization) => [
          String(organization.id || ""),
          organization.organizationName || "Department"
        ])
      );
      let standingAccess = state.superAdminData.standingAccess;
      const grantedNames = [];
      for (const targetOrganizationId of targetOrganizationIds) {
        standingAccess = await apiFetch("/v1/ics-collab/super-admin/standing-access", {
          method: "POST",
          actorType: "commander",
          body: {
            sourceOrganizationId,
            targetOrganizationId
          }
        });
        grantedNames.push(targetLabels.get(targetOrganizationId) || "Department");
      }
      state.superAdminData.standingAccess = Array.isArray(standingAccess) ? standingAccess : state.superAdminData.standingAccess;
      state.superAdminStandingSourceFilter = "";
      state.superAdminStandingTargetFilters = [];
      renderSuperAdminAccess();
      setStatus(`Standing access granted to ${grantedNames.join(", ")}.`);
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  async function revokeStandingOrganizationAccess(sourceOrganizationId, targetOrganizationId, successMessage) {
    if (!state.superAdminContext?.email) {
      setStatus("Super admin access is required.");
      return;
    }
    try {
      await apiFetch(`/v1/ics-collab/super-admin/standing-access/${encodeURIComponent(sourceOrganizationId)}/${encodeURIComponent(targetOrganizationId)}`, {
        method: "DELETE",
        actorType: "commander"
      });
      state.superAdminData.standingAccess = (Array.isArray(state.superAdminData.standingAccess) ? state.superAdminData.standingAccess : []).filter((entry) => {
        return !(String(entry.sourceOrganizationId) === String(sourceOrganizationId) && String(entry.targetOrganizationId) === String(targetOrganizationId));
      });
      renderSuperAdminAccess();
      setStatus(successMessage);
    } catch (error) {
      setStatus(formatError(error));
    }
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
      if (isViewerAccessDisabledError(error)) {
        exitActiveWorkspace();
      }
      setStatus(formatError(error));
    }
  }

  async function onCreateSession() {
    if (!state.commanderAuth?.accessToken) {
      setStatus("Sign in as session owner before creating a session.");
      return;
    }
    if (!hasActiveOrganizationAccess()) {
      setStatus(state.organizationContext?.error || "Your account is not assigned to an active department license.");
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
    if (!hasActiveOrganizationAccess()) {
      setStatus(state.organizationContext?.error || "Your account is not assigned to an active department license.");
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
    clearWeatherPolling();
    stopPlaybackTimer();
    state.scenarioReview = null;
    state.activeSession = session;
    state.actor = actor;
    state.lastVersion = Number(session.currentVersion || 0);
    state.selectedObjectId = null;
    state.selectedTemplateType = null;
    state.drawState = null;
    state.qrPayload = state.qrPayload || JSON.stringify({ type: "ics_collab_join", joinCode: session.joinCode });
    state.ics202Open = false;
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
    resetPlaybackHistoryForSession(session.id);
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
          if (state.playbackMode) {
            state.lastVersion = Number(deltas.currentVersion || state.lastVersion);
            state.playbackSessionId = null;
            renderAfterActionControls();
            state.sessionRefreshNonce += 1;
            return;
          }
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
        renderCostSummary();
      } catch (error) {
        if (state.viewerMode && isViewerAccessDisabledError(error)) {
          exitActiveWorkspace();
          renderAll();
          setStatus("Viewer access has been turned off for this session.");
          return;
        }
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
    state.superAdminContext = null;
    state.superAdminData = { overview: null, organizations: [], users: [], access: [], standingAccess: [] };
    state.organizationContext = null;
    state.organizationRoster = [];
    state.organizationSummary = null;
    state.superAdminOpen = false;
    persistJSON(STORAGE_KEYS.commanderAuth, null);
    elements.createSessionPanel.classList.add("hidden");
    elements.sessionListPanel.classList.add("hidden");
    elements.activeSessionGalleryPanel.classList.add("hidden");
    elements.commanderSignOutBtn.classList.add("hidden");
    elements.sessionSignOutBtn.classList.add("hidden");
    state.ics202Open = false;
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
    stopPlaybackTimer();
    state.activeSession = null;
    state.scenarioReview = null;
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
    state.collapsedPaletteCategories = new Set();
    state.paletteCollapseInitialized = false;
    state.paletteSearchQuery = "";
    state.weatherPanelOpen = false;
    state.weatherLoading = false;
    state.weatherData = null;
    state.weatherError = "";
    state.weatherTargetSignature = "";
    state.weatherFetchNonce = 0;
    state.ics202Open = false;
    state.superAdminOpen = false;
    resetPlaybackHistoryForSession(null);
    cancelGeometryPreviewOnly();
    syncMapObjects();
    updateDrawControls();
    hideViewerQrModal();
    elements.landingView.classList.remove("hidden");
    elements.appView.classList.add("hidden");
    elements.superAdminWorkspace?.classList.add("hidden");
    elements.shell.classList.remove("viewer-mode");
    if (elements.paletteSearchInput) elements.paletteSearchInput.value = "";
    if (elements.scenarioFileInput) elements.scenarioFileInput.value = "";
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
    renderExportActions();
    renderIncidentFocusUI();
    renderIsolationToolUI();
    renderWeatherUI();
    renderSessionMeta();
    renderParticipants();
    renderPalettes();
    renderMapStyleTray();
    renderGuidedSteps();
    renderCostSummary();
    renderSelectedObject();
    updateDrawControls();
    renderGuidedControls();
    renderAfterActionControls();
    renderPanelCollapses();
    renderModePanelCollapses();
    renderRightSidebarState();
    renderIcs202Workspace();
    renderSuperAdminWorkspace();
  }

  function renderGuidedControls() {
    elements.guidedSetupToggle.checked = state.guidedMode;
    elements.guidedModeBtn.textContent = state.guidedMode ? "Hide IC Mode" : "10-Minute IC Mode";
    elements.quickFlowPanel.classList.toggle("collapsed", !state.guidedMode);
    elements.appView.classList.toggle("guided-collapsed", !state.guidedMode);
  }

  function isIsolationZoneObject(object) {
    return Boolean(object && (
      object.objectType === ISOLATION_ZONE_OBJECT_TYPE
      || object.objectType === PROTECTIVE_ACTION_ZONE_OBJECT_TYPE
      || object.fields?.isolationGroupId
    ));
  }

  function getIsolationGroupObjects(seedObject) {
    if (!seedObject || !isIsolationZoneObject(seedObject)) return [];
    const groupId = String(seedObject.fields?.isolationGroupId || "").trim();
    if (!groupId) return [seedObject];
    return Array.from(state.objects.values()).filter((object) => String(object.fields?.isolationGroupId || "").trim() === groupId);
  }

  function getIsolationEditContextFromSelection() {
    const selected = state.selectedObjectId ? state.objects.get(state.selectedObjectId) : null;
    if (!selected || !isIsolationZoneObject(selected)) return null;
    const groupObjects = getIsolationGroupObjects(selected);
    const initialObject = groupObjects.find((object) => object.objectType === ISOLATION_ZONE_OBJECT_TYPE) || selected;
    const protectiveObject = groupObjects.find((object) => object.objectType === PROTECTIVE_ACTION_ZONE_OBJECT_TYPE) || selected;
    const fields = selected.fields || initialObject.fields || protectiveObject.fields || {};
    const spillLat = Number(fields.spillLat);
    const spillLng = Number(fields.spillLng);
    return {
      groupId: String(fields.isolationGroupId || "").trim(),
      initialObjectId: initialObject?.id || "",
      protectiveObjectId: protectiveObject?.id || "",
      spillLatLng: Number.isFinite(spillLat) && Number.isFinite(spillLng)
        ? { lat: spillLat, lng: spillLng }
        : getObjectFocusPoint(initialObject),
      config: {
        unit: fields.distanceUnit === "m" ? "m" : "ft",
        initialMeters: Math.max(1, Number(fields.initialMeters || 0) || 0),
        evacMeters: Math.max(1, Number(fields.evacMeters || 0) || 0),
        windFrom: ((Number(fields.windFrom) || 270) % 360 + 360) % 360,
        useLiveWind: fields.useLiveWind !== false,
        manualOverride: Boolean(fields.manualOverride),
        lastWindUpdatedAt: String(fields.lastWindUpdatedAt || ""),
        windSource: String(fields.windSource || ""),
        ergSource: String(fields.ergSource || "manual"),
        ergMaterialName: String(fields.ergMaterialName || ""),
        ergUnNumber: String(fields.ergUnNumber || ""),
        ergGuideNumber: String(fields.ergGuideNumber || ""),
        ergSpillSize: String(fields.ergSpillSize || "small"),
        ergTimeOfDay: String(fields.ergTimeOfDay || "day"),
        ergTransportContainer: String(fields.ergTransportContainer || ""),
        ergWindBucket: String(fields.ergWindBucket || ""),
        ergWindBucketMode: String(fields.ergWindBucketMode || (fields.ergWindBucket ? fields.ergWindBucket : "auto"))
      }
    };
  }

  function renderIsolationToolUI() {
    if (!elements.isolationToolBtn) return;
    const available = (Boolean(state.activeSession) || isScenarioReviewMode()) && !state.viewerMode;
    const editContext = getIsolationEditContextFromSelection();
    elements.isolationToolBtn.disabled = !available || !canCreateObjects();
    elements.isolationToolBtn.textContent = editContext ? "Isolation Config" : "Isolation Tool";
  }

  function renderAfterActionControls() {
    if (!elements.afterActionPanel) return;
    const visible = (Boolean(state.activeSession) || isScenarioReviewMode()) && !state.viewerMode;
    elements.afterActionPanel.classList.toggle("hidden", !visible || !state.afterActionPanelVisible);
    elements.afterActionModeBtn.classList.toggle("hidden", !visible);
    if (!visible) return;

    const hasHistory = state.playbackEntries.length > 0;
    elements.afterActionModeBtn.textContent = state.playbackMode
      ? "Exit After-Action"
      : state.afterActionPanelVisible
        ? "Hide After-Action"
        : "After-Action Mode";
    elements.loadPlaybackBtn.disabled = state.playbackMode;
    elements.loadPlaybackBtn.textContent = sessionHasHistoryLoaded()
      ? (isScenarioReviewMode() ? "Replay Scenario" : "Replay Incident")
      : (isScenarioReviewMode() ? "Load Scenario Replay" : "Load Incident Replay");
    elements.exitPlaybackBtn.classList.toggle("hidden", !state.playbackMode);
    elements.exportTrainingScenarioBtn.disabled = !visible;
    elements.exportTrainingScenarioBtn.textContent = "Export Scenario";
    elements.editScenarioBtn.classList.toggle("hidden", !isScenarioReviewMode());
    elements.editScenarioBtn.disabled = scenarioReviewCanEdit();
    elements.editScenarioBtn.textContent = scenarioReviewCanEdit() ? "Scenario Editable" : "Edit Scenario";
    elements.playbackEmptyState.classList.toggle("hidden", hasHistory);
    elements.playbackControls.classList.toggle("hidden", !hasHistory);

    if (!hasHistory) {
      elements.playbackMeta.textContent = sessionHasHistoryLoaded()
        ? (isScenarioReviewMode() ? "This scenario has no recorded map history yet." : "This session has no recorded map history yet.")
        : (isScenarioReviewMode() ? "Load scenario history to begin playback." : "Load session history to begin playback.");
      return;
    }

    const maxIndex = Math.max(0, state.playbackEntries.length - 1);
    elements.playbackScrubber.max = String(maxIndex);
    elements.playbackScrubber.value = String(Math.max(0, Math.min(state.playbackIndex, maxIndex)));
    elements.playbackScrubber.disabled = maxIndex === 0;
    elements.playbackToggleBtn.textContent = state.playbackTimer ? "Pause" : "Play";
    elements.playbackStepBackBtn.disabled = state.playbackIndex <= 0;
    elements.playbackStepForwardBtn.disabled = state.playbackIndex >= maxIndex;
    elements.playbackRestartBtn.disabled = maxIndex === 0;
    elements.playbackSpeedSelect.value = String(state.playbackSpeedMs);
  }

  function sessionHasHistoryLoaded() {
    return state.playbackSessionId === (state.activeSession?.id || state.scenarioReview?.id);
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
    syncLandingSectionCollapse(elements.departmentAdminPanelBody, elements.departmentAdminPanelToggle, "departmentAdmin");
    syncLandingSectionCollapse(elements.createSessionPanelBody, elements.createSessionPanelToggle, "createSession");
    syncLandingSectionCollapse(elements.sessionListPanelBody, elements.sessionListPanelToggle, "reviewSessions");
    syncLandingSectionCollapse(elements.scenarioReviewPanelBody, elements.scenarioReviewPanelToggle, "reviewScenario");
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
    syncPanelCollapse(elements.incidentOverviewPanel, elements.incidentOverviewPanelToggle, "incidentOverview");
    syncPanelCollapse(elements.sessionPanel, elements.sessionPanelToggle, "session");
    syncPanelCollapse(elements.sessionPeriodPanel, elements.sessionPeriodPanelToggle, "sessionPeriod");
    syncPanelCollapse(elements.incidentCommandPanel, elements.incidentCommandPanelToggle, "incidentCommand");
    syncPanelCollapse(elements.participantsPanel, elements.participantsPanelToggle, "participants");
    syncPanelCollapse(elements.palettesPanel, elements.palettesPanelToggle, "palettes");
  }

  function renderModePanelCollapses() {
    syncModePanelCollapse(elements.quickFlowPanel, elements.quickFlowPanelBody, elements.quickFlowPanelToggle, "quickFlow");
    syncModePanelCollapse(elements.afterActionPanel, elements.afterActionPanelBody, elements.afterActionPanelToggle, "afterAction");
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

  function syncModePanelCollapse(panelElement, bodyElement, toggleElement, panelKey) {
    if (!panelElement || !bodyElement || !toggleElement) return;
    const collapsed = state.collapsedModePanels.has(panelKey);
    panelElement.classList.toggle("section-collapsed", collapsed);
    bodyElement.classList.toggle("hidden", collapsed);
    toggleElement.setAttribute("aria-expanded", String(!collapsed));
    const symbol = toggleElement.querySelector(".toggle-symbol");
    if (symbol) {
      symbol.textContent = collapsed ? "+" : "\u2212";
    }
  }

  function hasActiveOrganizationAccess() {
    return Boolean(
      state.organizationContext
      && state.organizationContext.isActive !== false
      && state.organizationContext.licenseStatus === "active"
      && !state.organizationContext.error
    );
  }

  function renderCommanderAuthPanels() {
    const signedIn = Boolean(state.commanderAuth?.accessToken);
    const authReady = hasSupabaseAuthConfig();
    const licensed = hasActiveOrganizationAccess();
    const orgAdmin = Boolean(state.organizationContext?.isAdmin && licensed);
    const superAdmin = Boolean(state.superAdminContext?.email);
    elements.commanderSignedInSummary.classList.toggle("hidden", !signedIn);
    elements.authFields.classList.toggle("hidden", signedIn);
    if (signedIn) {
      elements.commanderSummaryName.textContent = `Session Owner: ${state.commanderAuth?.displayName || "Signed in"}`;
      const summaryParts = [state.commanderAuth?.email || ""];
      if (state.organizationContext?.organizationName) {
        summaryParts.push(state.organizationContext.organizationName);
      }
      if (state.organizationContext?.countyName) {
        summaryParts.push(state.organizationContext.countyName);
      }
      if (state.organizationContext?.error) {
        summaryParts.push(state.organizationContext.error);
      }
      elements.commanderSummaryEmail.textContent = summaryParts.filter(Boolean).join(" · ");
    }
    elements.commanderAuthBtn.textContent = signedIn ? "Signed In" : (state.authTab === "signin" ? "Sign In" : "Create Account");
    elements.commanderAuthBtn.disabled = signedIn || !authReady;
    elements.commanderSignOutBtn.disabled = !signedIn;
    elements.forgotPasswordRow?.classList.toggle("hidden", signedIn || state.authTab !== "signin");
    if (elements.forgotPasswordBtn) {
      elements.forgotPasswordBtn.disabled = !authReady;
    }
    elements.superAdminWorkspaceBtn?.classList.toggle("hidden", !signedIn || !superAdmin || Boolean(state.activeSession) || isScenarioReviewMode() || state.viewerMode || state.ics202Open || state.superAdminOpen);
    elements.departmentAdminPanel.classList.toggle("hidden", !orgAdmin);
    elements.createSessionPanel.classList.toggle("hidden", false);
    elements.createSessionPanel.classList.toggle("locked", !signedIn || !licensed);
    elements.createSessionLockedNote.classList.toggle("hidden", signedIn && licensed);
    if (elements.createSessionLockedNote) {
      elements.createSessionLockedNote.textContent = !signedIn
        ? "Sign in first to unlock session creation."
        : (state.organizationContext?.error || "Your account is not assigned to an active department license.");
    }
    elements.sessionListPanel.classList.toggle("hidden", !signedIn || !licensed);
    elements.scenarioReviewPanel.classList.toggle("hidden", !signedIn || !licensed);
    elements.activeSessionGalleryPanel.classList.toggle("hidden", !signedIn || !licensed);
    elements.commanderSignOutBtn.classList.toggle("hidden", !signedIn);
    elements.sessionSignOutBtn.classList.toggle("hidden", !signedIn || (!state.activeSession && !isScenarioReviewMode()));
    elements.closeScenarioReviewBtn.classList.toggle("hidden", !isScenarioReviewMode());
    elements.leaveSessionBtn.classList.toggle("hidden", !state.activeSession || isScenarioReviewMode());
    elements.ics202WorkspaceBtn.classList.toggle("hidden", (!(state.activeSession || isScenarioReviewMode()) || state.viewerMode));
    elements.isolationToolBtn.classList.toggle("hidden", !(Boolean(state.activeSession) || isScenarioReviewMode()) || state.viewerMode);
    elements.setIncidentFocusBtn.classList.toggle("hidden", !state.activeSession || isScenarioReviewMode() || !isCommander() || Boolean(getIncidentFocusPoint()));
    elements.centerIncidentBtn.classList.toggle("hidden", !(state.activeSession || isScenarioReviewMode()));
    const viewerQrAllowed = canShareViewerQr() && isViewerAccessEnabled();
    const viewerToggleVisible = canToggleViewerAccess();
    elements.showViewerQrBtn.classList.toggle("hidden", !viewerQrAllowed || !state.activeSession || state.viewerMode || isScenarioReviewMode());
    elements.toggleViewerAccessBtn.classList.toggle("hidden", !viewerToggleVisible || !state.activeSession || state.viewerMode || isScenarioReviewMode());
    elements.toggleViewerAccessBtn.textContent = isViewerAccessEnabled() ? "Disable Viewer Access" : "Enable Viewer Access";
    elements.joinLockedNote.classList.toggle("hidden", signedIn && licensed);
    if (elements.joinLockedNote) {
      elements.joinLockedNote.textContent = !signedIn
        ? "Sign in with an account first, then join with the session code."
        : (state.organizationContext?.error || "Your account is not assigned to an active department license.");
    }
    renderDepartmentAdminPanel();
    toggleLandingCardAccess(signedIn && licensed);
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
      elements.viewerCenterIncidentBtn.classList.toggle("hidden", !state.viewerMode || !state.activeSession || isScenarioReviewMode());
      elements.viewerCenterIncidentBtn.disabled = !focusSet && state.layers.size === 0 && !state.currentLocation;
      elements.viewerCenterIncidentBtn.setAttribute("aria-label", focusSet ? "Center on incident" : "Center map");
      elements.viewerCenterIncidentBtn.title = focusSet ? "Center on Incident" : "Center Map";
    }
    if (elements.setIncidentFocusBtn) {
      elements.setIncidentFocusBtn.disabled = !canCreateObjects();
    }
    if (elements.sessionFocusPrompt) {
      const showPrompt = Boolean(state.activeSession) && !isScenarioReviewMode() && isCommander() && !focusSet;
      elements.sessionFocusPrompt.classList.toggle("hidden", !showPrompt);
      elements.sessionFocusPrompt.textContent = showPrompt
        ? "Set initial hazard/focus location by placing a Hazard Source. This helps everyone join centered on the incident."
        : "";
    }
  }

  function renderCreateSessionFocusVisibility() {
    if (!elements.createSessionFocusBlock || !elements.guidedSetupDefaultInput) return;
    elements.createSessionFocusBlock.classList.toggle("hidden", !elements.guidedSetupDefaultInput.checked);
  }

  function toggleWeatherPanel() {
    if (!state.activeSession && !isScenarioReviewMode()) return;
    state.weatherPanelOpen = !state.weatherPanelOpen;
    renderWeatherUI();
    if (state.weatherPanelOpen) {
      void refreshWeatherForCurrentTarget({ force: false, silent: true });
    }
  }

  function renderWeatherUI() {
    if (!elements.weatherLauncherBtn || !elements.weatherPanel) return;
    const visible = Boolean(state.activeSession) || isScenarioReviewMode();
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

  function normalizeErgLookupKey(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function populateErgMaterialOptions() {
    if (!elements.isolationErgMaterialList) return;
    elements.isolationErgMaterialList.innerHTML = "";
    state.ergCatalog.materials.forEach((material) => {
      const option = document.createElement("option");
      option.value = getErgMaterialDisplayValue(material);
      elements.isolationErgMaterialList.appendChild(option);
    });
  }

  function getErgMaterialDisplayValue(material) {
    return `${material.displayName} (UN${material.unNumber})`;
  }

  function convertDistanceToMeters(value, unit) {
    const numeric = Math.max(0, Number(value) || 0);
    return unit === "ft" ? numeric * 0.3048 : numeric;
  }

  function convertMetersToDistance(valueMeters, unit) {
    const numeric = Math.max(0, Number(valueMeters) || 0);
    return unit === "ft" ? numeric / 0.3048 : numeric;
  }

  function formatErgDistance(valueMeters, unit = "ft") {
    const value = convertMetersToDistance(valueMeters, unit);
    return `${Math.round(value)} ${unit}`;
  }

  function resolveErgWindBucketFromMph(value) {
    const mph = Number(value);
    if (!Number.isFinite(mph)) return "";
    if (mph < 6) return "low";
    if (mph < 12) return "moderate";
    return "high";
  }

  function formatErgWindBucketLabel(value) {
    if (value === "low") return "Low";
    if (value === "moderate") return "Moderate";
    if (value === "high") return "High";
    return "Auto";
  }

  function resolveErgMaterialFromInput(value) {
    const key = normalizeErgLookupKey(value);
    if (!key) return null;
    return state.ergCatalog.lookup.get(key) || null;
  }

  function getSelectedErgMaterial() {
    return resolveErgMaterialFromInput(elements.isolationErgMaterialInput?.value);
  }

  function findErgMaterialMatches(query) {
    const key = normalizeErgLookupKey(query);
    if (!key) return [];
    return state.ergCatalog.materials.filter((material) => {
      const haystacks = [
        material.displayName,
        ...(material.materialNames || []),
        material.unNumber,
        material.unNumber ? `un${material.unNumber}` : "",
        getErgMaterialDisplayValue(material)
      ];
      return haystacks.some((value) => normalizeErgLookupKey(value).includes(key));
    }).slice(0, 8);
  }

  function hideIsolationErgSuggestions() {
    if (!elements.isolationErgSuggestions) return;
    elements.isolationErgSuggestions.innerHTML = "";
    elements.isolationErgSuggestions.classList.add("hidden");
  }

  function applyErgMaterialSelection(material) {
    if (!material || !elements.isolationErgMaterialInput) return;
    elements.isolationErgMaterialInput.value = getErgMaterialDisplayValue(material);
    hideIsolationErgSuggestions();
    renderIsolationErgControls({ autofill: true });
  }

  function renderIsolationErgSuggestions(query = elements.isolationErgMaterialInput?.value || "") {
    if (!elements.isolationErgSuggestions) return;
    const matches = findErgMaterialMatches(query);
    if (!matches.length || !query.trim()) {
      hideIsolationErgSuggestions();
      return;
    }
    elements.isolationErgSuggestions.innerHTML = "";
    matches.forEach((material) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "isolation-suggestion";
      button.setAttribute("role", "option");
      const aliases = (material.materialNames || []).filter((name) => name !== material.displayName).slice(0, 2);
      button.innerHTML = `<strong>${escapeHtml(material.displayName)}</strong><span>UN${escapeHtml(material.unNumber)}${aliases.length ? ` · ${escapeHtml(aliases.join(", "))}` : ""}</span>`;
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        applyErgMaterialSelection(material);
      });
      elements.isolationErgSuggestions.appendChild(button);
    });
    elements.isolationErgSuggestions.classList.remove("hidden");
  }

  function getCurrentIsolationUnit() {
    return elements.distanceUnitSelect?.value === "m" ? "m" : "ft";
  }

  function setIsolationDistanceInputs(initialMeters, evacMeters, unit = getCurrentIsolationUnit()) {
    if (elements.isolationDistanceInput) {
      elements.isolationDistanceInput.value = String(Math.round(convertMetersToDistance(initialMeters, unit)));
    }
    if (elements.evacuationDistanceInput) {
      elements.evacuationDistanceInput.value = String(Math.round(convertMetersToDistance(evacMeters, unit)));
    }
  }

  function getIsolationWeatherMphForAuto() {
    const mph = Number(state.weatherData?.windSpeedMph);
    return Number.isFinite(mph) ? mph : null;
  }

  function resolveErgAutoDistances(material, options = {}) {
    if (!material) {
      return { mode: "manual", error: "", material: null };
    }
    const spillSize = options.spillSize === "large" ? "large" : "small";
    const timeOfDay = options.timeOfDay === "night" ? "night" : "day";
    const selectedContainer = String(options.transportContainer || "").trim();
    const windBucketMode = options.windBucketMode || "auto";
    if (spillSize === "small") {
      if (!material.smallSpill?.initialIsolationMeters || !material.smallSpill?.protectiveAction?.[`${timeOfDay}Meters`]) {
        return { mode: "erg", material, error: "This ERG entry does not include small-spill distances." };
      }
      return {
        mode: "erg",
        material,
        spillSize,
        timeOfDay,
        initialMeters: Number(material.smallSpill.initialIsolationMeters),
        evacMeters: Number(material.smallSpill.protectiveAction[`${timeOfDay}Meters`]),
        windBucket: "",
        transportContainer: "",
        windBucketMode
      };
    }
    if (Array.isArray(material.largeSpillOptions) && material.largeSpillOptions.length) {
      const option = material.largeSpillOptions.find((item) => item.transportContainer === selectedContainer) || material.largeSpillOptions[0];
      const weatherBucket = resolveErgWindBucketFromMph(options.weatherMph);
      const windBucket = windBucketMode === "auto" ? weatherBucket : windBucketMode;
      if (!windBucket || !ERG_WIND_BUCKETS.includes(windBucket)) {
        return {
          mode: "erg",
          material,
          spillSize,
          timeOfDay,
          transportContainer: option?.transportContainer || "",
          windBucket: "",
          windBucketMode,
          error: "Select a wind bucket for this large-spill ERG entry."
        };
      }
      return {
        mode: "erg",
        material,
        spillSize,
        timeOfDay,
        transportContainer: option.transportContainer,
        windBucket,
        windBucketMode,
        initialMeters: Number(option.initialIsolationMeters),
        evacMeters: Number(option.protectiveAction?.[timeOfDay]?.[`${windBucket}Meters`])
      };
    }
    if (!material.largeSpill?.initialIsolationMeters || !material.largeSpill?.protectiveAction?.[`${timeOfDay}Meters`]) {
      return { mode: "erg", material, spillSize, timeOfDay, error: "This ERG entry does not include large-spill distances." };
    }
    return {
      mode: "erg",
      material,
      spillSize,
      timeOfDay,
      transportContainer: "",
      windBucket: "",
      windBucketMode,
      initialMeters: Number(material.largeSpill.initialIsolationMeters),
      evacMeters: Number(material.largeSpill.protectiveAction[`${timeOfDay}Meters`])
    };
  }

  function destinationPoint(lat, lng, bearingDeg, distanceMeters) {
    const R = 6371000;
    const lat1 = (Number(lat) * Math.PI) / 180;
    const lng1 = (Number(lng) * Math.PI) / 180;
    const d = Number(distanceMeters) / R;
    const brng = (Number(bearingDeg) * Math.PI) / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return {
      lat: roundCoord((lat2 * 180) / Math.PI),
      lng: roundCoord((((lng2 * 180) / Math.PI) + 540) % 360 - 180)
    };
  }

  function buildCirclePolygonPoints(center, radiusMeters, segments = 36) {
    const points = [];
    for (let step = 0; step < segments; step += 1) {
      points.push(destinationPoint(center.lat, center.lng, (step / segments) * 360, radiusMeters));
    }
    return points;
  }

  function buildProtectiveActionPolygonPoints(center, windFrom, evacMeters, initialMeters = 0) {
    const downwind = (Number(windFrom) + 180) % 360;
    const crosswindHalfWidth = Math.max(evacMeters / 2, initialMeters, 1);
    const arcCenter = destinationPoint(center.lat, center.lng, downwind, evacMeters);
    const points = [{ lat: roundCoord(center.lat), lng: roundCoord(center.lng) }];
    const arcSteps = 10;
    for (let step = 0; step <= arcSteps; step += 1) {
      const offset = 90 - (180 * (step / arcSteps));
      points.push(destinationPoint(arcCenter.lat, arcCenter.lng, downwind + offset, crosswindHalfWidth));
    }
    return points;
  }

  function buildIsolationZoneFields(role, groupId, spillLatLng, config) {
    return {
      isolationGroupId: groupId,
      isolationRole: role,
      distanceUnit: config.unit,
      initialMeters: round2(config.initialMeters),
      evacMeters: round2(config.evacMeters),
      windFrom: round2(config.windFrom),
      useLiveWind: Boolean(config.useLiveWind),
      manualOverride: Boolean(config.manualOverride),
      lastWindUpdatedAt: config.lastWindUpdatedAt || "",
      windSource: config.windSource || (config.useLiveWind && !config.manualOverride ? "live" : "manual"),
      spillLat: roundCoord(spillLatLng.lat),
      spillLng: roundCoord(spillLatLng.lng),
      ergSource: config.ergSource || "manual",
      ergMaterialName: config.ergMaterialName || "",
      ergUnNumber: config.ergUnNumber || "",
      ergGuideNumber: config.ergGuideNumber || "",
      ergSpillSize: config.ergSpillSize || "",
      ergTimeOfDay: config.ergTimeOfDay || "",
      ergTransportContainer: config.ergTransportContainer || "",
      ergWindBucket: config.ergWindBucket || "",
      ergWindBucketMode: config.ergWindBucketMode || ""
    };
  }

  function populateIsolationTransportContainerOptions(options, selectedValue = "") {
    if (!elements.isolationTransportContainerSelect) return;
    elements.isolationTransportContainerSelect.innerHTML = "";
    options.forEach((option) => {
      const optionEl = document.createElement("option");
      optionEl.value = option.transportContainer;
      optionEl.textContent = option.transportContainer;
      elements.isolationTransportContainerSelect.appendChild(optionEl);
    });
    if (options.length) {
      elements.isolationTransportContainerSelect.value = options.some((option) => option.transportContainer === selectedValue)
        ? selectedValue
        : options[0].transportContainer;
    }
  }

  function renderIsolationErgControls({ autofill = true } = {}) {
    const material = getSelectedErgMaterial();
    const spillSize = elements.isolationSpillSizeSelect?.value === "large" ? "large" : "small";
    const timeOfDay = elements.isolationTimeOfDaySelect?.value === "night" ? "night" : "day";
    const weatherMph = getIsolationWeatherMphForAuto();
    const containerOptions = Array.isArray(material?.largeSpillOptions) ? material.largeSpillOptions : [];
    const needsContainer = Boolean(material && spillSize === "large" && containerOptions.length);
    if (elements.isolationTransportContainerField) {
      elements.isolationTransportContainerField.classList.toggle("hidden", !needsContainer);
    }
    if (needsContainer) {
      populateIsolationTransportContainerOptions(containerOptions, elements.isolationTransportContainerSelect?.value || state.isolationEditContext?.config?.ergTransportContainer || "");
    }
    const showWindBucket = needsContainer;
    if (elements.isolationWindBucketField) {
      elements.isolationWindBucketField.classList.toggle("hidden", !showWindBucket);
    }
    const windBucketMode = showWindBucket
      ? (ERG_WIND_BUCKETS.includes(elements.isolationWindBucketSelect?.value) ? elements.isolationWindBucketSelect.value : "auto")
      : "";
    const resolved = resolveErgAutoDistances(material, {
      spillSize,
      timeOfDay,
      transportContainer: elements.isolationTransportContainerSelect?.value || "",
      windBucketMode,
      weatherMph
    });
    if (autofill && resolved.initialMeters > 0 && resolved.evacMeters > 0) {
      setIsolationDistanceInputs(resolved.initialMeters, resolved.evacMeters, getCurrentIsolationUnit());
    }
    if (!elements.isolationErgHint) return;
    if (!material) {
      elements.isolationErgHint.textContent = "Leave the ERG material blank to enter isolation distances manually.";
      return;
    }
    if (resolved.error) {
      elements.isolationErgHint.textContent = resolved.error;
      return;
    }
    const bits = [
      `${material.displayName} · Guide ${material.guideNumber || "N/A"} · UN${material.unNumber}`
    ];
    if (spillSize === "large" && resolved.transportContainer) {
      bits.push(resolved.transportContainer);
    }
    bits.push(`${timeOfDay === "night" ? "Night" : "Day"} distances`);
    bits.push(`Isolation ${formatErgDistance(resolved.initialMeters, getCurrentIsolationUnit())}`);
    bits.push(`Protective ${formatErgDistance(resolved.evacMeters, getCurrentIsolationUnit())}`);
    if (spillSize === "large" && resolved.windBucket) {
      bits.push(`Wind ${formatErgWindBucketLabel(resolved.windBucket)}${weatherMph != null && windBucketMode === "auto" ? ` (${Math.round(weatherMph)} mph)` : ""}`);
    }
    elements.isolationErgHint.textContent = bits.join(" · ");
  }

  function renderIsolationWindControls() {
    if (!elements.isolationManualWindField || !elements.isolationUseLiveWindToggle || !elements.isolationManualOverrideToggle || !elements.isolationWindHint) {
      return;
    }
    const useLiveWind = Boolean(elements.isolationUseLiveWindToggle.checked);
    const manualOverride = Boolean(elements.isolationManualOverrideToggle.checked);
    const manualEnabled = !useLiveWind || manualOverride;
    elements.isolationManualWindField.classList.toggle("hidden", !manualEnabled);
    elements.windDirectionInput.disabled = !manualEnabled;
    if (elements.startIsolationPlacementBtn) {
      elements.startIsolationPlacementBtn.textContent = state.isolationEditContext
        ? (useLiveWind && !manualOverride ? "Refresh Wind / Update Zone" : "Update Selected Zones")
        : "Place on Map";
    }
    const lastWindUpdatedAt = state.isolationEditContext?.config?.lastWindUpdatedAt || "";
    const updateNote = lastWindUpdatedAt ? ` Last wind update: ${formatDateTime(lastWindUpdatedAt)}.` : "";
    elements.isolationWindHint.textContent = useLiveWind && !manualOverride
      ? `0 = from North, 90 = from East. Zone extends downwind away from the spill. Live wind will be fetched from the spill point after placement.${updateNote}`
      : `0 = from North, 90 = from East. Zone extends downwind away from the spill.${updateNote}`;
  }

  async function fetchWeatherSnapshotForLatLng(latlng) {
    const response = await fetch(buildWeatherUrl({
      lat: latlng.lat,
      lng: latlng.lng,
      label: "Spill Point",
      sourceLabel: "spill point"
    }), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Weather request failed (${response.status})`);
    }
    const payload = await response.json();
    const current = payload?.current;
    const windDirection = Number(current?.wind_direction_10m);
    const windSpeedMph = Number(current?.wind_speed_10m);
    if (!Number.isFinite(windDirection)) {
      throw new Error("Weather service returned no wind direction.");
    }
    return {
      windDirection: ((windDirection % 360) + 360) % 360,
      windSpeedMph: Number.isFinite(windSpeedMph) ? windSpeedMph : null,
      updatedAt: current?.time || new Date().toISOString()
    };
  }

  async function fetchWindDirectionForLatLng(latlng) {
    const snapshot = await fetchWeatherSnapshotForLatLng(latlng);
    return snapshot.windDirection;
  }

  function getIsolationConfigFromModal() {
    const unit = getCurrentIsolationUnit();
    const initialMeters = convertDistanceToMeters(elements.isolationDistanceInput.value, unit);
    const evacMeters = convertDistanceToMeters(elements.evacuationDistanceInput.value, unit);
    const useLiveWind = Boolean(elements.isolationUseLiveWindToggle?.checked);
    const manualOverride = Boolean(elements.isolationManualOverrideToggle?.checked);
    const windFrom = ((Number(elements.windDirectionInput.value) || 270) % 360 + 360) % 360;
    const material = getSelectedErgMaterial();
    const spillSize = elements.isolationSpillSizeSelect?.value === "large" ? "large" : "small";
    const timeOfDay = elements.isolationTimeOfDaySelect?.value === "night" ? "night" : "day";
    const windBucketMode = ERG_WIND_BUCKETS.includes(elements.isolationWindBucketSelect?.value) ? elements.isolationWindBucketSelect.value : "auto";
    const ergResolved = resolveErgAutoDistances(material, {
      spillSize,
      timeOfDay,
      transportContainer: elements.isolationTransportContainerSelect?.value || "",
      windBucketMode,
      weatherMph: getIsolationWeatherMphForAuto()
    });
    return {
      unit,
      initialMeters,
      evacMeters,
      windFrom,
      useLiveWind,
      manualOverride,
      lastWindUpdatedAt: state.isolationEditContext?.config?.lastWindUpdatedAt || "",
      windSource: state.isolationEditContext?.config?.windSource || "",
      ergSource: material ? "erg" : "manual",
      ergMaterialName: material?.displayName || "",
      ergUnNumber: material?.unNumber || "",
      ergGuideNumber: material?.guideNumber || "",
      ergSpillSize: material ? spillSize : "",
      ergTimeOfDay: material ? timeOfDay : "",
      ergTransportContainer: material ? (ergResolved.transportContainer || elements.isolationTransportContainerSelect?.value || "") : "",
      ergWindBucket: material ? (ergResolved.windBucket || "") : "",
      ergWindBucketMode: material ? windBucketMode : "",
      ergResolved
    };
  }

  async function resolveIsolationPlacementConfig(config, spillLatLng) {
    let resolvedConfig = { ...config };
    let weatherSnapshot = null;
    const needsErgWeatherBucket = config.ergSource === "erg"
      && config.ergSpillSize === "large"
      && config.ergWindBucketMode === "auto"
      && Boolean(config.ergMaterialName);
    if ((config.useLiveWind && !config.manualOverride) || needsErgWeatherBucket) {
      try {
        weatherSnapshot = await fetchWeatherSnapshotForLatLng(spillLatLng);
      } catch (error) {
        if (needsErgWeatherBucket && !Number.isFinite(getIsolationWeatherMphForAuto())) {
          throw new Error(`Live weather unavailable at the spill point. Choose a wind bucket manually. ${formatError(error)}`);
        }
        if (config.useLiveWind && !config.manualOverride) {
          setStatus(`Live wind unavailable. Using manual wind setting. ${formatError(error)}`);
        }
      }
    }
    if (config.ergSource === "erg") {
      const material = resolveErgMaterialFromInput(config.ergMaterialName || config.ergUnNumber);
      const ergResolved = resolveErgAutoDistances(material, {
        spillSize: config.ergSpillSize,
        timeOfDay: config.ergTimeOfDay,
        transportContainer: config.ergTransportContainer,
        windBucketMode: config.ergWindBucketMode || "auto",
        weatherMph: weatherSnapshot?.windSpeedMph ?? getIsolationWeatherMphForAuto()
      });
      if (ergResolved.error) {
        throw new Error(ergResolved.error);
      }
      resolvedConfig = {
        ...resolvedConfig,
        initialMeters: ergResolved.initialMeters,
        evacMeters: ergResolved.evacMeters,
        ergMaterialName: material?.displayName || config.ergMaterialName || "",
        ergUnNumber: material?.unNumber || config.ergUnNumber || "",
        ergGuideNumber: material?.guideNumber || config.ergGuideNumber || "",
        ergTransportContainer: ergResolved.transportContainer || config.ergTransportContainer || "",
        ergWindBucket: ergResolved.windBucket || "",
        ergWindBucketMode: config.ergWindBucketMode || ""
      };
    }
    if (config.useLiveWind && !config.manualOverride && weatherSnapshot?.windDirection != null) {
      resolvedConfig = {
        ...resolvedConfig,
        windFrom: weatherSnapshot.windDirection,
        lastWindUpdatedAt: weatherSnapshot.updatedAt || new Date().toISOString(),
        windSource: "live"
      };
    } else if (!config.useLiveWind || config.manualOverride) {
      resolvedConfig = {
        ...resolvedConfig,
        lastWindUpdatedAt: config.lastWindUpdatedAt || new Date().toISOString(),
        windSource: "manual"
      };
    }
    return resolvedConfig;
  }

  function openIsolationToolModal() {
    if (!canCreateObjects()) {
      setStatus("Only active editors can use the Isolation Tool.");
      return;
    }
    const pendingConfig = state.pendingIsolationConfig;
    state.pendingIsolationConfig = null;
    state.isolationEditContext = getIsolationEditContextFromSelection();
    const activeConfig = state.isolationEditContext?.config || pendingConfig || {
      unit: elements.distanceUnitSelect?.value === "m" ? "m" : "ft",
      initialMeters: convertDistanceToMeters(elements.isolationDistanceInput?.value || 100, elements.distanceUnitSelect?.value || "ft"),
      evacMeters: convertDistanceToMeters(elements.evacuationDistanceInput?.value || 300, elements.distanceUnitSelect?.value || "ft"),
      windFrom: ((Number(elements.windDirectionInput?.value) || 270) % 360 + 360) % 360,
      useLiveWind: true,
      manualOverride: false,
      lastWindUpdatedAt: "",
      windSource: "",
      ergSource: "manual",
      ergMaterialName: "",
      ergUnNumber: "",
      ergGuideNumber: "",
      ergSpillSize: "small",
      ergTimeOfDay: "day",
      ergTransportContainer: "",
      ergWindBucket: "",
      ergWindBucketMode: "auto"
    };
    elements.distanceUnitSelect.value = activeConfig.unit;
    elements.isolationDistanceInput.value = String(Math.round(convertMetersToDistance(activeConfig.initialMeters, activeConfig.unit)));
    elements.evacuationDistanceInput.value = String(Math.round(convertMetersToDistance(activeConfig.evacMeters, activeConfig.unit)));
    elements.windDirectionInput.value = String(Math.round(activeConfig.windFrom));
    if (elements.isolationErgMaterialInput) {
      elements.isolationErgMaterialInput.value = activeConfig.ergMaterialName
        ? activeConfig.ergUnNumber ? getErgMaterialDisplayValue({ displayName: activeConfig.ergMaterialName, unNumber: activeConfig.ergUnNumber }) : activeConfig.ergMaterialName
        : "";
    }
    if (elements.isolationSpillSizeSelect) elements.isolationSpillSizeSelect.value = activeConfig.ergSpillSize === "large" ? "large" : "small";
    if (elements.isolationTimeOfDaySelect) elements.isolationTimeOfDaySelect.value = activeConfig.ergTimeOfDay === "night" ? "night" : "day";
    if (elements.isolationWindBucketSelect) {
      elements.isolationWindBucketSelect.value = ERG_WIND_BUCKETS.includes(activeConfig.ergWindBucketMode)
        ? activeConfig.ergWindBucketMode
        : "auto";
    }
    if (elements.isolationUseLiveWindToggle) elements.isolationUseLiveWindToggle.checked = activeConfig.useLiveWind !== false;
    if (elements.isolationManualOverrideToggle) elements.isolationManualOverrideToggle.checked = Boolean(activeConfig.manualOverride);
    renderIsolationErgControls({ autofill: Boolean(activeConfig.ergSource === "erg") });
    if (activeConfig.ergTransportContainer && elements.isolationTransportContainerSelect) {
      elements.isolationTransportContainerSelect.value = activeConfig.ergTransportContainer;
      renderIsolationErgControls({ autofill: Boolean(activeConfig.ergSource === "erg") });
    }
    renderIsolationWindControls();
    hideIsolationErgSuggestions();
    elements.isolationToolModal.classList.remove("hidden");
  }

  function closeIsolationToolModal() {
    hideIsolationErgSuggestions();
    elements.isolationToolModal.classList.add("hidden");
    elements.startIsolationPlacementBtn.textContent = "Place on Map";
  }

  async function beginIsolationPlacementFlow() {
    if (!canCreateObjects()) {
      setStatus("Only active editors can use the Isolation Tool.");
      return;
    }
    const config = getIsolationConfigFromModal();
    const { unit, initialMeters, evacMeters, useLiveWind, manualOverride, windFrom, ergResolved } = config;
    if (initialMeters <= 0 || evacMeters <= 0) {
      setStatus("Isolation and evacuation distances must be greater than zero.");
      return;
    }
    if (config.ergSource === "erg" && ergResolved?.error) {
      setStatus(ergResolved.error);
      return;
    }
    if (state.isolationEditContext?.spillLatLng) {
      if (config.useLiveWind && !config.manualOverride) {
        try {
          const resolvedConfig = await resolveIsolationPlacementConfig(config, state.isolationEditContext.spillLatLng);
          void placeIsolationZonesAt(state.isolationEditContext.spillLatLng, resolvedConfig, state.isolationEditContext);
          closeIsolationToolModal();
          state.isolationEditContext = null;
          return;
        } catch (error) {
          setStatus(formatError(error));
          return;
        }
      }
      let resolvedConfig;
      try {
        resolvedConfig = await resolveIsolationPlacementConfig(config, state.isolationEditContext.spillLatLng);
      } catch (error) {
        setStatus(formatError(error));
        return;
      }
      void placeIsolationZonesAt(state.isolationEditContext.spillLatLng, resolvedConfig, state.isolationEditContext);
      closeIsolationToolModal();
      state.isolationEditContext = null;
      return;
    }
    state.pendingIsolationConfig = config;
    state.isolationEditContext = null;
    closeIsolationToolModal();
    setStatus(config.useLiveWind && !config.manualOverride
      ? "Isolation tool armed. Tap the spill point on the map. Live wind will be fetched there."
      : "Isolation tool armed. Tap the spill point on the map.");
  }

  function showPrintExportModal() {
    if (elements.printExportBtn?.disabled) return;
    renderExportActions();
    elements.printExportModal.classList.remove("hidden");
  }

  function hidePrintExportModal() {
    elements.printExportModal.classList.add("hidden");
  }

  function renderRightSidebarState() {
    elements.appView.classList.toggle("right-sidebar-collapsed", state.rightSidebarCollapsed);
    elements.rightSidebarCollapseBtn.setAttribute("aria-expanded", String(!state.rightSidebarCollapsed));
    elements.rightSidebarCollapseBtn.setAttribute("aria-label", state.rightSidebarCollapsed ? "Expand right panel" : "Collapse right panel");
  }

  function toggleLandingCardAccess(enabled) {
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
      if (element) element.disabled = !enabled;
    });
    joinControls.forEach((element) => {
      if (element) element.disabled = !enabled;
    });
    renderCreateSessionFocusVisibility();
  }

  function setSuperAdminTab(tab) {
    state.superAdminTab = tab;
    renderSuperAdminWorkspace();
  }

  async function openSuperAdminWorkspace() {
    if (!state.superAdminContext?.email) {
      setStatus("Super admin access is required.");
      return;
    }
    const loaded = await refreshSuperAdminWorkspace();
    if (!loaded) return;
    state.superAdminOpen = true;
    state.ics202Open = false;
    elements.landingView.classList.add("hidden");
    elements.appView.classList.add("hidden");
    renderAll();
    setStatus("Super admin workspace opened.");
  }

  function closeSuperAdminWorkspace() {
    state.superAdminOpen = false;
    elements.superAdminWorkspace?.classList.add("hidden");
    if (state.activeSession || isScenarioReviewMode()) {
      elements.appView.classList.remove("hidden");
      elements.landingView.classList.add("hidden");
    } else {
      elements.landingView.classList.remove("hidden");
      elements.appView.classList.add("hidden");
    }
    renderAll();
    setStatus("Returned to owner workspace.");
  }

  function renderSuperAdminWorkspace() {
    if (!elements.superAdminWorkspace) return;
    const visible = Boolean(state.superAdminOpen && state.superAdminContext?.email);
    elements.superAdminWorkspace.classList.toggle("hidden", !visible);
    elements.superAdminWorkspace.setAttribute("aria-hidden", String(!visible));
    if (!visible) return;

    const activeTab = state.superAdminTab || "overview";
    elements.superAdminTabOverview?.classList.toggle("active", activeTab === "overview");
    elements.superAdminTabOrganizations?.classList.toggle("active", activeTab === "organizations");
    elements.superAdminTabUsers?.classList.toggle("active", activeTab === "users");
    elements.superAdminTabAccess?.classList.toggle("active", activeTab === "access");
    elements.superAdminOverviewPanel?.classList.toggle("hidden", activeTab !== "overview");
    elements.superAdminOrganizationsPanel?.classList.toggle("hidden", activeTab !== "organizations");
    elements.superAdminUsersPanel?.classList.toggle("hidden", activeTab !== "users");
    elements.superAdminAccessPanel?.classList.toggle("hidden", activeTab !== "access");

    renderSuperAdminOverview();
    renderSuperAdminOrganizations();
    renderSuperAdminUsers();
    renderSuperAdminAccess();
  }

  function renderDepartmentAdminPanel() {
    if (!elements.departmentAdminSummary || !elements.departmentAdminMemberList) return;
    if (!state.organizationContext?.isAdmin || !hasActiveOrganizationAccess()) {
      elements.departmentAdminSummary.innerHTML = "";
      elements.departmentAdminMemberList.innerHTML = "";
      return;
    }
    const summary = state.organizationSummary || {
      organizationName: state.organizationContext.organizationName,
      countyName: state.organizationContext.countyName,
      licenseStatus: state.organizationContext.licenseStatus,
      seatLimit: state.organizationContext.seatLimit,
      seatsUsed: state.organizationRoster.length
    };
    const seatsUsed = Number(summary.seatsUsed ?? state.organizationRoster.length ?? 0);
    const seatLimit = Number.isFinite(Number(summary.seatLimit)) ? Number(summary.seatLimit) : null;
    elements.departmentAdminSummary.innerHTML = `
      <div class="department-admin-kpi">
        <div class="label">Department</div>
        <div class="value">${escapeHtml(summary.organizationName || "Department")}</div>
      </div>
      <div class="department-admin-kpi">
        <div class="label">County</div>
        <div class="value">${escapeHtml(summary.countyName || "Unassigned")}</div>
      </div>
      <div class="department-admin-kpi">
        <div class="label">License</div>
        <div class="value">${escapeHtml(formatLicenseStatus(summary.licenseStatus))}</div>
      </div>
      <div class="department-admin-kpi">
        <div class="label">Seats</div>
        <div class="value">${seatLimit == null ? `${seatsUsed}` : `${seatsUsed} / ${seatLimit}`}</div>
      </div>
    `;
    elements.departmentAdminMemberList.innerHTML = "";
    if (!state.organizationRoster.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No department users yet.";
      elements.departmentAdminMemberList.appendChild(empty);
      return;
    }
    state.organizationRoster.forEach((member) => {
      const card = document.createElement("div");
      card.className = "participant-card department-admin-member";
      const title = document.createElement("strong");
      title.textContent = member.displayName || member.email;
      const meta = document.createElement("div");
      meta.className = "muted";
      meta.textContent = `${member.email} · ${member.isAdmin ? "Department Admin" : "Member"} · ${member.isActive ? "Active" : "Inactive"}`;
      const actions = document.createElement("div");
      actions.className = "row department-admin-member-actions";
      const toggleActiveBtn = document.createElement("button");
      toggleActiveBtn.className = "secondary";
      toggleActiveBtn.type = "button";
      toggleActiveBtn.textContent = member.isActive ? "Deactivate" : "Reactivate";
      toggleActiveBtn.addEventListener("click", () => {
        void updateOrganizationMember(
          member.id,
          { isActive: !member.isActive },
          `${member.displayName || member.email} ${member.isActive ? "deactivated" : "reactivated"}.`
        );
      });
      const toggleAdminBtn = document.createElement("button");
      toggleAdminBtn.className = "secondary";
      toggleAdminBtn.type = "button";
      toggleAdminBtn.textContent = member.isAdmin ? "Remove Admin" : "Make Admin";
      toggleAdminBtn.addEventListener("click", () => {
        void updateOrganizationMember(
          member.id,
          { isAdmin: !member.isAdmin },
          `${member.displayName || member.email} is ${member.isAdmin ? "no longer" : "now"} a department admin.`
        );
      });
      actions.append(toggleActiveBtn, toggleAdminBtn);
      card.append(title, meta, actions);
      elements.departmentAdminMemberList.appendChild(card);
    });
  }

  function renderSuperAdminOverview() {
    if (!elements.superAdminOverviewStats || !elements.superAdminRecentOrganizations) return;
    const overview = state.superAdminData.overview;
    const counts = overview?.counts || {
      organizations: 0,
      activeLicenses: 0,
      counties: 0,
      users: 0,
      activeUsers: 0,
      sharedSessions: 0,
      activeSessions: 0
    };
    elements.superAdminOverviewStats.innerHTML = `
      <div class="department-admin-kpi"><div class="label">Departments</div><div class="value">${counts.organizations}</div></div>
      <div class="department-admin-kpi"><div class="label">Active Licenses</div><div class="value">${counts.activeLicenses}</div></div>
      <div class="department-admin-kpi"><div class="label">Counties</div><div class="value">${counts.counties}</div></div>
      <div class="department-admin-kpi"><div class="label">Licensed Users</div><div class="value">${counts.users}</div></div>
      <div class="department-admin-kpi"><div class="label">Active Users</div><div class="value">${counts.activeUsers}</div></div>
      <div class="department-admin-kpi"><div class="label">Shared Sessions</div><div class="value">${counts.sharedSessions}</div></div>
    `;
    const recentOrganizations = Array.isArray(overview?.recentOrganizations) ? overview.recentOrganizations : [];
    elements.superAdminRecentOrganizations.innerHTML = "";
    if (!recentOrganizations.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No departments provisioned yet.";
      elements.superAdminRecentOrganizations.appendChild(empty);
      return;
    }
    recentOrganizations.forEach((organization) => {
      const card = document.createElement("div");
      card.className = "session-card";
      card.innerHTML = `
        <div class="session-card-top">
          <div class="session-card-content">
            <strong>${escapeHtml(organization.organizationName)}</strong>
            <div class="muted">${escapeHtml(organization.countyName || "No county")} · ${escapeHtml(formatLicenseStatus(organization.licenseStatus))} · ${organization.seatsUsed}/${organization.seatLimit ?? "∞"} seats</div>
          </div>
        </div>
      `;
      elements.superAdminRecentOrganizations.appendChild(card);
    });
  }

  function renderSuperAdminOrganizations() {
    if (!elements.superAdminOrganizationsList) return;
    elements.superAdminOrganizationsList.innerHTML = "";
    const organizations = Array.isArray(state.superAdminData.organizations) ? state.superAdminData.organizations : [];
    if (!organizations.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No departments provisioned yet.";
      elements.superAdminOrganizationsList.appendChild(empty);
      return;
    }
    organizations.forEach((organization) => {
      const card = document.createElement("div");
      card.className = "participant-card super-admin-organization-card";
      const fields = document.createElement("div");
      fields.className = "super-admin-inline-grid";
      const countyInput = document.createElement("input");
      countyInput.type = "text";
      countyInput.value = organization.countyName || "";
      countyInput.placeholder = "County";
      const seatInput = document.createElement("input");
      seatInput.type = "number";
      seatInput.min = "0";
      seatInput.value = organization.seatLimit ?? "";
      const statusSelect = document.createElement("select");
      statusSelect.innerHTML = `
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      `;
      statusSelect.value = organization.licenseStatus || "active";
      fields.append(countyInput, seatInput, statusSelect);

      const addMemberFields = document.createElement("div");
      addMemberFields.className = "super-admin-inline-grid";
      const memberNameInput = document.createElement("input");
      memberNameInput.type = "text";
      memberNameInput.placeholder = "Add user name";
      const memberEmailInput = document.createElement("input");
      memberEmailInput.type = "email";
      memberEmailInput.placeholder = "Add user email";
      const memberAdminLabel = document.createElement("label");
      memberAdminLabel.className = "inline-checkbox";
      memberAdminLabel.innerHTML = '<input type="checkbox" /> <span>Department Admin</span>';
      const memberAdminInput = memberAdminLabel.querySelector("input");
      const memberActiveLabel = document.createElement("label");
      memberActiveLabel.className = "inline-checkbox";
      memberActiveLabel.innerHTML = '<input type="checkbox" checked /> <span>Active</span>';
      const memberActiveInput = memberActiveLabel.querySelector("input");
      const memberOptions = document.createElement("div");
      memberOptions.className = "row department-admin-member-actions";
      memberOptions.append(memberAdminLabel, memberActiveLabel);
      addMemberFields.append(memberNameInput, memberEmailInput, memberOptions);

      const actions = document.createElement("div");
      actions.className = "row department-admin-member-actions";
      const saveBtn = document.createElement("button");
      saveBtn.className = "primary";
      saveBtn.type = "button";
      saveBtn.textContent = "Save Department";
      saveBtn.addEventListener("click", () => {
        void updateSuperAdminOrganization(
          organization.id,
          {
            countyName: countyInput.value.trim() || null,
            seatLimit: seatInput.value.trim() === "" ? null : Number(seatInput.value),
            licenseStatus: statusSelect.value
          },
          `${organization.organizationName} updated.`
        );
      });
      const addMemberBtn = document.createElement("button");
      addMemberBtn.className = "secondary";
      addMemberBtn.type = "button";
      addMemberBtn.textContent = "Add User";
      addMemberBtn.addEventListener("click", () => {
        const displayName = memberNameInput.value.trim();
        const email = memberEmailInput.value.trim().toLowerCase();
        if (!displayName || !email) {
          setStatus("Enter the new user name and email.");
          return;
        }
        void addSuperAdminOrganizationMember(
          organization.id,
          {
            displayName,
            email,
            isAdmin: Boolean(memberAdminInput?.checked),
            isActive: Boolean(memberActiveInput?.checked)
          },
          `${displayName} added to ${organization.organizationName}.`
        );
      });
      actions.append(saveBtn, addMemberBtn);

      card.innerHTML = `
        <strong>${escapeHtml(organization.organizationName)}</strong>
        <div class="muted">${escapeHtml(organization.memberCount)} users · ${escapeHtml(organization.adminCount)} admins · ${escapeHtml(organization.sessionCount)} sessions</div>
      `;
      card.append(fields, addMemberFields, actions);
      elements.superAdminOrganizationsList.appendChild(card);
    });
  }

  function renderSuperAdminUsers() {
    if (!elements.superAdminUsersList || !elements.superAdminUsersOrgFilter) return;
    const organizations = Array.isArray(state.superAdminData.organizations) ? state.superAdminData.organizations : [];
    const currentFilter = String(state.superAdminUsersOrgFilter || "");
    elements.superAdminUsersOrgFilter.innerHTML = '<option value="">All Departments</option>';
    organizations.forEach((organization) => {
      const option = document.createElement("option");
      option.value = String(organization.id || "");
      option.textContent = organization.organizationName || "Department";
      elements.superAdminUsersOrgFilter.appendChild(option);
    });
    elements.superAdminUsersOrgFilter.value = currentFilter;
    elements.superAdminUsersList.innerHTML = "";
    const users = (Array.isArray(state.superAdminData.users) ? state.superAdminData.users : []).filter((user) => {
      if (!currentFilter) return true;
      return String(user.organizationId || "") === currentFilter;
    });
    if (!users.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = currentFilter ? "No users found for the selected department." : "No licensed users found.";
      elements.superAdminUsersList.appendChild(empty);
      return;
    }
    users.forEach((user) => {
      const card = document.createElement("div");
      card.className = "participant-card department-admin-member";
      const title = document.createElement("strong");
      title.textContent = user.displayName || user.email;
      const meta = document.createElement("div");
      meta.className = "muted";
      meta.textContent = `${user.email} · ${user.organizationName} · ${user.isAdmin ? "Department Admin" : "Member"} · ${user.isActive ? "Active" : "Inactive"}`;
      const actions = document.createElement("div");
      actions.className = "row department-admin-member-actions";
      const activeBtn = document.createElement("button");
      activeBtn.className = "secondary";
      activeBtn.type = "button";
      activeBtn.textContent = user.isActive ? "Deactivate" : "Reactivate";
      activeBtn.addEventListener("click", () => {
        void updateSuperAdminUser(
          user.id,
          { isActive: !user.isActive },
          `${user.displayName || user.email} ${user.isActive ? "deactivated" : "reactivated"}.`
        );
      });
      const adminBtn = document.createElement("button");
      adminBtn.className = "secondary";
      adminBtn.type = "button";
      adminBtn.textContent = user.isAdmin ? "Remove Admin" : "Make Admin";
      adminBtn.addEventListener("click", () => {
        void updateSuperAdminUser(
          user.id,
          { isAdmin: !user.isAdmin },
          `${user.displayName || user.email} ${user.isAdmin ? "removed from" : "added as"} admin.`
        );
      });
      actions.append(activeBtn, adminBtn);
      card.append(title, meta, actions);
      elements.superAdminUsersList.appendChild(card);
    });
  }

  function renderSuperAdminAccess() {
    if (!elements.superAdminAccessList || !elements.superAdminStandingAccessList || !elements.superAdminStandingSourceSelect || !elements.superAdminStandingTargetList) return;
    const organizations = (Array.isArray(state.superAdminData.organizations) ? state.superAdminData.organizations : []).filter((organization) => {
      return organization.licenseStatus === "active";
    });
    const sourceValue = String(state.superAdminStandingSourceFilter || "");
    const targetValues = new Set((state.superAdminStandingTargetFilters || []).map((value) => String(value)));
    elements.superAdminStandingSourceSelect.innerHTML = '<option value="">Select source department</option>';
    organizations.forEach((organization) => {
      const sourceOption = document.createElement("option");
      sourceOption.value = String(organization.id || "");
      sourceOption.textContent = organization.organizationName || "Department";
      elements.superAdminStandingSourceSelect.appendChild(sourceOption);
    });
    elements.superAdminStandingSourceSelect.value = sourceValue;
    elements.superAdminStandingTargetList.innerHTML = "";
    const targetOrganizations = organizations.filter((organization) => String(organization.id || "") !== sourceValue);
    if (!targetOrganizations.length) {
      const emptyTargets = document.createElement("div");
      emptyTargets.className = "muted";
      emptyTargets.textContent = sourceValue ? "No other active departments are available." : "Choose a source department first.";
      elements.superAdminStandingTargetList.appendChild(emptyTargets);
    } else {
      targetOrganizations.forEach((organization) => {
        const label = document.createElement("label");
        label.className = "inline-checkbox";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = String(organization.id || "");
        input.checked = targetValues.has(input.value);
        input.addEventListener("change", () => {
          const next = new Set((state.superAdminStandingTargetFilters || []).map((value) => String(value)));
          if (input.checked) {
            next.add(input.value);
          } else {
            next.delete(input.value);
          }
          state.superAdminStandingTargetFilters = Array.from(next);
        });
        const text = document.createElement("span");
        text.textContent = organization.countyName ? `${organization.organizationName} · ${organization.countyName}` : (organization.organizationName || "Department");
        label.append(input, text);
        elements.superAdminStandingTargetList.appendChild(label);
      });
    }

    elements.superAdminStandingAccessList.innerHTML = "";
    const standingRows = Array.isArray(state.superAdminData.standingAccess) ? state.superAdminData.standingAccess : [];
    if (!standingRows.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No standing department access is active.";
      elements.superAdminStandingAccessList.appendChild(empty);
    } else {
      standingRows.forEach((entry) => {
        const card = document.createElement("div");
        card.className = "participant-card department-admin-member";
        const title = document.createElement("strong");
        title.textContent = `${entry.targetOrganizationName} can view ${entry.sourceOrganizationName}`;
        const meta = document.createElement("div");
        meta.className = "muted";
        meta.textContent = `Source: ${entry.sourceOrganizationName}${entry.sourceCountyName ? ` · ${entry.sourceCountyName}` : ""} · Target: ${entry.targetOrganizationName}${entry.targetCountyName ? ` · ${entry.targetCountyName}` : ""}`;
        const actions = document.createElement("div");
        actions.className = "row department-admin-member-actions";
        const revokeBtn = document.createElement("button");
        revokeBtn.className = "secondary";
        revokeBtn.type = "button";
        revokeBtn.textContent = "Revoke";
        revokeBtn.addEventListener("click", () => {
          void revokeStandingOrganizationAccess(
            entry.sourceOrganizationId,
            entry.targetOrganizationId,
            `Standing access from ${entry.sourceOrganizationName} to ${entry.targetOrganizationName} revoked.`
          );
        });
        actions.appendChild(revokeBtn);
        card.append(title, meta, actions);
        elements.superAdminStandingAccessList.appendChild(card);
      });
    }

    elements.superAdminAccessList.innerHTML = "";
    const accessRows = Array.isArray(state.superAdminData.access) ? state.superAdminData.access : [];
    if (!accessRows.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "No shared mutual-aid session access is active.";
      elements.superAdminAccessList.appendChild(empty);
      return;
    }
    accessRows.forEach((entry) => {
      const card = document.createElement("div");
      card.className = "session-card";
      card.innerHTML = `
        <div class="session-card-top">
          <div class="session-card-content">
            <strong>${escapeHtml(entry.incidentName)}</strong>
            <div class="muted">${escapeHtml(String(entry.sessionStatus || "").toUpperCase())} · Owner: ${escapeHtml(entry.ownerOrganizationName || "Unassigned")}</div>
            <div class="muted">Shared With: ${escapeHtml(entry.sharedOrganizationName)}${entry.sharedCountyName ? ` · ${escapeHtml(entry.sharedCountyName)}` : ""}</div>
          </div>
        </div>
      `;
      elements.superAdminAccessList.appendChild(card);
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
      const visibleStatus = effectiveSessionStatus(session).toUpperCase();
      const top = document.createElement("div");
      top.className = "session-card-top";
      const content = document.createElement("div");
      content.className = "session-card-content";
      const title = document.createElement("strong");
      title.textContent = session.incidentName;
      const meta = document.createElement("div");
      meta.className = "muted";
      const accessLabel = session.accessType === "shared"
        ? `SHARED · ${session.organizationName || "Outside Department"}`
        : (session.accessType === "standing"
          ? `STANDING ACCESS · ${session.organizationName || "Outside Department"}`
          : (session.organizationName || "Department"));
      meta.textContent = `${visibleStatus} · ${accessLabel} · ${formatDateTime(session.operationalPeriodStart)} to ${formatDateTime(session.operationalPeriodEnd)}`;
      const row = document.createElement("div");
      row.className = "row session-card-actions";
      const joinCode = document.createElement("span");
      joinCode.className = "session-card-join-code";
      joinCode.textContent = session.joinCode || "No code";
      const openBtn = document.createElement("button");
      openBtn.className = "secondary";
      openBtn.type = "button";
      openBtn.textContent = session.isOwner ? "Open" : "Use Code";
      openBtn.addEventListener("click", async () => {
        if (!session.isOwner) {
          elements.joinCodeInput.value = session.joinCode;
          elements.joinCodeInput.focus();
          setStatus(`Loaded join code for ${session.incidentName}.`);
          return;
        }
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
      copyBtn.textContent = "Copy Join Link";
      copyBtn.addEventListener("click", async () => {
        try {
          await writeToClipboard(session.joinUrl || session.joinCode);
          setStatus("Join link copied.");
        } catch (error) {
          setStatus("Copy failed.");
        }
      });
      const downloadBtn = document.createElement("button");
      downloadBtn.className = "secondary";
      downloadBtn.type = "button";
      downloadBtn.textContent = "Download JSON";
      downloadBtn.addEventListener("click", async () => {
        try {
          await downloadSessionJson(session);
        } catch (error) {
          setStatus(formatError(error));
        }
      });
      row.append(joinCode, openBtn, copyBtn, downloadBtn);
      content.append(title, meta);
      top.append(content, row);
      card.append(top);
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
      const visibleStatus = effectiveSessionStatus(session).toUpperCase();
      const title = document.createElement("strong");
      title.textContent = session.incidentName;
      const meta = document.createElement("div");
      meta.className = "muted";
      meta.textContent = `Owner: ${session.ownerName} · ${session.organizationName || "Department"} · ${visibleStatus} · ${formatDateTime(session.operationalPeriodStart)} to ${formatDateTime(session.operationalPeriodEnd)}`;
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
    const session = getWorkspaceSession();
    if (!session) {
      appendMetaRow(elements.sessionMeta, "Status", "No active workspace");
      elements.sessionPeriodPanel.classList.add("hidden");
      elements.incidentCommandPanel.classList.add("hidden");
      elements.setIncidentFocusBtn.classList.add("hidden");
      elements.copyJoinLinkBtn.classList.add("hidden");
      elements.endSessionBtn.classList.add("hidden");
      elements.centerIncidentBtn.classList.add("hidden");
      return;
    }
    const visibleStatus = isScenarioReviewMode()
      ? (scenarioReviewCanEdit() ? "Editable Scenario" : "Scenario Review")
      : effectiveSessionStatus(session);
    const ownerParticipant = state.participants.find((participant) => participant.permissionTier === "commander");
    appendMetaRow(elements.sessionMeta, "Incident", session.incidentName);
    appendMetaRow(elements.sessionMeta, isScenarioReviewMode() ? "Source" : "Session Owner", isScenarioReviewMode() ? (state.scenarioReview?.fileName || "Scenario file") : (ownerParticipant ? ownerParticipant.displayName : "Owner"));
    if (!isScenarioReviewMode()) {
      appendMetaRow(elements.sessionMeta, "Department", session.organizationName || "Legacy Session");
      appendMetaRow(
        elements.sessionMeta,
        "Access",
        session.accessType === "shared"
          ? "Mutual Aid / Shared"
          : (session.accessType === "standing" ? "Standing Access" : "Department")
      );
    }
    appendMetaRow(elements.sessionMeta, "Incident Commander", `${session.commanderName} · ${session.commanderICSRole}`);
    appendMetaRow(elements.sessionMeta, "Status", visibleStatus);
    appendMetaRow(elements.sessionMeta, "Incident Focus", getIncidentFocusPoint() ? "Set" : "Not set");
    if (isScenarioReviewMode()) {
      appendMetaRow(elements.sessionMeta, "Imported", formatDateTime(state.scenarioReview?.importedAt));
      elements.copyJoinLinkBtn.classList.add("hidden");
      elements.endSessionBtn.classList.add("hidden");
      elements.sessionPeriodPanel.classList.add("hidden");
      elements.incidentCommandPanel.classList.add("hidden");
    } else {
      appendMetaRow(elements.sessionMeta, "Join Code", session.joinCode);
      appendMetaRow(elements.sessionMeta, "Viewer Access", isViewerAccessEnabled(session) ? "Enabled" : "Disabled");
      appendMetaRow(elements.sessionMeta, "Period", `${formatDateTime(session.operationalPeriodStart)} → ${formatDateTime(session.operationalPeriodEnd)}`);
      elements.copyJoinLinkBtn.classList.toggle("hidden", !session.joinCode);
      elements.endSessionBtn.classList.toggle("hidden", !isCommander());
      elements.sessionPeriodPanel.classList.toggle("hidden", !isCommander());
      elements.incidentCommandPanel.classList.toggle("hidden", !isCommander());
      elements.sessionOpStartInput.value = isoToInputValue(session.operationalPeriodStart);
      elements.sessionOpEndInput.value = isoToInputValue(session.operationalPeriodEnd);
      elements.sessionIncidentCommanderNameInput.value = session.commanderName || "";
    }
  }

  function renderParticipants() {
    elements.participantList.innerHTML = "";
    if (!state.participants.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = isScenarioReviewMode() ? "No scenario participants recorded." : "No participants yet.";
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
    ensureDefaultPaletteCollapse(groups);
    const query = state.paletteSearchQuery.trim().toLowerCase();
    const filteredGroups = groups
      .map((group) => filterPaletteGroup(group, query))
      .filter(Boolean);

    elements.clearPaletteSearchBtn.classList.toggle("hidden", !query);

    if (!filteredGroups.length) {
      const empty = document.createElement("div");
      empty.className = "palette-search-empty muted";
      empty.textContent = query
        ? `No palette items match "${state.paletteSearchQuery}".`
        : "No palette items are available.";
      elements.paletteContainer.appendChild(empty);
      return;
    }

    filteredGroups.forEach(({ category, items, emptyMessage, forceExpanded }) => {
      const group = document.createElement("div");
      group.className = "palette-group";
      const isCollapsed = forceExpanded ? false : state.collapsedPaletteCategories.has(category);
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
        const canUseItem = canUsePaletteItem(item);
        button.className = `object-template ${item.kind === "icon" ? "icon-template" : ""} ${item.kind === "costed" ? "cost-template" : ""} ${state.selectedTemplateType === selectionKey ? "active" : ""}`;
        button.type = "button";
        button.disabled = !canUseItem;
        button.draggable = canUseItem && item.geometryType === "point" && !IS_TOUCH_PREFERRED;
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
          : item.kind === "costed"
            ? `
              <span class="cost-template-copy">
                <strong>${escapeHtml(item.label)}</strong>
                <div class="muted">${escapeHtml(item.billingModel === "hourly" ? `${formatCurrency(item.costRate || 0)} / ${item.unit || "Hour"}` : `${formatCurrency(item.costRate || 0)} x ${item.unit || "Unit"}`)}</div>
              </span>
              <span class="map-badge">${escapeHtml(item.badge || "$")}</span>
            `
          : `
            <span>
              <strong>${escapeHtml(item.label)}</strong>
              <div class="muted">${escapeHtml(item.geometryType)}</div>
            </span>
            <span class="map-badge">${escapeHtml(item.objectType.replace(/[a-z]/g, "").slice(0, 3) || item.geometryType[0].toUpperCase())}</span>
          `;
        button.addEventListener("click", () => {
          clearBrowserSelection();
          if (item.kind === "icon") {
            selectIconTemplate(item);
          } else if (item.kind === "costed") {
            selectCostedTemplate(item);
          } else {
            selectTemplate(item.objectType);
          }
        });
        if (item.geometryType === "point" && !IS_TOUCH_PREFERRED) {
          button.addEventListener("dragstart", (event) => onTemplateDragStart(event, selectionKey, button));
          button.addEventListener("dragend", () => onTemplateDragEnd(button));
        }
        grid.appendChild(button);
      });
      group.append(header, grid);
      elements.paletteContainer.appendChild(group);
    });
  }

  function filterPaletteGroup(group, query) {
    if (!query) return { ...group, forceExpanded: false };
    const categoryMatch = group.category.toLowerCase().includes(query);
    const matchedItems = group.items.filter((item) => paletteItemMatchesQuery(item, query));
    if (!categoryMatch && !matchedItems.length) return null;
    return {
      ...group,
      items: categoryMatch ? group.items : matchedItems,
      forceExpanded: true
    };
  }

  function paletteItemMatchesQuery(item, query) {
    const haystack = [
      item.label,
      item.category,
      item.objectType,
      item.geometryType,
      ...(Array.isArray(item.keywords) ? item.keywords : [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  }

  function ensureDefaultPaletteCollapse(groups) {
    if (state.paletteCollapseInitialized) return;
    groups.forEach(({ category }) => {
      state.collapsedPaletteCategories.add(category);
    });
    state.paletteCollapseInitialized = true;
  }

  function togglePaletteCategory(category) {
    if (state.collapsedPaletteCategories.has(category)) {
      state.collapsedPaletteCategories.delete(category);
    } else {
      state.collapsedPaletteCategories.add(category);
    }
    renderPalettes();
  }

  function onPaletteSearchInput(event) {
    state.paletteSearchQuery = event.target.value || "";
    renderPalettes();
  }

  function clearPaletteSearch() {
    state.paletteSearchQuery = "";
    elements.paletteSearchInput.value = "";
    renderPalettes();
    elements.paletteSearchInput.focus();
  }

  function togglePanel(panelKey) {
    if (state.collapsedPanels.has(panelKey)) {
      state.collapsedPanels.delete(panelKey);
    } else {
      state.collapsedPanels.add(panelKey);
    }
    renderPanelCollapses();
  }

  function toggleModePanel(panelKey) {
    if (state.collapsedModePanels.has(panelKey)) {
      state.collapsedModePanels.delete(panelKey);
    } else {
      state.collapsedModePanels.add(panelKey);
    }
    renderModePanelCollapses();
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

  function onAfterActionModeAction() {
    if (state.playbackMode) {
      exitPlaybackMode();
      return;
    }
    state.afterActionPanelVisible = !state.afterActionPanelVisible;
    renderAfterActionControls();
    if (state.afterActionPanelVisible) {
      setStatus("After-action panel opened.");
    } else {
      setStatus("After-action panel hidden.");
    }
  }

  function resetPlaybackHistoryForSession(_sessionId) {
    state.afterActionPanelVisible = false;
    state.playbackMode = false;
    state.playbackHistory = [];
    state.playbackEntries = [];
    state.playbackIndex = 0;
    state.playbackSessionId = null;
    state.playbackSavedSnapshot = null;
    stopPlaybackTimer();
  }

  function stopPlaybackTimer() {
    if (!state.playbackTimer) return;
    clearInterval(state.playbackTimer);
    state.playbackTimer = null;
  }

  function startPlaybackTimer() {
    stopPlaybackTimer();
    if (!state.playbackMode || state.playbackEntries.length <= 1) {
      renderAfterActionControls();
      return;
    }
    state.playbackTimer = window.setInterval(() => {
      if (state.playbackIndex >= state.playbackEntries.length - 1) {
        stopPlaybackTimer();
        renderAfterActionControls();
        setStatus("Playback complete.");
        return;
      }
      renderPlaybackFrame(state.playbackIndex + 1);
    }, state.playbackSpeedMs);
    renderAfterActionControls();
  }

  function togglePlaybackRunning() {
    if (!state.playbackEntries.length) {
      setStatus("Load session history first.");
      return;
    }
    if (!state.playbackMode) {
      enterPlaybackMode();
      return;
    }
    if (state.playbackTimer) {
      stopPlaybackTimer();
      renderAfterActionControls();
      setStatus("Playback paused.");
      return;
    }
    startPlaybackTimer();
    setStatus("Playback running.");
  }

  function restartPlayback() {
    if (!state.playbackEntries.length) return;
    if (!state.playbackMode) {
      enterPlaybackMode();
      return;
    }
    renderPlaybackFrame(0);
    setStatus("Playback restarted.");
  }

  async function loadPlaybackHistory(options = {}) {
    const { enterMode = true, silent = false } = options;
    if (!state.activeSession && !isScenarioReviewMode()) {
      if (!silent) setStatus("Open a session or scenario first.");
      return [];
    }
    try {
      if (!sessionHasHistoryLoaded()) {
        if (isScenarioReviewMode()) {
          state.playbackHistory = deepClone(state.scenarioReview?.mutations || []);
          state.playbackEntries = deepClone(state.scenarioReview?.playbackEntries || []);
          state.playbackSessionId = state.scenarioReview?.id || null;
        } else {
          const response = await apiFetch(
            `/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/mutations?sinceVersion=-1&limit=5000`,
            { actorType: currentActorType() }
          );
          state.playbackHistory = Array.isArray(response.mutations) ? response.mutations : [];
          state.playbackEntries = buildPlaybackEntries(state.playbackHistory);
          state.playbackSessionId = state.activeSession.id;
          if (response.session) {
            state.activeSession = response.session;
          }
        }
      }
      renderAfterActionControls();
      if (!state.playbackEntries.length) {
        if (!silent) {
          setStatus(isScenarioReviewMode() ? "No scenario history recorded yet." : "No session history recorded yet.");
        }
        return [];
      }
      if (enterMode) {
        state.afterActionPanelVisible = true;
        enterPlaybackMode();
      } else if (!silent) {
        setStatus("Playback history loaded.");
      }
      return state.playbackEntries;
    } catch (error) {
      if (!silent) {
        setStatus(formatError(error));
      }
      throw error;
    }
  }

  function enterPlaybackMode() {
    if (!state.playbackEntries.length) {
      setStatus("Load session history first.");
      return;
    }
    state.afterActionPanelVisible = true;
    cancelGeometryDraw();
    state.selectedObjectId = null;
    state.selectedTemplateType = null;
    if (!state.playbackSavedSnapshot) {
      state.playbackSavedSnapshot = {
        participants: deepClone(state.participants),
        objects: Array.from(state.objects.values()).map((object) => deepClone(object))
      };
    }
    state.playbackMode = true;
    renderPlaybackFrame(0);
    renderAll();
    setStatus("After-action playback loaded.");
  }

  function exitPlaybackMode() {
    if (!state.playbackMode) return;
    stopPlaybackTimer();
    state.playbackMode = false;
    state.playbackIndex = 0;
    if (state.playbackSavedSnapshot) {
      applySnapshot(state.playbackSavedSnapshot);
      state.playbackSavedSnapshot = null;
    }
    renderAll();
    setStatus("Returned to live incident view.");
  }

  function buildPlaybackEntries(mutations) {
    const ordered = (Array.isArray(mutations) ? mutations : [])
      .slice()
      .sort((left, right) => Number(left.version || 0) - Number(right.version || 0));
    const workingObjects = new Map();
    return ordered.map((mutation) => {
      const payload = mutation?.payload && typeof mutation.payload === "object" ? mutation.payload : {};
      const objectId = String(mutation.objectId || payload?.object?.id || "");
      const beforeObject = objectId ? deepClone(workingObjects.get(objectId)) : null;
      let object = beforeObject ? deepClone(beforeObject) : null;
      if (mutation.mutationType === "create" && payload.object) {
        object = deepClone(payload.object);
        if (objectId) {
          workingObjects.set(objectId, deepClone(object));
        }
      } else if (mutation.mutationType === "update" && beforeObject) {
        object = {
          ...beforeObject,
          geometryType: payload.geometryType || beforeObject.geometryType,
          geometry: payload.geometry != null ? deepClone(payload.geometry) : deepClone(beforeObject.geometry),
          fields: payload.fields != null ? deepClone(payload.fields) : deepClone(beforeObject.fields),
          version: Number(mutation.version || beforeObject.version || 0),
          updatedAt: mutation.createdAt || beforeObject.updatedAt,
          updatedByParticipantId: mutation.participantId || beforeObject.updatedByParticipantId
        };
        if (objectId) {
          workingObjects.set(objectId, deepClone(object));
        }
      } else if (mutation.mutationType === "delete" && objectId) {
        workingObjects.delete(objectId);
      }

      const displayObject = object || beforeObject;
      return {
        id: Number(mutation.id || 0),
        version: Number(mutation.version || 0),
        mutationType: mutation.mutationType || "update",
        objectId,
        participantId: mutation.participantId || "",
        createdAt: mutation.createdAt || new Date().toISOString(),
        object: displayObject ? deepClone(displayObject) : null,
        label: displayObject ? getObjectDisplayLabel(displayObject, resolveTemplateForObject(displayObject)) : "Map Object",
        category: getPlaybackCategory(displayObject),
        focusPoint: getObjectFocusPoint(displayObject)
      };
    });
  }

  function getPlaybackCategory(object) {
    if (!object) return "Uncategorized";
    if (isCostedResourceObject(object)) {
      return object.fields?.resourceCategory || "Costed Resource";
    }
    if (object.objectType === ICON_MARKER_OBJECT_TYPE) {
      return object.fields?.iconCategory || "Legacy Icons";
    }
    const template = resolveTemplateForObject(object);
    return template?.category || object.objectType || "Uncategorized";
  }

  function getObjectFocusPoint(object) {
    if (!object?.geometry) return null;
    if (object.geometryType === "point" && Number.isFinite(Number(object.geometry.lat)) && Number.isFinite(Number(object.geometry.lng))) {
      return { lat: Number(object.geometry.lat), lng: Number(object.geometry.lng) };
    }
    const firstPoint = Array.isArray(object.geometry.points) ? object.geometry.points[0] : null;
    if (firstPoint && Number.isFinite(Number(firstPoint.lat)) && Number.isFinite(Number(firstPoint.lng))) {
      return { lat: Number(firstPoint.lat), lng: Number(firstPoint.lng) };
    }
    return null;
  }

  function applyPlaybackEntry(entry, objectMap) {
    if (!entry?.objectId) return;
    if (entry.mutationType === "delete") {
      objectMap.delete(entry.objectId);
      return;
    }
    if (!entry.object) return;
    objectMap.set(entry.objectId, deepClone(entry.object));
  }

  function renderPlaybackFrame(index) {
    if (!state.playbackEntries.length) {
      renderAfterActionControls();
      return;
    }
    const boundedIndex = Math.max(0, Math.min(index, state.playbackEntries.length - 1));
    state.playbackIndex = boundedIndex;
    const objectMap = new Map();
    for (let cursor = 0; cursor <= boundedIndex; cursor += 1) {
      applyPlaybackEntry(state.playbackEntries[cursor], objectMap);
    }
    state.objects = objectMap;
    state.selectedObjectId = null;
    syncMapObjects();
    syncIncidentFocusState({ notify: false });
    renderSessionMeta();
    renderIncidentFocusUI();
    renderCostSummary();
    renderSelectedObject();
    renderAfterActionControls();

    const frame = state.playbackEntries[boundedIndex];
    const actor = state.participants.find((participant) => participant.id === frame.participantId);
    const actorLabel = actor?.displayName || "Participant";
    const actionLabel = frame.mutationType === "create"
      ? "Placed"
      : frame.mutationType === "delete"
        ? "Removed"
        : "Updated";
    elements.playbackMeta.textContent = `${boundedIndex + 1}/${state.playbackEntries.length} • ${formatDateTime(frame.createdAt)} • ${actionLabel} ${frame.label} • ${actorLabel}`;

    if (frame.focusPoint && state.map) {
      state.map.setView([frame.focusPoint.lat, frame.focusPoint.lng], Math.max(state.map.getZoom(), 15), { animate: false });
    } else {
      fitMapIfNeeded();
    }
  }

  async function exportTrainingScenario() {
    const workspaceSession = getWorkspaceSession();
    if (!workspaceSession) {
      setStatus("Open a session or scenario first.");
      return;
    }
    try {
      if (!sessionHasHistoryLoaded()) {
        await loadPlaybackHistory({ enterMode: false, silent: true });
      }
      const snapshotSource = state.playbackSavedSnapshot
        ? state.playbackSavedSnapshot.objects
        : Array.from(state.objects.values());
      const payload = {
        exportedAt: new Date().toISOString(),
        incidentName: workspaceSession.incidentName,
        session: deepClone(workspaceSession),
        participants: deepClone(state.participants),
        snapshot: {
          objects: snapshotSource.map((object) => deepClone(object))
        },
        mutations: deepClone(state.playbackHistory),
        costSummary: getCostSummaryTotals()
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const filename = `scenario-${slugifyFilename(workspaceSession.incidentName || "incident")}-${Date.now()}.json`;
      if (window.exportPdfHelper?.saveAndShareBlob) {
        try {
          const result = await window.exportPdfHelper.saveAndShareBlob(blob, filename, {
            title: "Export Scenario",
            text: "Here is the collaborative map scenario export.",
            dialogTitle: "Share Scenario",
            requireSharePrompt: true
          });
          setStatus(result?.shared ? `Scenario shared: ${filename}` : `Scenario saved: ${filename}`);
          return;
        } catch (_error) {
          // Fall back to browser download when native sharing is unavailable.
        }
      }
      await downloadBlob(blob, filename);
      setStatus(`Scenario downloaded: ${filename}`);
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  function createEmptyIcs202Draft() {
    return {
      incidentName: "",
      incidentNumber: "",
      operationalPeriod: {
        start: "",
        end: ""
      },
      objectives: [""],
      commandEmphasis: "",
      situationalAwareness: "",
      siteSafetyPlanRequired: false,
      siteSafetyPlanLocation: "",
      attachments: {
        ics203: false,
        ics204: false,
        ics205: false,
        ics205A: false,
        ics206: false,
        ics207: false,
        ics208: false,
        mapChart: false,
        weather: false,
        other: ""
      },
      preparedBy: {
        name: "",
        position: "",
        datetime: new Date().toISOString()
      },
      approvedBy: {
        name: "",
        signature: "",
        datetime: ""
      }
    };
  }

  function sanitizeIcs202Draft(value) {
    const base = createEmptyIcs202Draft();
    if (!value || typeof value !== "object") return base;
    const draft = deepClone(base);
    draft.incidentName = String(value.incidentName || "").trim();
    draft.incidentNumber = String(value.incidentNumber || "").trim();
    draft.operationalPeriod.start = String(value.operationalPeriod?.start || "");
    draft.operationalPeriod.end = String(value.operationalPeriod?.end || "");
    draft.objectives = Array.isArray(value.objectives) && value.objectives.length
      ? value.objectives.map((entry) => String(entry || ""))
      : [""];
    draft.commandEmphasis = String(value.commandEmphasis || "");
    draft.situationalAwareness = String(value.situationalAwareness || "");
    draft.siteSafetyPlanRequired = Boolean(value.siteSafetyPlanRequired);
    draft.siteSafetyPlanLocation = String(value.siteSafetyPlanLocation || "");
    Object.keys(draft.attachments).forEach((key) => {
      if (key === "other") {
        draft.attachments.other = String(value.attachments?.other || "");
      } else {
        draft.attachments[key] = Boolean(value.attachments?.[key]);
      }
    });
    draft.preparedBy = {
      name: String(value.preparedBy?.name || ""),
      position: String(value.preparedBy?.position || ""),
      datetime: String(value.preparedBy?.datetime || draft.preparedBy.datetime)
    };
    draft.approvedBy = {
      name: String(value.approvedBy?.name || ""),
      signature: String(value.approvedBy?.signature || ""),
      datetime: String(value.approvedBy?.datetime || "")
    };
    return draft;
  }

  function ensureIcs202Draft() {
    if (state.ics202Draft) return state.ics202Draft;
    const stored = loadStoredJSON(STORAGE_KEYS.ics202Draft);
    state.ics202Draft = sanitizeIcs202Draft(stored);
    prefillIcs202DraftFromWorkspace();
    return state.ics202Draft;
  }

  function saveIcs202Draft() {
    ensureIcs202Draft();
    persistJSON(STORAGE_KEYS.ics202Draft, state.ics202Draft);
  }

  function prefillIcs202DraftFromWorkspace() {
    const draft = state.ics202Draft;
    const session = getWorkspaceSession();
    if (!draft || !session) return;
    if (!draft.incidentName) {
      draft.incidentName = String(session.incidentName || "");
    }
    if (!draft.operationalPeriod.start && session.operationalPeriodStart) {
      draft.operationalPeriod.start = session.operationalPeriodStart;
    }
    if (!draft.operationalPeriod.end && session.operationalPeriodEnd) {
      draft.operationalPeriod.end = session.operationalPeriodEnd;
    }
    if (!draft.preparedBy.name && state.commanderAuth?.displayName) {
      draft.preparedBy.name = state.commanderAuth.displayName;
    }
    if (!draft.preparedBy.position) {
      draft.preparedBy.position = session.commanderICSRole || "Incident Commander";
    }
  }

  function formatIcs202DateInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
  }

  function formatIcs202TimeInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(11, 16);
  }

  function combineIcs202DateTime(dateValue, timeValue) {
    if (!dateValue || !timeValue) return "";
    return inputValueToISOString(`${dateValue}T${timeValue}`) || "";
  }

  function formatIcs202DateTime(value) {
    if (!value) return "Not provided";
    return formatDateTime(value);
  }

  function formatIcs202Multiline(value, fallback = "Not provided") {
    const text = String(value || "").trim();
    return text ? escapeHtml(text).replace(/\n/g, "<br />") : escapeHtml(fallback);
  }

  function getIcs202AttachmentLabels() {
    const draft = ensureIcs202Draft();
    const labels = [];
    if (draft.attachments.ics203) labels.push("ICS 203");
    if (draft.attachments.ics204) labels.push("ICS 204");
    if (draft.attachments.ics205) labels.push("ICS 205");
    if (draft.attachments.ics205A) labels.push("ICS 205A");
    if (draft.attachments.ics206) labels.push("ICS 206");
    if (draft.attachments.ics207) labels.push("ICS 207");
    if (draft.attachments.ics208) labels.push("ICS 208");
    if (draft.attachments.mapChart) labels.push("Map/Chart");
    if (draft.attachments.weather) labels.push("Weather Forecast");
    if (draft.attachments.other.trim()) labels.push(draft.attachments.other.trim());
    return labels;
  }

  function validateIcs202({ forFinalize = false } = {}) {
    const draft = ensureIcs202Draft();
    const errors = [];
    const warnings = [];
    if (!draft.incidentName.trim()) errors.push("Incident Name is required.");
    if (!draft.objectives.some((objective) => String(objective || "").trim())) errors.push("At least one incident objective is required.");
    if (!draft.operationalPeriod.start || !draft.operationalPeriod.end) {
      errors.push("Operational period start and end are required.");
    } else if (new Date(draft.operationalPeriod.end).getTime() <= new Date(draft.operationalPeriod.start).getTime()) {
      errors.push("Operational period end must be after the start.");
    }
    if (!draft.preparedBy.name.trim()) errors.push("Prepared By name is required.");
    if (!draft.preparedBy.position.trim()) errors.push("Prepared By position/title is required.");
    if (draft.siteSafetyPlanRequired && !draft.siteSafetyPlanLocation.trim()) {
      errors.push("Site Safety Plan location is required when the plan is marked Yes.");
    }
    if (forFinalize && !draft.approvedBy.name.trim()) {
      errors.push("Approved By IC name is required before printing or exporting.");
    }
    if (!draft.commandEmphasis.trim()) warnings.push("Command Emphasis is still blank.");
    if (!draft.situationalAwareness.trim()) warnings.push("General Situational Awareness is still blank.");
    return { errors, warnings };
  }

  function updateIcs202ValidationBanner(options = {}) {
    const { errors, warnings } = validateIcs202({ forFinalize: Boolean(options.forFinalize) });
    const items = [...errors, ...warnings];
    elements.ics202ValidationBanner.classList.toggle("hidden", items.length === 0);
    if (!items.length) return;
    elements.ics202ValidationTitle.textContent = errors.length ? "Review needed before final output" : "Optional fields to consider";
    elements.ics202ValidationList.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    if (options.scrollIntoView) {
      elements.ics202ValidationBanner.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }

  function updateIcs202AttachmentsState() {
    const draft = ensureIcs202Draft();
    draft.attachments = {
      ics203: Boolean(elements.ics202Attachment203.checked),
      ics204: Boolean(elements.ics202Attachment204.checked),
      ics205: Boolean(elements.ics202Attachment205.checked),
      ics205A: Boolean(elements.ics202Attachment205A.checked),
      ics206: Boolean(elements.ics202Attachment206.checked),
      ics207: Boolean(elements.ics202Attachment207.checked),
      ics208: Boolean(elements.ics202Attachment208.checked),
      mapChart: Boolean(elements.ics202AttachmentMapChart.checked),
      weather: Boolean(elements.ics202AttachmentWeather.checked),
      other: elements.ics202AttachmentOtherEnabled.checked ? String(elements.ics202AttachmentOtherText.value || "").trim() : ""
    };
    elements.ics202AttachmentOtherField.classList.toggle("hidden", !elements.ics202AttachmentOtherEnabled.checked);
    renderIcs202Summary();
    updateIcs202ValidationBanner();
  }

  function syncIcs202OperationalState() {
    const draft = ensureIcs202Draft();
    draft.operationalPeriod.start = combineIcs202DateTime(elements.ics202OpStartDate.value, elements.ics202OpStartTime.value);
    draft.operationalPeriod.end = combineIcs202DateTime(elements.ics202OpEndDate.value, elements.ics202OpEndTime.value);
    renderIcs202Summary();
    updateIcs202ValidationBanner();
  }

  function renderIcs202Objectives() {
    const draft = ensureIcs202Draft();
    elements.ics202ObjectivesList.innerHTML = "";
    draft.objectives.forEach((objective, index) => {
      const item = document.createElement("div");
      item.className = "ics202-objective-item";
      item.draggable = true;
      item.dataset.index = String(index);
      item.innerHTML = `
        <div class="ics202-objective-index">${index + 1}</div>
        <label class="ics202-field">
          <span>Objective ${index + 1}</span>
          <textarea placeholder="Describe the objective for this operational period.">${escapeHtml(objective)}</textarea>
        </label>
        <div class="ics202-objective-actions">
          <button class="secondary" type="button" data-action="up" aria-label="Move objective up">↑</button>
          <button class="secondary" type="button" data-action="down" aria-label="Move objective down">↓</button>
          <button class="danger" type="button" data-action="remove" aria-label="Remove objective">×</button>
        </div>
      `;
      const textarea = item.querySelector("textarea");
      textarea.addEventListener("input", (event) => {
        draft.objectives[index] = event.target.value;
        renderIcs202Summary();
        updateIcs202ValidationBanner();
      });
      item.querySelectorAll("button[data-action]").forEach((button) => {
        button.addEventListener("click", () => {
          const action = button.dataset.action;
          if (action === "remove") {
            removeIcs202Objective(index);
          } else if (action === "up") {
            moveIcs202Objective(index, -1);
          } else if (action === "down") {
            moveIcs202Objective(index, 1);
          }
        });
      });
      item.addEventListener("dragstart", () => {
        state.ics202ObjectiveDragIndex = index;
        item.classList.add("dragging");
      });
      item.addEventListener("dragend", () => {
        state.ics202ObjectiveDragIndex = -1;
        item.classList.remove("dragging");
        elements.ics202ObjectivesList.querySelectorAll(".drag-over").forEach((node) => node.classList.remove("drag-over"));
      });
      item.addEventListener("dragover", (event) => {
        event.preventDefault();
        item.classList.add("drag-over");
      });
      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over");
      });
      item.addEventListener("drop", (event) => {
        event.preventDefault();
        item.classList.remove("drag-over");
        reorderIcs202Objective(state.ics202ObjectiveDragIndex, index);
      });
      elements.ics202ObjectivesList.appendChild(item);
    });
  }

  function reorderIcs202Objective(fromIndex, toIndex) {
    const draft = ensureIcs202Draft();
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex || fromIndex >= draft.objectives.length || toIndex >= draft.objectives.length) return;
    const [moved] = draft.objectives.splice(fromIndex, 1);
    draft.objectives.splice(toIndex, 0, moved);
    renderIcs202Objectives();
    renderIcs202Summary();
  }

  function moveIcs202Objective(index, delta) {
    reorderIcs202Objective(index, index + delta);
  }

  function removeIcs202Objective(index) {
    const draft = ensureIcs202Draft();
    if (draft.objectives.length === 1) {
      draft.objectives[0] = "";
    } else {
      draft.objectives.splice(index, 1);
    }
    renderIcs202Objectives();
    renderIcs202Summary();
    updateIcs202ValidationBanner();
  }

  function addIcs202Objective(text = "") {
    const draft = ensureIcs202Draft();
    if (draft.objectives.length === 1 && !String(draft.objectives[0] || "").trim()) {
      draft.objectives[0] = text;
    } else {
      draft.objectives.push(text);
    }
    renderIcs202Objectives();
    renderIcs202Summary();
    updateIcs202ValidationBanner();
  }

  function insertIcs202ObjectiveExample() {
    const value = String(elements.ics202ObjectiveExampleSelect.value || "");
    if (!value) {
      setStatus("Choose an example objective first.");
      return;
    }
    addIcs202Objective(value);
    elements.ics202ObjectiveExampleSelect.value = "";
    setStatus("Objective example inserted.");
  }

  function renderIcs202Summary() {
    const draft = ensureIcs202Draft();
    const rows = [
      { label: "Objectives", value: String(draft.objectives.filter((entry) => String(entry || "").trim()).length) },
      { label: "Operational Period", value: draft.operationalPeriod.start && draft.operationalPeriod.end ? `${formatDateTime(draft.operationalPeriod.start)} to ${formatDateTime(draft.operationalPeriod.end)}` : "Not set" },
      { label: "Site Safety Plan", value: draft.siteSafetyPlanRequired ? (draft.siteSafetyPlanLocation.trim() || "Required") : "Not required" },
      { label: "Attachments", value: getIcs202AttachmentLabels().length ? getIcs202AttachmentLabels().join(", ") : "None selected" },
      { label: "Prepared By", value: draft.preparedBy.name.trim() || "Not provided" },
      { label: "Approved By", value: draft.approvedBy.name.trim() || "Pending" }
    ];
    elements.ics202Summary.innerHTML = rows.map((row) => `
      <div class="ics202-summary-row">
        <span class="label">${escapeHtml(row.label)}</span>
        <span class="value">${escapeHtml(row.value)}</span>
      </div>
    `).join("");
  }

  function buildIcs202Checkbox(checked) {
    return `<span class="ics202-print-checkbox${checked ? " checked" : ""}" aria-hidden="true"></span>`;
  }

  function buildIcs202ObjectiveRows(objectives) {
    const normalized = Array.isArray(objectives)
      ? objectives.filter((entry) => String(entry || "").trim()).map((entry) => String(entry || "").trim())
      : [];
    const rowCount = Math.max(normalized.length, 8);
    return Array.from({ length: rowCount }, (_, index) => `
      <tr>
        <td class="ics202-print-objective-number">${index + 1}.</td>
        <td class="ics202-print-objective-text">${normalized[index] ? formatIcs202Multiline(normalized[index], "") : "&nbsp;"}</td>
      </tr>
    `).join("");
  }

  function buildIcs202PrintMarkup() {
    const draft = ensureIcs202Draft();
    const exportedAt = new Date().toLocaleString();
    const objectivesRows = buildIcs202ObjectiveRows(draft.objectives);
    const incidentName = draft.incidentName || "\u00a0";
    const incidentNumber = draft.incidentNumber || "\u00a0";
    const opStartDate = formatIcs202DateInput(draft.operationalPeriod.start) || "\u00a0";
    const opEndDate = formatIcs202DateInput(draft.operationalPeriod.end) || "\u00a0";
    const opStartTime = formatIcs202TimeInput(draft.operationalPeriod.start) || "\u00a0";
    const opEndTime = formatIcs202TimeInput(draft.operationalPeriod.end) || "\u00a0";
    const otherAttachment = draft.attachments.other.trim() || "\u00a0";
    return `
      <div class="ics202-print-container">
        <table class="ics202-print-header-table">
          <tr>
            <td class="ics202-print-header-left">INCIDENT OBJECTIVES (ICS 202)</td>
            <td class="ics202-print-header-right">Date/Time: ${escapeHtml(exportedAt)}<br />Page 1</td>
          </tr>
        </table>

        <table class="ics202-print-table">
          <tr>
            <td class="ics202-print-half-cell">
              <div class="ics202-print-label">1. Incident Name</div>
              <div class="ics202-print-field-box ics202-print-field-tall">${escapeHtml(incidentName)}</div>
            </td>
            <td class="ics202-print-half-cell">
              <div class="ics202-print-label">2. Operational Period</div>
              <table class="ics202-print-inner-table">
                <tr>
                  <td>
                    <div class="ics202-print-label">Date From</div>
                    <div class="ics202-print-field-box">${escapeHtml(opStartDate)}</div>
                  </td>
                  <td>
                    <div class="ics202-print-label">Date To</div>
                    <div class="ics202-print-field-box">${escapeHtml(opEndDate)}</div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <div class="ics202-print-label">Time From</div>
                    <div class="ics202-print-field-box">${escapeHtml(opStartTime)}</div>
                  </td>
                  <td>
                    <div class="ics202-print-label">Time To</div>
                    <div class="ics202-print-field-box">${escapeHtml(opEndTime)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table class="ics202-print-table">
          <tr>
            <td>
              <div class="ics202-print-label">3. Objective(s):</div>
              <table class="ics202-print-objectives-table">
                ${objectivesRows}
              </table>
            </td>
          </tr>
        </table>

        <table class="ics202-print-table">
          <tr>
            <td class="ics202-print-section4-cell">
              <div class="ics202-print-label">4. Operational Period Command Emphasis</div>
              <div class="ics202-print-section4-top">${formatIcs202Multiline(draft.commandEmphasis)}</div>
              <div class="ics202-print-label ics202-print-subsection-label">General Situational Awareness</div>
              <div class="ics202-print-section4-bottom">${formatIcs202Multiline(draft.situationalAwareness)}</div>
            </td>
          </tr>
        </table>

        <table class="ics202-print-table">
          <tr>
            <td class="ics202-print-site-safety-cell">
              <div class="ics202-print-label">5. Site Safety Plan</div>
              <div class="ics202-print-site-safety-row">
                <span>Yes ${buildIcs202Checkbox(draft.siteSafetyPlanRequired)}</span>
                <span>No ${buildIcs202Checkbox(!draft.siteSafetyPlanRequired)}</span>
                <span class="ics202-print-site-safety-location">Location: ${escapeHtml(draft.siteSafetyPlanRequired ? (draft.siteSafetyPlanLocation || "\u00a0") : "\u00a0")}</span>
              </div>
            </td>
          </tr>
        </table>

        <table class="ics202-print-table">
          <tr>
            <td>
              <div class="ics202-print-label">6. IAP Attachments</div>
              <table class="ics202-print-attachments-table">
                <tr><td>ICS 203 ${buildIcs202Checkbox(draft.attachments.ics203)}</td><td>ICS 207 ${buildIcs202Checkbox(draft.attachments.ics207)}</td></tr>
                <tr><td>ICS 204 ${buildIcs202Checkbox(draft.attachments.ics204)}</td><td>ICS 208 ${buildIcs202Checkbox(draft.attachments.ics208)}</td></tr>
                <tr><td>ICS 205 ${buildIcs202Checkbox(draft.attachments.ics205)}</td><td>Map/Chart ${buildIcs202Checkbox(draft.attachments.mapChart)}</td></tr>
                <tr><td>ICS 205A ${buildIcs202Checkbox(draft.attachments.ics205A)}</td><td>Weather Forecast ${buildIcs202Checkbox(draft.attachments.weather)}</td></tr>
                <tr><td>ICS 206 ${buildIcs202Checkbox(draft.attachments.ics206)}</td><td>&nbsp;</td></tr>
              </table>
              <div class="ics202-print-other-attachments">Other Attachments: ${escapeHtml(otherAttachment)}</div>
            </td>
          </tr>
        </table>

        <table class="ics202-print-table">
          <tr>
            <td class="ics202-print-signature-cell">
              <div class="ics202-print-label">7. Prepared By</div>
              <table class="ics202-print-signature-table">
                <tr>
                  <td class="ics202-print-signature-name"><div class="ics202-print-label">Name</div><div class="ics202-print-field-box">${escapeHtml(draft.preparedBy.name || "\u00a0")}</div></td>
                  <td class="ics202-print-signature-position"><div class="ics202-print-label">Position/Title</div><div class="ics202-print-field-box">${escapeHtml(draft.preparedBy.position || "\u00a0")}</div></td>
                  <td class="ics202-print-signature-signature"><div class="ics202-print-label">Date/Time</div><div class="ics202-print-field-box">${escapeHtml(formatIcs202DateTime(draft.preparedBy.datetime))}</div></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table class="ics202-print-table">
          <tr>
            <td class="ics202-print-signature-cell">
              <div class="ics202-print-label">8. Approved by Incident Commander</div>
              <table class="ics202-print-signature-table">
                <tr>
                  <td class="ics202-print-signature-name"><div class="ics202-print-label">Name</div><div class="ics202-print-field-box">${escapeHtml(draft.approvedBy.name || "\u00a0")}</div></td>
                  <td class="ics202-print-signature-position"><div class="ics202-print-label">Signature</div><div class="ics202-print-field-box">${escapeHtml(draft.approvedBy.signature || "\u00a0")}</div></td>
                  <td class="ics202-print-signature-signature"><div class="ics202-print-label">Date/Time</div><div class="ics202-print-field-box">${escapeHtml(formatIcs202DateTime(draft.approvedBy.datetime))}</div></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table class="ics202-print-footer-table">
          <tr>
            <td class="ics202-print-footer-left">ICS 202 IAP Page 1</td>
            <td class="ics202-print-footer-right">Date/Time: ${escapeHtml(exportedAt)} ICS 202</td>
          </tr>
        </table>
      </div>
    `;
  }

  function renderIcs202PrintView() {
    elements.ics202PrintRoot.innerHTML = buildIcs202PrintMarkup();
  }

  function renderIcs202Workspace() {
    const visible = Boolean(state.ics202Open && (state.activeSession || isScenarioReviewMode()) && !state.viewerMode);
    elements.ics202Workspace.classList.toggle("hidden", !visible);
    elements.ics202Workspace.setAttribute("aria-hidden", String(!visible));
    if (!visible) return;
    const draft = ensureIcs202Draft();
    prefillIcs202DraftFromWorkspace();
    elements.ics202IncidentName.value = draft.incidentName;
    elements.ics202IncidentNumber.value = draft.incidentNumber;
    elements.ics202OpStartDate.value = formatIcs202DateInput(draft.operationalPeriod.start);
    elements.ics202OpStartTime.value = formatIcs202TimeInput(draft.operationalPeriod.start);
    elements.ics202OpEndDate.value = formatIcs202DateInput(draft.operationalPeriod.end);
    elements.ics202OpEndTime.value = formatIcs202TimeInput(draft.operationalPeriod.end);
    elements.ics202CommandEmphasis.value = draft.commandEmphasis;
    elements.ics202SituationalAwareness.value = draft.situationalAwareness;
    elements.ics202SiteSafetyYes.checked = Boolean(draft.siteSafetyPlanRequired);
    elements.ics202SiteSafetyNo.checked = !draft.siteSafetyPlanRequired;
    elements.ics202SiteSafetyLocationField.classList.toggle("hidden", !draft.siteSafetyPlanRequired);
    elements.ics202SiteSafetyLocation.value = draft.siteSafetyPlanLocation;
    elements.ics202Attachment203.checked = Boolean(draft.attachments.ics203);
    elements.ics202Attachment204.checked = Boolean(draft.attachments.ics204);
    elements.ics202Attachment205.checked = Boolean(draft.attachments.ics205);
    elements.ics202Attachment205A.checked = Boolean(draft.attachments.ics205A);
    elements.ics202Attachment206.checked = Boolean(draft.attachments.ics206);
    elements.ics202Attachment207.checked = Boolean(draft.attachments.ics207);
    elements.ics202Attachment208.checked = Boolean(draft.attachments.ics208);
    elements.ics202AttachmentMapChart.checked = Boolean(draft.attachments.mapChart);
    elements.ics202AttachmentWeather.checked = Boolean(draft.attachments.weather);
    elements.ics202AttachmentOtherEnabled.checked = Boolean(draft.attachments.other.trim());
    elements.ics202AttachmentOtherField.classList.toggle("hidden", !elements.ics202AttachmentOtherEnabled.checked);
    elements.ics202AttachmentOtherText.value = draft.attachments.other;
    elements.ics202PreparedByName.value = draft.preparedBy.name;
    elements.ics202PreparedByPosition.value = draft.preparedBy.position;
    elements.ics202PreparedByDateTime.value = isoToInputValue(draft.preparedBy.datetime);
    elements.ics202ApprovedByName.value = draft.approvedBy.name;
    elements.ics202ApprovedBySignature.value = draft.approvedBy.signature;
    elements.ics202ApprovedByDateTime.value = draft.approvedBy.datetime ? isoToInputValue(draft.approvedBy.datetime) : "";
    if (elements.ics202ObjectiveExampleSelect.options.length <= 1) {
      ICS202_OBJECTIVE_EXAMPLES.forEach((example) => {
        const option = document.createElement("option");
        option.value = example;
        option.textContent = example;
        elements.ics202ObjectiveExampleSelect.appendChild(option);
      });
    }
    renderIcs202Objectives();
    renderIcs202Summary();
    updateIcs202ValidationBanner();
    renderIcs202PrintView();
  }

  function openIcs202Workspace() {
    if (!(state.activeSession || isScenarioReviewMode()) || state.viewerMode) return;
    ensureIcs202Draft();
    prefillIcs202DraftFromWorkspace();
    state.ics202Open = true;
    renderIcs202Workspace();
    setStatus("ICS 202 workspace opened.");
  }

  function closeIcs202Workspace() {
    state.ics202Open = false;
    renderAll();
    setStatus("Returned to map workspace.");
  }

  function printIcs202Workspace() {
    const validation = validateIcs202({ forFinalize: true });
    if (validation.errors.length) {
      updateIcs202ValidationBanner({ forFinalize: true, scrollIntoView: true });
      setStatus(validation.errors[0]);
      return;
    }
    renderIcs202PrintView();
    document.body.classList.add("print-ics202");
    window.print();
    window.setTimeout(() => document.body.classList.remove("print-ics202"), 250);
    setStatus("Printing ICS 202.");
  }

  async function exportIcs202Pdf() {
    const validation = validateIcs202({ forFinalize: true });
    if (validation.errors.length) {
      updateIcs202ValidationBanner({ forFinalize: true, scrollIntoView: true });
      setStatus(validation.errors[0]);
      return;
    }
    const exportLibraries = await ensureExportLibraries({ pdf: true });
    if (!exportLibraries.ok) {
      setStatus(exportLibraries.message);
      return;
    }
    const jspdfNs = window.jspdf;
    try {
      renderIcs202PrintView();
      const canvas = await window.html2canvas(elements.ics202PrintRoot, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true
      });
      const { jsPDF } = jspdfNs;
      const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 36;
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - margin * 2;
      const imageWidth = canvas.width;
      const imageHeight = canvas.height;
      const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, imageWidth * scale, imageHeight * scale);

      const incidentSlug = String(ensureIcs202Draft().incidentName || "ics-202")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "ics-202";
      const filename = `${incidentSlug}-${Date.now()}-ics202.pdf`;
      const blob = pdf.output("blob");
      if (window.exportPdfHelper?.saveAndSharePdfBlob) {
        try {
          const result = await window.exportPdfHelper.saveAndSharePdfBlob(blob, filename);
          if (result?.shared) {
            setStatus(`ICS 202 PDF shared: ${filename}`);
          } else if (result?.uri) {
            setStatus(`ICS 202 PDF saved locally: ${filename}`);
          } else {
            setStatus(`ICS 202 PDF prepared: ${filename}`);
          }
          return;
        } catch (_error) {
          // Fall back to browser download.
        }
      }
      await downloadBlob(blob, filename);
      setStatus(`ICS 202 PDF exported: ${filename}`);
    } catch (error) {
      console.error("ICS 202 PDF export failed", error);
      setStatus("ICS 202 PDF export failed.");
    }
  }

  function clearIcs202Form() {
    if (!window.confirm("Clear the ICS 202 form?")) return;
    state.ics202Draft = createEmptyIcs202Draft();
    prefillIcs202DraftFromWorkspace();
    saveIcs202Draft();
    renderIcs202Workspace();
    setStatus("ICS 202 form cleared.");
  }

  function bindIcs202Events() {
    if (!elements.ics202Workspace) return;
    elements.ics202IncidentName.addEventListener("input", (event) => {
      ensureIcs202Draft().incidentName = event.target.value;
      renderIcs202Summary();
      updateIcs202ValidationBanner();
    });
    elements.ics202IncidentNumber.addEventListener("input", (event) => {
      ensureIcs202Draft().incidentNumber = event.target.value;
    });
    [elements.ics202OpStartDate, elements.ics202OpStartTime, elements.ics202OpEndDate, elements.ics202OpEndTime].forEach((input) => {
      input.addEventListener("change", syncIcs202OperationalState);
    });
    elements.ics202CommandEmphasis.addEventListener("input", (event) => {
      ensureIcs202Draft().commandEmphasis = event.target.value;
      updateIcs202ValidationBanner();
    });
    elements.ics202SituationalAwareness.addEventListener("input", (event) => {
      ensureIcs202Draft().situationalAwareness = event.target.value;
      updateIcs202ValidationBanner();
    });
    [elements.ics202SiteSafetyYes, elements.ics202SiteSafetyNo].forEach((input) => {
      input.addEventListener("change", () => {
        const draft = ensureIcs202Draft();
        draft.siteSafetyPlanRequired = elements.ics202SiteSafetyYes.checked;
        if (!draft.siteSafetyPlanRequired) draft.siteSafetyPlanLocation = "";
        renderIcs202Workspace();
      });
    });
    elements.ics202SiteSafetyLocation.addEventListener("input", (event) => {
      ensureIcs202Draft().siteSafetyPlanLocation = event.target.value;
      renderIcs202Summary();
      updateIcs202ValidationBanner();
    });
    [
      elements.ics202Attachment203,
      elements.ics202Attachment204,
      elements.ics202Attachment205,
      elements.ics202Attachment205A,
      elements.ics202Attachment206,
      elements.ics202Attachment207,
      elements.ics202Attachment208,
      elements.ics202AttachmentMapChart,
      elements.ics202AttachmentWeather,
      elements.ics202AttachmentOtherEnabled
    ].forEach((input) => input.addEventListener("change", updateIcs202AttachmentsState));
    elements.ics202AttachmentOtherText.addEventListener("input", updateIcs202AttachmentsState);
    elements.ics202PreparedByName.addEventListener("input", (event) => {
      ensureIcs202Draft().preparedBy.name = event.target.value;
      renderIcs202Summary();
      updateIcs202ValidationBanner();
    });
    elements.ics202PreparedByPosition.addEventListener("input", (event) => {
      ensureIcs202Draft().preparedBy.position = event.target.value;
      renderIcs202Summary();
      updateIcs202ValidationBanner();
    });
    elements.ics202PreparedByDateTime.addEventListener("change", (event) => {
      ensureIcs202Draft().preparedBy.datetime = inputValueToISOString(event.target.value) || ensureIcs202Draft().preparedBy.datetime;
      renderIcs202Summary();
    });
    elements.ics202ApprovedByName.addEventListener("input", (event) => {
      const draft = ensureIcs202Draft();
      draft.approvedBy.name = event.target.value;
      if (draft.approvedBy.name.trim() && !draft.approvedBy.datetime) {
        draft.approvedBy.datetime = new Date().toISOString();
      }
      elements.ics202ApprovedByDateTime.value = draft.approvedBy.datetime ? isoToInputValue(draft.approvedBy.datetime) : "";
      renderIcs202Summary();
      updateIcs202ValidationBanner();
    });
    elements.ics202ApprovedBySignature.addEventListener("input", (event) => {
      const draft = ensureIcs202Draft();
      draft.approvedBy.signature = event.target.value;
      if (draft.approvedBy.signature.trim() && !draft.approvedBy.datetime) {
        draft.approvedBy.datetime = new Date().toISOString();
      }
      elements.ics202ApprovedByDateTime.value = draft.approvedBy.datetime ? isoToInputValue(draft.approvedBy.datetime) : "";
      renderIcs202Summary();
      updateIcs202ValidationBanner();
    });
    elements.ics202ApprovedByDateTime.addEventListener("change", (event) => {
      ensureIcs202Draft().approvedBy.datetime = inputValueToISOString(event.target.value) || "";
      renderIcs202Summary();
    });
    elements.ics202AddObjectiveBtn.addEventListener("click", () => addIcs202Objective(""));
    elements.ics202InsertObjectiveExampleBtn.addEventListener("click", insertIcs202ObjectiveExample);
    elements.ics202BackBtn.addEventListener("click", closeIcs202Workspace);
    elements.ics202SaveBtn.addEventListener("click", () => {
      saveIcs202Draft();
      updateIcs202ValidationBanner();
      setStatus("ICS 202 draft saved.");
    });
    elements.ics202PrintBtn.addEventListener("click", printIcs202Workspace);
    elements.ics202ExportPdfBtn.addEventListener("click", () => {
      void exportIcs202Pdf();
    });
    elements.ics202ClearBtn.addEventListener("click", clearIcs202Form);
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("print-ics202");
    });
  }

  function deepClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function slugifyFilename(value) {
    return String(value || "incident")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "incident";
  }

  function buildSessionExportFilename(session) {
    const incidentSlug = slugifyFilename(session?.incidentName || "incident");
    const dateSegment = new Date().toISOString().slice(0, 10);
    return `${incidentSlug}-${dateSegment}-session.json`;
  }

  async function downloadSessionJson(session) {
    const snapshotResponse = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(session.id)}/snapshot`, {
      actorType: "commander"
    });
    const exportPayload = {
      exportType: "ics_collab_session_snapshot",
      exportedAt: new Date().toISOString(),
      accessType: session.accessType || "owned",
      session: deepClone(snapshotResponse.session || session),
      actor: deepClone(snapshotResponse.actor || null),
      snapshot: deepClone(snapshotResponse.snapshot || snapshotResponse)
    };
    const filename = buildSessionExportFilename(exportPayload.session || session);
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    await downloadBlob(blob, filename);
    setStatus(`Session JSON downloaded: ${filename}`);
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
    appendMetaRow(elements.selectedObjectMeta, "Type", getObjectDisplayLabel(object, template));
    appendMetaRow(elements.selectedObjectMeta, "Geometry", object.geometryType);
    if (isCostedResourceObject(object)) {
      appendMetaRow(elements.selectedObjectMeta, "Category", object.fields?.resourceCategory || "Costed Resource");
      appendMetaRow(elements.selectedObjectMeta, "Current Total", formatCurrency(getCostedResourceTotal(object)));
    } else if (object.objectType === MAP_NOTE_OBJECT_TYPE) {
      appendMetaRow(elements.selectedObjectMeta, "Priority", formatMapNotePriority(object.fields?.priority));
      appendMetaRow(elements.selectedObjectMeta, "Note", object.fields?.title || "Map Note");
    } else if (isIsolationZoneObject(object)) {
      appendMetaRow(elements.selectedObjectMeta, "Tool", "Isolation Tool");
      appendMetaRow(elements.selectedObjectMeta, "Distance", `${Math.round(convertMetersToDistance(Number(object.fields?.initialMeters || 0), object.fields?.distanceUnit || "ft"))} ${object.fields?.distanceUnit || "ft"}`);
      appendMetaRow(elements.selectedObjectMeta, "Downwind", `${Math.round(convertMetersToDistance(Number(object.fields?.evacMeters || 0), object.fields?.distanceUnit || "ft"))} ${object.fields?.distanceUnit || "ft"}`);
      if (object.fields?.ergMaterialName) {
        appendMetaRow(elements.selectedObjectMeta, "ERG Material", object.fields.ergMaterialName);
        appendMetaRow(elements.selectedObjectMeta, "UN Number", object.fields?.ergUnNumber ? `UN${object.fields.ergUnNumber}` : "Not set");
        appendMetaRow(elements.selectedObjectMeta, "Spill", `${object.fields?.ergSpillSize === "large" ? "Large" : "Small"} · ${object.fields?.ergTimeOfDay === "night" ? "Night" : "Day"}`);
        if (object.fields?.ergTransportContainer) {
          appendMetaRow(elements.selectedObjectMeta, "Container", object.fields.ergTransportContainer);
        }
        if (object.fields?.ergWindBucket) {
          appendMetaRow(elements.selectedObjectMeta, "ERG Wind", formatErgWindBucketLabel(object.fields.ergWindBucket));
        }
      }
      appendMetaRow(elements.selectedObjectMeta, "Wind From", `${Math.round(Number(object.fields?.windFrom || 0))}°`);
      appendMetaRow(elements.selectedObjectMeta, "Wind Source", object.fields?.windSource === "live" ? "Live Weather" : "Manual");
      appendMetaRow(elements.selectedObjectMeta, "Last Wind Update", object.fields?.lastWindUpdatedAt ? formatDateTime(object.fields.lastWindUpdatedAt) : "Not yet updated");
    } else if (object.objectType === ICON_MARKER_OBJECT_TYPE) {
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
      fields.forEach((field) => {
        const label = document.createElement("label");
        label.className = field.type === "textarea" ? "field-block field-block-textarea" : "field-block";
        label.textContent = field.label || field.key;
        const input = field.type === "textarea"
          ? document.createElement("textarea")
          : field.type === "select"
            ? document.createElement("select")
            : document.createElement("input");
        if (field.type === "select") {
          (field.options || []).forEach((option) => {
            const optionEl = document.createElement("option");
            optionEl.value = option.value;
            optionEl.textContent = option.label;
            input.appendChild(optionEl);
          });
          input.value = field.value ?? "";
        } else if (field.type === "textarea") {
          input.value = field.value ?? "";
          input.rows = 3;
        } else {
          input.type = field.type || "text";
          input.value = field.value ?? "";
          if (field.min != null) input.min = field.min;
          if (field.step != null) input.step = field.step;
        }
        input.dataset.fieldKey = field.key;
        input.dataset.fieldType = field.type || "text";
        input.disabled = !canEditObject(object);
        label.appendChild(input);
        elements.selectedObjectFields.appendChild(label);
      });
    }

    const editable = canEditObject(object);
    elements.saveFieldsBtn.textContent = "Save Details";
    elements.saveFieldsBtn.disabled = !editable;
    const canUseGeometryButton = editable && object.geometryType !== "point" && !isIsolationZoneObject(object);
    elements.editGeometryBtn.disabled = !canUseGeometryButton;
    elements.editGeometryBtn.classList.toggle("hidden", object.geometryType === "point" || isIsolationZoneObject(object));
    elements.deleteObjectBtn.disabled = !editable;
    elements.selectedObjectActions.classList.toggle("hidden", state.viewerMode || !editable);
  }

  function selectTemplate(objectType) {
    beginTemplatePlacement(objectType);
  }

  function selectCostedTemplate(costTemplate) {
    beginCostedPlacement(costTemplate);
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

  function beginCostedPlacement(costTemplate, initialPoint = null) {
    if (!costTemplate) return;
    const template = createCostedMarkerTemplate(costTemplate);
    state.selectedTemplateType = costTemplate.selectionKey;
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

  function clearBrowserSelection() {
    try {
      const selection = window.getSelection?.();
      if (selection && selection.rangeCount > 0) {
        selection.removeAllRanges();
      }
    } catch (_error) {
      // Ignore browser selection cleanup failures.
    }
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
    const costTemplate = findCostTemplateBySelectionKey(state.dragTemplateType);
    if (iconDefinition) {
      beginIconPlacement(iconDefinition, {
        lat: roundCoord(latLng.lat),
        lng: roundCoord(latLng.lng)
      });
    } else if (costTemplate) {
      beginCostedPlacement(costTemplate, {
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
    if (state.pendingIsolationConfig) {
      await handlePendingIsolationPlacement(event.latlng);
      return;
    }
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

  async function handlePendingIsolationPlacement(latlng) {
    if (!state.pendingIsolationConfig) return;
    if (!canCreateObjects()) {
      setStatus("This session is read-only or you do not have edit access.");
      state.pendingIsolationConfig = null;
      return;
    }
    const spillPoint = {
      lat: roundCoord(latlng.lat),
      lng: roundCoord(latlng.lng)
    };
    let config = state.pendingIsolationConfig;
    state.pendingIsolationConfig = null;
    try {
      config = await resolveIsolationPlacementConfig(config, spillPoint);
      await placeIsolationZonesAt(spillPoint, config);
      if (config.windSource === "live") {
        setStatus("Live wind applied at spill point.");
      }
    } catch (error) {
      if (config?.ergSource === "erg" && config?.ergSpillSize === "large" && config?.ergWindBucketMode === "auto") {
        state.pendingIsolationConfig = config;
        openIsolationToolModal();
      }
      setStatus(formatError(error));
    }
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
    if (template?.objectType === MAP_NOTE_OBJECT_TYPE && !canManageMapNotes()) {
      setStatus("Only command staff can place map notes.");
      return;
    }
    if (isScenarioReviewMode()) {
      const objectId = createLocalID();
      const object = {
        id: objectId,
        sessionId: state.scenarioReview.id,
        objectType: template.objectType,
        geometryType: template.geometryType,
        geometry: deepClone(geometry),
        fields: buildInitialFields(template),
        createdByParticipantId: state.actor?.id || "scenario-review-local",
        updatedByParticipantId: state.actor?.id || "scenario-review-local",
        version: 1,
        isDeleted: false,
        activeLockParticipantId: null,
        lockExpiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      state.objects.set(objectId, object);
      syncMapObjects();
      syncIncidentFocusState({ notify: true });
      renderAll();
      setStatus(`${template.label} placed in editable scenario.`);
      return;
    }
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

  async function placeIsolationZonesAt(spillLatLng, config, editContext = null) {
    const groupId = editContext?.groupId || createLocalID();
    const initialTemplate = templateByType[ISOLATION_ZONE_OBJECT_TYPE] || {
      objectType: ISOLATION_ZONE_OBJECT_TYPE,
      label: "Initial Isolation Zone",
      geometryType: "polygon",
      color: "#9ca3af",
      defaults: {}
    };
    const protectiveTemplate = templateByType[PROTECTIVE_ACTION_ZONE_OBJECT_TYPE] || {
      objectType: PROTECTIVE_ACTION_ZONE_OBJECT_TYPE,
      label: "Protective Action Zone",
      geometryType: "polygon",
      color: "#6b7280",
      defaults: {}
    };
    const initialObjectId = editContext?.initialObjectId || createLocalID();
    const protectiveObjectId = editContext?.protectiveObjectId || createLocalID();
    const initialFields = buildIsolationZoneFields("initial", groupId, spillLatLng, config);
    const protectiveFields = buildIsolationZoneFields("protective", groupId, spillLatLng, config);
    const initialGeometry = {
      points: buildCirclePolygonPoints(spillLatLng, config.initialMeters)
    };
    const protectiveGeometry = {
      points: buildProtectiveActionPolygonPoints(spillLatLng, config.windFrom, config.evacMeters, config.initialMeters)
    };

    if (isScenarioReviewMode()) {
      const existingGroup = editContext ? new Set(getIsolationGroupObjects(state.objects.get(editContext.initialObjectId) || state.objects.get(editContext.protectiveObjectId))) : new Set();
      const baseNow = new Date().toISOString();
      const buildLocalObject = (objectId, template, geometry, fields, previousObject = null) => ({
        id: objectId,
        sessionId: state.scenarioReview.id,
        objectType: template.objectType || ISOLATION_ZONE_OBJECT_TYPE,
        geometryType: template.geometryType || "polygon",
        geometry: deepClone(geometry),
        fields: deepClone(fields),
        createdByParticipantId: previousObject?.createdByParticipantId || state.actor?.id || "scenario-review-local",
        updatedByParticipantId: state.actor?.id || previousObject?.updatedByParticipantId || "scenario-review-local",
        version: Number(previousObject?.version || 0) + 1,
        isDeleted: false,
        activeLockParticipantId: null,
        lockExpiresAt: null,
        createdAt: previousObject?.createdAt || baseNow,
        updatedAt: baseNow
      });
      const previousInitial = state.objects.get(initialObjectId) || null;
      const previousProtective = state.objects.get(protectiveObjectId) || null;
      existingGroup.forEach((object) => {
        if (object.id !== initialObjectId && object.id !== protectiveObjectId) {
          state.objects.delete(object.id);
        }
      });
      state.objects.set(initialObjectId, buildLocalObject(initialObjectId, initialTemplate, initialGeometry, initialFields, previousInitial));
      state.objects.set(protectiveObjectId, buildLocalObject(protectiveObjectId, protectiveTemplate, protectiveGeometry, protectiveFields, previousProtective));
      state.selectedObjectId = protectiveObjectId;
      syncMapObjects();
      renderAll();
      setStatus(editContext ? "Isolation and evacuation zones updated." : "Isolation and evacuation zones placed.");
      return;
    }

    const mutations = [
      {
        clientMutationId: createLocalID(),
        objectId: initialObjectId,
        mutationType: editContext ? "update" : "create",
        objectType: ISOLATION_ZONE_OBJECT_TYPE,
        geometryType: "polygon",
        geometry: initialGeometry,
        fields: initialFields,
        ...(editContext ? { baseVersion: state.objects.get(initialObjectId)?.version || 0 } : {})
      },
      {
        clientMutationId: createLocalID(),
        objectId: protectiveObjectId,
        mutationType: editContext ? "update" : "create",
        objectType: PROTECTIVE_ACTION_ZONE_OBJECT_TYPE,
        geometryType: "polygon",
        geometry: protectiveGeometry,
        fields: protectiveFields,
        ...(editContext ? { baseVersion: state.objects.get(protectiveObjectId)?.version || 0 } : {})
      }
    ];
    const result = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/mutations`, {
      method: "POST",
      actorType: currentActorType(),
      body: { mutations }
    });
    applyMutationResponse(result);
    state.selectedObjectId = protectiveObjectId;
    renderSelectedObject();
    setStatus(editContext ? "Isolation and evacuation zones updated." : "Isolation and evacuation zones placed.");
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
    if (isScenarioReviewMode()) {
      const object = state.objects.get(mutation.objectId);
      if (!object) return Promise.resolve();
      const updated = {
        ...object,
        geometryType: mutation.geometryType || object.geometryType,
        geometry: mutation.geometry != null ? deepClone(mutation.geometry) : deepClone(object.geometry),
        fields: mutation.fields != null ? deepClone(mutation.fields) : deepClone(object.fields),
        version: Number(object.version || 0) + 1,
        updatedByParticipantId: state.actor?.id || object.updatedByParticipantId,
        updatedAt: new Date().toISOString()
      };
      state.objects.set(object.id, updated);
      syncMapObjects();
      syncIncidentFocusState({ notify: true });
      renderAll();
      return Promise.resolve();
    }
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
      const icon = buildPointObjectIcon(object, template, color);
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
    layer.on("click", async (event) => {
      if (state.pendingIsolationConfig && event?.latlng) {
        if (typeof event.originalEvent?.stopPropagation === "function") {
          event.originalEvent.stopPropagation();
        }
        if (typeof event.originalEvent?.preventDefault === "function") {
          event.originalEvent.preventDefault();
        }
        await handlePendingIsolationPlacement(event.latlng);
        return;
      }
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
      const fieldKey = input.dataset.fieldKey;
      const fieldType = input.dataset.fieldType || "text";
      if (!fieldKey) return;
      nextFields[fieldKey] = parseEditorFieldValue(fieldType, input.value, nextFields[fieldKey]);
      if (fieldKey === "demobilizedAt" && !nextFields[fieldKey]) {
        nextFields[fieldKey] = "";
      }
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

  function parseEditorFieldValue(fieldType, rawValue, previousValue) {
    const value = rawValue ?? "";
    if (fieldType === "number") {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    }
    if (fieldType === "datetime-local") {
      if (!value) return "";
      const iso = inputValueToISOString(value);
      return iso || previousValue || "";
    }
    return value;
  }

  async function startGeometryEdit() {
    const object = state.selectedObjectId ? state.objects.get(state.selectedObjectId) : null;
    if (!object || !canEditObject(object)) {
      setStatus("You cannot edit this geometry.");
      return;
    }
    if (isIsolationZoneObject(object)) {
      setStatus("Use the Isolation Tool to update these zones.");
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
    const groupObjects = isIsolationZoneObject(object) ? getIsolationGroupObjects(object) : [object];
    if (isScenarioReviewMode()) {
      groupObjects.forEach((entry) => state.objects.delete(entry.id));
      state.selectedObjectId = null;
      syncMapObjects();
      renderSelectedObject();
      renderAll();
      setStatus(groupObjects.length > 1 ? "Isolation zones deleted from editable scenario." : "Object deleted from editable scenario.");
      return;
    }
    try {
      const result = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/mutations`, {
        method: "POST",
        actorType: currentActorType(),
        body: {
          mutations: groupObjects.map((entry) => ({
            clientMutationId: createLocalID(),
            objectId: entry.id,
            mutationType: "delete",
            baseVersion: entry.version
          }))
        }
      });
      applyMutationResponse(result);
      state.selectedObjectId = null;
      renderSelectedObject();
      setStatus(groupObjects.length > 1 ? "Isolation zones deleted." : "Object deleted.");
    } catch (error) {
      setStatus(formatError(error));
    }
  }

  function closeSelectedObjectEditor() {
    state.selectedObjectId = null;
    renderSelectedObject();
  }

  async function acquireObjectLock(object, options = {}) {
    if (isScenarioReviewMode()) {
      return Promise.resolve({ object });
    }
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
    if (isScenarioReviewMode()) {
      return Promise.resolve(objectId);
    }
    await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/objects/${encodeURIComponent(objectId)}/lock`, {
      method: "DELETE",
      actorType: currentActorType()
    });
  }

  async function copyJoinLink() {
    if (!state.activeSession || isScenarioReviewMode()) return;
    const joinLink = state.activeSession.joinUrl || `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(state.activeSession.joinCode)}`;
    try {
      await writeToClipboard(joinLink);
      setStatus("Join link copied.");
    } catch (error) {
      setStatus("Unable to copy join link.");
    }
  }

  async function toggleViewerAccess() {
    if (!state.activeSession || isScenarioReviewMode() || !canToggleViewerAccess()) return;
    const nextEnabled = !isViewerAccessEnabled();
    const prompt = nextEnabled
      ? "Enable viewer QR access for this session again?"
      : "Disable viewer QR access for this session? Existing viewers will lose access on their next refresh.";
    if (!window.confirm(prompt)) return;
    try {
      const session = await apiFetch(`/v1/ics-collab/sessions/${encodeURIComponent(state.activeSession.id)}/viewer-access`, {
        method: "PATCH",
        actorType: "commander",
        body: { enabled: nextEnabled }
      });
      state.activeSession = session;
      if (!nextEnabled) {
        hideViewerQrModal();
      }
      renderAll();
      setStatus(nextEnabled ? "Viewer access enabled." : "Viewer access disabled. QR links are now off.");
    } catch (error) {
      setStatus(formatError(error));
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
    if (!state.activeSession?.joinCode || isScenarioReviewMode() || !canShareViewerQr()) {
      setStatus("Only signed-in command staff can share the viewer QR.");
      return;
    }
    if (!isViewerAccessEnabled()) {
      setStatus("Viewer access is currently disabled for this session.");
      return;
    }
    const viewerLink = buildViewerLink();
    elements.viewerQrLink.value = viewerLink;
    elements.viewerQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(viewerLink)}`;
    elements.viewerQrModal.classList.remove("hidden");
  }

  function hideViewerQrModal() {
    elements.viewerQrModal.classList.add("hidden");
  }

  async function copyViewerLink() {
    if (isScenarioReviewMode()) return;
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
    if (isScenarioReviewMode()) {
      return "local";
    }
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
    return !state.playbackMode && ((sessionIsActive() && state.actor && state.actor.permissionTier !== "observer") || scenarioReviewCanEdit());
  }

  function canManageMapNotes() {
    if (scenarioReviewCanEdit()) return true;
    if (!sessionIsActive() || !state.actor || state.viewerMode) return false;
    if (state.actor.permissionTier === "commander") return true;
    return MAP_NOTE_ALLOWED_ROLES.has(String(state.actor.icsRole || "").trim());
  }

  function canUsePaletteItem(item) {
    if (!canCreateObjects()) return false;
    if (item?.objectType === MAP_NOTE_OBJECT_TYPE) {
      return canManageMapNotes();
    }
    return true;
  }

  function canEditObject(object) {
    if (state.playbackMode) return false;
    if (scenarioReviewCanEdit()) return true;
    if (!sessionIsActive() || !state.actor || state.actor.permissionTier === "observer") return false;
    if (object?.objectType === MAP_NOTE_OBJECT_TYPE) {
      return canManageMapNotes();
    }
    if (state.actor.permissionTier === "commander") return true;
    return object.createdByParticipantId === state.actor.id;
  }

  function isCommander() {
    return state.actor?.permissionTier === "commander" || currentActorType() === "commander";
  }

  function isViewerAccessEnabled(session = state.activeSession) {
    return session?.viewerAccessEnabled !== false;
  }

  function canShareViewerQr() {
    if (!state.activeSession || isScenarioReviewMode() || state.viewerMode || !state.actor) return false;
    if (state.actor.permissionTier === "commander") return true;
    if (state.actor.permissionTier === "observer") return false;
    return VIEWER_QR_ALLOWED_ROLES.has(String(state.actor.icsRole || "").trim());
  }

  function canToggleViewerAccess() {
    return isCommander() && !isScenarioReviewMode() && !state.viewerMode && Boolean(state.activeSession);
  }

  function formatPermissionTier(permissionTier) {
    if (permissionTier === "commander") return "owner";
    return permissionTier;
  }

  function formatLicenseStatus(status) {
    return status === "active" ? "Active" : "Inactive";
  }

  function sessionIsActive() {
    if (scenarioReviewCanEdit()) return true;
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

  function getEquipmentRateTemplates() {
    return EQUIPMENT_RATE_TEMPLATES;
  }

  function getConsumableRateTemplates() {
    return CONSUMABLE_RATE_TEMPLATES;
  }

  function normalizeCostTemplate(entry, category, overrides = {}) {
    const isConsumable = category === CONSUMABLES_CATEGORY;
    const normalizedName = String(overrides.name || entry?.name || `${category.toLowerCase().replace(/\s+/g, "_")}_${createLocalID()}`).trim();
    const normalizedLabel = String(overrides.label || entry?.label || entry?.equipment || (isConsumable ? "Consumable" : "Equipment")).trim() || (isConsumable ? "Consumable" : "Equipment");
    return {
      id: normalizedName,
      name: normalizedName,
      objectType: ICON_MARKER_OBJECT_TYPE,
      geometryType: "point",
      kind: "costed",
      selectionKey: `cost:${category}:${normalizedName}`,
      label: normalizedLabel,
      category,
      keywords: buildCostTemplateKeywords(entry, normalizedLabel, category),
      billingModel: overrides.billingModel || entry?.billingModel || (isConsumable ? "quantity" : "hourly"),
      unit: overrides.unit || entry?.unit || (isConsumable ? "Unit" : "Hour"),
      costRate: Number(overrides.costRate ?? entry?.costRate ?? 0) || 0,
      costCode: String(overrides.costCode || entry?.costCode || "").trim(),
      description: String(overrides.description || entry?.description || "").trim(),
      manufacturer: String(overrides.manufacturer || entry?.manufacturer || "").trim(),
      specification: String(overrides.specification || entry?.specification || "").trim(),
      customResource: Boolean(overrides.customResource),
      badge: isConsumable ? "CON" : "EQ"
    };
  }

  function buildCostTemplateKeywords(entry, label, category) {
    return [
      label,
      category,
      entry?.equipment,
      entry?.manufacturer,
      entry?.specification,
      entry?.description,
      entry?.costCode,
      entry?.unit
    ]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase())
      .filter(Boolean);
  }

  function buildManagedCostPaletteItems(category) {
    const templates = category === EQUIPMENT_CATEGORY ? getEquipmentRateTemplates() : getConsumableRateTemplates();
    const customTemplate = normalizeCostTemplate({}, category, {
      name: category === EQUIPMENT_CATEGORY ? CUSTOM_EQUIPMENT_ID : CUSTOM_CONSUMABLE_ID,
      label: category === EQUIPMENT_CATEGORY ? "Custom Equipment" : "Custom Consumable",
      billingModel: category === EQUIPMENT_CATEGORY ? "hourly" : "quantity",
      unit: category === EQUIPMENT_CATEGORY ? "Hour" : "Unit",
      customResource: true,
      description: "Manual costed resource"
    });
    return [customTemplate, ...templates];
  }

  function isCostedResourceObject(object) {
    return Boolean(
      object?.objectType === ICON_MARKER_OBJECT_TYPE
      && COSTED_RESOURCE_CATEGORIES.has(String(object?.fields?.resourceCategory || ""))
    );
  }

  function collectFieldEntries(object) {
    if (isCostedResourceObject(object)) {
      return COSTED_RESOURCE_FIELD_DEFS.map((fieldDef) => ({
        ...fieldDef,
        value: getEditableCostFieldValue(object, fieldDef.key)
      }));
    }
    if (isIsolationZoneObject(object)) {
      return [];
    }
    const template = resolveTemplateForObject(object);
    if (template?.fieldDefs?.length) {
      return template.fieldDefs.map((fieldDef) => ({
        ...fieldDef,
        value: object.fields?.[fieldDef.key] ?? template.defaults?.[fieldDef.key] ?? ""
      }));
    }
    const merged = { ...(template?.defaults || {}), ...(object.fields || {}) };
    if (object.objectType === ICON_MARKER_OBJECT_TYPE) {
      delete merged.iconId;
      delete merged.iconCategory;
      delete merged.iconLabel;
      delete merged.iconAssetPath;
      delete merged.iconMarkerSize;
    }
    return Object.entries(merged).map(([key, value]) => ({
      key,
      label: key,
      type: "text",
      value: value ?? ""
    }));
  }

  function getEditableCostFieldValue(object, key) {
    const fields = object?.fields || {};
    if (key === "placedAt" || key === "demobilizedAt") {
      return isoToInputValue(fields[key]);
    }
    return fields[key] ?? "";
  }

  function buildInitialFields(template) {
    const fields = { ...(template.defaults || {}) };
    if (template.objectType === "IncidentCommand") {
      const workspaceSession = getWorkspaceSession();
      fields.incidentName = fields.incidentName || elements.incidentNameInput.value.trim() || workspaceSession?.incidentName || "";
      fields.ICName = fields.ICName || workspaceSession?.commanderName || state.commanderAuth?.displayName || "";
    }
    return fields;
  }

  function buildInitialCostFields(template) {
    const nowIso = new Date().toISOString();
    return {
      displayLabel: template.label,
      resourceType: template.customResource ? "custom" : "catalog",
      resourceTemplateId: template.id,
      resourceCategory: template.category,
      company: "",
      billingModel: template.billingModel || "hourly",
      unit: template.unit || "Unit",
      quantity: 1,
      costRate: Number(template.costRate || 0) || 0,
      costCode: template.costCode || "",
      description: template.description || "",
      manufacturer: template.manufacturer || "",
      specification: template.specification || "",
      customResource: Boolean(template.customResource),
      placedAt: nowIso,
      demobilizedAt: "",
      notes: ""
    };
  }

  function buildObjectTooltip(object) {
    const template = resolveTemplateForObject(object);
    const author = state.participants.find((participant) => participant.id === object.createdByParticipantId);
    const parts = [getObjectDisplayLabel(object, template)];
    if (isCostedResourceObject(object)) {
      parts.push(`${object.fields?.resourceCategory || "Costed Resource"} · ${formatCurrency(getCostedResourceTotal(object))}`);
    } else if (object.objectType === MAP_NOTE_OBJECT_TYPE) {
      parts.push(formatMapNotePriority(object.fields?.priority));
      if (object.fields?.noteText) {
        parts.push(String(object.fields.noteText).replace(/\s+/g, " ").trim().slice(0, 72));
      }
    } else if (isIsolationZoneObject(object)) {
      const unit = object.fields?.distanceUnit || "ft";
      const distanceMeters = object.objectType === ISOLATION_ZONE_OBJECT_TYPE
        ? Number(object.fields?.initialMeters || 0)
        : Number(object.fields?.evacMeters || 0);
      parts.push(`${Math.round(convertMetersToDistance(distanceMeters, unit))} ${unit} · wind ${Math.round(Number(object.fields?.windFrom || 0))}°`);
    } else if (object.objectType === ICON_MARKER_OBJECT_TYPE && object.fields?.iconCategory) {
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

    buildManagedCostPaletteItems(EQUIPMENT_CATEGORY).forEach((item) => {
      ensureGroup(EQUIPMENT_CATEGORY).items.push(item);
    });
    buildManagedCostPaletteItems(CONSUMABLES_CATEGORY).forEach((item) => {
      ensureGroup(CONSUMABLES_CATEGORY).items.push(item);
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

  function createCostedMarkerTemplate(costTemplate) {
    return {
      ...ICON_MARKER_TEMPLATE,
      kind: "costed",
      label: costTemplate.label,
      category: costTemplate.category,
      defaults: {
        ...ICON_MARKER_TEMPLATE.defaults,
        ...buildInitialCostFields(costTemplate)
      }
    };
  }

  function buildIconMarkerIcon(object, template) {
    if (isCostedResourceObject(object)) {
      const category = String(object.fields?.resourceCategory || "").toUpperCase();
      const badge = category.startsWith("CON") ? "CON" : "EQ";
      const total = formatCurrency(getCostedResourceTotal(object));
      return L.divIcon({
        className: "",
        html: `
          <div class="cost-marker ${badge === "CON" ? "consumable" : "equipment"}">
            <div class="cost-marker-badge">${escapeHtml(badge)}</div>
            <div class="cost-marker-body">
              <strong>${escapeHtml(object.fields?.displayLabel || template?.label || "Resource")}</strong>
              <span>${escapeHtml(total)}</span>
            </div>
          </div>
        `,
        iconSize: [96, 44],
        iconAnchor: [48, 22]
      });
    }
    const iconSize = Number(object.fields?.iconMarkerSize || 40);
    const safeSize = Number.isFinite(iconSize) && iconSize > 0 ? iconSize : 40;
    return L.divIcon({
      className: "",
      html: `<img class="point-marker-icon" style="width:${escapeAttribute(String(safeSize))}px;height:${escapeAttribute(String(safeSize))}px" src="${escapeAttribute(resolveAssetPath(object.fields.iconAssetPath))}" alt="${escapeAttribute(object.fields.iconLabel || template?.label || "Map icon")}" />`,
      iconSize: [safeSize, safeSize],
      iconAnchor: [safeSize / 2, safeSize / 2]
    });
  }

  function buildMapNoteIcon(object) {
    const priority = normalizeMapNotePriority(object?.fields?.priority);
    const noteLabel = object?.fields?.title ? escapeHtml(String(object.fields.title).trim().slice(0, 18)) : "Note";
    return L.divIcon({
      className: "",
      html: `
        <div class="map-note-marker map-note-${escapeAttribute(priority)}">
          <div class="map-note-marker-corner"></div>
          <div class="map-note-marker-glyph">N</div>
          <div class="map-note-marker-label">${noteLabel}</div>
        </div>
      `,
      iconSize: [86, 52],
      iconAnchor: [18, 26]
    });
  }

  function buildPointObjectIcon(object, template, color) {
    if (object.objectType === MAP_NOTE_OBJECT_TYPE) {
      return buildMapNoteIcon(object);
    }
    if (object.objectType === ICON_MARKER_OBJECT_TYPE && object.fields?.iconAssetPath) {
      return buildIconMarkerIcon(object, template);
    }
    return L.divIcon({
      className: "",
      html: `<div class="point-marker" style="background:${escapeAttribute(color)}"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  function findIconBySelectionKey(selectionKey) {
    return (state.iconCatalog.icons || []).find((icon) => `icon:${icon.id}` === selectionKey) || null;
  }

  function findCostTemplateBySelectionKey(selectionKey) {
    return [...buildManagedCostPaletteItems(EQUIPMENT_CATEGORY), ...buildManagedCostPaletteItems(CONSUMABLES_CATEGORY)]
      .find((item) => item.selectionKey === selectionKey) || null;
  }

  function resolveTemplateForObject(object) {
    if (object?.objectType === ICON_MARKER_OBJECT_TYPE) {
      if (isCostedResourceObject(object)) {
        return {
          ...ICON_MARKER_TEMPLATE,
          kind: "costed",
          label: object.fields?.displayLabel || object.fields?.iconLabel || ICON_MARKER_TEMPLATE.label,
          category: object.fields?.resourceCategory || object.fields?.iconCategory || ICON_MARKER_TEMPLATE.category,
          assetPath: object.fields?.iconAssetPath || "",
          billingModel: object.fields?.billingModel || "hourly",
          unit: object.fields?.unit || "Unit",
          costRate: Number(object.fields?.costRate || 0) || 0
        };
      }
      return {
        ...ICON_MARKER_TEMPLATE,
        label: object.fields?.iconLabel || ICON_MARKER_TEMPLATE.label,
        category: object.fields?.iconCategory || ICON_MARKER_TEMPLATE.category,
        assetPath: object.fields?.iconAssetPath || ""
      };
    }
    return templateByType[object?.objectType];
  }

  function getObjectDisplayLabel(object, template = resolveTemplateForObject(object)) {
    if (isCostedResourceObject(object)) {
      return object.fields?.displayLabel || template?.label || "Costed Resource";
    }
    if (object?.objectType === MAP_NOTE_OBJECT_TYPE) {
      return object.fields?.title || template?.label || "Map Note";
    }
    return template?.label || object?.objectType || "Object";
  }

  function normalizeMapNotePriority(value) {
    const normalized = String(value || "info").trim().toLowerCase();
    if (normalized === "urgent") return "urgent";
    if (normalized === "important") return "important";
    return "info";
  }

  function formatMapNotePriority(value) {
    const normalized = normalizeMapNotePriority(value);
    if (normalized === "urgent") return "Urgent";
    if (normalized === "important") return "Important";
    return "Info";
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

  function getSupabaseAuthErrorDetails(payload, response) {
    return (
      payload?.msg_description ||
      payload?.error_description ||
      payload?.error ||
      payload?.message ||
      `HTTP ${response.status}`
    );
  }

  function getFriendlySupabaseAuthError(payload, response, flow = "auth") {
    const details = String(getSupabaseAuthErrorDetails(payload, response) || "").trim();
    const normalized = details.toLowerCase();

    if (flow === "signup") {
      if (
        normalized.includes("already registered")
        || normalized.includes("already exists")
        || normalized.includes("already been registered")
        || normalized.includes("user already registered")
      ) {
        return "This email already has an account. Try Sign In or Forgot Password.";
      }
      if (
        response.status === 422
        || normalized.includes("stale")
        || normalized.includes("signup")
      ) {
        return "This signup is stuck in a stale state. Reset password or contact support.";
      }
    }

    if (
      normalized.includes("email not confirmed")
      || normalized.includes("email address not authorized")
      || normalized.includes("confirm your email")
      || normalized.includes("email link")
    ) {
      return "Your email still needs to be confirmed. Check your inbox.";
    }

    return `Supabase auth request failed: ${details}`;
  }

  async function parseSupabaseAuthResponse(response, options = {}) {
    const payload = await parseJsonSafely(response);
    if (!response.ok) {
      throw new Error(getFriendlySupabaseAuthError(payload, response, options.flow));
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

  function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function formatCurrency(value) {
    return `$${round2(value).toFixed(2)}`;
  }

  function getCostedResourceObjects() {
    return Array.from(state.objects.values()).filter((object) => !object.isDeleted && isCostedResourceObject(object));
  }

  function isHourlyBillingModel(model) {
    return String(model || "hourly").toLowerCase() === "hourly";
  }

  function getCostedResourceQuantity(object) {
    const raw = Number(object?.fields?.quantity);
    if (!Number.isFinite(raw) || raw < 0) return 1;
    return raw;
  }

  function getCostedResourceDurationHours(object) {
    const placedAt = object?.fields?.placedAt;
    if (!placedAt) return 0;
    const start = new Date(placedAt).getTime();
    if (!Number.isFinite(start)) return 0;
    const end = object?.fields?.demobilizedAt
      ? new Date(object.fields.demobilizedAt).getTime()
      : Date.now();
    if (!Number.isFinite(end) || end < start) return 0;
    return round2((end - start) / 3600000);
  }

  function getCostedResourceTotal(object) {
    const rate = Number(object?.fields?.costRate) || 0;
    if (isHourlyBillingModel(object?.fields?.billingModel)) {
      return round2(getCostedResourceDurationHours(object) * rate);
    }
    return round2(getCostedResourceQuantity(object) * rate);
  }

  function getCostSummaryTotals() {
    const totals = {
      equipment: 0,
      consumables: 0,
      grandTotal: 0,
      count: 0
    };
    getCostedResourceObjects().forEach((object) => {
      const total = getCostedResourceTotal(object);
      if (object.fields?.resourceCategory === EQUIPMENT_CATEGORY) {
        totals.equipment += total;
      } else if (object.fields?.resourceCategory === CONSUMABLES_CATEGORY) {
        totals.consumables += total;
      }
      totals.grandTotal += total;
      totals.count += 1;
    });
    totals.equipment = round2(totals.equipment);
    totals.consumables = round2(totals.consumables);
    totals.grandTotal = round2(totals.grandTotal);
    return totals;
  }

  function renderCostSummary() {
    if (!elements.costSummaryBody || !elements.costSummaryPanel) return;
    const totals = getCostSummaryTotals();
    const visible = Boolean(state.activeSession) || isScenarioReviewMode();
    elements.costSummaryPanel.classList.toggle("hidden", !visible);
    if (!visible) return;
    if (!totals.count) {
      elements.costSummaryBody.innerHTML = `<div class="muted">No costed resources placed yet.</div>`;
      return;
    }
    elements.costSummaryBody.innerHTML = `
      <div class="cost-summary-row"><span>Equipment</span><strong>${escapeHtml(formatCurrency(totals.equipment))}</strong></div>
      <div class="cost-summary-row"><span>Consumables</span><strong>${escapeHtml(formatCurrency(totals.consumables))}</strong></div>
      <div class="cost-summary-row total"><span>Total</span><strong>${escapeHtml(formatCurrency(totals.grandTotal))}</strong></div>
      <div class="cost-summary-foot muted">${escapeHtml(`${totals.count} costed item${totals.count === 1 ? "" : "s"} in this ${isScenarioReviewMode() ? "scenario" : "session"}`)}</div>
    `;
  }

  function renderExportActions() {
    const visible = (Boolean(state.activeSession) || isScenarioReviewMode()) && !state.viewerMode;
    const hasCostRows = Boolean(getCostedResourceObjects().length);
    const hasMapObjects = Boolean(state.layers.size);
    elements.printExportBtn.classList.toggle("hidden", !visible);
    if (!visible) {
      hidePrintExportModal();
    }
    elements.printExportBtn.disabled = !visible || (!hasMapObjects && !hasCostRows);
    elements.exportCostCsvBtn.disabled = !hasCostRows;
    elements.exportCostPdfBtn.disabled = !hasCostRows;
    elements.printMapBtn.disabled = !hasMapObjects;
    elements.exportMapPdfBtn.disabled = !hasMapObjects;
    if (elements.printExportModalNote) {
      elements.printExportModalNote.textContent = hasMapObjects
        ? "Map output fits to the full extent of mapped items with a buffer around the edges and opens a save/share sheet on supported devices."
        : "Place one or more map items to enable map print and PDF export.";
    }
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

  function isViewerAccessDisabledError(error) {
    return error?.payload?.error === "VIEWER_ACCESS_DISABLED";
  }

  function formatError(error) {
    if (!error) return "Unknown error.";
    if (typeof error === "string") return error;
    if (isViewerAccessDisabledError(error)) {
      return error?.message || "Viewer access has been turned off for this session.";
    }
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

  function formatDateTimeForExport(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
  }

  function normalizeCostRowsForExport() {
    return getCostedResourceObjects().map((object) => ({
      objectId: object.id,
      label: object.fields?.displayLabel || resolveTemplateForObject(object)?.label || "Costed Resource",
      category: object.fields?.resourceCategory || "",
      company: object.fields?.company || "",
      billingModel: object.fields?.billingModel || "hourly",
      unit: object.fields?.unit || "Unit",
      quantity: round2(getCostedResourceQuantity(object)),
      durationHours: round2(getCostedResourceDurationHours(object)),
      costRate: round2(Number(object.fields?.costRate || 0) || 0),
      totalCost: round2(getCostedResourceTotal(object)),
      costCode: object.fields?.costCode || "",
      placedAt: object.fields?.placedAt || "",
      demobilizedAt: object.fields?.demobilizedAt || "",
      notes: object.fields?.notes || "",
      createdBy: state.participants.find((participant) => participant.id === object.createdByParticipantId)?.displayName || object.createdByParticipantId || "",
      lat: Number(object.geometry?.lat),
      lng: Number(object.geometry?.lng)
    }));
  }

  function getMapExportLayers() {
    return Array.from(state.layers.values()).filter((layer) => {
      try {
        return Boolean(layer && (typeof layer.getBounds === "function" || typeof layer.getLatLng === "function"));
      } catch (_error) {
        return false;
      }
    });
  }

  function getMapExportBounds() {
    const layers = getMapExportLayers();
    if (!layers.length) return null;
    try {
      return L.featureGroup(layers).getBounds();
    } catch (_error) {
      return null;
    }
  }

  function waitForMapMoveEnd() {
    return new Promise((resolve) => {
      if (!state.map) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      state.map.once("moveend", () => {
        window.requestAnimationFrame(() => {
          window.setTimeout(finish, 180);
        });
      });
      window.setTimeout(finish, 600);
    });
  }

  function waitForActiveTilesLoaded() {
    return new Promise((resolve) => {
      const layer = state.baseLayers?.[state.activeBaseLayerKey];
      if (!layer || !layer._loading) {
        window.setTimeout(resolve, 250);
        return;
      }
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        resolve();
      };
      layer.once("load", () => {
        window.setTimeout(done, 200);
      });
      window.setTimeout(done, 2000);
    });
  }

  const EXPORT_LIBRARY_CANDIDATES = {
    html2canvas: [
      "../../vendor/html2canvas-1.4.1.min.js",
      "/vendor/html2canvas-1.4.1.min.js",
      "../vendor/html2canvas-1.4.1.min.js",
      "./vendor/html2canvas-1.4.1.min.js"
    ],
    jspdf: [
      "../../vendor/jspdf-2.5.1.umd.min.js",
      "/vendor/jspdf-2.5.1.umd.min.js",
      "../vendor/jspdf-2.5.1.umd.min.js",
      "./vendor/jspdf-2.5.1.umd.min.js"
    ],
    autotable: [
      "../../vendor/jspdf-autotable-3.8.2.min.js",
      "/vendor/jspdf-autotable-3.8.2.min.js",
      "../vendor/jspdf-autotable-3.8.2.min.js",
      "./vendor/jspdf-autotable-3.8.2.min.js"
    ]
  };
  const exportLibraryPromises = new Map();

  function hasExportLibrary(name) {
    if (name === "html2canvas") return typeof window.html2canvas === "function";
    if (name === "jspdf") return Boolean(window.jspdf?.jsPDF);
    if (name === "autotable") {
      return Boolean(window.jspdf?.jsPDF?.API?.autoTable || window.jspdf?.jsPDF?.API?.autoTableSetDefaults);
    }
    return false;
  }

  function loadScriptCandidate(src, globalCheck) {
    return new Promise((resolve, reject) => {
      if (globalCheck()) {
        resolve(true);
        return;
      }
      const existing = document.querySelector(`script[data-export-lib-src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(true), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.exportLibSrc = src;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function ensureExportLibrary(name) {
    if (hasExportLibrary(name)) return true;
    if (exportLibraryPromises.has(name)) {
      return exportLibraryPromises.get(name);
    }
    const promise = (async () => {
      const candidates = EXPORT_LIBRARY_CANDIDATES[name] || [];
      for (const src of candidates) {
        try {
          await loadScriptCandidate(src, () => hasExportLibrary(name));
          if (hasExportLibrary(name)) {
            return true;
          }
        } catch (_error) {
          // Try the next candidate path.
        }
      }
      return false;
    })();
    exportLibraryPromises.set(name, promise);
    const loaded = await promise;
    if (!loaded) {
      exportLibraryPromises.delete(name);
    }
    return loaded;
  }

  async function ensureExportLibraries(options = {}) {
    const needsPdf = Boolean(options.pdf);
    const needsAutoTable = Boolean(options.autoTable);
    const html2canvasReady = await ensureExportLibrary("html2canvas");
    if (!html2canvasReady) {
      return { ok: false, message: "Map capture library unavailable." };
    }
    if (needsPdf) {
      const jspdfReady = await ensureExportLibrary("jspdf");
      if (!jspdfReady) {
        return { ok: false, message: "PDF library unavailable." };
      }
    }
    if (needsAutoTable) {
      const autoTableReady = await ensureExportLibrary("autotable");
      if (!autoTableReady) {
        return { ok: false, message: "PDF table library unavailable." };
      }
    }
    return { ok: true };
  }

  function buildMapPrintMarkup(imageDataUrl) {
    const incidentName = state.activeSession?.incidentName || state.scenarioReview?.incidentName || "Collaborative Incident";
    const exportedAt = new Date().toLocaleString();
    const totalItems = state.layers.size;
    return `
      <div class="map-print-sheet">
        <div class="map-print-header">
          <div class="map-print-title">ICS Collaborative Map</div>
          <div class="map-print-meta">
            <div>${escapeHtml(incidentName)}</div>
            <div>${escapeHtml(exportedAt)}</div>
          </div>
        </div>
        <div class="map-print-frame">
          <img src="${escapeAttribute(imageDataUrl)}" alt="Printed collaborative map" />
        </div>
        <div class="map-print-footer">
          <span>${escapeHtml(`${totalItems} mapped item${totalItems === 1 ? "" : "s"}`)}</span>
          <span>Buffered to full mapped extent</span>
        </div>
      </div>
    `;
  }

  async function captureBufferedMapImage() {
    if (!state.map || !elements.map) {
      setStatus("Map is unavailable.");
      return null;
    }
    const bounds = getMapExportBounds();
    if (!bounds || !bounds.isValid()) {
      setStatus("Place one or more map items before printing the map.");
      return null;
    }
    const exportLibraries = await ensureExportLibraries();
    if (!exportLibraries.ok) {
      setStatus(exportLibraries.message);
      return null;
    }

    const previousCenter = state.map.getCenter();
    const previousZoom = state.map.getZoom();
    const previousMapStyleTrayOpen = state.mapStyleTrayOpen;
    const previousWeatherPanelOpen = state.weatherPanelOpen;
    hidePrintExportModal();
    closeMapStyleTray();
    state.weatherPanelOpen = false;
    renderWeatherPanel();

    try {
      state.map.invalidateSize({ pan: false, animate: false });
      state.map.fitBounds(bounds.pad(0.18), {
        padding: [56, 56],
        maxZoom: 16,
        animate: false
      });
      await waitForMapMoveEnd();
      await waitForActiveTilesLoaded();
      const canvas = await window.html2canvas(elements.map, {
        backgroundColor: "#ffffff",
        useCORS: true,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        logging: false
      });
      return {
        imageDataUrl: canvas.toDataURL("image/png"),
        width: canvas.width,
        height: canvas.height
      };
    } catch (error) {
      console.error("Unable to capture map export.", error);
      setStatus("Map capture failed.");
      return null;
    } finally {
      state.mapStyleTrayOpen = previousMapStyleTrayOpen;
      renderMapStyleTray();
      state.weatherPanelOpen = previousWeatherPanelOpen;
      renderWeatherPanel();
      state.map.setView(previousCenter, previousZoom, { animate: false });
      await waitForMapMoveEnd();
      await waitForActiveTilesLoaded();
      scheduleMapResizeRefresh();
    }
  }

  function printMapMarkup(markup) {
    if (!elements.mapPrintRoot) return;
    elements.mapPrintRoot.innerHTML = markup;
    document.body.classList.add("print-map");
    const cleanup = () => {
      document.body.classList.remove("print-map");
      elements.mapPrintRoot.innerHTML = "";
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 1200);
  }

  async function printMapExport() {
    const capture = await captureBufferedMapImage();
    if (!capture) return;
    const filename = buildExportFilename("map", "png");
    const blob = await (await fetch(capture.imageDataUrl)).blob();
    if (window.exportPdfHelper?.saveAndShareBlob) {
      try {
        const result = await window.exportPdfHelper.saveAndShareBlob(blob, filename, {
          title: "Save Map",
          text: "Save or share this collaborative map image.",
          dialogTitle: "Save Map",
          requireSharePrompt: true
        });
        if (result?.shared) {
          setStatus(`Map image shared: ${filename}`);
        } else if (result?.uri) {
          setStatus(`Map image saved locally: ${filename}`);
        } else {
          setStatus(`Map image prepared: ${filename}`);
        }
        return;
      } catch (error) {
        console.error("Unable to open map image save/share prompt.", error);
      }
    }
    await downloadBlob(blob, filename);
    setStatus(`Map image downloaded: ${filename}`);
  }

  async function exportMapPdf() {
    const capture = await captureBufferedMapImage();
    if (!capture) return;
    const exportLibraries = await ensureExportLibraries({ pdf: true });
    if (!exportLibraries.ok) {
      setStatus(exportLibraries.message);
      return;
    }
    const jspdfNs = window.jspdf;
    if (!jspdfNs?.jsPDF) {
      setStatus("PDF library unavailable.");
      return;
    }
    const { jsPDF } = jspdfNs;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 28;
    const headerHeight = 42;
    const footerHeight = 20;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2 - headerHeight - footerHeight;
    const imageRatio = capture.width / capture.height;
    let imageW = usableW;
    let imageH = imageW / imageRatio;
    if (imageH > usableH) {
      imageH = usableH;
      imageW = imageH * imageRatio;
    }
    const incidentName = state.activeSession?.incidentName || state.scenarioReview?.incidentName || "Collaborative Incident";
    const exportedAt = new Date().toLocaleString();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("ICS Collaborative Map", margin, margin + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(incidentName, margin, margin + 30);
    doc.text(exportedAt, pageW - margin, margin + 14, { align: "right" });
    doc.addImage(capture.imageDataUrl, "PNG", margin, margin + headerHeight, imageW, imageH);
    doc.setDrawColor(0, 0, 0);
    doc.rect(margin, margin + headerHeight, imageW, imageH);
    doc.setFontSize(9);
    doc.text(`${state.layers.size} mapped item${state.layers.size === 1 ? "" : "s"} | buffered to mapped extent`, margin, pageH - margin);

    const blob = doc.output("blob");
    const filename = buildExportFilename("map", "pdf");
    if (window.exportPdfHelper?.saveAndSharePdfBlob) {
      try {
        const result = await window.exportPdfHelper.saveAndSharePdfBlob(blob, filename);
        if (result?.shared) {
          setStatus(`Map PDF shared: ${filename}`);
        } else if (result?.uri) {
          setStatus(`Map PDF saved locally: ${filename}`);
        } else {
          setStatus(`Map PDF prepared: ${filename}`);
        }
        return;
      } catch (error) {
        console.error("Unable to open map PDF share/save prompt.", error);
      }
    }
    await downloadBlob(blob, filename);
    setStatus(`Map PDF downloaded: ${filename}`);
  }

  async function exportCostCsv() {
    hidePrintExportModal();
    const rows = normalizeCostRowsForExport();
    if (!rows.length) {
      setStatus("No costed resources to export.");
      return;
    }
    const header = [
      "Object ID",
      "Item",
      "Category",
      "Company / Agency",
      "Billing Model",
      "Unit",
      "Quantity",
      "Duration Hours",
      "Cost Rate",
      "Total Cost",
      "Cost Code",
      "Placed Time",
      "Demobilized Time",
      "Created By",
      "Latitude",
      "Longitude",
      "Notes"
    ];
    const csvRows = rows.map((row) => [
      row.objectId,
      row.label,
      row.category,
      row.company,
      row.billingModel,
      row.unit,
      row.quantity.toFixed(2),
      row.durationHours.toFixed(2),
      row.costRate.toFixed(2),
      row.totalCost.toFixed(2),
      row.costCode,
      formatDateTimeForExport(row.placedAt),
      formatDateTimeForExport(row.demobilizedAt),
      row.createdBy,
      Number.isFinite(row.lat) ? row.lat.toFixed(5) : "",
      Number.isFinite(row.lng) ? row.lng.toFixed(5) : "",
      String(row.notes || "").replace(/\n/g, " ")
    ]);
    const csv = [header.join(","), ...csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const filename = buildExportFilename("cost-summary", "csv");
    if (window.exportPdfHelper?.saveAndShareBlob) {
      try {
        const result = await window.exportPdfHelper.saveAndShareBlob(blob, filename, {
          title: "Export Cost CSV",
          text: "Here is the collaborative map cost export.",
          dialogTitle: "Share CSV",
          requireSharePrompt: true
        });
        setStatus(result?.shared ? `CSV shared: ${filename}` : `CSV saved: ${filename}`);
        return;
      } catch (_error) {
        // Fall back to browser download.
      }
    }
    await downloadBlob(blob, filename);
    setStatus("Cost CSV exported.");
  }

  async function exportCostPdf() {
    hidePrintExportModal();
    const rows = normalizeCostRowsForExport();
    if (!rows.length) {
      setStatus("No costed resources to export.");
      return;
    }
    const exportLibraries = await ensureExportLibraries({ pdf: true, autoTable: true });
    if (!exportLibraries.ok) {
      setStatus(exportLibraries.message);
      return;
    }
    const jspdfNs = window.jspdf;
    if (!jspdfNs?.jsPDF) {
      setStatus("PDF library unavailable.");
      return;
    }
    const { jsPDF } = jspdfNs;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 36;
    const incidentName = state.activeSession?.incidentName || "Collaborative Incident";
    const totals = getCostSummaryTotals();
    const exportedAt = new Date().toLocaleString();

    doc.setFillColor(13, 21, 36);
    doc.rect(0, 0, pageW, 52, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("ICS Collaborative Map Cost Report", margin, 32);
    doc.setTextColor(17, 17, 17);
    doc.setFontSize(11);
    doc.text(`Incident: ${incidentName}`, margin, 78);
    doc.text(`Exported: ${exportedAt}`, margin, 94);
    doc.text(`Equipment: ${formatCurrency(totals.equipment)}   Consumables: ${formatCurrency(totals.consumables)}   Total: ${formatCurrency(totals.grandTotal)}`, margin, 110);

    const body = rows.map((row) => [
      row.label,
      row.category,
      row.company,
      row.billingModel,
      row.unit,
      row.quantity.toFixed(2),
      row.durationHours.toFixed(2),
      formatCurrency(row.costRate),
      formatCurrency(row.totalCost),
      formatDateTimeForExport(row.placedAt),
      formatDateTimeForExport(row.demobilizedAt),
      row.notes || ""
    ]);

    if (typeof doc.autoTable === "function") {
      doc.autoTable({
        startY: 126,
        head: [[
          "Item",
          "Category",
          "Company",
          "Billing",
          "Unit",
          "Qty",
          "Hours",
          "Rate",
          "Total",
          "Placed",
          "Demob",
          "Notes"
        ]],
        body,
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fillColor: [243, 245, 248], textColor: [17, 17, 17] },
        margin: { left: margin, right: margin, bottom: 34 }
      });
    }

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(210, 215, 224);
      doc.line(margin, pageH - 28, pageW - margin, pageH - 28);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80, 88, 98);
      doc.text(`${incidentName}`, margin, pageH - 14);
      doc.text(`Page ${page} of ${totalPages}`, pageW - margin, pageH - 14, { align: "right" });
    }

    const blob = doc.output("blob");
    const filename = buildExportFilename("cost-report", "pdf");
    if (window.exportPdfHelper?.saveAndSharePdfBlob) {
      try {
        const result = await window.exportPdfHelper.saveAndSharePdfBlob(blob, filename);
        if (result?.shared) {
          setStatus(`PDF shared: ${filename}`);
        } else if (result?.uri) {
          setStatus(`PDF saved locally: ${filename}`);
        } else {
          setStatus(`PDF prepared: ${filename}`);
        }
        return;
      } catch (_error) {
        // Fall back to browser download.
      }
    }
    await downloadBlob(blob, filename);
    setStatus(`PDF exported: ${filename}`);
  }

  function buildExportFilename(baseName, extension) {
    const incident = String(state.activeSession?.incidentName || state.scenarioReview?.incidentName || "incident")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "incident";
    return `${incident}-${baseName}-${Date.now()}.${extension}`;
  }

  function isIosLikeDevice() {
    const ua = navigator.userAgent || "";
    const iOSUa = /iPad|iPhone|iPod/.test(ua);
    const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return iOSUa || iPadOs;
  }

  async function downloadBlob(blob, filename) {
    try {
      if (isIosLikeDevice() && typeof File === "function" && navigator.share) {
        const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
        const payload = { files: [file], title: filename };
        const canShare = typeof navigator.canShare === "function" ? navigator.canShare(payload) : true;
        if (canShare) {
          await navigator.share(payload);
          return;
        }
      }
    } catch (_error) {
      // Fall through to download anchor.
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
