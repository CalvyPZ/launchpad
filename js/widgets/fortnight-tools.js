function toDateInputString(date = new Date()) {
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) return "";
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}`;
}

function normalizeFortnightDate(value, fallbackDate) {
  if (typeof value !== "string") return fallbackDate;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return fallbackDate;
  const parsed = new Date(`${trimmed}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallbackDate : trimmed;
}

function normalizeInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Hydrate display from persisted row or defaults; used only at mount (store already merges malformed saves). */
function normalizeFortnightState(rawState = {}, fallbackDate = "") {
  const startFallback = normalizeFortnightDate(rawState.fnStartDate, fallbackDate || toDateInputString());
  let rotateFrom = normalizeInt(rawState.rotateFrom, 1);
  let rotateTo = normalizeInt(rawState.rotateTo, 12);
  if (!Number.isFinite(rotateFrom)) rotateFrom = 1;
  if (!Number.isFinite(rotateTo)) rotateTo = 12;
  if (rotateFrom > rotateTo) {
    const swap = rotateFrom;
    rotateFrom = rotateTo;
    rotateTo = swap;
  }

  const lineFallback = normalizeInt(rawState.lineAtStart, rotateFrom);
  const safeLine = Number.isFinite(lineFallback) ? lineFallback : rotateFrom;
  const lineAtStart = Math.min(Math.max(safeLine, rotateFrom), rotateTo);

  return {
    fnStartDate: startFallback,
    lineAtStart,
    rotateFrom,
    rotateTo,
    targetDate: normalizeFortnightDate(rawState.targetDate, startFallback),
  };
}

function parseDateFromInput(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatResultDate(value) {
  const date = parseDateFromInput(value);
  if (!date) return value || "";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function calculateLine(state) {
  const startDate = parseDateFromInput(state.fnStartDate);
  const targetDate = parseDateFromInput(state.targetDate);
  if (!startDate || !targetDate) return state.lineAtStart;
  if (targetDate < startDate) return state.lineAtStart;

  // First Sunday on or after startDate
  const anchor = new Date(startDate);
  while (anchor.getDay() !== 0) {
    anchor.setDate(anchor.getDate() + 1);
  }
  if (anchor > targetDate) return state.lineAtStart;

  // Count Sundays from anchor to targetDate (step by 7 days)
  let sundayCount = 0;
  const cursor = new Date(anchor);
  while (cursor <= targetDate) {
    sundayCount += 1;
    cursor.setDate(cursor.getDate() + 7);
  }

  const stepCount = Math.floor(sundayCount / 2);
  const cycleLength = Math.max(1, state.rotateTo - state.rotateFrom + 1);
  const relativeStart = state.lineAtStart - state.rotateFrom;
  const nextLine = ((relativeStart + stepCount) % cycleLength + cycleLength) % cycleLength;
  return state.rotateFrom + nextLine;
}

function updateValue(input, value) {
  if (input && input.value !== value) input.value = value;
}

function parseStrictPositiveInt(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  if (!/^[1-9]\d*$/.test(s)) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate raw form values (Calculate only). No swap; rotateFrom must be <= rotateTo.
 * @returns {{ ok: true, state: object } | { ok: false, message: string }}
 */
function validateFortnightInputs(raw) {
  const fnRaw = raw.fnStartDate;
  const targetRaw = raw.targetDate;
  if (typeof fnRaw !== "string" || !fnRaw.trim()) {
    return { ok: false, message: "Enter a valid FN start date." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fnRaw.trim())) {
    return { ok: false, message: "FN start date must be a complete calendar date." };
  }
  if (!parseDateFromInput(fnRaw)) {
    return { ok: false, message: "FN start date is not a valid date." };
  }

  if (typeof targetRaw !== "string" || !targetRaw.trim()) {
    return { ok: false, message: "Enter a valid target date." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetRaw.trim())) {
    return { ok: false, message: "Target date must be a complete calendar date." };
  }
  if (!parseDateFromInput(targetRaw)) {
    return { ok: false, message: "Target date is not a valid date." };
  }

  const rotateFrom = parseStrictPositiveInt(raw.rotateFrom);
  const rotateTo = parseStrictPositiveInt(raw.rotateTo);
  const lineAtStart = parseStrictPositiveInt(raw.lineAtStart);

  if (rotateFrom == null) {
    return { ok: false, message: "Enter a whole number for rotate from (line numbers only)." };
  }
  if (rotateTo == null) {
    return { ok: false, message: "Enter a whole number for rotate to (line numbers only)." };
  }
  if (lineAtStart == null) {
    return { ok: false, message: "Enter a whole number for line at FN start (line numbers only)." };
  }

  if (rotateFrom > rotateTo) {
    return {
      ok: false,
      message: "Rotate from must be less than or equal to rotate to.",
    };
  }

  if (lineAtStart < rotateFrom || lineAtStart > rotateTo) {
    return {
      ok: false,
      message: `Line at FN start must be between ${rotateFrom} and ${rotateTo} (inclusive).`,
    };
  }

  const fnStartDate = fnRaw.trim();
  const targetDate = targetRaw.trim();

  return {
    ok: true,
    state: {
      fnStartDate,
      lineAtStart,
      rotateFrom,
      rotateTo,
      targetDate,
    },
  };
}

function applyResultSuccess(resultEl, state) {
  const line = calculateLine(state);
  const dateLabel = formatResultDate(state.targetDate);
  resultEl.textContent = `On ${dateLabel} you will be on line ${line}`;
  resultEl.className =
    "mt-2 rounded-lg border border-slate-700 bg-slate-900/55 p-2 text-sm text-cyan-100";
  resultEl.setAttribute("role", "status");
}

function applyResultError(resultEl, message) {
  resultEl.textContent = message;
  resultEl.className =
    "mt-2 rounded-lg border border-amber-700/60 bg-amber-950/35 p-2 text-sm text-amber-100";
  resultEl.setAttribute("role", "alert");
}

function applyResultStale(resultEl) {
  resultEl.textContent = "Press Calculate to update the line.";
  resultEl.className =
    "mt-2 rounded-lg border border-slate-700 bg-slate-900/40 p-2 text-sm text-slate-400";
  resultEl.setAttribute("role", "status");
}

function rawFieldsKey(raw) {
  return [
    raw.fnStartDate,
    String(raw.lineAtStart).trim(),
    String(raw.rotateFrom).trim(),
    String(raw.rotateTo).trim(),
    raw.targetDate,
  ].join("\u0001");
}

function stateToRawKey(state) {
  return [
    state.fnStartDate,
    String(state.lineAtStart),
    String(state.rotateFrom),
    String(state.rotateTo),
    state.targetDate,
  ].join("\u0001");
}

export function render(container, widgetRow, dashboard) {
  const row = widgetRow;
  const today = toDateInputString();

  container.classList.add("space-y-3");
  container.innerHTML = `
    <div class="space-y-2">
      <label class="block">
        <span class="text-xs uppercase tracking-wide text-slate-300/90">FN start date</span>
        <input data-fortnight-start data-type="date" type="date" class="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/90" />
      </label>

      <label class="block">
        <span class="text-xs uppercase tracking-wide text-slate-300/90">Line number at FN start</span>
        <input data-line-start type="number" inputmode="numeric" class="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/90" />
      </label>

      <label class="block">
        <span class="text-xs uppercase tracking-wide text-slate-300/90">Rotate from</span>
        <input data-rotate-from type="number" inputmode="numeric" class="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/90" />
      </label>

      <label class="block">
        <span class="text-xs uppercase tracking-wide text-slate-300/90">Rotate to</span>
        <input data-rotate-to type="number" inputmode="numeric" class="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/90" />
      </label>

      <label class="block">
        <span class="text-xs uppercase tracking-wide text-slate-300/90">Target date</span>
        <input data-target-date data-type="date" type="date" class="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/90" />
      </label>
    </div>

    <button type="button" data-fortnight-calculate class="btn-primary mt-1 w-full focus:outline-none focus:ring-2 focus:ring-cyan-300/90 min-h-[42px]">
      Calculate
    </button>

    <p data-fortnight-result class="mt-2 rounded-lg border border-slate-700 bg-slate-900/55 p-2 text-sm text-cyan-100" role="status" aria-live="polite"></p>
  `;

  const startInput = container.querySelector("[data-fortnight-start]");
  const lineStartInput = container.querySelector("[data-line-start]");
  const rotateFromInput = container.querySelector("[data-rotate-from]");
  const rotateToInput = container.querySelector("[data-rotate-to]");
  const targetInput = container.querySelector("[data-target-date]");
  const result = container.querySelector("[data-fortnight-result]");
  const calcBtn = container.querySelector("[data-fortnight-calculate]");
  const boundInputs = [startInput, lineStartInput, rotateFromInput, rotateToInput, targetInput];

  const hydrateInputs = (state) => {
    updateValue(startInput, state.fnStartDate);
    updateValue(lineStartInput, String(state.lineAtStart));
    updateValue(rotateFromInput, String(state.rotateFrom));
    updateValue(rotateToInput, String(state.rotateTo));
    updateValue(targetInput, state.targetDate);
  };

  const readRawFromInputs = () => ({
    fnStartDate: startInput?.value ?? "",
    lineAtStart: lineStartInput?.value ?? "",
    rotateFrom: rotateFromInput?.value ?? "",
    rotateTo: rotateToInput?.value ?? "",
    targetDate: targetInput?.value ?? "",
  });

  const persistCommittedState = (state) => {
    row.fortnightState = state;
    if (!dashboard) return;

    const persistLanding =
      typeof dashboard.persistToolsLandingWidgets === "function"
        ? () => dashboard.persistToolsLandingWidgets()
        : null;
    const persistDebugTools =
      typeof dashboard.persistToolsWidgets === "function"
        ? () => dashboard.persistToolsWidgets()
        : null;
    const persistHome =
      typeof dashboard.persistWidgets === "function" ? () => dashboard.persistWidgets() : null;

    if (
      persistLanding &&
      Array.isArray(dashboard.toolsLandingWidgets) &&
      dashboard.toolsLandingWidgets.some((item) => item.id === row.id)
    ) {
      persistLanding();
      return;
    }
    if (
      persistDebugTools &&
      Array.isArray(dashboard.toolsWidgets) &&
      dashboard.toolsWidgets.some((item) => item.id === row.id)
    ) {
      persistDebugTools();
      return;
    }
    if (
      persistHome &&
      Array.isArray(dashboard.widgets) &&
      dashboard.widgets.some((item) => item.id === row.id)
    ) {
      persistHome();
    }
  };

  let committedState = normalizeFortnightState(row?.fortnightState || {}, today);

  const syncResultToDraft = () => {
    const key = rawFieldsKey(readRawFromInputs());
    if (key === stateToRawKey(committedState)) {
      applyResultSuccess(result, committedState);
    } else {
      applyResultStale(result);
    }
  };

  const runCalculate = () => {
    const verdict = validateFortnightInputs(readRawFromInputs());
    if (!verdict.ok) {
      applyResultError(result, verdict.message);
      return;
    }

    committedState = verdict.state;
    applyResultSuccess(result, committedState);
    persistCommittedState(committedState);
  };

  const onKeyDown = (ev) => {
    if (ev.key !== "Enter") return;
    if (ev.target !== startInput && ev.target !== lineStartInput && ev.target !== rotateFromInput && ev.target !== rotateToInput && ev.target !== targetInput) {
      return;
    }
    ev.preventDefault();
    runCalculate();
  };

  const onFieldInput = () => {
    syncResultToDraft();
  };

  calcBtn?.addEventListener("click", runCalculate);
  container.addEventListener("keydown", onKeyDown);
  boundInputs.forEach((input) => {
    if (!input) return;
    input.addEventListener("input", onFieldInput);
    input.addEventListener("change", onFieldInput);
  });

  hydrateInputs(committedState);
  applyResultSuccess(result, committedState);

  return () => {
    calcBtn?.removeEventListener("click", runCalculate);
    container.removeEventListener("keydown", onKeyDown);
    boundInputs.forEach((input) => {
      if (!input) return;
      input.removeEventListener("input", onFieldInput);
      input.removeEventListener("change", onFieldInput);
    });
  };
}
