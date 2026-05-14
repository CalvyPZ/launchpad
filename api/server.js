/**
 * CalvyBots Launchpad ? API sidecar
 *
 * Runs on port 3000 inside the Docker network; nginx proxies /api/* to this process.
 * No external dependencies ? plain Node.js http module only.
 *
 * Routes (see data/schema.md for response shapes):
 *   GET /api/health          ? liveness check
 *   GET /api/system          ? runtime diagnostics
 *   GET /api/config          ? serves ../data/config.json
 *   GET /api/widgets         ? full widget document + `revision` (SHA-256 of canonical payload; not stored on disk)
 *   POST /api/widgets/ack    ? first-open gate: body `{ "revision": "<from GET>" }` must match current document;
 *                              on success sets in-process write allowance (single-user LAN; resets on API restart)
 *   PUT /api/widgets         ? requires prior successful ack for this process; body must include `expectRevision`
 *                              matching current revision or 409 STALE_REVISION; semantic no-op skips disk write
 *   POST /api/widgets        ? same as PUT (sendBeacon / unload); must include `expectRevision`
 *                              in JSON body (canonical), `If-Match` header, or
 *                              `X-Calvybots-Widgets-Revision` header (compatibility alias)
 *   *                        ? 404 JSON
 *
 * Contract summary (coordination with frontend):
 * - `revision` / `expectRevision`: opaque hex string from GET; resend on PUT until server accepts or returns 409.
 *   Server accepts canonical write tokens in JSON body `expectRevision` or `If-Match` header.
 *   `X-Calvybots-Widgets-Revision` remains supported as a compatibility alias only.
 * - `428` + `{ code: "ACK_REQUIRED" }`: no PUT until POST /api/widgets/ack succeeds for the loaded snapshot.
 * - `200` + `{ skipped: true }`: normalized payload equals current stored content ? no `widgets.json` rewrite.
 * - Destructive import uses same PUT path with full document + `expectRevision` from GET immediately before import.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const CONFIG_PATH = path.resolve(__dirname, '..', 'data', 'config.json');
const WIDGETS_PATH = path.resolve(__dirname, '..', 'data', 'widgets.json');
const WIDGETS_DIR = path.dirname(WIDGETS_PATH);
const fsp = fs.promises;
const startTime = Date.now();

const WIDGETS_SCHEMA_VERSION = 2;
const DEFAULT_MIN_WIDTH = 250;
const DEFAULT_MIN_HEIGHT = 178;
const MAX_WIDGET_PAYLOAD_BYTES = 2 * 1024 * 1024;

let writeQueue = Promise.resolve();

/**
 * First-open / bootstrap write gate (in-memory, single API process).
 * PUT/POST /api/widgets are rejected with 428 ACK_REQUIRED until a client
 * successfully POSTs /api/widgets/ack with the same `revision` as GET /api/widgets.
 * Resets on API restart (clients must GET + ack again).
 */
let bootstrapWriteUnlocked = false;

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function computeDocumentRevision(doc) {
  const basis = {
    schemaVersion: doc.schemaVersion,
    updatedAt: doc.updatedAt,
    widgets: doc.widgets,
    toolsWidgets: doc.toolsWidgets,
    toolsLandingWidgets: doc.toolsLandingWidgets,
  };
  return crypto.createHash('sha256').update(stableStringify(basis), 'utf8').digest('hex');
}

/** Semantic equality of persisted widget surfaces (excludes updatedAt for no-op detection). */
function computeContentFingerprint(doc) {
  const basis = {
    schemaVersion: doc.schemaVersion,
    widgets: doc.widgets,
    toolsWidgets: doc.toolsWidgets,
    toolsLandingWidgets: doc.toolsLandingWidgets,
  };
  return crypto.createHash('sha256').update(stableStringify(basis), 'utf8').digest('hex');
}

function contentTypeIsApplicationJson(req) {
  const raw = req.headers['content-type'];
  if (!raw || typeof raw !== 'string') return false;
  const primary = raw.split(';')[0].trim().toLowerCase();
  return primary === 'application/json';
}

function isPlausibleIsoTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const t = Date.parse(value.trim());
  return Number.isFinite(t);
}

/** Strip API-only fields so they are never persisted into widgets.json */
function stripClientMetaFromPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  const copy = { ...payload };
  delete copy.expectRevision;
  delete copy.revision;
  delete copy.skipped;
  delete copy.acknowledged;
  delete copy.ok;
  return copy;
}

function uptime() {
  return Math.floor((Date.now() - startTime) / 1000);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function buildDefaultNotesState() {
  return { markdown: '', viewMode: 'split' };
}

function buildDefaultTodoState() {
  return {
    tasks: [],
    recurrence: 'never',
    timeLocal: '09:00',
    weekday: 1,
    lastResetAt: null,
  };
}

function buildDefaultWidgetRows() {
  return [
    {
      id: 'widget-clock',
      type: 'clock',
      position: 0,
      visible: true,
      title: 'Clock',
      minWidth: DEFAULT_MIN_WIDTH,
      minHeight: DEFAULT_MIN_HEIGHT,
      width: null,
      height: null,
    },
    {
      id: 'widget-notes',
      type: 'notes',
      position: 1,
      visible: true,
      title: 'Notes',
      minWidth: DEFAULT_MIN_WIDTH,
      minHeight: DEFAULT_MIN_HEIGHT,
      width: null,
      height: null,
      notesState: buildDefaultNotesState(),
    },
    {
      id: 'widget-todo',
      type: 'todo',
      position: 2,
      visible: true,
      title: 'To-Do',
      minWidth: DEFAULT_MIN_WIDTH,
      minHeight: DEFAULT_MIN_HEIGHT,
      width: null,
      height: null,
      todoState: buildDefaultTodoState(),
    },
  ];
}

function buildDefaultWidgetDocument() {
  return {
    schemaVersion: WIDGETS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    widgets: buildDefaultWidgetRows(),
    toolsWidgets: [],
    toolsLandingWidgets: [],
  };
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeNotesState(raw) {
  const base = buildDefaultNotesState();
  if (!raw || typeof raw !== 'object') return base;

  return {
    ...base,
    markdown: typeof raw.markdown === 'string' ? raw.markdown : base.markdown,
    viewMode: raw.viewMode === 'edit' || raw.viewMode === 'preview' || raw.viewMode === 'split'
      ? raw.viewMode
      : base.viewMode,
  };
}

function normalizeTodoState(raw) {
  const base = buildDefaultTodoState();
  if (!raw || typeof raw !== 'object') return base;

  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks
        .map((task, index) => ({
          id: String(task?.id || `task-${index}`),
          text: typeof task?.text === 'string' ? task.text : '',
          done: Boolean(task?.done),
          color: typeof task?.color === 'string' ? task.color : null,
        }))
        .filter((task) => task.text.length || task.id)
    : base.tasks;

  return {
    ...base,
    tasks: tasks.length ? tasks : base.tasks,
    recurrence: raw.recurrence === 'daily' || raw.recurrence === 'weekly' ? raw.recurrence : base.recurrence,
    timeLocal: typeof raw.timeLocal === 'string' ? raw.timeLocal : base.timeLocal,
    weekday: normalizeNumber(raw.weekday, base.weekday),
    lastResetAt: raw.lastResetAt == null ? null : String(raw.lastResetAt),
  };
}

function todayDateInputString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function buildDefaultFortnightState() {
  const today = todayDateInputString();
  return {
    fnStartDate: today,
    lineAtStart: 1,
    rotateFrom: 1,
    rotateTo: 12,
    targetDate: today,
  };
}

function normalizeFortnightDate(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return fallback;
  const parsed = new Date(`${trimmed}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : trimmed;
}

function normalizeFortnightInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Mirrors `mergeFortnightState` in `js/store.js` so server-side validation matches
 * the frontend contract for Tools landing fortnight rows. Whitelisted fields only.
 */
function normalizeFortnightState(raw) {
  const base = buildDefaultFortnightState();
  if (!raw || typeof raw !== 'object') return base;

  const rotateFromRaw = normalizeFortnightInt(raw.rotateFrom, base.rotateFrom);
  const rotateToRaw = normalizeFortnightInt(raw.rotateTo, base.rotateTo);
  const rotateFrom = rotateFromRaw > rotateToRaw ? rotateToRaw : rotateFromRaw;
  const rotateTo = rotateFromRaw > rotateToRaw ? rotateFromRaw : rotateToRaw;

  const fnStartDate = normalizeFortnightDate(raw.fnStartDate, base.fnStartDate);
  const targetDate = normalizeFortnightDate(raw.targetDate, fnStartDate);

  const lineAtStartRaw = normalizeFortnightInt(raw.lineAtStart, base.lineAtStart);
  const lineAtStart = lineAtStartRaw < rotateFrom
    ? rotateFrom
    : lineAtStartRaw > rotateTo
    ? rotateTo
    : lineAtStartRaw;

  return {
    fnStartDate,
    lineAtStart,
    rotateFrom,
    rotateTo,
    targetDate,
  };
}

function parseAndNormalizeRow(rawRow, index) {
  if (!rawRow || typeof rawRow !== 'object') {
    return {
      ok: false,
      status: 400,
      error: 'Invalid widget row',
      detail: `Widget row at index ${index} must be an object`,
    };
  }

  const id = typeof rawRow.id === 'string' ? rawRow.id.trim() : '';
  if (!id) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid widget row',
      detail: `Widget row at index ${index} must include a non-empty string id`,
    };
  }

  const type = typeof rawRow.type === 'string' ? rawRow.type.trim() : '';
  if (!type) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid widget row',
      detail: `Widget row at index ${index} must include a non-empty string type`,
    };
  }

  const rawPosition = Number(rawRow.position);
  if (!Number.isFinite(rawPosition) || !Number.isInteger(rawPosition) || rawPosition < 0) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid widget row',
      detail: `Widget row id="${id}" must include a non-negative integer position`,
    };
  }

  const row = {
    id,
    type,
    position: rawPosition,
    visible: rawRow.visible === false ? false : true,
    title: typeof rawRow.title === 'string' ? rawRow.title : '',
    minWidth: normalizeNumber(rawRow.minWidth, DEFAULT_MIN_WIDTH),
    minHeight: normalizeNumber(rawRow.minHeight, DEFAULT_MIN_HEIGHT),
    width: rawRow.width == null || rawRow.width === '' ? null : normalizeNumber(rawRow.width, null),
    height: rawRow.height == null || rawRow.height === '' ? null : normalizeNumber(rawRow.height, null),
  };

  if (Object.is(row.width, NaN)) {
    row.width = null;
  }

  if (Object.is(row.height, NaN)) {
    row.height = null;
  }

  if (type === 'notes') {
    row.notesState = normalizeNotesState(rawRow.notesState);
  }

  if (type === 'todo') {
    row.todoState = normalizeTodoState(rawRow.todoState);
  }

  if (type === 'fortnight') {
    row.fortnightState = normalizeFortnightState(rawRow.fortnightState);
  }

  return { ok: true, value: row };
}

function parseWidgetRowsPayload(payload, key, options = {}) {
  const required = options.required === true;
  const rows = payload[key];

  if (rows === undefined || rows === null) {
    if (required) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid payload',
        detail: `Payload must include a ${key} array`,
      };
    }
    return { ok: true, value: [] };
  }

  if (!Array.isArray(rows)) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid payload',
      detail: `Payload ${key} must be an array`,
    };
  }

  const normalizedRows = [];
  for (let index = 0; index < rows.length; index += 1) {
    const result = parseAndNormalizeRow(rows[index], index);
    if (!result.ok) {
      return result;
    }
    normalizedRows.push(result.value);
  }

  return { ok: true, value: normalizedRows };
}

async function ensureWidgetsStorageAccessible() {
  console.log('[api] Checking widgets storage path:', WIDGETS_DIR);
  try {
    await fsp.mkdir(WIDGETS_DIR, { recursive: true });
    const dirStats = await fsp.stat(WIDGETS_DIR);
    await fsp.access(WIDGETS_DIR, fs.constants.W_OK);
    console.log('[api] Widgets directory writable:', {
      path: WIDGETS_DIR,
      mode: `0${dirStats.mode.toString(8)}`,
      uid: dirStats.uid,
      gid: dirStats.gid,
    });
  } catch (error) {
    console.error('[api] Widgets directory check failed:', {
      path: WIDGETS_DIR,
      code: error.code,
      message: error.message,
    });
  }

  try {
    const fileStats = await fsp.stat(WIDGETS_PATH);
    console.log('[api] Existing widgets.json detected:', {
      path: WIDGETS_PATH,
      size: fileStats.size,
      mode: `0${fileStats.mode.toString(8)}`,
      uid: fileStats.uid,
      gid: fileStats.gid,
    });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[api] widgets.json stat failed:', {
        path: WIDGETS_PATH,
        code: error.code,
        message: error.message,
      });
    }
  }
}

function parseAndNormalizeWidgetsPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      ok: false,
      status: 400,
      error: 'Invalid payload',
      detail: 'Payload must be a JSON object',
    };
  }

  const widgetsResult = parseWidgetRowsPayload(payload, 'widgets', { required: true });
  if (!widgetsResult.ok) {
    return widgetsResult;
  }

  const toolsWidgetsResult = parseWidgetRowsPayload(payload, 'toolsWidgets', { required: false });
  if (!toolsWidgetsResult.ok) {
    return toolsWidgetsResult;
  }

  const toolsLandingWidgetsResult = parseWidgetRowsPayload(payload, 'toolsLandingWidgets', { required: false });
  if (!toolsLandingWidgetsResult.ok) {
    return toolsLandingWidgetsResult;
  }

  const requestedSchemaVersion = Number.isInteger(payload.schemaVersion)
    ? payload.schemaVersion
    : WIDGETS_SCHEMA_VERSION;
  const schemaVersion = Math.max(requestedSchemaVersion, WIDGETS_SCHEMA_VERSION);

  const updatedAt =
    isPlausibleIsoTimestamp(payload.updatedAt)
      ? String(payload.updatedAt).trim()
      : new Date().toISOString();

  return {
    ok: true,
    value: {
      schemaVersion,
      updatedAt,
      widgets: widgetsResult.value,
      toolsWidgets: toolsWidgetsResult.value,
      toolsLandingWidgets: toolsLandingWidgetsResult.value,
    },
  };
}

function normalizeStoredDocument(payload) {
  const result = parseAndNormalizeWidgetsPayload(payload);
  if (!result.ok) {
    return buildDefaultWidgetDocument();
  }

  return {
    ...result.value,
    updatedAt: typeof payload.updatedAt === 'string' && payload.updatedAt.trim() ? payload.updatedAt.trim() : result.value.updatedAt,
  };
}

/** Stable in-memory default when widgets.json is missing or invalid (until first successful persist). */
let missingFileDefaultSnapshot = null;

function getOrCreateMissingFileDefaultDocument() {
  if (!missingFileDefaultSnapshot) {
    missingFileDefaultSnapshot = buildDefaultWidgetDocument();
  }
  return JSON.parse(JSON.stringify(missingFileDefaultSnapshot));
}

async function readWidgetsFromDisk() {
  try {
    const raw = await fsp.readFile(WIDGETS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeStoredDocument(parsed);
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      return getOrCreateMissingFileDefaultDocument();
    }
    throw error;
  }
}

async function writeWidgetsAtomic(document) {
  const tmpPath = `${WIDGETS_PATH}.${process.pid}.${Date.now()}.tmp`;
  const payload = JSON.stringify(document);
  try {
    await fsp.mkdir(WIDGETS_DIR, { recursive: true });
    await fsp.writeFile(tmpPath, payload, 'utf8');
    await fsp.rename(tmpPath, WIDGETS_PATH);
    console.log('[api] writeWidgetsAtomic OK', {
      path: WIDGETS_PATH,
      tmpPath,
      bytes: Buffer.byteLength(payload),
    });
  } catch (error) {
    console.error('[api] writeWidgetsAtomic FAILED', {
      path: WIDGETS_PATH,
      tmpPath,
      bytes: Buffer.byteLength(payload),
      code: error.code,
      errno: error.errno,
      message: error.message,
    });
    throw error;
  } finally {
    await fsp.unlink(tmpPath).catch(() => undefined);
  }
}

function queueWidgetPersist(document) {
  // Serialize disk writes so concurrent writes are applied one-at-a-time.
  const run = () => writeWidgetsAtomic(document);
  const next = writeQueue.then(run, run);
  writeQueue = next.catch(() => undefined);
  return next;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_WIDGET_PAYLOAD_BYTES) {
        reject({
          status: 413,
          error: 'Payload too large',
          detail: `Payload exceeded limit of ${MAX_WIDGET_PAYLOAD_BYTES} bytes`,
        });
      }
    });

    req.on('end', () => resolve(body));
    req.on('error', (error) => {
      reject({
        status: 500,
        error: 'Request body error',
        detail: error.message,
      });
    });
  });
}

function handleHealth(res) {
  sendJson(res, 200, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: uptime(),
  });
}

function handleSystem(res) {
  const mem = process.memoryUsage();
  sendJson(res, 200, {
    timestamp: new Date().toISOString(),
    uptime: uptime(),
    node: process.version,
    memory: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
    },
  });
}

function handleConfig(res) {
  fs.readFile(CONFIG_PATH, 'utf8', (err, data) => {
    if (err) {
      sendJson(res, 500, { error: 'Failed to read config', detail: err.message });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(data);
    } catch (parseErr) {
      sendJson(res, 500, { error: 'Failed to read config', detail: parseErr.message });
      return;
    }

    sendJson(res, 200, parsed);
  });
}

async function handleGetWidgets(res) {
  try {
    const doc = await readWidgetsFromDisk();
    const revision = computeDocumentRevision(doc);
    sendJson(res, 200, { ...doc, revision });
  } catch (error) {
    console.error('[api] Failed to read widgets:', error);
    sendJson(res, 500, {
      error: 'Failed to read widgets',
      detail: error.message,
    });
  }
}

const WRITE_REVISION_TOKEN_SOURCES = [
  'body.expectRevision',
  'header.If-Match',
  'header.X-Calvybots-Widgets-Revision (compatibility alias)',
];

function readExpectRevisionFromRequest(req, parsed) {
  if (parsed && typeof parsed.expectRevision === 'string' && parsed.expectRevision.trim()) {
    return {
      value: parsed.expectRevision.trim(),
      source: 'body.expectRevision',
    };
  }

  const im = req.headers['if-match'];
  if (im && typeof im === 'string') {
    const v = im.trim().replace(/^W\//i, '').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    if (v) {
      return {
        value: v,
        source: 'header.If-Match',
      };
    }
  }

  const customRevisionHeader =
    req.headers['x-calvybots-widgets-revision'] || req.headers['X-Calvybots-Widgets-Revision'];
  if (customRevisionHeader && typeof customRevisionHeader === 'string' && customRevisionHeader.trim()) {
    return {
      value: customRevisionHeader.trim(),
      source: 'header.X-Calvybots-Widgets-Revision',
    };
  }

  return {
    value: null,
    source: null,
  };
}

async function handlePostWidgetsAck(req, res) {
  try {
    if (!contentTypeIsApplicationJson(req)) {
      sendJson(res, 415, {
        error: 'Unsupported Media Type',
        detail: 'Content-Type must be application/json',
        code: 'JSON_REQUIRED',
      });
      return;
    }

    const body = await readRequestBody(req);

    if (!body.trim()) {
      sendJson(res, 400, {
        error: 'Invalid payload',
        detail: 'Request body is required',
        code: 'EMPTY_BODY',
      });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (parseErr) {
      sendJson(res, 400, {
        error: 'Invalid payload',
        detail: parseErr.message,
      });
      return;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      sendJson(res, 400, {
        error: 'Invalid payload',
        detail: 'Body must be a JSON object',
      });
      return;
    }

    if (typeof parsed.revision !== 'string' || !parsed.revision.trim()) {
      sendJson(res, 400, {
        error: 'Invalid payload',
        detail: 'Body must include a non-empty string revision (use GET /api/widgets revision field)',
        code: 'REVISION_REQUIRED',
      });
      return;
    }

    const doc = await readWidgetsFromDisk();
    const currentRevision = computeDocumentRevision(doc);
    const clientRev = parsed.revision.trim();

    if (clientRev !== currentRevision) {
      console.warn('[api] POST /api/widgets/ack rejected (revision mismatch)', {
        clientPrefix: clientRev.slice(0, 12),
        currentPrefix: currentRevision.slice(0, 12),
      });
      sendJson(res, 409, {
        error: 'Revision mismatch',
        detail: 'Provided revision does not match the current server document; re-fetch GET /api/widgets',
        code: 'ACK_REVISION_MISMATCH',
        currentRevision,
      });
      return;
    }

    bootstrapWriteUnlocked = true;
    console.log('[api] POST /api/widgets/ack OK', { revision: `${currentRevision.slice(0, 12)}…` });
    sendJson(res, 200, {
      ok: true,
      acknowledged: true,
      revision: currentRevision,
    });
  } catch (error) {
    const status = error && Number.isInteger(error.status) ? error.status : 500;
    console.error('[api] POST /api/widgets/ack FAILED', {
      status,
      message: error && error.message,
      detail: error && error.detail,
    });
    sendJson(res, status, {
      error: error && error.error ? error.error : 'Request failed',
      detail: error && error.detail ? error.detail : error.message,
    });
  }
}

async function handlePutWidgets(req, res) {
  try {
    if (!contentTypeIsApplicationJson(req)) {
      sendJson(res, 415, {
        error: 'Unsupported Media Type',
        detail: 'Content-Type must be application/json',
        code: 'JSON_REQUIRED',
      });
      return;
    }

    if (!bootstrapWriteUnlocked) {
      console.warn('[api] PUT /api/widgets rejected (bootstrap ack not completed)');
      sendJson(res, 428, {
        error: 'Acknowledgement required',
        detail: 'Apply GET /api/widgets payload locally, then POST /api/widgets/ack with { revision } before writing',
        code: 'ACK_REQUIRED',
      });
      return;
    }

    const body = await readRequestBody(req);

    if (!body.trim()) {
      sendJson(res, 400, {
        error: 'Invalid payload',
        detail: 'Request body is required',
      });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (parseErr) {
      sendJson(res, 400, {
        error: 'Invalid payload',
        detail: parseErr.message,
      });
      return;
    }

    const expectRevisionInput = readExpectRevisionFromRequest(req, parsed);
    if (!expectRevisionInput.value) {
      sendJson(res, 400, {
        error: 'Invalid payload',
        detail: 'expectRevision is required for writes; provide it in body.expectRevision, If-Match header, or X-Calvybots-Widgets-Revision compatibility header',
        code: 'EXPECT_REVISION_REQUIRED',
        acceptedRevisionSources: WRITE_REVISION_TOKEN_SOURCES,
      });
      return;
    }

    const expectRevision = expectRevisionInput.value;

    const diskDoc = await readWidgetsFromDisk();
    const currentRevision = computeDocumentRevision(diskDoc);

    if (expectRevision !== currentRevision) {
      console.warn('[api] PUT /api/widgets rejected (stale expectRevision)', {
        expectPrefix: expectRevision.slice(0, 12),
        currentPrefix: currentRevision.slice(0, 12),
      });
      sendJson(res, 409, {
        error: 'Stale revision',
        detail: 'expectRevision does not match the current server document; re-fetch GET /api/widgets',
        code: 'STALE_REVISION',
        expectRevisionSource: expectRevisionInput.source,
        expectRevision: expectRevision,
        currentRevision,
      });
      return;
    }

    const payloadForNormalize = stripClientMetaFromPayload(parsed);
    const normalized = parseAndNormalizeWidgetsPayload(payloadForNormalize);
    if (!normalized.ok) {
      sendJson(res, normalized.status, {
        error: normalized.error,
        detail: normalized.detail,
      });
      return;
    }

    const incomingFp = computeContentFingerprint(normalized.value);
    const diskFp = computeContentFingerprint(diskDoc);

    if (incomingFp === diskFp) {
      console.log('[api] PUT /api/widgets skipped (no-op; semantic content unchanged)', {
        schemaVersion: diskDoc.schemaVersion,
        widgetsCount: diskDoc.widgets.length,
        toolsWidgetsCount: diskDoc.toolsWidgets.length,
        toolsLandingWidgetsCount: diskDoc.toolsLandingWidgets.length,
        revision: `${currentRevision.slice(0, 12)}…`,
        bodyBytes: body.length,
      });
      sendJson(res, 200, {
        ...diskDoc,
        revision: currentRevision,
        skipped: true,
      });
      return;
    }

    console.log('[api] PUT /api/widgets ? payload accepted', {
      schemaVersion: normalized.value.schemaVersion,
      widgetsCount: normalized.value.widgets.length,
      toolsWidgetsCount: normalized.value.toolsWidgets.length,
      toolsLandingWidgetsCount: normalized.value.toolsLandingWidgets.length,
      updatedAt: normalized.value.updatedAt,
      path: WIDGETS_PATH,
      bodyBytes: body.length,
    });
    await queueWidgetPersist(normalized.value);
    const newRevision = computeDocumentRevision(normalized.value);
    sendJson(res, 200, {
      ...normalized.value,
      revision: newRevision,
      skipped: false,
    });
  } catch (error) {
    const status = error && Number.isInteger(error.status) ? error.status : 500;
    console.error('[api] PUT /api/widgets FAILED', {
      path: WIDGETS_PATH,
      status,
      code: error && error.code,
      errno: error && error.errno,
      message: error && error.message,
      detail: error && error.detail,
    });
    sendJson(res, status, {
      error: error && error.error ? error.error : 'Request failed',
      detail: error && error.detail ? error.detail : error.message,
    });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  switch (pathname) {
    case '/api/health':
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed', detail: 'Use GET /api/health' });
        return;
      }
      handleHealth(res);
      break;

    case '/api/system':
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed', detail: 'Use GET /api/system' });
        return;
      }
      handleSystem(res);
      break;

    case '/api/config':
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed', detail: 'Use GET /api/config' });
        return;
      }
      handleConfig(res);
      break;

    case '/api/widgets/ack':
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed', detail: 'Use POST /api/widgets/ack' });
        return;
      }
      void handlePostWidgetsAck(req, res);
      break;

    case '/api/widgets':
      if (req.method === 'GET') {
        void handleGetWidgets(res);
        return;
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        void handlePutWidgets(req, res);
        return;
      }
      sendJson(res, 405, {
        error: 'Method not allowed',
        detail: 'Use GET, PUT, or POST /api/widgets',
      });
      break;

    default:
      sendJson(res, 404, {
        error: 'Not found',
        detail: pathname.startsWith('/api/') ? `Route ${pathname} is not defined` : `${pathname} is not a static API path`,
      });
      break;
  }
});

server.listen(PORT, () => {
  console.log(`[api] Launchpad API listening on port ${PORT}`);
});

void ensureWidgetsStorageAccessible();

server.on('error', (err) => {
  console.error('[api] Server error:', err);
  process.exit(1);
});
