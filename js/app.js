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

const widgetLabels = {
  clock: "Clock",
  notes: "Notes",
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
  const widgetMap = document.getElementById("widget-grid");
  let dragFromId = null;
  let clockTimer = null;

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
    _todoResetTicker: null,

    init() {
      window.addEventListener("online", () => {
        this.online = true;
      });
      window.addEventListener("offline", () => {
        this.online = false;
      });
      this.refreshClock();
      this.widgets = loadWidgets();
      this.handleVisibility = () => {
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
      document.addEventListener("visibilitychange", this.handleVisibility);
      this.renderWidgets();
      this.persistWidgets();
      if (clockTimer) window.clearInterval(clockTimer);
      clockTimer = window.setInterval(() => this.refreshClock(), 1000);
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
        shell.draggable = this.editMode;

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
          shell.addEventListener("dragstart", this.onDragStart.bind(this, config.id));
          shell.addEventListener("dragover", this.onDragOver.bind(this));
          shell.addEventListener("drop", this.onDrop.bind(this, config.id));
          shell.addEventListener("dragend", this.onDragEnd.bind(this));
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

    onDragStart(id, event) {
      dragFromId = id;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
      event.currentTarget.classList.add("opacity-70");
    },

    onDragOver(event) {
      if (!this.editMode) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },

    onDrop(targetId, event) {
      event.preventDefault();
      if (!this.editMode) return;
      const fromId = event.dataTransfer.getData("text/plain") || dragFromId;
      if (!fromId || fromId === targetId) return;
      const nextOrder = this.widgets.slice();
      const fromIndex = nextOrder.findIndex((widget) => widget.id === fromId);
      const targetIndex = nextOrder.findIndex((widget) => widget.id === targetId);
      if (fromIndex < 0 || targetIndex < 0) return;
      const [moved] = nextOrder.splice(fromIndex, 1);
      nextOrder.splice(targetIndex, 0, moved);
      this.widgets = nextOrder;
      this.persistWidgets();
      this.renderWidgets();
    },

    onDragEnd(event) {
      event.currentTarget.classList.remove("opacity-70");
      dragFromId = null;
    },

    toggleEditMode() {
      this.editMode = !this.editMode;
      document.body.classList.toggle("edit-mode", this.editMode);
      this.renderWidgets();
    },

    addWidget(type) {
      if (!this.editMode) return;
      const validTypes = ["clock", "notes", "todo"];
      if (!validTypes.includes(type)) return;
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
  };
  });
});
