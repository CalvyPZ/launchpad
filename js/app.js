import {
  loadWidgetsDocument,
  saveWidgets,
  loadToolsWidgets,
  loadToolsLandingWidgets,
  saveToolsWidgets,
  saveToolsLandingWidgets,
  loadSiteTitle,
  saveSiteTitle,
  defaultNotesState,
  defaultTodoState,
  defaultFortnightState,
  evaluateAllTodoResets,
  getWidgetPayloadForApi,
  getWidgetPayloadFingerprint,
  loadWidgetPayloadFromApi,
  normaliseWidgetRows,
  normaliseToolsRows,
  normaliseToolsLandingRows,
  migrateLegacyIfNeeded,
} from "./store.js";
import * as notesWidget from "./widgets/notes.js";
import * as todoWidget from "./widgets/todo.js";
import * as placeholderWidget from "./widgets/placeholder.js";
import * as fortnightToolsWidget from "./widgets/fortnight-tools.js";
import * as statusToolsWidget from "./widgets/status-tools.js";
import * as logToolsWidget from "./widgets/log-tools.js";
import {
  initSiteDiagnostics,
  reportWidgetSyncRetrieve,
  reportWidgetSyncPushFromDashboard,
  reportWidgetSyncPushEvent,
} from "./site-diagnostics.js";

const widgetTypes = ["notes", "todo"];
const widgetFactories = {
  notes: notesWidget.render,
  todo: todoWidget.render,
};
const widgetTypeSet = new Set(widgetTypes);
const WIDGETS_API_URL = "/api/widgets";
/** POST body `{ revision }` â€” Backend must expose this route for first-open outbound writes. */
const WIDGETS_ACK_URL = "/api/widgets/ack";
const WIDGET_SYNC_DEBOUNCE_MS = 350;
const WIDGET_SYNC_POLL_MS = 4000;
const WIDGET_SYNC_PUSH_MS = 3000;

function compareUpdatedAt(leftTs, rightTs) {
  const left = leftTs ? new Date(leftTs).getTime() : NaN;
  const right = rightTs ? new Date(rightTs).getTime() : NaN;
  if (!Number.isFinite(left) && !Number.isFinite(right)) return 0;
  if (!Number.isFinite(left)) return -1;
  if (!Number.isFinite(right)) return 1;
  if (left > right) return 1;
  if (left < right) return -1;
  return 0;
}

/** Reads server revision primitive from GET/PUT JSON or `ETag` (when Backend sends one). */
function extractServerRevisionFromWidgetsResponse(rawJson, etagHeader) {
  if (rawJson && typeof rawJson.revision === "string" && rawJson.revision.trim()) {
    return rawJson.revision.trim();
  }
  if (rawJson && typeof rawJson.revision === "number" && Number.isFinite(rawJson.revision)) {
    return String(rawJson.revision);
  }
  const tag = typeof etagHeader === "string" ? etagHeader.trim() : "";
  if (!tag) return null;
  const weak = tag.replace(/^W\//i, "");
  return weak.replace(/^"+|"+$/g, "");
}

function normaliseRevisionToken(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.replace(/^"+|"+$/g, "");
}

function parseSyncFailureBodyDetail(responseText) {
  if (typeof responseText !== "string") return "";
  const raw = responseText.trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed.trim();
    if (parsed && typeof parsed === "object") {
      const parts = [];
      if (typeof parsed.detail === "string" && parsed.detail.trim()) parts.push(parsed.detail.trim());
      if (typeof parsed.message === "string" && parsed.message.trim()) parts.push(parsed.message.trim());
      if (typeof parsed.error === "string" && parsed.error.trim()) parts.push(parsed.error.trim());
      if (Array.isArray(parsed.errors)) {
        const flatErrors = parsed.errors
          .map((item) => {
            if (typeof item === "string") return item.trim();
            if (item && typeof item.message === "string") return item.message.trim();
            return "";
          })
          .filter(Boolean);
        if (flatErrors.length) parts.push(flatErrors.join("; "));
      }
      if (parts.length) return parts.join(" â€” ");
      return JSON.stringify(parsed);
    }
  } catch {
    return raw;
  }
  return raw;
}

function parseJsonSafe(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function makeSyncFailureErrorMessage(response, responseText) {
  const statusText = response.statusText ? ` ${response.statusText}` : "";
  const bodyDetail = parseSyncFailureBodyDetail(responseText).slice(0, 360);
  const detail = bodyDetail ? ` â€” ${bodyDetail}` : "";
  return `PUT ${WIDGETS_API_URL} failed: ${response.status}${statusText}${detail}`;
}

function pickServerPayload(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return {
      version: 1,
      updatedAt: null,
      widgets: normaliseWidgetRows(raw),
      toolsWidgets: null,
      toolsLandingWidgets: null,
    };
  }
  const resolveLanding = (r) =>
    Array.isArray(r.toolsLandingWidgets)
      ? normaliseToolsLandingRows(r.toolsLandingWidgets)
      : Array.isArray(r.data?.toolsLandingWidgets)
      ? normaliseToolsLandingRows(r.data.toolsLandingWidgets)
      : null;
  if (Array.isArray(raw.widgets)) {
    return {
      version: raw.version || 1,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
      widgets: normaliseWidgetRows(raw.widgets),
      toolsWidgets: Array.isArray(raw.toolsWidgets)
        ? normaliseToolsRows(raw.toolsWidgets)
        : Array.isArray(raw.data?.toolsWidgets)
        ? normaliseToolsRows(raw.data.toolsWidgets)
        : null,
      toolsLandingWidgets: resolveLanding(raw),
    };
  }
  if (Array.isArray(raw.data?.widgets)) {
    return {
      version: raw.version || 1,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
      widgets: normaliseWidgetRows(raw.data.widgets),
      toolsWidgets: Array.isArray(raw.toolsWidgets)
        ? normaliseToolsRows(raw.toolsWidgets)
        : Array.isArray(raw.data?.toolsWidgets)
        ? normaliseToolsRows(raw.data.toolsWidgets)
        : null,
      toolsLandingWidgets: resolveLanding(raw),
    };
  }
  if (Array.isArray(raw.toolsWidgets)) {
    return {
      version: raw.version || 1,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
      widgets: null,
      toolsWidgets: normaliseToolsRows(raw.toolsWidgets),
      toolsLandingWidgets: resolveLanding(raw),
    };
  }
  if (Array.isArray(raw.data?.toolsWidgets)) {
    return {
      version: raw.version || 1,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
      widgets: null,
      toolsWidgets: normaliseToolsRows(raw.data.toolsWidgets),
      toolsLandingWidgets: resolveLanding(raw),
    };
  }
  if (Array.isArray(raw.toolsLandingWidgets) || Array.isArray(raw.data?.toolsLandingWidgets)) {
    return {
      version: raw.version || 1,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
      widgets: null,
      toolsWidgets: null,
      toolsLandingWidgets: resolveLanding(raw),
    };
  }
  return null;
}

const addWidgetChoices = [
  { type: "notes", label: "Sticky Notes", icon: "ðŸ“" },
  { type: "todo", label: "To-Do", icon: "âœ…" },
];

const toolsWidgetFactories = {
  "status-tools": statusToolsWidget.render,
  "log-tools": logToolsWidget.render,
  placeholder: placeholderWidget.render,
  fortnight: fortnightToolsWidget.render,
};
/** Types the user may add from the Tools tab picker. */
const toolsTabAddableTypeSet = new Set(["fortnight"]);
const toolsTabAddWidgetChoices = [
  { type: "fortnight", label: "Fortnight calculator", icon: "ðŸ“†" },
];
/** Types the user may add from the Debug tab picker (diagnostics only). */
const debugAddableTypeSet = new Set(["status-tools", "log-tools"]);
const debugAddWidgetChoices = [
  { type: "status-tools", label: "Status", icon: "ðŸ“¡" },
  { type: "log-tools", label: "Log", icon: "ðŸ“‹" },
];

const widgetLabels = {
  notes: "Sticky Notes",
  todo: "To-Do",
  "status-tools": "Status",
  "log-tools": "Log",
  fortnight: "Fortnight calculator",
  placeholder: "Placeholder",
};

function nowClockText() {
  const now = new Date();
  const clockTime = now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return { clockTime, date };
}

function removeDeprecatedHomeWidgets(rawWidgets) {
  if (!Array.isArray(rawWidgets)) return [];
  return rawWidgets
    .filter((widget) => widget?.type !== "clock")
    .map((widget, index) => ({ ...widget, position: index }));
}

function makeWidgetId(type) {
  return `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function widgetDisplayName(config) {
  return (config.title || "").trim() || widgetLabels[config.type] || "Widget";
}

document.addEventListener("alpine:init", () => {
  Alpine.data("launchpad", function launchpad() {
  const controllers = new Map();
  const resizeObservers = new Map();
  const toolsControllers = new Map();
  const toolsResizeObservers = new Map();
  const debugControllers = new Map();
  const debugResizeObservers = new Map();
  const pageKeys = new Set(["home", "tools", "debug"]);
    const widgetDragState = {
      active: false,
      pointerId: null,
      sourceWidgetId: null,
      sourceWidget: null,
      sourceRect: null,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      ghost: null,
      dropTargetWidgetId: null,
      dropIndex: null,
      gridEl: null,
      pointerMoveHandler: null,
    };
  const format = nowClockText();

  return {
    siteTitle: loadSiteTitle(),
    clockTime: format.clockTime,
    clockDate: format.date,
    editMode: false,
    addWidgetOpen: false,
    addWidgetChoices,
    addWidgetPickerIndex: -1,
    widgets: [],
    toolsWidgets: [],
    toolsLandingWidgets: [],
    currentPage: "home",
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    _widgetsSyncTimer: null,
    _widgetsSyncPushTimer: null,
    _widgetsSyncInFlight: false,
    _widgetsSyncAbort: null,
    _widgetsNeedSync: false,
    _widgetsSyncDebugTicker: null,
    _widgetSyncDebugNow: Date.now(),
    _widgetsSyncDebounceStartedAt: null,
    _widgetsSyncPushTimerStartedAt: null,
    _widgetsLastSyncPullAt: null,
    _widgetsLastSyncPushAt: null,
    _widgetsLastPushOutcome: {
      status: "never",
      message: "No outbound attempt yet",
      at: null,
    },
    _widgetsUpdatedAt: null,
    _widgetsPollTimer: null,
    _widgetsPendingRemotePayload: null,
    _widgetsBootstrapInFlight: false,
    /** When true, PUT / POST beacon / debounced sync may run (first-open GET+apply+ack completed, or equivalent after import). */
    _widgetsWriteGateOpen: false,
    /** Fingerprint of last server-aligned widget content (see getWidgetPayloadFingerprint). */
    _widgetsBaselineFingerprint: "",
    /** Server revision last acknowledged or returned on successful PUT (sent as `expectRevision` / `If-Match`). */
    _widgetsAckRevision: null,
    _widgetsAckError: null,
    _widgetsQueuedSyncAfterAck: false,
    widgetMapEl: null,
    toolsGridEl: null,
    debugGridEl: null,
    _pendingWidgetFocusId: null,
    _pendingWidgetFocusPage: "home",
    _todoResetTicker: null,
    _clockTicker: null,
    _onlineHandler: null,
    _offlineHandler: null,
    _visibilityHandler: null,
    _pagehideHandler: null,
    _beforeUnloadHandler: null,
    _isExiting: false,
    forceShellRetrieveBusy: false,
    forceShellRetrieveError: null,
    widgetDocumentExchangeError: null,
    widgetExportBusy: false,
    widgetImportBusy: false,

    widgetDocExchangeControlsDisabled() {
      return (
        !this.online ||
        this.widgetExportBusy ||
        this.widgetImportBusy ||
        this._widgetsSyncInFlight ||
        this.forceShellRetrieveBusy ||
        this._widgetsBootstrapInFlight
      );
    },

    navigateTo(page) {
      const next = pageKeys.has(page) ? page : "home";
      if (this.currentPage === "debug" && next !== "debug") {
        this.forceShellRetrieveError = null;
        this.widgetDocumentExchangeError = null;
      }
      this.currentPage = next;
      this.closeAddWidgetPicker(false);
    },

    async forceShellRetrieveFromServer() {
      this.forceShellRetrieveError = null;
      if (this.forceShellRetrieveBusy) return;
      if (!this.online) {
        this.forceShellRetrieveError =
          "You appear to be offline. Connect to the network first, then try again â€” clearing the shell cache while offline can prevent the app from loading.";
        return;
      }
      if (!("caches" in window) || typeof caches?.keys !== "function") {
        this.forceShellRetrieveError =
          "Cache Storage is not available here. Use a hard refresh in your browser (for example Ctrl+Shift+R) or clear cached data for this site.";
        return;
      }
      this.forceShellRetrieveBusy = true;
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        location.reload();
      } catch (err) {
        console.error("forceShellRetrieveFromServer", err);
        this.forceShellRetrieveBusy = false;
        this.forceShellRetrieveError =
          "Could not clear app caches. Try a hard refresh (Ctrl+Shift+R) or clear site data for this origin.";
      }
    },

    _applyServerDocumentForced(payload, outcomeMessage = "Server document applied") {
      const remoteWidgets = Array.isArray(payload?.widgets) ? payload.widgets : null;
      const remoteToolsWidgets = Array.isArray(payload?.toolsWidgets) ? payload.toolsWidgets : null;
      const remoteToolsLandingWidgets = Array.isArray(payload?.toolsLandingWidgets)
        ? payload.toolsLandingWidgets
        : null;
      if (!remoteWidgets) {
        console.error("_applyServerDocumentForced: missing widgets[]", payload);
        return false;
      }
      this.widgets = removeDeprecatedHomeWidgets(remoteWidgets);
      this.toolsWidgets = remoteToolsWidgets != null ? remoteToolsWidgets : normaliseToolsRows(null);
      this.toolsLandingWidgets =
        remoteToolsLandingWidgets != null
          ? remoteToolsLandingWidgets
          : normaliseToolsLandingRows(null);
      evaluateAllTodoResets(this.widgets);
      evaluateAllTodoResets(this.toolsWidgets);
      evaluateAllTodoResets(this.toolsLandingWidgets);
      this._widgetsUpdatedAt =
        typeof payload.updatedAt === "string" && payload.updatedAt.trim()
          ? payload.updatedAt
          : this._widgetsUpdatedAt;
      this._widgetsNeedSync = false;
      if (this._widgetsSyncTimer) {
        window.clearTimeout(this._widgetsSyncTimer);
        this._widgetsSyncTimer = null;
        this._widgetsSyncDebounceStartedAt = null;
      }
      this.persistWidgets({ sync: false });
      this.persistToolsWidgets({ sync: false });
      this.persistToolsLandingWidgets({ sync: false });
      this.renderPageWidgets("home");
      this.renderPageWidgets("tools");
      this.renderPageWidgets("debug");
      this._widgetsLastSyncPushAt = new Date().toISOString();
      this._setWidgetSyncPushOutcome("success", outcomeMessage);
      reportWidgetSyncPushEvent("success", outcomeMessage, this);
      reportWidgetSyncPushFromDashboard(this);
      return true;
    },

    _syncBaselineToCurrent() {
      this._widgetsBaselineFingerprint = getWidgetPayloadFingerprint(
        this.widgets,
        this.toolsWidgets,
        this.toolsLandingWidgets
      );
    },

    _flushQueuedSyncAfterGate() {
      if (!this._widgetsWriteGateOpen) return;
      const queued = this._widgetsQueuedSyncAfterAck;
      this._widgetsQueuedSyncAfterAck = false;
      if (!queued) return;
      if (
        getWidgetPayloadFingerprint(this.widgets, this.toolsWidgets, this.toolsLandingWidgets) !==
        this._widgetsBaselineFingerprint
      ) {
        this.persistWidgetsDeferredSync();
      }
    },

    async _postWidgetsAckRevision(revision) {
      reportWidgetSyncRetrieve("ack_pending", revision ? String(revision) : "no revision in GET/PUT body");
      const res = await fetch(WIDGETS_ACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ revision: revision ?? null }),
        cache: "no-store",
      });
      const txt = await res.text().catch(() => "");
      if (res.status === 404 || res.status === 405) {
        const detail = "POST /api/widgets/ack is not implemented on this API (required for first-open writes).";
        reportWidgetSyncRetrieve("ack_error", detail);
        const err = new Error("ACK_ENDPOINT_MISSING");
        err.detail = detail;
        throw err;
      }
      if (!res.ok) {
        const detail = txt.trim().slice(0, 360) || `HTTP ${res.status}`;
        reportWidgetSyncRetrieve("ack_error", detail);
        throw new Error(detail);
      }
      reportWidgetSyncRetrieve("ack_success", revision ? `revision ${revision}` : "ack OK");
    },

    async _finalizeServerDocumentIngest(rawJson, response) {
      const revision = extractServerRevisionFromWidgetsResponse(
        rawJson,
        response?.headers?.get?.("etag") || response?.headers?.get?.("ETag")
      );
      if (!revision) {
        const msg = "No revision token was returned from /api/widgets response; write-gated sync is disabled.";
        this._widgetsWriteGateOpen = false;
        this._widgetsAckError = msg;
        this._setWidgetSyncPushOutcome("skipped", msg);
        reportWidgetSyncRetrieve("ack_error", msg);
        throw new Error(msg);
      }
      this._widgetsAckError = null;
      await this._postWidgetsAckRevision(revision);
      this._widgetsWriteGateOpen = true;
      this._widgetsAckRevision = revision;
      this._syncBaselineToCurrent();
      this._widgetsNeedSync = false;
      if (this._widgetsSyncTimer) {
        window.clearTimeout(this._widgetsSyncTimer);
        this._widgetsSyncTimer = null;
        this._widgetsSyncDebounceStartedAt = null;
      }
      this._flushQueuedSyncAfterGate();
      reportWidgetSyncPushFromDashboard(this);
    },

    async _resolveWidgetRevisionForWrite() {
      const cachedRevision = normaliseRevisionToken(this._widgetsAckRevision);
      if (cachedRevision) return cachedRevision;

      const response = await fetch(WIDGETS_API_URL, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const responseText = await response.text();
      if (!response.ok) {
        const detail = responseText.trim().slice(0, 280);
        throw new Error(
          `GET ${WIDGETS_API_URL} failed while resolving revision: ${response.status}${detail ? ` â€” ${detail}` : ""}`
        );
      }

      const responseJson = parseJsonSafe(responseText);
      const revision = extractServerRevisionFromWidgetsResponse(
        responseJson,
        response?.headers?.get?.("etag") || response?.headers?.get?.("ETag")
      );
      if (!revision) {
        throw new Error(
          "Server did not return a revision token. Export a fresh snapshot first, then retry import."
        );
      }

      this._widgetsAckRevision = revision;
      return revision;
    },

    async exportWidgetsDocumentFromServer() {
      this.widgetDocumentExchangeError = null;
      if (this.widgetExportBusy || this.widgetImportBusy) return;
      if (!this.online) {
        this.widgetDocumentExchangeError =
          "You appear to be offline. Connect to the network before exporting the server snapshot.";
        return;
      }
      this.widgetExportBusy = true;
      try {
        const response = await fetch(WIDGETS_API_URL, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) {
          let detail = "";
          try {
            detail = (await response.text()).trim().slice(0, 280);
          } catch {
            detail = "";
          }
          throw new Error(
            `GET ${WIDGETS_API_URL} failed: ${response.status}${detail ? ` â€” ${detail}` : ""}`
          );
        }
        const rawText = await response.text();
        let parsed;
        try {
          parsed = JSON.parse(rawText);
        } catch (parseErr) {
          console.error("exportWidgetsDocumentFromServer: invalid JSON", parseErr);
          throw new Error("Server response was not valid JSON.");
        }
        const pretty = `${JSON.stringify(parsed, null, 2)}\n`;
        const iso = new Date().toISOString().replace(/:/g, "-");
        const blob = new Blob([pretty], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `launchpad-widgets-${iso}.json`;
        anchor.rel = "noopener";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("exportWidgetsDocumentFromServer", err);
        this.widgetDocumentExchangeError =
          err instanceof Error ? err.message : "Export failed. Check the network and API, then try again.";
      } finally {
        this.widgetExportBusy = false;
      }
    },

    openWidgetImportFilePicker() {
      this.widgetDocumentExchangeError = null;
      if (!this.online) {
        this.widgetDocumentExchangeError =
          "You appear to be offline. Connect to the network before importing a server document.";
        return;
      }
      if (this.widgetExportBusy || this.widgetImportBusy || this._widgetsSyncInFlight || this.forceShellRetrieveBusy || this._widgetsBootstrapInFlight) {
        this.widgetDocumentExchangeError =
          "Wait for the current operation (sync, export, import, or shell refresh) to finish, then try again.";
        return;
      }
      const input = this.$refs?.widgetImportFileInput;
      if (input && typeof input.click === "function") input.click();
    },

    async onWidgetImportFileSelected(event) {
      this.widgetDocumentExchangeError = null;
      const input = event?.target;
      if (!(input instanceof HTMLInputElement)) return;
      const file = input.files && input.files[0];
      input.value = "";
      if (!file) return;
      if (!this.online) {
        this.widgetDocumentExchangeError =
          "You appear to be offline. Connect to the network before importing.";
        return;
      }
      if (this.widgetImportBusy || this.widgetExportBusy || this._widgetsSyncInFlight || this._widgetsBootstrapInFlight) {
        this.widgetDocumentExchangeError = "Wait for the current sync or export/import to finish, then try again.";
        return;
      }

      let text;
      try {
        text = await file.text();
      } catch (readErr) {
        console.error("onWidgetImportFileSelected: read failed", readErr);
        this.widgetDocumentExchangeError = "Could not read the selected file.";
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (parseErr) {
        console.error("onWidgetImportFileSelected: JSON.parse", parseErr);
        this.widgetDocumentExchangeError = "File is not valid JSON.";
        return;
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray(parsed.widgets)) {
        this.widgetDocumentExchangeError =
          'Invalid document: top-level object with a "widgets" array is required (server export shape).';
        return;
      }

      const confirmed = window.confirm(
        "Overwrite the server widget document and replace this dashboardâ€™s cached Home, Tools, and Debug layouts with the selected file? Unsynced local-only edits will be lost. This cannot be undone."
      );
      if (!confirmed) return;

      const apiOptions = {
        toolsWidgets: parsed.toolsWidgets,
        toolsLandingWidgets: parsed.toolsLandingWidgets,
      };
      if (typeof parsed.updatedAt === "string" && parsed.updatedAt.trim()) {
        apiOptions.updatedAt = parsed.updatedAt;
      }
      let expectRevision;
      try {
        expectRevision = await this._resolveWidgetRevisionForWrite();
      } catch (revisionErr) {
        console.error("onWidgetImportFileSelected: revision resolution failed", revisionErr);
        this.widgetDocumentExchangeError =
          "Could not confirm server revision before import. Re-open the import action after a successful server sync or use Force retrieve, then retry.";
        return;
      }
      const bodyPayload = getWidgetPayloadForApi(parsed.widgets, apiOptions);
      bodyPayload.expectRevision = expectRevision;
      const putHeaders = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      putHeaders["X-Calvybots-Widgets-Revision"] = expectRevision;
      putHeaders["If-Match"] = `"${expectRevision}"`;

      this.widgetImportBusy = true;
      try {
        const response = await fetch(WIDGETS_API_URL, {
          method: "PUT",
          headers: putHeaders,
          body: JSON.stringify(bodyPayload),
          cache: "no-store",
        });
        const responseText = await response.text();
        const rawBody = parseJsonSafe(responseText);
        if (!response.ok) {
          if (response.status === 409) {
            const responseCode = rawBody && typeof rawBody.code === "string" ? rawBody.code : "";
            if (responseCode === "STALE_REVISION") {
              const nextRevision = extractServerRevisionFromWidgetsResponse(
                rawBody,
                response?.headers?.get?.("etag") || response?.headers?.get?.("ETag")
              );
              if (nextRevision) {
                this._widgetsAckRevision = nextRevision;
              }
              this.widgetDocumentExchangeError =
                "Import was rejected due to a stale revision token. Refresh the document from server (or use Force retrieve) and retry with the latest snapshot.";
              return;
            }
          }
          const detail = responseText.trim().slice(0, 280);
          throw new Error(
            `PUT ${WIDGETS_API_URL} failed: ${response.status}${detail ? ` â€” ${detail}` : ""}`
          );
        }
        const serverPayload = rawBody ? loadWidgetPayloadFromApi(rawBody) || pickServerPayload(rawBody) : null;
        if (!serverPayload || !Array.isArray(serverPayload.widgets)) {
          try {
            const verify = await fetch(WIDGETS_API_URL, {
              method: "GET",
              headers: { Accept: "application/json" },
              cache: "no-store",
            });
            if (verify.ok) {
              const verifyRaw = await verify.json();
              const verifyPayload =
                loadWidgetPayloadFromApi(verifyRaw) || pickServerPayload(verifyRaw);
              if (verifyPayload && Array.isArray(verifyPayload.widgets)) {
                this._applyServerDocumentForced(verifyPayload, "Server document import applied");
                try {
                  await this._finalizeServerDocumentIngest(verifyRaw, verify);
                  this.widgetDocumentExchangeError = null;
                } catch (ackErr) {
                  console.error("onWidgetImportFileSelected: ack after import (GET fallback)", ackErr);
                  this._widgetsWriteGateOpen = false;
                  this._widgetsAckError =
                    ackErr instanceof Error && ackErr.message === "ACK_ENDPOINT_MISSING"
                      ? /** @type {{ detail?: string }} */ (ackErr).detail || ackErr.message
                      : ackErr instanceof Error
                        ? ackErr.message
                        : String(ackErr);
                  this.widgetDocumentExchangeError = `Import saved on server but acknowledgement failed: ${this._widgetsAckError}`;
                }
                return;
              }
            }
          } catch (fallbackErr) {
            console.error("onWidgetImportFileSelected: fallback GET after PUT", fallbackErr);
          }
          console.error("onWidgetImportFileSelected: unexpected PUT response", rawBody);
          this.widgetDocumentExchangeError =
            "Import may have saved but the response could not be applied. Reload the page or use Export to verify.";
          return;
        }
        this._applyServerDocumentForced(serverPayload, "Server document import applied");
        try {
          await this._finalizeServerDocumentIngest(rawBody, response);
          this.widgetDocumentExchangeError = null;
        } catch (ackErr) {
          console.error("onWidgetImportFileSelected: ack after import", ackErr);
          this._widgetsWriteGateOpen = false;
          this._widgetsAckError =
            ackErr instanceof Error && ackErr.message === "ACK_ENDPOINT_MISSING"
              ? /** @type {{ detail?: string }} */ (ackErr).detail || ackErr.message
              : ackErr instanceof Error
                ? ackErr.message
                : String(ackErr);
          this.widgetDocumentExchangeError = `Import applied locally but acknowledgement failed: ${this._widgetsAckError}. Outbound sync stays disabled until ack succeeds.`;
        }
      } catch (err) {
        console.error("onWidgetImportFileSelected", err);
        this.widgetDocumentExchangeError =
          err instanceof Error ? err.message : "Import failed. Check the file and API, then try again.";
      } finally {
        this.widgetImportBusy = false;
      }
    },

    persistToolsWidgets(options = {}) {
      saveToolsWidgets(this.toolsWidgets);
      const shouldSync = options.sync !== false;
      if (!shouldSync) {
        saveWidgets(this.widgets, { updatedAt: this._widgetsUpdatedAt });
        return;
      }
      this.persistWidgetsDeferredSync();
    },

    persistToolsLandingWidgets(options = {}) {
      const doSync = options.sync !== false;
      if (doSync) {
        saveToolsLandingWidgets(this.toolsLandingWidgets);
        return this.persistWidgetsDeferredSync();
      }
      saveToolsLandingWidgets(this.toolsLandingWidgets);
    },

    init() {
      this.widgetMapEl = this.$refs?.widgetGrid || document.getElementById("widget-grid");
      this.toolsGridEl = this.$refs?.toolsGrid || document.getElementById("tools-grid");
      this.debugGridEl = this.$refs?.debugGrid || document.getElementById("debug-grid");
      initSiteDiagnostics();
      this._onlineHandler = () => {
        this.online = true;
        void (async () => {
          await this.reconcileServerWidgets("init");
          if (this._widgetsNeedSync && this._widgetsWriteGateOpen) {
            void this.syncToServer();
          }
          this._armWidgetsSyncPoller();
          if (this._widgetsWriteGateOpen) {
            this._armWidgetsSyncPushTimer();
          } else {
            this._disarmWidgetsSyncPushTimer();
          }
          reportWidgetSyncPushFromDashboard(this);
        })();
      };
      this._offlineHandler = () => {
        this.online = false;
        if (this._widgetsNeedSync) {
          this._setWidgetSyncPushOutcome("skipped", "Offline (retry on reconnect)");
        }
        this._disarmWidgetsSyncPoller();
        this._disarmWidgetsSyncPushTimer();
        reportWidgetSyncPushFromDashboard(this);
      };
      this._pagehideHandler = () => {
        this.flushWidgetsBeforeExit("pagehide");
      };
      this._beforeUnloadHandler = () => {
        this.flushWidgetsBeforeExit("beforeunload");
      };
      window.addEventListener("online", this._onlineHandler);
      window.addEventListener("offline", this._offlineHandler);
      window.addEventListener("pagehide", this._pagehideHandler);
      window.addEventListener("beforeunload", this._beforeUnloadHandler);
      this._startWidgetSyncDebugTicker();
      this.refreshClock();

      const localDocument = loadWidgetsDocument();
      this.widgets = removeDeprecatedHomeWidgets(localDocument.widgets);
      this._widgetsUpdatedAt = localDocument.updatedAt;
      if (this.widgets.length !== localDocument.widgets.length) {
        this.persistWidgets({ sync: false });
      }

      this.toolsWidgets = loadToolsWidgets();
      this.toolsLandingWidgets = loadToolsLandingWidgets();
      this._visibilityHandler = () => {
        if (document.visibilityState === "visible") {
          let changed = false;
          if (evaluateAllTodoResets(this.widgets)) changed = true;
          if (evaluateAllTodoResets(this.toolsWidgets)) changed = true;
          if (evaluateAllTodoResets(this.toolsLandingWidgets)) changed = true;
          if (changed) {
            this.persistWidgets({ sync: this._widgetsWriteGateOpen });
            this.persistToolsWidgets({ sync: this._widgetsWriteGateOpen });
            this.persistToolsLandingWidgets({ sync: this._widgetsWriteGateOpen });
            this.renderPageWidgets("home");
            this.renderPageWidgets("tools");
            this.renderPageWidgets("debug");
          }
          if (this._widgetsNeedSync && this.online && this._widgetsWriteGateOpen) {
            void this.syncToServer();
            this._armWidgetsSyncPoller();
            this._armWidgetsSyncPushTimer();
            return;
          }
          this._armTodoResetTicker();
          this._armWidgetsSyncPoller();
          if (this._widgetsWriteGateOpen) {
            this._armWidgetsSyncPushTimer();
          } else {
            this._disarmWidgetsSyncPushTimer();
          }
        } else {
          this._disarmWidgetsSyncPoller();
          this._disarmTodoResetTicker();
          this._disarmWidgetsSyncPushTimer();
        }
      };
      document.addEventListener("visibilitychange", this._visibilityHandler);
      this.renderPageWidgets("home");
      this.renderPageWidgets("tools");
      this.renderPageWidgets("debug");
      this.persistWidgets({ sync: false });
      this.persistToolsWidgets({ sync: false });
      this.persistToolsLandingWidgets({ sync: false });
      if (this._clockTicker) window.clearInterval(this._clockTicker);
      this._clockTicker = window.setInterval(() => this.refreshClock(), 1000);
      void this.reconcileServerWidgets("init").then(() => {
        if (document.visibilityState === "visible") {
          this._armTodoResetTicker();
          this._armWidgetsSyncPoller();
          if (this._widgetsWriteGateOpen) {
            this._armWidgetsSyncPushTimer();
          } else {
            this._disarmWidgetsSyncPushTimer();
          }
        }
        reportWidgetSyncPushFromDashboard(this);
      });
    },

    _isWidgetEditSessionActive() {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return false;
      const isTextControl =
        active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active.isContentEditable;
      if (!isTextControl) return false;
      return Boolean(active.closest(".dash-widget") || active.closest("[data-widget-id]"));
    },

    _cachePendingRemotePayload(payload) {
      if (!payload) return;
      if (!this._widgetsPendingRemotePayload) {
        this._widgetsPendingRemotePayload = payload;
        return;
      }
      const nextTs = payload.updatedAt || "";
      const cachedTs = this._widgetsPendingRemotePayload.updatedAt || "";
      const hasNextTs = nextTs.length > 0;
      const hasCachedTs = cachedTs.length > 0;
      if (!hasNextTs && !hasCachedTs) {
        this._widgetsPendingRemotePayload = payload;
        return;
      }
      if (hasNextTs && !hasCachedTs) {
        this._widgetsPendingRemotePayload = payload;
        return;
      }
      this._widgetsPendingRemotePayload =
        compareUpdatedAt(nextTs, cachedTs) > 0 ? payload : this._widgetsPendingRemotePayload;
    },

    _applyPendingRemotePayload() {
      if (!this._widgetsPendingRemotePayload) return;
      if (this._widgetsWriteGateOpen) {
        this._widgetsPendingRemotePayload = null;
        return;
      }
      if (this._widgetsNeedSync || this._widgetsSyncInFlight || this._isWidgetEditSessionActive()) return;
      const payload = this._widgetsPendingRemotePayload;
      this._widgetsPendingRemotePayload = null;

      const localTs = this._widgetsUpdatedAt;
      const hasRemoteTs =
        typeof payload.updatedAt === "string" && Number.isFinite(new Date(payload.updatedAt).getTime());
      const hasLocalTs =
        typeof localTs === "string" && Number.isFinite(new Date(localTs).getTime());
      const compare = hasRemoteTs && hasLocalTs ? compareUpdatedAt(payload.updatedAt, localTs) : 0;
      const remoteLooksNewer =
        !hasRemoteTs && !hasLocalTs ? true
          : hasRemoteTs && hasLocalTs ? compare > 0
            : hasRemoteTs && !hasLocalTs;
      if (!remoteLooksNewer) return;

      void this._reconcilePayloadLocally(payload, "deferred");
    },

    _armWidgetsSyncPoller() {
      this._disarmWidgetsSyncPoller();
      if (document.visibilityState !== "visible" || !this.online) return;
      this._widgetsPollTimer = window.setInterval(() => {
        void this.reconcileServerWidgets("poll");
      }, WIDGET_SYNC_POLL_MS);
    },

    _armWidgetsSyncPushTimer() {
      this._disarmWidgetsSyncPushTimer();
      if (document.visibilityState !== "visible" || !this.online || !this._widgetsWriteGateOpen) return;
      this._widgetsSyncPushTimerStartedAt = Date.now();
      this._widgetsSyncPushTimer = window.setInterval(() => {
        this._widgetsSyncPushTimerStartedAt = Date.now();
        if (!this._widgetsNeedSync) return;
        void this.syncToServer();
      }, WIDGET_SYNC_PUSH_MS);
    },

    _disarmWidgetsSyncPoller() {
      if (this._widgetsPollTimer != null) {
        window.clearInterval(this._widgetsPollTimer);
        this._widgetsPollTimer = null;
      }
    },

    _disarmWidgetsSyncPushTimer() {
      if (this._widgetsSyncPushTimer != null) {
        window.clearInterval(this._widgetsSyncPushTimer);
        this._widgetsSyncPushTimer = null;
      }
      this._widgetsSyncPushTimerStartedAt = null;
    },

    _armTodoResetTicker() {
      if (this._todoResetTicker != null) return;
      // Re-evaluate todo recurrence while tab stays visible (e.g. past local midnight). Tradeoff: ~60s
      // latency; timer cleared while hidden to avoid wakeups. DST uses real Date in store helpers.
      this._todoResetTicker = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        let any = false;
        if (evaluateAllTodoResets(this.widgets)) {
          this.persistWidgets({ sync: this._widgetsWriteGateOpen });
          any = true;
        }
        if (evaluateAllTodoResets(this.toolsWidgets)) {
          this.persistToolsWidgets({ sync: this._widgetsWriteGateOpen });
          any = true;
        }
        if (any) {
          this.renderPageWidgets("home");
          this.renderPageWidgets("tools");
          this.renderPageWidgets("debug");
        }
      }, 60000);
    },

    _disarmTodoResetTicker() {
      if (this._todoResetTicker != null) {
        window.clearInterval(this._todoResetTicker);
        this._todoResetTicker = null;
      }
    },

    _startWidgetSyncDebugTicker() {
      if (this._widgetsSyncDebugTicker != null) return;
      this._widgetSyncDebugNow = Date.now();
      this._widgetsSyncDebugTicker = window.setInterval(() => {
        this._widgetSyncDebugNow = Date.now();
      }, 1000);
    },

    _stopWidgetSyncDebugTicker() {
      if (this._widgetsSyncDebugTicker != null) {
        window.clearInterval(this._widgetsSyncDebugTicker);
        this._widgetsSyncDebugTicker = null;
      }
    },

    _setWidgetSyncPushOutcome(status, message = "") {
      this._widgetsLastPushOutcome = {
        status,
        message,
        at: new Date().toISOString(),
      };
    },

    _formatWidgetSyncTimestamp(value) {
      if (!value) return "";
      const d = new Date(value);
      if (!Number.isFinite(d.getTime())) return String(value);
      return d.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    },

    _formatRemainingSeconds(ms) {
      if (!Number.isFinite(ms) || ms < 0) return "0s";
      return `${Math.max(0, Math.ceil(ms / 1000))}s`;
    },

    _resolveWidgetSyncStatusLabel() {
      if (this._widgetsSyncInFlight) return "uploading";
      if (!this._widgetsWriteGateOpen && this.online) {
        if (this._widgetsQueuedSyncAfterAck) return "local edits queued (writes blocked until ack)";
        return "outbound blocked (awaiting first-open ack)";
      }
      if (this._widgetsNeedSync) return this.online ? "pending" : "pending (offline)";
      return "synced";
    },

    _resolveWidgetSyncNextPushCountdownLabel() {
      const now = this._widgetSyncDebugNow || Date.now();
      if (!this._widgetsNeedSync) return "idle";
      if (this._widgetsSyncInFlight) return "uploading";
      if (!this.online) return "no active retries (offline)";
      if (this._widgetsSyncTimer && this._widgetsSyncDebounceStartedAt) {
        const elapsed = Math.max(0, now - this._widgetsSyncDebounceStartedAt);
        return `${this._formatRemainingSeconds(WIDGET_SYNC_DEBOUNCE_MS - elapsed)} until debounced PUT`;
      }
      if (this._widgetsSyncPushTimer && this._widgetsSyncPushTimerStartedAt) {
        const elapsed = Math.max(0, now - this._widgetsSyncPushTimerStartedAt);
        return `${this._formatRemainingSeconds(WIDGET_SYNC_PUSH_MS - elapsed)} until retry interval`;
      }
      return this.online ? "pending (no push timer)" : "pending (no retries)";
    },

    _resolveWidgetSyncLastTimestampLabel() {
      const candidates = [];
      if (this._widgetsLastSyncPullAt) candidates.push({ when: this._widgetsLastSyncPullAt, source: "GET" });
      if (this._widgetsLastSyncPushAt) candidates.push({ when: this._widgetsLastSyncPushAt, source: "PUT" });
      if (!candidates.length) return "No successful sync yet";

      let latest = candidates[0];
      for (let i = 1; i < candidates.length; i += 1) {
        const next = candidates[i];
        if (compareUpdatedAt(next.when, latest.when) > 0) latest = next;
      }
      return `${latest.source} ${this._formatWidgetSyncTimestamp(latest.when)}`;
    },

    _resolveWidgetSyncPushOutcomeLabel() {
      const status = this._widgetsLastPushOutcome?.status || "none";
      const message = (this._widgetsLastPushOutcome?.message || "").trim();
      const at = this._formatWidgetSyncTimestamp(this._widgetsLastPushOutcome?.at);
      const statusText = message ? `${status} â€” ${message}` : status;
      return at ? `${statusText} (${at})` : statusText;
    },

    _resolveWidgetSyncRetrieveLabel() {
      if (this._widgetsWriteGateOpen) {
        return "bootstrap-only / not currently polling (writes enabled after ack)";
      }
      if (this._widgetsBootstrapInFlight) {
        return "first-open: GET /api/widgets in progress";
      }
      if (this._widgetsAckError) {
        return `first-open blocked â€” ${this._widgetsAckError}`;
      }
      if (!this.online) {
        return "first-open deferred â€” offline (server writes stay blocked until GET+ack)";
      }
      return "first-open pending â€” POST /api/widgets/ack required after GET apply";
    },

    widgetSyncStripLastSyncLabel() {
      return this._resolveWidgetSyncLastTimestampLabel();
    },

    widgetSyncStripSyncStateLabel() {
      return this._resolveWidgetSyncStatusLabel();
    },

    widgetSyncStripNextCountdownLabel() {
      return this._resolveWidgetSyncNextPushCountdownLabel();
    },

    widgetSyncStripPushOutcomeLabel() {
      return this._resolveWidgetSyncPushOutcomeLabel();
    },

    widgetSyncStripRetrieveLabel() {
      return this._resolveWidgetSyncRetrieveLabel();
    },

    refreshClock() {
      const latest = nowClockText();
      this.clockTime = latest.clockTime;
      this.clockDate = latest.date;
    },

    setSiteTitle(value) {
      const safe = (value || "").trim() || "Calvy Launchpad";
      this.siteTitle = safe;
      saveSiteTitle(safe);
    },

    persistWidgetsDeferredSync() {
      const fpNext = getWidgetPayloadFingerprint(
        this.widgets,
        this.toolsWidgets,
        this.toolsLandingWidgets
      );
      if (this._widgetsWriteGateOpen && fpNext === this._widgetsBaselineFingerprint) {
        saveWidgets(this.widgets, { updatedAt: this._widgetsUpdatedAt });
        saveToolsWidgets(this.toolsWidgets);
        saveToolsLandingWidgets(this.toolsLandingWidgets);
        this._widgetsNeedSync = false;
        if (this._widgetsSyncTimer) {
          window.clearTimeout(this._widgetsSyncTimer);
          this._widgetsSyncTimer = null;
          this._widgetsSyncDebounceStartedAt = null;
        }
        this._setWidgetSyncPushOutcome("skipped", "No widget content changes since last server-aligned snapshot");
        reportWidgetSyncPushFromDashboard(this);
        return;
      }
      if (!this._widgetsWriteGateOpen) {
        const updatedAt = saveWidgets(this.widgets, { updatedAt: new Date().toISOString() });
        this._widgetsUpdatedAt = updatedAt;
        saveToolsWidgets(this.toolsWidgets);
        saveToolsLandingWidgets(this.toolsLandingWidgets);
        this._widgetsQueuedSyncAfterAck = fpNext !== this._widgetsBaselineFingerprint;
        this._widgetsNeedSync = false;
        if (this._widgetsSyncTimer) {
          window.clearTimeout(this._widgetsSyncTimer);
          this._widgetsSyncTimer = null;
          this._widgetsSyncDebounceStartedAt = null;
        }
        this._setWidgetSyncPushOutcome("skipped", "Local save only â€” outbound sync blocked until first-open ack");
        reportWidgetSyncPushFromDashboard(this);
        return;
      }

      const updatedAt = saveWidgets(this.widgets, { updatedAt: new Date().toISOString() });
      this._widgetsUpdatedAt = updatedAt;
      this._widgetsNeedSync = true;
      this._setWidgetSyncPushOutcome("queued", "debounced PUT queued");
      if (this._widgetsSyncTimer) {
        window.clearTimeout(this._widgetsSyncTimer);
        this._widgetsSyncDebounceStartedAt = null;
      }
      this._widgetsSyncDebounceStartedAt = Date.now();
      this._widgetsSyncTimer = window.setTimeout(() => {
        this._widgetsSyncTimer = null;
        this._widgetsSyncDebounceStartedAt = null;
        void this.syncToServer();
      }, WIDGET_SYNC_DEBOUNCE_MS);
      reportWidgetSyncPushFromDashboard(this);
    },

    flushWidgetsBeforeExit(_reason = "pageexit") {
      if (this._isExiting) {
        return;
      }
      this._isExiting = true;
      const hadPendingOutboundSync =
        Boolean(this._widgetsNeedSync) || this._widgetsSyncTimer != null;
      if (this._widgetsSyncTimer != null) {
        window.clearTimeout(this._widgetsSyncTimer);
        this._widgetsSyncTimer = null;
        this._widgetsSyncDebounceStartedAt = null;
      }
      this._disarmWidgetsSyncPoller();
      this._disarmWidgetsSyncPushTimer();
      this._widgetsUpdatedAt = saveWidgets(this.widgets, {
        updatedAt: this._widgetsUpdatedAt,
      });
      saveToolsWidgets(this.toolsWidgets);
      saveToolsLandingWidgets(this.toolsLandingWidgets);
      /* Keep outbound queue real: persistWidgetsDeferredSync sets this when the user/tooling dirties state,
         or a debounced PUT is still scheduled. Never force-sync on exit â€” forcing sync while the initial
         GET reconcile is still in flight can PUT default/tentative rows and wipe the server's last good blob. */
      this._widgetsNeedSync = hadPendingOutboundSync;
      if (!this.online) {
        return;
      }
      if (!this._widgetsWriteGateOpen) {
        return;
      }
      if (!hadPendingOutboundSync) {
        return;
      }
      void this.syncToServer({ keepalive: true, source: _reason });
    },

    persistWidgets(options = {}) {
      const doSync = options.sync !== false;
      if (doSync) {
        return this.persistWidgetsDeferredSync();
      }
      saveWidgets(this.widgets, { updatedAt: this._widgetsUpdatedAt });
    },

    _reconcilePayloadLocally(payload, trigger = "poll") {
      const remoteWidgets = Array.isArray(payload?.widgets) ? payload.widgets : null;
      const remoteToolsWidgets = Array.isArray(payload?.toolsWidgets) ? payload.toolsWidgets : null;
      const remoteToolsLandingWidgets = Array.isArray(payload?.toolsLandingWidgets)
        ? payload.toolsLandingWidgets
        : null;
      if (!remoteWidgets && !remoteToolsWidgets && !remoteToolsLandingWidgets) {
        if (trigger !== "visible") {
          console.error("Invalid widgets payload from server", payload);
        }
        return;
      }

      const localTs = this._widgetsUpdatedAt;
      const hasRemoteTs =
        typeof payload.updatedAt === "string" && Number.isFinite(new Date(payload.updatedAt).getTime());
      const hasLocalTs =
        typeof localTs === "string" && Number.isFinite(new Date(localTs).getTime());
      const compare = hasRemoteTs && hasLocalTs ? compareUpdatedAt(payload.updatedAt, localTs) : 0;
      const remoteLooksNewer =
        !hasRemoteTs && !hasLocalTs ? true
          : hasRemoteTs && hasLocalTs ? compare > 0
            : hasRemoteTs && !hasLocalTs;

      if ((this._widgetsNeedSync || this._isWidgetEditSessionActive()) && remoteLooksNewer) {
        this._cachePendingRemotePayload(payload);
        return;
      }

      // Merge policy:
      // - keep local when local is newer.
      // - prefer remote when remote is newer or markers are absent.
      const applyRemotePayload = () => {
        if (remoteWidgets) this.widgets = removeDeprecatedHomeWidgets(remoteWidgets);
        if (remoteToolsWidgets) this.toolsWidgets = remoteToolsWidgets;
        if (remoteToolsLandingWidgets) this.toolsLandingWidgets = remoteToolsLandingWidgets;
        evaluateAllTodoResets(this.widgets);
        evaluateAllTodoResets(this.toolsWidgets);
        this._widgetsUpdatedAt = payload.updatedAt || this._widgetsUpdatedAt;
        this._widgetsNeedSync = false;
        this.persistWidgets({ sync: false });
        this.persistToolsWidgets({ sync: false });
        this.persistToolsLandingWidgets({ sync: false });
        this.renderPageWidgets("home");
        this.renderPageWidgets("tools");
        this.renderPageWidgets("debug");
      };

      if (hasRemoteTs && hasLocalTs && compare < 0) {
        this._widgetsNeedSync = true;
        this.persistWidgets({ sync: true });
        this.persistToolsWidgets({ sync: true });
        this.persistToolsLandingWidgets({ sync: true });
        this.renderPageWidgets("home");
        this.renderPageWidgets("tools");
        this.renderPageWidgets("debug");
        return;
      }

      if (remoteLooksNewer) {
        applyRemotePayload();
        return;
      }

      if (!hasRemoteTs || !hasLocalTs || compare >= 0) {
        applyRemotePayload();
        return;
      }
    },

    async reconcileServerWidgets(trigger = "init") {
      if (trigger !== "init") {
        return;
      }
      if (this._widgetsWriteGateOpen || this._widgetsBootstrapInFlight) {
        return;
      }
      this._widgetsBootstrapInFlight = true;
      reportWidgetSyncRetrieve("attempt");

      try {
        if (!this.online) {
          reportWidgetSyncRetrieve("offline");
          return;
        }

        const response = await fetch(WIDGETS_API_URL, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`GET ${WIDGETS_API_URL} failed: ${response.status}`);
        }

        const raw = await response.json();
        const payload = loadWidgetPayloadFromApi(raw) || pickServerPayload(raw);
        if (
          !payload ||
          (!Array.isArray(payload.widgets) &&
            !Array.isArray(payload.toolsWidgets) &&
            !Array.isArray(payload.toolsLandingWidgets))
        ) {
          console.error("Invalid widgets payload from server", raw);
          reportWidgetSyncRetrieve("invalid", "Missing usable widget arrays in server JSON");
          return;
        }
        if (!Array.isArray(payload.widgets)) {
          reportWidgetSyncRetrieve("invalid", "Server document must include home widgets[] for bootstrap");
          return;
        }

        const applied = this._applyServerDocumentForced(
          {
            widgets: payload.widgets,
            toolsWidgets: payload.toolsWidgets ?? [],
            toolsLandingWidgets: payload.toolsLandingWidgets ?? [],
            updatedAt: payload.updatedAt,
          },
          "Bootstrap server snapshot applied"
        );
        if (!applied) {
          reportWidgetSyncRetrieve("invalid", "Could not apply server widget document");
          return;
        }

        this._widgetsLastSyncPullAt = new Date().toISOString();
        const okDetail =
          typeof payload.updatedAt === "string" && payload.updatedAt.trim()
            ? `updatedAt ${payload.updatedAt}`
            : "Server document applied locally";
        reportWidgetSyncRetrieve("success", okDetail);

        try {
          await this._finalizeServerDocumentIngest(raw, response);
        } catch (ackErr) {
          console.error("Widget bootstrap: POST /api/widgets/ack failed", ackErr);
          this._widgetsWriteGateOpen = false;
          this._widgetsAckError =
            ackErr instanceof Error && ackErr.message === "ACK_ENDPOINT_MISSING"
              ? /** @type {{ detail?: string }} */ (ackErr).detail || ackErr.message
              : ackErr instanceof Error
                ? ackErr.message
                : String(ackErr);
          reportWidgetSyncRetrieve("ack_error", this._widgetsAckError);
        }
      } catch (error) {
        console.error("Widget sync fetch failed", error);
        const msg = error instanceof Error ? error.message : String(error);
        reportWidgetSyncRetrieve("error", msg);
      } finally {
        this._widgetsBootstrapInFlight = false;
        this._widgetsPendingRemotePayload = null;
        reportWidgetSyncPushFromDashboard(this);
      }
    },

    async syncToServer(options = {}) {
      const useKeepalive = options.keepalive === true;
      const keepaliveSource = options.source || "manual";
      if (!this.online) {
        this._setWidgetSyncPushOutcome("skipped", "Offline (will retry when online)");
        reportWidgetSyncPushFromDashboard(this);
        return;
      }

      if (!this._widgetsWriteGateOpen) {
        this._setWidgetSyncPushOutcome("skipped", "Outbound blocked until first-open GET+apply+POST /api/widgets/ack");
        reportWidgetSyncPushFromDashboard(this);
        return;
      }

      if (!this._widgetsNeedSync) {
        this._setWidgetSyncPushOutcome("skipped", "No pending local changes");
        reportWidgetSyncPushFromDashboard(this);
        return;
      }

      if (this._widgetsSyncInFlight) {
        this._setWidgetSyncPushOutcome("queued", "Upload already in flight");
        return;
      }

      const nextPayload = getWidgetPayloadForApi(this.widgets, {
        updatedAt: this._widgetsUpdatedAt,
        toolsWidgets: this.toolsWidgets,
        toolsLandingWidgets: this.toolsLandingWidgets,
      });
      const expectRevision = normaliseRevisionToken(this._widgetsAckRevision);
      if (!expectRevision) {
        const msg = "Cannot sync: no revision token is available from first-open ACK.";
        console.error("Widget sync save failed", new Error(msg));
        this._setWidgetSyncPushOutcome("failed", msg);
        reportWidgetSyncPushEvent("fail", msg, this);
        return;
      }
      nextPayload.expectRevision = expectRevision;
      const serializedPayload = JSON.stringify(nextPayload);
      const syncAttemptedUpdatedAt = this._widgetsUpdatedAt;
      this._widgetsSyncInFlight = true;
      this._setWidgetSyncPushOutcome("uploading", "PUT in progress");
      reportWidgetSyncPushFromDashboard(this);
      const controller = useKeepalive ? null : new AbortController();
      if (controller) {
        this._widgetsSyncAbort = controller;
      }

      const putHeaders = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      putHeaders["X-Calvybots-Widgets-Revision"] = expectRevision;
      putHeaders["If-Match"] = `"${expectRevision}"`;

      try {
        let response;
        try {
          response = await fetch(WIDGETS_API_URL, {
            method: "PUT",
            headers: putHeaders,
            body: serializedPayload,
            ...(controller ? { signal: controller.signal } : {}),
            ...(useKeepalive ? { keepalive: true } : {}),
          });
        } catch (error) {
          if (error && error.name === "AbortError") {
            reportWidgetSyncPushEvent("aborted", "Request aborted", this);
            this._setWidgetSyncPushOutcome("aborted", "Request aborted");
            return;
          }
          if (useKeepalive && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            let beaconSent = false;
            try {
              beaconSent = navigator.sendBeacon(
                WIDGETS_API_URL,
                new Blob([serializedPayload], { type: "application/json" })
              );
            } catch (beaconError) {
              console.error("Widget sync beacon failed", beaconError);
            }
            if (beaconSent) {
              console.warn(`Widget sync: sendBeacon queued (no response); keeping _widgetsNeedSync for next online PUT (${keepaliveSource})`);
              reportWidgetSyncPushEvent("beacon_queued", keepaliveSource, this);
              this._setWidgetSyncPushOutcome("queued", "Keepalive beacon queued");
              return;
            }
            if (useKeepalive) {
              console.error(`Widget sync keepalive/ beacon fallback failed from ${keepaliveSource}`);
            }
          }
          throw error;
        }

        const responseText = await response.text();
        let body = null;
        try {
          body = responseText ? JSON.parse(responseText) : null;
        } catch {
          body = null;
        }
        const responseRevision = extractServerRevisionFromWidgetsResponse(
          body,
          response?.headers?.get?.("etag") || response?.headers?.get?.("ETag")
        );
        if (responseRevision) {
          this._widgetsAckRevision = responseRevision;
        }
        if (response.status === 409 || response.status === 428) {
          this._widgetsNeedSync = true;
          const msg = makeSyncFailureErrorMessage(response, responseText);
          this._setWidgetSyncPushOutcome("failed", msg);
          reportWidgetSyncPushEvent("fail", msg, this);
          return;
        }

        if (!response.ok) {
          throw new Error(makeSyncFailureErrorMessage(response, responseText));
        }

        if (body && body.skipped === true) {
          this._syncBaselineToCurrent();
          this._widgetsNeedSync = false;
          if (typeof body.revision === "string" && body.revision.trim()) {
            this._widgetsAckRevision = body.revision.trim();
          }
          this._widgetsLastSyncPushAt = new Date().toISOString();
          this._setWidgetSyncPushOutcome("success", "Server skipped no-op write");
          reportWidgetSyncPushEvent("success", "skipped no-op", this);
          return;
        }

        const hadUnsentLocalChanges = this._widgetsUpdatedAt !== syncAttemptedUpdatedAt;
        if (!hadUnsentLocalChanges) {
          this._widgetsNeedSync = false;
        }
        this._widgetsLastSyncPushAt = new Date().toISOString();
        const serverPayload = body ? loadWidgetPayloadFromApi(body) || pickServerPayload(body) : null;
        if (serverPayload?.updatedAt && this._widgetsUpdatedAt === syncAttemptedUpdatedAt) {
          this._widgetsUpdatedAt = serverPayload.updatedAt;
        }
        if (body && typeof body.revision === "string" && body.revision.trim()) {
          this._widgetsAckRevision = body.revision.trim();
        }
        this._syncBaselineToCurrent();
        const okDetail =
          serverPayload?.updatedAt && typeof serverPayload.updatedAt === "string"
            ? `server updatedAt ${serverPayload.updatedAt}`
            : "PUT accepted";
        this._setWidgetSyncPushOutcome("success", okDetail);
        reportWidgetSyncPushEvent("success", okDetail, this);
      } catch (error) {
        if (error && error.name === "AbortError") return;
        console.error("Widget sync save failed", error);
        const msg = error instanceof Error ? error.message : String(error);
        this._setWidgetSyncPushOutcome("failed", msg);
        reportWidgetSyncPushEvent("fail", msg, this);
      } finally {
        this._widgetsSyncInFlight = false;
        this._widgetsSyncAbort = null;
        this._applyPendingRemotePayload();
        reportWidgetSyncPushFromDashboard(this);
      }
    },

    normalizeWidgets() {
      this.widgets = this.widgets
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((widget, index) => ({ ...widget, position: index }));
    },

    normalizeToolsLandingWidgets() {
      this.toolsLandingWidgets = this.toolsLandingWidgets
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((widget, index) => ({ ...widget, position: index }));
    },

    normalizeToolsWidgets() {
      this.toolsWidgets = this.toolsWidgets
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((widget, index) => ({ ...widget, position: index }));
    },

    renderPageWidgets(pageKey) {
      const isHome = pageKey === "home";
      const isTools = pageKey === "tools";
      const isDebug = pageKey === "debug";
      if (!isHome && !isTools && !isDebug) return;
      const widgetMap = isHome
        ? this.widgetMapEl || document.getElementById("widget-grid")
        : isTools
          ? this.toolsGridEl || document.getElementById("tools-grid")
          : this.debugGridEl || document.getElementById("debug-grid");
      if (!widgetMap) return;

      if (isTools && (!Array.isArray(this.toolsLandingWidgets) || this.toolsLandingWidgets.length === 0)) {
        this.toolsLandingWidgets = loadToolsLandingWidgets();
        this.persistToolsLandingWidgets({ sync: this._widgetsWriteGateOpen });
      }
      const ctrls = isHome ? controllers : isTools ? toolsControllers : debugControllers;
      const ros = isHome ? resizeObservers : isTools ? toolsResizeObservers : debugResizeObservers;
      const factories = isHome ? widgetFactories : toolsWidgetFactories;

      if (isHome) this.normalizeWidgets();
      if (isTools) this.normalizeToolsLandingWidgets();
      if (isDebug) this.normalizeToolsWidgets();

      const widgetsList = isHome
        ? this.widgets
        : isTools
          ? this.toolsLandingWidgets
          : this.toolsWidgets;

      widgetMap.classList.add("widget-enter");
      widgetMap.innerHTML = "";
      ctrls.forEach((instance) => {
        if (instance?.destroy) instance.destroy();
      });
      ctrls.clear();
      ros.forEach((ro) => ro.disconnect());
      ros.clear();

      for (const config of widgetsList) {
        const shell = document.createElement("article");
        const typeLabel = widgetLabels[config.type] || "Widget";
        const displayName = widgetDisplayName(config);

        shell.className = `dash-widget ${this.editMode ? "editable" : ""}`;
        shell.dataset.widgetId = config.id;
        shell.dataset.widgetType = config.type;

        const minW = Number.isFinite(config.minWidth) ? config.minWidth : 250;
        const minH = Number.isFinite(config.minHeight) ? config.minHeight : 178;
        shell.style.minWidth = `${minW}px`;
        shell.style.minHeight = `${minH}px`;
        if (config.width != null && Number.isFinite(config.width)) {
          shell.style.width = `${config.width}px`;
        } else {
          shell.style.width = "";
        }
        if (config.height != null && Number.isFinite(config.height)) {
          shell.style.height = `${config.height}px`;
        } else {
          shell.style.height = "";
        }

        shell.innerHTML = `
          <div class="widget-header" data-widget-header></div>
          <div class="widget-content h-full"></div>
        `;

        const headerEl = shell.querySelector("[data-widget-header]");
        if (this.editMode) {
          const titleInput = document.createElement("input");
          titleInput.type = "text";
          titleInput.className = "widget-title-input";
          titleInput.value = (config.title || "").trim();
          titleInput.placeholder = typeLabel;
          titleInput.setAttribute("aria-label", "Widget name");
          let titleTimer = null;
          const saveTitle = () => {
            const list = isHome
              ? this.widgets
              : isTools
                ? this.toolsLandingWidgets
                : this.toolsWidgets;
            const idx = list.findIndex((w) => w.id === config.id);
            if (idx < 0) return;
            list[idx].title = titleInput.value.trim();
            if (isHome) this.persistWidgets();
            else if (isDebug) this.persistToolsWidgets();
            else if (isTools) this.persistToolsLandingWidgets();
          };
          titleInput.addEventListener("blur", saveTitle);
          titleInput.addEventListener("input", () => {
            if (titleTimer) window.clearTimeout(titleTimer);
            titleTimer = window.setTimeout(saveTitle, 450);
          });
          headerEl.appendChild(titleInput);
        } else {
          const label = document.createElement("div");
          label.className = "widget-title";
          label.textContent = displayName;
          headerEl.appendChild(label);
        }

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "widget-remove";
        removeBtn.textContent = "Ã—";
        removeBtn.title = "Remove widget";
        removeBtn.setAttribute("aria-label", `Remove ${widgetDisplayName(config)} widget`);
        removeBtn.style.display = this.editMode ? "grid" : "none";
        removeBtn.addEventListener("click", () => this.removeWidget(config.id, pageKey));
        shell.appendChild(removeBtn);

        const dragHandle = document.createElement("button");
        dragHandle.className = "widget-handle";
        dragHandle.textContent = "â ¿";
        dragHandle.style.display = this.editMode ? "grid" : "none";
        dragHandle.title = "Drag to move";
        dragHandle.type = "button";
        dragHandle.setAttribute("aria-label", `Reorder ${widgetDisplayName(config)} widget`);
        dragHandle.tabIndex = 0;
        shell.appendChild(dragHandle);

        if (this.editMode) {
          dragHandle.addEventListener("pointerdown", this.onWidgetPointerDown.bind(this), { passive: false });
          dragHandle.addEventListener("pointerup", this.onWidgetPointerUp.bind(this));
          dragHandle.addEventListener("pointercancel", this.onWidgetPointerCancel.bind(this));
          dragHandle.addEventListener("lostpointercapture", this.onWidgetLostPointerCapture.bind(this));
          dragHandle.addEventListener("keydown", this.onWidgetHandleKeydown.bind(this));
        }

        const widgetRenderer = factories[config.type];
        let moduleNode = null;
        if (widgetRenderer) {
          moduleNode = shell.querySelector(".widget-content");
          const instance = widgetRenderer(moduleNode, {
            editMode: this.editMode,
            config,
            dashboard: this,
            online: this.online,
          });
          if (instance) ctrls.set(config.id, instance);
        }

        widgetMap.appendChild(shell);

        if (this.editMode && moduleNode) {
          let resizeTimer = null;
          const ro = new ResizeObserver(() => {
            if (!this.editMode) return;
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
              const rect = shell.getBoundingClientRect();
              const w = Math.round(rect.width);
              const h = Math.round(rect.height);
              const list = isHome
                ? this.widgets
                : isTools
                  ? this.toolsLandingWidgets
                  : this.toolsWidgets;
              const idx = list.findIndex((item) => item.id === config.id);
              if (idx < 0) return;
              const prev = list[idx];
              if (prev.width === w && prev.height === h) return;
              list[idx].width = w;
              list[idx].height = h;
              list[idx].minWidth = minW;
              list[idx].minHeight = minH;
              if (isHome) this.persistWidgets();
              else if (isDebug) this.persistToolsWidgets();
              else if (isTools) this.persistToolsLandingWidgets();
            }, 280);
          });
          ro.observe(moduleNode);
          ros.set(config.id, ro);
        }
      }

      if (this._pendingWidgetFocusId && this._pendingWidgetFocusPage === pageKey) {
        const focusHandle = widgetMap.querySelector(
          `.dash-widget[data-widget-id="${this._pendingWidgetFocusId}"] .widget-handle`
        );
        if (focusHandle instanceof HTMLElement) {
          focusHandle.focus();
        }
        this._pendingWidgetFocusId = null;
      }
    },

    /** Rebuild both grids â€” used by widgets (e.g. To-Do) that expect `dashboard.renderWidgets()`. */
    renderWidgets() {
      this.renderPageWidgets("home");
      this.renderPageWidgets("tools");
      this.renderPageWidgets("debug");
    },

    onWidgetPointerDown(event) {
      if (!this.editMode) return;
      if (!event?.currentTarget || !event.target) return;
      const handle = event.currentTarget;
      const shell = handle.closest(".dash-widget");
      if (!(shell instanceof HTMLElement)) return;
      const widgetMap =
        shell.closest("#widget-grid") || shell.closest("#tools-grid") || shell.closest("#debug-grid");
      if (!(widgetMap instanceof HTMLElement)) return;
      const sourceWidgetId = shell.dataset.widgetId;
      if (!sourceWidgetId) return;
      if (typeof handle.setPointerCapture === "function") {
        handle.setPointerCapture(event.pointerId);
      }
      widgetDragState.pointerMoveHandler = this.onWidgetPointerMove.bind(this);
      document.addEventListener("pointermove", widgetDragState.pointerMoveHandler, { passive: false });

      const rect = shell.getBoundingClientRect();
      const ghost = shell.cloneNode(true);
      ghost.classList.add("dnd-ghost-widget");
      ghost.style.position = "fixed";
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.style.transform = "translate(0px, 0px)";
      ghost.style.pointerEvents = "none";
      ghost.style.zIndex = "9000";
      ghost.style.margin = "0";
      ghost.style.transformOrigin = "center";
      ghost.setAttribute("aria-hidden", "true");
      document.body.appendChild(ghost);

      widgetDragState.active = true;
      widgetDragState.pointerId = event.pointerId;
      widgetDragState.sourceWidgetId = sourceWidgetId;
      widgetDragState.sourceWidget = shell;
      widgetDragState.sourceRect = rect;
      widgetDragState.pointerOffsetX = event.clientX - rect.left;
      widgetDragState.pointerOffsetY = event.clientY - rect.top;
      widgetDragState.ghost = ghost;
      widgetDragState.dropTargetWidgetId = null;
      widgetDragState.dropIndex = null;
      widgetDragState.gridEl = widgetMap;
      document.body.classList.add("dnd-active");
      event.preventDefault();
    },

    getAddWidgetPickerOptions() {
      if (this.currentPage === "tools") return toolsTabAddWidgetChoices;
      if (this.currentPage === "debug") return debugAddWidgetChoices;
      return this.addWidgetChoices || [];
    },

    get addWidgetActiveOptionId() {
      const options = this.getAddWidgetPickerOptions();
      if (this.addWidgetPickerIndex < 0) return null;
      const active = options[this.addWidgetPickerIndex];
      if (!active || !active.type) return null;
      return `add-widget-option-${active.type}`;
    },

    openAddWidgetPicker() {
      if (!this.editMode) return;
      const options = this.getAddWidgetPickerOptions();
      if (!options.length) return;
      this.addWidgetOpen = true;
      this.addWidgetPickerIndex = 0;
      this.$nextTick(() => this.focusAddWidgetOption(this.addWidgetPickerIndex));
    },

    closeAddWidgetPicker(returnFocus = true) {
      this.addWidgetOpen = false;
      this.addWidgetPickerIndex = -1;
      if (returnFocus && this.$refs?.addWidgetButton?.focus) {
        this.$refs.addWidgetButton.focus();
      }
    },

    toggleAddWidgetPicker() {
      if (!this.editMode) return;
      if (this.addWidgetOpen) {
        this.closeAddWidgetPicker(true);
        return;
      }
      this.openAddWidgetPicker();
    },

    handleAddWidgetTriggerKeydown(event) {
      if (!this.editMode) return;
      const key = event.key;
      if (key === "ArrowDown" || key === "ArrowRight") {
        event.preventDefault();
        this.openAddWidgetPicker();
        return;
      }
      if (key === "ArrowUp" || key === "ArrowLeft") {
        event.preventDefault();
        const options = this.getAddWidgetPickerOptions();
        this.addWidgetOpen = true;
        this.addWidgetPickerIndex = options.length ? options.length - 1 : -1;
        this.$nextTick(() => this.focusAddWidgetOption(this.addWidgetPickerIndex));
        return;
      }
      if (key === "Enter" || key === " " || key === "Space") {
        event.preventDefault();
        this.toggleAddWidgetPicker();
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        this.closeAddWidgetPicker(true);
      }
    },

    handleAddWidgetOptionKeydown(event) {
      if (!this.addWidgetOpen) return;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        this.focusNextAddWidgetOption(1);
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        this.focusNextAddWidgetOption(-1);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        this.focusAddWidgetOption(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        const total = this.getAddWidgetPickerOptions().length;
        this.focusAddWidgetOption(total - 1);
        return;
      }
      if (event.key === "Enter" || event.key === " " || event.key === "Space") {
        event.preventDefault();
        this.activateAddWidgetOption(this.addWidgetPickerIndex);
        return;
      }
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        this.closeAddWidgetPicker(true);
      }
    },

    focusAddWidgetOption(index) {
      const options = this.getAddWidgetPickerOptions();
      if (!options.length) return;
      const pickerRefs = this.$refs?.addWidgetOption;
      if (!pickerRefs) return;
      const total = options.length;
      const normalizedIndex = ((index % total) + total) % total;
      const optionList = Array.isArray(pickerRefs) ? pickerRefs : [pickerRefs];
      const optionEl = optionList[normalizedIndex];
      if (optionEl instanceof HTMLElement) {
        optionEl.focus();
        this.addWidgetPickerIndex = normalizedIndex;
      }
    },

    focusNextAddWidgetOption(delta) {
      if (!this.getAddWidgetPickerOptions().length) return;
      const current = this.addWidgetPickerIndex >= 0 ? this.addWidgetPickerIndex : 0;
      this.focusAddWidgetOption(current + delta);
    },

    activateAddWidgetOption(index) {
      const options = this.getAddWidgetPickerOptions();
      const selectedIndex = Number.isInteger(index) ? index : this.addWidgetPickerIndex;
      if (!Number.isInteger(selectedIndex)) return;
      const selected = options[selectedIndex];
      if (!selected) return;
      const didAdd = this.addWidget(selected.type, false);
      if (didAdd) {
        this.closeAddWidgetPicker(true);
      }
      this.addWidgetPickerIndex = selectedIndex;
    },

    onWidgetHandleKeydown(event) {
      if (!this.editMode) return;
      const handle = event.currentTarget;
      if (!(handle instanceof HTMLElement)) return;
      const shell = handle.closest(".dash-widget");
      if (!(shell instanceof HTMLElement)) return;
      const widgetMap =
        shell.closest("#widget-grid") || shell.closest("#tools-grid") || shell.closest("#debug-grid");
      if (!(widgetMap instanceof HTMLElement)) return;
      const pageKey = widgetMap.id === "debug-grid" ? "debug" : widgetMap.id === "tools-grid" ? "tools" : "home";
      const list = pageKey === "home"
        ? this.widgets
        : pageKey === "tools"
          ? this.toolsLandingWidgets
          : this.toolsWidgets;
      const sourceId = shell.dataset.widgetId;
      if (!sourceId) return;
      const currentIndex = list.findIndex((widget) => widget.id === sourceId);
      if (currentIndex < 0) return;

      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowLeft" ||
        event.key === "PageUp"
      ) {
        event.preventDefault();
        this.moveWidgetByIndex(sourceId, currentIndex - 1, pageKey);
        return;
      }
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowRight" ||
        event.key === "PageDown"
      ) {
        event.preventDefault();
        this.moveWidgetByIndex(sourceId, currentIndex + 1, pageKey);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        this.moveWidgetByIndex(sourceId, 0, pageKey);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        this.moveWidgetByIndex(sourceId, list.length - 1, pageKey);
      }
    },

    moveWidgetByIndex(sourceId, targetIndex, pageKey) {
      const list =
        pageKey === "home" ? this.widgets
          : pageKey === "tools" ? this.toolsLandingWidgets
            : this.toolsWidgets;
      const sourceIndex = list.findIndex((widget) => widget.id === sourceId);
      if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= list.length) return;
      if (sourceIndex === targetIndex) return;
      const nextOrder = list.slice();
      const [moved] = nextOrder.splice(sourceIndex, 1);
      const insertAt = targetIndex < sourceIndex ? targetIndex : targetIndex;
      nextOrder.splice(insertAt, 0, moved);
      if (pageKey === "tools") {
        this.toolsLandingWidgets = nextOrder;
        this.persistToolsLandingWidgets();
        this.renderPageWidgets("tools");
      } else if (pageKey === "debug") {
        this.toolsWidgets = nextOrder;
        this.persistToolsWidgets();
        this.renderPageWidgets("debug");
      } else {
        this.widgets = nextOrder;
        this.persistWidgets();
        this.renderPageWidgets("home");
      }
      this._pendingWidgetFocusId = sourceId;
      this._pendingWidgetFocusPage = pageKey;
    },

    onWidgetPointerMove(event) {
      event.preventDefault();
      const widgetMap = widgetDragState.gridEl;
      if (!widgetMap) return;
      if (!widgetDragState.active || event.pointerId !== widgetDragState.pointerId || !widgetDragState.ghost) return;

      const rect = widgetDragState.sourceRect;
      if (!rect) return;

      const dx = event.clientX - widgetDragState.pointerOffsetX - rect.left;
      const dy = event.clientY - widgetDragState.pointerOffsetY - rect.top;
      widgetDragState.ghost.style.transform = `translate(${dx}px, ${dy}px)`;

      const pointerX = event.clientX;
      const pointerY = event.clientY;
      let target = null;
      let dropIndex = null;
      let targetBefore = true;
      const widgets = Array.from(widgetMap.querySelectorAll(".dash-widget"));

      for (const widget of widgets) {
        if (widget === widgetDragState.sourceWidget) continue;
        const bounds = widget.getBoundingClientRect();
        if (
          pointerX >= bounds.left &&
          pointerX <= bounds.right &&
          pointerY >= bounds.top &&
          pointerY <= bounds.bottom
        ) {
          target = widget;
          const targetRect = bounds;
          const midpoint = targetRect.top + targetRect.height / 2;
          targetBefore = pointerY < midpoint;
          const targetIndex = widgets.indexOf(widget);
          dropIndex = targetBefore ? targetIndex : targetIndex + 1;
          break;
        }
      }

      for (const widget of widgets) {
        widget.classList.toggle("dnd-over", widget === target);
      }

      widgetDragState.dropTargetWidgetId = target?.dataset.widgetId || null;
      widgetDragState.dropIndex = dropIndex;
    },

    onWidgetPointerUp(event) {
      if (widgetDragState.pointerMoveHandler) {
        document.removeEventListener("pointermove", widgetDragState.pointerMoveHandler);
        widgetDragState.pointerMoveHandler = null;
      }
      if (!widgetDragState.active || event.pointerId !== widgetDragState.pointerId) return;

      const sourceWidgetId = widgetDragState.sourceWidgetId;
      const targetWidgetId = widgetDragState.dropTargetWidgetId;
      const requestedIndex = widgetDragState.dropIndex;
      const gridEl = widgetDragState.gridEl;
      const isTools = gridEl?.id === "tools-grid";
      const isDebug = gridEl?.id === "debug-grid";
      const isHome = gridEl?.id === "widget-grid";

      let committed = false;
      if (targetWidgetId && sourceWidgetId && sourceWidgetId !== targetWidgetId && Number.isFinite(requestedIndex)) {
        const list = isHome
          ? this.widgets
          : isTools
          ? this.toolsLandingWidgets
          : this.toolsWidgets;
        const nextOrder = list.slice();
        const fromIndex = nextOrder.findIndex((widget) => widget.id === sourceWidgetId);
        const targetBaseIndex = requestedIndex > nextOrder.length ? nextOrder.length : requestedIndex;
        if (fromIndex >= 0) {
          const [moved] = nextOrder.splice(fromIndex, 1);
          let insertAt = targetBaseIndex;
          if (fromIndex < insertAt) {
            insertAt -= 1;
          }
          if (insertAt < 0) insertAt = 0;
          if (insertAt > nextOrder.length) insertAt = nextOrder.length;
          nextOrder.splice(insertAt, 0, moved);
          const prevOrder = isHome
            ? this.widgets
            : isTools
            ? this.toolsLandingWidgets
            : this.toolsWidgets;
          if (JSON.stringify(nextOrder) !== JSON.stringify(prevOrder)) {
            if (isTools) {
              this.toolsLandingWidgets = nextOrder;
              this.persistToolsLandingWidgets();
              this.renderPageWidgets("tools");
            } else if (isDebug) {
              this.toolsWidgets = nextOrder;
              this.persistToolsWidgets();
              this.renderPageWidgets("debug");
            } else {
              this.widgets = nextOrder;
              this.persistWidgets();
              this.renderPageWidgets("home");
            }
            committed = true;
          }
        }
      }

      this.onWidgetDragEnd(committed, !committed);
      if (widgetDragState.sourceWidget && widgetDragState.sourceWidget instanceof Element) {
        widgetDragState.sourceWidget.focus();
      }
      if (committed) {
        event.preventDefault();
      }
    },

    onWidgetPointerCancel() {
      if (widgetDragState.pointerMoveHandler) {
        document.removeEventListener("pointermove", widgetDragState.pointerMoveHandler);
        widgetDragState.pointerMoveHandler = null;
      }
      this.onWidgetDragEnd(false, true);
    },

    onWidgetLostPointerCapture() {
      if (widgetDragState.pointerMoveHandler) {
        document.removeEventListener("pointermove", widgetDragState.pointerMoveHandler);
        widgetDragState.pointerMoveHandler = null;
      }
      if (!widgetDragState.active) return;
      this.onWidgetDragEnd(false, true);
    },

    onWidgetDragEnd(committed = false, shouldSnapBack = false) {
      const widgetMap = widgetDragState.gridEl;
      const ghost = widgetDragState.ghost;
      if (!ghost) {
        widgetDragState.active = false;
        widgetDragState.pointerId = null;
        widgetDragState.sourceWidgetId = null;
        widgetDragState.sourceWidget = null;
        widgetDragState.sourceRect = null;
        widgetDragState.pointerOffsetX = 0;
        widgetDragState.pointerOffsetY = 0;
        widgetDragState.dropTargetWidgetId = null;
        widgetDragState.dropIndex = null;
        widgetDragState.gridEl = null;
        document.body.classList.remove("dnd-active");
        if (widgetMap) {
          Array.from(widgetMap.querySelectorAll(".dash-widget")).forEach((widget) => widget.classList.remove("dnd-over"));
        }
        return;
      }

      const cleanupGhost = () => {
        if (ghost.isConnected) ghost.remove();
      };

      if (shouldSnapBack && !committed) {
        const onSnapEnd = () => {
          ghost.removeEventListener("transitionend", onSnapEnd);
          cleanupGhost();
        };
        ghost.style.transition = "transform 220ms ease-out";
        ghost.style.transform = "translate(0px, 0px)";
        ghost.addEventListener("transitionend", onSnapEnd);
        setTimeout(onSnapEnd, 250);
      } else {
        cleanupGhost();
      }

      widgetDragState.active = false;
      widgetDragState.pointerId = null;
      widgetDragState.sourceWidgetId = null;
      widgetDragState.sourceWidget = null;
      widgetDragState.sourceRect = null;
      widgetDragState.pointerOffsetX = 0;
      widgetDragState.pointerOffsetY = 0;
      widgetDragState.ghost = null;
      widgetDragState.dropTargetWidgetId = null;
      widgetDragState.dropIndex = null;
      widgetDragState.gridEl = null;
      document.body.classList.remove("dnd-active");
      if (widgetMap) {
        Array.from(widgetMap.querySelectorAll(".dash-widget")).forEach((widget) => widget.classList.remove("dnd-over"));
      }
      if (widgetDragState.pointerMoveHandler) {
        document.removeEventListener("pointermove", widgetDragState.pointerMoveHandler);
        widgetDragState.pointerMoveHandler = null;
      }
    },

    toggleEditMode() {
      this.editMode = !this.editMode;
      document.body.classList.toggle("edit-mode", this.editMode);
      this.renderPageWidgets("home");
      this.renderPageWidgets("tools");
      this.renderPageWidgets("debug");
    },

    addWidget(type, returnFocus = true) {
      if (!this.editMode) return false;
      let added = false;
      if (this.currentPage === "debug") {
        if (!debugAddableTypeSet.has(type)) return false;
        const nextPosition = this.toolsWidgets.length;
        const next = {
          id: makeWidgetId(type),
          type,
          position: nextPosition,
          visible: true,
          title: "",
          minWidth: 250,
          minHeight: 178,
          width: null,
          height: null,
        };
        this.toolsWidgets = [...this.toolsWidgets, next];
        this.persistToolsWidgets();
        this.renderPageWidgets("debug");
        added = true;
      } else if (this.currentPage === "tools") {
        if (!toolsTabAddableTypeSet.has(type)) return false;
        const nextPosition = this.toolsLandingWidgets.length;
        const next = {
          id: makeWidgetId(type),
          type: "fortnight",
          position: nextPosition,
          visible: true,
          title: "",
          minWidth: 250,
          minHeight: 178,
          width: null,
          height: null,
          fortnightState: defaultFortnightState(),
        };
        this.toolsLandingWidgets = [...this.toolsLandingWidgets, next];
        this.persistToolsLandingWidgets();
        this.renderPageWidgets("tools");
        added = true;
      } else {
        if (!widgetTypeSet.has(type)) return false;
        const nextPosition = this.widgets.length;
        const next = {
          id: makeWidgetId(type),
          type,
          position: nextPosition,
          visible: true,
          title: "",
          minWidth: 250,
          minHeight: 178,
          width: null,
          height: null,
        };
        if (type === "notes") next.notesState = defaultNotesState();
        if (type === "todo") next.todoState = defaultTodoState();
        this.widgets = migrateLegacyIfNeeded([...this.widgets, next]);
        this.persistWidgets();
        this.renderPageWidgets("home");
        added = true;
      }
      if (!added) return false;

      this.addWidgetOpen = false;
      this.addWidgetPickerIndex = -1;
      if (returnFocus && this.$refs?.addWidgetButton?.focus) {
        this.$refs.addWidgetButton.focus();
      }
      return true;
    },

    removeWidget(widgetId, pageKey) {
      if (!this.editMode) return;
      let resolved = pageKey;
      if (resolved !== "home" && resolved !== "tools" && resolved !== "debug") {
        if (this.widgets.some((item) => item.id === widgetId)) resolved = "home";
        else if (this.toolsLandingWidgets.some((item) => item.id === widgetId)) resolved = "tools";
        else if (this.toolsWidgets.some((item) => item.id === widgetId)) resolved = "debug";
        else return;
      }
      if (resolved === "home") {
        this.widgets = this.widgets.filter((item) => item.id !== widgetId);
        this.persistWidgets();
        this.renderPageWidgets("home");
      } else if (resolved === "tools") {
        this.toolsLandingWidgets = this.toolsLandingWidgets.filter((item) => item.id !== widgetId);
        this.toolsLandingWidgets = this.toolsLandingWidgets.length
          ? this.toolsLandingWidgets
          : loadToolsLandingWidgets();
        this.persistToolsLandingWidgets();
        this.renderPageWidgets("tools");
      } else {
        this.toolsWidgets = this.toolsWidgets.filter((item) => item.id !== widgetId);
        this.persistToolsWidgets();
        this.renderPageWidgets("debug");
      }
    },

    destroy() {
      if (this._clockTicker) {
        window.clearInterval(this._clockTicker);
        this._clockTicker = null;
      }
      if (this._widgetsSyncTimer) {
        window.clearTimeout(this._widgetsSyncTimer);
        this._widgetsSyncTimer = null;
      }
      this._stopWidgetSyncDebugTicker();
      this._widgetsSyncDebounceStartedAt = null;
      this._widgetsSyncPushTimerStartedAt = null;
      if (this._widgetsSyncAbort && this._widgetsSyncAbort.abort) {
        this._widgetsSyncAbort.abort();
        this._widgetsSyncAbort = null;
      }
      this._disarmWidgetsSyncPoller();
      this._disarmWidgetsSyncPushTimer();
      this._disarmTodoResetTicker();
      if (this._onlineHandler) {
        window.removeEventListener("online", this._onlineHandler);
      }
      if (this._offlineHandler) {
        window.removeEventListener("offline", this._offlineHandler);
      }
      if (this._pagehideHandler) {
        window.removeEventListener("pagehide", this._pagehideHandler);
      }
      if (this._beforeUnloadHandler) {
        window.removeEventListener("beforeunload", this._beforeUnloadHandler);
      }
      if (this._visibilityHandler) {
        document.removeEventListener("visibilitychange", this._visibilityHandler);
      }
    },
  };
  });
});





