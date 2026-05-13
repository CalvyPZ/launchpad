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
  loadWidgetPayloadFromApi,
  normaliseWidgetRows,
  normaliseToolsRows,
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

function pickServerPayload(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return {
      version: 1,
      updatedAt: null,
      widgets: normaliseWidgetRows(raw),
      toolsWidgets: null,
    };
  }
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
    };
  }
  if (Array.isArray(raw.toolsWidgets)) {
    return {
      version: raw.version || 1,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
      widgets: null,
      toolsWidgets: normaliseToolsRows(raw.toolsWidgets),
    };
  }
  if (Array.isArray(raw.data?.toolsWidgets)) {
    return {
      version: raw.version || 1,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
      widgets: null,
      toolsWidgets: normaliseToolsRows(raw.data.toolsWidgets),
    };
  }
  return null;
}

const addWidgetChoices = [
  { type: "notes", label: "Sticky Notes", icon: "📝" },
  { type: "todo", label: "To-Do", icon: "✅" },
];

const toolsWidgetTypes = ["status-tools", "log-tools", "placeholder", "fortnight"];
const toolsWidgetFactories = {
  "status-tools": statusToolsWidget.render,
  "log-tools": logToolsWidget.render,
  placeholder: placeholderWidget.render,
  fortnight: fortnightToolsWidget.render,
};
const toolsWidgetTypeSet = new Set(toolsWidgetTypes);
const toolsAddWidgetChoices = [
  { type: "status-tools", label: "Status", icon: "📡" },
  { type: "log-tools", label: "Log", icon: "📋" },
  { type: "fortnight", label: "Fortnight", icon: "📆" },
];

const widgetLabels = {
  notes: "Sticky Notes",
  todo: "To-Do",
  "status-tools": "Status",
  "log-tools": "Log",
  fortnight: "Fortnight",
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
    _initialServerSyncDone: false,
    _initialServerSyncInFlight: false,
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

    navigateTo(page) {
      const next = pageKeys.has(page) ? page : "home";
      this.currentPage = next;
      this.closeAddWidgetPicker(false);
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

    persistToolsLandingWidgets() {
      saveToolsLandingWidgets(this.toolsLandingWidgets);
    },

    init() {
      this.widgetMapEl = this.$refs?.widgetGrid || document.getElementById("widget-grid");
      this.toolsGridEl = this.$refs?.toolsGrid || document.getElementById("tools-grid");
      this.debugGridEl = this.$refs?.debugGrid || document.getElementById("debug-grid");
      initSiteDiagnostics();
      this._onlineHandler = () => {
        this.online = true;
        if (this._widgetsNeedSync) {
          void this.syncToServer();
          this._armWidgetsSyncPoller();
          this._armWidgetsSyncPushTimer();
          reportWidgetSyncPushFromDashboard(this);
          return;
        }
        this._armWidgetsSyncPoller();
        this._armWidgetsSyncPushTimer();
        reportWidgetSyncPushFromDashboard(this);
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
            this.persistWidgets();
            this.persistToolsWidgets();
            this.persistToolsLandingWidgets();
            this.renderPageWidgets("home");
            this.renderPageWidgets("tools");
            this.renderPageWidgets("debug");
          }
          if (this._widgetsNeedSync && this.online) {
            void this.syncToServer();
            this._armWidgetsSyncPoller();
            this._armWidgetsSyncPushTimer();
            return;
          }
          this._armTodoResetTicker();
          this._armWidgetsSyncPoller();
          this._armWidgetsSyncPushTimer();
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
      this.persistToolsLandingWidgets();
      if (this._clockTicker) window.clearInterval(this._clockTicker);
      this._clockTicker = window.setInterval(() => this.refreshClock(), 1000);
      void this.reconcileServerWidgets("init");
      if (document.visibilityState === "visible") {
        this._armTodoResetTicker();
        this._armWidgetsSyncPoller();
        this._armWidgetsSyncPushTimer();
      }
      reportWidgetSyncPushFromDashboard(this);
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
      if (this._initialServerSyncDone) {
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
      if (document.visibilityState !== "visible" || !this.online) return;
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
          this.persistWidgets();
          any = true;
        }
        if (evaluateAllTodoResets(this.toolsWidgets)) {
          this.persistToolsWidgets();
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
      const statusText = message ? `${status} — ${message}` : status;
      return at ? `${statusText} (${at})` : statusText;
    },

    _resolveWidgetSyncRetrieveLabel() {
      if (!this._initialServerSyncDone) {
        return this._initialServerSyncInFlight
          ? "bootstrap GET in progress"
          : "bootstrap-only: initial GET pending";
      }
      return "bootstrap-only / not currently polling";
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
      /* Keep outbound queue real: persistWidgetsDeferredSync sets this when the user/tooling dirties state,
         or a debounced PUT is still scheduled. Never force-sync on exit — forcing sync while the initial
         GET reconcile is still in flight can PUT default/tentative rows and wipe the server's last good blob. */
      this._widgetsNeedSync = hadPendingOutboundSync;
      if (!this.online) {
        return;
      }
      if (!this._initialServerSyncDone && !hadPendingOutboundSync) {
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
      if (!remoteWidgets && !remoteToolsWidgets) {
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
        evaluateAllTodoResets(this.widgets);
        evaluateAllTodoResets(this.toolsWidgets);
        this._widgetsUpdatedAt = payload.updatedAt || this._widgetsUpdatedAt;
        this._widgetsNeedSync = false;
        this.persistWidgets({ sync: false });
        this.persistToolsWidgets({ sync: false });
        this.renderPageWidgets("home");
        this.renderPageWidgets("tools");
        this.renderPageWidgets("debug");
      };

      if (hasRemoteTs && hasLocalTs && compare < 0) {
        this._widgetsNeedSync = true;
        this.persistWidgets({ sync: true });
        this.persistToolsWidgets({ sync: true });
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
      if (this._initialServerSyncDone || this._initialServerSyncInFlight) {
        return;
      }
      this._initialServerSyncInFlight = true;
      reportWidgetSyncRetrieve("attempt");

      try {
        if (!this.online) {
          reportWidgetSyncRetrieve("offline");
          return;
        }

        const response = await fetch(WIDGETS_API_URL, {
          method: "GET",
          headers: { "Accept": "application/json" },
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`GET ${WIDGETS_API_URL} failed: ${response.status}`);
        }

        const raw = await response.json();
        const payload = loadWidgetPayloadFromApi(raw) || pickServerPayload(raw);
        if (!payload || !Array.isArray(payload.widgets)) {
          if (trigger !== "visible") {
            console.error("Invalid widgets payload from server", raw);
          }
          reportWidgetSyncRetrieve("invalid", "Missing usable widgets[] in server JSON");
          return;
        }

        this._reconcilePayloadLocally(payload, trigger);
        this._applyPendingRemotePayload();
        this._widgetsLastSyncPullAt = new Date().toISOString();
        const okDetail =
          typeof payload.updatedAt === "string" && payload.updatedAt.trim()
            ? `updatedAt ${payload.updatedAt}`
            : "Server document merged";
        reportWidgetSyncRetrieve("success", okDetail);
      } catch (error) {
        if (trigger !== "visible") {
          console.error("Widget sync fetch failed", error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        reportWidgetSyncRetrieve("error", msg);
      } finally {
        this._initialServerSyncDone = true;
        this._initialServerSyncInFlight = false;
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
      });
      const serializedPayload = JSON.stringify(nextPayload);
      const syncAttemptedUpdatedAt = this._widgetsUpdatedAt;
      this._widgetsSyncInFlight = true;
      this._setWidgetSyncPushOutcome("uploading", "PUT in progress");
      reportWidgetSyncPushFromDashboard(this);
      const controller = useKeepalive ? null : new AbortController();
      if (controller) {
        this._widgetsSyncAbort = controller;
      }

      try {
        let response;
        try {
          response = await fetch(WIDGETS_API_URL, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
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
        if (!response.ok) {
          let bodyText = "";
          try {
            bodyText = await response.text();
          } catch {
            bodyText = "";
          }
          const detail = bodyText ? ` ${bodyText.trim().slice(0, 240)}` : "";
          throw new Error(
            `PUT ${WIDGETS_API_URL} failed: ${response.status} ${response.statusText}${detail}`
          );
        }

        const hadUnsentLocalChanges = this._widgetsUpdatedAt !== syncAttemptedUpdatedAt;
        if (!hadUnsentLocalChanges) {
          this._widgetsNeedSync = false;
        }
        this._widgetsLastSyncPushAt = new Date().toISOString();
        const body = await response.json().catch(() => null);
        const serverPayload = body ? loadWidgetPayloadFromApi(body) || pickServerPayload(body) : null;
        if (serverPayload?.updatedAt && this._widgetsUpdatedAt === syncAttemptedUpdatedAt) {
          this._widgetsUpdatedAt = serverPayload.updatedAt;
        }
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
        this.persistToolsLandingWidgets();
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
        removeBtn.textContent = "×";
        removeBtn.title = "Remove widget";
        removeBtn.setAttribute("aria-label", `Remove ${widgetDisplayName(config)} widget`);
        removeBtn.style.display = this.editMode ? "grid" : "none";
        removeBtn.addEventListener("click", () => this.removeWidget(config.id, pageKey));
        shell.appendChild(removeBtn);

        const dragHandle = document.createElement("button");
        dragHandle.className = "widget-handle";
        dragHandle.textContent = "⠿";
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

    /** Rebuild both grids — used by widgets (e.g. To-Do) that expect `dashboard.renderWidgets()`. */
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
      if (this.currentPage === "debug") return toolsAddWidgetChoices;
      if (this.currentPage === "tools") return [];
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
        if (!toolsWidgetTypeSet.has(type)) return false;
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
        if (type === "fortnight") next.fortnightState = defaultFortnightState();
        this.toolsWidgets = [...this.toolsWidgets, next];
        this.persistToolsWidgets();
        this.renderPageWidgets("debug");
        added = true;
      } else if (this.currentPage === "tools") {
        return false;
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
        if (type === "fortnight") next.fortnightState = defaultFortnightState();
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
