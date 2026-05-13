import {
  defaultTodoState,
  evaluateTodoPeriodicReset,
  normalizeTodoTaskColor,
  TODO_TASK_DEFAULT_COLOR,
  TODO_TASK_PALETTE,
} from "../store.js";

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function clampDow(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return ((Math.floor(n) % 7) + 7) % 7;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeTodoTask(raw, fallbackIndex = 0) {
  return {
    id: String(raw?.id || `task-${Date.now()}-${fallbackIndex}`),
    text: typeof raw?.text === "string" ? raw.text : "",
    done: Boolean(raw?.done),
    color: normalizeTodoTaskColor(raw?.color),
  };
}

function normalizeTodoState(state) {
  const base = defaultTodoState();
  if (!state || typeof state !== "object") {
    return {
      ...base,
      tasks: [],
    };
  }

  const tasks = Array.isArray(state.tasks)
    ? state.tasks.map((task, index) => normalizeTodoTask(task, index))
    : [];

  return {
    ...base,
    ...state,
    tasks,
    recurrence: state.recurrence === "daily" || state.recurrence === "weekly" ? state.recurrence : base.recurrence,
    timeLocal: typeof state.timeLocal === "string" ? state.timeLocal : base.timeLocal,
    weekday: Number.isFinite(Number(state.weekday)) ? Number(state.weekday) : base.weekday,
  };
}

function colorGridMarkup(taskId, selectedColor) {
  const normalizedSelected = normalizeTodoTaskColor(selectedColor);
  return TODO_TASK_PALETTE.map((entry) => {
    const isNone = Boolean(entry.isNone);
    const value = isNone ? "" : entry.value;
    const isSelected = isNone ? normalizedSelected === "" || normalizedSelected == null : normalizedSelected === value;

    return `
      <button
        type="button"
        class="todo-color-option todo-color-option--dropdown${isNone ? " todo-color-option--none" : ""}${isSelected ? " is-selected" : ""}"
        data-task-color-btn
        data-task-id="${escapeHtml(taskId)}"
        data-task-color="${escapeHtml(value)}"
        aria-label="Set task color to ${escapeHtml(entry.label)}"
        ${isSelected ? 'aria-pressed="true"' : ""}
        ${isNone ? "" : `style="background:${escapeHtml(value)};"`}
      ></button>
    `;
  }).join("");
}

function taskRenderColor(rawColor) {
  const normalized = normalizeTodoTaskColor(rawColor);
  return normalized ? normalized : TODO_TASK_DEFAULT_COLOR;
}

export function render(container, context) {
  const { config, dashboard, editMode } = context;
  if (!config?.id || !dashboard) {
    container.textContent = "To-Do unavailable.";
    return { destroy() {} };
  }

  const isEditMode = Boolean(editMode);
  const currentWidgetId = String(config.id);
  const state = normalizeTodoState(config.todoState);
  config.todoState = state;
  evaluateTodoPeriodicReset(config.todoState);

  let items = [...state.tasks];
  let draggedTaskId = null;
  let draggedSourceWidgetId = null;
  let activeColorTaskId = null;
  let listEl = null;

  container.className = "h-full todo-widget-root";
  container.innerHTML = `
    ${isEditMode ? `<div class="todo-schedule" data-todo-schedule>
      <p class="todo-schedule-hint">Auto-reset clears every task&apos;s done state (keeps text). Uses this device&apos;s local time.</p>
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
    </div>` : ""}
    <div class="todo-input-row">
      <input class="search-input" type="text" placeholder="New task…" data-todo-input aria-label="New task" />
      <button type="button" class="btn-soft" data-todo-add>Add</button>
    </div>
    <div class="todo-list" data-todo-list data-widget-id="${escapeHtml(currentWidgetId)}" role="list" aria-label="To-Do list tasks"></div>
  `;

  const list = container.querySelector("[data-todo-list]");
  listEl = list;

  const recurrenceSelect = container.querySelector("[data-todo-recurrence]");
  const timeInput = container.querySelector("[data-todo-time]");
  const weekdaySelect = container.querySelector("[data-todo-weekday]");
  const weekdayWrap = container.querySelector("[data-todo-weekday-wrap]");
  const input = container.querySelector("[data-todo-input]");
  const addBtn = container.querySelector("[data-todo-add]");

  const getTodoWidget = (widgetId) => {
    if (!dashboard?.widgets || !Array.isArray(dashboard.widgets)) return null;
    return dashboard.widgets.find((widget) => widget?.id === widgetId && widget.type === "todo") || null;
  };

  const readTasksForWidget = (widgetId) => {
    const widget = getTodoWidget(widgetId);
    if (!widget?.todoState) return [];
    const normalized = normalizeTodoState(widget.todoState);
    widget.todoState = normalized;
    if (widget.id === currentWidgetId) {
      config.todoState = normalized;
      items = [...normalized.tasks];
    }
    return normalized.tasks;
  };

  const writeTasksForWidget = (widgetId, nextTasks) => {
    const widget = getTodoWidget(widgetId);
    if (!widget) return false;
    const normalized = normalizeTodoState(widget.todoState || defaultTodoState());
    const safeTasks = Array.isArray(nextTasks)
      ? nextTasks.map((task, index) => normalizeTodoTask(task, index))
      : [];
    widget.todoState = {
      ...normalized,
      tasks: safeTasks,
    };
    if (widget.id === currentWidgetId) {
      config.todoState = widget.todoState;
      items = [...safeTasks];
    }
    return true;
  };

  const syncCurrentWidget = () => {
    writeTasksForWidget(currentWidgetId, items);
    dashboard.persistWidgets();
  };

  const syncTodoControlsFromDom = () => {
    if (!recurrenceSelect || !timeInput || !weekdaySelect) return;
    const rec = recurrenceSelect.value || "never";
    const time = timeInput.value || "09:00";
    const wd = parseInt(weekdaySelect.value || "0", 10);
    config.todoState.recurrence = rec === "daily" || rec === "weekly" ? rec : "never";
    config.todoState.timeLocal = time;
    config.todoState.weekday = Number.isFinite(wd) ? wd : 0;
  };

  const renderWeekdayVisibility = () => {
    if (!weekdayWrap || !recurrenceSelect) return;
    weekdayWrap.style.display = recurrenceSelect.value === "weekly" ? "" : "none";
  };

  const parsePayload = (event) => {
    if (!event?.dataTransfer) return null;
    const json = event.dataTransfer.getData("application/json");
    if (json) {
      try {
        const parsed = JSON.parse(json);
        if (parsed?.taskId && parsed?.sourceWidgetId) {
          return {
            sourceWidgetId: String(parsed.sourceWidgetId),
            taskId: String(parsed.taskId),
          };
        }
      } catch {}
    }
    const plain = event.dataTransfer.getData("text/plain") || "";
    const divider = plain.indexOf(":");
    if (divider > 0) {
      return {
        sourceWidgetId: plain.slice(0, divider),
        taskId: plain.slice(divider + 1),
      };
    }
    if (draggedTaskId && draggedSourceWidgetId) {
      return {
        sourceWidgetId: draggedSourceWidgetId,
        taskId: draggedTaskId,
      };
    }
    return null;
  };

  const clearDropState = () => {
    if (!listEl) return;
    listEl.classList.remove("is-list-drop-target");
    listEl.querySelectorAll(".todo-item").forEach((item) => item.classList.remove("is-drop-target"));
  };

  const moveTask = (payload, destinationWidgetId, destinationTaskId = null) => {
    if (!payload) return;
    const sourceWidgetId = String(payload.sourceWidgetId || "");
    const taskId = String(payload.taskId || "");
    if (!sourceWidgetId || !taskId || !destinationWidgetId) return;

    const sourceTasks = readTasksForWidget(sourceWidgetId);
    const sourceIndex = sourceTasks.findIndex((task) => task.id === taskId);
    if (sourceIndex < 0) return;

    const movedTask = normalizeTodoTask(sourceTasks[sourceIndex], sourceIndex);
    const nextSourceTasks = [...sourceTasks];
    nextSourceTasks.splice(sourceIndex, 1);

    const sameWidget = sourceWidgetId === destinationWidgetId;
    const destinationBase = sameWidget ? [...nextSourceTasks] : readTasksForWidget(destinationWidgetId);
    let destinationIndex = destinationTaskId
      ? destinationBase.findIndex((task) => task.id === destinationTaskId)
      : destinationBase.length;
    if (!Number.isFinite(destinationIndex) || destinationIndex < 0) {
      destinationIndex = destinationBase.length;
    }
    if (sameWidget && sourceIndex < destinationIndex) {
      destinationIndex -= 1;
    }
    const nextDestinationTasks = [...destinationBase];
    nextDestinationTasks.splice(
      Math.max(0, Math.min(nextDestinationTasks.length, destinationIndex)),
      0,
      movedTask
    );
    writeTasksForWidget(sourceWidgetId, nextSourceTasks);
    writeTasksForWidget(destinationWidgetId, nextDestinationTasks);
    dashboard.persistWidgets();
    if (sameWidget) {
      if (sourceWidgetId === currentWidgetId) {
        items = [...nextDestinationTasks];
        renderList();
      }
      return;
    }
    if (dashboard.renderWidgets) {
      dashboard.renderWidgets();
    }
  };

  const positionColorPanel = (taskId) => {
    if (!listEl || !taskId) return false;
    const row = listEl.querySelector(`.todo-item[data-task-id="${escapeHtml(taskId)}"]`);
    if (!row) return false;
    const button = row.querySelector("[data-task-color-toggle]");
    const panel = row.querySelector("[data-task-color-panel]");
    if (!button || !panel) return false;

    const triggerRect = button.getBoundingClientRect();
    panel.style.position = "fixed";
    panel.style.zIndex = "40";
    panel.style.visibility = "hidden";
    panel.style.left = `${Math.max(0, Math.round(triggerRect.left))}px`;
    panel.style.top = `${Math.round(triggerRect.bottom + 6)}px`;
    panel.style.visibility = "hidden";
    panel.hidden = false;

    const panelRect = panel.getBoundingClientRect();
    const maxX = window.innerWidth - panelRect.width - 6;
    const maxY = window.innerHeight - panelRect.height - 6;
    let left = triggerRect.left;
    let top = triggerRect.bottom + 6;

    if (top + panelRect.height + 6 > window.innerHeight && triggerRect.top > panelRect.height + 6) {
      top = triggerRect.top - panelRect.height - 6;
    }

    if (top > maxY) top = maxY;
    if (top < 6) top = 6;
    if (left > maxX) left = maxX;
    if (left < 6) left = 6;

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.visibility = "";
    return true;
  };

  const closeColorPanel = (taskId = activeColorTaskId) => {
    if (!listEl) {
      activeColorTaskId = null;
      return;
    }
    if (!taskId) {
      activeColorTaskId = null;
      listEl.querySelectorAll("[data-task-color-panel]").forEach((panel) => {
        panel.hidden = true;
        panel.classList.remove("is-open");
        panel.style.left = "";
        panel.style.top = "";
      });
      listEl.querySelectorAll("[data-task-color-toggle]").forEach((button) => button.setAttribute("aria-expanded", "false"));
      return;
    }
    const row = listEl.querySelector(`.todo-item[data-task-id="${escapeHtml(taskId)}"]`);
    if (!row) {
      activeColorTaskId = null;
      return;
    }
    const panel = row.querySelector("[data-task-color-panel]");
    const button = row.querySelector("[data-task-color-toggle]");
    if (panel) {
      panel.hidden = true;
      panel.classList.remove("is-open");
      panel.style.left = "";
      panel.style.top = "";
    }
    if (button) button.setAttribute("aria-expanded", "false");
    activeColorTaskId = null;
  };

  const openColorPanel = (taskId) => {
    closeColorPanel();
    const row = listEl?.querySelector(`.todo-item[data-task-id="${escapeHtml(taskId)}"]`);
    if (!row) return;
    const panel = row.querySelector("[data-task-color-panel]");
    const button = row.querySelector("[data-task-color-toggle]");
    if (!panel || !button) return;
    panel.hidden = false;
    panel.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
    const positioned = positionColorPanel(taskId);
    if (!positioned) {
      closeColorPanel(taskId);
      return;
    }
    activeColorTaskId = taskId;
  };

  const onTaskDragStart = (event) => {
    const item = event.currentTarget;
    const handle = event.target;
    if (!handle?.closest?.(".todo-item-handle")) {
      event.preventDefault();
      return;
    }
    const taskId = item?.dataset?.taskId;
    if (!taskId) return;
    draggedTaskId = taskId;
    draggedSourceWidgetId = currentWidgetId;
    item.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify({ taskId, sourceWidgetId: currentWidgetId }));
    event.dataTransfer.setData("text/plain", `${currentWidgetId}:${taskId}`);
  };

  const onTaskDragOver = (event) => {
    event.preventDefault();
    const item = event.currentTarget;
    if (item) item.classList.add("is-drop-target");
    if (listEl) listEl.classList.add("is-list-drop-target");
  };

  const onTaskDragLeave = (event) => {
    const item = event.currentTarget;
    if (item) item.classList.remove("is-drop-target");
  };

  const onTaskDrop = (event) => {
    event.preventDefault();
    const destinationTaskId = event.currentTarget?.dataset?.taskId || null;
    const destinationWidgetId = listEl?.dataset.widgetId;
    const payload = parsePayload(event);
    clearDropState();
    if (!destinationWidgetId || !payload) return;
    if (payload.sourceWidgetId === destinationWidgetId && payload.taskId === destinationTaskId) return;
    const targetTaskId = destinationWidgetId === payload.sourceWidgetId ? destinationTaskId : null;
    moveTask(payload, destinationWidgetId, targetTaskId);
  };

  const onTaskDragEnd = (event) => {
    const item = event.currentTarget;
    if (item) item.classList.remove("is-dragging");
    clearDropState();
    draggedTaskId = null;
    draggedSourceWidgetId = null;
  };

  const onListDragOver = (event) => {
    event.preventDefault();
    if (listEl) {
      listEl.classList.add("is-list-drop-target");
      event.dataTransfer.dropEffect = "move";
    }
  };

  const onListDragLeave = (event) => {
    if (!listEl) return;
    const related = event.relatedTarget;
    if (!(related instanceof Element) || !listEl.contains(related)) {
      listEl.classList.remove("is-list-drop-target");
    }
  };

  const onListDrop = (event) => {
    event.preventDefault();
    const destinationWidgetId = listEl?.dataset.widgetId;
    const payload = parsePayload(event);
    clearDropState();
    if (!destinationWidgetId || !payload) return;
    moveTask(payload, destinationWidgetId, null);
  };

  const onRecurrenceChange = () => {
    syncTodoControlsFromDom();
    evaluateTodoPeriodicReset(config.todoState);
    renderWeekdayVisibility();
    syncCurrentWidget();
    renderList();
  };

  const onTimeChange = () => {
    syncTodoControlsFromDom();
    evaluateTodoPeriodicReset(config.todoState);
    syncCurrentWidget();
  };

  const onWeekdayChange = () => {
    syncTodoControlsFromDom();
    evaluateTodoPeriodicReset(config.todoState);
    syncCurrentWidget();
  };

  const onDocumentPointerDown = (event) => {
    if (!activeColorTaskId) return;
    const row = listEl?.querySelector(`.todo-item[data-task-id="${escapeHtml(activeColorTaskId)}"]`);
    if (!row || !row.contains(event.target)) {
      closeColorPanel();
    }
  };

  const onDocumentFocusIn = (event) => {
    if (!activeColorTaskId) return;
    const row = listEl?.querySelector(`.todo-item[data-task-id="${escapeHtml(activeColorTaskId)}"]`);
    if (!row || !row.contains(event.target)) {
      closeColorPanel();
    }
  };

  const onTaskListKeydown = (event) => {
    if (event.key === "Escape") closeColorPanel();
  };

  const onTodoColorPanelRelocate = () => {
    if (!activeColorTaskId) return;
    const repositioned = positionColorPanel(activeColorTaskId);
    if (!repositioned) {
      closeColorPanel(activeColorTaskId);
    }
  };

  const setTaskDone = (taskId, isDone) => {
    items = items.map((task) => (task.id === taskId ? { ...task, done: Boolean(isDone) } : task));
    syncCurrentWidget();
    renderList();
  };

  const updateTaskText = (taskId, text) => {
    items = items.map((task) => (task.id === taskId ? { ...task, text: String(text ?? "") } : task));
    syncCurrentWidget();
  };

  const setTaskColor = (taskId, colorValue) => {
    items = items.map((task) => (task.id === taskId ? { ...task, color: normalizeTodoTaskColor(colorValue) } : task));
    syncCurrentWidget();
    closeColorPanel(taskId);
    renderList();
  };

  const removeItem = (taskId) => {
    items = items.filter((task) => task.id !== taskId);
    syncCurrentWidget();
    renderList();
  };

  const addItem = () => {
    const text = input ? input.value.trim() : "";
    if (!text) return;
    items = [
      ...items,
      {
        id: `task-${Date.now()}`,
        text,
        done: false,
        color: TODO_TASK_DEFAULT_COLOR,
      },
    ];
    syncCurrentWidget();
    if (input) input.value = "";
    renderList();
  };

  const onInputEnter = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem();
    }
  };

  const renderList = () => {
    if (!listEl) return;
    if (!items.length) {
      listEl.innerHTML = "<p class=\"todo-empty\" role=\"status\">No tasks yet.</p>";
      return;
    }
    listEl.innerHTML = items
      .map(
        (item) => `
          <div class="todo-item ${item.done ? "done" : ""}" role="listitem" data-task-id="${escapeHtml(item.id)}" draggable="true" style="--todo-task-color:${escapeHtml(taskRenderColor(item.color))};">
            <button
              type="button"
              class="todo-color-bar ${activeColorTaskId === item.id ? "is-open" : ""}"
              data-task-color-toggle
              data-task-id="${escapeHtml(item.id)}"
              aria-label="Open task color panel"
              aria-expanded="${activeColorTaskId === item.id ? "true" : "false"}"
              aria-controls="todo-task-color-${escapeHtml(item.id)}"
            ></button>
            <div class="todo-item-main">
              ${isEditMode
                ? `<button
                    type="button"
                    class="todo-task-done-toggle"
                    data-task-done-toggle
                    data-task-id="${escapeHtml(item.id)}"
                    aria-label="Mark ${escapeHtml(item.text || "task")} as ${item.done ? "not done" : "done"}"
                    aria-pressed="${item.done ? "true" : "false"}"
                  >
                    ${item.done ? "✓" : "◯"}
                  </button>
                  <input type="text" class="todo-task-text search-input" data-task-id="${escapeHtml(item.id)}" value="${escapeHtml(item.text || "")}" aria-label="Task text" />`
                : `<button
                    type="button"
                    class="todo-task-text-btn"
                    data-task-done-toggle
                    data-task-id="${escapeHtml(item.id)}"
                    aria-label="Mark ${escapeHtml(item.text || "task")} as ${item.done ? "not done" : "done"}"
                    aria-pressed="${item.done ? "true" : "false"}"
                  >
                    <span class="todo-task-label">${escapeHtml(item.text || "Unnamed task")}</span>
                  </button>`}
            </div>
            <div class="todo-task-controls">
              <button type="button" class="todo-item-handle" data-task-id="${escapeHtml(item.id)}" aria-label="Drag task to reorder" title="Drag task">&equiv;</button>
              <button type="button" class="todo-task-remove" data-task-remove data-task-id="${escapeHtml(item.id)}" aria-label="Remove task" title="Remove task">&times;</button>
            </div>
            <div class="todo-color-panel" id="todo-task-color-${escapeHtml(item.id)}" data-task-color-panel data-task-id="${escapeHtml(item.id)}" role="menu" hidden>
              <div class="todo-color-grid todo-color-grid--dropdown" role="group" aria-label="Task color">
                ${colorGridMarkup(item.id, item.color)}
              </div>
            </div>
          </div>
        `
      )
      .join("");

    listEl.querySelectorAll(".todo-item").forEach((taskElement) => {
      const taskId = taskElement.dataset.taskId;
      if (!taskId) return;

      const doneToggle = taskElement.querySelector("[data-task-done-toggle]");
      if (doneToggle) {
        doneToggle.addEventListener("click", () => {
          const targetTask = items.find((task) => task.id === taskId);
          if (!targetTask) return;
          setTaskDone(taskId, !targetTask.done);
        });
      }

      const taskTextInput = taskElement.querySelector(".todo-task-text");
      if (taskTextInput) {
        taskTextInput.addEventListener("input", () => updateTaskText(taskId, taskTextInput.value));
        taskTextInput.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            taskTextInput.blur();
          }
        });
      }

      const removeButton = taskElement.querySelector("[data-task-remove]");
      if (removeButton) {
        removeButton.addEventListener("click", () => removeItem(taskId));
      }

      const colorToggle = taskElement.querySelector("[data-task-color-toggle]");
      if (colorToggle) {
        colorToggle.addEventListener("click", () => {
          const targetTaskId = colorToggle.dataset.taskId;
          if (!targetTaskId) return;
          if (activeColorTaskId === targetTaskId) {
            closeColorPanel(targetTaskId);
          } else {
            openColorPanel(targetTaskId);
          }
        });
      }

      taskElement.querySelectorAll("[data-task-color-btn]").forEach((button) => {
        button.addEventListener("click", () => setTaskColor(taskId, button.dataset.taskColor));
      });

      taskElement.addEventListener("dragstart", onTaskDragStart);
      taskElement.addEventListener("dragover", onTaskDragOver);
      taskElement.addEventListener("dragleave", onTaskDragLeave);
      taskElement.addEventListener("drop", onTaskDrop);
      taskElement.addEventListener("dragend", onTaskDragEnd);
    });
  };

  if (isEditMode && recurrenceSelect) {
    recurrenceSelect.value = state.recurrence || "never";
    timeInput.value = (state.timeLocal || "09:00").slice(0, 5);
    weekdaySelect.value = String(clampDow(state.weekday));
    WEEKDAY_LABELS.forEach((label, dow) => {
      const option = document.createElement("option");
      option.value = String(dow);
      option.textContent = `${label} (${dow === 0 ? "Sun" : dow === 6 ? "Sat" : label.slice(0, 3)})`;
      weekdaySelect.appendChild(option);
    });
    renderWeekdayVisibility();
  }

  addBtn?.addEventListener("click", addItem);
  input?.addEventListener("keydown", onInputEnter);
  recurrenceSelect?.addEventListener("change", onRecurrenceChange);
  timeInput?.addEventListener("change", onTimeChange);
  weekdaySelect?.addEventListener("change", onWeekdayChange);

  listEl?.addEventListener("dragover", onListDragOver);
  listEl?.addEventListener("dragleave", onListDragLeave);
  listEl?.addEventListener("drop", onListDrop);
  listEl?.addEventListener("scroll", onTodoColorPanelRelocate);
  listEl?.addEventListener("keydown", onTaskListKeydown);
  window.addEventListener("scroll", onTodoColorPanelRelocate, true);
  window.addEventListener("resize", onTodoColorPanelRelocate);
  document.addEventListener("pointerdown", onDocumentPointerDown);
  document.addEventListener("focusin", onDocumentFocusIn);

  syncCurrentWidget();
  renderList();

  return {
    destroy() {
      addBtn?.removeEventListener("click", addItem);
      input?.removeEventListener("keydown", onInputEnter);
      recurrenceSelect?.removeEventListener("change", onRecurrenceChange);
      timeInput?.removeEventListener("change", onTimeChange);
      weekdaySelect?.removeEventListener("change", onWeekdayChange);
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("focusin", onDocumentFocusIn);
      listEl?.removeEventListener("dragover", onListDragOver);
      listEl?.removeEventListener("dragleave", onListDragLeave);
      listEl?.removeEventListener("drop", onListDrop);
      listEl?.removeEventListener("scroll", onTodoColorPanelRelocate);
      listEl?.removeEventListener("keydown", onTaskListKeydown);
      window.removeEventListener("scroll", onTodoColorPanelRelocate, true);
      window.removeEventListener("resize", onTodoColorPanelRelocate);
      closeColorPanel();
      syncCurrentWidget();
    },
  };
}
