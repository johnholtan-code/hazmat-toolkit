window.ICS_COLLAB_CONFIG = {
  apiBaseUrl: "https://hazmat-toolkit-api-75ct.onrender.com",
  supabaseUrl: "https://domebvsyhexhgvsducbm.supabase.co",
  // This can be left blank if the backend exposes SUPABASE_ANON_KEY via /v1/ics-collab/meta.
  supabaseAnonKey: "",

  // Geocoding service configuration
  // Options:
  //   - "nominatim" (free, limited coverage, no API key needed)
  //   - "opencage" (free tier up to 2,500 requests/day, excellent rural address coverage)
  //   - "google" (best coverage, requires API key and billing)
  geocodeProvider: "opencage",

  // OpenCage Geocoding: Get a FREE API key at https://opencagedata.com/sign-up
  // Free tier includes 2,500 requests per day, which is suitable for most incident mapping use cases.
  // This provides excellent coverage for rural fire academies and emergency facilities.
  opencageApiKey: "4b3d901770ad44ba959215ab8f6423eb",

  // Alternative: Google Maps Geocoding API key (requires setting up billing)
  // Sign up at: https://console.cloud.google.com
  // googleMapsApiKey: ""
};
