import { subscribeProbes, refreshProbes } from "../site-diagnostics.js";

function worstStatus(rows) {
  if (!rows.length) return "ok";
  if (rows.some((r) => r.status === "crit")) return "crit";
  if (rows.some((r) => r.status === "warn")) return "warn";
  return "ok";
}

function statusChipClass(status) {
  if (status === "crit") return "text-red-400 border-red-400/40 bg-red-400/10";
  if (status === "warn") return "text-amber-400 border-amber-400/40 bg-amber-400/10";
  return "text-emerald-400 border-emerald-400/40 bg-emerald-400/10";
}

function rowDotClass(status) {
  if (status === "crit") return "bg-red-400";
  if (status === "warn") return "bg-amber-400";
  return "bg-emerald-400";
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {HTMLElement} container
 * @param {{ editMode?: boolean, config?: object, dashboard?: object, online?: boolean }} _ctx
 */
export function render(container, _ctx) {
  container.className = "h-full flex flex-col min-h-[10rem] text-text-1 text-sm";

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
      <div>
        <p class="text-xs uppercase tracking-wide text-text-3">Overall</p>
        <div class="flex items-center gap-2 mt-1">
          <span data-diag-overall class="inline-flex items-center rounded-btn border px-2 py-1 text-xs font-medium"></span>
          <span data-diag-updated class="text-xs text-text-3"></span>
        </div>
      </div>
      <button
        type="button"
        data-diag-refresh
        class="shrink-0 rounded-btn border border-border bg-elevated px-3 py-2 text-xs font-medium text-text-1 hover:border-accent/50 min-h-[2.625rem] min-w-[2.625rem]"
      >
        Refresh
      </button>
    </div>
    <ul data-diag-rows class="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1"></ul>
  `;

  const overallEl = container.querySelector("[data-diag-overall]");
  const updatedEl = container.querySelector("[data-diag-updated]");
  const rowsEl = container.querySelector("[data-diag-rows]");
  const refreshBtn = container.querySelector("[data-diag-refresh]");

  function renderRows(rows) {
    if (!(rowsEl instanceof HTMLElement)) return;
    const w = worstStatus(rows);
    if (overallEl instanceof HTMLElement) {
      const label = w === "crit" ? "Critical" : w === "warn" ? "Warning" : "Healthy";
      overallEl.textContent = label;
      overallEl.className = `inline-flex items-center rounded-btn border px-2 py-1 text-xs font-medium ${statusChipClass(w)}`;
    }
    const latest = rows.length ? rows.reduce((a, b) => (a.at > b.at ? a : b)).at : "";
    if (updatedEl instanceof HTMLElement) {
      updatedEl.textContent = latest ? `Updated ${new Date(latest).toLocaleTimeString()}` : "";
    }

    rowsEl.innerHTML = rows
      .map((r) => {
        const dot = rowDotClass(r.status);
        const safeLabel = escHtml(r.label);
        const safeDetail = escHtml(r.detail || "");
        return `
          <li class="rounded-btn border border-border bg-surface/80 px-3 py-2">
            <div class="flex items-start gap-2">
              <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}" aria-hidden="true"></span>
              <div class="min-w-0 flex-1">
                <p class="font-medium text-text-1">${safeLabel}</p>
                <p class="text-xs text-text-2 mt-0.5 break-words">${safeDetail}</p>
              </div>
            </div>
          </li>
        `;
      })
      .join("");
  }

  const unsub = subscribeProbes(renderRows);

  const onRefresh = () => {
    void refreshProbes();
  };
  if (refreshBtn instanceof HTMLElement) {
    refreshBtn.addEventListener("click", onRefresh);
  }

  return {
    destroy() {
      unsub();
      if (refreshBtn instanceof HTMLElement) {
        refreshBtn.removeEventListener("click", onRefresh);
      }
    },
  };
}
