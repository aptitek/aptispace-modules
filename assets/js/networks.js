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
    maxZoom: 2,
    minZoom: 0.5,
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
    .backgroundColor(options.backgroundColor || 'transparent')
    .cooldownTicks(options.cooldownTicks)
    .enableZoomInteraction(options.enableZoom)
    .enablePanInteraction(options.enablePan)
    .enableNodeDrag(options.enableDrag)
    .linkDirectionalArrowLength(options.linkArrowLength)
    .linkDirectionalArrowRelPos(1);

  // Set dimensions: use explicit options, or fall back to the container's actual size
  const containerRect = targetEl.getBoundingClientRect();
  graph.width(options.width || containerRect.width || 600);
  graph.height(options.height || containerRect.height || 300);
  graph.minZoom(options.minZoom);
  graph.maxZoom(options.maxZoom);

  // Strengthen charge repulsion proportionally to node visual radius
  // Default d3 charge (-30) is too weak for nodeRadius > ~12
  graph.d3Force('charge').strength(-options.nodeRadius * 8);
  graph.d3Force('link')?.distance(options.nodeRadius * 5);

  // Link basic properties
  graph
    .linkColor((link) => {
      const status = options.getLinkStatus(link);
      const style = styles[status] || styles.default;
      return resolveColor(link.color || link.stroke || style.linkStroke, SOL_FALLBACKS.base01);
    })
    .linkWidth((link) => {
      const status = options.getLinkStatus(link);
      return status === "current" ? options.linkWidth * 1.5 : options.linkWidth;
    })
    .linkDirectionalArrowColor((link) => {
      const status = options.getLinkStatus(link);
      const style = styles[status] || styles.default;
      return resolveColor(link.color || link.stroke || style.linkStroke, SOL_FALLBACKS.base01);
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
      return resolveColor(link.color || link.particleColor || style.particleColor || style.linkStroke, SOL_FALLBACKS.cyan);
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

    const nodeBg = resolveColor(rawBg, SOL_FALLBACKS.base2);
    const nodeBorder = resolveColor(rawBorder, SOL_FALLBACKS.base01);
    const nodeText = resolveColor(rawText, SOL_FALLBACKS.base00);
    
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
    ctx.fillStyle = resolveColor("var(--sol-base3)", SOL_FALLBACKS.base3);
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
        const tagBorder = resolveColor(isTrue ? "var(--sol-green)" : "var(--sol-red)", isTrue ? SOL_FALLBACKS.green : SOL_FALLBACKS.red);
        const tagText = tagBorder;

        ctx.beginPath();
        drawRoundedRect(ctx, -pillW / 2, -pillH / 2, pillW, pillH, 3);
        ctx.fillStyle = resolveColor("var(--sol-base3)", SOL_FALLBACKS.base3);
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
        const linkText = resolveColor(style.linkText, SOL_FALLBACKS.base00);
        const labelBg = resolveColor("var(--sol-base3)", SOL_FALLBACKS.base3);

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
        ctx.strokeStyle = resolveColor(style.linkStroke, SOL_FALLBACKS.base01);
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

  // Zoom to Fit — wait for the force simulation to fully settle
  // maxZoom is enforced on the d3-zoom behavior so zoomToFit
  // cannot exceed it (d3-zoom clamps internally).
  if (options.zoomToFit) {
    let hasFitted = false;
    graph.onEngineStop(() => {
      if (hasFitted) return;
      hasFitted = true;
      try {
        graph.zoomToFit(400, options.zoomToFitPadding);
      } catch (err) {
        console.warn("zoomToFit error:", err);
      }
    });
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
  container.classList.add("word-cloud-container");

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
      'rouge': 'var(--sol-red)',
      'bleu': 'var(--sol-blue)',
      'vert': 'var(--sol-green)',
      'jaune': 'var(--sol-yellow)',
      'orange': 'var(--sol-orange)',
      'violet': 'var(--sol-violet)',
      'rose': 'var(--sol-magenta)',
      'cyan': 'var(--sol-cyan)',
      'magenta': 'var(--sol-magenta)',
      // English
      'red': 'var(--sol-red)',
      'blue': 'var(--sol-blue)',
      'green': 'var(--sol-green)',
      'yellow': 'var(--sol-yellow)',
      'purple': 'var(--sol-violet)',
      'pink': 'var(--sol-magenta)'
    };

    if (colorMap[text]) {
      item.style.setProperty("color", colorMap[text]);
      item.classList.add("fw-bold");
    } else {
      // 2. Cohesive theme palette for non-color-name words
      const palette = [
        'var(--sol-cyan)',
        'var(--sol-violet)',
        'var(--sol-magenta)',
        'var(--sol-orange)',
        'var(--sol-yellow)',
        'var(--sol-base01)',
        'var(--sol-base00)'
      ];
      // Deterministic color assignment based on word content
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
      }
      const colorIndex = Math.abs(hash) % palette.length;
      item.style.setProperty("color", palette[colorIndex]);
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
    this.container.classList.add("cabling-canvas");

    // ── Colonnes HTML ───────────────────────────────
    const colLeft  = this._makeColumn("left");
    const colMid   = this._makeMidColumn();
    const colRight = this._makeColumn("right");

    this.leftItems.forEach((it) => {
      colLeft.appendChild(this._makePill(it, "left"));
    });
    this.rightItems.forEach((it) => {
      colRight.appendChild(this._makePill(it, "right"));
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
        outlineStroke: "rgba(var(--sol-base03-rgb), 0.3)",
        outlineWidth: 2
      },
      hoverPaintStyle: { 
        stroke: "var(--sol-yellow)", 
        strokeWidth: 5,
        outlineStroke: "rgba(var(--sol-base03-rgb), 0.4)",
        outlineWidth: 2
      },
      endpoint: "Dot",
      endpointStyle: { fill: "var(--sol-base01)", radius: 6 }
    });

    // ── Endpoints jsPlumb ───────────────────────────
    const SOCKET_STYLE = {
      fill: "var(--cabling-socket-bg)",
      stroke: "var(--sol-base01)",
      strokeWidth: 4,
    };
    const SOCKET_HOVER = {
      fill: "var(--cabling-socket-bg)",
      stroke: "var(--sol-cyan)",
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
        outlineStroke: "rgba(var(--sol-base03-rgb), 0.3)",
        outlineWidth: 2
      });
      connection.setHoverPaintStyle({ 
        stroke: "var(--sol-yellow)", 
        strokeWidth: 5,
        outlineStroke: "rgba(var(--sol-base03-rgb), 0.4)",
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
    mid.className = "cabling-gap";
    return mid;
  }

  _makePill(item, group) {
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
      spark.style.setProperty("--spark-x", `${x}px`);
      spark.style.setProperty("--spark-y", `${y}px`);
      spark.style.setProperty("--angle", `${i * (360 / COUNT)}deg`);
      spark.style.setProperty("--spark-delay", `${(i * 0.1) % 0.6}s`);
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
 * @param {Object} options - Playback options.
 * @param {boolean} [options.autoStart=true] - Starts animation immediately.
 * @returns {Object} ForceGraph instance.
 */
export function createRamStorageGraph(containerSelector, storageMode, queryCol, tableData = [], options = {}) {
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
  const colorHit = getThemeColor("--sol-green", SOL_FALLBACKS.green);
  const colorMiss = getThemeColor("--sol-red", SOL_FALLBACKS.red);
  const colorLoad = getThemeColor("--sol-blue", SOL_FALLBACKS.blue);
  const colorActive = getThemeColor("--sol-yellow", SOL_FALLBACKS.yellow);
  
  const colorPalette = [ 
    getThemeColor("--sol-cyan", SOL_FALLBACKS.cyan),
    getThemeColor("--sol-magenta", SOL_FALLBACKS.magenta),
    getThemeColor("--sol-orange", SOL_FALLBACKS.orange),
    getThemeColor("--sol-violet", SOL_FALLBACKS.violet)
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
    nodeText: getStr('--canvas-node-text', SOL_FALLBACKS.base3),
    nodeFont: getNum('--canvas-node-font-size', 12),
    addrFont: getNum('--canvas-addr-font-size', 9),
    nodePadX: getNum('--canvas-node-pad-x', 14),
    labelFont: getNum('--canvas-label-font-size', 10),
    labelBg: getStr('--canvas-label-bg', utils.rgba(SOL_FALLBACKS.base03, 0.9)),
    wActive: getNum('--canvas-wire-width-active', 2.5),
    wPast: getNum('--canvas-wire-width-past', 1.5),
    wIdle: getNum('--canvas-wire-width-idle', 1),
    cPast: getStr('--canvas-wire-color-past', utils.rgba(SOL_FALLBACKS.base01, 0.4)),
    cIdle: getStr('--canvas-wire-color-idle', utils.rgba(SOL_FALLBACKS.base01, 0.12))
  };

  const fontMono = getThemeColor('--font-mono', 'monospace');

  // 7. Initialize Graph
  const graph = ForceGraph()(container)
    .graphData({ nodes, links })
    .backgroundColor('transparent')
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
      ctx.shadowColor = node.type === "cpu" ? (resolveCssValue("var(--sol-violet)") || SOL_FALLBACKS.violet) : colorActive;
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
    if (!label || (!link.isCurrent && !link.isPast)) return;

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

  // 8. Initialize State Engine and expose playback controls
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
  const autoStart = options.autoStart !== false;

  graph.start = () => animationEngine.start();
  graph.pause = () => animationEngine.stop();
  graph.reset = () => animationEngine.reset();
  graph.restart = () => {
    animationEngine.reset();
    animationEngine.start();
  };
  graph.isPlaying = () => animationEngine.isPlaying;

  if (autoStart) graph.start();

  graph.isPlaying = () => animationEngine.isPlaying;

  if (autoStart) graph.start();

  // Hook destroy method for clean module teardown
  graph.destroy = () => {
    resizeObserver.disconnect();
    if (animationEngine) animationEngine.stop();
  };

  return graph;
}

// =====================================================================
// 🧩 UTILITIES FOR 3D ROTATING SHAPES & PROCEDURAL PUZZLE GRID
// =====================================================================

/**
 * Normalizes an angle to the range [-PI, PI] for smooth interpolation.
 */
function normalizeAngle(angle) {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Shades a color based on light intensity, resolving CSS variables.
 */
function shadeColor(colorStr, intensity) {
  const color = resolveCssValue(colorStr) || colorStr;
  let r = 0, g = 0, b = 0, a = 1;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const parts = color.match(/[\d\.]+/g);
    if (parts) {
      r = parseInt(parts[0]);
      g = parseInt(parts[1]);
      b = parseInt(parts[2]);
      if (parts[3] !== undefined) a = parseFloat(parts[3]);
    }
  } else {
    // Return original color if parsing is not supported
    return color;
  }

  const shadedR = Math.min(255, Math.max(0, Math.round(r * intensity)));
  const shadedG = Math.min(255, Math.max(0, Math.round(g * intensity)));
  const shadedB = Math.min(255, Math.max(0, Math.round(b * intensity)));

  return `rgba(${shadedR}, ${shadedG}, ${shadedB}, ${a})`;
}

/**
 * Samples 2D points along a browser-native SVG path string.
 */
export function sampleSvgPath(pathString, numPoints = 40) {
  if (typeof document === "undefined") return [];
  try {
    const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathEl.setAttribute("d", pathString);
    const totalLength = pathEl.getTotalLength();
    const points = [];

    for (let i = 0; i < numPoints; i++) {
      const distance = (i * totalLength) / (numPoints - 1);
      const pt = pathEl.getPointAtLength(distance);
      points.push([pt.x, pt.y]);
    }

    // Filter out duplicate points
    const uniquePoints = [];
    points.forEach(p => {
      if (uniquePoints.length === 0) {
        uniquePoints.push(p);
      } else {
        const last = uniquePoints[uniquePoints.length - 1];
        const dist = Math.sqrt((p[0] - last[0])**2 + (p[1] - last[1])**2);
        if (dist > 0.01) {
          uniquePoints.push(p);
        }
      }
    });

    // Ensure first and last points do not duplicate
    if (uniquePoints.length > 2) {
      const first = uniquePoints[0];
      const last = uniquePoints[uniquePoints.length - 1];
      const dist = Math.sqrt((last[0] - first[0])**2 + (last[1] - first[1])**2);
      if (dist < 0.1) {
        uniquePoints.pop();
      }
    }

    return uniquePoints;
  } catch (err) {
    console.warn("sampleSvgPath error:", err);
    return [[-10, -10], [10, -10], [10, 10], [-10, 10]]; // fallback square
  }
}

/**
 * Centers a list of 2D points at (0, 0) and scales them to a target size.
 */
function centerAndScalePoints(points, targetSize) {
  if (!points || points.length === 0) return [];
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  points.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const width = maxX - minX;
  const height = maxY - minY;
  const cx = minX + width / 2;
  const cy = minY + height / 2;
  const maxDim = Math.max(width, height);
  const scale = maxDim > 0 ? targetSize / maxDim : 1;

  return points.map(([x, y]) => [
    (x - cx) * scale,
    (y - cy) * scale
  ]);
}

/**
 * Generates a beautiful 5-pointed (or N-pointed) star.
 */
function generateStar2D(numPoints = 5, rInner = 10, rOuter = 22) {
  const points = [];
  for (let i = 0; i < numPoints * 2; i++) {
    const angle = (i * Math.PI) / numPoints - Math.PI / 2;
    const r = (i % 2 === 0) ? rOuter : rInner;
    points.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  return points;
}

/**
 * Generates a beautiful gear polygon with custom teeth.
 */
function generateGear2D(numTeeth = 8, rInner = 15, rOuter = 22) {
  const points = [];
  const numPoints = numTeeth * 4;
  for (let i = 0; i < numPoints; i++) {
    const angle = (i * 2 * Math.PI) / numPoints;
    const toothPart = i % 4;
    let r = rInner;
    if (toothPart === 1 || toothPart === 2) {
      r = rOuter;
    }
    points.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  return points;
}

/**
 * Generates a regular polygon with N sides.
 */
function generateRegularPolygon2D(sides = 6, radius = 20) {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return points;
}

/**
 * Generates the 2D polygon of a puzzle piece with matching edges.
 * edges = [top, right, bottom, left] where 0=flat, 1=tab (out), -1=blank (in)
 */
function smoothPuzzleProfilePoints(controlPoints, steps = 5) {
  const points = [];

  for (let i = 0; i < controlPoints.length - 1; i++) {
    const from = controlPoints[i];
    const to = controlPoints[i + 1];

    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const eased = t * t * (3 - 2 * t);
      points.push({
        u: from.u + (to.u - from.u) * eased,
        h: from.h + (to.h - from.h) * eased
      });
    }
  }

  points.push(controlPoints[controlPoints.length - 1]);
  return points;
}

function createPuzzleEdgeProfile() {
  const center = 0.5 + (Math.random() - 0.5) * 0.12;
  const leftNeckHalf = 0.085 + Math.random() * 0.035;
  const rightNeckHalf = 0.075 + Math.random() * 0.04;
  const headHalf = 0.18 + Math.random() * 0.035;
  const leftNeck = Math.max(0.2, center - leftNeckHalf);
  const rightNeck = Math.min(0.8, center + rightNeckHalf);
  const leftHead = Math.max(0.14, center - headHalf);
  const rightHead = Math.min(0.86, center + headHalf);
  const height = 0.3 + Math.random() * 0.06;
  const stemHeight = height * (0.14 + Math.random() * 0.04);
  const leftCapBaseHeight = height * (0.32 + Math.random() * 0.06);
  const rightCapBaseHeight = height * (0.32 + Math.random() * 0.06);
  const crownOffset = (Math.random() - 0.5) * 0.02;

  const controlPoints = [
    { u: 0.0, h: 0.0 },
    { u: Math.max(0.04, leftHead - 0.08), h: 0.0 },
    { u: leftNeck, h: 0.0 },
    { u: center - leftNeckHalf * 0.52, h: stemHeight },
    { u: leftHead, h: leftCapBaseHeight },
    { u: center - headHalf * 0.88, h: height * 0.72 },
    { u: center - headHalf * 0.62, h: height * 0.9 },
    { u: center - headHalf * 0.28, h: height * 0.99 },
    { u: center + crownOffset, h: height },
    { u: center + headHalf * 0.28, h: height * 0.99 },
    { u: center + headHalf * 0.62, h: height * 0.9 },
    { u: center + headHalf * 0.88, h: height * 0.72 },
    { u: rightHead, h: rightCapBaseHeight },
    { u: center + rightNeckHalf * 0.58, h: stemHeight * (0.9 + Math.random() * 0.22) },
    { u: rightNeck, h: 0.0 },
    { u: Math.min(0.98, rightHead + 0.08), h: 0.0 },
    { u: 1.0, h: 0.0 }
  ];

  return {
    points: smoothPuzzleProfilePoints(controlPoints)
  };
}

function getPuzzleEdgePoints(edge) {
  const points = edge.profile?.points || createPuzzleEdgeProfile().points;
  if (!edge.reverse) return points;

  return points
    .slice()
    .reverse()
    .map(pt => ({ u: 1 - pt.u, h: pt.h }));
}

function normalizePuzzleEdge(edge, edgeProfile) {
  const profileDescriptor = edgeProfile && edgeProfile.profile
    ? edgeProfile
    : { profile: edgeProfile, reverse: false };

  if (typeof edge === "object" && edge !== null) {
    return {
      sign: edge.sign ?? 0,
      profile: edge.profile || profileDescriptor.profile || createPuzzleEdgeProfile(),
      reverse: Boolean(edge.reverse ?? profileDescriptor.reverse)
    };
  }

  return {
    sign: edge ?? 0,
    profile: profileDescriptor.profile || createPuzzleEdgeProfile(),
    reverse: Boolean(profileDescriptor.reverse)
  };
}

function generatePuzzlePieceShape(size, edges = [0, 0, 0, 0], edgeProfiles = []) {
  const half = size / 2;
  const points = [];
  const samplesPerEdge = 32;

  const corners = [
    [-half, -half], // Top-Left
    [half, -half],  // Top-Right
    [half, half],   // Bottom-Right
    [-half, half]   // Bottom-Left
  ];

  for (let i = 0; i < 4; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % 4];
    const edge = normalizePuzzleEdge(edges[i], edgeProfiles[i]);
    const sign = edge.sign;

    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.sqrt(dx*dx + dy*dy);
    const tx = dx / len;
    const ty = dy / len;

    // Outward normal vector
    const nx = ty;
    const ny = -tx;
    const edgePoints = sign === 0
      ? Array.from({ length: samplesPerEdge }, (_, j) => ({ u: j / samplesPerEdge, h: 0 }))
      : getPuzzleEdgePoints(edge);

    for (const pt of edgePoints.slice(0, -1)) {
      const h = pt.h * sign * size;

      const px = p1[0] + pt.u * dx + h * nx;
      const py = p1[1] + pt.u * dy + h * ny;
      points.push([px, py]);
    }
  }

  return points;
}

function computeFaceNormal3D(vertices) {
  let nx = 0;
  let ny = 0;
  let nz = 0;

  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    nx += (current[1] - next[1]) * (current[2] + next[2]);
    ny += (current[2] - next[2]) * (current[0] + next[0]);
    nz += (current[0] - next[0]) * (current[1] + next[1]);
  }

  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (length <= 0.000001) {
    return [0, 0, 1];
  }

  return [nx / length, ny / length, nz / length];
}

/**
 * Extrudes a 2D polygon into a 3D solid mesh.
 */
function extrudePolygon(points2d, thickness) {
  const N = points2d.length;
  const halfT = thickness / 2;
  const vertices = [];

  // Front vertices (z = +halfT)
  for (let i = 0; i < N; i++) {
    vertices.push([points2d[i][0], points2d[i][1], halfT]);
  }
  // Back vertices (z = -halfT)
  for (let i = 0; i < N; i++) {
    vertices.push([points2d[i][0], points2d[i][1], -halfT]);
  }

  const faces = [];

  // Front face (CCW order)
  const frontFace = [];
  for (let i = 0; i < N; i++) {
    frontFace.push(i);
  }
  faces.push(frontFace);

  // Back face (reversed CCW order for outward normal)
  const backFace = [];
  for (let i = N - 1; i >= 0; i--) {
    backFace.push(N + i);
  }
  faces.push(backFace);

  // Side faces connecting front and back edges
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    // CCW side face: F_i -> B_i -> B_next -> F_next
    faces.push([i, N + i, N + next, next]);
  }

  return { vertices, faces };
}

/**
 * Generates a procedural puzzle grid with matching edges.
 */
export function generatePuzzleGrid(rows, cols) {
  const horizontalEdges = Array.from({ length: rows - 1 }, () => Array(cols).fill(0));
  const verticalEdges = Array.from({ length: rows }, () => Array(cols - 1).fill(0));
  const horizontalProfiles = Array.from({ length: rows - 1 }, () => Array(cols).fill(null));
  const verticalProfiles = Array.from({ length: rows }, () => Array(cols - 1).fill(null));

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      horizontalEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
      horizontalProfiles[r][c] = createPuzzleEdgeProfile();
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      verticalEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
      verticalProfiles[r][c] = createPuzzleEdgeProfile();
    }
  }

  const grid = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const top = r === 0 ? 0 : -horizontalEdges[r - 1][c];
      const bottom = r === rows - 1 ? 0 : horizontalEdges[r][c];
      const left = c === 0 ? 0 : -verticalEdges[r][c - 1];
      const right = c === cols - 1 ? 0 : verticalEdges[r][c];
      const topProfile = r === 0 ? null : horizontalProfiles[r - 1][c];
      const bottomProfile = r === rows - 1 ? null : horizontalProfiles[r][c];
      const leftProfile = c === 0 ? null : verticalProfiles[r][c - 1];
      const rightProfile = c === cols - 1 ? null : verticalProfiles[r][c];

      grid.push({
        r,
        c,
        edges: [top, right, bottom, left],
        edgeProfiles: [
          topProfile ? { profile: topProfile, reverse: false } : null,
          rightProfile ? { profile: rightProfile, reverse: false } : null,
          bottomProfile ? { profile: bottomProfile, reverse: true } : null,
          leftProfile ? { profile: leftProfile, reverse: true } : null
        ]
      });
    }
  }
  return grid;
}

// =====================================================================
// 🕸️ 3D PIECE FORCE GRAPH
// =====================================================================

/**
 * Creates a 3D rotating node force graph on a 2D Canvas context.
 */
export function create3DPieceGraph(container, graphData, options = {}) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) {
    console.warn("create3DPieceGraph: Target container not found.", container);
    return null;
  }
  targetEl.innerHTML = "";

  const defaultOptions = {
    nodeSize: 34,
    nodeBg: "var(--sol-blue)",
    nodeBorder: "var(--sol-base02)",
    nodeText: "var(--sol-base3)",
    fontSize: 10,
    fontFamily: "var(--font-code, Consolas, monospace)",
    linkWidth: 1.5,
    cooldownTicks: Infinity,
    cameraDistance: 180,
    lightDirection: [-0.3, -0.4, 0.85],
    ambientLight: 0.3,
    rotationSpeed: 1.0,
    isPuzzle: false,
    rows: 3,
    cols: 3,
    onNodeClick: null
  };
  const cfg = { ...defaultOptions, ...options };

  // Light Vector setup
  let lx, ly, lz, lLength, normLx, normLy, normLz;
  function updateLight() {
    lx = cfg.lightDirection[0];
    ly = cfg.lightDirection[1];
    lz = cfg.lightDirection[2];
    lLength = Math.sqrt(lx*lx + ly*ly + lz*lz);
    normLx = lx / lLength;
    normLy = ly / lLength;
    normLz = lz / lLength;
  }
  updateLight();

  let isAssembled = false;

  // 1. Generate Puzzle Grid if requested
  if (cfg.isPuzzle && (!graphData || !graphData.nodes || graphData.nodes.length === 0)) {
    const rows = cfg.rows;
    const cols = cfg.cols;
    const gridData = generatePuzzleGrid(rows, cols);

    const colors = [
      "var(--sol-blue)",
      "var(--sol-cyan)",
      "var(--sol-green)",
      "var(--sol-yellow)",
      "var(--sol-orange)",
      "var(--sol-magenta)",
      "var(--sol-violet)"
    ];

    const nodes = gridData.map(item => {
      const id = `p_${item.r}_${item.c}`;
      const colorIdx = (item.r * cols + item.c) % colors.length;
      return {
        id,
        label: `${item.r + 1},${item.c + 1}`,
        r: item.r,
        c: item.c,
        edges: item.edges,
        edgeProfiles: item.edgeProfiles,
        shape: "puzzle",
        color: colors[colorIdx]
      };
    });

    const links = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        links.push({ source: `p_${r}_${c}`, target: `p_${r}_${c + 1}` });
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        links.push({ source: `p_${r}_${c}`, target: `p_${r + 1}_${c}` });
      }
    }

    graphData = { nodes, links };
  }

  const cols = Math.max(...graphData.nodes.map(n => n.c ?? 0)) + 1;
  const rows = Math.max(...graphData.nodes.map(n => n.r ?? 0)) + 1;

  // 2. Prepare nodes 3D meshes & rotations
  graphData.nodes.forEach(node => {
    node.rx = Math.random() * 2 * Math.PI;
    node.ry = Math.random() * 2 * Math.PI;
    node.rz = Math.random() * 2 * Math.PI;

    node.drx = (Math.random() * 0.015 + 0.005) * cfg.rotationSpeed * (Math.random() < 0.5 ? 1 : -1);
    node.dry = (Math.random() * 0.015 + 0.005) * cfg.rotationSpeed * (Math.random() < 0.5 ? 1 : -1);
    node.drz = (Math.random() * 0.01 + 0.002) * cfg.rotationSpeed * (Math.random() < 0.5 ? 1 : -1);

    const size = node.size || cfg.nodeSize;
    node.model3d = get3DModel(node, size);
  });

  function get3DModel(node, size) {
    if (node.svgPath) {
      const sampled = sampleSvgPath(node.svgPath, 36);
      const scaled = centerAndScalePoints(sampled, size);
      return extrudePolygon(scaled, size * 0.35);
    }

    switch (node.shape) {
      case "cube":
        const half = size / 2;
        return {
          vertices: [
            [-half, -half, -half], [half, -half, -half], [half, half, -half], [-half, half, -half],
            [-half, -half, half], [half, -half, half], [half, half, half], [-half, half, half]
          ],
          faces: [
            [4, 5, 6, 7], // Front
            [1, 0, 3, 2], // Back
            [0, 1, 5, 4], // Top
            [3, 7, 6, 2], // Bottom
            [0, 4, 7, 3], // Left
            [1, 2, 6, 5]  // Right
          ]
        };
      case "tetrahedron":
        const s = size * 0.65;
        return {
          vertices: [
            [s, s, s], [-s, -s, s], [-s, s, -s], [s, -s, -s]
          ],
          faces: [
            [0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]
          ]
        };
      case "star":
        return extrudePolygon(generateStar2D(5, size * 0.22, size * 0.5), size * 0.35);
      case "gear":
        return extrudePolygon(generateGear2D(8, size * 0.35, size * 0.5), size * 0.35);
      case "puzzle":
        return extrudePolygon(generatePuzzlePieceShape(size, node.edges || [1, -1, 1, -1], node.edgeProfiles), size * 0.32);
      case "cylinder":
      case "disk":
        return extrudePolygon(generateRegularPolygon2D(18, size * 0.5), size * 0.35);
      case "hexagon":
        return extrudePolygon(generateRegularPolygon2D(6, size * 0.5), size * 0.35);
      default:
        return extrudePolygon(generateRegularPolygon2D(16, size * 0.5), size * 0.35);
    }
  }

  // 3. Initialize ForceGraph
  const graph = ForceGraph()(targetEl)
    .graphData(graphData)
    .backgroundColor('transparent')
    .cooldownTicks(cfg.cooldownTicks)
    .linkWidth(cfg.linkWidth)
    .linkColor(() => isAssembled ? "transparent" : (resolveCssValue("var(--sol-base1)") || "#93a1a1"))
    .linkDirectionalArrowLength(() => isAssembled ? 0 : 4)
    .linkDirectionalArrowRelPos(1);

  const containerRect = targetEl.getBoundingClientRect();
  graph.width(cfg.width || containerRect.width || 600);
  graph.height(cfg.height || containerRect.height || 350);

  graph.d3Force('charge').strength(-cfg.nodeSize * 9);
  graph.d3Force('link')?.distance(cfg.nodeSize * 3.5);

  // Custom Node 3D Canvas drawing
  graph.nodeCanvasObject((node, ctx, globalScale) => {
    // 1. Update rotations
    if (isAssembled) {
      node.rx = normalizeAngle(node.rx) * 0.8;
      node.ry = normalizeAngle(node.ry) * 0.8;
      node.rz = normalizeAngle(node.rz) * 0.8;

      if (Math.abs(node.rx) < 0.001) node.rx = 0;
      if (Math.abs(node.ry) < 0.001) node.ry = 0;
      if (Math.abs(node.rz) < 0.001) node.rz = 0;
    } else {
      const vx = node.vx || 0;
      const vy = node.vy || 0;
      const speedScale = 0.002;

      node.rx = (node.rx + (node.drx || 0.01) + vy * speedScale) % (2 * Math.PI);
      node.ry = (node.ry + (node.dry || 0.015) + vx * speedScale) % (2 * Math.PI);
      node.rz = (node.rz + (node.drz || 0.005) + (vx + vy) * 0.5 * speedScale) % (2 * Math.PI);
    }

    // 2. Rotate all vertices in 3D
    const cosX = Math.cos(node.rx), sinX = Math.sin(node.rx);
    const cosY = Math.cos(node.ry), sinY = Math.sin(node.ry);
    const cosZ = Math.cos(node.rz), sinZ = Math.sin(node.rz);

    const rotatedVertices = node.model3d.vertices.map(v => {
      // Rotation X
      let x1 = v[0];
      let y1 = v[1] * cosX - v[2] * sinX;
      let z1 = v[1] * sinX + v[2] * cosX;

      // Rotation Y
      let x2 = x1 * cosY + z1 * sinY;
      let y2 = y1;
      let z2 = -x1 * sinY + z1 * cosY;

      // Rotation Z
      let x3 = x2 * cosZ - y2 * sinZ;
      let y3 = x2 * sinZ + y2 * cosZ;
      let z3 = z2;

      return [x3, y3, z3];
    });

    // 3. Prepare face data (normal and center Z for depth sorting)
    const facesData = node.model3d.faces.map((faceIndices, faceIndex) => {
      const faceVertices = faceIndices.map(idx => rotatedVertices[idx]);
      const [normNx, normNy, normNz] = computeFaceNormal3D(faceVertices);

      let centerZ = 0;
      faceVertices.forEach(v => centerZ += v[2]);
      centerZ /= faceVertices.length;

      return {
        faceIndex,
        isCap: faceIndex < 2,
        indices: faceIndices,
        vertices: faceVertices,
        normal: [normNx, normNy, normNz],
        centerZ: centerZ
      };
    });

    // 4. Stable rendering order.
    // Puzzle pieces create many tiny side faces; keep their order stable, but do not draw back faces.
    const sideFaces = facesData
      .filter(f => !f.isCap && f.normal[2] > -0.08)
      .sort((a, b) => a.faceIndex - b.faceIndex);
    const capFaces = facesData
      .filter(f => f.isCap && f.normal[2] > -0.08)
      .sort((a, b) => {
      const depthA = a.centerZ + (a.isCap ? 0.02 : 0);
      const depthB = b.centerZ + (b.isCap ? 0.02 : 0);
      if (Math.abs(depthA - depthB) > 0.0001) return depthA - depthB;
      return a.faceIndex - b.faceIndex;
    });
    const visibleFaces = [...sideFaces, ...capFaces];

    const baseColor = node.color || cfg.nodeBg;
    const borderColor = node.borderColor || cfg.nodeBorder;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // 5. Draw each visible face
    visibleFaces.forEach(face => {
      const dot = face.normal[0] * normLx + face.normal[1] * normLy + face.normal[2] * normLz;
      const intensity = cfg.ambientLight + (1 - cfg.ambientLight) * Math.max(0, dot);

      // Project using perspective focal length
      const projected = face.vertices.map(v => {
        const d = cfg.cameraDistance;
        const scale = d / (d - v[2]);
        return [
          node.x + v[0] * scale,
          node.y + v[1] * scale
        ];
      });

      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i][0], projected[i][1]);
      }
      ctx.closePath();

      ctx.fillStyle = shadeColor(baseColor, intensity);
      ctx.fill();

      if (face.isCap) {
        ctx.strokeStyle = resolveCssValue(borderColor) || borderColor;
        ctx.lineWidth = 0.6 / globalScale;
        ctx.stroke();
      }
    });

    // 6. Draw Label text over the piece
    if (node.label && !isAssembled) {
      const fSize = cfg.fontSize / globalScale;
      ctx.font = `bold ${fSize}px ${cfg.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const textWidth = ctx.measureText(node.label).width;
      ctx.fillStyle = utils.rgba(resolveCssValue("var(--sol-base3)") || "#fdf6e3", 0.75);
      drawRoundedRect(ctx, node.x - textWidth/2 - 2, node.y - fSize/2 - 2, textWidth + 4, fSize + 4, 2);
      ctx.fill();

      ctx.fillStyle = resolveCssValue(node.textColor || cfg.nodeText) || cfg.nodeText;
      ctx.fillText(node.label, node.x, node.y);
    }

    ctx.restore();
  });

  // 4. Expose assembly state and controls
  graph.assemble = () => {
    isAssembled = true;
    graphData.nodes.forEach(node => {
      if (node.r !== undefined && node.c !== undefined) {
        node.fx = (node.c - (cols - 1) / 2) * (node.size || cfg.nodeSize);
        node.fy = (node.r - (rows - 1) / 2) * (node.size || cfg.nodeSize);
      }
    });
    graph.d3ReheatSimulation();
  };

  graph.disassemble = () => {
    isAssembled = false;
    graphData.nodes.forEach(node => {
      node.fx = null;
      node.fy = null;

      // Random kick to burst out
      node.vx = (Math.random() - 0.5) * 60;
      node.vy = (Math.random() - 0.5) * 60;

      node.drx = (Math.random() * 0.015 + 0.005) * cfg.rotationSpeed * (Math.random() < 0.5 ? 1 : -1);
      node.dry = (Math.random() * 0.015 + 0.005) * cfg.rotationSpeed * (Math.random() < 0.5 ? 1 : -1);
      node.drz = (Math.random() * 0.01 + 0.002) * cfg.rotationSpeed * (Math.random() < 0.5 ? 1 : -1);
    });
    graph.d3ReheatSimulation();
  };

  graph.isAssembled = () => isAssembled;

  graph.updateOptions = (newOpts) => {
    Object.assign(cfg, newOpts);
    if (newOpts.lightDirection) {
      updateLight();
    }
  };

  if (cfg.onNodeClick) {
    graph.onNodeClick((node, event) => {
      cfg.onNodeClick(node, event);
    });
  }

  return graph;
}

/**
 * Puzzle board that shows raw Q·K scores before softmax normalization.
 */
export function createKvPuzzleGraph(container, options = {}, invalidation = null) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) {
    console.warn("createKvPuzzleGraph: Target container not found.", container);
    return null;
  }
  targetEl.innerHTML = "";

  const tokens = options.tokens || [
    "Le", "petit", "chat", "curieux", "observe", "la", "fenêtre", "quand",
    "la", "pluie", "tombe", "sur", "les", "tuiles", "rouges", "du",
    "vieux", "toit", "pendant", "que", "la", "lampe", "éclaire", "doucement",
    "son", "bol", "vide", "près", "du", "canapé", "bleu", "calme"
  ];
  const rows = options.rows ?? 4;
  const cols = options.cols ?? 8;
  const expectedTokenCount = rows * cols;
  const boardTokens = tokens.slice(0, expectedTokenCount);
  while (boardTokens.length < expectedTokenCount) {
    boardTokens.push(`tok${boardTokens.length + 1}`);
  }

  const qValues = options.qValues || boardTokens.map((_, index) => 8 + ((index * 7 + 11) % 23));
  const kValues = options.kValues || boardTokens.map((_, index) => 7 + ((index * 5 + 17) % 19));
  const nodeSize = options.nodeSize ?? 72;
  const labelFontSize = options.labelFontSize ?? 12;
  const scoreFontSize = options.scoreFontSize ?? 10;
  const linkFontSize = options.linkFontSize ?? 8;
  const initialRect = targetEl.getBoundingClientRect();
  const height = options.height ?? Math.max(initialRect.height || 0, 520);
  const widthFallback = options.width ?? 860;
  const cameraDistance = options.cameraDistance ?? 240;
  const ambientLight = options.ambientLight ?? 0.46;
  const lightDirection = options.lightDirection || [-0.24, -0.34, 0.9];
  let currentWidth = widthFallback;
  let rafId = null;

  const lightLength = Math.sqrt(
    lightDirection[0] * lightDirection[0] +
    lightDirection[1] * lightDirection[1] +
    lightDirection[2] * lightDirection[2]
  ) || 1;
  const normLx = lightDirection[0] / lightLength;
  const normLy = lightDirection[1] / lightLength;
  const normLz = lightDirection[2] / lightLength;

  const graphHost = document.createElement("div");
  graphHost.className = "w-100";
  graphHost.setAttribute("role", "img");
  graphHost.setAttribute("aria-label", "Scores bruts Q point K sur une plaque de puzzle");
  targetEl.style.setProperty("min-height", `${height}px`);
  graphHost.style.setProperty("height", `${height}px`);
  targetEl.appendChild(graphHost);

  const grid = generatePuzzleGrid(rows, cols);
  const nodes = boardTokens.map((token, index) => {
    const gridPiece = grid[index];
    return {
      id: `${token}-${index}`,
      label: token,
      q: qValues[index] ?? 0,
      k: kValues[index] ?? 0,
      score: 0,
      strength: 0,
      index,
      r: gridPiece?.r ?? Math.floor(index / cols),
      c: gridPiece?.c ?? index % cols,
      edges: gridPiece?.edges || [0, 1, 0, -1],
      edgeProfiles: gridPiece?.edgeProfiles || [],
      size: nodeSize,
      phase: Math.random() * Math.PI * 2,
      baseRx: (Math.random() - 0.5) * 0.16,
      baseRy: (Math.random() - 0.5) * 0.16,
      baseRz: (Math.random() - 0.5) * 0.18,
      gapX: (Math.random() - 0.5) * nodeSize * 0.12,
      gapY: (Math.random() - 0.5) * nodeSize * 0.14
    };
  });

  nodes.forEach(node => {
    node.model3d = extrudePolygon(generatePuzzlePieceShape(node.size, node.edges, node.edgeProfiles), node.size * 0.3);
  });

  const links = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sourceIndex = r * cols + c;
      if (c < cols - 1) {
        const targetIndex = sourceIndex + 1;
        const q = qValues[sourceIndex] ?? 0;
        const k = kValues[targetIndex] ?? 0;
        links.push({
          source: nodes[sourceIndex].id,
          target: nodes[targetIndex].id,
          q,
          k,
          product: q * k,
          orientation: "horizontal"
        });
      }
      if (r < rows - 1) {
        const targetIndex = sourceIndex + cols;
        const q = qValues[sourceIndex] ?? 0;
        const k = kValues[targetIndex] ?? 0;
        links.push({
          source: nodes[sourceIndex].id,
          target: nodes[targetIndex].id,
          q,
          k,
          product: q * k,
          orientation: "vertical"
        });
      }
    }
  }

  const products = links.map(link => link.product);
  const minScore = Math.min(...products);
  const maxScore = Math.max(...products);
  const scoreRange = Math.max(1, maxScore - minScore);
  nodes.forEach(node => {
    const relatedProducts = links
      .filter(link => link.source === node.id || link.target === node.id)
      .map(link => link.product);
    node.score = Math.max(...relatedProducts, 0);
    node.strength = (node.score - minScore) / scoreRange;
  });

  function interpolateHexColor(fromHex, toHex, t) {
    const from = fromHex.slice(1);
    const to = toHex.slice(1);
    const r = Math.round(parseInt(from.slice(0, 2), 16) + (parseInt(to.slice(0, 2), 16) - parseInt(from.slice(0, 2), 16)) * t);
    const g = Math.round(parseInt(from.slice(2, 4), 16) + (parseInt(to.slice(2, 4), 16) - parseInt(from.slice(2, 4), 16)) * t);
    const b = Math.round(parseInt(from.slice(4, 6), 16) + (parseInt(to.slice(4, 6), 16) - parseInt(from.slice(4, 6), 16)) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function scoreColor(strength) {
    const t = Math.max(0, Math.min(1, strength));
    if (t < 0.34) {
      return interpolateHexColor(SOL_FALLBACKS.base1, SOL_FALLBACKS.cyan, t / 0.34);
    }
    if (t < 0.72) {
      return interpolateHexColor(SOL_FALLBACKS.cyan, SOL_FALLBACKS.yellow, (t - 0.34) / 0.38);
    }
    return interpolateHexColor(SOL_FALLBACKS.yellow, SOL_FALLBACKS.orange, (t - 0.72) / 0.28);
  }

  function applyPuzzlePositions() {
    nodes.forEach(node => {
      const strengthPull = (node.strength - 0.5) * nodeSize * 0.08;
      node.fx = (node.c - (cols - 1) / 2) * nodeSize * 0.92 + node.gapX - strengthPull;
      node.fy = (node.r - (rows - 1) / 2) * nodeSize * 0.82 + node.gapY;
      node.x = node.fx;
      node.y = node.fy;
    });
  }

  function drawCenteredPill(ctx, text, x, y, fontSize, textColor, globalScale) {
    ctx.font = `bold ${fontSize / globalScale}px ${options.fontFamily || "var(--font-code, Consolas, monospace)"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const textWidth = ctx.measureText(text).width;
    const pillHeight = fontSize + 7 / globalScale;
    drawRoundedRect(
      ctx,
      x - textWidth / 2 - 6 / globalScale,
      y - pillHeight / 2,
      textWidth + 12 / globalScale,
      pillHeight,
      pillHeight / 2
    );
    ctx.fillStyle = utils.rgba(resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3, 0.84);
    ctx.fill();
    ctx.fillStyle = textColor;
    ctx.fillText(text, x, y);
  }

  function drawPuzzlePiece(node, ctx, globalScale = 1) {
    const time = performance.now() * 0.001;
    const rx = node.baseRx + Math.sin(time * 0.9 + node.phase) * 0.035;
    const ry = node.baseRy + Math.cos(time * 0.8 + node.phase) * 0.035;
    const rz = node.baseRz + Math.sin(time * 0.55 + node.phase) * 0.018;
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    const cosY = Math.cos(ry), sinY = Math.sin(ry);
    const cosZ = Math.cos(rz), sinZ = Math.sin(rz);
    const baseColor = scoreColor(node.strength);
    const border = resolveCssValue("var(--sol-base01)") || SOL_FALLBACKS.base01;
    const text = resolveCssValue("var(--sol-base03)") || SOL_FALLBACKS.base03;

    const rotatedVertices = node.model3d.vertices.map(v => {
      const x1 = v[0];
      const y1 = v[1] * cosX - v[2] * sinX;
      const z1 = v[1] * sinX + v[2] * cosX;
      const x2 = x1 * cosY + z1 * sinY;
      const y2 = y1;
      const z2 = -x1 * sinY + z1 * cosY;
      const x3 = x2 * cosZ - y2 * sinZ;
      const y3 = x2 * sinZ + y2 * cosZ;
      return [x3, y3, z2];
    });

    const facesData = node.model3d.faces.map((faceIndices, faceIndex) => {
      const faceVertices = faceIndices.map(idx => rotatedVertices[idx]);
      const [normNx, normNy, normNz] = computeFaceNormal3D(faceVertices);
      const centerZ = faceVertices.reduce((sum, v) => sum + v[2], 0) / faceVertices.length;
      return {
        faceIndex,
        isCap: faceIndex < 2,
        vertices: faceVertices,
        normal: [normNx, normNy, normNz],
        centerZ
      };
    });

    const visibleFaces = [
      ...facesData
        .filter(face => !face.isCap && face.normal[2] > -0.08)
        .sort((a, b) => a.faceIndex - b.faceIndex),
      ...facesData
        .filter(face => face.isCap && face.normal[2] > -0.08)
        .sort((a, b) => {
          if (Math.abs(a.centerZ - b.centerZ) > 0.0001) return a.centerZ - b.centerZ;
          return a.faceIndex - b.faceIndex;
        })
    ];

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = utils.rgba(baseColor, 0.24);
    ctx.shadowBlur = 10 + node.strength * 8;

    visibleFaces.forEach(face => {
      const dot = face.normal[0] * normLx + face.normal[1] * normLy + face.normal[2] * normLz;
      const intensity = ambientLight + (1 - ambientLight) * Math.max(0, dot);
      const projected = face.vertices.map(v => {
        const scale = cameraDistance / (cameraDistance - v[2]);
        return [v[0] * scale, v[1] * scale];
      });

      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i][0], projected[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle = shadeColor(baseColor, intensity);
      ctx.fill();

      if (face.isCap) {
        ctx.shadowBlur = 0;
        ctx.lineWidth = 0.8 / globalScale;
        ctx.strokeStyle = border;
        ctx.stroke();
      }
    });

    ctx.shadowBlur = 0;
    drawCenteredPill(ctx, node.label, 0, -9 / globalScale, labelFontSize, text, globalScale);
    drawCenteredPill(ctx, `max ${Math.round(node.score)}`, 0, 13 / globalScale, scoreFontSize, baseColor, globalScale);
    ctx.restore();
  }

  function drawConnectionLabel(link, ctx, globalScale = 1) {
    const source = link.source;
    const target = link.target;
    if (typeof source !== "object" || typeof target !== "object") return;

    const x = source.x + (target.x - source.x) * 0.5;
    const y = source.y + (target.y - source.y) * 0.5;
    const t = (link.product - minScore) / scoreRange;
    const color = scoreColor(t);
    const fSize = linkFontSize / globalScale;
    const lineHeight = fSize + 2 / globalScale;
    const lines = [`q=${link.q}`, `k=${link.k}`, `q×k=${link.product}`];

    ctx.save();
    ctx.font = `bold ${fSize}px ${options.fontFamily || "var(--font-code, Consolas, monospace)"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const textWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    const pillW = textWidth + 8 / globalScale;
    const pillH = lineHeight * lines.length + 6 / globalScale;
    drawRoundedRect(ctx, x - pillW / 2, y - pillH / 2, pillW, pillH, 5 / globalScale);
    ctx.fillStyle = utils.rgba(resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3, 0.92);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8 / globalScale;
    ctx.stroke();
    ctx.fillStyle = color;
    lines.forEach((line, index) => {
      const lineY = y + (index - 1) * lineHeight;
      ctx.fillText(line, x, lineY);
    });
    ctx.restore();
  }

  applyPuzzlePositions();

  const rect = targetEl.getBoundingClientRect();
  currentWidth = options.width || rect.width || widthFallback;
  const graph = ForceGraph()(graphHost)
    .graphData({ nodes, links })
    .backgroundColor("transparent")
    .width(currentWidth)
    .height(height)
    .cooldownTicks(Infinity)
    .linkWidth(link => 0.8 + ((link.product - minScore) / scoreRange) * 2.4)
    .linkColor(link => utils.rgba(scoreColor((link.product - minScore) / scoreRange), 0.62))
    .linkCanvasObjectMode(() => "after")
    .linkCanvasObject((link, ctx, globalScale) => {
      drawConnectionLabel(link, ctx, globalScale);
    })
    .enableZoomInteraction(false)
    .enablePanInteraction(false)
    .enableNodeDrag(false)
    .nodeCanvasObject((node, ctx, globalScale) => {
      ctx.save();
      ctx.translate(node.x, node.y);
      drawPuzzlePiece(node, ctx, globalScale);
      ctx.restore();
    })
    .nodePointerAreaPaint((node, color, ctx) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize * 0.55, 0, 2 * Math.PI);
      ctx.fill();
    });

  const autoZoom = (duration = 240) => {
    requestAnimationFrame(() => {
      const padding = nodeSize * 1.15;
      const xs = nodes.map(node => node.x ?? node.fx);
      const ys = nodes.map(node => node.y ?? node.fy);
      const minX = Math.min(...xs) - padding;
      const maxX = Math.max(...xs) + padding;
      const minY = Math.min(...ys) - padding;
      const maxY = Math.max(...ys) + padding;
      const targetZoom = Math.min(
        (currentWidth || widthFallback) / Math.max(1, maxX - minX),
        height / Math.max(1, maxY - minY)
      ) * 0.92;
      graph.centerAt((minX + maxX) / 2, (minY + maxY) / 2, duration);
      graph.zoom(targetZoom, duration);
    });
  };

  const resizeObserver = new ResizeObserver(entries => {
    const entry = entries[0];
    currentWidth = options.width || entry.contentRect.width || widthFallback;
    graph.width(currentWidth);
    applyPuzzlePositions();
    graph.graphData({ nodes, links });
    autoZoom(160);
  });
  resizeObserver.observe(targetEl);

  const animate = () => {
    graph.refresh();
    rafId = requestAnimationFrame(animate);
  };
  rafId = requestAnimationFrame(animate);
  setTimeout(() => autoZoom(300), 0);

  const api = {
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      graph._destructor?.();
      targetEl.innerHTML = "";
    }
  };

  if (invalidation && typeof invalidation.then === "function") {
    invalidation.then(() => api.destroy());
  }

  return api;
}

/**
 * Interactive token attention map. Click a token to show its strongest outgoing attention links.
 */
export function createAttentionTokenGraph(container, options = {}, invalidation = null) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) {
    console.warn("createAttentionTokenGraph: Target container not found.", container);
    return null;
  }
  targetEl.innerHTML = "";

  const tokens = options.tokens || ["Le", "chat", "mange", "car", "il", "a", "faim"];
  const matrix = options.matrix || [
    [0.35, 0.35, 0.10, 0.05, 0.05, 0.05, 0.05],
    [0.12, 0.40, 0.22, 0.05, 0.08, 0.05, 0.08],
    [0.05, 0.32, 0.18, 0.10, 0.12, 0.03, 0.20],
    [0.03, 0.08, 0.20, 0.18, 0.12, 0.07, 0.32],
    [0.04, 0.42, 0.12, 0.08, 0.22, 0.04, 0.08],
    [0.02, 0.18, 0.12, 0.08, 0.25, 0.25, 0.10],
    [0.02, 0.20, 0.22, 0.12, 0.18, 0.08, 0.18]
  ];
  const maxLinks = options.maxLinks ?? 3;
  const nodeSize = options.nodeSize ?? 58;
  const labelFontSize = options.labelFontSize ?? 18;
  const initialTargetRect = targetEl.getBoundingClientRect();
  const height = options.height ?? Math.max(initialTargetRect.height || 0, 440);
  const widthFallback = options.width ?? 720;
  const cameraDistance = options.cameraDistance ?? 210;
  const ambientLight = options.ambientLight ?? 0.42;
  const lightDirection = options.lightDirection || [-0.3, -0.4, 0.85];
  const colors = [
    "var(--sol-blue)",
    "var(--sol-cyan)",
    "var(--sol-green)",
    "var(--sol-yellow)",
    "var(--sol-orange)",
    "var(--sol-magenta)",
    "var(--sol-violet)"
  ];
  let activeIndex = Math.max(0, tokens.indexOf(options.activeToken || "mange"));
  let mode = options.mode || "assembled";
  let currentWidth = widthFallback;

  const lightLength = Math.sqrt(
    lightDirection[0] * lightDirection[0] +
    lightDirection[1] * lightDirection[1] +
    lightDirection[2] * lightDirection[2]
  ) || 1;
  const normLx = lightDirection[0] / lightLength;
  const normLy = lightDirection[1] / lightLength;
  const normLz = lightDirection[2] / lightLength;

  const controls = document.createElement("div");
  controls.className = "d-flex justify-content-end gap-2 mb-2";

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "btn btn-sm btn-outline-primary";
  controls.appendChild(toggleButton);

  const graphHost = document.createElement("div");
  graphHost.className = "w-100";
  graphHost.setAttribute("role", "img");
  graphHost.setAttribute("aria-label", "Carte d'attention interactive en pièces de puzzle");
  targetEl.style.setProperty("min-height", `${height}px`);
  graphHost.style.setProperty("height", `${height}px`);

  targetEl.appendChild(controls);
  targetEl.appendChild(graphHost);

  const grid = generatePuzzleGrid(1, tokens.length);
  const nodes = tokens.map((token, index) => ({
    id: token,
    label: token,
    index,
    color: colors[index % colors.length],
    edges: grid[index]?.edges || [0, 1, 0, -1],
    edgeProfiles: grid[index]?.edgeProfiles || [],
    size: nodeSize,
    status: index === activeIndex ? "current" : "default",
    rx: Math.random() * 2 * Math.PI,
    ry: Math.random() * 2 * Math.PI,
    rz: Math.random() * 2 * Math.PI,
    drx: (Math.random() * 0.018 + 0.006) * (Math.random() < 0.5 ? 1 : -1),
    dry: (Math.random() * 0.018 + 0.006) * (Math.random() < 0.5 ? 1 : -1),
    drz: (Math.random() * 0.012 + 0.003) * (Math.random() < 0.5 ? 1 : -1)
  }));
  nodes.forEach(node => {
    node.model3d = extrudePolygon(generatePuzzlePieceShape(node.size, node.edges, node.edgeProfiles), node.size * 0.32);
  });

  const linksForActive = () => matrix[activeIndex]
    .map((weight, index) => ({ weight, index }))
    .filter(({ index }) => index !== activeIndex)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxLinks)
    .map(({ weight, index }) => ({
      source: tokens[activeIndex],
      target: tokens[index],
      label: `${Math.round(weight * 100)}%`,
      weight,
      status: weight >= 0.25 ? "current" : "default"
    }))
    .concat([{
      source: tokens[activeIndex],
      target: tokens[activeIndex],
      label: `${Math.round(matrix[activeIndex][activeIndex] * 100)}%`,
      weight: matrix[activeIndex][activeIndex],
      status: "self",
      self: true
    }]);

  function attentionLinkColor(weight = 0) {
    const t = Math.max(0, Math.min(1, (weight - 0.05) / 0.4));
    const from = SOL_FALLBACKS.green.slice(1);
    const to = SOL_FALLBACKS.red.slice(1);
    const r = Math.round(parseInt(from.slice(0, 2), 16) + (parseInt(to.slice(0, 2), 16) - parseInt(from.slice(0, 2), 16)) * t);
    const g = Math.round(parseInt(from.slice(2, 4), 16) + (parseInt(to.slice(2, 4), 16) - parseInt(from.slice(2, 4), 16)) * t);
    const b = Math.round(parseInt(from.slice(4, 6), 16) + (parseInt(to.slice(4, 6), 16) - parseInt(from.slice(4, 6), 16)) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function attentionLinkWidth(weight = 0) {
    return 1.4 + Math.max(0, Math.min(1, weight / 0.42)) * 3.8;
  }

  function applyModePositions() {
    if (mode === "assembled") {
      nodes.forEach((node, index) => {
        node.fx = (index - (tokens.length - 1) / 2) * nodeSize;
        node.fy = 0;
        node.x = node.fx;
        node.y = node.fy;
        node.angle = 0;
      });
      return;
    }

    const radius = options.radius ?? Math.min(currentWidth, height) * 0.32;
    nodes.forEach((node, index) => {
      const angle = -Math.PI / 2 + (index / tokens.length) * Math.PI * 2;
      node.fx = Math.cos(angle) * radius;
      node.fy = Math.sin(angle) * radius;
      node.x = node.fx;
      node.y = node.fy;
      node.angle = angle + Math.PI / 2;
    });
  }

  function syncNodeStatus() {
    nodes.forEach((node, index) => {
      node.status = index === activeIndex ? "current" : "default";
    });
  }

  function updatePieceRotation(node) {
    if (mode === "assembled") {
      node.rx = normalizeAngle(node.rx) * 0.86;
      node.ry = normalizeAngle(node.ry) * 0.86;
      node.rz = normalizeAngle(node.rz) * 0.86;
      if (Math.abs(node.rx) < 0.001) node.rx = 0;
      if (Math.abs(node.ry) < 0.001) node.ry = 0;
      if (Math.abs(node.rz) < 0.001) node.rz = 0;
      return;
    }

    node.rx = (node.rx + node.drx) % (2 * Math.PI);
    node.ry = (node.ry + node.dry) % (2 * Math.PI);
    node.rz = (node.rz + node.drz) % (2 * Math.PI);
  }

  function drawPuzzlePiece(node, ctx, globalScale = 1) {
    const isActive = node.index === activeIndex;
    const size = node.size || nodeSize;
    const color = resolveCssValue(node.color) || SOL_FALLBACKS.blue;
    const border = resolveCssValue(isActive ? "var(--sol-blue)" : "var(--sol-base01)") || SOL_FALLBACKS.base01;
    const text = resolveCssValue(isActive ? "var(--sol-blue)" : "var(--sol-base03)") || SOL_FALLBACKS.base03;

    updatePieceRotation(node);

    ctx.save();
    if (mode === "circle") {
      ctx.rotate(node.angle || 0);
    }

    const cosX = Math.cos(node.rx), sinX = Math.sin(node.rx);
    const cosY = Math.cos(node.ry), sinY = Math.sin(node.ry);
    const cosZ = Math.cos(node.rz), sinZ = Math.sin(node.rz);

    const rotatedVertices = node.model3d.vertices.map(v => {
      const x1 = v[0];
      const y1 = v[1] * cosX - v[2] * sinX;
      const z1 = v[1] * sinX + v[2] * cosX;
      const x2 = x1 * cosY + z1 * sinY;
      const y2 = y1;
      const z2 = -x1 * sinY + z1 * cosY;
      const x3 = x2 * cosZ - y2 * sinZ;
      const y3 = x2 * sinZ + y2 * cosZ;
      return [x3, y3, z2];
    });

    const facesData = node.model3d.faces.map((faceIndices, faceIndex) => {
      const faceVertices = faceIndices.map(idx => rotatedVertices[idx]);
      const [normNx, normNy, normNz] = computeFaceNormal3D(faceVertices);
      const centerZ = faceVertices.reduce((sum, v) => sum + v[2], 0) / faceVertices.length;
      return {
        faceIndex,
        isCap: faceIndex < 2,
        vertices: faceVertices,
        normal: [normNx, normNy, normNz],
        centerZ
      };
    });

    const visibleFaces = [
      ...facesData
        .filter(face => !face.isCap && face.normal[2] > -0.08)
        .sort((a, b) => a.faceIndex - b.faceIndex),
      ...facesData
        .filter(face => face.isCap && face.normal[2] > -0.08)
        .sort((a, b) => {
          if (Math.abs(a.centerZ - b.centerZ) > 0.0001) return a.centerZ - b.centerZ;
          return a.faceIndex - b.faceIndex;
        })
    ];

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = isActive ? utils.rgba(border, 0.35) : "transparent";
    ctx.shadowBlur = isActive ? 16 : 0;

    visibleFaces.forEach(face => {
      const dot = face.normal[0] * normLx + face.normal[1] * normLy + face.normal[2] * normLz;
      const intensity = ambientLight + (1 - ambientLight) * Math.max(0, dot);
      const projected = face.vertices.map(v => {
        const scale = cameraDistance / (cameraDistance - v[2]);
        return [v[0] * scale, v[1] * scale];
      });

      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i][0], projected[i][1]);
      }
      ctx.closePath();

      ctx.fillStyle = shadeColor(color, intensity);
      ctx.fill();

      if (face.isCap) {
        ctx.shadowBlur = 0;
        ctx.lineWidth = (isActive ? 1.1 : 0.7) / globalScale;
        ctx.strokeStyle = border;
        ctx.stroke();
      }
    });
    ctx.shadowBlur = 0;

    if (mode === "circle") {
      ctx.rotate(-(node.angle || 0));
    }
    const nodeFontSize = Math.max(labelFontSize, size * 0.28) / globalScale;
    ctx.font = `bold ${nodeFontSize}px ${options.fontFamily || "var(--font-code, Consolas, monospace)"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelWidth = ctx.measureText(node.label).width;
    const labelHeight = nodeFontSize + 8 / globalScale;
    drawRoundedRect(ctx, -labelWidth / 2 - 5 / globalScale, -labelHeight / 2, labelWidth + 10 / globalScale, labelHeight, labelHeight / 2);
    ctx.fillStyle = utils.rgba(resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3, 0.78);
    ctx.fill();
    ctx.fillStyle = text;
    ctx.fillText(node.label, 0, 0);
    ctx.restore();
  }

  function currentGraphData() {
    syncNodeStatus();
    applyModePositions();
    toggleButton.textContent = mode === "assembled" ? "Désassembler" : "Assembler";
    return {
      nodes,
      links: mode === "circle" ? linksForActive() : []
    };
  }

  const rect = targetEl.getBoundingClientRect();
  currentWidth = options.width || rect.width || widthFallback;

  const autoZoom = (duration = 300) => {
    requestAnimationFrame(() => {
      try {
        const padding = mode === "assembled" ? nodeSize * 1.35 : nodeSize * 1.55;
        const xs = nodes.map(node => node.x ?? node.fx);
        const ys = nodes.map(node => node.y ?? node.fy);
        const minX = Math.min(...xs) - padding;
        const maxX = Math.max(...xs) + padding;
        const minY = Math.min(...ys) - padding;
        const maxY = Math.max(...ys) + padding;
        const worldWidth = Math.max(1, maxX - minX);
        const worldHeight = Math.max(1, maxY - minY);
        const targetZoom = Math.min(
          (currentWidth || widthFallback) / worldWidth,
          height / worldHeight
        ) * 0.9;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        graph.centerAt(centerX, centerY, duration);
        graph.zoom(targetZoom, duration);
      } catch (err) {
        console.warn("attention graph zoomToFit error:", err);
      }
    });
  };

  const refreshGraph = () => {
    graph.graphData(currentGraphData());
    graph.d3ReheatSimulation();
    autoZoom(280);
  };

  const graph = ForceGraph()(graphHost)
    .graphData(currentGraphData())
    .backgroundColor("transparent")
    .width(options.width || rect.width || widthFallback)
    .height(height)
    .cooldownTicks(Infinity)
    .enableZoomInteraction(false)
    .enablePanInteraction(false)
    .enableNodeDrag(false)
    .nodeCanvasObject((node, ctx, globalScale) => {
      ctx.save();
      ctx.translate(node.x, node.y);
      drawPuzzlePiece(node, ctx, globalScale);
      ctx.restore();
    })
    .nodePointerAreaPaint((node, color, ctx) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize * 0.46, 0, 2 * Math.PI);
      ctx.fill();
    })
    .linkWidth(link => attentionLinkWidth(link.weight))
    .linkColor(link => attentionLinkColor(link.weight))
    .linkDirectionalArrowLength(link => 5 + attentionLinkWidth(link.weight) * 1.5)
    .linkDirectionalArrowColor(link => attentionLinkColor(link.weight))
    .linkDirectionalArrowRelPos(0.88)
    .linkCurvature(link => {
      if (link.self) return 0;
      const sourceIndex = typeof link.source === "object" ? link.source.index : tokens.indexOf(link.source);
      const targetIndex = typeof link.target === "object" ? link.target.index : tokens.indexOf(link.target);
      const span = Math.abs(targetIndex - sourceIndex);
      const direction = targetIndex > sourceIndex ? 1 : -1;
      return direction * (0.22 + span * 0.025);
    })
    .linkCanvasObjectMode(() => "after")
    .linkCanvasObject((link, ctx, globalScale) => {
      const source = link.source;
      const target = link.target;
      if (typeof source !== "object" || typeof target !== "object") return;

      if (link.self) {
        const color = attentionLinkColor(link.weight);
        const loopRadius = (source.size || nodeSize) * 0.72;
        const loopX = source.x;
        const loopY = source.y - loopRadius * 0.72;
        const fSize = 13 / globalScale;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = attentionLinkWidth(link.weight) / globalScale;
        ctx.beginPath();
        ctx.ellipse(loopX, loopY, loopRadius * 0.72, loopRadius * 0.46, -0.35, 0.15 * Math.PI, 1.92 * Math.PI);
        ctx.stroke();

        const arrowAngle = -0.55;
        const arrowX = loopX + Math.cos(arrowAngle) * loopRadius * 0.54;
        const arrowY = loopY + Math.sin(arrowAngle) * loopRadius * 0.35;
        const arrowSize = 7 / globalScale;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - Math.cos(arrowAngle - 0.55) * arrowSize, arrowY - Math.sin(arrowAngle - 0.55) * arrowSize);
        ctx.lineTo(arrowX - Math.cos(arrowAngle + 0.55) * arrowSize, arrowY - Math.sin(arrowAngle + 0.55) * arrowSize);
        ctx.closePath();
        ctx.fill();

        ctx.font = `bold ${fSize}px ${options.fontFamily || "var(--font-code, Consolas, monospace)"}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = `self ${link.label}`;
        const textWidth = ctx.measureText(label).width;
        const pillW = textWidth + 10 / globalScale;
        const pillH = fSize + 7 / globalScale;
        const labelY = loopY - loopRadius * 0.5;
        drawRoundedRect(ctx, loopX - pillW / 2, labelY - pillH / 2, pillW, pillH, pillH / 2);
        ctx.fillStyle = utils.rgba(resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3, 0.9);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(label, loopX, labelY);
        ctx.restore();
        return;
      }

      const x = source.x + (target.x - source.x) * 0.5;
      const y = source.y + (target.y - source.y) * 0.5;
      const color = attentionLinkColor(link.weight);
      const fSize = 13 / globalScale;
      ctx.save();
      ctx.font = `bold ${fSize}px ${options.fontFamily || "var(--font-code, Consolas, monospace)"}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const textWidth = ctx.measureText(link.label).width;
      const pillW = textWidth + 10 / globalScale;
      const pillH = fSize + 7 / globalScale;
      drawRoundedRect(ctx, x - pillW / 2, y - pillH / 2, pillW, pillH, pillH / 2);
      ctx.fillStyle = utils.rgba(resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3, 0.9);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(link.label, x, y);
      ctx.restore();
    })
    .onNodeClick(node => {
      // Selection is handled by the native nearest-node click below because
      // ForceGraph hit regions can overlap while pieces rotate in 3D.
    })
    .onNodeHover(node => {
      graphHost.style.setProperty("cursor", node ? "pointer" : "default");
    });

  const resizeObserver = new ResizeObserver(entries => {
    const entry = entries[0];
    currentWidth = options.width || entry.contentRect.width || widthFallback;
    graph.width(currentWidth);
    graph.graphData(currentGraphData());
    graph.d3ReheatSimulation();
    autoZoom(180);
  });
  resizeObserver.observe(targetEl);

  const selectNearestFromEvent = event => {
    const rect = graphHost.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const graphCoords = typeof graph.screen2GraphCoords === "function"
      ? graph.screen2GraphCoords(screenX, screenY)
      : null;
    const nearest = nodes
      .map(node => {
        const dx = (graphCoords?.x ?? Number.NaN) - (node.x ?? node.fx);
        const dy = (graphCoords?.y ?? Number.NaN) - (node.y ?? node.fy);
        return {
          id: node.id,
          distance: Number.isFinite(dx) && Number.isFinite(dy) ? Math.sqrt(dx * dx + dy * dy) : null,
          x: node.x,
          y: node.y,
          fx: node.fx,
          fy: node.fy
        };
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))[0];
    if (event.type === "pointermove") {
      graphHost.style.setProperty("cursor", nearest?.distance !== null && nearest.distance <= nodeSize * 1.25 ? "pointer" : "default");
      return;
    }
    if (event.type === "click" && nearest?.distance !== null && nearest.distance <= nodeSize * 1.25) {
      activeIndex = tokens.indexOf(nearest.id);
      mode = "circle";
      refreshGraph();
    }
  };
  graphHost.addEventListener("pointerdown", selectNearestFromEvent);
  graphHost.addEventListener("pointermove", selectNearestFromEvent);
  graphHost.addEventListener("click", selectNearestFromEvent);

  toggleButton.addEventListener("click", () => {
    mode = mode === "assembled" ? "circle" : "assembled";
    refreshGraph();
  });
  setTimeout(() => autoZoom(300), 0);

  const api = {
    assemble() {
      mode = "assembled";
      refreshGraph();
    },
    disassemble() {
      mode = "circle";
      refreshGraph();
    },
    destroy() {
      resizeObserver.disconnect();
      graphHost.removeEventListener("pointerdown", selectNearestFromEvent);
      graphHost.removeEventListener("pointermove", selectNearestFromEvent);
      graphHost.removeEventListener("click", selectNearestFromEvent);
      controls.remove();
      graphHost.remove();
    }
  };

  if (invalidation) {
    invalidation.then(() => api.destroy());
  }

  return api;
}

