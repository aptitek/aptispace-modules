/**
 * iconography.js - Composants interactifs pour le cours d'Iconographie
 * 
 * Ce fichier définit deux composants majeurs :
 * 1. createSvgInspector : Analyseur d'anatomie SVG (viewBox, fill, stroke, stroke-width)
 * 2. createTouchTargetVisualizer : Simulateur de zone de clic et accessibilité mobile
 */


function resolveElement(elementOrSelector) {
  return typeof elementOrSelector === "string"
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
}

// Définitions de tracés d'icônes Bootstrap standard répliqués pour l'exercice
const ICON_PATHS = {
  house: "M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L2 8.207V13.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V8.207l.646.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.707 1.5ZM13 7.207V13.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V7.207l5-5 5 5Z",
  search: "M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0",
  gear: "M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.86",
  trash: "M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"
};

const COLOR_MAP = {
  base: "var(--sol-base00)",
  primary: "var(--sol-blue)",
  success: "var(--sol-green)",
  warning: "var(--sol-orange)",
  danger: "var(--sol-red)"
};

/**
 * Crée l'inspecteur anatomique de SVG.
 */
export function createSvgInspector(target, options = {}, invalidation) {
  const container = resolveElement(target);
  if (!container) return null;

  container.innerHTML = "";

  const state = {
    iconName: options.iconName || "house",
    viewBoxWidth: options.viewBoxWidth || 16,
    viewBoxHeight: options.viewBoxHeight || 16,
    strokeWidth: options.strokeWidth || 1.5,
    fillColor: options.fillColor || "primary",
    strokeColor: options.strokeColor || "none"
  };

  // Création du wrapper
  const wrapper = document.createElement("div");
  wrapper.className = "svg-inspector-wrapper row";

  // Colonne des contrôles
  const ctrlCol = document.createElement("div");
  ctrlCol.className = "col span=5 col-stack";

  // Sélecteur d'icône
  const iconSelectorGroup = document.createElement("div");
  iconSelectorGroup.className = "control-group";
  iconSelectorGroup.innerHTML = `
    <label class="section-label">Sélection de l'icône</label>
    <select class="form-select select-icon-name">
      <option value="house">🏠 Accueil (House)</option>
      <option value="search">🔍 Recherche (Search)</option>
      <option value="gear">⚙️ Paramètres (Gear)</option>
      <option value="trash">🗑️ Supprimer (Trash)</option>
    </select>
  `;
  ctrlCol.appendChild(iconSelectorGroup);

  // Sliders viewBox
  const vboxGroup = document.createElement("div");
  vboxGroup.className = "control-group";
  vboxGroup.innerHTML = `
    <label class="section-label">Taille viewBox (Canevas interne)</label>
    <div class="slider-row mb-2">
      <span class="small text-muted">Largeur : <strong class="vbox-w-val">16</strong></span>
      <input type="range" class="form-range slider-vbox-w" min="8" max="64" step="1" value="${state.viewBoxWidth}">
    </div>
    <div class="slider-row">
      <span class="small text-muted">Hauteur : <strong class="vbox-h-val">16</strong></span>
      <input type="range" class="form-range slider-vbox-h" min="8" max="64" step="1" value="${state.viewBoxHeight}">
    </div>
  `;
  ctrlCol.appendChild(vboxGroup);

  // Sliders Tracé (Stroke Width)
  const strokeGroup = document.createElement("div");
  strokeGroup.className = "control-group";
  strokeGroup.innerHTML = `
    <label class="section-label">Contour (stroke-width)</label>
    <div class="slider-row">
      <span class="small text-muted">Épaisseur : <strong class="stroke-w-val">1.5px</strong></span>
      <input type="range" class="form-range slider-stroke-w" min="0.2" max="6" step="0.1" value="${state.strokeWidth}">
    </div>
  `;
  ctrlCol.appendChild(strokeGroup);

  // Sélecteurs de couleur
  const colorGroup = document.createElement("div");
  colorGroup.className = "control-group";
  colorGroup.innerHTML = `
    <label class="section-label">Couleurs de remplissage et contour</label>
    <div class="d-flex gap-3 mt-2">
      <div class="flex-grow-1">
        <span class="small text-muted">fill (Remplissage)</span>
        <select class="form-select select-fill">
          <option value="none">Aucun (none)</option>
          <option value="base" ${state.fillColor === "base" ? "selected" : ""}>Base (Gris)</option>
          <option value="primary" ${state.fillColor === "primary" ? "selected" : ""}>Primary (Bleu)</option>
          <option value="success" ${state.fillColor === "success" ? "selected" : ""}>Success (Vert)</option>
          <option value="warning" ${state.fillColor === "warning" ? "selected" : ""}>Warning (Orange)</option>
          <option value="danger" ${state.fillColor === "danger" ? "selected" : ""}>Danger (Rouge)</option>
        </select>
      </div>
      <div class="flex-grow-1">
        <span class="small text-muted">stroke (Contour)</span>
        <select class="form-select select-stroke">
          <option value="none" ${state.strokeColor === "none" ? "selected" : ""}>Aucun (none)</option>
          <option value="base" ${state.strokeColor === "base" ? "selected" : ""}>Base (Gris)</option>
          <option value="primary" ${state.strokeColor === "primary" ? "selected" : ""}>Primary (Bleu)</option>
          <option value="success" ${state.strokeColor === "success" ? "selected" : ""}>Success (Vert)</option>
          <option value="warning" ${state.strokeColor === "warning" ? "selected" : ""}>Warning (Orange)</option>
          <option value="danger" ${state.strokeColor === "danger" ? "selected" : ""}>Danger (Rouge)</option>
        </select>
      </div>
    </div>
  `;
  ctrlCol.appendChild(colorGroup);

  wrapper.appendChild(ctrlCol);

  // Colonne de prévisualisation et code
  const viewCol = document.createElement("div");
  viewCol.className = "col span=7 col-stack align-items-center justify-content-center";

  const previewFrame = document.createElement("div");
  previewFrame.className = "svg-preview-frame mb-3";
  viewCol.appendChild(previewFrame);

  const codeFrame = document.createElement("div");
  codeFrame.className = "svg-code-frame w-100";
  codeFrame.innerHTML = `
    <div class="code-header window-header">
      <div class="code-tabs">
        <div class="code-tab">
          <i class="bi bi-file-earmark-code code-tab-icon"></i>
          <span class="code-tab-title">Code SVG</span>
        </div>
      </div>
    </div>
    <pre class="window-dark rounded-bottom p-3 m-0"><code class="svg-code-display"></code></pre>
  `;
  viewCol.appendChild(codeFrame);

  wrapper.appendChild(viewCol);
  container.appendChild(wrapper);

  // Rendu de la preview
  const update = () => {
    const fillHex = state.fillColor === "none" ? "none" : COLOR_MAP[state.fillColor];
    const strokeHex = state.strokeColor === "none" ? "none" : COLOR_MAP[state.strokeColor];
    const dPath = ICON_PATHS[state.iconName] || "";

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${state.viewBoxWidth} ${state.viewBoxHeight}" fill="${fillHex}" stroke="${strokeHex}" stroke-width="${state.strokeWidth}">
  <path d="${dPath}" />
</svg>`;

    // Rendu graphique
    previewFrame.innerHTML = svgString;

    // Mise à jour de la grille de viewBox (repère pour comprendre)
    const svgEl = previewFrame.querySelector("svg");
    svgEl.style.setProperty("width", "180px");
    svgEl.style.setProperty("height", "180px");
    svgEl.style.setProperty("background", "var(--sol-base3)");
    svgEl.style.setProperty("border", "1px dashed var(--sol-base1)");
    svgEl.style.setProperty("padding", "10px");

    // Affichage du code
    const codeDisplay = codeFrame.querySelector(".svg-code-display");
    codeDisplay.textContent = `<svg viewBox="0 0 ${state.viewBoxWidth} ${state.viewBoxHeight}"\n     fill="${state.fillColor === "none" ? "none" : `var(--sol-${state.fillColor})`}"\n     stroke="${state.strokeColor === "none" ? "none" : `var(--sol-${state.strokeColor})`}"\n     stroke-width="${state.strokeWidth}">\n  <path d="${dPath.substring(0, 45)}..." />\n</svg>`;

    // Propagation de l'événement d'input réactif pour OJS
    container.value = { ...state };
    container.dispatchEvent(new Event("input", { bubbles: true }));
  };

  // Événements
  ctrlCol.querySelector(".select-icon-name").onchange = (e) => {
    state.iconName = e.target.value;
    update();
  };
  ctrlCol.querySelector(".slider-vbox-w").oninput = (e) => {
    state.viewBoxWidth = parseInt(e.target.value);
    ctrlCol.querySelector(".vbox-w-val").textContent = state.viewBoxWidth;
    update();
  };
  ctrlCol.querySelector(".slider-vbox-h").oninput = (e) => {
    state.viewBoxHeight = parseInt(e.target.value);
    ctrlCol.querySelector(".vbox-h-val").textContent = state.viewBoxHeight;
    update();
  };
  ctrlCol.querySelector(".slider-stroke-w").oninput = (e) => {
    state.strokeWidth = parseFloat(e.target.value);
    ctrlCol.querySelector(".stroke-w-val").textContent = `${state.strokeWidth}px`;
    update();
  };
  ctrlCol.querySelector(".select-fill").onchange = (e) => {
    state.fillColor = e.target.value;
    update();
  };
  ctrlCol.querySelector(".select-stroke").onchange = (e) => {
    state.strokeColor = e.target.value;
    update();
  };

  // Destruction
  const destroy = () => {
    container.innerHTML = "";
  };

  container.destroy = destroy;
  if (invalidation) {
    invalidation.then(destroy);
  }

  // Premier rendu
  update();

  return container;
}

/**
 * Crée le simulateur de Zone de Clic et d'Accessibilité (Touch Target).
 */
export function createTouchTargetVisualizer(target, options = {}, invalidation) {
  const container = resolveElement(target);
  if (!container) return null;

  container.innerHTML = "";

  const state = {
    iconSize: options.iconSize || 24,
    targetSize: options.targetSize || 32,
    showBoundingBox: options.showBoundingBox !== false,
    showTouchTarget: options.showTouchTarget !== false,
    iconName: options.iconName || "search"
  };

  // Wrapper principal
  const wrapper = document.createElement("div");
  wrapper.className = "touch-target-visualizer-wrapper row";

  // Colonne des contrôles
  const ctrlCol = document.createElement("div");
  ctrlCol.className = "col span=5 col-stack";

  // Sliders
  const sizingGroup = document.createElement("div");
  sizingGroup.className = "control-group";
  sizingGroup.innerHTML = `
    <label class="section-label">Dimensions de l'icône</label>
    <div class="slider-row mb-3">
      <span class="small text-muted">Taille de l'icône : <strong class="icon-size-val">24px</strong></span>
      <input type="range" class="form-range slider-icon-size" min="12" max="64" step="4" value="${state.iconSize}">
      <div class="d-flex justify-content-between text-muted px-1" style="font-size:0.7em;">
        <span>16px</span>
        <span>24px (Standard)</span>
        <span>32px</span>
        <span>64px</span>
      </div>
    </div>
    <div class="slider-row">
      <span class="small text-muted">Zone de clic effective (Bouton) : <strong class="target-size-val">32px</strong></span>
      <input type="range" class="form-range slider-target-size" min="20" max="80" step="2" value="${state.targetSize}">
      <div class="d-flex justify-content-between text-muted px-1" style="font-size:0.7em;">
        <span>24px</span>
        <span>44px (iOS min)</span>
        <span>48px (Android min)</span>
        <span>72px</span>
      </div>
    </div>
  `;
  ctrlCol.appendChild(sizingGroup);

  // Checkboxes
  const optionsGroup = document.createElement("div");
  optionsGroup.className = "control-group mt-2";
  optionsGroup.innerHTML = `
    <label class="section-label">Surimpressions d'aide</label>
    <div class="form-check mt-1">
      <input class="form-check-input check-bounding-box" type="checkbox" id="check-bb-${Math.random().toString(36).substr(2, 5)}" ${state.showBoundingBox ? "checked" : ""}>
      <label class="form-check-label small text-muted" for="check-bb">Afficher la boîte d'encombrement (Bounding Box)</label>
    </div>
    <div class="form-check mt-1">
      <input class="form-check-input check-touch-target" type="checkbox" id="check-tt-${Math.random().toString(36).substr(2, 5)}" ${state.showTouchTarget ? "checked" : ""}>
      <label class="form-check-label small text-muted" for="check-tt">Afficher la zone de clic (Touch Target Overlay)</label>
    </div>
  `;
  ctrlCol.appendChild(optionsGroup);

  wrapper.appendChild(ctrlCol);

  // Colonne de rendu visuel
  const viewCol = document.createElement("div");
  viewCol.className = "col span=7 col-stack align-items-center justify-content-center mt-3 mt-lg-0";

  const renderArea = document.createElement("div");
  renderArea.className = "touch-visualizer-render-area position-relative d-flex align-items-center justify-content-center";
  renderArea.style.setProperty("width", "200px");
  renderArea.style.setProperty("height", "200px");
  renderArea.style.setProperty("background", "var(--sol-base3)");
  renderArea.style.setProperty("border", "1px solid rgba(88, 110, 117, 0.12)");
  renderArea.style.setProperty("border-radius", "12px");
  viewCol.appendChild(renderArea);

  // Feedback d'accessibilité
  const feedbackBlock = document.createElement("div");
  feedbackBlock.className = "touch-feedback-block w-100 mt-3";
  viewCol.appendChild(feedbackBlock);

  wrapper.appendChild(viewCol);
  container.appendChild(wrapper);

  // Mettre à jour l'affichage
  const update = () => {
    renderArea.innerHTML = "";

    // Le bouton tactile (représente la zone de clic)
    const button = document.createElement("button");
    button.className = "btn-touch-target position-relative d-flex align-items-center justify-content-center border-0 p-0";
    button.style.setProperty("width", `${state.targetSize}px`);
    button.style.setProperty("height", `${state.targetSize}px`);
    button.style.setProperty("border-radius", "50%");
    button.style.setProperty("background", "var(--sol-base2)");
    button.style.setProperty("box-shadow", "0 2px 6px rgba(0,0,0,0.08)");
    button.style.setProperty("cursor", "pointer");

    // Icône à l'intérieur
    const dPath = ICON_PATHS[state.iconName] || "";
    const svgStr = `<svg viewBox="0 0 16 16" width="${state.iconSize}" height="${state.iconSize}" fill="var(--sol-blue)">
      <path d="${dPath}" />
    </svg>`;
    button.innerHTML = svgStr;

    // 1. Overlays: Boîte d'encombrement
    if (state.showBoundingBox) {
      const svg = button.querySelector("svg");
      svg.style.setProperty("border", "1px dotted var(--sol-magenta)");
      svg.style.setProperty("box-sizing", "content-box");
    }

    // 2. Overlays: Disque de la zone de clic
    if (state.showTouchTarget) {
      const overlay = document.createElement("div");
      overlay.className = "touch-target-overlay position-absolute";
      overlay.style.setProperty("width", `${state.targetSize}px`);
      overlay.style.setProperty("height", `${state.targetSize}px`);
      overlay.style.setProperty("border-radius", "50%");
      overlay.style.setProperty("pointer-events", "none");
      overlay.style.setProperty("top", "0");
      overlay.style.setProperty("left", "0");
      overlay.style.setProperty("box-sizing", "border-box");

      // Choix de la couleur d'overlay selon la conformité
      if (state.targetSize < 44) {
        overlay.style.setProperty("background-color", "rgba(220, 50, 47, 0.15)");
        overlay.style.setProperty("border", "2px solid var(--sol-red)");
      } else if (state.targetSize < 48) {
        overlay.style.setProperty("background-color", "rgba(203, 75, 22, 0.15)");
        overlay.style.setProperty("border", "2px solid var(--sol-orange)");
      } else {
        overlay.style.setProperty("background-color", "rgba(133, 153, 0, 0.15)");
        overlay.style.setProperty("border", "2px solid var(--sol-green)");
      }
      button.appendChild(overlay);
    }

    renderArea.appendChild(button);

    // Mettre à jour les indicateurs textuels des sliders
    ctrlCol.querySelector(".icon-size-val").textContent = `${state.iconSize}px`;
    ctrlCol.querySelector(".target-size-val").textContent = `${state.targetSize}px`;

    // Mettre à jour les checkboxes
    ctrlCol.querySelector(".check-bounding-box").checked = state.showBoundingBox;
    ctrlCol.querySelector(".check-touch-target").checked = state.showTouchTarget;

    // Déterminer le feedback d'accessibilité
    let statusClass = "feedback-error";
    let textClass = "text-danger";
    let badgeText = "Non Conforme";
    let message = `Zone de clic insuffisante pour mobile (${state.targetSize}px). Risque élevé d'erreurs de ciblage sur écran tactile. Le minimum requis est de 44px (iOS) ou 48px (Android).`;

    if (state.targetSize >= 48) {
      statusClass = "feedback-validated";
      textClass = "text-success";
      badgeText = "Optimal (Google/Android)";
      message = `Excellent ! La zone de clic fait ${state.targetSize}px. Elle respecte la recommandation Android (≥ 48px), assurant une utilisation fluide à l'ensemble des utilisateurs sur écrans mobiles.`;
    } else if (state.targetSize >= 44) {
      statusClass = "feedback-incomplete";
      textClass = "text-warning";
      badgeText = "Acceptable (Apple/iOS)";
      message = `Zone de clic de ${state.targetSize}px conforme à la charte d'accessibilité d'Apple (≥ 44px). Attention, elle reste légèrement inférieure au standard de Google Android (48px).`;
    }

    feedbackBlock.innerHTML = `
      <div class="feedback-card ${statusClass} p-3 rounded">
        <span class="badge bg-secondary mb-2">${badgeText}</span>
        <div class="small ${textClass} fw-bold">${message}</div>
      </div>
    `;

    // Dispatch input réactif pour OJS
    container.value = { ...state };
    container.dispatchEvent(new Event("input", { bubbles: true }));
  };

  // Événements
  ctrlCol.querySelector(".slider-icon-size").oninput = (e) => {
    state.iconSize = parseInt(e.target.value);
    update();
  };
  ctrlCol.querySelector(".slider-target-size").oninput = (e) => {
    state.targetSize = parseInt(e.target.value);
    update();
  };
  ctrlCol.querySelector(".check-bounding-box").onchange = (e) => {
    state.showBoundingBox = e.target.checked;
    update();
  };
  ctrlCol.querySelector(".check-touch-target").onchange = (e) => {
    state.showTouchTarget = e.target.checked;
    update();
  };

  const destroy = () => {
    container.innerHTML = "";
  };

  container.destroy = destroy;
  if (invalidation) {
    invalidation.then(destroy);
  }

  update();

  return container;
}
