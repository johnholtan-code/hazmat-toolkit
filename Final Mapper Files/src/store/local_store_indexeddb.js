import { ACTION_TYPES, StoreInterface } from "./store_interface.js";
import { stableStringify } from "../utils/canonical_json.js";
import { sha256Hex } from "../utils/hash.js";

const DB_NAME = "hazmat_phase1_store";
const DB_VERSION = 1;

const STORES = {
  incidents: "incidents",
  operatingPeriods: "operatingPeriods",
  workingStates: "workingStates",
  snapshots: "snapshots",
  timelineEvents: "timelineEvents",
  amendments: "amendments",
  meta: "meta"
};

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function randomSegment(length = 6) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function normalizeAuthor(author) {
  return {
    name: (author?.name || "Unknown").trim() || "Unknown",
    role: (author?.role || "Observer").trim() || "Observer",
    agency: (author?.agency || "").trim() || undefined
  };
}

function keyForState(incidentId, operatingPeriodId) {
  return `${incidentId}|${operatingPeriodId}`;
}

function decodePointer(path) {
  if (!path || path === "/") return [];
  return path
    .split("/")
    .slice(1)
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function getAtPath(doc, segments) {
  return segments.reduce((acc, seg) => (acc == null ? undefined : acc[seg]), doc);
}

function applySinglePatch(doc, operation) {
  const out = clone(doc);
  const segments = decodePointer(operation.path);
  const leaf = segments[segments.length - 1];
  const parentPath = segments.slice(0, -1);
  const parent = parentPath.length ? getAtPath(out, parentPath) : out;
  if (segments.length > 0 && parent == null) {
    throw new Error(`Patch path not found: ${operation.path}`);
  }

  if (operation.op === "replace" || operation.op === "add") {
    if (segments.length === 0) {
      return clone(operation.value);
    }
    if (Array.isArray(parent) && leaf === "-") {
      parent.push(clone(operation.value));
    } else {
      parent[leaf] = clone(operation.value);
    }
    return out;
  }

  if (operation.op === "remove") {
    if (Array.isArray(parent)) {
      parent.splice(Number(leaf), 1);
    } else if (parent && typeof parent === "object") {
      delete parent[leaf];
    }
    return out;
  }

  throw new Error(`Unsupported patch op: ${operation.op}`);
}

function applyPatches(doc, patches = []) {
  return patches.reduce((acc, patchOp) => applySinglePatch(acc, patchOp), clone(doc));
}

export class LocalStoreIndexedDb extends StoreInterface {
  constructor({ dbName = DB_NAME } = {}) {
    super();
    this.dbName = dbName;
    this.dbPromise = this.openDb();
  }

  openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;

        if (!db.objectStoreNames.contains(STORES.incidents)) {
          db.createObjectStore(STORES.incidents, { keyPath: "incidentId" });
        }

        if (!db.objectStoreNames.contains(STORES.operatingPeriods)) {
          const os = db.createObjectStore(STORES.operatingPeriods, { keyPath: "operatingPeriodId" });
          os.createIndex("incidentId", "incidentId", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.workingStates)) {
          db.createObjectStore(STORES.workingStates, { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains(STORES.snapshots)) {
          const os = db.createObjectStore(STORES.snapshots, { keyPath: "snapshotId" });
          os.createIndex("operatingPeriodId", "operatingPeriodId", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.timelineEvents)) {
          const os = db.createObjectStore(STORES.timelineEvents, { keyPath: "eventId" });
          os.createIndex("operatingPeriodId", "operatingPeriodId", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.amendments)) {
          const os = db.createObjectStore(STORES.amendments, { keyPath: "amendmentId" });
          os.createIndex("operatingPeriodId", "operatingPeriodId", { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.meta)) {
          db.createObjectStore(STORES.meta, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async transaction(storeNames, mode, fn) {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      const stores = {};
      storeNames.forEach((name) => {
        stores[name] = tx.objectStore(name);
      });
      const result = fn(stores, tx);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
    });
  }

  requestToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getByKey(storeName, key) {
    return this.transaction([storeName], "readonly", async (stores) => {
      const row = await this.requestToPromise(stores[storeName].get(key));
      return row;
    });
  }

  async put(storeName, value) {
    return this.transaction([storeName], "readwrite", async (stores) => {
      await this.requestToPromise(stores[storeName].put(value));
      return value;
    });
  }

  async allFromIndex(storeName, indexName, key) {
    return this.transaction([storeName], "readonly", async (stores) => {
      const idx = stores[storeName].index(indexName);
      const rows = await this.requestToPromise(idx.getAll(key));
      return rows;
    });
  }

  async all(storeName) {
    return this.transaction([storeName], "readonly", async (stores) => {
      return this.requestToPromise(stores[storeName].getAll());
    });
  }

  async nextCounter(counterKey) {
    const row = await this.getByKey(STORES.meta, counterKey);
    const next = (row?.value || 0) + 1;
    await this.put(STORES.meta, { key: counterKey, value: next });
    return next;
  }

  async clientId() {
    const key = "clientId";
    const row = await this.getByKey(STORES.meta, key);
    if (row?.value) return row.value;
    const value = `CL-${crypto.randomUUID()}`;
    await this.put(STORES.meta, { key, value });
    return value;
  }

  async listIncidents() {
    const incidents = await this.all(STORES.incidents);
    return incidents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createIncident(input) {
    const createdBy = normalizeAuthor(input?.createdBy);
    const createdAt = nowIso();
    const incidentId = `INC-${randomSegment(6)}`;
    const opNumber = 1;
    const operatingPeriodId = `OP-${opNumber}`;

    const incident = {
      incidentId,
      title: (input?.title || "Untitled Incident").trim() || "Untitled Incident",
      createdAt,
      createdBy,
      status: input?.status || "LIVE",
      activeOperatingPeriodId: operatingPeriodId,
      operatingPeriods: [operatingPeriodId]
    };

    const op = {
      operatingPeriodId,
      incidentId,
      opNumber,
      startTime: input?.startTime || createdAt,
      endTime: input?.endTime || createdAt,
      status: "ACTIVE",
      lockedAt: null,
      lockedBy: null,
      snapshotId: null
    };

    const state = {
      key: keyForState(incidentId, operatingPeriodId),
      incidentId,
      operatingPeriodId,
      mapState: { items: [], shapes: [], basemap: "streets" },
      timelineEvents: [],
      stagingLedger: []
    };

    await this.put(STORES.incidents, incident);
    await this.put(STORES.operatingPeriods, op);
    await this.put(STORES.workingStates, state);

    return { incident, operatingPeriod: op };
  }

  async loadIncident(incidentId) {
    const incident = await this.getByKey(STORES.incidents, incidentId);
    if (!incident) throw new Error("Incident not found");
    const ops = await this.allFromIndex(STORES.operatingPeriods, "incidentId", incidentId);
    ops.sort((a, b) => a.opNumber - b.opNumber);
    return { incident, operatingPeriods: ops };
  }

  async getOperatingPeriod(operatingPeriodId) {
    const op = await this.getByKey(STORES.operatingPeriods, operatingPeriodId);
    if (!op) throw new Error("Operating Period not found");
    return op;
  }

  async getState(incidentId, operatingPeriodId) {
    const op = await this.getOperatingPeriod(operatingPeriodId);
    if (op.incidentId !== incidentId) throw new Error("Operating Period does not belong to incident");

    if (op.status === "LOCKED") {
      const snapshot = await this.getByKey(STORES.snapshots, op.snapshotId);
      const amendments = await this.allFromIndex(STORES.amendments, "operatingPeriodId", operatingPeriodId);
      amendments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const overlayRoot = applyPatches(
        {
          mapState: clone(snapshot.mapState),
          stagingLedger: clone(snapshot.stagingLedger),
          timelineEvents: clone(snapshot.timelineEvents || [])
        },
        amendments.flatMap((a) => a.patch || [])
      );

      return {
        incidentId,
        operatingPeriodId,
        status: op.status,
        lockedAt: op.lockedAt,
        lockedBy: clone(op.lockedBy),
        snapshot: clone(snapshot),
        mapState: overlayRoot.mapState || { items: [], shapes: [], basemap: "streets" },
        timelineEvents: overlayRoot.timelineEvents || clone(snapshot.timelineEvents || []),
        stagingLedger: overlayRoot.stagingLedger || clone(snapshot.stagingLedger || []),
        amendments: clone(amendments)
      };
    }

    const state = await this.getByKey(STORES.workingStates, keyForState(incidentId, operatingPeriodId));
    return {
      incidentId,
      operatingPeriodId,
      status: op.status,
      mapState: clone(state?.mapState || { items: [], shapes: [], basemap: "streets" }),
      timelineEvents: clone(state?.timelineEvents || []),
      stagingLedger: clone(state?.stagingLedger || []),
      amendments: []
    };
  }

  async writeGuard(operatingPeriodId) {
    const op = await this.getOperatingPeriod(operatingPeriodId);
    if (op.status === "LOCKED") {
      throw new Error("Operating Period Locked - create Amendment");
    }
    return op;
  }

  async appendTimelineEvent({ incidentId, operatingPeriodId, type, payload, author, timestamp }) {
    const eventCounter = await this.nextCounter("eventCounter");
    const eventId = `EVT-${String(eventCounter).padStart(6, "0")}`;
    const entry = {
      eventId,
      incidentId,
      operatingPeriodId,
      timestamp: timestamp || nowIso(),
      author: normalizeAuthor(author),
      clientId: await this.clientId(),
      type,
      payload: clone(payload || {})
    };
    await this.put(STORES.timelineEvents, entry);
    return entry;
  }

  applyMutationToState(state, action) {
    const payload = action.payload || {};
    const mapState = state.mapState || { items: [], shapes: [], basemap: "streets" };
    const stagingLedger = state.stagingLedger || [];

    switch (action.type) {
      case ACTION_TYPES.MAP_ITEM_ADD: {
        mapState.items.push(clone(payload.item));
        break;
      }
      case ACTION_TYPES.MAP_ITEM_UPDATE: {
        const item = mapState.items.find((row) => row.id === payload.itemId);
        if (!item) throw new Error("Map item not found");
        Object.assign(item, clone(payload.changes || {}));
        break;
      }
      case ACTION_TYPES.MAP_ITEM_REMOVE: {
        mapState.items = mapState.items.filter((row) => row.id !== payload.itemId);
        break;
      }
      case ACTION_TYPES.SHAPE_ADD: {
        mapState.shapes.push(clone(payload.shape));
        break;
      }
      case ACTION_TYPES.SHAPE_UPDATE: {
        const shape = mapState.shapes.find((row) => row.id === payload.shapeId);
        if (!shape) throw new Error("Shape not found");
        Object.assign(shape, clone(payload.changes || {}));
        break;
      }
      case ACTION_TYPES.SHAPE_REMOVE: {
        mapState.shapes = mapState.shapes.filter((row) => row.id !== payload.shapeId);
        break;
      }
      case ACTION_TYPES.BASEMAP_SET: {
        mapState.basemap = payload.basemap;
        break;
      }
      case ACTION_TYPES.STAGING_ENTRY_ADD: {
        stagingLedger.push(clone(payload.entry));
        break;
      }
      case ACTION_TYPES.STAGING_ENTRY_UPDATE: {
        const row = stagingLedger.find((entry) => entry.id === payload.entryId);
        if (!row) throw new Error("Staging entry not found");
        Object.assign(row, clone(payload.changes || {}));
        break;
      }
      case ACTION_TYPES.STAGING_ENTRY_DEMOBILIZE: {
        const row = stagingLedger.find((entry) => entry.id === payload.entryId);
        if (!row) throw new Error("Staging entry not found");
        row.status = "demobilized";
        row.demobilizedAt = payload.demobilizedAt || nowIso();
        break;
      }
      case ACTION_TYPES.TIMELINE_EVENT_ADD:
      case ACTION_TYPES.NOTE_ADD:
        break;
      default:
        throw new Error(`Unsupported action: ${action.type}`);
    }

    state.mapState = mapState;
    state.stagingLedger = stagingLedger;
    return state;
  }

  async applyAction(action) {
    if (!action?.incidentId || !action?.operatingPeriodId || !action?.type) {
      throw new Error("Invalid action payload");
    }

    if (action.type === ACTION_TYPES.OP_LOCK) {
      return this.lockOperatingPeriod({
        incidentId: action.incidentId,
        operatingPeriodId: action.operatingPeriodId,
        author: action.author
      });
    }

    if (action.type === ACTION_TYPES.OP_CREATE) {
      return this.startNextOperatingPeriod({ incidentId: action.incidentId, author: action.author });
    }

    if (action.type === ACTION_TYPES.OP_SET_ACTIVE) {
      return this.setActiveOperatingPeriod({
        incidentId: action.incidentId,
        operatingPeriodId: action.payload?.operatingPeriodId,
        author: action.author
      });
    }

    await this.writeGuard(action.operatingPeriodId);
    const key = keyForState(action.incidentId, action.operatingPeriodId);
    const state = (await this.getByKey(STORES.workingStates, key)) || {
      key,
      incidentId: action.incidentId,
      operatingPeriodId: action.operatingPeriodId,
      mapState: { items: [], shapes: [], basemap: "streets" },
      timelineEvents: [],
      stagingLedger: []
    };

    this.applyMutationToState(state, action);

    const event = await this.appendTimelineEvent({
      incidentId: action.incidentId,
      operatingPeriodId: action.operatingPeriodId,
      type: action.type,
      payload: action.payload || {},
      author: action.author,
      timestamp: action.timestamp
    });

    state.timelineEvents = state.timelineEvents || [];
    state.timelineEvents.push(event);
    await this.put(STORES.workingStates, state);

    return { ok: true, event };
  }

  async lockOperatingPeriod({ incidentId, operatingPeriodId, author }) {
    const op = await this.getOperatingPeriod(operatingPeriodId);
    if (op.status === "LOCKED") throw new Error("Operating Period already locked");
    if (op.incidentId !== incidentId) throw new Error("Operating Period does not belong to incident");

    const key = keyForState(incidentId, operatingPeriodId);
    const working = await this.getByKey(STORES.workingStates, key);
    const lockEvent = await this.appendTimelineEvent({
      incidentId,
      operatingPeriodId,
      type: ACTION_TYPES.OP_LOCK,
      payload: { operatingPeriodId },
      author
    });
    const lockTimeline = [...(working?.timelineEvents || []), lockEvent];
    const snapshotCounter = await this.nextCounter(`snapshotCounter:${incidentId}:${operatingPeriodId}`);
    const snapshotId = `SNAP-OP-${op.opNumber}-${String(snapshotCounter).padStart(4, "0")}`;

    const snapshotPayload = {
      mapState: clone(working?.mapState || { items: [], shapes: [], basemap: "streets" }),
      timelineEvents: clone(lockTimeline),
      stagingLedger: clone(working?.stagingLedger || [])
    };

    const hash = await sha256Hex(stableStringify(snapshotPayload));

    const snapshot = {
      snapshotId,
      incidentId,
      operatingPeriodId,
      createdAt: nowIso(),
      createdBy: normalizeAuthor(author),
      mapState: snapshotPayload.mapState,
      timelineEvents: snapshotPayload.timelineEvents,
      stagingLedger: snapshotPayload.stagingLedger,
      hash
    };

    op.status = "LOCKED";
    op.lockedAt = nowIso();
    op.lockedBy = normalizeAuthor(author);
    op.snapshotId = snapshotId;

    await this.put(STORES.snapshots, snapshot);
    await this.put(STORES.operatingPeriods, op);
    if (working) {
      working.timelineEvents = lockTimeline;
      await this.put(STORES.workingStates, working);
    }

    return { ok: true, snapshot, operatingPeriod: op };
  }

  async setActiveOperatingPeriod({ incidentId, operatingPeriodId, author }) {
    const incident = await this.getByKey(STORES.incidents, incidentId);
    if (!incident) throw new Error("Incident not found");
    if (!incident.operatingPeriods.includes(operatingPeriodId)) {
      throw new Error("Operating Period not in incident");
    }
    incident.activeOperatingPeriodId = operatingPeriodId;
    await this.put(STORES.incidents, incident);
    const key = keyForState(incidentId, operatingPeriodId);
    const state = (await this.getByKey(STORES.workingStates, key)) || {
      key,
      incidentId,
      operatingPeriodId,
      mapState: { items: [], shapes: [], basemap: "streets" },
      timelineEvents: [],
      stagingLedger: []
    };
    const event = await this.appendTimelineEvent({
      incidentId,
      operatingPeriodId,
      type: ACTION_TYPES.OP_SET_ACTIVE,
      payload: { operatingPeriodId },
      author
    });
    state.timelineEvents.push(event);
    await this.put(STORES.workingStates, state);
    return { ok: true, incident };
  }

  async startNextOperatingPeriod({ incidentId, author }) {
    const { incident, operatingPeriods } = await this.loadIncident(incidentId);
    const current = operatingPeriods.find((row) => row.operatingPeriodId === incident.activeOperatingPeriodId);
    if (!current) throw new Error("Active Operating Period not found");
    if (current.status !== "LOCKED") throw new Error("Active Operating Period must be LOCKED before starting next OP");

    const nextNumber = Math.max(...operatingPeriods.map((row) => row.opNumber), 0) + 1;
    const nextOpId = `OP-${nextNumber}`;

    const sourceState = await this.getState(incidentId, current.operatingPeriodId);
    const nextState = {
      key: keyForState(incidentId, nextOpId),
      incidentId,
      operatingPeriodId: nextOpId,
      mapState: clone(sourceState.mapState || { items: [], shapes: [], basemap: "streets" }),
      timelineEvents: [],
      stagingLedger: clone(sourceState.stagingLedger || [])
    };

    const nextOp = {
      operatingPeriodId: nextOpId,
      incidentId,
      opNumber: nextNumber,
      startTime: nowIso(),
      endTime: nowIso(),
      status: "ACTIVE",
      lockedAt: null,
      lockedBy: null,
      snapshotId: null
    };

    incident.operatingPeriods.push(nextOpId);
    incident.activeOperatingPeriodId = nextOpId;

    await this.put(STORES.operatingPeriods, nextOp);
    await this.put(STORES.workingStates, nextState);
    await this.put(STORES.incidents, incident);

    const event = await this.appendTimelineEvent({
      incidentId,
      operatingPeriodId: nextOpId,
      type: ACTION_TYPES.OP_CREATE,
      payload: { sourceOperatingPeriodId: current.operatingPeriodId },
      author
    });

    nextState.timelineEvents.push(event);
    await this.put(STORES.workingStates, nextState);

    return { ok: true, operatingPeriod: nextOp, incident };
  }

  async createAmendment({ incidentId, operatingPeriodId, createdBy, reason, patch }) {
    const op = await this.getOperatingPeriod(operatingPeriodId);
    if (op.status !== "LOCKED") throw new Error("Amendments are only allowed for LOCKED Operating Periods");

    const author = normalizeAuthor(createdBy);
    if ((author.role || "").toUpperCase() !== "IC") {
      throw new Error("Only IC role can create amendments in Phase 1");
    }

    const amendmentCounter = await this.nextCounter("amendmentCounter");
    const amendmentId = `AMD-${String(amendmentCounter).padStart(4, "0")}`;
    const createdAt = nowIso();

    const base = {
      amendmentId,
      incidentId,
      operatingPeriodId,
      createdAt,
      createdBy: author,
      reason: (reason || "No reason provided").trim() || "No reason provided",
      patch: clone(patch || [])
    };

    const amendment = {
      ...base,
      hash: await sha256Hex(stableStringify(base))
    };

    await this.put(STORES.amendments, amendment);
    return { ok: true, amendment };
  }
}

export default LocalStoreIndexedDb;
