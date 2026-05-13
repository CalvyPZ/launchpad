const POLL_INTERVAL_MS = 10000;

function formatUptime(uptimeSeconds) {
  const total = Number.isFinite(Number(uptimeSeconds)) ? Number(uptimeSeconds) : 0;
  const totalHours = Math.floor(total / 3600);
  const totalMinutes = Math.floor((total % 3600) / 60);
  return `${totalHours}h ${totalMinutes}m`;
}

function formatMb(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return `${Math.round(parsed)} MB`;
}

function renderSkeleton(container) {
  container.innerHTML = `
    <div class="widget-title">System</div>
    <div class="mt-1 text-xs text-text-3">Loading system metrics...</div>
    <div class="sysinfo-grid">
      <div class="sysinfo-skeleton w-3/5"></div>
      <div class="sysinfo-skeleton w-1/2"></div>
      <div class="sysinfo-skeleton w-4/5"></div>
    </div>
  `;
}

function renderError(container, dashboard) {
  const statusText = dashboard?.message
    ? `Unavailable (${dashboard.message})`
    : "Unavailable";
  container.innerHTML = `
    <div class="widget-title">System</div>
    <p class="text-text-1 font-medium">Unavailable</p>
    <p class="text-xs text-text-3">${statusText}</p>
    <button type="button" class="btn-soft text-xs px-2 py-1 mt-3" data-sysinfo-retry>
      Retry
    </button>
  `;
}

function renderLoaded(container, payload) {
  const uptime = formatUptime(payload?.uptime);
  const nodeVersion = payload?.node || "Unknown";
  const heapUsed = formatMb(payload?.memory?.heapUsed);
  const heapTotal = formatMb(payload?.memory?.heapTotal);
  const memoryText = heapUsed ? `${heapUsed}${heapTotal ? ` / ${heapTotal}` : ""}` : "Unavailable";

  container.innerHTML = `
    <div class="widget-title">System</div>
    <div class="sysinfo-live">
      <span class="sysinfo-live-dot"></span>
      <span>Live</span>
    </div>
    <div class="sysinfo-grid">
      <div class="sysinfo-stat">
        <p class="text-xs text-text-3">Uptime</p>
        <p class="text-text-1">${uptime}</p>
      </div>
      <div class="sysinfo-stat">
        <p class="text-xs text-text-3">Node version</p>
        <p class="text-text-1">${nodeVersion}</p>
      </div>
      <div class="sysinfo-stat">
        <p class="text-xs text-text-3">Heap used</p>
        <p class="text-text-1">${memoryText}</p>
      </div>
    </div>
  `;
}

async function fetchStatus(signal) {
  const response = await fetch("/api/system", {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json();
}

export function render(container) {
  container.className = "h-full";
  renderSkeleton(container);

  let disposed = false;
  let controller = null;
  let retryCleanup = null;
  let pollTimer = null;

  const load = async () => {
    if (disposed) return;
    if (controller) {
      controller.abort();
    }
    controller = new window.AbortController();
    const requestController = controller;

    try {
      const payload = await fetchStatus(requestController.signal);
      if (disposed || requestController.signal.aborted) return;
      renderLoaded(container, payload);
    } catch (error) {
      if (disposed || requestController.signal.aborted) return;
      renderError(container, error);
    } finally {
      const retryButton = container.querySelector("[data-sysinfo-retry]");
      if (retryCleanup) {
        retryCleanup();
      }
      if (retryButton) {
        const onRetry = () => {
          load();
        };
        retryButton.addEventListener("click", onRetry);
        retryCleanup = () => retryButton.removeEventListener("click", onRetry);
      }
    }
  };

  pollTimer = window.setInterval(load, POLL_INTERVAL_MS);
  load();

  return {
    destroy() {
      disposed = true;
      if (pollTimer) window.clearInterval(pollTimer);
      pollTimer = null;
      if (controller) {
        controller.abort();
        controller = null;
      }
      if (retryCleanup) {
        retryCleanup();
        retryCleanup = null;
      }
    },
  };
}
