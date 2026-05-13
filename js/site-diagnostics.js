/**
 * Site-wide diagnostics: probe suite, ring-buffer log, console hooks.
 * Started once from `js/app.js` on dashboard init so Tools widgets stay warm before first visit.
 */

const LOG_CAP = 500;
const PROBE_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 5000;
const ALPINE_PROBE_URL = "https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js";
const SENTINEL_KEY = "launchpad_diag_sentinel";
const SENTINEL_KEY_LEGACY = "calvybots_diag_sentinel";
const SW_CONTROLLER_WAIT_MS = 2_500;

/** @typedef {{ ts: string, level: 'log'|'info'|'warn'|'error', source: string, message: string, detail?: string }} LogEntry */
/** @typedef {{ id: string, label: string, status: 'ok'|'warn'|'crit', detail: string, at: string }} ProbeResult */

const logListeners = new Set();
const probeListeners = new Set();

/** @type {LogEntry[]} */
let logLines = [];
/** @type {ProbeResult[]} */
let lastProbes = [];

/** Live widget document sync (GET / PUT) — merged after static probes for Status widget. */
let widgetSyncRetrieveState = {
  status: /** @type {'ok'|'warn'|'crit'} */ ("warn"),
  detail: "Waiting for initial server retrieve…",
  at: isoNow(),
};
let widgetSyncPushState = {
  status: /** @type {'ok'|'warn'|'crit'} */ ("ok"),
  detail: "Idle",
  at: isoNow(),
};
/** Last PUT error message until a successful PUT clears it. */
let lastWidgetPushFailure = /** @type {string | null} */ (null);

let started = false;
let hooksInstalled = false;
let probeIntervalId = null;
let consoleSilent = false;
/** @type {{ warn: typeof console.warn, error: typeof console.error } | null} */
let origConsole = null;
let swControllerPendingStateSeen = false;

function isoNow() {
  return new Date().toISOString();
}

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

function runStorageProbeWithFallback() {
  const keys = [SENTINEL_KEY, SENTINEL_KEY_LEGACY];
  for (const key of keys) {
    if (!key) continue;
    const written = writeStorageValue(key, "1");
    if (!written) continue;
    const readback = readStorageValue(key);
    if (readback !== "1") continue;
    if (!removeStorageValue(key)) continue;
    return { status: "ok", key };
  }
  return { status: "failed" };
}

function notifyLogs() {
  const snap = logLines.slice();
  logListeners.forEach((fn) => {
    try {
      fn(snap);
    } catch {
      /* ignore subscriber errors */
    }
  });
}

function buildWidgetSyncRetrieveRow() {
  return {
    id: "widgets-get",
    label: "Widgets GET (retrieve)",
    status: widgetSyncRetrieveState.status,
    detail: widgetSyncRetrieveState.detail,
    at: widgetSyncRetrieveState.at,
  };
}

function buildWidgetSyncPushRow() {
  return {
    id: "widgets-put",
    label: "Widgets PUT (push)",
    status: widgetSyncPushState.status,
    detail: widgetSyncPushState.detail,
    at: widgetSyncPushState.at,
  };
}

function getMergedProbeRows() {
  return [...lastProbes, buildWidgetSyncRetrieveRow(), buildWidgetSyncPushRow()];
}

function notifyProbes() {
  const snap = getMergedProbeRows();
  probeListeners.forEach((fn) => {
    try {
      fn(snap);
    } catch {
      /* ignore */
    }
  });
}

/**
 * @param {'log'|'info'|'warn'|'error'} level
 * @param {string} source
 * @param {string} message
 * @param {string} [detail]
 */
export function appendLog(level, source, message, detail) {
  const entry = { ts: isoNow(), level, source, message, detail };
  logLines.push(entry);
  if (logLines.length > LOG_CAP) logLines = logLines.slice(-LOG_CAP);
  notifyLogs();
}

function appendFromProbe(status, id, label, detail) {
  const level = status === "crit" ? "error" : "warn";
  const prefix = status === "crit" ? "[crit]" : "[warn]";
  appendLog(level, "probe", `${prefix} ${label}`, detail);
}

function fetchWithTimeout(url, init = {}) {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const next = { cache: "no-store", ...init, signal: ctrl.signal };
  return fetch(url, next).finally(() => window.clearTimeout(t));
}

/** @returns {Promise<ProbeResult>} */
async function probeDocument() {
  const at = isoNow();
  if (document.visibilityState === "hidden") {
    return {
      id: "tab",
      label: "Document visibility",
      status: "warn",
      detail: "Tab is in the background; some checks may be deferred.",
      at,
    };
  }
  return { id: "tab", label: "Document visibility", status: "ok", detail: "Visible", at };
}

/** @returns {Promise<ProbeResult>} */
async function waitForServiceWorkerControl(maxWaitMs = SW_CONTROLLER_WAIT_MS) {
  if (navigator.serviceWorker.controller) return true;

  let settled = false;
  let timerId = null;

  return new Promise((resolve) => {
    const done = (value) => {
      if (settled) return;
      settled = true;
      if (timerId != null) window.clearTimeout(timerId);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      resolve(value);
    };

    const onControllerChange = () => {
      done(Boolean(navigator.serviceWorker.controller));
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker.ready
      .then(() => {
        done(Boolean(navigator.serviceWorker.controller));
      })
      .catch(() => {
        done(false);
      });

    timerId = window.setTimeout(() => {
      done(false);
    }, maxWaitMs);
  });
}

/** @returns {Promise<ProbeResult>} */
async function probeServiceWorker() {
  const at = isoNow();
  if (!("serviceWorker" in navigator)) {
    return {
      id: "sw",
      label: "Service worker",
      status: "warn",
      detail: "Service workers are not supported in this context.",
      at,
    };
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      return {
        id: "sw",
        label: "Service worker",
        status: "warn",
        detail: "No registration yet (first load or SW disabled).",
        at,
      };
    }
    if (!navigator.serviceWorker.controller) {
      const becameController = await waitForServiceWorkerControl();
      if (becameController) {
        return { id: "sw", label: "Service worker", status: "ok", detail: "Control handoff complete", at };
      }
      if (!swControllerPendingStateSeen) {
        swControllerPendingStateSeen = true;
        return {
          id: "sw",
          label: "Service worker",
          status: "ok",
          detail: "Registered, control pending for this first load.",
          at,
        };
      }
      return {
        id: "sw",
        label: "Service worker",
        status: "warn",
        detail: "Registered but not controlling this page yet after startup grace.",
        at,
      };
    }
    return { id: "sw", label: "Service worker", status: "ok", detail: "Active and controlling", at };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { id: "sw", label: "Service worker", status: "crit", detail: msg, at };
  }
}

/** @returns {Promise<ProbeResult>} */
async function probeApiHealth() {
  const at = isoNow();
  if (!navigator.onLine) {
    return {
      id: "api",
      label: "API /api/health",
      status: "warn",
      detail: "Browser reports offline; skipped fetch.",
      at,
    };
  }
  try {
    const res = await fetchWithTimeout("/api/health", { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return {
        id: "api",
        label: "API /api/health",
        status: "crit",
        detail: `HTTP ${res.status}`,
        at,
      };
    }
    const data = await res.json();
    if (data && typeof data === "object" && data.status === "ok") {
      return { id: "api", label: "API /api/health", status: "ok", detail: "JSON status ok", at };
    }
    return {
      id: "api",
      label: "API /api/health",
      status: "crit",
      detail: "Unexpected JSON shape",
      at,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      id: "api",
      label: "API /api/health",
      status: "crit",
      detail: isAbort ? "Timed out" : msg,
      at,
    };
  }
}

/** @returns {Promise<ProbeResult>} */
async function probeSameOrigin() {
  const at = isoNow();
  if (!navigator.onLine) {
    return {
      id: "origin",
      label: "Same-origin shell",
      status: "warn",
      detail: "Offline; skipped fetch.",
      at,
    };
  }
  try {
    const res = await fetchWithTimeout("/", { method: "GET" });
    if (!res.ok) {
      return {
        id: "origin",
        label: "Same-origin shell",
        status: "crit",
        detail: `GET / returned HTTP ${res.status}`,
        at,
      };
    }
    return { id: "origin", label: "Same-origin shell", status: "ok", detail: "GET / succeeded", at };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      id: "origin",
      label: "Same-origin shell",
      status: "crit",
      detail: msg,
      at,
    };
  }
}

/** @returns {Promise<ProbeResult>} */
async function probeLocalStorage() {
  const at = isoNow();
  try {
    const probe = runStorageProbeWithFallback();
    if (probe.status !== "ok") {
      return {
        id: "storage",
        label: "localStorage",
        status: "crit",
        detail: probe.key
          ? `Storage probe failed to read/write key ${probe.key}`
          : "Read after write mismatch",
        at,
      };
    }
    return { id: "storage", label: "localStorage", status: "ok", detail: "Read/write OK", at };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { id: "storage", label: "localStorage", status: "crit", detail: msg, at };
  }
}

/** @returns {Promise<ProbeResult>} */
async function probeCdnAlpine() {
  const at = isoNow();
  if (!navigator.onLine) {
    return {
      id: "cdn",
      label: "CDN (Alpine script)",
      status: "warn",
      detail: "Offline; CDN not checked.",
      at,
    };
  }
  try {
    const res = await fetchWithTimeout(ALPINE_PROBE_URL, { method: "HEAD", mode: "cors" });
    if (!res.ok) {
      return {
        id: "cdn",
        label: "CDN (Alpine script)",
        status: "warn",
        detail: `HEAD returned HTTP ${res.status}`,
        at,
      };
    }
    return { id: "cdn", label: "CDN (Alpine script)", status: "ok", detail: "Reachable", at };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      id: "cdn",
      label: "CDN (Alpine script)",
      status: "warn",
      detail: msg,
      at,
    };
  }
}

export async function runProbes() {
  const runners = [
    probeDocument,
    probeServiceWorker,
    probeApiHealth,
    probeSameOrigin,
    probeLocalStorage,
    probeCdnAlpine,
  ];
  const out = [];
  for (const run of runners) {
    try {
      out.push(await run());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      out.push({
        id: "unknown",
        label: "Probe error",
        status: "crit",
        detail: msg,
        at: isoNow(),
      });
    }
  }
  lastProbes = out;
  notifyProbes();
  for (const p of out) {
    if (p.status === "warn" || p.status === "crit") {
      appendFromProbe(p.status, p.id, p.label, p.detail);
    }
  }
  return getMergedProbeRows();
}

/** @returns {() => void} */
export function subscribeLogs(listener) {
  logListeners.add(listener);
  try {
    listener(logLines.slice());
  } catch {
    /* ignore */
  }
  return () => logListeners.delete(listener);
}

/** @returns {() => void} */
export function subscribeProbes(listener) {
  probeListeners.add(listener);
  try {
    listener(getMergedProbeRows());
  } catch {
    /* ignore */
  }
  return () => probeListeners.delete(listener);
}

export function getLogLines() {
  return logLines.slice();
}

export function getProbeResults() {
  return getMergedProbeRows();
}

/**
 * Initial GET /api/widgets (one-shot reconcile on load).
 * @param {'attempt'|'offline'|'invalid'|'success'|'error'} phase
 * @param {string} [detail]
 */
export function reportWidgetSyncRetrieve(phase, detail = "") {
  const at = isoNow();
  switch (phase) {
    case "attempt":
      widgetSyncRetrieveState = {
        status: "warn",
        detail: "Fetching widget document from server…",
        at,
      };
      appendLog("info", "sync", "Widgets GET started", detail || "/api/widgets");
      break;
    case "offline":
      widgetSyncRetrieveState = {
        status: "warn",
        detail: "Skipped — browser offline",
        at,
      };
      appendLog("warn", "sync", "Widgets GET skipped — offline");
      break;
    case "success": {
      const d = detail && detail.trim() ? detail.trim() : "Server document applied";
      widgetSyncRetrieveState = { status: "ok", detail: d, at };
      appendLog("info", "sync", "Widgets GET completed", d);
      break;
    }
    case "invalid":
      widgetSyncRetrieveState = {
        status: "crit",
        detail: detail || "Response missing usable widgets[]",
        at,
      };
      break;
    case "error":
      widgetSyncRetrieveState = {
        status: "crit",
        detail: detail || "Request failed",
        at,
      };
      break;
    default:
      break;
  }
  notifyProbes();
}

/**
 * Push / queue state from Alpine dashboard (live).
 * @param {{ online?: boolean, _widgetsNeedSync?: boolean, _widgetsSyncInFlight?: boolean, _widgetsSyncTimer?: ReturnType<typeof setTimeout> | null }} dashboard
 */
export function reportWidgetSyncPushFromDashboard(dashboard) {
  const online = dashboard.online !== false;
  const needSync = Boolean(dashboard._widgetsNeedSync);
  const inFlight = Boolean(dashboard._widgetsSyncInFlight);
  const timerPending = Boolean(dashboard._widgetsSyncTimer);
  const at = isoNow();

  let status = /** @type {'ok'|'warn'|'crit'} */ ("ok");
  let detail = "Server copy matches local";

  if (!online && needSync) {
    status = "warn";
    detail = "Local changes waiting — cannot upload while offline";
  } else if (lastWidgetPushFailure && needSync && !inFlight) {
    status = "crit";
    detail = `Last upload failed: ${lastWidgetPushFailure}`;
  } else if (inFlight) {
    status = "warn";
    detail = "Uploading widget layout (PUT /api/widgets)…";
  } else if (needSync || timerPending) {
    status = "warn";
    detail = timerPending ? "Upload scheduled (debounced)" : "Local changes pending server upload";
  } else if (lastWidgetPushFailure) {
    status = "warn";
    detail = `Previously failed; idle now (${lastWidgetPushFailure})`;
  }

  widgetSyncPushState = { status, detail, at };
  notifyProbes();
}

/**
 * @param {'success'|'fail'|'beacon_queued'|'aborted'} phase
 * @param {string} [detail]
 * @param {object} [dashboard] passed to {@link reportWidgetSyncPushFromDashboard} when present
 */
export function reportWidgetSyncPushEvent(phase, detail = "", dashboard = null) {
  switch (phase) {
    case "success":
      lastWidgetPushFailure = null;
      appendLog("info", "sync", "Widgets PUT completed", detail);
      break;
    case "fail":
      lastWidgetPushFailure = detail || "Unknown error";
      break;
    case "beacon_queued":
      break;
    case "aborted":
      appendLog("info", "sync", "Widgets PUT aborted", detail);
      break;
    default:
      break;
  }
  if (dashboard && typeof dashboard === "object") {
    reportWidgetSyncPushFromDashboard(dashboard);
  }
}

function formatConsoleArgs(args) {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

function installConsoleHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  origConsole = {
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.warn = (...args) => {
    if (!consoleSilent) {
      try {
        consoleSilent = true;
        appendLog("warn", "console", formatConsoleArgs(args));
      } finally {
        consoleSilent = false;
      }
    }
    origConsole.warn(...args);
  };
  console.error = (...args) => {
    if (!consoleSilent) {
      try {
        consoleSilent = true;
        appendLog("error", "console", formatConsoleArgs(args));
      } finally {
        consoleSilent = false;
      }
    }
    origConsole.error(...args);
  };
}

function scheduleFirstProbe() {
  const kick = () => {
    void runProbes();
  };
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.setTimeout(kick, 400);
    });
  });
}

export function initSiteDiagnostics() {
  if (started) return;
  started = true;
  installConsoleHooks();
  appendLog("info", "site", "Diagnostics started", "");

  scheduleFirstProbe();
  if (probeIntervalId != null) window.clearInterval(probeIntervalId);
  probeIntervalId = window.setInterval(() => {
    void runProbes();
  }, PROBE_INTERVAL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void runProbes();
    }
  });
}

export function refreshProbes() {
  return runProbes();
}
