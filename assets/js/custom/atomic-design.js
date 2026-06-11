/**
 * atomic-design.js
 * 
 * Simulateur interactif pour enseigner la méthodologie du Design Atomique.
 * Permet d'explorer et manipuler les composants à travers 5 niveaux :
 * Atome, Molécule, Organisme, Template, et Page.
 */

function resolveElement(elementOrSelector) {
  return typeof elementOrSelector === "string"
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
}

// Helper to escape HTML characters for safe code display
function escapeHtml(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function createAtomicDesignSimulator(target, options = {}, invalidation) {
  const container = resolveElement(target);
  if (!container) return null;

  // State
  let currentStage = options.initialStage || "atome"; // atome, molecule, organisme, template, page
  let debugMode = false;
  let cartCount = 0;

  // Settings state
  const settings = {
    // Atom
    atomType: "button", // label, input, button, badge, icon
    atomText: "Rechercher",
    atomVariant: "primary", // primary, success, danger, warning
    atomRadius: "8", // 0, 4, 8, 12
    
    // Molecule
    moleculeType: "search", // search, profile
    molSearchPlaceholder: "Rechercher un module...",
    molSearchIcon: "search", // search, arrow-right
    molProfileName: "Alex Dupont",
    molProfileStatus: "success", // success, danger, warning
    molProfileIcon: "person-circle",

    // Organism
    organismType: "navbar", // navbar, grid
    orgBrandName: "Aptispace",
    orgSearchPlaceholder: "Trouver un cours...",
    orgProfileName: "Alex Dupont",
    orgProd1Title: "Clavier Ergonomique",
    orgProd1Price: "129.99 €",
    orgProd2Title: "Souris de Labeur",
    orgProd2Price: "59.99 €",

    // Template
    tplShowGrid: true,

    // Page
    pageCategory: "all"
  };

  // Base layout templates
  container.innerHTML = `
    <div class="atomic-simulator-container">
      <div class="atomic-simulator-header">
        <h5 class="atomic-simulator-title"><i class="bi bi-box-seam me-2"></i>Atelier Design Atomique</h5>
        <ul class="atomic-simulator-nav">
          <li><button class="atomic-nav-btn is-active" data-stage="atome">1. Atomes</button></li>
          <li><button class="atomic-nav-btn" data-stage="molecule">2. Molécules</button></li>
          <li><button class="atomic-nav-btn" data-stage="organisme">3. Organismes</button></li>
          <li><button class="atomic-nav-btn" data-stage="template">4. Templates</button></li>
          <li><button class="atomic-nav-btn" data-stage="page">5. Pages</button></li>
        </ul>
      </div>
      <div class="atomic-simulator-main">
        <div class="atomic-settings-panel">
          <!-- Dynamically populated settings -->
        </div>
        <div class="atomic-preview-panel">
          <div class="atomic-preview-header">Rendu Visuel</div>
          <div class="atomic-preview-stage">
            <!-- Dynamically populated preview -->
          </div>
        </div>
      </div>
      <div class="atomic-code-panel">
        <div class="atomic-code-header">Structure HTML</div>
        <pre class="atomic-code-content"><code></code></pre>
      </div>
    </div>
  `;

  const settingsPanel = container.querySelector(".atomic-settings-panel");
  const previewStage = container.querySelector(".atomic-preview-stage");
  const codeNode = container.querySelector(".atomic-code-content code");
  const navButtons = container.querySelectorAll(".atomic-nav-btn");

  // Render settings depending on active tab
  function renderSettings() {
    let html = "";
    
    // Debug toggle (available for Atom, Molecule, Organism)
    const showDebugToggle = ["atome", "molecule", "organisme"].includes(currentStage);
    const debugToggleHtml = showDebugToggle ? `
      <div class="form-check form-switch mb-3">
        <input class="form-check-input" type="checkbox" id="sim-debug-toggle" ${debugMode ? "checked" : ""}>
        <label class="form-check-label small fw-bold text-muted" for="sim-debug-toggle">Surligner les frontières</label>
      </div>
      <hr class="my-2 border-secondary">
    ` : "";

    if (currentStage === "atome") {
      html = `
        ${debugToggleHtml}
        <div class="atomic-setting-group">
          <label for="atom-type">Type d'Atome</label>
          <select id="atom-type" class="form-select">
            <option value="button" ${settings.atomType === "button" ? "selected" : ""}>Bouton (Action)</option>
            <option value="input" ${settings.atomType === "input" ? "selected" : ""}>Input (Saisie)</option>
            <option value="label" ${settings.atomType === "label" ? "selected" : ""}>Label (Texte)</option>
            <option value="badge" ${settings.atomType === "badge" ? "selected" : ""}>Badge (Statut)</option>
            <option value="icon" ${settings.atomType === "icon" ? "selected" : ""}>Icône (Métaphore)</option>
          </select>
        </div>
      `;

      if (settings.atomType === "button" || settings.atomType === "label" || settings.atomType === "badge") {
        html += `
          <div class="atomic-setting-group">
            <label for="atom-text">Texte du composant</label>
            <input type="text" id="atom-text" class="form-control" value="${escapeHtml(settings.atomText)}">
          </div>
        `;
      }

      if (settings.atomType === "button" || settings.atomType === "badge") {
        html += `
          <div class="atomic-setting-group">
            <label for="atom-variant">Variante Sémantique</label>
            <select id="atom-variant" class="form-select">
              <option value="primary" ${settings.atomVariant === "primary" ? "selected" : ""}>Primary (Bleu)</option>
              <option value="success" ${settings.atomVariant === "success" ? "selected" : ""}>Success (Vert)</option>
              <option value="danger" ${settings.atomVariant === "danger" ? "selected" : ""}>Danger (Rouge)</option>
              <option value="warning" ${settings.atomVariant === "warning" ? "selected" : ""}>Warning (Orange)</option>
            </select>
          </div>
        `;
      }

      if (settings.atomType === "button" || settings.atomType === "input") {
        html += `
          <div class="atomic-setting-group">
            <label for="atom-radius">Rayon de bordure (px)</label>
            <select id="atom-radius" class="form-select">
              <option value="0" ${settings.atomRadius === "0" ? "selected" : ""}>0px (Carré)</option>
              <option value="4" ${settings.atomRadius === "4" ? "selected" : ""}>4px (Fin)</option>
              <option value="8" ${settings.atomRadius === "8" ? "selected" : ""}>8px (Standard)</option>
              <option value="12" ${settings.atomRadius === "12" ? "selected" : ""}>12px (Arrondi)</option>
            </select>
          </div>
        `;
      }
    } 
    else if (currentStage === "molecule") {
      html = `
        ${debugToggleHtml}
        <div class="atomic-setting-group">
          <label for="mol-type">Type de Molécule</label>
          <select id="mol-type" class="form-select">
            <option value="search" ${settings.moleculeType === "search" ? "selected" : ""}>Formulaire de recherche</option>
            <option value="profile" ${settings.moleculeType === "profile" ? "selected" : ""}>Badge Profil</option>
          </select>
        </div>
      `;

      if (settings.moleculeType === "search") {
        html += `
          <div class="atomic-setting-group">
            <label for="mol-search-placeholder">Placeholder</label>
            <input type="text" id="mol-search-placeholder" class="form-control" value="${escapeHtml(settings.molSearchPlaceholder)}">
          </div>
          <div class="atomic-setting-group">
            <label for="mol-search-icon">Icône du bouton</label>
            <select id="mol-search-icon" class="form-select">
              <option value="search" ${settings.molSearchIcon === "search" ? "selected" : ""}>Loupe</option>
              <option value="arrow-right" ${settings.molSearchIcon === "arrow-right" ? "selected" : ""}>Flèche</option>
            </select>
          </div>
        `;
      } else if (settings.moleculeType === "profile") {
        html += `
          <div class="atomic-setting-group">
            <label for="mol-profile-name">Nom de l'utilisateur</label>
            <input type="text" id="mol-profile-name" class="form-control" value="${escapeHtml(settings.molProfileName)}">
          </div>
          <div class="atomic-setting-group">
            <label for="mol-profile-status">Statut</label>
            <select id="mol-profile-status" class="form-select">
              <option value="success" ${settings.molProfileStatus === "success" ? "selected" : ""}>En ligne (Vert)</option>
              <option value="warning" ${settings.molProfileStatus === "warning" ? "selected" : ""}>Absent (Orange)</option>
              <option value="danger" ${settings.molProfileStatus === "danger" ? "selected" : ""}>Occupé (Rouge)</option>
            </select>
          </div>
        `;
      }
    } 
    else if (currentStage === "organisme") {
      html = `
        ${debugToggleHtml}
        <div class="atomic-setting-group">
          <label for="org-type">Type d'Organisme</label>
          <select id="org-type" class="form-select">
            <option value="navbar" ${settings.organismType === "navbar" ? "selected" : ""}>Barre de Navigation</option>
            <option value="grid" ${settings.organismType === "grid" ? "selected" : ""}>Grille de Produits</option>
          </select>
        </div>
      `;

      if (settings.organismType === "navbar") {
        html += `
          <div class="atomic-setting-group">
            <label for="org-brand-name">Nom de la marque</label>
            <input type="text" id="org-brand-name" class="form-control" value="${escapeHtml(settings.orgBrandName)}">
          </div>
          <div class="atomic-setting-group">
            <label for="org-search-placeholder">Placeholder recherche</label>
            <input type="text" id="org-search-placeholder" class="form-control" value="${escapeHtml(settings.orgSearchPlaceholder)}">
          </div>
        `;
      } else if (settings.organismType === "grid") {
        html += `
          <div class="atomic-setting-group">
            <label for="org-prod1-title">Titre Produit 1</label>
            <input type="text" id="org-prod1-title" class="form-control" value="${escapeHtml(settings.orgProd1Title)}">
          </div>
          <div class="atomic-setting-group">
            <label for="org-prod2-title">Titre Produit 2</label>
            <input type="text" id="org-prod2-title" class="form-control" value="${escapeHtml(settings.orgProd2Title)}">
          </div>
        `;
      }
    } 
    else if (currentStage === "template") {
      html = `
        <div class="atomic-setting-group">
          <span class="section-label">Structure Filaire</span>
          <p class="small text-muted mb-2">Les templates définissent le squelette de mise en page réutilisable sans contenu réel.</p>
        </div>
        <div class="form-check form-switch mt-2">
          <input class="form-check-input" type="checkbox" id="tpl-show-grid" ${settings.tplShowGrid ? "checked" : ""}>
          <label class="form-check-label small fw-bold text-muted" for="tpl-show-grid">Afficher les guides d'espacement</label>
        </div>
      `;
    } 
    else if (currentStage === "page") {
      html = `
        <div class="atomic-setting-group">
          <span class="section-label">Instance de Page</span>
          <p class="small text-muted mb-2">La page est une instance du template alimentée par du contenu réel et dynamique.</p>
        </div>
        <div class="atomic-setting-group mt-2">
          <label>Actions Interactives</label>
          <button id="sim-reset-cart-btn" class="btn btn-sm btn-outline-danger w-100">Réinitialiser le Panier</button>
        </div>
      `;
    }

    settingsPanel.innerHTML = html;
    bindSettingsEvents();
  }

  // Bind event listeners to input elements in the settings panel
  function bindSettingsEvents() {
    // Debug outline switch
    const debugToggle = settingsPanel.querySelector("#sim-debug-toggle");
    if (debugToggle) {
      debugToggle.addEventListener("change", (e) => {
        debugMode = e.target.checked;
        previewStage.classList.toggle("is-debug-mode", debugMode);
      });
    }

    // Atom settings
    const atomTypeEl = settingsPanel.querySelector("#atom-type");
    if (atomTypeEl) atomTypeEl.addEventListener("change", (e) => { settings.atomType = e.target.value; renderSettings(); updatePreview(); });

    const atomTextEl = settingsPanel.querySelector("#atom-text");
    if (atomTextEl) atomTextEl.addEventListener("input", (e) => { settings.atomText = e.target.value; updatePreview(); });

    const atomVariantEl = settingsPanel.querySelector("#atom-variant");
    if (atomVariantEl) atomVariantEl.addEventListener("change", (e) => { settings.atomVariant = e.target.value; updatePreview(); });

    const atomRadiusEl = settingsPanel.querySelector("#atom-radius");
    if (atomRadiusEl) atomRadiusEl.addEventListener("change", (e) => { settings.atomRadius = e.target.value; updatePreview(); });

    // Molecule settings
    const molTypeEl = settingsPanel.querySelector("#mol-type");
    if (molTypeEl) molTypeEl.addEventListener("change", (e) => { settings.moleculeType = e.target.value; renderSettings(); updatePreview(); });

    const molSearchPlaceholderEl = settingsPanel.querySelector("#mol-search-placeholder");
    if (molSearchPlaceholderEl) molSearchPlaceholderEl.addEventListener("input", (e) => { settings.molSearchPlaceholder = e.target.value; updatePreview(); });

    const molSearchIconEl = settingsPanel.querySelector("#mol-search-icon");
    if (molSearchIconEl) molSearchIconEl.addEventListener("change", (e) => { settings.molSearchIcon = e.target.value; updatePreview(); });

    const molProfileNameEl = settingsPanel.querySelector("#mol-profile-name");
    if (molProfileNameEl) molProfileNameEl.addEventListener("input", (e) => { settings.molProfileName = e.target.value; updatePreview(); });

    const molProfileStatusEl = settingsPanel.querySelector("#mol-profile-status");
    if (molProfileStatusEl) molProfileStatusEl.addEventListener("change", (e) => { settings.molProfileStatus = e.target.value; updatePreview(); });

    // Organism settings
    const orgTypeEl = settingsPanel.querySelector("#org-type");
    if (orgTypeEl) orgTypeEl.addEventListener("change", (e) => { settings.organismType = e.target.value; renderSettings(); updatePreview(); });

    const orgBrandNameEl = settingsPanel.querySelector("#org-brand-name");
    if (orgBrandNameEl) orgBrandNameEl.addEventListener("input", (e) => { settings.orgBrandName = e.target.value; updatePreview(); });

    const orgSearchPlaceholderEl = settingsPanel.querySelector("#org-search-placeholder");
    if (orgSearchPlaceholderEl) orgSearchPlaceholderEl.addEventListener("input", (e) => { settings.orgSearchPlaceholder = e.target.value; updatePreview(); });

    const orgProd1TitleEl = settingsPanel.querySelector("#org-prod1-title");
    if (orgProd1TitleEl) orgProd1TitleEl.addEventListener("input", (e) => { settings.orgProd1Title = e.target.value; updatePreview(); });

    const orgProd2TitleEl = settingsPanel.querySelector("#org-prod2-title");
    if (orgProd2TitleEl) orgProd2TitleEl.addEventListener("input", (e) => { settings.orgProd2Title = e.target.value; updatePreview(); });

    // Template settings
    const tplShowGridEl = settingsPanel.querySelector("#tpl-show-grid");
    if (tplShowGridEl) {
      tplShowGridEl.addEventListener("change", (e) => {
        settings.tplShowGrid = e.target.checked;
        const containerWireframe = previewStage.querySelector(".sim-template-container");
        if (containerWireframe) {
          containerWireframe.style.setProperty("border-style", settings.tplShowGrid ? "dashed" : "none");
          containerWireframe.querySelectorAll(".tpl-header-wireframe, .tpl-sidebar-wireframe, .tpl-card-wireframe").forEach(el => {
            el.style.setProperty("border-style", settings.tplShowGrid ? "dashed" : "none");
          });
        }
      });
    }

    // Page settings
    const resetCartBtn = settingsPanel.querySelector("#sim-reset-cart-btn");
    if (resetCartBtn) {
      resetCartBtn.addEventListener("click", () => {
        cartCount = 0;
        const countBadge = previewStage.querySelector(".page-cart-count");
        if (countBadge) {
          countBadge.textContent = "0";
          countBadge.classList.add("d-none");
        }
      });
    }
  }

  // Update preview stage and code block based on stage and options
  function updatePreview() {
    previewStage.classList.toggle("is-debug-mode", debugMode && ["atome", "molecule", "organisme"].includes(currentStage));
    
    let previewHtml = "";
    let codeText = "";

    if (currentStage === "atome") {
      const radiusVal = settings.atomRadius;
      if (settings.atomType === "button") {
        previewHtml = `<button class="sim-atom-button sim-btn-${settings.atomVariant}" style="--sim-border-radius: ${radiusVal}px">${escapeHtml(settings.atomText)}</button>`;
        codeText = `<button class="btn btn-${settings.atomVariant} rounded-${radiusVal === "0" ? "0" : radiusVal === "4" ? "1" : radiusVal === "8" ? "2" : "3"}">\n  ${settings.atomText}\n</button>`;
      } 
      else if (settings.atomType === "input") {
        previewHtml = `<input type="text" class="sim-atom-input" placeholder="Saisir..." style="--sim-border-radius: ${radiusVal}px">`;
        codeText = `<input type="text" class="form-control rounded-${radiusVal === "0" ? "0" : radiusVal === "4" ? "1" : radiusVal === "8" ? "2" : "3"}" placeholder="Saisir...">`;
      } 
      else if (settings.atomType === "label") {
        previewHtml = `<span class="sim-atom-label">${escapeHtml(settings.atomText)}</span>`;
        codeText = `<label class="form-label">${settings.atomText}</label>`;
      } 
      else if (settings.atomType === "badge") {
        previewHtml = `<span class="sim-atom-badge bg-${settings.atomVariant}">${escapeHtml(settings.atomText)}</span>`;
        codeText = `<span class="badge bg-${settings.atomVariant}">${settings.atomText}</span>`;
      } 
      else if (settings.atomType === "icon") {
        previewHtml = `<i class="bi bi-search sim-atom-icon"></i>`;
        codeText = `<i class="bi bi-search" aria-hidden="true"></i>`;
      }

      previewStage.innerHTML = `<div class="sim-atom-wrapper">${previewHtml}</div>`;
    } 
    else if (currentStage === "molecule") {
      if (settings.moleculeType === "search") {
        const biIcon = settings.molSearchIcon === "search" ? "bi-search" : "bi-arrow-right";
        previewHtml = `
          <div class="search-molecule">
            <span class="sim-atom-label">Rechercher</span>
            <div class="input-group">
              <input type="text" class="sim-atom-input" placeholder="${escapeHtml(settings.molSearchPlaceholder)}">
              <button class="sim-atom-button sim-btn-primary">
                <i class="bi ${biIcon}"></i>
              </button>
            </div>
          </div>
        `;
        codeText = `<!-- Molécule : Formulaire de Recherche -->\n<div class="search-form">\n  <label class="form-label">Rechercher</label>\n  <div class="input-group">\n    <input type="text" class="form-control" placeholder="${settings.molSearchPlaceholder}">\n    <button class="btn btn-primary">\n      <i class="bi ${settings.molSearchIcon === "search" ? "bi-search" : "bi-arrow-right"}"></i>\n    </button>\n  </div>\n</div>`;
      } 
      else if (settings.moleculeType === "profile") {
        previewHtml = `
          <div class="profile-molecule">
            <div class="avatar-atom"><i class="bi bi-${settings.molProfileIcon}"></i></div>
            <div class="profile-details">
              <span class="sim-atom-label fw-bold">${escapeHtml(settings.molProfileName)}</span>
              <span class="sim-atom-badge bg-${settings.molProfileStatus}">${settings.molProfileStatus === "success" ? "En ligne" : settings.molProfileStatus === "warning" ? "Absent" : "Occupé"}</span>
            </div>
          </div>
        `;
        codeText = `<!-- Molécule : Badge de Profil -->\n<div class="profile-badge d-flex align-items-center gap-2">\n  <div class="avatar rounded-circle">\n    <i class="bi bi-${settings.molProfileIcon}"></i>\n  </div>\n  <div class="profile-text">\n    <span class="username fw-bold">${settings.molProfileName}</span>\n    <span class="badge bg-${settings.molProfileStatus}">${settings.molProfileStatus === "success" ? "En ligne" : settings.molProfileStatus === "warning" ? "Absent" : "Occupé"}</span>\n  </div>\n</div>`;
      }
      previewStage.innerHTML = previewHtml;
    } 
    else if (currentStage === "organisme") {
      if (settings.organismType === "navbar") {
        previewHtml = `
          <nav class="navbar-organism">
            <h5 class="logo-atom"><i class="bi bi-gemini me-1"></i>${escapeHtml(settings.orgBrandName)}</h5>
            <div class="search-molecule">
              <div class="input-group">
                <input type="text" class="sim-atom-input" placeholder="${escapeHtml(settings.orgSearchPlaceholder)}">
                <button class="sim-atom-button sim-btn-primary"><i class="bi bi-search"></i></button>
              </div>
            </div>
            <div class="profile-molecule">
              <div class="avatar-atom"><i class="bi bi-person-circle"></i></div>
              <div class="profile-details">
                <span class="sim-atom-label small fw-bold">${escapeHtml(settings.orgProfileName)}</span>
              </div>
            </div>
          </nav>
        `;
        codeText = `<!-- Organisme : En-tête de page -->\n<header class="navbar-organism d-flex justify-content-between align-items-center">\n  <!-- Atome : Logo -->\n  <a href="#" class="navbar-brand font-monospace"><i class="bi bi-gemini"></i> ${settings.orgBrandName}</a>\n  \n  <!-- Molécule : Formulaire Recherche -->\n  <div class="search-form">\n    <div class="input-group">\n      <input type="text" class="form-control" placeholder="${settings.orgSearchPlaceholder}">\n      <button class="btn btn-primary"><i class="bi bi-search"></i></button>\n    </div>\n  </div>\n  \n  <!-- Molécule : Profil Badge -->\n  <div class="profile-badge d-flex align-items-center gap-2">\n    <div class="avatar"><i class="bi bi-person-circle"></i></div>\n    <span class="username small fw-bold">${settings.orgProfileName}</span>\n  </div>\n</header>`;
      } 
      else if (settings.organismType === "grid") {
        previewHtml = `
          <div class="cards-organism w-100 max-width-650">
            <div class="row" style="--bs-gutter-x: 16px;">
              <div class="col" style="flex: 1 1 50%; min-width: 200px;">
                <div class="product-card">
                  <div class="product-img-placeholder"><i class="bi bi-laptop"></i></div>
                  <h6 class="product-title">${escapeHtml(settings.orgProd1Title)}</h6>
                  <span class="product-price">${escapeHtml(settings.orgProd1Price)}</span>
                  <button class="sim-atom-button sim-btn-primary">Acheter</button>
                </div>
              </div>
              <div class="col" style="flex: 1 1 50%; min-width: 200px;">
                <div class="product-card">
                  <div class="product-img-placeholder"><i class="bi bi-mouse3"></i></div>
                  <h6 class="product-title">${escapeHtml(settings.orgProd2Title)}</h6>
                  <span class="product-price">${escapeHtml(settings.orgProd2Price)}</span>
                  <button class="sim-atom-button sim-btn-primary">Acheter</button>
                </div>
              </div>
            </div>
          </div>
        `;
        codeText = `<!-- Organisme : Liste de Produits -->\n<div class="row g-3">\n  <div class="col-12 col-md-6">\n    <!-- Molécule : Carte Produit -->\n    <div class="card p-3">\n      <div class="card-img-top bg-light text-center py-4"><i class="bi bi-laptop"></i></div>\n      <h5 class="card-title mt-2">${settings.orgProd1Title}</h5>\n      <p class="text-success fw-bold">${settings.orgProd1Price}</p>\n      <button class="btn btn-primary">Acheter</button>\n    </div>\n  </div>\n  <div class="col-12 col-md-6">\n    <!-- Molécule : Carte Produit -->\n    <div class="card p-3">\n      <div class="card-img-top bg-light text-center py-4"><i class="bi bi-mouse3"></i></div>\n      <h5 class="card-title mt-2">${settings.orgProd2Title}</h5>\n      <p class="text-success fw-bold">${settings.orgProd2Price}</p>\n      <button class="btn btn-primary">Acheter</button>\n    </div>\n  </div>\n</div>`;
      }
      previewStage.innerHTML = previewHtml;
    } 
    else if (currentStage === "template") {
      const borderStyle = settings.tplShowGrid ? "dashed" : "none";
      previewHtml = `
        <div class="sim-template-container" style="border-style: ${borderStyle}">
          <div class="tpl-header-wireframe" style="border-style: ${borderStyle}">
            <div class="logo-wireframe skeleton-loader" style="height: 20px; width: 80px;"></div>
            <div class="search-wireframe skeleton-loader" style="height: 24px; width: 150px;"></div>
            <div class="profile-wireframe skeleton-loader" style="height: 24px; width: 60px;"></div>
          </div>
          <div class="tpl-body-wireframe">
            <div class="tpl-sidebar-wireframe" style="border-style: ${borderStyle}">
              <div class="skeleton-loader mb-2" style="height: 12px; width: 80%;"></div>
              <div class="skeleton-loader mb-2" style="height: 12px; width: 70%;"></div>
              <div class="skeleton-loader mb-2" style="height: 12px; width: 90%;"></div>
            </div>
            <div class="tpl-content-wireframe">
              <div class="tpl-card-wireframe" style="border-style: ${borderStyle}">
                <div class="skeleton-loader ske-title"></div>
                <div class="skeleton-loader ske-text"></div>
                <div class="skeleton-loader ske-button"></div>
              </div>
            </div>
          </div>
        </div>
      `;
      codeText = `<!-- Template : Squelette de page (Sans contenu) -->\n<div class="container-fluid">\n  <header class="row border-bottom py-2">\n    <div class="col-3"><div class="skeleton" style="height: 20px"></div></div>\n    <div class="col-6"><div class="skeleton" style="height: 24px"></div></div>\n    <div class="col-3"><div class="skeleton" style="height: 24px"></div></div>\n  </header>\n  <div class="row mt-3">\n    <aside class="col-3">\n      <div class="skeleton mb-2" style="height: 12px"></div>\n      <div class="skeleton mb-2" style="height: 12px"></div>\n    </aside>\n    <main class="col-9">\n      <div class="card border-dashed p-3">\n        <div class="skeleton mb-2" style="height: 16px; width: 50%"></div>\n        <div class="skeleton mb-3" style="height: 10px; width: 80%"></div>\n        <div class="skeleton" style="height: 30px; width: 100px"></div>\n      </div>\n    </main>\n  </div>\n</div>`;
      previewStage.innerHTML = previewHtml;
    } 
    else if (currentStage === "page") {
      const cartBadgeClass = cartCount > 0 ? "" : " d-none";
      previewHtml = `
        <div class="sim-page-container">
          <header class="page-header">
            <h5 class="page-logo"><i class="bi bi-gemini me-1"></i>Aptitek Store</h5>
            <div class="page-search-wrapper">
              <input type="text" placeholder="Rechercher des périphériques...">
              <button><i class="bi bi-search"></i></button>
            </div>
            <div class="page-cart-indicator position-relative" style="cursor: pointer;">
              <i class="bi bi-cart3 fs-5 text-muted"></i>
              <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger page-cart-count${cartBadgeClass}" style="font-size: 0.6rem; padding: 3px 6px;">${cartCount}</span>
            </div>
          </header>
          <div class="page-main-layout">
            <aside class="page-sidebar">
              <a href="#" class="sidebar-link active">Boutique</a>
              <a href="#" class="sidebar-link">Mon Compte</a>
              <a href="#" class="sidebar-link">Support</a>
            </aside>
            <main class="page-content">
              <div class="product-grid">
                <div class="product-card">
                  <div class="product-img-placeholder"><i class="bi bi-keyboard"></i></div>
                  <h6 class="product-title">Clavier Mécanique</h6>
                  <span class="product-price">129.99 €</span>
                  <button class="sim-atom-button sim-btn-primary sim-add-cart-btn" data-product="clavier">Ajouter au panier</button>
                </div>
                <div class="product-card">
                  <div class="product-img-placeholder"><i class="bi bi-mouse"></i></div>
                  <h6 class="product-title">Souris de Précision</h6>
                  <span class="product-price">59.99 €</span>
                  <button class="sim-atom-button sim-btn-primary sim-add-cart-btn" data-product="souris">Ajouter au panier</button>
                </div>
              </div>
            </main>
          </div>
        </div>
      `;
      codeText = `<!-- Page : Instance de page avec données injectées -->\n<div class="container-fluid">\n  <header class="row border-bottom py-2 align-items-center">\n    <div class="col-3"><h5 class="text-primary m-0">Aptitek Store</h5></div>\n    <div class="col-6">\n      <div class="input-group">\n        <input type="text" class="form-control" placeholder="Rechercher des périphériques...">\n        <button class="btn btn-primary"><i class="bi bi-search"></i></button>\n      </div>\n    </div>\n    <div class="col-3 text-end">\n      <i class="bi bi-cart3 position-relative fs-5">\n        <span class="badge bg-danger rounded-pill position-absolute top-0 start-100">${cartCount}</span>\n      </i>\n    </div>\n  </header>\n  <div class="row mt-3">\n    <aside class="col-3">\n      <div class="list-group">\n        <a href="#" class="list-group-item active">Boutique</a>\n        <a href="#" class="list-group-item">Mon Compte</a>\n      </div>\n    </aside>\n    <main class="col-9">\n      <div class="row g-3">\n        <div class="col-6">\n          <div class="card p-3">\n            <div class="product-img bg-light text-center py-3"><i class="bi bi-keyboard"></i></div>\n            <h6 class="mt-2">Clavier Mécanique</h6>\n            <p class="text-success fw-bold m-0">129.99 €</p>\n            <button class="btn btn-sm btn-primary mt-2">Ajouter au panier</button>\n          </div>\n        </div>\n      </div>\n    </main>\n  </div>\n</div>`;
      previewStage.innerHTML = previewHtml;
      
      // Bind cart events
      previewStage.querySelectorAll(".sim-add-cart-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          cartCount++;
          const countBadge = previewStage.querySelector(".page-cart-count");
          if (countBadge) {
            countBadge.textContent = cartCount;
            countBadge.classList.remove("d-none");
          }
          // Dynamic update of code pane
          updatePreview();
        });
      });
    }

    codeNode.textContent = codeText.trim();
    
    // Dispatch event to OJS
    container.dispatchEvent(new CustomEvent("input", {
      detail: { stage: currentStage, debug: debugMode, settings }
    }));
  }

  // Bind top navbar tabs
  navButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      navButtons.forEach(b => b.classList.remove("is-active"));
      e.target.classList.add("is-active");
      currentStage = e.target.dataset.stage;
      renderSettings();
      updatePreview();
    });
  });

  // Cleanup
  const destroy = () => {
    container.innerHTML = "";
  };

  if (invalidation) {
    invalidation.then(destroy);
  }

  // Initial render
  renderSettings();
  updatePreview();

  // Return container with OJS-friendly update method
  container.update = (newOptions) => {
    if (newOptions.stage !== undefined) {
      currentStage = newOptions.stage;
      navButtons.forEach(b => {
        b.classList.toggle("is-active", b.dataset.stage === currentStage);
      });
      renderSettings();
    }
    if (newOptions.debug !== undefined) {
      debugMode = newOptions.debug;
      const debugToggle = settingsPanel.querySelector("#sim-debug-toggle");
      if (debugToggle) debugToggle.checked = debugMode;
    }
    updatePreview();
  };

  return container;
}
