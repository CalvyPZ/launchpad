const BOOKMARKS_KEY = "calvybots_bookmarks";

const DEFAULT_BOOKMARKS = [
  {
    id: "google",
    title: "Google",
    url: "https://www.google.com",
    icon: "🌐",
  },
  {
    id: "github",
    title: "GitHub",
    url: "https://github.com",
    icon: "🐙",
  },
  {
    id: "mail",
    title: "Mail",
    url: "https://mail.google.com",
    icon: "✉️",
  },
  {
    id: "music",
    title: "Spotify",
    url: "https://open.spotify.com",
    icon: "🎧",
  },
];

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [...DEFAULT_BOOKMARKS];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length
      ? parsed
      : [...DEFAULT_BOOKMARKS];
  } catch (err) {
    return [...DEFAULT_BOOKMARKS];
  }
}

function saveBookmarks(items) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(items));
}

function createItem(item, isEditMode, onDelete) {
  const bookmark = document.createElement("a");
  bookmark.href = item.url;
  bookmark.target = "_blank";
  bookmark.rel = "noopener noreferrer";
  bookmark.className = "bookmark-pill";
  bookmark.innerHTML = `
    <span>${item.icon || "🔗"}</span>
    <span class="truncate">${item.title}</span>
  `;

  if (isEditMode) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className =
      "ml-auto h-6 w-6 rounded-md border border-accent text-text-2 text-xs bg-surface";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${item.title}`);
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      onDelete(item.id);
    });
    bookmark.appendChild(remove);
  }
  return bookmark;
}

export function render(container, { editMode = false } = {}) {
  let list = loadBookmarks();
  container.className = "h-full";
  container.innerHTML = `
    <div class="widget-title">Bookmarks</div>
    <div class="bookmark-list" data-bookmark-list></div>
    <div class="mt-3 ${editMode ? "" : "hidden"}">
      <button
        type="button"
        class="btn-soft text-xs px-2 py-1 w-full"
        data-bookmark-add
      >
        + Add quick link
      </button>
    </div>
  `;

  const listEl = container.querySelector("[data-bookmark-list]");
  const addButton = container.querySelector("[data-bookmark-add]");

  const renderGrid = (items) => {
    listEl.innerHTML = "";
    items.forEach((item) => {
      listEl.appendChild(createItem(item, editMode, (id) => {
        const next = items.filter((entry) => entry.id !== id);
        list = next;
        saveBookmarks(next);
        renderGrid(next);
      }));
    });
  };

  renderGrid(list);

  let cleanupAdd = null;
  if (addButton) {
    const onAdd = () => {
      const title = window.prompt("Bookmark name:");
      if (!title || !title.trim()) return;
      const url = window.prompt("Bookmark URL (with https://):");
      if (!url || !url.trim()) return;
      const icon = window.prompt("Optional emoji icon:", "🔗") || "🔗";
      const next = [
        ...list,
        {
          id: `${Date.now()}`,
          title: title.trim(),
          url: url.trim(),
          icon: icon.slice(0, 4),
        },
      ];
      list = next;
      saveBookmarks(list);
      renderGrid(list);
    };
    addButton.addEventListener("click", onAdd);
    cleanupAdd = () => addButton.removeEventListener("click", onAdd);
  }

  return {
    destroy() {
      if (cleanupAdd) cleanupAdd();
    },
  };
}
