// ==========================================
// index.js - Le Point d'Entrée Global
// ==========================================
import { theme, utils } from "./core.js";
import * as plots from "./plots.js";
import * as networks from "./networks.js";
import * as networks3d from "./networks3d.js";
import { createCabling } from "./custom/cabling.js";
import { createRamStorageGraph } from "./custom/ram-storage-graph.js";
import { createAttentionTokenGraph } from "./custom/attention-token-graph.js";
import { createKvPuzzleGraph } from "./custom/kv-puzzle-graph.js";

const networkExports = {
  ...networks,
  ...networks3d,
  createCabling,
  createRamStorageGraph,
  createAttentionTokenGraph,
  createKvPuzzleGraph
};

// Top-level exports matching deeplearning dependency system
export {
  theme,
  solarizedTemplate,
  getThemeColor,
  resolveCssValue,
  getPlotlyTheme,
  utils,
  parseTableData,
  renderTemplate,
  renderListTemplate,
  renderFeedbackUI,
  initTabIcons,
  createTabsetWatcher,
  initTabActions,
  StateMachine,
  createSlider
} from "./core.js";

export {
  createTokenStream,
  createVerticalDragToggle
} from "./components.js";

export {
  encodeValueToBytes,
  groupBytesIntoSlots,
  tokenizeText
} from "./encoding.js";

export {
  getBackgroundImageUrl,
  loadInlineSvg,
  bindSvgElements,
  bindSvgToTabs,
  applySvgState,
  initInteractiveSvg
} from "./svg.js";

export {
  createGraph,
  createWordCloud,
  renderStateMachineGraph
} from "./networks.js";

export {
  create3DPieceGraph
} from "./networks3d.js";

export { createCabling } from "./custom/cabling.js";
export { createRamStorageGraph } from "./custom/ram-storage-graph.js";
export { createAttentionTokenGraph } from "./custom/attention-token-graph.js";
export { createKvPuzzleGraph } from "./custom/kv-puzzle-graph.js";

export {
  createBar,
  createStackedBar,
  createLine,
  createGradientLine,
  createAttentionHeatmap,
  createFunnel,
  createPiramid,
  createVuMeter,
  createMultiLine
} from "./plots.js";

export { registerTabset } from "./custom/card.js";
export { createMagnifyingDocument } from "./custom/document.js";
export { createDynamicSvg, bindSvgToTabset } from "./custom/dynamic-svg.js";
export { createLever } from "./custom/lever.js";
export { createMetricsCards, updateMetricsCards } from "./custom/metrics.js";
export { initMoboSvg, renderMobo } from "./custom/mobo.js";
export { getRamData, renderRam } from "./custom/ram.js";
export { createSimulationControl } from "./custom/simulation-control.js";
export { createSparsitySimulator } from "./custom/sparsity.js";
export { createSvgDistanceHandle } from "./custom/svg-distance-handle.js";
export { createVectorDemo } from "./custom/vector-demo.js";
export {
  renderMeanGraph,
  renderQuartileMedianGraph,
  renderVarianceGraph,
  renderStandardDeviationGraph
} from "./custom/statistics.js";
export { createTerminal } from "./custom/terminal.js";
export { createLabeledText } from "./custom/text.js";
export { updateAutoencoderViz } from "./custom/autoencoder.js";
export { renderLatentInterpolation, renderVqVaeMetrics, renderVqVaeCodebook, generateVqCodebook } from "./custom/vae.js";
export { updateKLViz } from "./custom/kl-divergence.js";
export { createReparamViz } from "./custom/reparam.js";


//TODO: Delete ui entirely and use the new system with default quarto tags and such in the qmd files
export const ui = {
  // Briques indivisibles (inlinées pour simplicité et compatibilité)
  text: ({ content, type = "body", color = "inherit" }) => {
    const classMap = {
      title: "font-size: 1.4em; font-weight: bold; margin-bottom: 0.5em;",
      label: "card-header", 
      value: "value",
      body: "font-size: 1em;"
    };
    const className = classMap[type] || "";
    const styleAttr = color !== "inherit" ? `style="color: ${color};"` : "";
    return `<div class="${className} text-${type}" ${styleAttr}>${content}</div>`;
  },
  badge: ({ text, colorClass = "" }) => `
    <span class="badge ${colorClass}">${text}</span>
  `,
  progressBar: ({ value, max = 100, colorClass = "" }) => {
    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    return `
      <div class="progress">
        <div class="progress-bar ${colorClass}" style="width: ${percent}%;"></div>
      </div>
    `;
  },
  dataBlock: ({ type = "train" }) => {
    const colorClass = type === "train" ? "is-info" : (type === "test" ? "is-success" : "");
    return `<div class="badge ${colorClass} is-block"></div>`;
  },
  terminalWindow: ({ header = "Console", content = "" }) => `
    <div class="card card-window" style="border: 1px solid var(--sol-base1); background: var(--sol-base3);">
      <div class="card-header card-window-header">${header}</div>
      <div class="card-body" style="background: var(--sol-base2); padding: 15px; min-height: 100px;">
        ${content}
      </div>
    </div>
  `,
  logLine: ({ message, prefix = ">", type = "info" }) => {
    const textClass = type === "danger" ? "text-danger" : (type === "warning" ? "text-warning" : (type === "muted" ? "text-muted" : "text-success"));
    return `<div class="${textClass}" style="font-family: var(--font-code, monospace); margin-bottom: 4px;">${prefix} ${message}</div>`;
  },
  button: ({ label }) => `
    <button class="btn btn-warning">${label}</button>
  `,
  multitab: ({ options = [], value = "", colorClass = "is-info" }) => {
    const container = document.createElement("div");
    container.className = "multitab-container";
    const activeColor = colorClass === "is-info" ? "var(--sol-blue)" : "var(--sol-green)";
    container.style.setProperty("--multitab-active-color", activeColor);

    let activeValue = value || options[0] || "";
    container.value = activeValue;

    const buttons = options.map(opt => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `multitab-btn${opt === activeValue ? " is-active" : ""}`;
      btn.textContent = opt;
      btn.opt = opt;
      btn.addEventListener("click", () => {
        if (container.value === opt) return;
        container.value = opt;
        buttons.forEach(b => b.classList.toggle("is-active", b.opt === opt));
        container.dispatchEvent(new Event("input", { bubbles: true }));
      });
      container.appendChild(btn);
      return btn;
    });
    return container;
  },
  label: (text) => {
    const el = document.createElement('span');
    el.className = 'label';
    el.innerText = text;
    return el;
  },

  // Inlined mol components
  terminalConsole: ({ header = "Processus", logs = [] }) => {
    const logContent = logs.map((log, index) => {
      const delay = (index * 0.2).toFixed(2);
      let message = "";
      let type = "info";
      if (typeof log === 'string') {
        message = log;
      } else if (log) {
        message = log.message || "";
        type = log.type || "info";
      }
      const textClass = type === "danger" ? "text-danger" : (type === "warning" ? "text-warning" : (type === "muted" ? "text-muted" : "text-success"));
      return `<div class="${textClass} reveal-lines" style="animation-delay: ${delay}s; font-family: var(--font-code, monospace); margin-bottom: 4px;">&gt; ${message}</div>`;
    }).join('');

    return `
      <div class="card card-window" style="border: 1px solid var(--sol-base1); background: var(--sol-base3);">
        <div class="card-header card-window-header">${header}</div>
        <div class="card-body" style="background: var(--sol-base2); padding: 15px; min-height: 100px;">
          ${logContent || '<div class="text-muted" style="font-family: var(--font-code, monospace);">&gt; Aucune donnée</div>'}
        </div>
      </div>
    `;
  },
  metricCard: ({ title, value, subtitle = "", trend = "neutral" }) => {
    const trendClassMap = {
      positive: "text-success",
      negative: "text-danger",
      warning: "text-warning",
      neutral: "text-info"
    };
    const colorClass = trendClassMap[trend] || trendClassMap.neutral;

    return `
      <div class="card card-metric">
        <div class="card-metric-title">${title}</div>
        <div class="card-metric-value ${colorClass}">${utils.formatNumber(value)}</div>
        ${subtitle ? `<div class="text-muted" style="font-size: 0.85em;">${subtitle}</div>` : ''}
      </div>
    `;
  },
  dataRow: ({ index, dataObject }) => {
    const columnsHtml = Object.entries(dataObject).map(([key, value]) => {
      const typeObj = typeof value;
      
      return `
        <div class="col-sm-6 col-md-4 col-lg-3 mb-2">
          <div class="small text-muted text-uppercase" style="font-size: 0.7em;">${key}</div>
          <div class="d-flex align-items-center gap-2">
            <span class="text-truncate fw-semibold text-body" title="${value}">${utils.truncateText(String(value), 30)}</span>
            <span class="badge bg-light text-dark font-monospace" style="font-size: 0.65em; border: 1px solid var(--sol-base1, rgba(88, 110, 117, 0.1));">${typeObj}</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="card mb-3 shadow-none border" style="border: 1px solid var(--sol-base1, rgba(88, 110, 117, 0.12)); background: var(--sol-base3, #fdf6e3);">
        <div class="card-header bg-light py-1 px-3 d-flex justify-content-between align-items-center" style="background-color: var(--sol-base2, #eee8d5) !important; border-bottom: 1px solid var(--sol-base1, rgba(88, 110, 117, 0.08));">
          <span class="small fw-bold text-uppercase text-muted" style="font-size: 0.75em; color: var(--sol-base01, #93a1a1) !important;">Index: ${index}</span>
        </div>
        <div class="card-body py-2 px-3">
          <div class="row">
            ${columnsHtml}
          </div>
        </div>
      </div>
    `;
  },
  vectorSpace: ({ content = "", height = "250px", label = "Espace Vectoriel" }) => `
    <div class="card card-window mb-4">
      ${label ? `<div class="card-header card-window-header">${label}</div>` : ''}
      <div class="card-body p-0">
        <div class="canvas border-0 m-0 rounded-0" style="height: ${height}; min-height: ${height};">
          ${content}
        </div>
      </div>
    </div>
  `,
  comparisonLayout: ({ leftTitle, leftContent, rightTitle, rightContent }) => `
    <div class="row align-items-center mb-4">
      <div class="col-md-5 mb-3 mb-md-0">
        <div class="card card-window m-0">
          <div class="card-header card-window-header">${leftTitle}</div>
          <div class="card-body">${leftContent}</div>
        </div>
      </div>
      <div class="col-md-2 text-center mb-3 mb-md-0" style="font-size: 1.5rem;">
        ➡️
      </div>
      <div class="col-md-5">
        <div class="card card-window m-0">
          <div class="card-header card-window-header">${rightTitle}</div>
          <div class="card-body">${rightContent}</div>
        </div>
      </div>
    </div>
  `,
  toggle: ({ label: labelText, options, value, states, layout = 'horizontal' }) => {
    const container = document.createElement('div');
    container.className = `d-flex ${layout === 'horizontal' ? 'align-items-center gap-3' : 'flex-column gap-2'} mb-3`;

    if (labelText) {
      const labelEl = document.createElement('span');
      labelEl.className = 'toggle-label fw-bold small text-muted text-uppercase';
      labelEl.innerText = labelText;
      container.appendChild(labelEl);
    }

    const group = document.createElement('div');
    group.className = 'btn-group';
    group.setAttribute('role', 'group');

    const isObjectOptions = !Array.isArray(options);
    const keys = isObjectOptions ? Object.keys(options) : options;

    keys.forEach(key => {
      const displayValue = isObjectOptions ? options[key] : key;
      const btn = document.createElement('button');
      btn.type = 'button';
      
      // Choose standard Bootstrap button styles based on state
      let btnOutlineClass = 'btn-outline-primary';
      if (states && states[key]) {
        const state = states[key];
        if (state === 'success') btnOutlineClass = 'btn-outline-success';
        else if (state === 'danger') btnOutlineClass = 'btn-outline-danger';
        else if (state === 'warning') btnOutlineClass = 'btn-outline-warning';
        else if (state === 'info') btnOutlineClass = 'btn-outline-info';
      }
      
      btn.className = `btn btn-sm ${btnOutlineClass} ${key === value ? 'active' : ''}`;
      btn.innerText = displayValue;
      
      btn.onclick = () => {
        if (container.value === key) return;
        group.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        container.value = key;
        container.dispatchEvent(new Event("input", { bubbles: true }));
      };
      group.appendChild(btn);
    });

    container.appendChild(group);
    container.value = value;
    return container;
  },

  plots,
  networks: networkExports,
  
  // Alias directs à la racine
  ...plots,
  ...networkExports,
  
  // 3. Source de vérité dynamique pour les couleurs CSS
  get colors() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return {};
    }
    const getCssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return {
      green: getCssVar('--sol-green'),
      blue: getCssVar('--sol-blue'),
      orange: getCssVar('--sol-orange'),
      red: getCssVar('--sol-red'),
      yellow: getCssVar('--sol-yellow'),
      base03: getCssVar('--sol-base03'),
      base02: getCssVar('--sol-base02'),
      base01: getCssVar('--sol-base01'),
      base00: getCssVar('--sol-base00'),
      base0: getCssVar('--sol-base0'),
      base1: getCssVar('--sol-base1'),
      base2: getCssVar('--sol-base2'),
      base3: getCssVar('--sol-base3'),
      violet: getCssVar('--sol-violet'),
      cyan: getCssVar('--sol-cyan'),
      magenta: getCssVar('--sol-magenta')
    };
  },

  // 4. Configurations graphiques globales (Source de vérité visuelle)
  get chart() {
    return {
      height: "350px",
      lineWidth: 3,
      markerSize: 12,
      markerLineWidth: 2
    };
  },

  // 5. Utilitaire vital pour qu'Observable (OJS) affiche du HTML brut
  render: (htmlString) => {
    const container = document.createElement('div');
    container.innerHTML = htmlString;
    return container;
  },

  // 6. Utilitaire d'opacité couleur pour Plotly et OJS (Convertit Hex ou RGB en RGBA)
  rgba: (color, alpha) => utils.rgba(color, alpha),
};

// Global fallback for OJS
if (typeof window !== "undefined") {
  window.ui = ui;
  window.theme = theme;
}

// ==========================================
// 11. DYNAMIC CODE BLOCKS DECORATOR (Tabs & macOS Controls)
// ==========================================

const decorateCodeBlocks = () => {
  if (typeof document === "undefined") return;
  
  // 1. Process Quarto code blocks with custom filenames
  const filenameWrappers = document.querySelectorAll(".code-with-filename");
  filenameWrappers.forEach(wrapper => {
    // If wrapper is inside a tabset, skip filename/header addition and let tabset handle it!
    if (wrapper.closest(".tab-pane")) {
      const fileDiv = wrapper.querySelector(".code-with-filename-file");
      if (fileDiv) fileDiv.classList.add("d-none");
      return;
    }
    
    const fileDiv = wrapper.querySelector(".code-with-filename-file");
    const sourceCode = wrapper.querySelector("div.sourceCode");
    if (fileDiv && sourceCode) {
      const filename = fileDiv.textContent.trim();
      fileDiv.classList.add("d-none"); // Hide standard Quarto filename label
      
      const pre = sourceCode.querySelector("pre");
      if (pre && !pre.dataset.hasHeader) {
        // Determine language from pre/code class list
        let lang = "code";
        pre.classList.forEach(cls => {
          if (cls !== "sourceCode" && cls !== "code-with-filename" && cls !== "cell-code" && cls !== "code-with-copy") {
            lang = cls;
          }
        });
        const lowerLang = lang.toLowerCase();
        
        // Choose tab icon and window theme based on language/filename
        const isDark = (lowerLang === "sh" || lowerLang === "bash" || filename.endsWith(".sh") || filename.endsWith(".bash"));
        let icon = "bi-file-earmark-code";
        if (isDark) {
          icon = "bi-terminal-fill";
          sourceCode.classList.add("window-dark");
        } else {
          sourceCode.classList.add("window-light");
        }
        
        const header = document.createElement("div");
        header.className = "code-header window-header";
        header.innerHTML = `
          <div class="code-tabs">
            <div class="code-tab">
              <i class="bi ${icon} code-tab-icon"></i>
              <span class="code-tab-title">${filename}</span>
            </div>
          </div>
        `;
        pre.parentNode.insertBefore(header, pre);
        pre.dataset.hasHeader = "true";
      }
    }
  });

  // 2. Process all other standard Quarto code blocks
  const codeDivs = document.querySelectorAll("div.sourceCode");
  codeDivs.forEach(div => {
    // If inside a tabset pane, skip decoration completely!
    if (div.closest(".tab-pane")) return;
    
    const pre = div.querySelector("pre");
    if (!pre || pre.dataset.hasHeader === "true") return;
    
    // Determine language from pre/code class list
    let lang = "code";
    pre.classList.forEach(cls => {
      if (cls !== "sourceCode" && cls !== "code-with-filename" && cls !== "cell-code" && cls !== "code-with-copy") {
        lang = cls;
      }
    });
    
    // Capitalize beautifully and map specific short names
    let displayLang = lang;
    const lowerLang = lang.toLowerCase();
    if (lowerLang === "py" || lowerLang === "python") displayLang = "Python";
    else if (lowerLang === "js" || lowerLang === "javascript") displayLang = "JavaScript";
    else if (lowerLang === "sh" || lowerLang === "bash") displayLang = "Terminal";
    else if (lowerLang === "yml" || lowerLang === "yaml") displayLang = "YAML";
    else if (lowerLang === "html") displayLang = "HTML";
    else if (lowerLang === "css") displayLang = "CSS";
    else if (lowerLang === "scss") displayLang = "SCSS";
    else if (lowerLang === "json") displayLang = "JSON";
    else if (lowerLang === "r") displayLang = "R";
    else if (lowerLang === "sql") displayLang = "SQL";
    else displayLang = lang.charAt(0).toUpperCase() + lang.slice(1);
    
    // Choose tab icon and window theme based on language
    let icon = "bi-file-earmark-code";
    const isDark = (lowerLang === "sh" || lowerLang === "bash");
    if (isDark) {
      icon = "bi-terminal-fill";
      div.classList.add("window-dark");
    } else {
      div.classList.add("window-light");
    }
    
    const header = document.createElement("div");
    header.className = "code-header window-header";
    header.innerHTML = `
      <div class="code-tabs">
        <div class="code-tab">
          <i class="bi ${icon} code-tab-icon"></i>
          <span class="code-tab-title">${displayLang}</span>
        </div>
      </div>
    `;
    pre.parentNode.insertBefore(header, pre);
    pre.dataset.hasHeader = "true";
  });

  // 3. Mark Pyodide interactive exercises with our unified header class
  const exercises = document.querySelectorAll(".card.exercise-editor");
  exercises.forEach(ex => {
    const header = ex.querySelector(".card-header");
    if (header) {
      header.classList.add("window-header");
      header.classList.add("pyodide-header");
      ex.classList.add("window-light"); // Make exercise-editor explicitly light theme!
    }
  });
};

const translateExerciseButtons = (header) => {
  if (!header) return;
  const parentCard = header.closest(".card.exercise-editor");
  if (!parentCard) return;
  
  const buttons = parentCard.querySelectorAll("button, a.btn");
  buttons.forEach(btn => {
    const textNodes = [];
    const walk = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walk.nextNode()) {
      textNodes.push(node);
    }
    
    textNodes.forEach(node => {
      const text = node.textContent.trim().toUpperCase();
      if (text === "START OVER") {
        node.textContent = " Recommencer";
      } else if (text === "RUN CODE") {
        node.textContent = " Exécuter";
      }
    });
  });
};

const decorateExerciseHeader = (header) => {
  if (!header) return;
  
  // If already decorated, skip to avoid duplicate tabs or infinite recursion
  if (header.querySelector(".code-tabs")) {
    translateExerciseButtons(header);
    return;
  }
  
  // Find any inner div containing exactly the title "Exercise" to remove it
  const titleDivs = header.querySelectorAll("div");
  titleDivs.forEach(div => {
    const text = div.textContent.trim().toLowerCase();
    if (text === "exercise" && div.childNodes.length === 1 && div.childNodes[0].nodeType === Node.TEXT_NODE) {
      div.classList.add("d-none");
    }
  });

  // Extract and clear direct text nodes just in case
  const childNodes = Array.from(header.childNodes);
  for (const node of childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const trimmed = node.textContent.trim().toLowerCase();
      if (trimmed.includes("exercise")) {
        node.textContent = "";
      }
    }
  }
  
  // Create tabs container
  const tabsContainer = document.createElement("div");
  tabsContainer.className = "code-tabs";
  tabsContainer.innerHTML = `
    <div class="code-tab">
      <i class="bi bi-cpu-fill code-tab-icon"></i>
      <span class="code-tab-title">Exercice</span>
    </div>
  `;
  
  // Prepend the tab container at the very beginning of the header
  header.prepend(tabsContainer);
  translateExerciseButtons(header);
};

const setupExerciseObserver = () => {
  if (typeof document === "undefined") return;
  
  const runDecoration = () => {
    const headers = document.querySelectorAll(".card.exercise-editor .card-header");
    headers.forEach(header => {
      decorateExerciseHeader(header);
      translateExerciseButtons(header);
    });
  };

  // Run immediately
  runDecoration();
  
  // 1. Observe DOM mutations (for performance and responsiveness)
  const observer = new MutationObserver(runDecoration);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // 2. Poll periodically (fail-proof fallback against React/Preact Virtual DOM overrides on status/run changes)
  setInterval(runDecoration, 150);
};

// Robust initial execution
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      decorateCodeBlocks();
      setupExerciseObserver();
    });
  } else {
    decorateCodeBlocks();
    setupExerciseObserver();
  }
}