// ==========================================
// networks.js - Composants de Réseaux et de Graphes
// ==========================================
import ForceGraph from "https://esm.sh/force-graph";
import ForceGraph3D from "https://esm.sh/3d-force-graph?bundle";
import SpriteText from "https://esm.sh/three-spritetext?bundle";
import TagCloud from "https://esm.sh/TagCloud";
import { resolveCssValue, utils } from "./core.js";

export const SOL_FALLBACKS = {
  base03: "#002b36", base02: "#073642", base01: "#586e75", base00: "#657b83",
  base0: "#839496", base1: "#93a1a1", base2: "#eee8d5", base3: "#fdf6e3",
  yellow: "#b58900", orange: "#cb4b16", red: "#dc322f", magenta: "#d33682",
  violet: "#6c71c4", blue: "#268bd2", cyan: "#2aa198", green: "#859900"
};

/**
 * Helper to draw a rounded rectangle on a 2D Canvas context.
 */
export function drawRoundedRect(ctx, x, y, width, height, radius) {
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

