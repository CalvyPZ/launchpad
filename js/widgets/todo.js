import { evaluateTodoPeriodicReset } from "../store.js";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TASK_COLOURS = [
  { label: "Cyan",    value: "#2dd4bf" },
  { label: "Blue",    value: "#3b82f6" },
  { label: "Violet",  value: "#a78bfa" },
  { label: "Red",     value: "#f87171" },
  { label: "Orange",  value: "#fb923c" },
  { label: "Amber",   value: "#fbbf24" },
  { label: "Green",   value: "#4ade80" },
  { label: "Fuchsia", value: "#e879f9" },
  { label: "Slate",   value: "#64748b" },
];

export function render(container, context) {
  const { config, dashboard, editMode } = context;
  if (!config?.id || !dashboard) {
    container.textContent = "To-Do unavailable.";
    return { destroy() {} };
  }

  evaluateTodoPeriodicReset(config.todoState);

  const persist = () => dashboard.persistWidgets();

  const syncTodoStateFromDom = () => {
    const rec = recurrenceSelect?.value || "never";
    const time = timeInput?.value || "09:00";
    const wd = parseInt(weekdaySelect?.value || "0", 10);
    config.todoState.recurrence = rec === "daily" || rec === "weekly" ? rec : "never";
    config.todoState.timeLocal = time;
    config.todoState.weekday = Number.isFinite(wd) ? wd : 0;
    persist();
  };

  let items = Array.isArray(config.todoState.tasks) ? [...config.todoState.tasks] : [];
  let openPickerId = null;
  let dragFromIndex = null;
  persist();

  container.className = "h-full todo-widget-root";
  container.innerHTML = `
    <div class="todo-schedule" data-todo-schedule style="${editMode ? "" : "display:none"}">
      <p class="todo-schedule-hint">Auto-reset clears every task's done state (keeps text). Uses this device's local time.</p>
      <label class="todo-field">
        <span>Reset</span>
        <select class="search-input" data-todo-recurrence aria-label="When to reset completed tasks">
          <option value="never">Never (manual only)</option>
          <option value="daily">Every day at a set time</option>
          <option value="weekly">Once a week on a weekday</option>
        </select>
      </label>
      <label class="todo-field">
        <span>Time</span>
        <input class="search-input" type="time" data-todo-time aria-label="Local time for reset" />
      </label>
      <label class="todo-field todo-field-weekday" data-todo-weekday-wrap>
        <span>Weekday</span>
        <select class="search-input" data-todo-weekday aria-label="Weekday for weekly reset"></select>
      </label>
    </div>
    <div class="todo-input-row" data-todo-input-row style="${editMode ? "" : "display:none"}">
      <input class="search-input" type="text" placeholder="New task…" data-todo-input aria-label="New task" />
      <button type="button" class="btn-soft" data-todo-add>Add</button>
    </div>
    <div class="todo-list" data-todo-list></div>
  `;

  const recurrenceSelect = container.querySelector("[data-todo-recurrence]");
  const timeInput = container.querySelector("[data-todo-time]");
  const weekdaySelect = container.querySelector("[data-todo-weekday]");
  const weekdayWrap = container.querySelector("[data-todo-weekday-wrap]");

  if (editMode) {
    WEEKDAY_LABELS.forEach((label, dow) => {
      const opt = document.createElement("option");
      opt.value = String(dow);
      opt.textContent = `${label} (${dow === 0 ? "Sun" : dow === 6 ? "Sat" : label.slice(0, 3)})`;
      weekdaySelect.appendChild(opt);
    });

    recurrenceSelect.value = config.todoState.recurrence || "never";
    timeInput.value = (config.todoState.timeLocal || "09:00").slice(0, 5);
    weekdaySelect.value = String(clampDow(config.todoState.weekday));

    const updateWeekdayVisibility = () => {
      weekdayWrap.style.display = recurrenceSelect.value === "weekly" ? "" : "none";
    };
    updateWeekdayVisibility();

    const onRecurrenceChange = () => {
      syncTodoStateFromDom();
      updateWeekdayVisibility();
      evaluateTodoPeriodicReset(config.todoState);
      items = [...(config.todoState.tasks || [])];
      persist();
      refresh();
    };

    const onTimeChange = () => {
      syncTodoStateFromDom();
      evaluateTodoPeriodicReset(config.todoState);
      items = [...(config.todoState.tasks || [])];
      persist();
      refresh();
    };

    const onWeekdayChange = () => {
      syncTodoStateFromDom();
      evaluateTodoPeriodicReset(config.todoState);
      items = [...(config.todoState.tasks || [])];
      persist();
      refresh();
    };

    recurrenceSelect.addEventListener("change", onRecurrenceChange);
    timeInput.addEventListener("change", onTimeChange);
    weekdaySelect.addEventListener("change", onWeekdayChange);
  }

  const colourSwatchesHtml = TASK_COLOURS.map(
    (c) => `<button type="button" class="todo-colour-swatch" style="background:${c.value}" data-colour-pick data-colour-value="${escapeHtml(c.value)}" aria-label="${escapeHtml(c.label)} task colour" title="${escapeHtml(c.label)}"></button>`
  ).join("");

  const refresh = () => {
    const list = container.querySelector("[data-todo-list]");
    if (!list) return;

    if (!items.length) {
      list.innerHTML = `<p class="todo-empty" role="status">No tasks yet.${editMode ? " Add one below." : ""}</p>`;
      return;
    }

    list.innerHTML = items
      .map(
        (item, idx) => `
      <div class="todo-item-wrap ${item.done ? "done" : ""}" draggable="true" data-task-idx="${idx}" data-task-id="${escapeHtml(item.id)}">
        <div class="todo-item-inner" style="border-left:3px solid ${item.color || "#3d3d3d"}">
          <span class="todo-task-handle" aria-hidden="true" title="Drag to reorder">⠿</span>
          <label class="todo-item-label">
            <input type="checkbox" ${item.done ? "checked" : ""} data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.text)}" />
            <span class="todo-item-text">${escapeHtml(item.text)}</span>
          </label>
          <div class="todo-colour-wrap" data-colour-wrap="${escapeHtml(item.id)}">
            <button type="button"
                    class="todo-colour-btn"
                    style="background:${item.color || "transparent"};border-color:${item.color || "#5c5c5c"}"
                    data-colour-toggle="${escapeHtml(item.id)}"
                    aria-label="Change task colour"
                    aria-haspopup="true"
                    aria-expanded="${openPickerId === item.id ? "true" : "false"}"
                    title="Change task colour"></button>
            <div class="todo-colour-picker${openPickerId === item.id ? " open" : ""}" data-colour-picker="${escapeHtml(item.id)}" role="dialog" aria-label="Choose task colour">
              <div class="todo-colour-grid">
                ${TASK_COLOURS.map(
                  (c) => `<button type="button" class="todo-colour-swatch${item.color === c.value ? " selected" : ""}" style="background:${c.value}" data-colour-pick="${escapeHtml(item.id)}" data-colour-value="${escapeHtml(c.value)}" aria-label="${escapeHtml(c.label)}" title="${escapeHtml(c.label)}"></button>`
                ).join("")}
              </div>
              <button type="button" class="todo-colour-clear" data-colour-pick="${escapeHtml(item.id)}" data-colour-value="" aria-label="Clear colour">Clear</button>
            </div>
          </div>
        </div>
      </div>
    `
      )
      .join("");

    list.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.addEventListener("change", () => {
        items = items.map((i) => (i.id === cb.dataset.id ? { ...i, done: cb.checked } : i));
        config.todoState.tasks = items;
        persist();
        refresh();
      });
    });

    list.querySelectorAll("[data-colour-toggle]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.colourToggle;
        openPickerId = openPickerId === id ? null : id;
        refresh();
      });
    });

    list.querySelectorAll("[data-colour-pick]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.colourPick;
        const colour = btn.dataset.colourValue || null;
        items = items.map((i) => (i.id === id ? { ...i, color: colour } : i));
        config.todoState.tasks = items;
        openPickerId = null;
        persist();
        refresh();
      });
    });

    list.querySelectorAll("[data-task-idx]").forEach((wrap) => {
      wrap.addEventListener("dragstart", (e) => {
        dragFromIndex = parseInt(wrap.dataset.taskIdx, 10);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(dragFromIndex));
        wrap.classList.add("todo-item-dragging");
      });

      wrap.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        wrap.classList.add("todo-item-dragover");
      });

      wrap.addEventListener("dragleave", (e) => {
        if (!wrap.contains(e.relatedTarget)) {
          wrap.classList.remove("todo-item-dragover");
        }
      });

      wrap.addEventListener("drop", (e) => {
        e.preventDefault();
        wrap.classList.remove("todo-item-dragover");
        const toIndex = parseInt(wrap.dataset.taskIdx, 10);
        const fromIndex = dragFromIndex;
        if (fromIndex === null || fromIndex === undefined || fromIndex === toIndex) return;
        const next = [...items];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        items = next;
        config.todoState.tasks = items;
        dragFromIndex = null;
        persist();
        refresh();
      });

      wrap.addEventListener("dragend", () => {
        wrap.classList.remove("todo-item-dragging");
        wrap.classList.remove("todo-item-dragover");
        dragFromIndex = null;
      });
    });
  };

  refresh();

  const onDocClick = (e) => {
    if (openPickerId !== null && !e.target.closest("[data-colour-wrap]")) {
      openPickerId = null;
      refresh();
    }
  };
  document.addEventListener("click", onDocClick);

  const onDocKeydown = (e) => {
    if (e.key === "Escape" && openPickerId !== null) {
      openPickerId = null;
      refresh();
    }
  };
  document.addEventListener("keydown", onDocKeydown);

  const destroyers = [];

  if (editMode) {
    const input = container.querySelector("[data-todo-input]");
    const addBtn = container.querySelector("[data-todo-add]");

    const addItem = () => {
      const text = input.value.trim();
      if (!text) return;
      items = [...items, { id: `${Date.now()}`, text, done: false, color: null }];
      config.todoState.tasks = items;
      persist();
      input.value = "";
      refresh();
    };

    const onInputKeydown = (e) => {
      if (e.key === "Enter") addItem();
    };

    addBtn.addEventListener("click", addItem);
    input.addEventListener("keydown", onInputKeydown);

    destroyers.push(() => {
      addBtn.removeEventListener("click", addItem);
      input.removeEventListener("keydown", onInputKeydown);
    });
  }

  return {
    destroy() {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onDocKeydown);
      destroyers.forEach((fn) => fn());
      persist();
    },
  };
}

function clampDow(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return ((Math.floor(n) % 7) + 7) % 7;
}
