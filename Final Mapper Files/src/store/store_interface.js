export const ACTION_TYPES = Object.freeze({
  MAP_ITEM_ADD: "MAP_ITEM_ADD",
  MAP_ITEM_UPDATE: "MAP_ITEM_UPDATE",
  MAP_ITEM_REMOVE: "MAP_ITEM_REMOVE",
  SHAPE_ADD: "SHAPE_ADD",
  SHAPE_UPDATE: "SHAPE_UPDATE",
  SHAPE_REMOVE: "SHAPE_REMOVE",
  BASEMAP_SET: "BASEMAP_SET",
  STAGING_ENTRY_ADD: "STAGING_ENTRY_ADD",
  STAGING_ENTRY_UPDATE: "STAGING_ENTRY_UPDATE",
  STAGING_ENTRY_DEMOBILIZE: "STAGING_ENTRY_DEMOBILIZE",
  TIMELINE_EVENT_ADD: "TIMELINE_EVENT_ADD",
  NOTE_ADD: "NOTE_ADD",
  OP_CREATE: "OP_CREATE",
  OP_SET_ACTIVE: "OP_SET_ACTIVE",
  OP_LOCK: "OP_LOCK"
});

export class StoreInterface {
  async listIncidents() {
    throw new Error("Not implemented");
  }

  async createIncident(_input) {
    throw new Error("Not implemented");
  }

  async loadIncident(_incidentId) {
    throw new Error("Not implemented");
  }

  async getState(_incidentId, _operatingPeriodId) {
    throw new Error("Not implemented");
  }

  async applyAction(_action) {
    throw new Error("Not implemented");
  }

  async lockOperatingPeriod(_input) {
    throw new Error("Not implemented");
  }

  async createAmendment(_input) {
    throw new Error("Not implemented");
  }
}
