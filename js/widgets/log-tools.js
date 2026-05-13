import { subscribeLogs, getLogLines } from "../site-diagnostics.js";

/** @param {'all'|'severe'} filter */
function shouldShowLine(filter, line) {
  if (filter === "severe") {
    return line.level === "warn" || line.level === "error";
  }
  return true;
}

/** @param {string} level */
function levelClass(level) {
  if (level === "error") return "text-red-400";
  if (level === "warn") return "text-amber-400";
  if (level === "info") return "text-accent";
  return "text-text-2";
}

/**
 * @param {HTMLElement} container
 * @param {{ editMode?: boolean, config?: object, dashboard?: object, online?: boolean }} _ctx
 */
export function render(container, _ctx) {
  container.className = "h-full flex flex-col min-h-[12rem] text-sm";

  let filter = "all";

  container.innerHTML = `
    <div class="flex flex-wrap gap-2 mb-2 shrink-0">
      <button type="button" data-log-filter="all" class="rounded-btn border px-3 py-2 text-xs font-medium min-h-[2.625rem] border-accent bg-elevated text-text-1">All</button>
      <button type="button" data-log-filter="severe" class="rounded-btn border border-border px-3 py-2 text-xs font-medium min-h-[2.625rem] text-text-2 hover:border-accent/50">Warn + Error</button>
    </div>
    <div
      data-log-stream
      class="flex-1 min-h-0 overflow-y-auto rounded-btn border border-border bg-bg/90 p-2 font-mono text-xs leading-relaxed"
      tabindex="0"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    ></div>
  `;

  const stream = container.querySelector("[data-log-stream]");
  const btnAll = container.querySelector('[data-log-filter="all"]');
  const btnSevere = container.querySelector('[data-log-filter="severe"]');

  let pinnedToBottom = true;

  function setFilterButtons() {
    const on = "rounded-btn border px-3 py-2 text-xs font-medium min-h-[2.625rem] border-accent bg-elevated text-text-1";
    const off =
      "rounded-btn border border-border px-3 py-2 text-xs font-medium min-h-[2.625rem] text-text-2 hover:border-accent/50";
    if (btnAll instanceof HTMLElement) btnAll.className = filter === "all" ? on : off;
    if (btnSevere instanceof HTMLElement) btnSevere.className = filter === "severe" ? on : off;
  }

  function formatLine(line) {
    const t = line.ts.slice(11, 19);
    const lv = line.level.toUpperCase().padEnd(5, " ");
    const src = (line.source || "").padEnd(8, " ").slice(0, 8);
    const esc = (s) =>
      String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const d = line.detail ? ` — ${esc(line.detail)}` : "";
    return `<span class="text-text-3">${esc(t)}</span> <span class="${levelClass(line.level)}">${esc(lv)}</span> <span class="text-text-3">${esc(src)}</span> <span class="text-text-1">${esc(line.message)}${d}</span>`;
  }

  function paint(lines) {
    if (!(stream instanceof HTMLElement)) return;
    const filtered = lines.filter((l) => shouldShowLine(filter, l));
    stream.innerHTML = filtered
      .map(
        (l) =>
          `<div class="whitespace-pre-wrap break-words py-0.5 border-b border-border/40 last:border-0">${formatLine(l)}</div>`
      )
      .join("");
    if (pinnedToBottom) {
      stream.scrollTop = stream.scrollHeight;
    }
  }

  function onScroll() {
    if (!(stream instanceof HTMLElement)) return;
    pinnedToBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 8;
  }

  const unsub = subscribeLogs((lines) => {
    paint(lines);
  });

  paint(getLogLines());

  if (stream instanceof HTMLElement) {
    stream.addEventListener("scroll", onScroll, { passive: true });
  }

  function onFilterClick(next) {
    filter = next;
    setFilterButtons();
    paint(getLogLines());
  }

  const onAll = () => onFilterClick("all");
  const onSevere = () => onFilterClick("severe");
  if (btnAll instanceof HTMLElement) btnAll.addEventListener("click", onAll);
  if (btnSevere instanceof HTMLElement) btnSevere.addEventListener("click", onSevere);

  setFilterButtons();

  return {
    destroy() {
      unsub();
      if (stream instanceof HTMLElement) {
        stream.removeEventListener("scroll", onScroll);
      }
      if (btnAll instanceof HTMLElement) btnAll.removeEventListener("click", onAll);
      if (btnSevere instanceof HTMLElement) btnSevere.removeEventListener("click", onSevere);
    },
  };
}
