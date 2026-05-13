/**
 * CalvyBots Launchpad ? API sidecar
 *
 * Runs on port 3000 inside the Docker network; nginx proxies /api/* to this process.
 * No external dependencies ? plain Node.js http module only.
 *
 * Routes (see data/schema.md for response shapes):
 *   GET /api/health       ? liveness check
 *   GET /api/system       ? runtime diagnostics
 *   GET /api/config       ? serves ../data/config.json
 *   GET /api/widgets      ? returns persisted widget document
 *   PUT /api/widgets      ? validates + persists widget document atomically
 *   POST /api/widgets      ? same as PUT (navigator.sendBeacon can only POST; used as unload fallback)
 *   *                    ? 404 JSON
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const CONFIG_PATH = path.resolve(__dirname, '..', 'data', 'config.json');
const WIDGETS_PATH = path.resolve(__dirname, '..', 'data', 'widgets.json');
const fsp = fs.promises;

console.log('[api] WIDGETS_PATH resolved to:', WIDGETS_PATH);
const startTime = Date.now();

const WIDGETS_SCHEMA_VERSION = 2;
const DEFAULT_MIN_WIDTH = 250;
const DEFAULT_MIN_HEIGHT = 178;
const MAX_WIDGET_PAYLOAD_BYTES = 2 * 1024 * 1024;

let writeQueue = Promise.resolve();

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

  const requestedSchemaVersion = Number.isInteger(payload.schemaVersion)
    ? payload.schemaVersion
    : WIDGETS_SCHEMA_VERSION;
  const schemaVersion = Math.max(requestedSchemaVersion, WIDGETS_SCHEMA_VERSION);

  return {
    ok: true,
    value: {
      schemaVersion,
      updatedAt: new Date().toISOString(),
      widgets: widgetsResult.value,
      toolsWidgets: toolsWidgetsResult.value,
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

async function readWidgetsFromDisk() {
  try {
    const raw = await fsp.readFile(WIDGETS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeStoredDocument(parsed);
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      return buildDefaultWidgetDocument();
    }
    throw error;
  }
}

async function writeWidgetsAtomic(document) {
  const tmpPath = `${WIDGETS_PATH}.${process.pid}.${Date.now()}.tmp`;
  const payload = JSON.stringify(document);
  try {
    await fsp.writeFile(tmpPath, payload, 'utf8');
    await fsp.rename(tmpPath, WIDGETS_PATH);
    console.log('[api] writeWidgetsAtomic OK, wrote', WIDGETS_PATH);
  } catch (error) {
    console.error('[api] writeWidgetsAtomic FAILED:', error);
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
    console.log('[api] GET /api/widgets → updatedAt:', doc.updatedAt);
    sendJson(res, 200, doc);
  } catch (error) {
    console.error('[api] Failed to read widgets:', error);
    sendJson(res, 500, {
      error: 'Failed to read widgets',
      detail: error.message,
    });
  }
}

async function handlePutWidgets(req, res) {
  try {
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

    const normalized = parseAndNormalizeWidgetsPayload(parsed);
    if (!normalized.ok) {
      sendJson(res, normalized.status, {
        error: normalized.error,
        detail: normalized.detail,
      });
      return;
    }

    console.log('[api] PUT /api/widgets → persisting, payload updatedAt:', normalized.value.updatedAt);
    await queueWidgetPersist(normalized.value);
    sendJson(res, 200, normalized.value);
  } catch (error) {
    const status = error && Number.isInteger(error.status) ? error.status : 500;
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
  console.log(`[api] CalvyBots API listening on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('[api] Server error:', err);
  process.exit(1);
});
