/**
 * spacing.js - Composant interactif pour le cours sur les systèmes d'espacement (Grid & Spacing)
 * 
 * Permet de manipuler l'échelle d'espacement de la loi de proximité (Gestalt)
 * et d'analyser l'impact de la hiérarchie visuelle sur une fausse interface (Mockup).
 */

function resolveElement(elementOrSelector) {
  return typeof elementOrSelector === "string"
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
}

/**
 * Crée le visualisateur d'espacement.
 * 
 * @param {HTMLElement|string} target Conteneur HTML ou sélecteur CSS
 * @param {Object} options Options de configuration initiales
 * @param {Promise} invalidation Promesse d'invalidation OJS pour le nettoyage
 */
export function createSpacingVisualizer(target, options = {}, invalidation) {
  const container = resolveElement(target);
  if (!container) return null;

  container.innerHTML = "";

  const state = {
    bestFriends: options.bestFriends || 8,
    friends: options.friends || 16,
    acquaintances: options.acquaintances || 32,
    strangers: options.strangers || 64,
    showOverlays: options.showOverlays !== false
  };

  // Wrapper principal
  const wrapper = document.createElement("div");
  wrapper.className = "spacing-visualizer-wrapper row";

  // Colonne des contrôles
  const ctrlCol = document.createElement("div");
  ctrlCol.className = "col span=5 col-stack";

  // Sliders d'espacement
  const slidersGroup = document.createElement("div");
  slidersGroup.className = "control-group";
  slidersGroup.innerHTML = `
    <label class="section-label">Échelle d'espacement (Loi de Gestalt)</label>
    
    <div class="slider-row mb-3">
      <span class="small text-muted d-flex justify-content-between">
        <span>Best Friends (Icône, Bouton)</span>
        <strong class="best-friends-val">${state.bestFriends}px</strong>
      </span>
      <input type="range" class="form-range slider-best-friends" min="2" max="24" step="2" value="${state.bestFriends}">
    </div>

    <div class="slider-row mb-3">
      <span class="small text-muted d-flex justify-content-between">
        <span>Friends (Titre ↔ Description)</span>
        <strong class="friends-val">${state.friends}px</strong>
      </span>
      <input type="range" class="form-range slider-friends" min="4" max="48" step="4" value="${state.friends}">
    </div>

    <div class="slider-row mb-3">
      <span class="small text-muted d-flex justify-content-between">
        <span>Acquaintances (Entre cartes)</span>
        <strong class="acquaintances-val">${state.acquaintances}px</strong>
      </span>
      <input type="range" class="form-range slider-acquaintances" min="8" max="96" step="8" value="${state.acquaintances}">
    </div>

    <div class="slider-row mb-3">
      <span class="small text-muted d-flex justify-content-between">
        <span>Strangers (Entre sections)</span>
        <strong class="strangers-val">${state.strangers}px</strong>
      </span>
      <input type="range" class="form-range slider-strangers" min="16" max="160" step="8" value="${state.strangers}">
    </div>
  `;
  ctrlCol.appendChild(slidersGroup);

  // Checkbox pour activer les overlays
  const optionsGroup = document.createElement("div");
  optionsGroup.className = "control-group mt-2";
  optionsGroup.innerHTML = `
    <label class="section-label">Options d'affichage</label>
    <div class="form-check mt-1">
      <input class="form-check-input check-overlays" type="checkbox" id="check-overlays-${Math.random().toString(36).substr(2, 5)}" ${state.showOverlays ? "checked" : ""}>
      <label class="form-check-label small text-muted" for="check-overlays">Afficher les repères d'espacement (Overlays)</label>
    </div>
  `;
  ctrlCol.appendChild(optionsGroup);

  // Diagnostic de lisibilité
  const feedbackBlock = document.createElement("div");
  feedbackBlock.className = "spacing-feedback-block mt-3";
  ctrlCol.appendChild(feedbackBlock);

  wrapper.appendChild(ctrlCol);

  // Colonne de prévisualisation (Mockup de l'interface)
  const viewCol = document.createElement("div");
  viewCol.className = "col span=7 col-stack mt-3 mt-lg-0";

  const previewFrame = document.createElement("div");
  previewFrame.className = "spacing-preview-frame position-relative";
  viewCol.appendChild(previewFrame);

  wrapper.appendChild(viewCol);
  container.appendChild(wrapper);

  // Fonction de rendu du mockup et application des variables CSS
  const update = () => {
    // 1. Appliquer les valeurs d'espacement sous forme de variables CSS sur le mockup
    previewFrame.style.setProperty("--space-best-friends", `${state.bestFriends}px`);
    previewFrame.style.setProperty("--space-friends", `${state.friends}px`);
    previewFrame.style.setProperty("--space-acquaintances", `${state.acquaintances}px`);
    previewFrame.style.setProperty("--space-strangers", `${state.strangers}px`);

    // 2. Mettre à jour les labels textuels des sliders
    ctrlCol.querySelector(".best-friends-val").textContent = `${state.bestFriends}px`;
    ctrlCol.querySelector(".friends-val").textContent = `${state.friends}px`;
    ctrlCol.querySelector(".acquaintances-val").textContent = `${state.acquaintances}px`;
    ctrlCol.querySelector(".strangers-val").textContent = `${state.strangers}px`;

    // 3. Déterminer si les overlays doivent être affichés
    const overlayClass = state.showOverlays ? "show-overlays" : "";

    // 4. Générer le HTML du mockup
    previewFrame.innerHTML = `
      <div class="mockup-container ${overlayClass}">
        
        <!-- Section 1 : Espace de Travail -->
        <div class="mockup-section section-1">
          <div class="mockup-section-header">
            <i class="bi bi-briefcase mockup-icon"></i>
            <span class="mockup-section-title">Espace Personnel</span>
          </div>
          
          <!-- Spacing Overlay : Best Friends header ↔ body (non visible mais mesurable) -->
          <div class="spacing-overlay overlay-best-friends" data-val="${state.bestFriends}px"></div>

          <div class="mockup-section-body">
            
            <!-- Carte 1 -->
            <div class="mockup-card card-1">
              <div class="mockup-card-header">
                <i class="bi bi-person-circle mockup-card-icon"></i>
                <h5 class="mockup-card-title">Alice Martin</h5>
              </div>
              
              <!-- Spacing Overlay : Best Friends -->
              <div class="spacing-overlay overlay-best-friends" data-val="${state.bestFriends}px"></div>

              <div class="mockup-card-body">
                <div class="mockup-card-subtitle">Profil Designer</div>
                
                <!-- Spacing Overlay : Friends -->
                <div class="spacing-overlay overlay-friends" data-val="${state.friends}px"></div>
                
                <p class="mockup-card-desc">Inscrite depuis le 12/04/2026. Niveau d'accréditation UI/UX.</p>
              </div>
            </div>

            <!-- Spacing Overlay : Acquaintances -->
            <div class="spacing-overlay overlay-acquaintances" data-val="${state.acquaintances}px"></div>

            <!-- Carte 2 -->
            <div class="mockup-card card-2">
              <div class="mockup-card-header">
                <i class="bi bi-hdd-network mockup-card-icon"></i>
                <h5 class="mockup-card-title">Stockage Cloud</h5>
              </div>
              
              <!-- Spacing Overlay : Best Friends -->
              <div class="spacing-overlay overlay-best-friends" data-val="${state.bestFriends}px"></div>

              <div class="mockup-card-body">
                <div class="mockup-card-subtitle">Espace occupé</div>
                
                <!-- Spacing Overlay : Friends -->
                <div class="spacing-overlay overlay-friends" data-val="${state.friends}px"></div>
                
                <div class="mockup-progress-bar">
                  <div class="mockup-progress-fill" style="width: 65%;"></div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Spacing Overlay : Strangers -->
        <div class="spacing-overlay overlay-strangers" data-val="${state.strangers}px"></div>

        <!-- Section 2 : Paramètres -->
        <div class="mockup-section section-2">
          <div class="mockup-section-header">
            <i class="bi bi-shield-lock mockup-icon"></i>
            <span class="mockup-section-title">Sécurité & Accès</span>
          </div>
          
          <!-- Spacing Overlay : Best Friends -->
          <div class="spacing-overlay overlay-best-friends" data-val="${state.bestFriends}px"></div>

          <div class="mockup-section-body">
            <div class="mockup-card card-3">
              <div class="mockup-card-header">
                <i class="bi bi-key-fill mockup-card-icon"></i>
                <h5 class="mockup-card-title">Double Facteur (2FA)</h5>
              </div>
              
              <!-- Spacing Overlay : Best Friends -->
              <div class="spacing-overlay overlay-best-friends" data-val="${state.bestFriends}px"></div>

              <div class="mockup-card-body">
                <span class="badge bg-success">Activé</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;

    // 5. Calculer le diagnostic de lisibilité et de Gestalt
    let statusClass = "feedback-error";
    let textClass = "text-danger";
    let badgeText = "Hiérarchie incohérente";
    let message = "Vérifiez vos espacements.";

    const bf = state.bestFriends;
    const fr = state.friends;
    const ac = state.acquaintances;
    const st = state.strangers;

    if (bf >= fr) {
      message = `**Erreur de Proximité (Best Friends ≥ Friends)** : L'espace entre l'icône et son titre (${bf}px) est plus grand que l'espace entre le titre et sa description (${fr}px). Le cerveau n'associe plus l'icône à son titre.`;
    } else if (fr >= ac) {
      message = `**Erreur de Regroupement (Friends ≥ Acquaintances)** : Le titre et sa description (${fr}px) sont plus éloignés que les deux cartes indépendantes entre elles (${ac}px). L'utilisateur perçoit des blocs dissociés.`;
    } else if (ac >= st) {
      message = `**Erreur de Section (Acquaintances ≥ Strangers)** : Deux cartes d'une même liste (${ac}px) sont aussi éloignées (ou plus) que deux sections complètement distinctes (${st}px). Les sections perdent leur unité visuelle.`;
    } else {
      statusClass = "feedback-validated";
      textClass = "text-success";
      badgeText = "Hiérarchie Harmonieuse";
      message = `**Loi de Proximité respectée !** La hiérarchie mathématique et visuelle est optimale (${bf}px < ${fr}px < ${ac}px < ${st}px). Les informations sont structurées de manière naturelle et instinctive.`;
    }

    feedbackBlock.innerHTML = `
      <div class="feedback-card ${statusClass} p-3 rounded">
        <span class="badge bg-secondary mb-2">${badgeText}</span>
        <div class="small ${textClass} fw-bold">${message}</div>
      </div>
    `;

    // Dispatcher la valeur pour OJS
    container.value = { ...state };
    container.dispatchEvent(new Event("input", { bubbles: true }));
  };

  // Événements d'écouteurs sur les contrôles
  ctrlCol.querySelector(".slider-best-friends").oninput = (e) => {
    state.bestFriends = parseInt(e.target.value);
    update();
  };
  ctrlCol.querySelector(".slider-friends").oninput = (e) => {
    state.friends = parseInt(e.target.value);
    update();
  };
  ctrlCol.querySelector(".slider-acquaintances").oninput = (e) => {
    state.acquaintances = parseInt(e.target.value);
    update();
  };
  ctrlCol.querySelector(".slider-strangers").oninput = (e) => {
    state.strangers = parseInt(e.target.value);
    update();
  };
  ctrlCol.querySelector(".check-overlays").onchange = (e) => {
    state.showOverlays = e.target.checked;
    update();
  };

  // Fonction de nettoyage
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
 * Crée le visualisateur de l'échelle d'espacement (Cheat Sheet).
 * 
 * @param {HTMLElement|string} target Conteneur HTML ou sélecteur CSS
 * @param {Object} options Options de configuration initiales
 * @param {Promise} invalidation Promesse d'invalidation OJS pour le nettoyage
 */
export function createSpacingScaleVisualizer(target, options = {}, invalidation) {
  const container = resolveElement(target);
  if (!container) return null;

  container.innerHTML = "";

  const state = {
    baseUnit: options.baseUnit || 16
  };

  const wrapper = document.createElement("div");
  wrapper.className = "spacing-scale-wrapper";

  // Zone de contrôle
  const ctrlHeader = document.createElement("div");
  ctrlHeader.className = "spacing-scale-controls d-flex flex-wrap align-items-center justify-content-between p-3 mb-4 rounded";
  ctrlHeader.style.setProperty("background", "var(--sol-base2)");
  ctrlHeader.style.setProperty("border", "1px solid rgba(88, 110, 117, 0.12)");

  ctrlHeader.innerHTML = `
    <div class="d-flex align-items-center gap-3">
      <span class="small text-muted font-monospace">Unité de base (x) :</span>
      <select class="form-select select-base-unit" style="width: auto; display: inline-block;">
        <option value="12" ${state.baseUnit === 12 ? "selected" : ""}>12px (Compact / Mobile)</option>
        <option value="16" ${state.baseUnit === 16 ? "selected" : ""}>16px (Standard / Desktop)</option>
        <option value="20" ${state.baseUnit === 20 ? "selected" : ""}>20px (Spacieux)</option>
        <option value="24" ${state.baseUnit === 24 ? "selected" : ""}>24px (Large / Section Hero)</option>
      </select>
    </div>
    <div class="small text-muted text-end mt-2 mt-md-0">
      Multiplicateurs stricts de <strong>x</strong> pour préserver le rythme visuel.
    </div>
  `;
  wrapper.appendChild(ctrlHeader);

  // Conteneur des lignes d'échelle
  const scaleContainer = document.createElement("div");
  scaleContainer.className = "spacing-scale-container d-flex flex-column gap-2 p-3 rounded";
  scaleContainer.style.setProperty("background", "var(--sol-base3)");
  scaleContainer.style.setProperty("border", "1px solid rgba(88, 110, 117, 0.08)");
  wrapper.appendChild(scaleContainer);

  const SCALE_ITEMS = [
    { ratio: 0.25, label: "I will die for you", desc: "Micro-ajustement (ex: icône dans bouton, petit badge)" },
    { ratio: 0.5, label: "Best Friends", desc: "Éléments indissociables (ex: label de champ de saisie, icône ↔ texte)" },
    { ratio: 1.0, label: "Friends", desc: "Éléments liés d'un même bloc (ex: titre de carte ↔ description)" },
    { ratio: 1.5, label: "", desc: "Gouttière standard sur petit écran ou padding interne modéré" },
    { ratio: 2.0, label: "Casual Friends", desc: "Éléments séparés d'un même groupe (ex: boutons d'action d'une carte)" },
    { ratio: 3.0, label: "", desc: "Marge interne de grande carte ou espacement de liste secondaire" },
    { ratio: 4.0, label: "Acquaintances", desc: "Séparation d'éléments indépendants (ex: entre deux cartes)" },
    { ratio: 5.0, label: "Distant Acquaintances", desc: "Grande transition ou transition de sous-section" },
    { ratio: 7.5, label: "Who are you?", desc: "Limite de section (ex: pied de page, changement de thématique)" }
  ];

  const update = () => {
    scaleContainer.innerHTML = "";

    SCALE_ITEMS.forEach(item => {
      const height = Math.round(item.ratio * state.baseUnit);
      
      const itemRow = document.createElement("div");
      itemRow.className = "spacing-scale-item d-grid align-items-center gap-3 py-2";
      itemRow.style.setProperty("grid-template-columns", "1fr 80px 200px");
      itemRow.style.setProperty("border-bottom", "1px solid rgba(88, 110, 117, 0.05)");

      // Colonne 1 : La barre
      const barWrapper = document.createElement("div");
      barWrapper.className = "spacing-scale-bar-wrapper d-flex align-items-center";
      
      const bar = document.createElement("div");
      bar.className = "spacing-scale-bar";
      bar.style.setProperty("height", `${height}px`);
      bar.style.setProperty("background-color", "var(--sol-base02)");
      bar.style.setProperty("border-radius", "4px");
      bar.style.setProperty("width", "100%");
      bar.style.setProperty("max-width", "350px");
      bar.style.setProperty("transition", "height 0.2s ease, background-color 0.2s ease");
      bar.style.setProperty("cursor", "pointer");
      bar.title = item.desc;
      
      barWrapper.appendChild(bar);
      itemRow.appendChild(barWrapper);

      // Colonne 2 : Taille en pixels et ratio
      const sizeCol = document.createElement("div");
      sizeCol.className = "spacing-scale-pixel text-start";
      sizeCol.innerHTML = `
        <div class="fw-bold font-monospace" style="color: var(--sol-green); font-size: 0.95rem;">${height}px</div>
        <div class="text-muted font-monospace" style="font-size: 0.75rem;">${item.ratio}x</div>
      `;
      itemRow.appendChild(sizeCol);

      // Colonne 3 : Nom de la relation (Label de Gestalt)
      const relCol = document.createElement("div");
      relCol.className = "spacing-scale-relationship text-start fw-bold";
      relCol.style.setProperty("color", "var(--sol-green)");
      relCol.style.setProperty("font-size", "0.95rem");
      relCol.textContent = item.label || "";
      itemRow.appendChild(relCol);

      scaleContainer.appendChild(itemRow);
    });

    // Watermark
    const footer = document.createElement("div");
    footer.className = "spacing-scale-footer text-center mt-3 text-muted small font-monospace";
    footer.textContent = "@designforducks";
    scaleContainer.appendChild(footer);

    container.value = { ...state };
    container.dispatchEvent(new Event("input", { bubbles: true }));
  };

  ctrlHeader.querySelector(".select-base-unit").onchange = (e) => {
    state.baseUnit = parseInt(e.target.value);
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
  container.appendChild(wrapper);

  return container;
}

