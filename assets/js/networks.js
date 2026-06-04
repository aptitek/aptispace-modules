// ==========================================
// networks.js - Composants de Réseaux et de Graphes
// ==========================================
import ForceGraph from "https://esm.sh/force-graph";
import ForceGraph3D from "https://esm.sh/3d-force-graph";
import SpriteText from "https://esm.sh/three-spritetext";
import TagCloud from "https://esm.sh/TagCloud";
import { getThemeColor, resolveCssValue, utils, StateMachine } from "./core.js";

const SOL_FALLBACKS = {
  base03: "#002b36", base02: "#073642", base01: "#586e75", base00: "#657b83",
  base0: "#839496", base1: "#93a1a1", base2: "#eee8d5", base3: "#fdf6e3",
  yellow: "#b58900", orange: "#cb4b16", red: "#dc322f", magenta: "#d33682",
  violet: "#6c71c4", blue: "#268bd2", cyan: "#2aa198", green: "#859900"
};

/**
 * Helper to draw a rounded rectangle on a 2D Canvas context.
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 🕸️ Force-Directed Graph (2D or 3D)
 * Creates and returns a highly customizable graph instance mounted on the given container.
 * Moves all generic graph logic, styling parameters, custom shapes, borders, labels, backing circles,
 * and overlays into this single generic function.
 *
 * @param {HTMLElement|string} container - Target container.
 * @param {Object} graphData - { nodes, links } structure.
 * @param {Object|boolean} optionsOr3d - Custom parameters or boolean for is3D compatibility.
 * @returns {Object} The ForceGraph instance.
 */
export function createGraph(container, graphData, optionsOr3d = {}) {
  // 1. Resolve container target element and clear previous content (OJS safe)
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) {
    console.warn("createGraph: Target container not found.", container);
    return null;
  }
  targetEl.innerHTML = "";

  let is3D = false;
  let customOptions = {};
  if (typeof optionsOr3d === "boolean") {
    is3D = optionsOr3d;
  } else if (optionsOr3d && typeof optionsOr3d === "object") {
    is3D = !!optionsOr3d.is3D;
    customOptions = optionsOr3d;
  }

  // 2. Build default options and style parameters
  const options = {
    nodeRadius: 16,
    nodeBorderWidth: 2,
    nodeShape: "circle",
    fontSize: 10,
    fontFamily: "var(--font-code, Consolas, monospace)",
    linkWidth: 2,
    linkArrowLength: 6,
    cooldownTicks: 120,
    enableZoom: true,
    enablePan: true,
    enableDrag: true,
    zoomToFit: false,
    zoomToFitPadding: 50,
    getNodeStatus: (node) => node.status || "default",
    getLinkStatus: (link) => link.status || "default",
    getNodeLabel: (node) => node.label || node.id,
    getNodeShape: (node) => node.shape || options.nodeShape || "circle",
    getLinkLabel: (link) => link.label || "",
    getLinkCondition: (link) => link.condition,
    onNodeClick: null,
    styles: {},
    ...customOptions
  };

  // Helper to resolve CSS variables at runtime
  const resolveColor = (colorStr, fallback) => {
    return resolveCssValue(colorStr) || fallback;
  };

  // Deep merge style states
  const styles = {};
  const defaultStyles = {
    default: {
      nodeBg: "var(--sol-base3)",
      nodeBorder: "var(--sol-base01)",
      nodeText: "var(--sol-base00)",
      linkStroke: "var(--sol-base1)",
      linkText: "var(--sol-base01)",
      particles: 0,
      particleColor: "var(--sol-base1)",
      particleWidth: 2,
      particleSpeed: 0.01
    }
  };

  const allStates = Array.from(new Set([
    "default",
    ...Object.keys(options.styles || {})
  ]));
  for (const state of allStates) {
    styles[state] = {
      ...(defaultStyles.default),
      ...(options.styles[state] || {})
    };
  }

  // 3. Render 3D if requested
  if (is3D) {
    const graph = ForceGraph3D()(targetEl)
      .graphData(graphData)
      .nodeThreeObject(node => {
        const label = options.getNodeLabel(node);
        const sprite = new SpriteText(label);
        const status = options.getNodeStatus(node);
        const style = styles[status] || styles.default;
        sprite.color = resolveColor(node.color || style.nodeText || "white", "white");
        sprite.textHeight = options.fontSize || 8;
        return sprite;
      });
    return graph;
  }

  // 4. Render 2D with premium, custom high-fidelity visuals
  const graph = ForceGraph()(targetEl)
    .graphData(graphData)
    .cooldownTicks(options.cooldownTicks)
    .enableZoomInteraction(options.enableZoom)
    .enablePanInteraction(options.enablePan)
    .enableNodeDrag(options.enableDrag)
    .linkDirectionalArrowLength(options.linkArrowLength)
    .linkDirectionalArrowRelPos(1);

  if (options.width) graph.width(options.width);
  if (options.height) graph.height(options.height);

  // Link basic properties
  graph
    .linkColor((link) => {
      const status = options.getLinkStatus(link);
      const style = styles[status] || styles.default;
      return resolveColor(link.color || link.stroke || style.linkStroke, "#586e75");
    })
    .linkWidth((link) => {
      const status = options.getLinkStatus(link);
      return status === "current" ? options.linkWidth * 1.5 : options.linkWidth;
    })
    .linkDirectionalArrowColor((link) => {
      const status = options.getLinkStatus(link);
      const style = styles[status] || styles.default;
      return resolveColor(link.color || link.stroke || style.linkStroke, "#586e75");
    });

  // Dynamic flow particles based on link status
  graph
    .linkDirectionalParticles((link) => {
      const status = options.getLinkStatus(link);
      const style = styles[status] || styles.default;
      return style.particles || 0;
    })
    .linkDirectionalParticleColor((link) => {
      const status = options.getLinkStatus(link);
      const style = styles[status] || styles.default;
      return resolveColor(link.color || link.particleColor || style.particleColor || style.linkStroke, "#2aa198");
    })
    .linkDirectionalParticleWidth((link) => {
      const status = options.getLinkStatus(link);
      const style = styles[status] || styles.default;
      return style.particleWidth || 2;
    })
    .linkDirectionalParticleSpeed((link) => {
      const status = options.getLinkStatus(link);
      const style = styles[status] || styles.default;
      return style.particleSpeed || 0.01;
    });

  // 4. Custom Node Drawing: nodeCanvasObject
  const defineNodePath = (ctx, x, y, shape, r, scale = 1.0) => {
    ctx.beginPath();
    const radius = r * scale;

    switch (shape) {
      case "square":
        ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
        break;
      case "rect": {
        const w = radius * 2.6;
        const h = radius * 1.5;
        ctx.rect(x - w / 2, y - h / 2, w, h);
        break;
      }
      case "rounded rect": {
        const w = radius * 2.6;
        const h = radius * 1.5;
        const cr = Math.min(w, h) * 0.2;
        drawRoundedRect(ctx, x - w / 2, y - h / 2, w, h, cr);
        break;
      }
      case "pill": {
        const w = radius * 3.0;
        const h = radius * 1.4;
        drawRoundedRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
        break;
      }
      case "oval": {
        const rx = radius * 1.4;
        const ry = radius * 0.9;
        ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
        break;
      }
      case "diamond": {
        const size = radius * 1.35;
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
        break;
      }
      case "circle":
      default:
        ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
        break;
    }
  };

  graph.nodeCanvasObject((node, ctx, globalScale) => {
    const status = options.getNodeStatus(node);
    const shape = options.getNodeShape(node);
    const style = styles[status] || styles.default;
    
    const rawBg = node.color || node.nodeBg || style.nodeBg || style.color;
    const rawBorder = node.borderColor || node.nodeBorder || node.border || style.nodeBorder || style.border;
    const rawText = node.textColor || node.nodeText || style.nodeText;

    const nodeBg = resolveColor(rawBg, "#eee8d5");
    const nodeBorder = resolveColor(rawBorder, "#586e75");
    const nodeText = resolveColor(rawText, "#657b83");
    
    const r = options.nodeRadius;

    ctx.save();

    // Pulse effect for the 'current' active node using system clock
    if (status === "current") {
      const pulseFactor = 1 + 0.1 * Math.sin(Date.now() / 150);

      defineNodePath(ctx, node.x, node.y, shape, r, pulseFactor + 0.2);
      ctx.fillStyle = utils.rgba(nodeBorder, 0.15);
      ctx.fill();

      ctx.shadowColor = nodeBorder;
      ctx.shadowBlur = 15;
    }

    // Opaque background backing path to hide the link lines underneath
    defineNodePath(ctx, node.x, node.y, shape, r, 1.0);
    ctx.fillStyle = resolveColor("var(--sol-base3)", "#fdf6e3");
    ctx.fill();

    // Main shape Background
    defineNodePath(ctx, node.x, node.y, shape, r, 1.0);
    ctx.fillStyle = nodeBg;
    ctx.fill();

    // Node Border Outline
    defineNodePath(ctx, node.x, node.y, shape, r, 1.0);
    ctx.lineWidth = options.nodeBorderWidth / Math.min(1, globalScale);
    ctx.strokeStyle = nodeBorder;
    ctx.stroke();

    // Text Label inside Node
    const label = options.getNodeLabel(node);
    if (label) {
      const fSize = options.fontSize;
      ctx.font = `bold ${fSize}px ${options.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = nodeText;
      
      let maxTextWidth = r * 1.8;
      if (shape === "rect" || shape === "rounded rect") maxTextWidth = r * 2.3;
      if (shape === "pill") maxTextWidth = r * 2.6;
      if (shape === "oval") maxTextWidth = r * 2.2;
      
      let text = label;
      
      let textWidth = ctx.measureText(text).width;
      if (textWidth > maxTextWidth) {
        while (text.length > 3 && textWidth > maxTextWidth) {
          text = text.slice(0, -1);
          textWidth = ctx.measureText(text + "…").width;
        }
        text = text + "…";
      }
      ctx.fillText(text, node.x, node.y);
    }

    ctx.restore();
  });

  // 5. Custom Link Overlay Elements (Labels & Conditional Tags) in 'after' mode
  const hasLinkOverlays = graphData.links.some(l => 
    options.getLinkLabel(l) || 
    (options.getLinkCondition && options.getLinkCondition(l)) || 
    l.condition !== undefined
  );

  if (hasLinkOverlays) {
    graph.linkCanvasObjectMode(() => "after");
    graph.linkCanvasObject((link, ctx, globalScale) => {
      const { source, target } = link;
      if (typeof source !== "object" || typeof target !== "object") return;

      const status = options.getLinkStatus(link);
      const style = styles[status] || styles.default;

      // ================= DRAW LINK CONDITION TAG =================
      const condition = options.getLinkCondition ? options.getLinkCondition(link) : link.condition;
      if (condition !== undefined && condition !== null) {
        let isTrue = false;
        let condLabel = "";

        if (typeof condition === "object") {
          isTrue = !!condition.value;
          condLabel = condition.label || (isTrue ? "Vrai" : "Faux");
        } else {
          isTrue = !!condition;
          condLabel = isTrue ? "Vrai" : "Faux";
        }

        const startT = 0.25;
        const startX = source.x + (target.x - source.x) * startT;
        const startY = source.y + (target.y - source.y) * startT;

        ctx.save();
        ctx.translate(startX, startY);

        const tagFontSize = Math.max(3.5, options.fontSize - 1.5);
        ctx.font = `bold ${tagFontSize}px ${options.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textWidth = ctx.measureText(condLabel).width;
        const pillH = tagFontSize + 4;
        const pillW = textWidth + 6;

        const tagBg = isTrue ? "rgba(133, 153, 0, 0.15)" : "rgba(220, 50, 47, 0.15)";
        const tagBorder = resolveColor(isTrue ? "var(--sol-green)" : "var(--sol-red)", isTrue ? "#859900" : "#dc322f");
        const tagText = tagBorder;

        ctx.beginPath();
        drawRoundedRect(ctx, -pillW / 2, -pillH / 2, pillW, pillH, 3);
        ctx.fillStyle = resolveColor("var(--sol-base3)", "#fdf6e3");
        ctx.fill();

        ctx.beginPath();
        drawRoundedRect(ctx, -pillW / 2, -pillH / 2, pillW, pillH, 3);
        ctx.fillStyle = tagBg;
        ctx.fill();
        
        ctx.lineWidth = 1;
        ctx.strokeStyle = tagBorder;
        ctx.stroke();

        ctx.fillStyle = tagText;
        ctx.fillText(condLabel, 0, 0);

        ctx.restore();
      }

      // ================= DRAW LINK CENTER LABEL =================
      const label = options.getLinkLabel(link);
      if (label) {
        const linkText = resolveColor(style.linkText, "#657b83");
        const labelBg = resolveColor("var(--sol-base3)", "#fdf6e3");

        const x = source.x + (target.x - source.x) * 0.5;
        const y = source.y + (target.y - source.y) * 0.5;

        ctx.save();
        
        const fSize = Math.max(4, options.fontSize - 1);
        ctx.font = `${fSize}px ${options.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textWidth = ctx.measureText(label).width;
        const paddingX = 4;
        const paddingY = 2;
        const rectW = textWidth + paddingX * 2;
        const rectH = fSize + paddingY * 2;

        ctx.fillStyle = labelBg;
        ctx.strokeStyle = resolveColor(style.linkStroke, "#586e75");
        ctx.lineWidth = 1;
        
        drawRoundedRect(ctx, x - rectW / 2, y - rectH / 2, rectW, rectH, rectH / 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = linkText;
        ctx.fillText(label, x, y);

        ctx.restore();
      }
    });
  }

  // Click Handler
  if (options.onNodeClick) {
    graph.onNodeClick((node, event) => {
      options.onNodeClick(node, event);
    });
  }

  // Zoom to Fit
  if (options.zoomToFit) {
    setTimeout(() => {
      try {
        graph.zoomToFit(400, options.zoomToFitPadding);
      } catch (err) {
        console.warn("zoomToFit error:", err);
      }
    }, 150);
  }

  return graph;
}

/**
 * ☁️ 3D Interactive Word Cloud
 * Creates and returns a TagCloud instance mounted on the given container.
 */
export function createWordCloud(containerSelector, words, options = {}) {
  const container = document.querySelector('#' + containerSelector);
  if (!container) {
    console.warn(`createWordCloud: element #${containerSelector} not found.`);
    return null;
  }

  container.innerHTML = ""; // clear before re-render to avoid OJS duplicates

  const finalOptions = {
    radius: 100,
    maxSpeed: 'normal',
    initSpeed: 'normal',
    keep: true,
    ...options
  };

  const tagCloudInstance = TagCloud(container, words, finalOptions);

  // Apply beautiful custom coloring to words
  const items = container.querySelectorAll('.tagcloud--item');
  items.forEach(item => {
    const text = item.textContent.trim().toLowerCase();
    
    // 1. Specific colors for color names (French & English)
    const colorMap = {
      // French
      'rouge': 'var(--sol-red, #dc322f)',
      'bleu': 'var(--sol-blue, #268bd2)',
      'vert': 'var(--sol-green, #859900)',
      'jaune': 'var(--sol-yellow, #b58900)',
      'orange': 'var(--sol-orange, #cb4b16)',
      'violet': 'var(--sol-violet, #6c71c4)',
      'rose': 'var(--sol-magenta, #d33682)',
      'cyan': 'var(--sol-cyan, #2aa198)',
      'magenta': 'var(--sol-magenta, #d33682)',
      // English
      'red': 'var(--sol-red, #dc322f)',
      'blue': 'var(--sol-blue, #268bd2)',
      'green': 'var(--sol-green, #859900)',
      'yellow': 'var(--sol-yellow, #b58900)',
      'purple': 'var(--sol-violet, #6c71c4)',
      'pink': 'var(--sol-magenta, #d33682)'
    };

    if (colorMap[text]) {
      item.style.color = colorMap[text];
      item.style.fontWeight = 'bold';
    } else {
      // 2. Cohesive theme palette for non-color-name words
      const palette = [
        'var(--sol-cyan, #2aa198)',
        'var(--sol-violet, #6c71c4)',
        'var(--sol-magenta, #d33682)',
        'var(--sol-orange, #cb4b16)',
        'var(--sol-yellow, #b58900)',
        'var(--sol-base01, #586e75)',
        'var(--sol-base00, #657b83)'
      ];
      // Deterministic color assignment based on word content
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
      }
      const colorIndex = Math.abs(hash) % palette.length;
      item.style.color = palette[colorIndex];
    }
  });

  return tagCloudInstance;
}

/**
 * ⚡ Cabling Exercise — jsPlumb-based HTML/SVG implementation
 */
export function createCabling(containerId, leftItems, rightItems, onStateUpdate) {
  return new CablingManager(containerId, leftItems, rightItems, onStateUpdate);
}

class CablingManager {
  constructor(containerId, leftItems, rightItems, onStateUpdate) {
    this.containerId    = containerId;
    this.container      = document.querySelector(containerId);
    this.leftItems      = leftItems;
    this.rightItems     = rightItems;
    this.onStateUpdate  = onStateUpdate;

    this.connections  = {};   // { leftSrcId: rightSrcId }
    this.activeNode   = null; // { el, srcId, group } — pour click-to-connect
    this.validated    = false;
    this.jsp          = null; // jsPlumb instance
    this._connMap     = new Map(); // srcId → jsPlumb Connection object
    this._sparks      = [];   // spark DOM elements for incorrect connections

    if (this.container) {
      this._init();
    }
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  async _init() {
    const { newInstance } = await import("https://esm.sh/@jsplumb/browser-ui@6.2.10");

    // Vider le conteneur (sécurité OJS — re-render)
    this.container.innerHTML = "";

    // Structure de base
    this.container.style.position = "relative";
    this.container.style.display  = "flex";
    this.container.style.alignItems = "center";

    // ── Colonnes HTML ───────────────────────────────
    const colLeft  = this._makeColumn("left");
    const colMid   = this._makeMidColumn();
    const colRight = this._makeColumn("right");

    this.leftItems.forEach((it, i) => {
      colLeft.appendChild(this._makePill(it, "left", i));
    });
    this.rightItems.forEach((it, i) => {
      colRight.appendChild(this._makePill(it, "right", i));
    });

    this.container.append(colLeft, colMid, colRight);

    // ── Instance jsPlumb ────────────────────────────
    this.jsp = newInstance({
      container: this.container,
      connector: { 
        type: "Bezier", 
        options: { 
          curviness: 80
        } 
      },
      paintStyle: { 
        stroke: "var(--sol-cyan)", 
        strokeWidth: 4,
        outlineStroke: "rgba(0,0,0,0.3)",
        outlineWidth: 2
      },
      hoverPaintStyle: { 
        stroke: "var(--sol-yellow)", 
        strokeWidth: 5,
        outlineStroke: "rgba(0,0,0,0.4)",
        outlineWidth: 2
      },
      endpoint: "Dot",
      endpointStyle: { fill: "var(--sol-base01)", radius: 6 }
    });

    // ── Endpoints jsPlumb ───────────────────────────
    const SOCKET_STYLE = {
      fill: "#02161b",
      stroke: "#586e75",
      strokeWidth: 4,
    };
    const SOCKET_HOVER = {
      fill: "#02161b",
      stroke: "#2aa198",
      strokeWidth: 4,
    };

    this.leftItems.forEach((it) => {
      const el = this.container.querySelector(`[data-id="L_${it.id}"]`);
      if (!el) return;
      this.jsp.addEndpoint(el, {
        anchor: [ 1, 0.5, 1, 0.4 ],
        source: true,
        target: false,
        endpoint: { type: "Dot", options: { radius: 14 } },
        paintStyle: SOCKET_STYLE,
        hoverPaintStyle: SOCKET_HOVER,
        maxConnections: 1,
        connectionsDetachable: true,
        cssClass: "cabling-ep-left",
      });
    });

    this.rightItems.forEach((it) => {
      const el = this.container.querySelector(`[data-id="R_${it.id}"]`);
      if (!el) return;
      this.jsp.addEndpoint(el, {
        anchor: [ 0, 0.5, -1, 0.4 ],
        source: false,
        target: true,
        endpoint: { type: "Dot", options: { radius: 14 } },
        paintStyle: SOCKET_STYLE,
        hoverPaintStyle: SOCKET_HOVER,
        maxConnections: 1,
        connectionsDetachable: true,
        cssClass: "cabling-ep-right",
      });
    });

    // ── Événements jsPlumb ──────────────────────────

    // Empêcher les connexions invalides (même groupe)
    this.jsp.bind("beforeDrop", (info) => {
      if (this.validated) return false;
      const srcGroup = info.connection.source.dataset.group;
      const tgtGroup = info.dropEndpoint.element.dataset.group;
      return srcGroup !== tgtGroup;
    });

    // Connexion créée
    this.jsp.bind("connection", ({ source, target, connection }) => {
      const leftEl  = source.dataset.group === "left" ? source : target;
      const rightEl = source.dataset.group === "right" ? source : target;
      const lid = leftEl.dataset.srcId;
      const rid = rightEl.dataset.srcId;
      if (!lid || !rid) return;

      // Supprimer l'ancien câble si existant pour ce connecteur gauche
      const old = this._connMap.get(lid);
      if (old && old !== connection) {
        try { this.jsp.deleteConnection(old); } catch {}
      }
      this.connections[lid] = rid;
      this._connMap.set(lid, connection);

      // Couleur par index de la pill gauche (classe CSS data-color pour ciblage)
      const ci = this.leftItems.findIndex(it => it.id === lid);
      const colors = ["var(--sol-cyan)", "var(--sol-magenta)", "var(--sol-orange)", "var(--sol-violet)", "var(--sol-blue)"];
      const stroke = colors[ci % colors.length];
      connection.setPaintStyle({ 
        stroke, 
        strokeWidth: 4,
        outlineStroke: "rgba(0,0,0,0.3)",
        outlineWidth: 2
      });
      connection.setHoverPaintStyle({ 
        stroke: "var(--sol-yellow)", 
        strokeWidth: 5,
        outlineStroke: "rgba(0,0,0,0.4)",
        outlineWidth: 2
      });

      this._clearActive();
      this.onStateUpdate(this.getState());
    });

    // Connexion détruite
    this.jsp.bind("connectionDetached", ({ source, target }) => {
      const leftEl = source.dataset.group === "left" ? source : target;
      const lid = leftEl.dataset.srcId;
      if (lid) {
        delete this.connections[lid];
        this._connMap.delete(lid);
      }
      this.onStateUpdate(this.getState());
    });

    // ── Click-to-connect ────────────────────────────
    this.container.addEventListener("click", (e) => {
      if (this.validated) return;
      const pill = e.target.closest(".cabling-pill");
      if (!pill) return;

      const group  = pill.dataset.group;
      const srcId  = pill.dataset.srcId;

      if (!this.activeNode) {
        // Rien de sélectionné → sélectionner cette pill
        this._setActive(pill);
        return;
      }

      if (this.activeNode.srcId === srcId && this.activeNode.group === group) {
        // Même pill cliquée → désélectionner
        this._clearActive();
        return;
      }

      if (this.activeNode.group === group) {
        // Même groupe → déplacer la sélection
        this._setActive(pill);
        return;
      }

      // Groupes opposés → connecter
      const leftEl  = group === "right" ? this.activeNode.el : pill;
      const rightEl = group === "right" ? pill : this.activeNode.el;
      this._connectElements(leftEl, rightEl);
    });

    // ── Resizing ────────────────────────────────────
    this._resizeHandler = () => {
      if (this.jsp) {
        this.jsp.repaintEverything();
      }
    };
    window.addEventListener("resize", this._resizeHandler);
  }

  // ── Helpers DOM ───────────────────────────────────────────────────────────

  _makeColumn(side) {
    const col = document.createElement("div");
    col.className = `cabling-col cabling-col--${side}`;
    return col;
  }

  _makeMidColumn() {
    const mid = document.createElement("div");
    mid.style.cssText = "flex: 1 1 auto; min-width: 80px;";
    return mid;
  }

  _makePill(item, group, index) {
    const pill = document.createElement("div");
    pill.className = "cabling-pill";
    pill.dataset.id    = `${group === "left" ? "L" : "R"}_${item.id}`;
    pill.dataset.srcId = item.id;
    pill.dataset.group = group;
    pill.textContent   = item.label;
    return pill;
  }

  // ── Click-to-connect state ────────────────────────────────────────────────

  _setActive(pill) {
    this._clearActive();
    this.activeNode = { el: pill, srcId: pill.dataset.srcId, group: pill.dataset.group };
    pill.classList.add('is-active');
  }

  _clearActive() {
    if (this.activeNode?.el) {
      this.activeNode.el.classList.remove('is-active');
    }
    this.activeNode = null;
  }

  // ── Connexion programmatique ──────────────────────────────────────────────

  _connectElements(leftEl, rightEl) {
    if (!leftEl || !rightEl || !this.jsp) return;

    const lid = leftEl.dataset.srcId;
    const rid = rightEl.dataset.srcId;

    // Supprimer l'ancien câble du côté gauche s'il existe
    const oldLeft = this._connMap.get(lid);
    if (oldLeft) { try { this.jsp.deleteConnection(oldLeft); } catch {} }

    // Supprimer l'ancien câble du côté droit si déjà occupé
    for (const [l, conn] of this._connMap.entries()) {
      if (this.connections[l] === rid && l !== lid) {
        try { this.jsp.deleteConnection(conn); } catch {}
        delete this.connections[l];
        this._connMap.delete(l);
      }
    }

    // Créer la connexion — jsPlumb émettra "connection" qui met à jour l'état
    const leftEps  = this.jsp.getEndpoints(leftEl);
    const rightEps = this.jsp.getEndpoints(rightEl);
    if (leftEps.length && rightEps.length) {
      try {
        this.jsp.connect({ source: leftEps[0], target: rightEps[0] });
      } catch (err) {
        console.warn("jsPlumb connect error:", err);
      }
    }
  }

  // ── Spark particles ────────────────────────────────────────

  _addSparks(pillEl, side) {
    const containerRect = this.container.getBoundingClientRect();
    const pillRect      = pillEl.getBoundingClientRect();
    const x = side === "right"
      ? pillRect.right  - containerRect.left
      : pillRect.left   - containerRect.left;
    const y = pillRect.top + pillRect.height / 2 - containerRect.top;

    const COUNT = 6;
    for (let i = 0; i < COUNT; i++) {
      const spark = document.createElement("span");
      spark.className = "cabling-spark";
      spark.style.left  = `${x}px`;
      spark.style.top   = `${y}px`;
      spark.style.setProperty("--angle", `${i * (360 / COUNT)}deg`);
      spark.style.animationDelay = `${(i * 0.1) % 0.6}s`;
      this.container.appendChild(spark);
      this._sparks.push(spark);
    }
  }

  // ── API publique ──────────────────────────────────────────────

  validate() {
    if (Object.keys(this.connections).length < this.leftItems.length) {
      return { status: "incomplete", ...this.getState() };
    }

    this.validated = true;

    for (const [lid, conn] of this._connMap.entries()) {
      const rid       = this.connections[lid];
      const item      = this.leftItems.find(it => it.id === lid);
      const isCorrect = item && rid === item.match;
      conn.removeClass("conn-active");
      conn.addClass(isCorrect ? "conn-correct" : "conn-incorrect");

      if (!isCorrect) {
        const leftEl  = this.container.querySelector(`[data-src-id="${lid}"][data-group="left"]`);
        const rightEl = this.container.querySelector(`[data-src-id="${rid}"][data-group="right"]`);
        if (leftEl)  this._addSparks(leftEl,  "right");
        if (rightEl) this._addSparks(rightEl, "left");
      }
    }

    this.jsp.repaintEverything();

    this.container.querySelectorAll(".cabling-pill").forEach(el => {
      el.classList.add('is-validated');
    });

    return { status: "validated", ...this.getState() };
  }

  reset() {
    this.validated  = false;
    this._clearActive();

    if (this.jsp) {
      this._connMap.forEach(c => {
        c.removeClass("conn-correct conn-incorrect");
        try { this.jsp.deleteConnection(c); } catch {}
      });
    }

    this.connections = {};
    this._connMap.clear();

    this._sparks.forEach(s => s.remove());
    this._sparks = [];

    this.container.querySelectorAll(".cabling-pill").forEach(el => {
      if (el.style.cursor) {
        el.style.cursor      = "pointer";
        el.style.borderColor = "#586e75";
        el.style.color       = "#93a1a1";
      }
      el.classList.remove('is-active', 'is-validated');
    });

    return { status: "hidden", ...this.getState() };
  }

  clearValidation() {
    this.validated  = false;
    this._clearActive();

    if (this.jsp) {
      this._connMap.forEach(c => {
        c.removeClass("conn-correct conn-incorrect");
      });
    }

    this._sparks.forEach(s => s.remove());
    this._sparks = [];

    this.container.querySelectorAll(".cabling-pill").forEach(el => {
      if (el.style.cursor) {
        el.style.cursor      = "pointer";
        el.style.borderColor = "#586e75";
        el.style.color       = "#93a1a1";
      }
      el.classList.remove('is-active', 'is-validated');
    });

    return { status: "hidden", ...this.getState() };
  }

  getState() {
    let score = 0;
    this.leftItems.forEach(it => {
      if (this.connections[it.id] === it.match) score++;
    });
    return { score, total: this.leftItems.length, connections: { ...this.connections } };
  }

  destroy() {
    if (this._resizeHandler) {
      window.removeEventListener("resize", this._resizeHandler);
    }
    if (this.jsp) {
      this.jsp.destroy();
      this.jsp = null;
    }
  }
}

/**
 * 🔄 Generic State Machine Force-Directed Graph Renderer
 * Thin, semantic state machine wrapper around createGraph.
 * ONLY keeps state-machine-specific styles and properties here.
 *
 * @param {HTMLElement|string} container - Target DOM element or CSS selector.
 * @param {Object} graphData - { nodes, links } data array.
 * @param {Object} customOptions - Parameters to customize style, size, and callbacks.
 * @returns {Object} The ForceGraph instance.
 */
export function renderStateMachineGraph(container, graphData, customOptions = {}) {
  // State Machine specific styles (curated Solarized Dark palette tokens)
  const defaultStyles = {
    default: {
      nodeBg: "var(--sol-base3)",
      nodeBorder: "var(--sol-base01)",
      nodeText: "var(--sol-base00)",
      linkStroke: "var(--sol-base1)",
      linkText: "var(--sol-base01)",
      particles: 0,
      particleColor: "var(--sol-base1)",
      particleWidth: 2,
      particleSpeed: 0.01
    },
    past: {
      nodeBg: "var(--sol-base2)",
      nodeBorder: "var(--sol-green)",
      nodeText: "var(--sol-green)",
      linkStroke: "var(--sol-green)",
      linkText: "var(--sol-green)",
      particles: 1,
      particleColor: "var(--sol-green)",
      particleWidth: 3,
      particleSpeed: 0.015
    },
    current: {
      nodeBg: "var(--sol-base2)",
      nodeBorder: "var(--sol-yellow)",
      nodeText: "var(--sol-yellow)",
      linkStroke: "var(--sol-yellow)",
      linkText: "var(--sol-yellow)",
      particles: 4,
      particleColor: "var(--sol-yellow)",
      particleWidth: 4,
      particleSpeed: 0.03
    },
    entry: {
      nodeBg: "rgba(38, 139, 210, 0.15)",
      nodeBorder: "var(--sol-blue)",
      nodeText: "var(--sol-blue)",
      linkStroke: "var(--sol-base1)",
      linkText: "var(--sol-base01)",
      particles: 0,
      particleColor: "var(--sol-base1)",
      particleWidth: 2,
      particleSpeed: 0.01
    }
  };

  // Merge the state machine default styles with custom styles passed by the user
  const styles = { ...defaultStyles };
  if (customOptions.styles) {
    for (const key of Object.keys(customOptions.styles)) {
      styles[key] = {
        ...(defaultStyles[key] || {}),
        ...customOptions.styles[key]
      };
    }
  }

  // Call the refactored, generic createGraph utility
  return createGraph(container, graphData, {
    ...customOptions,
    styles
  });
}

/**
 * 📊 RAM Columnar vs Row-oriented simulator rendered as a Force-Directed Graph.
 * Displays CPU access sequence to RAM addresses, showcasing Cache Hits vs Misses dynamically.
 * Handles data stored in the QMD dynamically by parsing row/col mappings from a table array.
 *
 * @param {HTMLElement|string} containerSelector - Element selector or host DOM node.
 * @param {string} storageMode - 'ligne' or 'colonne'.
 * @param {string} queryCol - Target column being read (e.g. 'Salaire').
 * @param {Array} tableData - Dynamically parsed markdown table array of objects.
 * @returns {Object} ForceGraph instance.
 */
export function createRamStorageGraph(containerSelector, storageMode, queryCol, tableData = []) {
  const container = typeof containerSelector === 'string'
    ? document.querySelector(containerSelector.startsWith('#') ? containerSelector : '#' + containerSelector)
    : containerSelector;
    
  if (!container) {
    console.warn(`createRamStorageGraph: element ${containerSelector} not found.`);
    return null;
  }

  container.innerHTML = "";
  if (!tableData || tableData.length === 0) return null;

  const columns = Object.keys(tableData[0]);
  const nodes = [];
  const links = [];

  // Theme Colors Resolution (Safe for Canvas API)
  const colorHit = getThemeColor("--sol-green", "#859900");
  const colorMiss = getThemeColor("--sol-red", "#dc322f");
  const colorLoad = getThemeColor("--sol-blue", "#268bd2");
  const colorActive = getThemeColor("--sol-yellow", "#b58900");
  
  const colorPalette = [ 
    getThemeColor("--sol-cyan", "#2aa198"),
    getThemeColor("--sol-magenta", "#d33682"),
    getThemeColor("--sol-orange", "#cb4b16"),
    getThemeColor("--sol-violet", "#6c71c4")
  ];
  const colColors = {};
  columns.forEach((col, i) => colColors[col] = colorPalette[i % colorPalette.length]);

  // 1. Add CPU Node (Lowered to -80 for absolute vertical symmetry and canvas headroom)
  nodes.push({ id: "CPU", label: "CPU", val: "Processeur", type: "cpu", x: 0, y: -80, fx: 0, fy: -80 });

  // 2. Map physical addresses
  const addrMap = {};
  let addressIndex = 0;
  if (storageMode === "ligne") {
    tableData.forEach((row, r) => columns.forEach(col => {
      addrMap[`${r}_${col}`] = `0x${(addressIndex * 8).toString(16).toUpperCase().padStart(2, '0')}`;
      addressIndex++;
    }));
  } else {
    columns.forEach(col => tableData.forEach((row, r) => {
      addrMap[`${r}_${col}`] = `0x${(addressIndex * 8).toString(16).toUpperCase().padStart(2, '0')}`;
      addressIndex++;
    }));
  }

  // 3. Generate RAM nodes
  tableData.forEach((row, r) => {
    columns.forEach((col, c) => {
      const cellId = `${r}_${col}`;
      nodes.push({
        id: cellId, label: col, val: row[col], type: "ram", addr: addrMap[cellId],
        color: colColors[col],
        x: (c - (columns.length - 1) / 2) * 118, y: (r - 1) * 60 + 20,
        fx: (c - (columns.length - 1) / 2) * 118, fy: (r - 1) * 60 + 20
      });
    });
  });

  // 4. Build physical layout path & Pre-calculate Cache Status
  const physicalOrder = [];
  if (storageMode === "ligne") {
    tableData.forEach((row, r) => columns.forEach(col => physicalOrder.push(`${r}_${col}`)));
  } else {
    columns.forEach(col => tableData.forEach((row, r) => physicalOrder.push(`${r}_${col}`)));
  }

  // CPU Initial Load Wire
  links.push({
    id: `CPU->${physicalOrder[0]}`,
    source: nodes.find(n => n.id === "CPU"), 
    target: nodes.find(n => n.id === physicalOrder[0]),
    type: "physical", cacheLabel: "Load", cacheColor: colorLoad
  });

  // Inter-cell Wires
  for (let i = 0; i < physicalOrder.length - 1; i++) {
    const sourceId = physicalOrder[i];
    const targetId = physicalOrder[i + 1];
    
    let isHit = false;
    
    if (storageMode === "colonne") {
      const sourceCol = sourceId.substring(sourceId.indexOf('_') + 1);
      const targetCol = targetId.substring(targetId.indexOf('_') + 1);
      isHit = (sourceCol === targetCol);
    }

    links.push({
      id: `${sourceId}->${targetId}`,
      source: nodes.find(n => n.id === sourceId), 
      target: nodes.find(n => n.id === targetId),
      type: "physical", 
      cacheLabel: isHit ? "Hit" : "Miss", 
      cacheColor: isHit ? colorHit : colorMiss
    });
  }

  // 5. Build State Sequence (Tracking current vs past links)
  const statesSequence = [];
  statesSequence.push({ activeNodes: new Set(["CPU"]), currentLinks: new Set(), pastLinks: new Set() });

  if (queryCol !== "Aucune" && columns.includes(queryCol)) {
    let accumulatedNodes = new Set(["CPU"]);
    let pastLinks = new Set();
    
    // Step 1: CPU Load
    const firstLinkId = `CPU->${physicalOrder[0]}`;
    accumulatedNodes.add(physicalOrder[0]);
    statesSequence.push({ activeNodes: new Set([...accumulatedNodes]), currentLinks: new Set([firstLinkId]), pastLinks: new Set([...pastLinks]) });
    pastLinks.add(firstLinkId);

    let hitCount = Array.from(accumulatedNodes).filter(id => id.endsWith(`_${queryCol}`)).length;
    
    // Step 2..N: Traverse Memory
    if (hitCount < tableData.length) {
      for (let i = 1; i < physicalOrder.length; i++) {
        const currentCellId = physicalOrder[i];
        const linkId = `${physicalOrder[i - 1]}->${currentCellId}`;
        
        accumulatedNodes.add(currentCellId);
        statesSequence.push({ activeNodes: new Set([...accumulatedNodes]), currentLinks: new Set([linkId]), pastLinks: new Set([...pastLinks]) });
        pastLinks.add(linkId);

        if (Array.from(accumulatedNodes).filter(id => id.endsWith(`_${queryCol}`)).length === tableData.length) break;
      }
    }
    
    // Final Step: Complete (All disabled style)
    statesSequence.push({ activeNodes: new Set([...accumulatedNodes]), currentLinks: new Set(), pastLinks: new Set([...pastLinks]) });
  }

  // 6. Config options and colors
  const compStyle = getComputedStyle(container);
  const getNum = (varName, fallback) => parseFloat(compStyle.getPropertyValue(varName)) || fallback;
  const getStr = (varName, fallback) => {
    const rawVal = compStyle.getPropertyValue(varName).trim();
    return rawVal ? resolveCssValue(rawVal) : fallback;
  };

  const cfg = {
    nodeText: getStr('--canvas-node-text', '#fdf6e3'),
    nodeFont: getNum('--canvas-node-font-size', 12),
    addrFont: getNum('--canvas-addr-font-size', 9),
    nodePadX: getNum('--canvas-node-pad-x', 14),
    labelFont: getNum('--canvas-label-font-size', 10),
    labelBg: getStr('--canvas-label-bg', 'rgba(0, 43, 54, 0.9)'),
    wActive: getNum('--canvas-wire-width-active', 2.5),
    wPast: getNum('--canvas-wire-width-past', 1.5),
    wIdle: getNum('--canvas-wire-width-idle', 1),
    cPast: getStr('--canvas-wire-color-past', 'rgba(88, 110, 117, 0.4)'),
    cIdle: getStr('--canvas-wire-color-idle', 'rgba(88, 110, 117, 0.12)')
  };

  const fontMono = getThemeColor('--font-mono', 'monospace');

  // 7. Initialize Graph
  const graph = ForceGraph()(container)
    .graphData({ nodes, links })
    .backgroundColor('rgba(0,0,0,0)')
    .nodeRelSize(7)
    .cooldownTicks(0)
    .enableZoomInteraction(false)
    .enablePanInteraction(false)
    .linkDirectionalArrowLength(6)
    .linkDirectionalArrowRelPos(1.0);

  // Disable forces for fixed layouts
  graph.d3Force('center', null);
  graph.d3Force('charge', null);
  if (graph.d3Force('link')) {
    graph.d3Force('link').strength(0);
  }

  // Node drawing with custom text and labels
  graph.nodeCanvasObject((node, ctx, globalScale) => {
    const label = node.type === "cpu" ? "CPU: Processeur" : `${node.label}: ${node.val}`;
    const fontSize = cfg.nodeFont / globalScale;
    ctx.font = `${fontSize}px ${fontMono}`;
    const textWidth = ctx.measureText(label).width;
    const bWidth = textWidth + cfg.nodePadX;
    const bHeight = fontSize * 2.5;

    const fillColor = node.type === "cpu" ? "var(--sol-violet)" : node.color;
    const resolvedFill = resolveCssValue(fillColor) || fillColor;
    
    if (node.isActive) {
      ctx.shadowColor = node.type === "cpu" ? (resolveCssValue("var(--sol-violet)") || "#6c71c4") : colorActive;
      ctx.shadowBlur = 12 / globalScale;
    } else {
      ctx.shadowColor = "transparent";
    }

    ctx.fillStyle = resolvedFill;
    ctx.strokeStyle = node.isActive ? colorActive : "transparent";
    ctx.lineWidth = node.isActive ? cfg.wActive : 0;

    drawRoundedRect(ctx, node.x - bWidth/2, node.y - bHeight/2, bWidth, bHeight, 5);
    ctx.fill();
    
    ctx.shadowColor = "transparent";
    if (node.isActive) ctx.stroke();

    ctx.fillStyle = resolveCssValue(cfg.nodeText) || cfg.nodeText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, node.x, node.y - fontSize * 0.25);

    if (node.type !== "cpu") {
      ctx.font = `${cfg.addrFont / globalScale}px ${fontMono}`;
      ctx.fillStyle = node.isActive ? colorActive : "rgba(253, 246, 227, 0.6)";
      ctx.fillText(node.addr, node.x, node.y + fontSize * 0.7);
    }
  });

  // Link basic properties & particles setup
  graph
    .linkWidth(link => link.isCurrent ? cfg.wActive : (link.isPast ? cfg.wPast : cfg.wIdle))
    .linkColor(link => link.isCurrent ? colorActive : (link.isPast ? resolveCssValue(cfg.cPast) || cfg.cPast : resolveCssValue(cfg.cIdle) || cfg.cIdle))
    .linkDirectionalParticles(link => link.isCurrent ? 3 : 0)
    .linkDirectionalParticleSpeed(0.015)
    .linkDirectionalParticleWidth(4.5)
    .linkDirectionalParticleColor(() => colorActive)
    .linkDirectionalArrowColor(link => link.isCurrent ? colorActive : (link.isPast ? resolveCssValue(cfg.cPast) || cfg.cPast : resolveCssValue(cfg.cIdle) || cfg.cIdle));

  // Custom link labels in 'after' mode for Cache Hits and Misses
  graph.linkCanvasObjectMode(() => "after");
  graph.linkCanvasObject((link, ctx, globalScale) => {
    const label = link.cacheLabel || "";
    if (!label) return;

    const { source, target } = link;
    if (typeof source !== "object" || typeof target !== "object") return;

    const cx = source.x + (target.x - source.x) * 0.5;
    const cy = source.y + (target.y - source.y) * 0.5;

    const fontSize = cfg.labelFont / globalScale;
    ctx.font = `bold ${fontSize}px ${fontMono}`;
    const textWidth = ctx.measureText(label).width;
    const pX = 5 / globalScale;
    const pY = 3 / globalScale;

    ctx.save();

    // Semi-transparent label backing box
    ctx.fillStyle = resolveCssValue(cfg.labelBg) || cfg.labelBg;
    drawRoundedRect(ctx, cx - textWidth/2 - pX, cy - fontSize/2 - pY, textWidth + pX*2, fontSize + pY*2, 3 / globalScale);
    ctx.fill();

    // Text color matching the status
    ctx.fillStyle = link.cacheColor || (link.isCurrent ? colorActive : (link.isPast ? resolveCssValue(cfg.cPast) || cfg.cPast : "rgba(147, 161, 161, 0.7)"));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy);

    ctx.restore();
  });

  // ResizeObserver for clean manual centering and viewport scaling
  const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        graph.width(w).height(h);
        
        const fitDimension = Math.min(w, h);
        const dynamicZoom = fitDimension / 260; // 260px covers CPU bounds + padding
        graph.centerAt(0, 0, 0);
        graph.zoom(dynamicZoom, 0);
      }
    }
  });
  resizeObserver.observe(container);

  // 8. Initialize State Engine and loop playback
  const animationEngine = new StateMachine({
    states: statesSequence,
    interval: 1100,
    loop: true,
    onStateChange: (statePayload) => {
      nodes.forEach(n => n.isActive = statePayload.activeNodes.has(n.id));
      links.forEach(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        l.source = nodes.find(n => n.id === sourceId) || l.source;
        l.target = nodes.find(n => n.id === targetId) || l.target;
        
        const linkId = `${sourceId}->${targetId}`;
        l.isCurrent = statePayload.currentLinks.has(linkId);
        l.isPast = statePayload.pastLinks.has(linkId);
      });
      graph.graphData({ nodes: [...nodes], links: [...links] });
    }
  });

  container.__stateMachine = animationEngine;
  animationEngine.start();

  // Inject start button callback
  const startBtn = document.getElementById("btn-ram-start");
  if (startBtn) {
    startBtn.onclick = (e) => {
      e.preventDefault();
      animationEngine.reset();
      animationEngine.start();
    };
  }

  // Hook destroy method for clean module teardown
  graph.destroy = () => {
    resizeObserver.disconnect();
    if (animationEngine) animationEngine.stop();
  };

  return graph;
}
