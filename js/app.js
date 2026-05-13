import {
  loadWidgets,
  saveWidgets,
  loadSiteTitle,
  saveSiteTitle,
  defaultNotesState,
  defaultTodoState,
  evaluateAllTodoResets,
  migrateLegacyIfNeeded,
} from "./store.js";
import * as clockWidget from "./widgets/clock.js";
import * as notesWidget from "./widgets/notes.js";
import * as todoWidget from "./widgets/todo.js";

const widgetTypes = ["clock", "notes", "todo"];
const widgetFactories = {
  clock: clockWidget.render,
  notes: notesWidget.render,
  todo: todoWidget.render,
};
const widgetTypeSet = new Set(widgetTypes);

const widgetLabels = {
  clock: "Clock",
  notes: "Sticky Notes",
  todo: "To-Do",
};

function nowClockText() {
  const now = new Date();
  const clockTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return { clockTime, date };
}

function makeWidgetId(type) {
  return `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function widgetDisplayName(config) {
  return (config.title || "").trim() || widgetLabels[config.type] || "Widget";
}

document.addEventListener("alpine:init", () => {
  Alpine.data("launchpad", function launchpad() {
  const controllers = new Map();
  const resizeObservers = new Map();
    const widgetDragState = {
      active: false,
      pointerId: null,
      sourceWidgetId: null,
      sourceWidget: null,
      sourceRect: null,
      pointerOffsetX: 0,
      pointerOffsetY: 0,
      ghost: null,
      dropTargetWidgetId: null,
      dropIndex: null,
    };
  const format = nowClockText();

  return {
    siteTitle: loadSiteTitle(),
    clockTime: format.clockTime,
    clockDate: format.date,
    editMode: false,
    addWidgetOpen: false,
    widgets: [],
    clockTitle: "",
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    widgetMapEl: null,
    _todoResetTicker: null,
    _clockTicker: null,
    _onlineHandler: null,
    _offlineHandler: null,
    _visibilityHandler: null,

    getWidgetMap() {
      return this.widgetMapEl || document.getElementById("widget-grid");
    },

    init() {
      this.widgetMapEl = this.$refs?.widgetGrid || document.getElementById("widget-grid");
      this._onlineHandler = () => {
        this.online = true;
      };
      this._offlineHandler = () => {
        this.online = false;
      };
      window.addEventListener("online", this._onlineHandler);
      window.addEventListener("offline", this._offlineHandler);
      this.refreshClock();
      this.widgets = loadWidgets();
      this._visibilityHandler = () => {
        if (document.visibilityState === "visible") {
          if (evaluateAllTodoResets(this.widgets)) {
            this.persistWidgets();
            this.renderWidgets();
          }
          this._armTodoResetTicker();
        } else {
          this._disarmTodoResetTicker();
        }
      };
      document.addEventListener("visibilitychange", this._visibilityHandler);
      this.renderWidgets();
      this.persistWidgets();
      if (this._clockTicker) window.clearInterval(this._clockTicker);
      this._clockTicker = window.setInterval(() => this.refreshClock(), 1000);
      if (document.visibilityState === "visible") {
        this._armTodoResetTicker();
      }
    },

    _armTodoResetTicker() {
      if (this._todoResetTicker != null) return;
      // Re-evaluate todo recurrence while tab stays visible (e.g. past local midnight). Tradeoff: ~60s
      // latency; timer cleared while hidden to avoid wakeups. DST uses real Date in store helpers.
      this._todoResetTicker = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        if (evaluateAllTodoResets(this.widgets)) {
          this.persistWidgets();
          this.renderWidgets();
        }
      }, 60000);
    },

    _disarmTodoResetTicker() {
      if (this._todoResetTicker != null) {
        window.clearInterval(this._todoResetTicker);
        this._todoResetTicker = null;
      }
    },

    refreshClock() {
      const latest = nowClockText();
      this.clockTime = latest.clockTime;
      this.clockDate = latest.date;
    },

    setSiteTitle(value) {
      const safe = (value || "").trim() || "Calvy Launchpad";
      this.siteTitle = safe;
      saveSiteTitle(safe);
    },

    persistWidgets() {
      saveWidgets(this.widgets);
    },

    normalizeWidgets() {
      this.widgets = this.widgets
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((widget, index) => ({ ...widget, position: index }));
    },

    renderWidgets() {
      const widgetMap = this.getWidgetMap();
      if (!widgetMap) return;
      this.normalizeWidgets();
      widgetMap.classList.add("widget-enter");
      widgetMap.innerHTML = "";
      controllers.forEach((instance) => {
        if (instance?.destroy) instance.destroy();
      });
      controllers.clear();
      resizeObservers.forEach((ro) => ro.disconnect());
      resizeObservers.clear();

      for (const config of this.widgets) {
        const shell = document.createElement("article");
        const typeLabel = widgetLabels[config.type] || "Widget";
        const displayName = widgetDisplayName(config);

        shell.className = `dash-widget ${this.editMode ? "editable" : ""}`;
        shell.dataset.widgetId = config.id;
        shell.dataset.widgetType = config.type;

        const minW = Number.isFinite(config.minWidth) ? config.minWidth : 250;
        const minH = Number.isFinite(config.minHeight) ? config.minHeight : 178;
        shell.style.minWidth = `${minW}px`;
        shell.style.minHeight = `${minH}px`;
        if (config.width != null && Number.isFinite(config.width)) {
          shell.style.width = `${config.width}px`;
        } else {
          shell.style.width = "";
        }
        if (config.height != null && Number.isFinite(config.height)) {
          shell.style.height = `${config.height}px`;
        } else {
          shell.style.height = "";
        }

        shell.innerHTML = `
          <div class="widget-header" data-widget-header></div>
          <div class="widget-content h-full"></div>
        `;

        const headerEl = shell.querySelector("[data-widget-header]");
        if (this.editMode) {
          const titleInput = document.createElement("input");
          titleInput.type = "text";
          titleInput.className = "widget-title-input";
          titleInput.value = (config.title || "").trim();
          titleInput.placeholder = typeLabel;
          titleInput.setAttribute("aria-label", "Widget name");
          let titleTimer = null;
          const saveTitle = () => {
            const idx = this.widgets.findIndex((w) => w.id === config.id);
            if (idx < 0) return;
            this.widgets[idx].title = titleInput.value.trim();
            this.persistWidgets();
          };
          titleInput.addEventListener("blur", saveTitle);
          titleInput.addEventListener("input", () => {
            if (titleTimer) window.clearTimeout(titleTimer);
            titleTimer = window.setTimeout(saveTitle, 450);
          });
          headerEl.appendChild(titleInput);
        } else {
          const label = document.createElement("div");
          label.className = "widget-title";
          label.textContent = displayName;
          headerEl.appendChild(label);
        }

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "widget-remove";
        removeBtn.textContent = "×";
        removeBtn.title = "Remove widget";
        removeBtn.setAttribute("aria-label", `Remove ${widgetDisplayName(config)} widget`);
        removeBtn.style.display = this.editMode ? "grid" : "none";
        removeBtn.addEventListener("click", () => this.removeWidget(config.id));
        shell.appendChild(removeBtn);

        const dragHandle = document.createElement("span");
        dragHandle.className = "widget-handle";
        dragHandle.textContent = "⠿";
        dragHandle.style.display = this.editMode ? "grid" : "none";
        dragHandle.title = "Drag to move";
        shell.appendChild(dragHandle);

        if (this.editMode) {
          dragHandle.addEventListener("pointerdown", this.onWidgetPointerDown.bind(this));
          dragHandle.addEventListener("pointermove", this.onWidgetPointerMove.bind(this));
          dragHandle.addEventListener("pointerup", this.onWidgetPointerUp.bind(this));
          dragHandle.addEventListener("pointercancel", this.onWidgetPointerCancel.bind(this));
          dragHandle.addEventListener("lostpointercapture", this.onWidgetLostPointerCapture.bind(this));
        }

        const widgetRenderer = widgetFactories[config.type];
        let moduleNode = null;
        if (widgetRenderer) {
          moduleNode = shell.querySelector(".widget-content");
          const instance = widgetRenderer(moduleNode, {
            editMode: this.editMode,
            config,
            dashboard: this,
            online: this.online,
          });
          if (instance) controllers.set(config.id, instance);
        }

        widgetMap.appendChild(shell);

        if (this.editMode && moduleNode) {
          let resizeTimer = null;
          const ro = new ResizeObserver(() => {
            if (!this.editMode) return;
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
              const rect = shell.getBoundingClientRect();
              const w = Math.round(rect.width);
              const h = Math.round(rect.height);
              const idx = this.widgets.findIndex((item) => item.id === config.id);
              if (idx < 0) return;
              const prev = this.widgets[idx];
              if (prev.width === w && prev.height === h) return;
              this.widgets[idx].width = w;
              this.widgets[idx].height = h;
              this.widgets[idx].minWidth = minW;
              this.widgets[idx].minHeight = minH;
              this.persistWidgets();
            }, 280);
          });
          ro.observe(moduleNode);
          resizeObservers.set(config.id, ro);
        }
      }
    },

    onWidgetPointerDown(event) {
      const widgetMap = this.getWidgetMap();
      if (!this.editMode || !widgetMap) return;
      if (!event?.currentTarget || !event.target) return;
      const handle = event.currentTarget;
      const shell = handle.closest(".dash-widget");
      if (!(shell instanceof HTMLElement)) return;
      const sourceWidgetId = shell.dataset.widgetId;
      if (!sourceWidgetId) return;
      if (typeof handle.setPointerCapture === "function") {
        handle.setPointerCapture(event.pointerId);
      }

      const rect = shell.getBoundingClientRect();
      const ghost = shell.cloneNode(true);
      ghost.classList.add("dnd-ghost-widget");
      ghost.style.position = "fixed";
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.style.transform = "translate(0px, 0px)";
      ghost.style.pointerEvents = "none";
      ghost.style.zIndex = "9000";
      ghost.style.margin = "0";
      ghost.style.transformOrigin = "center";
      ghost.setAttribute("aria-hidden", "true");
      document.body.appendChild(ghost);

      widgetDragState.active = true;
      widgetDragState.pointerId = event.pointerId;
      widgetDragState.sourceWidgetId = sourceWidgetId;
      widgetDragState.sourceWidget = shell;
      widgetDragState.sourceRect = rect;
      widgetDragState.pointerOffsetX = event.clientX - rect.left;
      widgetDragState.pointerOffsetY = event.clientY - rect.top;
      widgetDragState.ghost = ghost;
      widgetDragState.dropTargetWidgetId = null;
      widgetDragState.dropIndex = null;
      document.body.classList.add("dnd-active");
      event.preventDefault();
    },

    onWidgetPointerMove(event) {
      const widgetMap = this.getWidgetMap();
      if (!widgetMap) return;
      if (!widgetDragState.active || event.pointerId !== widgetDragState.pointerId || !widgetDragState.ghost) return;
      if (event.pointerType === "touch") {
        event.preventDefault();
      }

      const rect = widgetDragState.sourceRect;
      if (!rect) return;

      const dx = event.clientX - widgetDragState.pointerOffsetX - rect.left;
      const dy = event.clientY - widgetDragState.pointerOffsetY - rect.top;
      widgetDragState.ghost.style.transform = `translate(${dx}px, ${dy}px)`;

      const pointerX = event.clientX;
      const pointerY = event.clientY;
      let target = null;
      let dropIndex = null;
      let targetBefore = true;
      const widgets = Array.from(widgetMap.querySelectorAll(".dash-widget"));

      for (const widget of widgets) {
        if (widget === widgetDragState.sourceWidget) continue;
        const bounds = widget.getBoundingClientRect();
        if (
          pointerX >= bounds.left &&
          pointerX <= bounds.right &&
          pointerY >= bounds.top &&
          pointerY <= bounds.bottom
        ) {
          target = widget;
          const targetRect = bounds;
          const midpoint = targetRect.top + targetRect.height / 2;
          targetBefore = pointerY < midpoint;
          const targetIndex = widgets.indexOf(widget);
          dropIndex = targetBefore ? targetIndex : targetIndex + 1;
          break;
        }
      }

      for (const widget of widgets) {
        widget.classList.toggle("dnd-over", widget === target);
      }

      widgetDragState.dropTargetWidgetId = target?.dataset.widgetId || null;
      widgetDragState.dropIndex = dropIndex;
    },

    onWidgetPointerUp(event) {
      if (!widgetDragState.active || event.pointerId !== widgetDragState.pointerId) return;

      const sourceWidgetId = widgetDragState.sourceWidgetId;
      const targetWidgetId = widgetDragState.dropTargetWidgetId;
      const requestedIndex = widgetDragState.dropIndex;

      let committed = false;
      if (targetWidgetId && sourceWidgetId && sourceWidgetId !== targetWidgetId && Number.isFinite(requestedIndex)) {
        const nextOrder = this.widgets.slice();
        const fromIndex = nextOrder.findIndex((widget) => widget.id === sourceWidgetId);
        const targetBaseIndex = requestedIndex > nextOrder.length ? nextOrder.length : requestedIndex;
        if (fromIndex >= 0) {
          const [moved] = nextOrder.splice(fromIndex, 1);
          let insertAt = targetBaseIndex;
          if (fromIndex < insertAt) {
            insertAt -= 1;
          }
          if (insertAt < 0) insertAt = 0;
          if (insertAt > nextOrder.length) insertAt = nextOrder.length;
          nextOrder.splice(insertAt, 0, moved);
          if (JSON.stringify(nextOrder) !== JSON.stringify(this.widgets)) {
            this.widgets = nextOrder;
            this.persistWidgets();
            this.renderWidgets();
            committed = true;
          }
        }
      }

      this.onWidgetDragEnd(committed, !committed);
      if (widgetDragState.sourceWidget && widgetDragState.sourceWidget instanceof Element) {
        widgetDragState.sourceWidget.focus();
      }
      if (committed) {
        event.preventDefault();
      }
    },

    onWidgetPointerCancel() {
      this.onWidgetDragEnd(false, true);
    },

    onWidgetLostPointerCapture() {
      if (!widgetDragState.active) return;
      this.onWidgetDragEnd(false, true);
    },

    onWidgetDragEnd(committed = false, shouldSnapBack = false) {
      const widgetMap = this.getWidgetMap();
      const ghost = widgetDragState.ghost;
      if (!ghost) {
        widgetDragState.active = false;
        widgetDragState.pointerId = null;
        widgetDragState.sourceWidgetId = null;
        widgetDragState.sourceWidget = null;
        widgetDragState.sourceRect = null;
        widgetDragState.pointerOffsetX = 0;
        widgetDragState.pointerOffsetY = 0;
        widgetDragState.dropTargetWidgetId = null;
        widgetDragState.dropIndex = null;
        document.body.classList.remove("dnd-active");
        if (widgetMap) {
          Array.from(widgetMap.querySelectorAll(".dash-widget")).forEach((widget) => widget.classList.remove("dnd-over"));
        }
        return;
      }

      const cleanupGhost = () => {
        if (ghost.isConnected) ghost.remove();
      };

      if (shouldSnapBack && !committed) {
        const onSnapEnd = () => {
          ghost.removeEventListener("transitionend", onSnapEnd);
          cleanupGhost();
        };
        ghost.style.transition = "transform 220ms ease-out";
        ghost.style.transform = "translate(0px, 0px)";
        ghost.addEventListener("transitionend", onSnapEnd);
        setTimeout(onSnapEnd, 250);
      } else {
        cleanupGhost();
      }

      widgetDragState.active = false;
      widgetDragState.pointerId = null;
      widgetDragState.sourceWidgetId = null;
      widgetDragState.sourceWidget = null;
      widgetDragState.sourceRect = null;
      widgetDragState.pointerOffsetX = 0;
      widgetDragState.pointerOffsetY = 0;
      widgetDragState.ghost = null;
      widgetDragState.dropTargetWidgetId = null;
      widgetDragState.dropIndex = null;
      document.body.classList.remove("dnd-active");
      if (widgetMap) {
        Array.from(widgetMap.querySelectorAll(".dash-widget")).forEach((widget) => widget.classList.remove("dnd-over"));
      }
    },

    toggleEditMode() {
      this.editMode = !this.editMode;
      document.body.classList.toggle("edit-mode", this.editMode);
      this.renderWidgets();
    },

    addWidget(type) {
      if (!this.editMode) return;
      if (!widgetTypeSet.has(type)) return;
      const nextPosition = this.widgets.length;
      const next = {
        id: makeWidgetId(type),
        type,
        position: nextPosition,
        visible: true,
        title: "",
        minWidth: 250,
        minHeight: 178,
        width: null,
        height: null,
      };
      if (type === "notes") next.notesState = defaultNotesState();
      if (type === "todo") next.todoState = defaultTodoState();
      this.widgets = migrateLegacyIfNeeded([...this.widgets, next]);
      this.persistWidgets();
      this.renderWidgets();
      this.addWidgetOpen = false;
    },

    removeWidget(widgetId) {
      if (!this.editMode) return;
      this.widgets = this.widgets.filter((item) => item.id !== widgetId);
      this.persistWidgets();
      this.renderWidgets();
    },

    destroy() {
      if (this._clockTicker) {
        window.clearInterval(this._clockTicker);
        this._clockTicker = null;
      }
      this._disarmTodoResetTicker();
      if (this._onlineHandler) {
        window.removeEventListener("online", this._onlineHandler);
      }
      if (this._offlineHandler) {
        window.removeEventListener("offline", this._offlineHandler);
      }
      if (this._visibilityHandler) {
        document.removeEventListener("visibilitychange", this._visibilityHandler);
      }
    },
  };
  });
});
