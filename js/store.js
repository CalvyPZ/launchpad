const WIDGETS_KEY = "calvybots_widgets";
const TITLE_KEY = "calvybots_title";
/** Legacy single-blob keys — migrated once into first matching widget; then removed. */
const LEGACY_NOTES_KEY = "calvybots_notes";
const LEGACY_TODO_KEY = "calvybots_todo";

const DEFAULT_MIN_WIDTH = 250;
const DEFAULT_MIN_HEIGHT = 178;

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

const clampToNumber = (value, fallback) => {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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

/**
 * If legacy keys exist, merge into the first widget of each type (by current order) and remove legacy keys.
 * Legacy keys may remain until at least one widget of that type exists; call again after adding notes/todo.
 */
export function migrateLegacyIfNeeded(widgets) {
  if (!Array.isArray(widgets) || widgets.length === 0) return widgets;

  let notesLegacy = null;
  let todoLegacy = null;
  try {
    notesLegacy = localStorage.getItem(LEGACY_NOTES_KEY);
  } catch {
    notesLegacy = null;
  }
  try {
    const t = localStorage.getItem(LEGACY_TODO_KEY);
    todoLegacy = t;
  } catch {
    todoLegacy = null;
  }

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
      try {
        localStorage.removeItem(LEGACY_NOTES_KEY);
      } catch {
        /* ignore */
      }
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
      try {
        localStorage.removeItem(LEGACY_TODO_KEY);
      } catch {
        /* ignore */
      }
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

export function loadWidgets() {
  try {
    const stored = localStorage.getItem(WIDGETS_KEY);
    if (!stored) {
      const fresh = normalise(null);
      const migrated = migrateLegacyIfNeeded(fresh);
      evaluateAllTodoResets(migrated);
      return migrated;
    }
    const parsed = JSON.parse(stored);
    let widgets = normalise(parsed);
    widgets = migrateLegacyIfNeeded(widgets);
    evaluateAllTodoResets(widgets);
    return widgets;
  } catch (err) {
    const fallback = normalise(null);
    const migrated = migrateLegacyIfNeeded(fallback);
    evaluateAllTodoResets(migrated);
    return migrated;
  }
}

export function saveWidgets(widgets) {
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

      if (widget.type === "notes") {
        row.notesState = mergeNotesState(widget.notesState);
      }
      if (widget.type === "todo") {
        row.todoState = mergeTodoState(widget.todoState);
      }
      return row;
    })
    .sort((a, b) => a.position - b.position);
  localStorage.setItem(WIDGETS_KEY, JSON.stringify(payload));
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
  const stored = localStorage.getItem(TITLE_KEY);
  if (!stored || !stored.trim()) return DEFAULT_SITE_TITLE;
  const migrated = migrateLegacySiteTitle(stored);
  if (migrated !== stored.trim()) {
    saveSiteTitle(migrated);
  }
  return migrated;
}

export function saveSiteTitle(value) {
  localStorage.setItem(TITLE_KEY, String(value || "").trim() || DEFAULT_SITE_TITLE);
}
