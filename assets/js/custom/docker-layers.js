// ==========================================
// docker-layers.js - Composant Visualiseur de Couches Docker
// ==========================================

/**
 * Renders an interactive Docker Layer Stack visualization into a target container.
 *
 * @param {string|HTMLElement} container - CSS selector or target DOM element
 * @param {Object} config - Configuration object
 * @param {Array<Object>} config.layers - List of image layers (top-to-bottom or base-to-top)
 * @param {boolean} [config.showContainerLayer=false] - Whether to display top Read-Write container layer
 * @param {Object} [config.containerLayer] - Read-Write container layer info
 */
export function renderDockerLayers(container, config = {}) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) {
    console.warn("renderDockerLayers: Target container not found.", container);
    return;
  }

  targetEl.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "docker-layer-stack";

  const { layers = [], showContainerLayer = false, containerLayer = null } = config;

  // 1. Render Read-Write container layer if requested
  if (showContainerLayer || containerLayer) {
    const cLayer = containerLayer || {
      title: "Couche Conteneur (Read-Write / Éphémère)",
      desc: "Toutes les modifications, créations de fichiers et suppressions temporaires de cette session de conteneur.",
      size: "< 1 MB (modifications à la volée)",
      status: "read-write"
    };

    const containerLayerEl = document.createElement("div");
    containerLayerEl.className = "docker-layer docker-layer-writable";
    containerLayerEl.setAttribute("data-status", "read-write");

    containerLayerEl.innerHTML = `
      <div class="docker-layer-header">
        <div class="docker-layer-meta">
          <span class="docker-layer-badge badge-rw">
            <i class="bi bi-pencil-fill"></i> Read-Write (Éphémère)
          </span>
          <span class="docker-layer-title">${cLayer.title}</span>
        </div>
        <span class="docker-layer-size">${cLayer.size}</span>
      </div>
      <div class="docker-layer-body">
        <p class="docker-layer-desc">${cLayer.desc}</p>
        <span class="docker-layer-subtext"><i class="bi bi-exclamation-triangle-fill"></i> Effacée lors du <code>docker rm</code></span>
      </div>
    `;

    wrapper.appendChild(containerLayerEl);
  }

  // 2. Render Divider arrow if container layer is visible
  if (showContainerLayer || containerLayer) {
    const divider = document.createElement("div");
    divider.className = "docker-stack-divider";
    divider.innerHTML = `
      <span class="divider-line"></span>
      <span class="divider-badge"><i class="bi bi-lock-fill"></i> Couches d'Image Immuables (Read-Only)</span>
      <span class="divider-line"></span>
    `;
    wrapper.appendChild(divider);
  }

  // 3. Render Image Layers List
  const listEl = document.createElement("div");
  listEl.className = "docker-layers-list";

  layers.forEach((layer, idx) => {
    const layerEl = document.createElement("div");
    layerEl.className = "docker-layer docker-layer-readonly";
    layerEl.setAttribute("data-status", layer.status || "read-only");
    layerEl.setAttribute("data-layer-type", layer.type || "cmd");

    const stepLabel = layer.step !== undefined ? `Couche ${layer.step}` : `#${layers.length - idx}`;
    const hash = layer.hash || `sha256:${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 6)}`;
    const cmdType = (layer.type || "CMD").toUpperCase();

    layerEl.innerHTML = `
      <div class="docker-layer-header">
        <div class="docker-layer-cmd-group">
          <span class="docker-step-tag">${stepLabel}</span>
          <span class="docker-cmd-tag cmd-${layer.type || "cmd"}">${cmdType}</span>
          <code class="docker-cmd-code">${layer.command}</code>
        </div>
        <div class="docker-layer-stats">
          <span class="docker-layer-badge badge-ro"><i class="bi bi-shield-lock-fill"></i> Read-Only</span>
          <span class="docker-layer-size">${layer.size}</span>
        </div>
      </div>
      <div class="docker-layer-body">
        <p class="docker-layer-desc">${layer.desc}</p>
        <div class="docker-layer-footer">
          <span class="docker-hash-tag"><i class="bi bi-hash"></i> ${hash}</span>
        </div>
      </div>
    `;

    // Interactive expansion on click
    layerEl.addEventListener("click", () => {
      layerEl.classList.toggle("is-expanded");
    });

    listEl.appendChild(layerEl);
  });

  wrapper.appendChild(listEl);
  targetEl.appendChild(wrapper);
}
