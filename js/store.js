const WIDGETS_KEY = "launchpad_widgets";
/** Legacy key fallback for migration from historical user data. */
const WIDGETS_KEY_LEGACY = "calvybots_widgets";
/** Tools page widget rows — same row shape as home; types are tools-specific (e.g. `placeholder`). */
const TOOLS_WIDGETS_KEY = "launchpad_tools_widgets";
/** Legacy tools key fallback for migration from historical user data. */
const TOOLS_WIDGETS_KEY_LEGACY = "calvybots_tools_widgets";
const TITLE_KEY = "launchpad_title";
/** Legacy title fallback for migration from historical user data. */
const TITLE_KEY_LEGACY = "calvybots_title";
/** Legacy single-blob keys — migrated once into first matching widget; then removed. */
const LEGACY_NOTES_KEY = "calvybots_notes";
const LEGACY_TODO_KEY = "calvybots_todo";

const DEFAULT_MIN_WIDTH = 250;
const DEFAULT_MIN_HEIGHT = 178;
const WIDGETS_DOCUMENT_VERSION = 1;
const SYNC_STATUS_SUCCESS = "success";
const SYNC_STATUS_UNKNOWN = "unknown";

/** Default task border / “none” swatch (style-guide `border`). */
export const TODO_TASK_DEFAULT_COLOR = "#3d3d3d";
export const TODO_TASK_NONE_COLOR = "";

/**
 * Canonical 3×3 palette (row-major):
 * #2dd4bf, #3b82f6, #22c55e, #ef4444, none/blank, #a855f7, #ec4899, #f0f0f0, #f97316.
 * Center none/blank reverts to default border colour in render.
 */
export const TODO_TASK_PALETTE = [
  { value: "#2dd4bf", label: "Cyan" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#22c55e", label: "Green" },
  { value: "#ef4444", label: "Red" },
  { value: TODO_TASK_NONE_COLOR, label: "None", isNone: true },
  { value: "#a855f7", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f0f0f0", label: "White" },
  { value: "#f97316", label: "Orange" },
];

const PALETTE_HEXES = new Set(
  TODO_TASK_PALETTE.filter((entry) => !entry.isNone).map((entry) => entry.value.toLowerCase())
);

/** Earlier picker values — keep so existing saves stay stable. */
const LEGACY_TODO_COLOR_HEXES = new Set([
  "#1c1c1c",
  "#242424",
  "#2e2e2e",
  "#2dd4bf",
  "#1fb6a5",
  "#9a9a9a",
  "#5c5c5c",
  "#f59e0b",
]);

export function normalizeTodoTaskColor(rawColor) {
  if (rawColor == null) return null;
  if (typeof rawColor !== "string") return null;
  const next = rawColor.trim().toLowerCase();
  if (!next || next === "default" || next === "none" || next === TODO_TASK_NONE_COLOR) return TODO_TASK_NONE_COLOR;
  if (next === TODO_TASK_DEFAULT_COLOR) return TODO_TASK_DEFAULT_COLOR;
  if (PALETTE_HEXES.has(next)) return next;
  if (LEGACY_TODO_COLOR_HEXES.has(next)) return next;
  return null;
}

const DEFAULT_WIDGETS = [
  { id: "widget-clock", type: "clock", position: 0 },
  { id: "widget-notes", type: "notes", position: 1 },
  { id: "widget-todo", type: "todo", position: 2 },
];

const TOOLS_WIDGET_ID_STATUS = "widget-tools-status";
const TOOLS_WIDGET_ID_LOG = "widget-tools-log";
const TOOLS_LEGACY_PLACEHOLDER_ID = "widget-tools-placeholder";
const TOOLS_TAB_PLACEHOLDER_ID = "widget-tools-tab-placeholder";
const TOOLS_LANDING_WIDGETS_KEY = "launchpad_tools_landing_widgets";
/** Legacy tools tab key fallback for migration from historical user data. */
const TOOLS_LANDING_WIDGETS_KEY_LEGACY = "calvybots_tools_landing_widgets";
const DEFAULT_TOOLS_WIDGETS = [
  { id: TOOLS_WIDGET_ID_STATUS, type: "status-tools", position: 0 },
  { id: TOOLS_WIDGET_ID_LOG, type: "log-tools", position: 1 },
];
const DEFAULT_TOOLS_TAB_WIDGETS = [
  { id: TOOLS_TAB_PLACEHOLDER_ID, type: "placeholder", position: 0 },
];
const TOOL_WIDGET_TYPES = new Set(["status-tools", "log-tools", "placeholder", "fortnight"]);

function readStorageValue(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorageValue(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function parseJson(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadJsonFromStorage(primaryKey, legacyKey) {
  const primaryRaw = readStorageValue(primaryKey);
  const primaryPayload = parseJson(primaryRaw);
  if (primaryRaw != null && primaryPayload != null) {
    return { payload: primaryPayload, source: primaryKey };
  }
  if (legacyKey == null) {
    return null;
  }
  const legacyRaw = readStorageValue(legacyKey);
  const legacyPayload = parseJson(legacyRaw);
  if (legacyRaw != null && legacyPayload != null) {
    return { payload: legacyPayload, source: legacyKey };
  }
  return null;
}

function saveJsonToStorage(primaryKey, legacyKey, payload) {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  writeStorageValue(primaryKey, raw);
  if (legacyKey && legacyKey !== primaryKey) {
    writeStorageValue(legacyKey, raw);
  }
}

function readStringFromStorage(primaryKey, legacyKey) {
  const primaryRaw = readStorageValue(primaryKey);
  if (primaryRaw != null) return primaryRaw;
  if (legacyKey == null) return null;
  return readStorageValue(legacyKey);
}

function saveStringToStorage(primaryKey, legacyKey, value) {
  const safeValue = String(value);
  writeStorageValue(primaryKey, safeValue);
  if (legacyKey && legacyKey !== primaryKey) {
    writeStorageValue(legacyKey, safeValue);
  }
}

export function defaultNotesState() {
  return { markdown: "", viewMode: "split" };
}

export function defaultTodoState() {
  return {
    tasks: [],
    recurrence: "never",
    timeLocal: "09:00",
    weekday: 1,
    lastResetAt: null,
  };
}

export function defaultFortnightState() {
  const today = toDateInputString();
  return {
    fnStartDate: today,
    lineAtStart: 1,
    rotateFrom: 1,
    rotateTo: 12,
    targetDate: today,
  };
}

function parseUpdatedAt(rawUpdatedAt) {
  if (typeof rawUpdatedAt !== "string" || !rawUpdatedAt.trim()) return null;
  const parsed = Date.parse(rawUpdatedAt);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function coerceWidgetsPayload(rawPayload) {
  if (!rawPayload) return { widgetsRaw: null, toolsWidgetsRaw: null, updatedAt: null };
  if (Array.isArray(rawPayload)) return { widgetsRaw: rawPayload, toolsWidgetsRaw: null, updatedAt: null };
  if (typeof rawPayload !== "object") return { widgetsRaw: null, toolsWidgetsRaw: null, updatedAt: null };

  const widgetsRaw = Array.isArray(rawPayload.widgets)
    ? rawPayload.widgets
    : Array.isArray(rawPayload.data?.widgets)
    ? rawPayload.data.widgets
    : null;
  const toolsWidgetsRaw = Array.isArray(rawPayload.toolsWidgets)
    ? rawPayload.toolsWidgets
    : Array.isArray(rawPayload.data?.toolsWidgets)
    ? rawPayload.data.toolsWidgets
    : null;
  const updatedAt = parseUpdatedAt(
    rawPayload.updatedAt || rawPayload.updated_at || rawPayload.lastUpdated
  );

  return { widgetsRaw, toolsWidgetsRaw, updatedAt };
}

export function normaliseWidgetRows(rawItems) {
  const normalized = normalise(rawItems);
  const migrated = migrateLegacyIfNeeded(normalized);
  evaluateAllTodoResets(migrated);
  return migrated;
}

const clampToNumber = (value, fallback) => {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function toDateInputString(date = new Date()) {
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return "";
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function clampRange(value, lower, upper) {
  const min = Number.isFinite(lower) ? lower : Number.NEGATIVE_INFINITY;
  const max = Number.isFinite(upper) ? upper : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeFortnightDate(rawDate, fallbackDate) {
  if (typeof rawDate !== "string") return fallbackDate;
  const value = rawDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallbackDate;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallbackDate : value;
}

function normalizeFortnightInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTimeParts(timeLocal) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(timeLocal || "").trim());
  if (!m) return { h: 9, mi: 0 };
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mi = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return { h, mi };
}

/** Start of the current daily period in device-local time (boundary at HH:MM each day). */
function dailyPeriodStart(now, timeLocal) {
  const { h, mi } = parseTimeParts(timeLocal);
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setMilliseconds(0);
  candidate.setHours(h, mi, 0, 0);
  if (now.getTime() >= candidate.getTime()) return candidate;
  candidate.setDate(candidate.getDate() - 1);
  return candidate;
}

/** Start of the current weekly period: last configured weekday at HH:MM on or before `now` (local). */
function weeklyPeriodStart(now, weekday, timeLocal) {
  const { h, mi } = parseTimeParts(timeLocal);
  const targetDow = clampToNumber(weekday, 0) % 7;
  for (let i = 0; i < 14; i += 1) {
    const t = new Date(now);
    t.setDate(now.getDate() - i);
    if (t.getDay() !== targetDow) continue;
    t.setHours(h, mi, 0, 0);
    t.setSeconds(0, 0);
    t.setMilliseconds(0);
    if (t.getTime() <= now.getTime()) return t;
  }
  return new Date(now);
}

/**
 * If a new recurrence period has begun since lastResetAt, clear all tasks' `done` and bump lastResetAt.
 * Team default: keep task id + text; only done flags reset. Device-local clock; DST can change the
 * wall-clock span between two boundaries — we use real Date instants in the local timezone, not fixed 24h math.
 */
export function evaluateTodoPeriodicReset(todoState) {
  if (!todoState || todoState.recurrence === "never") return false;

  const now = new Date();
  const recurrence = todoState.recurrence === "weekly" ? "weekly" : "daily";
  const periodStart =
    recurrence === "weekly"
      ? weeklyPeriodStart(now, todoState.weekday, todoState.timeLocal)
      : dailyPeriodStart(now, todoState.timeLocal);

  const last = todoState.lastResetAt ? new Date(todoState.lastResetAt) : null;

  if (!last || Number.isNaN(last.getTime())) {
    todoState.lastResetAt = periodStart.toISOString();
    return true;
  }

  if (last.getTime() >= periodStart.getTime()) return false;

  const tasks = Array.isArray(todoState.tasks) ? todoState.tasks : [];
  todoState.tasks = tasks.map((t) => ({ ...t, done: false }));
  todoState.lastResetAt = now.toISOString();
  return true;
}

export function evaluateAllTodoResets(widgets) {
  if (!Array.isArray(widgets)) return false;
  let any = false;
  widgets.forEach((w) => {
    if (w?.type !== "todo" || !w.todoState) return;
    if (evaluateTodoPeriodicReset(w.todoState)) any = true;
  });
  return any;
}

function mergeNotesState(raw) {
  const base = defaultNotesState();
  if (!raw || typeof raw !== "object") return base;
  const viewMode = raw.viewMode === "edit" || raw.viewMode === "preview" || raw.viewMode === "split" ? raw.viewMode : base.viewMode;
  return {
    ...base,
    markdown: typeof raw.markdown === "string" ? raw.markdown : base.markdown,
    viewMode,
  };
}

function mergeTodoState(raw) {
  const base = defaultTodoState();
  if (!raw || typeof raw !== "object") return base;
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks
        .map((t, i) => ({
          id: String(t?.id || `t-${i}`),
          text: typeof t?.text === "string" ? t.text : "",
          done: Boolean(t?.done),
          color: normalizeTodoTaskColor(t?.color),
        }))
        .filter((t) => t.text.length || t.id)
    : base.tasks;
  return {
    ...base,
    tasks: tasks.length ? tasks : base.tasks,
    recurrence: raw.recurrence === "daily" || raw.recurrence === "weekly" ? raw.recurrence : "never",
    timeLocal: typeof raw.timeLocal === "string" ? raw.timeLocal : base.timeLocal,
    weekday: clampToNumber(raw.weekday, base.weekday),
    lastResetAt: raw.lastResetAt == null ? null : String(raw.lastResetAt),
  };
}

function mergeFortnightState(raw) {
  const base = defaultFortnightState();
  if (!raw || typeof raw !== "object") return base;
  const rotateFrom = normalizeFortnightInt(raw.rotateFrom, base.rotateFrom);
  const rotateTo = normalizeFortnightInt(raw.rotateTo, base.rotateTo);
  const normalizedRotateFrom = Number.isFinite(rotateFrom) ? rotateFrom : base.rotateFrom;
  const normalizedRotateTo = Number.isFinite(rotateTo) ? rotateTo : base.rotateTo;
  const orderedFrom = normalizedRotateFrom > normalizedRotateTo ? normalizedRotateTo : normalizedRotateFrom;
  const orderedTo = normalizedRotateFrom > normalizedRotateTo ? normalizedRotateFrom : normalizedRotateTo;
  const safeStartDate = normalizeFortnightDate(raw.fnStartDate, base.fnStartDate);
  const safeTargetDate = normalizeFortnightDate(raw.targetDate, safeStartDate);
  const lineAtStart = normalizeFortnightInt(raw.lineAtStart, base.lineAtStart);
  return {
    fnStartDate: safeStartDate,
    lineAtStart: clampRange(lineAtStart, orderedFrom, orderedTo),
    rotateFrom: orderedFrom,
    rotateTo: orderedTo,
    targetDate: safeTargetDate,
  };
}

/**
 * If legacy keys exist, merge into the first widget of each type (by current order) and remove legacy keys.
 * Legacy keys may remain until at least one widget of that type exists; call again after adding notes/todo.
 */
export function migrateLegacyIfNeeded(widgets) {
  if (!Array.isArray(widgets) || widgets.length === 0) return widgets;

  const notesLegacy = readStorageValue(LEGACY_NOTES_KEY);
  const todoLegacy = readStorageValue(LEGACY_TODO_KEY);

  const next = widgets.map((w) => ({ ...w }));
  let changed = false;

  if (notesLegacy != null && String(notesLegacy).length) {
    const idx = next.findIndex((w) => w.type === "notes");
    if (idx >= 0) {
      const prev = mergeNotesState(next[idx].notesState);
      next[idx] = {
        ...next[idx],
        notesState: { ...prev, markdown: String(notesLegacy) },
      };
      changed = true;
      removeStorageValue(LEGACY_NOTES_KEY);
    }
  }

  if (todoLegacy != null && String(todoLegacy).trim().length) {
    const idx = next.findIndex((w) => w.type === "todo");
    if (idx >= 0) {
      let parsed = [];
      try {
        parsed = JSON.parse(todoLegacy);
      } catch {
        parsed = [];
      }
      const tasks = Array.isArray(parsed)
        ? parsed.map((item, i) => ({
            id: String(item?.id || `m-${i}`),
            text: typeof item?.text === "string" ? item.text : "",
            done: Boolean(item?.done),
            color: normalizeTodoTaskColor(item?.color),
          }))
        : [];
      const prev = mergeTodoState(next[idx].todoState);
      next[idx] = {
        ...next[idx],
        todoState: { ...prev, tasks: tasks.length ? tasks : prev.tasks },
      };
      changed = true;
      removeStorageValue(LEGACY_TODO_KEY);
    }
  }

  return changed ? next : widgets;
}

function normalise(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return [...DEFAULT_WIDGETS].map((w, i) => ({
      ...w,
      position: i,
      visible: true,
      minWidth: DEFAULT_MIN_WIDTH,
      minHeight: DEFAULT_MIN_HEIGHT,
      ...(w.type === "notes" ? { notesState: defaultNotesState() } : {}),
      ...(w.type === "todo" ? { todoState: defaultTodoState() } : {}),
    }));
  }

  const valid = rawItems
    .map((item, index) => {
      const type = typeof item?.type === "string" ? item.type : null;
      if (!type) return null;
      const id = String(item.id || `${type}-${Date.now()}-${index}`);
      const position = clampToNumber(item.position, index);
      const visible = item.visible !== false;
      const title = typeof item.title === "string" ? item.title : "";
      const minWidth = clampToNumber(item.minWidth, DEFAULT_MIN_WIDTH);
      const minHeight = clampToNumber(item.minHeight, DEFAULT_MIN_HEIGHT);
      const width =
        item.width == null || item.width === "" ? null : clampToNumber(item.width, NaN);
      const height =
        item.height == null || item.height === "" ? null : clampToNumber(item.height, NaN);

      const base = {
        id,
        type,
        position,
        visible,
        title,
        minWidth,
        minHeight,
        width: width == null || Number.isNaN(width) ? null : width,
        height: height == null || Number.isNaN(height) ? null : height,
      };

      if (type === "notes") {
        return { ...base, notesState: mergeNotesState(item.notesState) };
      }
      if (type === "todo") {
        return { ...base, todoState: mergeTodoState(item.todoState) };
      }
      return base;
    })
    .filter(Boolean)
    .filter((item) => item.visible !== false)
    .sort((a, b) => a.position - b.position);

  return valid.map((item, index) => ({
    ...item,
    position: index,
  }));
}

export function normaliseToolsRows(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return DEFAULT_TOOLS_WIDGETS.map((w, i) => ({
      ...w,
      position: i,
      visible: true,
      minWidth: DEFAULT_MIN_WIDTH,
      minHeight: DEFAULT_MIN_HEIGHT,
    }));
  }

  const isLegacySinglePlaceholderDefault = Array.isArray(rawItems)
    && rawItems.length === 1
    && rawItems[0]
    && rawItems[0].type === "placeholder"
    && rawItems[0].id === TOOLS_LEGACY_PLACEHOLDER_ID;

  const normalisedInput = isLegacySinglePlaceholderDefault
    ? DEFAULT_TOOLS_WIDGETS
    : rawItems;

  const valid = normalisedInput
    .map((item, index) => {
      const type = typeof item?.type === "string" ? item.type : null;
      if (!TOOL_WIDGET_TYPES.has(type)) return null;
      const id = String(item.id || `placeholder-${Date.now()}-${index}`);
      const position = clampToNumber(item.position, index);
      const visible = item.visible !== false;
      const title = typeof item.title === "string" ? item.title : "";
      const minWidth = clampToNumber(item.minWidth, DEFAULT_MIN_WIDTH);
      const minHeight = clampToNumber(item.minHeight, DEFAULT_MIN_HEIGHT);
      const width =
        item.width == null || item.width === "" ? null : clampToNumber(item.width, NaN);
      const height =
        item.height == null || item.height === "" ? null : clampToNumber(item.height, NaN);

      const base = {
        id,
        type,
        position,
        visible,
        title,
        minWidth,
        minHeight,
        width: width == null || Number.isNaN(width) ? null : width,
        height: height == null || Number.isNaN(height) ? null : height,
      };

      if (type === "fortnight") {
        return { ...base, fortnightState: mergeFortnightState(item.fortnightState) };
      }
      return base;
    })
    .filter(Boolean)
    .filter((item) => item.visible !== false)
    .sort((a, b) => a.position - b.position);

  if (!valid.length) {
    return normaliseToolsRows(null);
  }

  return valid.map((item, index) => ({
    ...item,
    position: index,
  }));
}

function normaliseToolsLandingRows(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return DEFAULT_TOOLS_TAB_WIDGETS.map((w, i) => ({
      ...w,
      position: i,
      visible: true,
      minWidth: DEFAULT_MIN_WIDTH,
      minHeight: DEFAULT_MIN_HEIGHT,
    }));
  }

  const valid = rawItems
    .map((item, index) => {
      const type = typeof item?.type === "string" ? item.type : null;
      if (type !== "placeholder") return null;
      const id = String(item.id || `tools-tab-widget-${Date.now()}-${index}`);
      const position = clampToNumber(item.position, index);
      const visible = item.visible !== false;
      const title = typeof item.title === "string" ? item.title : "";
      const minWidth = clampToNumber(item.minWidth, DEFAULT_MIN_WIDTH);
      const minHeight = clampToNumber(item.minHeight, DEFAULT_MIN_HEIGHT);
      const width = item.width == null || item.width === "" ? null : clampToNumber(item.width, NaN);
      const height = item.height == null || item.height === "" ? null : clampToNumber(item.height, NaN);
      return {
        id,
        type,
        position,
        visible,
        title,
        minWidth,
        minHeight,
        width: width == null || Number.isNaN(width) ? null : width,
        height: height == null || Number.isNaN(height) ? null : height,
      };
    })
    .filter(Boolean)
    .filter((item) => item.visible !== false)
    .sort((a, b) => a.position - b.position);

  if (!valid.length) {
    return normaliseToolsLandingRows(null);
  }

  return valid.map((item, index) => ({ ...item, position: index }));
}

export function loadWidgets() {
  return loadWidgetsDocument().widgets;
}

export function loadWidgetsDocument() {
  try {
    const fallback = normaliseWidgetRows(normalise(null));
    const stored = loadJsonFromStorage(WIDGETS_KEY, WIDGETS_KEY_LEGACY);
    if (!stored) {
      return { widgets: fallback, updatedAt: null, syncStatus: SYNC_STATUS_UNKNOWN };
    }

    const parsed = stored.payload;
    const payload = coerceWidgetsPayload(parsed);
    return {
      widgets: normaliseWidgetRows(payload.widgetsRaw),
      updatedAt: payload.updatedAt,
      syncStatus: payload.updatedAt ? SYNC_STATUS_SUCCESS : SYNC_STATUS_UNKNOWN,
    };
  } catch (err) {
    console.error("Failed to load local widget payload", err);
    return {
      widgets: normaliseWidgetRows(normalise(null)),
      updatedAt: null,
      syncStatus: SYNC_STATUS_UNKNOWN,
    };
  }
}

export function saveWidgets(widgets, options = {}) {
  const payload = normaliseWidgetRows(widgets || []);
  /* When callers pass `updatedAt` (even null/undefined), do not fabricate a timestamp — init uses this
     so a cold load does not stamp defaults as "newer than server" and overwrite remote state on sync. */
  const updatedAt =
    "updatedAt" in options ? parseUpdatedAt(options.updatedAt) : new Date().toISOString();
  saveJsonToStorage(WIDGETS_KEY, WIDGETS_KEY_LEGACY, {
    version: WIDGETS_DOCUMENT_VERSION,
    updatedAt,
    widgets: payload,
  });
  return updatedAt;
}

export function getWidgetPayloadForApi(widgets, options = {}) {
  const toolsWidgets = options.toolsWidgets;
  const updatedAt =
    "updatedAt" in options ? parseUpdatedAt(options.updatedAt) : new Date().toISOString();
  return {
    version: WIDGETS_DOCUMENT_VERSION,
    updatedAt,
    widgets: normaliseWidgetRows(widgets || []),
    ...(Array.isArray(toolsWidgets) ? { toolsWidgets: normaliseToolsRows(toolsWidgets || []) } : {}),
  };
}

export function loadWidgetPayloadFromApi(raw) {
  const payload = coerceWidgetsPayload(raw);
  if (!payload.widgetsRaw && !payload.toolsWidgetsRaw) return null;
  return {
    version: (raw && raw.version) || WIDGETS_DOCUMENT_VERSION,
    updatedAt: payload.updatedAt,
    widgets: payload.widgetsRaw ? normaliseWidgetRows(payload.widgetsRaw) : null,
    toolsWidgets: payload.toolsWidgetsRaw ? normaliseToolsRows(payload.toolsWidgetsRaw) : null,
  };
}

export function loadToolsWidgets() {
  try {
    const stored = loadJsonFromStorage(TOOLS_WIDGETS_KEY, TOOLS_WIDGETS_KEY_LEGACY);
    if (!stored) {
      const fresh = normaliseToolsRows(null);
      evaluateAllTodoResets(fresh);
      return fresh;
    }
    const parsed = stored.payload;
    const rawTools = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.toolsWidgets)
      ? parsed.toolsWidgets
      : Array.isArray(parsed?.widgets)
      ? parsed.widgets
      : null;
    let widgets = normaliseToolsRows(rawTools);
    evaluateAllTodoResets(widgets);
    return widgets;
  } catch {
    const fallback = normaliseToolsRows(null);
    evaluateAllTodoResets(fallback);
    return fallback;
  }
}

export function loadToolsLandingWidgets() {
  try {
    const stored = loadJsonFromStorage(
      TOOLS_LANDING_WIDGETS_KEY,
      TOOLS_LANDING_WIDGETS_KEY_LEGACY
    );
    if (!stored) {
      return normaliseToolsLandingRows(null);
    }

    const parsed = stored.payload;
    const rawToolsLanding = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.toolsLandingWidgets)
      ? parsed.toolsLandingWidgets
      : null;
    return normaliseToolsLandingRows(rawToolsLanding);
  } catch (err) {
    console.error("Failed to load tools landing widgets", err);
    return normaliseToolsLandingRows(null);
  }
}

export function saveToolsWidgets(widgets) {
  const payload = (widgets || [])
    .map((widget, index) => {
      const row = {
        id: widget.id,
        type: widget.type,
        position: index,
        visible: widget.visible !== false,
        title: typeof widget.title === "string" ? widget.title : "",
        minWidth: clampToNumber(widget.minWidth, DEFAULT_MIN_WIDTH),
        minHeight: clampToNumber(widget.minHeight, DEFAULT_MIN_HEIGHT),
        width:
          widget.width == null || widget.width === ""
            ? null
            : clampToNumber(widget.width, NaN),
        height:
          widget.height == null || widget.height === ""
            ? null
            : clampToNumber(widget.height, NaN),
      };
      if (row.width != null && Number.isNaN(row.width)) row.width = null;
      if (row.height != null && Number.isNaN(row.height)) row.height = null;
      if (widget.type === "fortnight") {
        row.fortnightState = mergeFortnightState(widget.fortnightState);
      }
      return row;
    })
    .sort((a, b) => a.position - b.position);
  saveJsonToStorage(TOOLS_WIDGETS_KEY, TOOLS_WIDGETS_KEY_LEGACY, payload);
}

export function saveToolsLandingWidgets(widgets) {
  const payload = (widgets || [])
    .map((widget, index) => ({
      id: widget.id,
      type: widget.type,
      position: index,
      visible: widget.visible !== false,
      title: typeof widget.title === "string" ? widget.title : "",
      minWidth: clampToNumber(widget.minWidth, DEFAULT_MIN_WIDTH),
      minHeight: clampToNumber(widget.minHeight, DEFAULT_MIN_HEIGHT),
      width:
        widget.width == null || widget.width === "" ? null : clampToNumber(widget.width, NaN),
      height:
        widget.height == null || widget.height === "" ? null : clampToNumber(widget.height, NaN),
    }))
    .map((row) => ({
      ...row,
      width: row.width == null || Number.isNaN(row.width) ? null : row.width,
      height: row.height == null || Number.isNaN(row.height) ? null : row.height,
    }))
    .sort((a, b) => a.position - b.position);
  saveJsonToStorage(TOOLS_LANDING_WIDGETS_KEY, TOOLS_LANDING_WIDGETS_KEY_LEGACY, payload);
}

const DEFAULT_SITE_TITLE = "Calvy Launchpad";

function migrateLegacySiteTitle(stored) {
  const t = stored.trim();
  const lower = t.toLowerCase();
  if (
    lower === "calvybots dashboard" ||
    lower === "calvybot dashboard" ||
    lower === "calvybots personal dashboard"
  ) {
    return DEFAULT_SITE_TITLE;
  }
  return t;
}

export function loadSiteTitle() {
  const stored = readStringFromStorage(TITLE_KEY, TITLE_KEY_LEGACY);
  if (!stored || !stored.trim()) return DEFAULT_SITE_TITLE;
  const migrated = migrateLegacySiteTitle(stored);
  if (migrated !== stored.trim()) {
    saveSiteTitle(migrated);
  }
  return migrated;
}

export function saveSiteTitle(value) {
  saveStringToStorage(TITLE_KEY, TITLE_KEY_LEGACY, String(value || "").trim() || DEFAULT_SITE_TITLE);
}
