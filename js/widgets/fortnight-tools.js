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

function countFortnightAdvancingSundays(startDate, targetDate) {
  if (!startDate || !targetDate) return 0;
  if (targetDate < startDate) return 0;

  const cursor = new Date(startDate);
  cursor.setDate(cursor.getDate() + 1);
  let sundayCount = 0;
  while (cursor <= targetDate) {
    if (cursor.getDay() === 0) sundayCount += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }

  return sundayCount;
}

function calculateLine(state) {
  const startDate = parseDateFromInput(state.fnStartDate);
  const targetDate = parseDateFromInput(state.targetDate);
  if (!startDate || !targetDate) return state.lineAtStart;

  // For target dates before FN start, output the configured start-line.
  if (targetDate < startDate) return state.lineAtStart;

  const sundayCount = countFortnightAdvancingSundays(startDate, targetDate);
  const stepCount = Math.floor(sundayCount / 2);
  const cycleLength = Math.max(1, state.rotateTo - state.rotateFrom + 1);
  const relativeStart = state.lineAtStart - state.rotateFrom;
  const nextLine = ((relativeStart + stepCount) % cycleLength + cycleLength) % cycleLength;
  return state.rotateFrom + nextLine;
}

function updateValue(input, value) {
  if (input && input.value !== value) input.value = value;
}

export function render(container, widgetRow, dashboard) {
  const row = widgetRow;
  const today = toDateInputString();
  let state = normalizeFortnightState(row?.fortnightState || {}, today);
  row.fortnightState = state;

  container.classList.add("space-y-3");
  container.innerHTML = `
    <div class="space-y-2">
      <label class="block">
        <span class="text-xs uppercase tracking-wide text-slate-300/90">FN start date</span>
        <input data-fortnight-start data-type="date" type="date" class="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/90" />
      </label>

      <label class="block">
        <span class="text-xs uppercase tracking-wide text-slate-300/90">Line number at FN start</span>
        <input data-line-start type="number" min="1" max="99" class="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/90" />
      </label>

      <label class="block">
        <span class="text-xs uppercase tracking-wide text-slate-300/90">Rotate from</span>
        <input data-rotate-from type="number" min="1" max="99" class="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/90" />
      </label>

      <label class="block">
        <span class="text-xs uppercase tracking-wide text-slate-300/90">Rotate to</span>
        <input data-rotate-to type="number" min="1" max="99" class="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/90" />
      </label>

      <label class="block">
        <span class="text-xs uppercase tracking-wide text-slate-300/90">Target date</span>
        <input data-target-date data-type="date" type="date" class="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/90" />
      </label>
    </div>

    <p data-fortnight-result class="mt-2 rounded-lg border border-slate-700 bg-slate-900/55 p-2 text-sm text-cyan-100" role="status"></p>
  `;

  const startInput = container.querySelector("[data-fortnight-start]");
  const lineStartInput = container.querySelector("[data-line-start]");
  const rotateFromInput = container.querySelector("[data-rotate-from]");
  const rotateToInput = container.querySelector("[data-rotate-to]");
  const targetInput = container.querySelector("[data-target-date]");
  const result = container.querySelector("[data-fortnight-result]");
  const boundInputs = [startInput, lineStartInput, rotateFromInput, rotateToInput, targetInput];

  let debounceId = null;

  const persistState = () => {
    const current = normalizeFortnightState(row.fortnightState || {}, state.fnStartDate || today);
    const same =
      current.fnStartDate === state.fnStartDate &&
      current.lineAtStart === state.lineAtStart &&
      current.rotateFrom === state.rotateFrom &&
      current.rotateTo === state.rotateTo &&
      current.targetDate === state.targetDate;
    if (!same) row.fortnightState = state;

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

  const renderResult = () => {
    const line = calculateLine(state);
    const dateLabel = formatResultDate(state.targetDate);
    result.textContent = `On ${dateLabel} you will be on line ${line}`;
  };

  const applyState = () => {
    updateValue(startInput, state.fnStartDate);
    updateValue(lineStartInput, String(state.lineAtStart));
    updateValue(rotateFromInput, String(state.rotateFrom));
    updateValue(rotateToInput, String(state.rotateTo));
    updateValue(targetInput, state.targetDate);
    renderResult();
  };

  const onChange = () => {
    const nextState = normalizeFortnightState(
      {
        fnStartDate: startInput?.value,
        lineAtStart: lineStartInput?.value,
        rotateFrom: rotateFromInput?.value,
        rotateTo: rotateToInput?.value,
        targetDate: targetInput?.value,
      },
      state.fnStartDate || today
    );

    if (
      nextState.fnStartDate === state.fnStartDate &&
      nextState.lineAtStart === state.lineAtStart &&
      nextState.rotateFrom === state.rotateFrom &&
      nextState.rotateTo === state.rotateTo &&
      nextState.targetDate === state.targetDate
    ) {
      renderResult();
      return;
    }

    state = nextState;
    row.fortnightState = state;
    applyState();
    if (debounceId) window.clearTimeout(debounceId);
    debounceId = window.setTimeout(() => {
      debounceId = null;
      persistState();
    }, 80);
  };

  boundInputs.forEach((input) => {
    if (!input) return;
    input.addEventListener("input", onChange);
    input.addEventListener("change", onChange);
  });

  applyState();
  persistState();

  return () => {
    boundInputs.forEach((input) => {
      if (!input) return;
      input.removeEventListener("input", onChange);
      input.removeEventListener("change", onChange);
    });
    if (debounceId) window.clearTimeout(debounceId);
    persistState();
  };
}
