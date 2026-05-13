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
  let activeColorTaskId = null;
  let listEl = null;
  const taskDragState = {
    active: false,
    finalized: false,
    pointerId: null,
    sourceWidgetId: null,
    sourceTaskId: null,
    sourceTaskEl: null,
    sourceList: null,
    ghost: null,
    placeholder: null,
    destinationList: null,
    /** Snapshot string so drop survives DOM churn / id type mismatches with dataset. */
    destinationWidgetId: null,
    destinationTaskId: null,
    pointerOffsetX: 0,
    pointerOffsetY: 0,
    sourceRect: null,
    pointerMoveHandler: null,
  };

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
    const id = String(widgetId || "");
    if (!id) return null;
    const matches = (widget) => String(widget?.id || "") === id && widget.type === "todo";
    const fromHome = Array.isArray(dashboard?.widgets) ? dashboard.widgets.find(matches) : null;
    if (fromHome) return fromHome;
    return Array.isArray(dashboard?.toolsWidgets) ? dashboard.toolsWidgets.find(matches) || null : null;
  };

  const resolveTodoListWidgetId = (listEl) => {
    if (!listEl) return "";
    const shell = listEl.closest(".dash-widget");
    const fromShell = shell?.dataset?.widgetId;
    const fromList = listEl.dataset?.widgetId;
    return String(fromShell || fromList || "");
  };

  const getTodoItemById = (taskId) => {
    if (!listEl || !taskId) return null;
    return listEl.querySelector(`.todo-item[data-task-id="${escapeHtml(taskId)}"]`);
  };

  const getColorPanel = (taskId) => {
    if (!taskId) return null;
    return document.querySelector(`.todo-color-panel[data-task-id="${escapeHtml(taskId)}"]`);
  };

  const VIEWPORT_GAP = 6;
  const getViewportBounds = () => {
    const viewport = window.visualViewport;
    const left = Number(viewport?.offsetLeft || 0);
    const top = Number(viewport?.offsetTop || 0);
    const width = Number(viewport?.width || window.innerWidth);
    const height = Number(viewport?.height || window.innerHeight);
    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
    };
  };

  const clampToRange = (value, min, max) => {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return value;
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
  };

  const restoreColorPanel = (taskId, panel) => {
    if (!taskId || !panel || panel.dataset.portalToBody !== "true") return;
    const row = getTodoItemById(taskId);
    if (!row) {
      if (panel.parentElement === document.body) {
        panel.remove();
      }
      panel.dataset.portalToBody = "false";
      return;
    }
    row.appendChild(panel);
    panel.dataset.portalToBody = "false";
  };

  const readTasksForWidget = (widgetId) => {
    const widget = getTodoWidget(widgetId);
    if (!widget?.todoState) return [];
    const normalized = normalizeTodoState(widget.todoState);
    widget.todoState = normalized;
    if (String(widget.id) === String(currentWidgetId)) {
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
    if (String(widget.id) === String(currentWidgetId)) {
      config.todoState = widget.todoState;
      items = [...safeTasks];
    }
    return true;
  };

  const syncCurrentWidget = () => {
    writeTasksForWidget(currentWidgetId, items);
    const id = String(currentWidgetId);
    if (dashboard.widgets?.some((w) => String(w?.id || "") === id)) {
      dashboard.persistWidgets();
    }
    if (dashboard.toolsWidgets?.some((w) => String(w?.id || "") === id) && typeof dashboard.persistToolsWidgets === "function") {
      dashboard.persistToolsWidgets();
    }
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

  const makeTaskPayload = (sourceWidgetId, taskId) => {
    if (!sourceWidgetId || !taskId) return null;
    return {
      sourceWidgetId: String(sourceWidgetId),
      taskId: String(taskId),
    };
  };

  const getTodoLists = () => Array.from(document.querySelectorAll(".todo-list"));

  const removeTaskPlaceholder = () => {
    if (!taskDragState.placeholder) return;
    if (taskDragState.placeholder.parentElement) {
      taskDragState.placeholder.remove();
    }
  };

  const clearTodoDragState = () => {
    getTodoLists().forEach((todoList) => {
      todoList.classList.remove("is-list-drop-target");
      todoList.querySelectorAll(".todo-item").forEach((item) => item.classList.remove("dnd-over"));
    });
    removeTaskPlaceholder();
  };

  const moveTask = (payload, destinationWidgetId, destinationTaskId = null) => {
    if (!payload) return;
    const sourceWidgetId = String(payload.sourceWidgetId || "");
    const taskId = String(payload.taskId || "");
    const destId = String(destinationWidgetId || "");
    if (!sourceWidgetId || !taskId || !destId) return;

    if (!getTodoWidget(sourceWidgetId)) {
      console.error("Todo move: source widget not found", sourceWidgetId);
      return;
    }

    const sameWidget = sourceWidgetId === destId;
    if (!sameWidget && !getTodoWidget(destId)) {
      console.error("Todo move: destination widget not found", destId);
      return;
    }

    const sourceTasks = readTasksForWidget(sourceWidgetId);
    const sourceIndex = sourceTasks.findIndex((task) => task.id === taskId);
    if (sourceIndex < 0) return;

    const movedTask = normalizeTodoTask(sourceTasks[sourceIndex], sourceIndex);
    const nextSourceTasks = [...sourceTasks];
    nextSourceTasks.splice(sourceIndex, 1);

    const destinationBase = sameWidget ? [...nextSourceTasks] : readTasksForWidget(destId);
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
    writeTasksForWidget(destId, nextDestinationTasks);

    const widgetInList = (list, wid) =>
      Array.isArray(list) && list.some((w) => String(w?.id || "") === String(wid || ""));
    if (widgetInList(dashboard.widgets, sourceWidgetId) || widgetInList(dashboard.widgets, destId)) {
      dashboard.persistWidgets();
    }
    if (
      widgetInList(dashboard.toolsWidgets, sourceWidgetId) ||
      widgetInList(dashboard.toolsWidgets, destId)
    ) {
      if (typeof dashboard.persistToolsWidgets === "function") {
        dashboard.persistToolsWidgets();
      }
    }
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
    const row = getTodoItemById(taskId);
    if (!taskId || !row) return false;
    const button = row.querySelector("[data-task-color-toggle]");
    const panel = getColorPanel(taskId);
    if (!button || !panel) return false;

    const triggerRect = button.getBoundingClientRect();
    panel.style.position = "fixed";
    panel.style.zIndex = "40";
    panel.style.visibility = "hidden";
    panel.hidden = false;
    panel.style.left = "0px";
    panel.style.top = "0px";

    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
      panel.dataset.portalToBody = "true";
    }

    const panelRect = panel.getBoundingClientRect();
    const viewport = getViewportBounds();
    const maxTop = viewport.bottom - panelRect.height - VIEWPORT_GAP;
    const minTop = viewport.top + VIEWPORT_GAP;
    const minLeft = viewport.left + VIEWPORT_GAP;
    const maxLeft = viewport.right - panelRect.width - VIEWPORT_GAP;
    const preferredTop = triggerRect.bottom + VIEWPORT_GAP;
    const fallbackTop = triggerRect.top - panelRect.height - VIEWPORT_GAP;

    let top = preferredTop;
    if (top > maxTop && fallbackTop >= minTop) {
      top = fallbackTop;
    }
    top = clampToRange(top, minTop, maxTop);

    const left = clampToRange(triggerRect.left, minLeft, maxLeft);

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.visibility = "";
    return true;
  };

  const closeColorPanel = (taskId = activeColorTaskId) => {
    const closeSinglePanel = (panel, panelTaskId) => {
      if (!panel) return;
      panel.hidden = true;
      panel.classList.remove("is-open");
      panel.style.left = "";
      panel.style.top = "";
      panel.style.visibility = "";
      restoreColorPanel(panelTaskId, panel);
    };

    if (!taskId) {
      if (!listEl) {
        activeColorTaskId = null;
        return;
      }
      activeColorTaskId = null;
      const activePanels = document.querySelectorAll("[data-task-color-panel]");
      activePanels.forEach((panel) => {
        closeSinglePanel(panel, panel.dataset.taskId);
      });
      listEl.querySelectorAll("[data-task-color-toggle]").forEach((button) => button.setAttribute("aria-expanded", "false"));
      return;
    }

    const row = getTodoItemById(taskId);
    const panel = getColorPanel(taskId);
    closeSinglePanel(panel, taskId);
    const button = row?.querySelector("[data-task-color-toggle]");
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

  const ensureTaskPlaceholder = () => {
    if (taskDragState.placeholder) return taskDragState.placeholder;
    const placeholder = document.createElement("div");
    placeholder.className = "dnd-task-placeholder";
    taskDragState.placeholder = placeholder;
    return placeholder;
  };

  const getInsertionTargetTask = (list, pointerY) => {
    const tasks = Array.from(list.querySelectorAll(".todo-item")).filter((task) => task !== taskDragState.sourceTaskEl);
    if (!tasks.length) return null;
    for (const task of tasks) {
      const rect = task.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (pointerY < midpoint) {
        return task.dataset.taskId || null;
      }
    }
    return null;
  };

  const placePlaceholder = (list, destinationTaskId) => {
    const placeholder = ensureTaskPlaceholder();
    if (!list) return;
    if (!destinationTaskId) {
      if (placeholder.parentElement !== list) {
        list.appendChild(placeholder);
      } else if (placeholder.nextSibling) {
        list.appendChild(placeholder);
      }
      return;
    }
    const target = list.querySelector(`.todo-item[data-task-id="${escapeHtml(destinationTaskId)}"]`);
    if (target && target.parentElement === list) {
      list.insertBefore(placeholder, target);
    }
  };

  const onTaskPointerDown = (event) => {
    const handle = event.currentTarget;
    const taskElement = handle.closest(".todo-item");
    const taskId = taskElement?.dataset?.taskId;
    if (!taskElement || !taskId) return;
    if (typeof handle.setPointerCapture === "function") {
      handle.setPointerCapture(event.pointerId);
    }
    taskDragState.pointerMoveHandler = onTaskPointerMove;
    document.addEventListener("pointermove", taskDragState.pointerMoveHandler, { passive: false });
    const sourceList = taskElement.closest(".todo-list");
    const rect = taskElement.getBoundingClientRect();
    const ghost = taskElement.cloneNode(true);
    ghost.className = `${taskElement.className} dnd-ghost-task`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.position = "fixed";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9000";
    ghost.style.transform = "translate(0px, 0px)";
    document.body.appendChild(ghost);

    taskDragState.active = true;
    taskDragState.finalized = false;
    taskDragState.pointerId = event.pointerId;
    taskDragState.sourceWidgetId = currentWidgetId;
    taskDragState.sourceTaskId = taskId;
    taskDragState.sourceTaskEl = taskElement;
    taskDragState.sourceList = sourceList;
    taskDragState.ghost = ghost;
    taskDragState.destinationList = null;
    taskDragState.destinationWidgetId = null;
    taskDragState.destinationTaskId = null;
    taskDragState.pointerOffsetX = event.clientX - rect.left;
    taskDragState.pointerOffsetY = event.clientY - rect.top;
    taskDragState.sourceRect = rect;
    document.body.classList.add("dnd-active");
    event.preventDefault();
  };

  const onTaskPointerMove = (event) => {
    event.preventDefault();
    if (!taskDragState.active || event.pointerId !== taskDragState.pointerId || !taskDragState.ghost || !taskDragState.sourceRect) return;
    const rect = taskDragState.sourceRect;
    const dx = event.clientX - taskDragState.pointerOffsetX - rect.left;
    const dy = event.clientY - taskDragState.pointerOffsetY - rect.top;
    taskDragState.ghost.style.transform = `translate(${dx}px, ${dy}px)`;

    const pointerX = event.clientX;
    const pointerY = event.clientY;

    const pointInList = (list) => {
      const bounds = list.getBoundingClientRect();
      return (
        pointerX >= bounds.left &&
        pointerX <= bounds.right &&
        pointerY >= bounds.top &&
        pointerY <= bounds.bottom
      );
    };

    const todoLists = getTodoLists();
    const hits = todoLists.filter((list) => pointInList(list));

    let destinationList = null;
    if (hits.length === 1) {
      destinationList = hits[0];
    } else if (hits.length > 1) {
      const nonSource = hits.filter((list) => list !== taskDragState.sourceList);
      if (nonSource.length === 1) {
        destinationList = nonSource[0];
      } else if (nonSource.length > 1) {
        let best = nonSource[0];
        let bestD = Infinity;
        for (const list of nonSource) {
          const b = list.getBoundingClientRect();
          const cx = (b.left + b.right) / 2;
          const cy = (b.top + b.bottom) / 2;
          const d = (pointerX - cx) ** 2 + (pointerY - cy) ** 2;
          if (d < bestD) {
            bestD = d;
            best = list;
          }
        }
        destinationList = best;
      } else {
        destinationList = taskDragState.sourceList;
      }
    }

    clearTodoDragState();

    if (!destinationList) {
      taskDragState.destinationList = null;
      taskDragState.destinationWidgetId = null;
      taskDragState.destinationTaskId = null;
      return;
    }

    const destinationTaskId = getInsertionTargetTask(destinationList, pointerY);
    destinationList.classList.add("is-list-drop-target");
    placePlaceholder(destinationList, destinationTaskId);
    taskDragState.destinationList = destinationList;
    taskDragState.destinationWidgetId = resolveTodoListWidgetId(destinationList);
    taskDragState.destinationTaskId = destinationTaskId;
  };

  const detachTaskPointerMove = () => {
    if (taskDragState.pointerMoveHandler) {
      document.removeEventListener("pointermove", taskDragState.pointerMoveHandler);
      taskDragState.pointerMoveHandler = null;
    }
  };

  const finishTaskDragEnd = (shouldMutate = false) => {
    if (taskDragState.ghost && taskDragState.ghost.isConnected) {
      taskDragState.ghost.remove();
    }
    clearTodoDragState();
    document.body.classList.remove("dnd-active");
    taskDragState.active = false;
    taskDragState.pointerId = null;
    taskDragState.sourceWidgetId = null;
    taskDragState.sourceTaskId = null;
    taskDragState.sourceTaskEl = null;
    taskDragState.sourceList = null;
    taskDragState.ghost = null;
    taskDragState.placeholder = null;
    taskDragState.destinationList = null;
    taskDragState.destinationWidgetId = null;
    taskDragState.destinationTaskId = null;
    taskDragState.pointerOffsetX = 0;
    taskDragState.pointerOffsetY = 0;
    taskDragState.sourceRect = null;
    detachTaskPointerMove();
    if (!shouldMutate) return;
  };

  const tryFinalizeTaskDrop = (event) => {
    detachTaskPointerMove();
    if (taskDragState.finalized) return;
    if (!taskDragState.active) return;
    if (event && typeof event.pointerId === "number" && event.pointerId !== taskDragState.pointerId) return;
    taskDragState.finalized = true;

    const payload = makeTaskPayload(taskDragState.sourceWidgetId, taskDragState.sourceTaskId);
    const destWidgetId =
      String(taskDragState.destinationWidgetId || "").trim() || resolveTodoListWidgetId(taskDragState.destinationList);
    const destinationTaskId = taskDragState.destinationTaskId || null;
    const shouldCommit = Boolean(payload && destWidgetId);
    if (shouldCommit) {
      moveTask(payload, destWidgetId, destinationTaskId);
    }
    finishTaskDragEnd(shouldCommit);
  };

  const onTaskPointerUp = (event) => {
    tryFinalizeTaskDrop(event);
  };

  const onTaskPointerCancel = (event) => {
    detachTaskPointerMove();
    if (taskDragState.finalized) return;
    if (!taskDragState.active) return;
    if (event && typeof event.pointerId === "number" && event.pointerId !== taskDragState.pointerId) return;
    taskDragState.finalized = true;
    finishTaskDragEnd(false);
  };

  const onTaskLostPointerCapture = (event) => {
    tryFinalizeTaskDrop(event);
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
    const row = getTodoItemById(activeColorTaskId);
    const panel = getColorPanel(activeColorTaskId);
    if (
      (!row || !row.contains(event.target)) &&
      (!panel || !panel.contains(event.target))
    ) {
      closeColorPanel();
    }
  };

  const onDocumentFocusIn = (event) => {
    if (!activeColorTaskId) return;
    const row = getTodoItemById(activeColorTaskId);
    const panel = getColorPanel(activeColorTaskId);
    if (
      (!row || !row.contains(event.target)) &&
      (!panel || !panel.contains(event.target))
    ) {
      closeColorPanel();
    }
  };

  const onTaskListKeydown = (event) => {
    if (event.key === "Escape") closeColorPanel();
  };

  const onTodoColorPanelKeydown = (event) => {
    if (event.key === "Escape") {
      closeColorPanel();
    }
  };

  const onTodoColorPanelRelocate = () => {
    if (!activeColorTaskId) return;
    const repositioned = positionColorPanel(activeColorTaskId);
    if (!repositioned) {
      closeColorPanel(activeColorTaskId);
    }
  };

  const todoColorPanelViewport = window.visualViewport;

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
    if (activeColorTaskId) closeColorPanel(activeColorTaskId);
    if (!items.length) {
      listEl.innerHTML = "<p class=\"todo-empty\" role=\"status\">No tasks yet.</p>";
      return;
    }
    listEl.innerHTML = items
      .map(
        (item) => `
          <div class="todo-item ${item.done ? "done" : ""}" role="listitem" data-task-id="${escapeHtml(item.id)}" style="--todo-task-color:${escapeHtml(taskRenderColor(item.color))};">
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

      const panel = taskElement.querySelector("[data-task-color-panel]");
      if (panel) {
        panel.addEventListener("keydown", onTodoColorPanelKeydown);
      }

      taskElement.querySelectorAll("[data-task-color-btn]").forEach((button) => {
        button.addEventListener("click", () => setTaskColor(taskId, button.dataset.taskColor));
      });

      const taskHandle = taskElement.querySelector(".todo-item-handle");
      if (taskHandle) {
        taskHandle.addEventListener("pointerdown", onTaskPointerDown, { passive: false });
        taskHandle.addEventListener("pointerup", onTaskPointerUp);
        taskHandle.addEventListener("pointercancel", onTaskPointerCancel);
        taskHandle.addEventListener("lostpointercapture", onTaskLostPointerCapture);
      }
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

  listEl?.addEventListener("scroll", onTodoColorPanelRelocate);
  listEl?.addEventListener("keydown", onTaskListKeydown);
  window.addEventListener("scroll", onTodoColorPanelRelocate, true);
  window.addEventListener("resize", onTodoColorPanelRelocate);
  todoColorPanelViewport?.addEventListener("scroll", onTodoColorPanelRelocate);
  todoColorPanelViewport?.addEventListener("resize", onTodoColorPanelRelocate);
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
      listEl?.removeEventListener("scroll", onTodoColorPanelRelocate);
      listEl?.removeEventListener("keydown", onTaskListKeydown);
      window.removeEventListener("scroll", onTodoColorPanelRelocate, true);
      window.removeEventListener("resize", onTodoColorPanelRelocate);
      todoColorPanelViewport?.removeEventListener("scroll", onTodoColorPanelRelocate);
      todoColorPanelViewport?.removeEventListener("resize", onTodoColorPanelRelocate);
      detachTaskPointerMove();
      if (!taskDragState.finalized && taskDragState.active) {
        taskDragState.finalized = true;
        finishTaskDragEnd(false);
      }
      closeColorPanel();
      items = [...normalizeTodoState(config.todoState).tasks];
      syncCurrentWidget();
    },
  };
}
