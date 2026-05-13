function getMarked() {
  return typeof window !== "undefined" ? window.marked : null;
}

function getPurify() {
  return typeof window !== "undefined" ? window.DOMPurify : null;
}

function isDashboardOnline(dashboard) {
  if (dashboard && typeof dashboard.online === "boolean") return dashboard.online;
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function librariesMissingMessage(dashboard) {
  const online = isDashboardOnline(dashboard);
  if (!online) {
    return "<p class=\"notes-md-fallback\">You appear offline. Reconnect to load the markdown preview libraries, or switch to <strong>Source only</strong>.</p>";
  }
  return "<p class=\"notes-md-fallback\">Markdown preview libraries are still loading. If this message stays, check your network or ad blocker, or switch to <strong>Source only</strong>.</p>";
}

const NOTES_PERSIST_DEBOUNCE_MS = 250;

async function renderMarkdownToSafeHtml(src, dashboard) {
  const marked = getMarked();
  const DOMPurify = getPurify();
  if (!marked || !DOMPurify) {
    return { html: librariesMissingMessage(dashboard) };
  }
  const srcStr = String(src || "");
  try {
    const parsed = typeof marked.parse === "function" ? marked.parse(srcStr, { async: false }) : marked(srcStr);
    const rawHtml = await Promise.resolve(parsed).catch(() => "");
    return {
      html: DOMPurify.sanitize(String(rawHtml ?? ""), { USE_PROFILES: { html: true } }),
    };
  } catch (error) {
    console.error("Failed to render markdown preview", error);
    return {
      html: "<p class=\"notes-md-fallback\">Preview could not be parsed. Check your Markdown syntax.</p>",
    };
  }
}

export function render(container, context) {
  const { config, dashboard } = context;
  if (!config?.id || !dashboard) {
    container.textContent = "Notes unavailable.";
    return { destroy() {} };
  }

  if (!config.notesState) config.notesState = { markdown: "" };

  container.className = "h-full notes-widget-root";
  container.innerHTML = `
    <div class="notes-toolbar">
      <button type="button" class="btn-soft notes-mode-btn" data-notes-mode="split" aria-pressed="true">Split</button>
      <button type="button" class="btn-ghost notes-mode-btn" data-notes-mode="edit" aria-pressed="false">Source only</button>
      <button type="button" class="btn-ghost notes-mode-btn" data-notes-mode="preview" aria-pressed="false">Preview only</button>
    </div>
    <div class="notes-panes" data-notes-panes>
      <textarea class="note-area notes-md-source" rows="6" spellcheck="false" placeholder="Write Markdown…" aria-label="Notes Markdown source"></textarea>
      <div class="notes-md-preview notes-markdown-body" data-notes-preview hidden></div>
    </div>
  `;

  const textarea = container.querySelector(".notes-md-source");
  const preview = container.querySelector("[data-notes-preview]");
  const panes = container.querySelector("[data-notes-panes]");
  const modeButtons = [...container.querySelectorAll("[data-notes-mode]")];

  let mode =
    config.notesState.viewMode === "edit" || config.notesState.viewMode === "preview"
      ? config.notesState.viewMode
      : "split";

  textarea.value = config.notesState.markdown || "";

  const persist = () => dashboard.persistWidgets();

  let previewSeq = 0;
  const applyPreviewHtml = async () => {
    const seq = ++previewSeq;
    preview.innerHTML = "<p class=\"notes-md-fallback\">Rendering preview…</p>";
    const result = await renderMarkdownToSafeHtml(textarea.value, dashboard);
    if (previewSeq !== seq) return;
    preview.innerHTML = result.html || "";
  };

  const setMode = (next) => {
    mode = next;
    config.notesState.viewMode = mode;
    modeButtons.forEach((btn) => {
      const active = btn.dataset.notesMode === mode;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.classList.toggle("btn-soft", active);
      btn.classList.toggle("btn-ghost", !active);
    });

    panes.classList.remove("notes-panes--split", "notes-panes--edit", "notes-panes--preview");
    textarea.hidden = false;
    preview.hidden = false;

    if (mode === "split") {
      panes.classList.add("notes-panes--split");
    } else if (mode === "edit") {
      panes.classList.add("notes-panes--edit");
      preview.hidden = true;
    } else {
      panes.classList.add("notes-panes--preview");
      textarea.hidden = true;
    }

    applyPreviewHtml();
    persist();
  };

  setMode(mode);

  let timer = null;
  const onInput = () => {
    config.notesState.markdown = textarea.value;
    if (mode !== "edit") applyPreviewHtml();
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      persist();
    }, NOTES_PERSIST_DEBOUNCE_MS);
  };

  textarea.addEventListener("input", onInput);

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.notesMode || "split"));
  });

  return {
    destroy() {
      if (timer) window.clearTimeout(timer);
      previewSeq += 1;
      config.notesState.markdown = textarea.value;
      persist();
      textarea.removeEventListener("input", onInput);
    },
  };
}
