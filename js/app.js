import {
  loadWidgets,
  saveWidgets,
  loadToolsWidgets,
  saveToolsWidgets,
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
import * as placeholderWidget from "./widgets/placeholder.js";

const widgetTypes = ["clock", "notes", "todo"];
const widgetFactories = {
  clock: clockWidget.render,
  notes: notesWidget.render,
  todo: todoWidget.render,
};
const widgetTypeSet = new Set(widgetTypes);
const addWidgetChoices = [
  { type: "clock", label: "Clock", icon: "🕐" },
  { type: "notes", label: "Sticky Notes", icon: "📝" },
  { type: "todo", label: "To-Do", icon: "✅" },
];

const toolsWidgetTypes = ["placeholder"];
const toolsWidgetFactories = {
  placeholder: placeholderWidget.render,
};
const toolsWidgetTypeSet = new Set(toolsWidgetTypes);
const toolsAddWidgetChoices = [{ type: "placeholder", label: "Placeholder", icon: "◇" }];

const widgetLabels = {
  clock: "Clock",
  notes: "Sticky Notes",
  todo: "To-Do",
  placeholder: "Placeholder",
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
  const toolsControllers = new Map();
  const toolsResizeObservers = new Map();
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
      gridEl: null,
      pointerMoveHandler: null,
    };
  const format = nowClockText();

  return {
    siteTitle: loadSiteTitle(),
    clockTime: format.clockTime,
    clockDate: format.date,
    editMode: false,
    addWidgetOpen: false,
    addWidgetChoices,
    addWidgetPickerIndex: -1,
    widgets: [],
    toolsWidgets: [],
    currentPage: "home",
    clockTitle: "",
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    widgetMapEl: null,
    toolsGridEl: null,
    _pendingWidgetFocusId: null,
    _pendingWidgetFocusPage: "home",
    _todoResetTicker: null,
    _clockTicker: null,
    _onlineHandler: null,
    _offlineHandler: null,
    _visibilityHandler: null,

    navigateTo(page) {
      const next = page === "tools" ? "tools" : "home";
      this.currentPage = next;
      this.closeAddWidgetPicker(false);
    },

    persistToolsWidgets() {
      saveToolsWidgets(this.toolsWidgets);
    },

    init() {
      this.widgetMapEl = this.$refs?.widgetGrid || document.getElementById("widget-grid");
      this.toolsGridEl = this.$refs?.toolsGrid || document.getElementById("tools-grid");
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
      this.toolsWidgets = loadToolsWidgets();
      this._visibilityHandler = () => {
        if (document.visibilityState === "visible") {
          let changed = false;
          if (evaluateAllTodoResets(this.widgets)) changed = true;
          if (evaluateAllTodoResets(this.toolsWidgets)) changed = true;
          if (changed) {
            this.persistWidgets();
            this.persistToolsWidgets();
            this.renderPageWidgets("home");
            this.renderPageWidgets("tools");
          }
          this._armTodoResetTicker();
        } else {
          this._disarmTodoResetTicker();
        }
      };
      document.addEventListener("visibilitychange", this._visibilityHandler);
      this.renderPageWidgets("home");
      this.renderPageWidgets("tools");
      this.persistWidgets();
      this.persistToolsWidgets();
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
        let any = false;
        if (evaluateAllTodoResets(this.widgets)) {
          this.persistWidgets();
          any = true;
        }
        if (evaluateAllTodoResets(this.toolsWidgets)) {
          this.persistToolsWidgets();
          any = true;
        }
        if (any) {
          this.renderPageWidgets("home");
          this.renderPageWidgets("tools");
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

    normalizeToolsWidgets() {
      this.toolsWidgets = this.toolsWidgets
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((widget, index) => ({ ...widget, position: index }));
    },

    renderPageWidgets(pageKey) {
      const isHome = pageKey === "home";
      const widgetMap = isHome
        ? this.widgetMapEl || document.getElementById("widget-grid")
        : this.toolsGridEl || document.getElementById("tools-grid");
      if (!widgetMap) return;

      const ctrls = isHome ? controllers : toolsControllers;
      const ros = isHome ? resizeObservers : toolsResizeObservers;
      const factories = isHome ? widgetFactories : toolsWidgetFactories;

      if (isHome) this.normalizeWidgets();
      else this.normalizeToolsWidgets();

      const widgetsList = isHome ? this.widgets : this.toolsWidgets;

      widgetMap.classList.add("widget-enter");
      widgetMap.innerHTML = "";
      ctrls.forEach((instance) => {
        if (instance?.destroy) instance.destroy();
      });
      ctrls.clear();
      ros.forEach((ro) => ro.disconnect());
      ros.clear();

      for (const config of widgetsList) {
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
            const list = isHome ? this.widgets : this.toolsWidgets;
            const idx = list.findIndex((w) => w.id === config.id);
            if (idx < 0) return;
            list[idx].title = titleInput.value.trim();
            if (isHome) this.persistWidgets();
            else this.persistToolsWidgets();
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
        removeBtn.addEventListener("click", () => this.removeWidget(config.id, pageKey));
        shell.appendChild(removeBtn);

        const dragHandle = document.createElement("button");
        dragHandle.className = "widget-handle";
        dragHandle.textContent = "⠿";
        dragHandle.style.display = this.editMode ? "grid" : "none";
        dragHandle.title = "Drag to move";
        dragHandle.type = "button";
        dragHandle.setAttribute("aria-label", `Reorder ${widgetDisplayName(config)} widget`);
        dragHandle.tabIndex = 0;
        shell.appendChild(dragHandle);

        if (this.editMode) {
          dragHandle.addEventListener("pointerdown", this.onWidgetPointerDown.bind(this), { passive: false });
          dragHandle.addEventListener("pointerup", this.onWidgetPointerUp.bind(this));
          dragHandle.addEventListener("pointercancel", this.onWidgetPointerCancel.bind(this));
          dragHandle.addEventListener("lostpointercapture", this.onWidgetLostPointerCapture.bind(this));
          dragHandle.addEventListener("keydown", this.onWidgetHandleKeydown.bind(this));
        }

        const widgetRenderer = factories[config.type];
        let moduleNode = null;
        if (widgetRenderer) {
          moduleNode = shell.querySelector(".widget-content");
          const instance = widgetRenderer(moduleNode, {
            editMode: this.editMode,
            config,
            dashboard: this,
            online: this.online,
          });
          if (instance) ctrls.set(config.id, instance);
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
              const list = isHome ? this.widgets : this.toolsWidgets;
              const idx = list.findIndex((item) => item.id === config.id);
              if (idx < 0) return;
              const prev = list[idx];
              if (prev.width === w && prev.height === h) return;
              list[idx].width = w;
              list[idx].height = h;
              list[idx].minWidth = minW;
              list[idx].minHeight = minH;
              if (isHome) this.persistWidgets();
              else this.persistToolsWidgets();
            }, 280);
          });
          ro.observe(moduleNode);
          ros.set(config.id, ro);
        }
      }

      if (this._pendingWidgetFocusId && this._pendingWidgetFocusPage === pageKey) {
        const focusHandle = widgetMap.querySelector(
          `.dash-widget[data-widget-id="${this._pendingWidgetFocusId}"] .widget-handle`
        );
        if (focusHandle instanceof HTMLElement) {
          focusHandle.focus();
        }
        this._pendingWidgetFocusId = null;
      }
    },

    /** Rebuild both grids — used by widgets (e.g. To-Do) that expect `dashboard.renderWidgets()`. */
    renderWidgets() {
      this.renderPageWidgets("home");
      this.renderPageWidgets("tools");
    },

    onWidgetPointerDown(event) {
      if (!this.editMode) return;
      if (!event?.currentTarget || !event.target) return;
      const handle = event.currentTarget;
      const shell = handle.closest(".dash-widget");
      if (!(shell instanceof HTMLElement)) return;
      const widgetMap =
        shell.closest("#widget-grid") || shell.closest("#tools-grid");
      if (!(widgetMap instanceof HTMLElement)) return;
      const sourceWidgetId = shell.dataset.widgetId;
      if (!sourceWidgetId) return;
      if (typeof handle.setPointerCapture === "function") {
        handle.setPointerCapture(event.pointerId);
      }
      widgetDragState.pointerMoveHandler = this.onWidgetPointerMove.bind(this);
      document.addEventListener("pointermove", widgetDragState.pointerMoveHandler, { passive: false });

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
      widgetDragState.gridEl = widgetMap;
      document.body.classList.add("dnd-active");
      event.preventDefault();
    },

    getAddWidgetPickerOptions() {
      if (this.currentPage === "tools") return toolsAddWidgetChoices;
      return this.addWidgetChoices || [];
    },

    get addWidgetActiveOptionId() {
      const options = this.getAddWidgetPickerOptions();
      if (this.addWidgetPickerIndex < 0) return null;
      const active = options[this.addWidgetPickerIndex];
      if (!active || !active.type) return null;
      return `add-widget-option-${active.type}`;
    },

    openAddWidgetPicker() {
      if (!this.editMode) return;
      const options = this.getAddWidgetPickerOptions();
      if (!options.length) return;
      this.addWidgetOpen = true;
      this.addWidgetPickerIndex = 0;
      this.$nextTick(() => this.focusAddWidgetOption(this.addWidgetPickerIndex));
    },

    closeAddWidgetPicker(returnFocus = true) {
      this.addWidgetOpen = false;
      this.addWidgetPickerIndex = -1;
      if (returnFocus && this.$refs?.addWidgetButton?.focus) {
        this.$refs.addWidgetButton.focus();
      }
    },

    toggleAddWidgetPicker() {
      if (!this.editMode) return;
      if (this.addWidgetOpen) {
        this.closeAddWidgetPicker(true);
        return;
      }
      this.openAddWidgetPicker();
    },

    handleAddWidgetTriggerKeydown(event) {
      if (!this.editMode) return;
      const key = event.key;
      if (key === "ArrowDown" || key === "ArrowRight") {
        event.preventDefault();
        this.openAddWidgetPicker();
        return;
      }
      if (key === "ArrowUp" || key === "ArrowLeft") {
        event.preventDefault();
        const options = this.getAddWidgetPickerOptions();
        this.addWidgetOpen = true;
        this.addWidgetPickerIndex = options.length ? options.length - 1 : -1;
        this.$nextTick(() => this.focusAddWidgetOption(this.addWidgetPickerIndex));
        return;
      }
      if (key === "Enter" || key === " " || key === "Space") {
        event.preventDefault();
        this.toggleAddWidgetPicker();
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        this.closeAddWidgetPicker(true);
      }
    },

    handleAddWidgetOptionKeydown(event) {
      if (!this.addWidgetOpen) return;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        this.focusNextAddWidgetOption(1);
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        this.focusNextAddWidgetOption(-1);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        this.focusAddWidgetOption(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        const total = this.getAddWidgetPickerOptions().length;
        this.focusAddWidgetOption(total - 1);
        return;
      }
      if (event.key === "Enter" || event.key === " " || event.key === "Space") {
        event.preventDefault();
        this.activateAddWidgetOption(this.addWidgetPickerIndex);
        return;
      }
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        this.closeAddWidgetPicker(true);
      }
    },

    focusAddWidgetOption(index) {
      const options = this.getAddWidgetPickerOptions();
      if (!options.length) return;
      const pickerRefs = this.$refs?.addWidgetOption;
      if (!pickerRefs) return;
      const total = options.length;
      const normalizedIndex = ((index % total) + total) % total;
      const optionList = Array.isArray(pickerRefs) ? pickerRefs : [pickerRefs];
      const optionEl = optionList[normalizedIndex];
      if (optionEl instanceof HTMLElement) {
        optionEl.focus();
        this.addWidgetPickerIndex = normalizedIndex;
      }
    },

    focusNextAddWidgetOption(delta) {
      if (!this.getAddWidgetPickerOptions().length) return;
      const current = this.addWidgetPickerIndex >= 0 ? this.addWidgetPickerIndex : 0;
      this.focusAddWidgetOption(current + delta);
    },

    activateAddWidgetOption(index) {
      const options = this.getAddWidgetPickerOptions();
      const selectedIndex = Number.isInteger(index) ? index : this.addWidgetPickerIndex;
      if (!Number.isInteger(selectedIndex)) return;
      const selected = options[selectedIndex];
      if (!selected) return;
      this.addWidget(selected.type, false);
      this.closeAddWidgetPicker(true);
      this.addWidgetPickerIndex = selectedIndex;
    },

    onWidgetHandleKeydown(event) {
      if (!this.editMode) return;
      const handle = event.currentTarget;
      if (!(handle instanceof HTMLElement)) return;
      const shell = handle.closest(".dash-widget");
      if (!(shell instanceof HTMLElement)) return;
      const widgetMap =
        shell.closest("#widget-grid") || shell.closest("#tools-grid");
      if (!(widgetMap instanceof HTMLElement)) return;
      const pageKey = widgetMap.id === "tools-grid" ? "tools" : "home";
      const list = pageKey === "tools" ? this.toolsWidgets : this.widgets;
      const sourceId = shell.dataset.widgetId;
      if (!sourceId) return;
      const currentIndex = list.findIndex((widget) => widget.id === sourceId);
      if (currentIndex < 0) return;

      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowLeft" ||
        event.key === "PageUp"
      ) {
        event.preventDefault();
        this.moveWidgetByIndex(sourceId, currentIndex - 1, pageKey);
        return;
      }
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowRight" ||
        event.key === "PageDown"
      ) {
        event.preventDefault();
        this.moveWidgetByIndex(sourceId, currentIndex + 1, pageKey);
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        this.moveWidgetByIndex(sourceId, 0, pageKey);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        this.moveWidgetByIndex(sourceId, list.length - 1, pageKey);
      }
    },

    moveWidgetByIndex(sourceId, targetIndex, pageKey) {
      const list = pageKey === "tools" ? this.toolsWidgets : this.widgets;
      const sourceIndex = list.findIndex((widget) => widget.id === sourceId);
      if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= list.length) return;
      if (sourceIndex === targetIndex) return;
      const nextOrder = list.slice();
      const [moved] = nextOrder.splice(sourceIndex, 1);
      const insertAt = targetIndex < sourceIndex ? targetIndex : targetIndex;
      nextOrder.splice(insertAt, 0, moved);
      if (pageKey === "tools") {
        this.toolsWidgets = nextOrder;
        this.persistToolsWidgets();
        this.renderPageWidgets("tools");
      } else {
        this.widgets = nextOrder;
        this.persistWidgets();
        this.renderPageWidgets("home");
      }
      this._pendingWidgetFocusId = sourceId;
      this._pendingWidgetFocusPage = pageKey;
    },

    onWidgetPointerMove(event) {
      event.preventDefault();
      const widgetMap = widgetDragState.gridEl;
      if (!widgetMap) return;
      if (!widgetDragState.active || event.pointerId !== widgetDragState.pointerId || !widgetDragState.ghost) return;

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
      if (widgetDragState.pointerMoveHandler) {
        document.removeEventListener("pointermove", widgetDragState.pointerMoveHandler);
        widgetDragState.pointerMoveHandler = null;
      }
      if (!widgetDragState.active || event.pointerId !== widgetDragState.pointerId) return;

      const sourceWidgetId = widgetDragState.sourceWidgetId;
      const targetWidgetId = widgetDragState.dropTargetWidgetId;
      const requestedIndex = widgetDragState.dropIndex;
      const gridEl = widgetDragState.gridEl;
      const isTools = gridEl?.id === "tools-grid";

      let committed = false;
      if (targetWidgetId && sourceWidgetId && sourceWidgetId !== targetWidgetId && Number.isFinite(requestedIndex)) {
        const list = isTools ? this.toolsWidgets : this.widgets;
        const nextOrder = list.slice();
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
          const prevOrder = isTools ? this.toolsWidgets : this.widgets;
          if (JSON.stringify(nextOrder) !== JSON.stringify(prevOrder)) {
            if (isTools) {
              this.toolsWidgets = nextOrder;
              this.persistToolsWidgets();
              this.renderPageWidgets("tools");
            } else {
              this.widgets = nextOrder;
              this.persistWidgets();
              this.renderPageWidgets("home");
            }
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
      if (widgetDragState.pointerMoveHandler) {
        document.removeEventListener("pointermove", widgetDragState.pointerMoveHandler);
        widgetDragState.pointerMoveHandler = null;
      }
      this.onWidgetDragEnd(false, true);
    },

    onWidgetLostPointerCapture() {
      if (widgetDragState.pointerMoveHandler) {
        document.removeEventListener("pointermove", widgetDragState.pointerMoveHandler);
        widgetDragState.pointerMoveHandler = null;
      }
      if (!widgetDragState.active) return;
      this.onWidgetDragEnd(false, true);
    },

    onWidgetDragEnd(committed = false, shouldSnapBack = false) {
      const widgetMap = widgetDragState.gridEl;
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
        widgetDragState.gridEl = null;
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
      widgetDragState.gridEl = null;
      document.body.classList.remove("dnd-active");
      if (widgetMap) {
        Array.from(widgetMap.querySelectorAll(".dash-widget")).forEach((widget) => widget.classList.remove("dnd-over"));
      }
      if (widgetDragState.pointerMoveHandler) {
        document.removeEventListener("pointermove", widgetDragState.pointerMoveHandler);
        widgetDragState.pointerMoveHandler = null;
      }
    },

    toggleEditMode() {
      this.editMode = !this.editMode;
      document.body.classList.toggle("edit-mode", this.editMode);
      this.renderPageWidgets("home");
      this.renderPageWidgets("tools");
    },

    addWidget(type, returnFocus = true) {
      if (!this.editMode) return;
      if (this.currentPage === "tools") {
        if (!toolsWidgetTypeSet.has(type)) return;
        const nextPosition = this.toolsWidgets.length;
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
        this.toolsWidgets = [...this.toolsWidgets, next];
        this.persistToolsWidgets();
        this.renderPageWidgets("tools");
      } else {
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
        this.renderPageWidgets("home");
      }
      this.addWidgetOpen = false;
      this.addWidgetPickerIndex = -1;
      if (returnFocus && this.$refs?.addWidgetButton?.focus) {
        this.$refs.addWidgetButton.focus();
      }
    },

    removeWidget(widgetId, pageKey) {
      if (!this.editMode) return;
      let resolved = pageKey;
      if (resolved !== "home" && resolved !== "tools") {
        if (this.widgets.some((item) => item.id === widgetId)) resolved = "home";
        else if (this.toolsWidgets.some((item) => item.id === widgetId)) resolved = "tools";
        else return;
      }
      if (resolved === "home") {
        this.widgets = this.widgets.filter((item) => item.id !== widgetId);
        this.persistWidgets();
        this.renderPageWidgets("home");
      } else {
        this.toolsWidgets = this.toolsWidgets.filter((item) => item.id !== widgetId);
        this.persistToolsWidgets();
        this.renderPageWidgets("tools");
      }
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
