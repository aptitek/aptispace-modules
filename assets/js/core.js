// ==========================================
// core.js - Design Tokens & Utilitaires
// ==========================================

/**
 * 🎨 THEME GLOBAL (Palette Solarized Dark + Standard)
 * Toute modification de couleur ici se répercutera instantanément 
 * sur 100% de tes composants (terminaux, matrices, alertes, etc.)
 */
export const theme = {
  colors: {
    // Fonds
    background: "transparent", 
    surface: "rgba(var(--sol-base03-rgb), 0.2)",       // Solarized Base03 (Dark) with opacity
    surfaceHover: "rgba(var(--sol-base03-rgb), 0.3)",
    
    // Texte
    text: "var(--sol-base0)",                     // Solarized Base0 (Gris principal)
    textMuted: "var(--sol-base01)",                // Solarized Base01 (Gris discret)
    
    // Couleurs Sémantiques (Palette Solarized stricte via CSS variables)
    primary: "var(--sol-yellow)",                  // Jaune Solarized
    success: "var(--sol-green)",                  // Vert Solarized
    warning: "var(--sol-orange)",                  // Orange Solarized
    danger: "var(--sol-red)",                   // Rouge Solarized
    info: "var(--sol-blue)",                     // Bleu Solarized
    debug: "var(--sol-violet)",                    // Violet Solarized

    // Spécifique aux terminaux (Alignés sur Solarized)
    terminalBg: "var(--sol-base03)",
    terminalText: "var(--sol-green)",
    terminalMuted: "var(--sol-base01)"
  },
  
  // Tailles et espacements
  radius: "8px",
  radiusSmall: "4px",
  
  // Typographie (Alignée sur le _quarto.yml)
  fontSans: '"Recursive", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontMono: '"Recursive", SFMono-Regular, Menlo, Monaco, Consolas, monospace'
};

/**
 * 📊 Plotly Solarized Theme Template
 * Consumes CSS custom design tokens as the single source of truth.
 * When the light/dark theme switches, Plotly automatically conforms!
 */
export const solarizedTemplate = {
  layout: {
    font: {
      family: "var(--font-code, Consolas, monospace)",
      color: "var(--sol-base00, #657b83)"
    },
    paper_bgcolor: "var(--sol-base3, #fdf6e3)",
    plot_bgcolor: "var(--sol-base2, #eee8d5)",
    colorway: [
      "var(--sol-blue, #268bd2)",
      "var(--sol-orange, #cb4b16)",
      "var(--sol-green, #859900)",
      "var(--sol-yellow, #b58900)"
    ]
  }
};

export const getThemeColor = (varName, fallback) => {
  if (typeof window !== "undefined") {
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (value) {
      return resolveCssValue(value);
    }
  }
  return fallback;
};

/**
 * 🛠️ Recursive CSS Variable Resolver
 * Resolves up to 3 levels of nested var(--name) calls so that standard Canvas 2D
 * contexts can understand and render them correctly.
 */
export function resolveCssValue(value) {
  if (!value) return "";
  let resolved = value;
  const varRegex = /var\((--[^,)]+)(?:,\s*([^)]+))?\)/g;
  
  for (let i = 0; i < 3; i++) {
    if (!resolved.includes("var(")) break;
    resolved = resolved.replace(varRegex, (match, varName, fallback) => {
      const computed = getComputedStyle(document.documentElement).getPropertyValue(varName.trim()).trim();
      return computed || (fallback ? fallback.trim() : "");
    });
  }
  return resolved;
}

/**
 * 📊 Plotly Solarized Theme Template (Resolved at runtime)
 * Call this function to get a snapshot of the active theme colors.
 */
export const getPlotlyTheme = () => ({
  layout: {
    font: {
      family: getThemeColor("--font-code", "Consolas, monospace"),
      color: getThemeColor("--sol-base00", "#657b83")
    },
    paper_bgcolor: getThemeColor("--sol-base3", "#fdf6e3"),
    plot_bgcolor: getThemeColor("--sol-base2", "#eee8d5"),
    colorway: [
      getThemeColor("--sol-blue", "#268bd2"),
      getThemeColor("--sol-orange", "#cb4b16"),
      getThemeColor("--sol-green", "#859900"),
      getThemeColor("--sol-yellow", "#b58900")
    ]
  }
});

/**
 * 🛠️ FONCTIONS UTILITAIRES PURES
 * Fonctions agnostiques accessibles par toutes les molécules et organismes
 */
export const utils = {
  
  // Génère un ID unique (utile si tu dois lier un label HTML à un input généré par JS)
  generateId: () => 'aptitek_' + Math.random().toString(36).substr(2, 9),
  
  // Formate les nombres proprement avec la méthode standard toLocaleString
  formatNumber: (num, decimals = 3) => typeof num === 'number' ? num.toLocaleString(undefined, { maximumFractionDigits: decimals }) : num,

  // Tronque une chaîne avec la méthode standard slice
  truncateText: (str, maxLength = 50) => typeof str === 'string' && str.length > maxLength ? str.slice(0, maxLength) + "…" : str,

  /**
   * 🎨 Utilitaire d'opacité couleur (Convertit Hex ou RGB en RGBA)
   * Centralisé ici pour être partagé par le Canvas (networks) et l'UI globale.
   */
  rgba: (color, alpha) => {
    if (!color) return color;
    if (color.includes('rgb')) {
      const matches = color.match(/\d+/g);
      if (matches && matches.length >= 3) {
        return `rgba(${matches[0]}, ${matches[1]}, ${matches[2]}, ${alpha})`;
      }
    }
    const hex = color.replace('#', '').trim();
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }

};
/**
 * 📊 Lit un tableau Markdown compilé et le transforme en tableau d'objets JS.
 */
export function parseTableData(selector) {
  const table = document.querySelector(selector);
  if (!table) return [];
  const headers = Array.from(table.querySelectorAll("th")).map(th => th.textContent.trim());
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  return rows.map(row => {
    const cells = Array.from(row.querySelectorAll("td")).map(td => td.innerHTML.trim());
    let rowData = {};
    headers.forEach((h, i) => rowData[h] = cells[i]);
    return rowData;
  });
}

// =====================================================================
// 🧩 MOTEUR DE TEMPLATES GÉNÉRIQUE
// =====================================================================

/**
 * Fonction interne : Remplace les {{variables}} par leurs valeurs
 */
function applyTemplate(htmlString, data) {
  let html = htmlString;
  for (const [key, value] of Object.entries(data)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return html;
}

/**
 * Moteur 1 : Remplit un bloc unique (Ex: une carte de score)
 */
export function renderTemplate(elementOrSelector, data = {}) {
  const container = typeof elementOrSelector === 'string' 
    ? document.querySelector(elementOrSelector) 
    : elementOrSelector;
    
  if (!container) return;

  if (!container.dataset.tpl) container.dataset.tpl = container.innerHTML;
  container.innerHTML = applyTemplate(container.dataset.tpl, data);
}

/**
 * Moteur 2 : Génère une liste d'éléments à partir d'un modèle (Ex: puces de résultats)
 */
export function renderListTemplate(containerSelector, templateSelector, listData = []) {
  const container = document.querySelector(containerSelector);
  const tplElement = document.querySelector(templateSelector);
  
  if (!container || !tplElement) return;

  if (!tplElement.dataset.tpl) tplElement.dataset.tpl = tplElement.innerHTML;
  
  container.innerHTML = ""; // On vide la liste
  
  listData.forEach(data => {
    container.insertAdjacentHTML('beforeend', applyTemplate(tplElement.dataset.tpl, data));
  });
}

// =====================================================================
// 🎯 LOGIQUE SPÉCIFIQUE AU FEEDBACK DE CÂBLAGE
// =====================================================================

/**
 * Orchestrateur : Utilise nos moteurs génériques pour cet exercice
 */
export function renderFeedbackUI(panelSelector, state, listData = []) {
  const panel = document.querySelector(panelSelector);
  if (!panel) return;

  // 1. Affichage global du panneau
  panel.style.display = state.status === "hidden" ? "none" : "block";
  panel.querySelectorAll('.feedback-card').forEach(card => card.style.display = "none");

  if (state.status === "hidden") return;

  // Update header text based on status
  const header = panel.querySelector('.card-header');
  if (header) {
    let title = "Console Système";
    if (state.status === "incomplete") title = "⚠️ Console — Brassage Incomplet";
    else if (state.status === "validated") title = "✅ Console — Diagnostic Réussi";
    else if (state.status === "error") title = "❌ Console — Conflit de Signal";
    
    let titleSpan = header.querySelector('.terminal-header-title');
    if (!titleSpan) {
      titleSpan = document.createElement('span');
      titleSpan.className = 'terminal-header-title';
      titleSpan.style.fontFamily = "var(--font-code, monospace)";
      titleSpan.style.fontSize = "0.85em";
      titleSpan.style.fontWeight = "bold";
      header.appendChild(titleSpan);
    }
    titleSpan.textContent = title;
  }

  // 2. Affichage dynamique de la carte active via le Moteur 1
  const activeCard = panel.querySelector(`.feedback-${state.status}`);
  if (activeCard) {
    activeCard.style.display = "block";
    renderTemplate(activeCard, { score: state.score, total: state.total });
  }

  // 3. Affichage dynamique de la liste (Programmatic DOM creation)
  const detailsContainer = panel.querySelector('.feedback-details');
  if (detailsContainer) {
    detailsContainer.innerHTML = ""; // Clear existing
    
    listData.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'feedback-item terminal-line mb-2';

      // Shell prompt prefix: >
      const prefix = document.createElement('span');
      prefix.className = 'text-muted me-1';
      prefix.textContent = '>';
      itemEl.appendChild(prefix);

      // Label (Left variable)
      const labelEl = document.createElement('strong');
      labelEl.textContent = item.label + ' ';
      itemEl.appendChild(labelEl);

      // mapped to text
      const midText = document.createTextNode('mapped to ');
      itemEl.appendChild(midText);

      // Right label (Assigned scale)
      const rightLabelEl = document.createElement('em');
      rightLabelEl.textContent = item.rightLabel + ' ';
      itemEl.appendChild(rightLabelEl);

      // Status badge: [OK] / [Erreur]
      const badgeEl = document.createElement('span');
      badgeEl.className = `${item.badgeClass} fw-bold`;
      badgeEl.textContent = `[${item.badgeText}]`;
      itemEl.appendChild(badgeEl);

      // Explanation details: └─ ...
      const feedbackEl = document.createElement('div');
      feedbackEl.className = 'text-muted small ps-3 mt-1';
      feedbackEl.textContent = `└─ ${item.feedback}`;
      itemEl.appendChild(feedbackEl);
      detailsContainer.appendChild(itemEl);
    });
  }
}

// =====================================================================
// 🗂️ PANEL-TABSET UTILITIES
// =====================================================================

/**
 * JS fallback: injects Bootstrap Icons into panel-tabset nav-links at runtime.
 *
 * NOTE: With the `bi-icons.lua` Quarto filter active, icons are injected at
 * compile time and this function becomes a no-op (it bails early when it
 * finds an existing `i.bi`). Keep it for runtime-generated tabsets or
 * environments where the Lua filter is not available.
 *
 * @param {string} tabsetSelector  CSS selector for the panel-tabset root.
 */
export function initTabIcons(tabsetSelector) {
  const panes = document.querySelectorAll(`${tabsetSelector} .tab-pane`);
  const links = document.querySelectorAll(`${tabsetSelector} .nav-link`);

  panes.forEach((pane, i) => {
    const link = links[i];
    if (!link || link.querySelector("i.bi")) return; // already present (Lua filter)

    const source = pane.classList.length
      ? pane
      : pane.querySelector("h1, h2, h3, h4, h5, h6");
    if (!source) return;

    const biClass = Array.from(source.classList).find(c => c.startsWith("bi-"));
    if (!biClass) return;

    const icon = document.createElement("i");
    icon.className = `bi ${biClass}`;
    icon.style.marginRight = "5px";
    link.prepend(icon);
  });
}

/**
 * Sets up a fully-managed Quarto panel-tabset reactive watcher.
 *
 * — Maps the active tab's plain-text label to a value via `labelMap`.
 * — Calls `onChange(value)` immediately on init and on every tab click.
 * — Observes Bootstrap's `.active` class mutations (no polling).
 * — Returns `{ destroy() }` for OJS `invalidation` cleanup.
 *
 * Icons are handled by the `bi-icons.lua` Quarto filter at compile time
 * (## Heading {.bi-icon-name}). The label map keys should be the plain
 * text labels without icons, since `<i>` elements have no text content.
 *
 * Usage in OJS:
 * ```js
 * const w = createTabsetWatcher(
 *   ".my-tabset",
 *   { "Label A": "val_a", "Label B": "val_b" },
 *   (val) => { mutable myVar = val; }
 * );
 * invalidation.then(() => w.destroy());
 * ```
 *
 * @param {string}   tabsetSelector  CSS selector for the panel-tabset root.
 * @param {Object}   labelMap        Plain-text tab label → value mapping.
 * @param {Function} onChange        Called with the mapped value on tab change.
 * @returns {{ destroy: Function }}
 */
export function createTabsetWatcher(tabsetSelector, labelMap, onChange) {
  const tabset = document.querySelector(tabsetSelector);
  if (tabset) {
    const links = tabset.querySelectorAll(".nav-link");
    const panes = tabset.querySelectorAll(".tab-pane");

    links.forEach((link, i) => {
      // 1. Nettoie les caractères de remplacement invalides (diamonds / \uFFFD)
      if (link.innerHTML) {
        link.innerHTML = link.innerHTML.replace(/\uFFFD/g, "").trim();
      }

      // 2. Détecte la classe d'icône depuis le panneau ou son titre
      const pane = panes[i];
      if (!pane) return;

      let biClass = Array.from(pane.classList).find(c => c.startsWith("bi-"));
      if (!biClass) {
        const header = pane.querySelector("h1, h2, h3, h4, h5, h6");
        if (header) {
          biClass = Array.from(header.classList).find(c => c.startsWith("bi-"));
        }
      }

      // 3. Injecte l'icône Bootstrap propre comme enfant direct pour hériter des styles actifs
      if (biClass) {
        link.querySelectorAll("i.bi").forEach(icon => icon.remove()); // évite les doublons

        const icon = document.createElement("i");
        icon.className = `bi ${biClass}`;
        icon.style.marginRight = "6px";
        icon.style.transition = "color 0.15s ease";
        link.prepend(icon);
      }
    });
  }

  function syncActive() {
    const active = document.querySelector(`${tabsetSelector} .nav-link.active`);
    if (!active) return;

    // textContent extrait le texte net sans balise <i> — nettoyage final
    const label = active.textContent.replace(/\uFFFD/g, "").trim();
    const val = labelMap[label];
    if (val !== undefined) onChange(val);
  }

  syncActive();

  const nav = document.querySelector(`${tabsetSelector} .nav-tabs`);
  const observer = nav ? new MutationObserver(syncActive) : null;
  if (observer) observer.observe(nav, { subtree: true, attributeFilter: ["class"] });

  return { destroy: () => observer?.disconnect() };
}

// =====================================================================
// 🔘 TAB ACTION BUTTONS (Inject buttons into tabset nav bars from QMD)
// =====================================================================

/**
 * Finds all `.tab-action` divs in the DOM and injects them as styled
 * buttons into the target tabset's `.nav-tabs` bar.
 *
 * QMD usage:
 * ```markdown
 * ::: {#my-btn-id .tab-action data-target=".my-tabset" data-icon="play-fill"}
 * Button Label
 * :::
 * ```
 *
 * - `id`          → becomes the button's DOM id (used by JS to bind actions)
 * - `.tab-action` → marker class, triggers processing
 * - `data-target` → CSS selector for the parent `.panel-tabset`
 * - `data-icon`   → Bootstrap icon name without `bi-` prefix (optional)
 */
export function initTabActions() {
  document.querySelectorAll('.tab-actions').forEach(container => {
    // 1. Locate the target tabset
    const tabset = container.closest('.panel-tabset') || 
                   container.previousElementSibling?.closest('.panel-tabset') ||
                   container.parentElement?.querySelector('.panel-tabset');

    if (!tabset) {
      console.warn("initTabActions: Target tabset not found for actions container.", container);
      return;
    }

    const navTabs = tabset.querySelector('.nav-tabs');
    if (!navTabs) {
      console.warn("initTabActions: Nav tabs container not found in target tabset.");
      return;
    }

    // 2. Relocate any compiled buttons inside the container
    container.querySelectorAll('.btn-tab-action').forEach(btn => {
      const actionLi = document.createElement('li');
      actionLi.className = 'nav-item ms-auto d-flex align-items-center';
      
      // Move the button directly into the nav list
      actionLi.appendChild(btn);
      navTabs.appendChild(actionLi);
    });

    // 3. Hide original container
    container.style.display = 'none';
  });
}


// =====================================================================

/**
 * A highly reusable, lightweight state machine engine for driving step-by-step
 * animations, diagnostics, and structured reactive sequences in simulators.
 */
export class StateMachine {
  constructor(options = {}) {
    this.states = options.states || [];     // Array of state configurations/payloads
    this.currentIndex = 0;
    this.interval = options.interval || 950; // Delay in milliseconds between steps
    this.onStateChange = options.onStateChange || (() => {}); // Transition callback
    this.timer = null;
    this.isPlaying = false;
    this.loop = options.loop !== false;
  }

  /**
   * Starts the state machine execution sequence.
   */
  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    
    // Trigger first state immediately
    this.onStateChange(this.states[this.currentIndex], this.currentIndex);
    this.run();
  }

  /**
   * Internal loop runner.
   */
  run() {
    this.timer = setInterval(() => {
      this.next();
    }, this.interval);
  }

  /**
   * Advances the sequence to the next state, looping if configured.
   */
  next() {
    if (!this.isPlaying) return;
    
    this.currentIndex++;
    if (this.currentIndex >= this.states.length) {
      if (this.loop) {
        this.currentIndex = 0;
      } else {
        this.stop();
        return;
      }
    }
    
    this.onStateChange(this.states[this.currentIndex], this.currentIndex);
  }

  /**
   * Pauses/stops the execution.
   */
  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Resets the execution back to the initial state.
   */
  reset() {
    this.stop();
    this.currentIndex = 0;
    this.onStateChange(this.states[0], 0);
  }
}