/**
 * Empty placeholder for the Tools page — content TBD.
 * @param {HTMLElement} container
 * @param {{ editMode?: boolean, config?: object, dashboard?: object, online?: boolean }} _ctx
 * @returns {{ destroy: () => void }}
 */
export function render(container, _ctx) {
  container.className = "h-full flex items-center justify-center min-h-[8rem]";
  container.innerHTML = `
    <div class="text-center px-4 py-8 max-w-sm">
      <p class="text-text-2 text-sm leading-relaxed">Placeholder</p>
      <p class="text-text-3 text-xs mt-2">More tools will appear here later.</p>
    </div>
  `;

  return {
    destroy() {},
  };
}
