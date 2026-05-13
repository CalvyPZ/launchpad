function renderClock(target) {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  target.querySelector(".widget-clock-time").textContent = time;
  target.querySelector(".widget-clock-date").textContent = date;
}

export function render(container, _context) {
  container.className = "h-full";
  container.innerHTML = `
    <p class="clock-time widget-clock-time"></p>
    <p class="widget-clock-date text-text-2 mt-1"></p>
    <p class="text-xs text-text-3 mt-2">
      Your focus signal. Keep this visible for quick context switching.
    </p>
  `;

  renderClock(container);
  let timer = window.setInterval(() => renderClock(container), 1000);

  return {
    destroy() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    },
  };
}
