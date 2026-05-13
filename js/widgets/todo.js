import { evaluateTodoPeriodicReset } from "../store.js";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function render(container, context) {
  const { config, dashboard } = context;
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
  persist();

  container.className = "h-full todo-widget-root";
  container.innerHTML = `
    <div class="todo-schedule" data-todo-schedule>
      <p class="todo-schedule-hint">Auto-reset clears every task’s done state (keeps text). Uses this device’s local time.</p>
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
    <div class="todo-input-row">
      <input class="search-input" type="text" placeholder="New task…" data-todo-input aria-label="New task" />
      <button type="button" class="btn-soft" data-todo-add>Add</button>
    </div>
    <div class="todo-list" data-todo-list></div>
  `;

  const recurrenceSelect = container.querySelector("[data-todo-recurrence]");
  const timeInput = container.querySelector("[data-todo-time]");
  const weekdaySelect = container.querySelector("[data-todo-weekday]");
  const weekdayWrap = container.querySelector("[data-todo-weekday-wrap]");

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
    const show = recurrenceSelect.value === "weekly";
    weekdayWrap.style.display = show ? "" : "none";
  };
  updateWeekdayVisibility();

  const refresh = () => {
    const list = container.querySelector("[data-todo-list]");
    if (!list) return;
    if (!items.length) {
      list.innerHTML =
        "<p class=\"todo-empty\" role=\"status\">No tasks yet. Add one below.</p>";
      return;
    }
    list.innerHTML = items
      .map(
        (item) => `
      <label class="todo-item ${item.done ? "done" : ""}">
        <input type="checkbox" ${item.done ? "checked" : ""} data-id="${escapeHtml(item.id)}" />
        <span>${escapeHtml(item.text)}</span>
      </label>
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
  };

  refresh();

  const input = container.querySelector("[data-todo-input]");
  const addBtn = container.querySelector("[data-todo-add]");

  const addItem = () => {
    const text = input.value.trim();
    if (!text) return;
    items = [...items, { id: `${Date.now()}`, text, done: false }];
    config.todoState.tasks = items;
    persist();
    input.value = "";
    refresh();
  };

  const onInputKeydown = (e) => {
    if (e.key === "Enter") addItem();
  };

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

  addBtn.addEventListener("click", addItem);
  input.addEventListener("keydown", onInputKeydown);
  recurrenceSelect.addEventListener("change", onRecurrenceChange);
  timeInput.addEventListener("change", onTimeChange);
  weekdaySelect.addEventListener("change", onWeekdayChange);

  return {
    destroy() {
      addBtn.removeEventListener("click", addItem);
      input.removeEventListener("keydown", onInputKeydown);
      recurrenceSelect.removeEventListener("change", onRecurrenceChange);
      timeInput.removeEventListener("change", onTimeChange);
      weekdaySelect.removeEventListener("change", onWeekdayChange);
      persist();
    },
  };
}

function clampDow(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return ((Math.floor(n) % 7) + 7) % 7;
}
