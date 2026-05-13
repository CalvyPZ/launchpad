const SEARCH_ENGINE_KEY = "calvybots_search_engine";

const ENGINES = {
  google: "https://www.google.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
  bing: "https://www.bing.com/search?q=",
};

function loadEngine() {
  const saved = localStorage.getItem(SEARCH_ENGINE_KEY);
  return ENGINES[saved] ? saved : "google";
}

function saveEngine(value) {
  localStorage.setItem(SEARCH_ENGINE_KEY, value);
}

export function render(container) {
  const currentEngine = loadEngine();
  const formId = `search-form-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const selectId = `${formId}-engine`;
  const inputId = `${formId}-query`;
  const hintId = `${formId}-hint`;

  container.className = "h-full";
  container.innerHTML = `
    <form class="mt-1 flex flex-col gap-2" data-search-form>
      <label class="sr-only" for="${selectId}">Search engine</label>
      <div class="flex items-center gap-2">
        <select class="search-input" data-search-engine id="${selectId}" aria-describedby="${hintId}">
          <option value="google">Google</option>
          <option value="duckduckgo">DuckDuckGo</option>
          <option value="bing">Bing</option>
        </select>
        <button
          type="submit"
          class="btn-soft px-3 py-2 text-xs"
          aria-label="Run search"
        >
          Search
        </button>
      </div>
      <label class="sr-only" for="${inputId}">Search query</label>
      <input
        class="search-input"
        type="text"
        placeholder="Search the web..."
        id="${inputId}"
        data-search-input
        autocomplete="off"
        aria-label="Search query"
        aria-describedby="${hintId}"
      />
      <p id="${hintId}" class="text-[11px] text-text-2 mt-0.5">
        Select an engine and enter a query, then press Search.
      </p>
    </form>
  `;

  const form = container.querySelector("[data-search-form]");
  const select = container.querySelector("[data-search-engine]");
  const input = container.querySelector("[data-search-input]");

  select.value = currentEngine;

  const onSubmit = (event) => {
    event.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    const engine = select.value;
    saveEngine(engine);
    const url = `${ENGINES[engine]}${encodeURIComponent(q)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onEngineChange = () => saveEngine(select.value);

  form.addEventListener("submit", onSubmit);
  select.addEventListener("change", onEngineChange);

  return {
    destroy() {
      form.removeEventListener("submit", onSubmit);
      select.removeEventListener("change", onEngineChange);
    },
  };
}
