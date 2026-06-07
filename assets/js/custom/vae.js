// =====================================================================
// vae.js — VAE simulations (interpolation & VQ-VAE codebook)
// =====================================================================

import { createSvgDistanceHandle } from "./svg-distance-handle.js";
import { createMetricsCards, updateMetricsCards } from "./metrics.js";

function resolveTarget(target) {
  return typeof target === "string" ? document.querySelector(target) : target;
}

const AE_RANDOM_EMOJIS = ["🧦", "🍕", "🪐", "🎲", "🦆", "🌵", "🧃", "🚲", "🪄", "🫧"];

function pickAeRandomEmoji(position) {
  if (!position) return AE_RANDOM_EMOJIS[0];
  const bucket = Math.floor(position.x / 32) + Math.floor(position.y / 28) * 7;
  return AE_RANDOM_EMOJIS[Math.abs(bucket) % AE_RANDOM_EMOJIS.length];
}

function getLatentSemanticState({ alpha, distances, isVae, position }) {
  const nearChat = distances.chat < 50;
  const nearDog = distances.chien < 50;

  if (!isVae && !nearChat && !nearDog) {
    return { emoji: pickAeRandomEmoji(position), label: "Décodage aléatoire" };
  }

  if (alpha < 0.33 || nearChat) {
    return { emoji: "🐱", label: "Chat" };
  }
  if (alpha > 0.66 || nearDog) {
    return { emoji: "🐶", label: "Chien" };
  }

  return { emoji: "🦊", label: "Renard" };
}

function renderLatentSemanticOverlay({ layer, createSvgElement, anchors, alpha, distances, isVae, position }) {
  anchors.forEach(anchor => {
    const emoji = anchor.id === "chat" ? "🐱" : "🐶";
    const text = createSvgElement("text", {
      x: anchor.x,
      y: anchor.y - 48,
      "text-anchor": "middle",
      "font-size": "42px",
      "font-weight": "700"
    });
    text.textContent = emoji;
    layer.appendChild(text);
  });

  const semantic = getLatentSemanticState({ alpha, distances, isVae, position });
  const semanticEmoji = createSvgElement("text", {
    x: position.x,
    y: Math.max(48, position.y - 24),
    "text-anchor": "middle",
    "font-size": "52px",
    "font-weight": "700",
    "paint-order": "stroke",
    "stroke-width": "4"
  }, {
    stroke: "var(--sol-base3)"
  });
  semanticEmoji.textContent = semantic.emoji;
  layer.appendChild(semanticEmoji);

  const midpoint = createSvgElement("text", {
    x: 280,
    y: 248,
    "text-anchor": "middle",
    "font-size": "18px",
    "font-weight": "700"
  }, { fill: "var(--sol-base1)" });
  midpoint.textContent = semantic.label;
  layer.appendChild(midpoint);
}

function getLatentHandleOptions(mode, onAlphaChange) {
  const isVae = mode.startsWith("VAE");
  const auraRadius = isVae ? 120 : 35;
  const auraOpacity = isVae ? 0.35 : 0.15;

  return {
    anchors: [
      { id: "chat", label: "Chat", x: 84, y: 140, color: "var(--accent-info)", auraRadius, auraOpacity },
      { id: "chien", label: "Chien", x: 476, y: 140, color: "var(--accent-danger)", auraRadius, auraOpacity }
    ],
    footerLabel: isVae ? "VAE - espace continu" : "AE - espace fragmenté",
    footerColor: isVae ? "var(--accent-success)" : "var(--accent-danger)",
    statusFormatter: ({ alpha, distances, position }) => {
      const inGap = Math.min(distances.chat, distances.chien) > 50;
      const semantic = getLatentSemanticState({ alpha, distances, isVae, position });

      if (isVae) {
        if (alpha < 0.33) return { label: `${semantic.emoji} Chat`, color: "var(--accent-info)" };
        if (alpha > 0.66) return { label: `${semantic.emoji} Chien`, color: "var(--accent-danger)" };
        return { label: `${semantic.emoji} Renard : transition lisible`, color: "var(--accent-warning)" };
      }

      return {
        label: inGap ? `${semantic.emoji} Trou sémantique (AE)` : `${semantic.emoji} Zone valide`,
        color: inGap ? "var(--accent-danger)" : "var(--accent-success)"
      };
    },
    alphaLabelFormatter: ({ alpha, distances, position }) => {
      const semantic = getLatentSemanticState({ alpha, distances, isVae, position });
      return `${semantic.emoji} alpha = ${alpha.toFixed(2)}`;
    },
    renderOverlay: ({ layer, createSvgElement, anchors, alpha, distances, position }) => {
      renderLatentSemanticOverlay({ layer, createSvgElement, anchors, alpha, distances, isVae, position });
    },
    onChange: ({ alpha, position, distances, anchors }) => {
      onAlphaChange?.({ alpha, position, distances, anchors });
    }
  };
}

/**
 * Render latent space interpolation between two endpoints.
 */
export function renderLatentInterpolation(containerEl, { mode = "AE (Déterministe)", alpha, onAlphaChange } = {}) {
  if (!containerEl) return null;

  const options = getLatentHandleOptions(mode, onAlphaChange);

  if (containerEl.__state) {
    containerEl.__state.update({
      ...options,
      alpha
    });
    return containerEl.__state.svg;
  }

  const controller = createSvgDistanceHandle(containerEl, {
    ...options,
    alpha
  });
  const destroy = controller.destroy;
  controller.destroy = () => {
    destroy();
    delete containerEl.__state;
  };
  containerEl.__state = controller;

  return controller.svg;
}

function findNearestCode(codebook, x, y) {
  return codebook.reduce((best, point) => {
    const distance = Math.hypot(point.x - x, point.y - y);
    return distance < best.distance ? { point, distance } : best;
  }, { point: codebook[0], distance: Infinity });
}

function getVqVaeMetrics({ codebook = [], x = 0, y = 0 } = {}) {
  const nearest = findNearestCode(codebook, x, y);

  const distState = nearest.distance < 1.5 ? "text-success" : nearest.distance < 3 ? "text-warning" : "text-danger";
  return [
    {
      id: "vector",
      label: "Vecteur continu",
      value: `[${x.toFixed(2)}, ${y.toFixed(2)}]`,
      valueClass: "text-info"
    },
    {
      id: "code",
      label: "Code VQ (k*)",
      value: nearest.point?.id ?? "-",
      valueClass: "text-success"
    },
    {
      id: "distance",
      label: "Distance Euclidienne",
      value: nearest.distance.toFixed(3),
      valueClass: distState
    }
  ];
}

/**
 * Render VQ-VAE metrics.
 */
export function renderVqVaeMetrics({ codebook = [], x = 0, y = 0 } = {}) {
  return createMetricsCards(getVqVaeMetrics({ codebook, x, y }));
}

function replaceVqMetrics(target, { codebook, x, y }) {
  updateMetricsCards(target, getVqVaeMetrics({ codebook, x, y }));
}

function createVqOverlayRenderer(codebook, width, height) {
  const toX = v => (v / 10) * width;
  const toY = v => (v / 10) * height;
  const toDataX = px => (px / width) * 10;
  const toDataY = px => (px / height) * 10;

  return ({ layer, createSvgElement, position }) => {
    const qx = toDataX(position.x);
    const qy = toDataY(position.y);
    const nearest = findNearestCode(codebook, qx, qy);

    [2, 4, 6, 8].forEach(v => {
      layer.appendChild(createSvgElement("line", {
        x1: toX(v), y1: 0, x2: toX(v), y2: height,
        "stroke-width": "0.5"
      }, { stroke: "var(--sol-base02)" }));
      layer.appendChild(createSvgElement("line", {
        x1: 0, y1: toY(v), x2: width, y2: toY(v),
        "stroke-width": "0.5"
      }, { stroke: "var(--sol-base02)" }));
    });

    codebook.forEach(pt => {
      const isNearest = pt.id === nearest.point?.id;
      layer.appendChild(createSvgElement("circle", {
        cx: toX(pt.x), cy: toY(pt.y), r: isNearest ? 9 : 5,
        "stroke-width": isNearest ? 1.5 : 0
      }, {
        fill: isNearest ? "var(--sol-green)" : "var(--sol-base01)",
        stroke: isNearest ? "var(--sol-base3)" : "none"
      }));

      if (isNearest) {
        layer.appendChild(createSvgElement("rect", {
          x: toX(pt.x) + 12, y: toY(pt.y) - 10, width: 30, height: 18, rx: 4
        }, { fill: "var(--sol-green)" }));

        const txt = createSvgElement("text", {
          x: toX(pt.x) + 27, y: toY(pt.y) + 1, dy: ".35em",
          "text-anchor": "middle",
          "font-size": "9px",
          "font-weight": "700"
        }, {
          fill: "var(--sol-base3)",
          "font-family": "var(--font-code, monospace)"
        });
        txt.textContent = pt.id;
        layer.appendChild(txt);
      }
    });

    if (!nearest.point) return;

    layer.appendChild(createSvgElement("line", {
      x1: position.x, y1: position.y,
      x2: toX(nearest.point.x), y2: toY(nearest.point.y),
      "stroke-width": 2, "stroke-dasharray": "5,3"
    }, { stroke: "var(--sol-red)" }));

    const mx = (position.x + toX(nearest.point.x)) / 2;
    const my = (position.y + toY(nearest.point.y)) / 2;
    layer.appendChild(createSvgElement("rect", {
      x: mx - 20, y: my - 9, width: 40, height: 18, rx: 4
    }, { fill: "var(--sol-base02)", opacity: 0.9 }));

    const distTxt = createSvgElement("text", {
      x: mx, y: my + 1, dy: ".35em",
      "text-anchor": "middle",
      "font-size": "9px",
      "font-weight": "700"
    }, {
      fill: "var(--sol-red)",
      "font-family": "var(--font-code, monospace)"
    });
    distTxt.textContent = `d=${nearest.distance.toFixed(2)}`;
    layer.appendChild(distTxt);

    layer.appendChild(createSvgElement("rect", {
      x: toX(nearest.point.x) - 52, y: toY(nearest.point.y) + 14, width: 104, height: 18, rx: 4
    }, { fill: "var(--sol-green)" }));

    const vqTxt = createSvgElement("text", {
      x: toX(nearest.point.x), y: toY(nearest.point.y) + 23, dy: ".35em",
      "text-anchor": "middle",
      "font-size": "9px",
      "font-weight": "700"
    }, {
      fill: "var(--sol-base3)",
      "font-family": "var(--font-code, monospace)"
    });
    vqTxt.textContent = `VQ [${nearest.point.x.toFixed(1)}, ${nearest.point.y.toFixed(1)}]`;
    layer.appendChild(vqTxt);
  };
}

/**
 * Render VQ-VAE 2D Codebook Quantization Visualization using pure vanilla DOM
 */
export function renderVqVaeCodebook(containerEl, { codebook = [], x = 3.4, y = 7.8, metricsTarget } = {}) {
  containerEl = resolveTarget(containerEl);
  if (!containerEl) return null;

  const width = 400;
  const height = 360;
  const toSvgX = value => (value / 10) * width;
  const toSvgY = value => (value / 10) * height;
  const toDataX = value => (value / width) * 10;
  const toDataY = value => (value / height) * 10;
  const initialPosition = { x: toSvgX(+x), y: toSvgY(+y) };
  const renderOverlay = createVqOverlayRenderer(codebook, width, height);

  const options = {
    width,
    height,
    position: initialPosition,
    anchors: [
      { id: "x0", label: "", x: 0, y: height / 2, radius: 0, auraRadius: 0 },
      { id: "x1", label: "", x: width, y: height / 2, radius: 0, auraRadius: 0 }
    ],
    showAnchors: false,
    showAnchorLine: false,
    handleColor: "var(--sol-blue)",
    handleLabelOffsetY: -19,
    footerLabel: "VQ-VAE - quantification",
    footerColor: "var(--sol-green)",
    styles: {
      "max-width": "440px",
      margin: "0 auto"
    },
    alphaLabelFormatter: ({ position }) => `IN [${toDataX(position.x).toFixed(1)}, ${toDataY(position.y).toFixed(1)}]`,
    statusFormatter: ({ position }) => {
      const nearest = findNearestCode(codebook, toDataX(position.x), toDataY(position.y));
      return { label: `Code VQ : ${nearest.point?.id ?? "-"}`, color: "var(--sol-green)" };
    },
    renderOverlay,
    onChange: ({ position }) => {
      replaceVqMetrics(metricsTarget, {
        codebook,
        x: toDataX(position.x),
        y: toDataY(position.y)
      });
    }
  };

  if (containerEl.__vqVaeState) {
    containerEl.__vqVaeState.update(options);
    replaceVqMetrics(metricsTarget, {
      codebook,
      x: toDataX(containerEl.__vqVaeState.position.x),
      y: toDataY(containerEl.__vqVaeState.position.y)
    });
    return containerEl.__vqVaeState;
  }

  const controller = createSvgDistanceHandle(containerEl, options);
  const destroy = controller.destroy;
  controller.destroy = () => {
    destroy();
    delete containerEl.__vqVaeState;
  };
  containerEl.__vqVaeState = controller;
  replaceVqMetrics(metricsTarget, { codebook, x: +x, y: +y });

  return controller;
}

/**
 * Generate a deterministic pseudo-random 2D codebook of 16 vectors
 */
export function generateVqCodebook() {
  const rng = (() => {
    let s = 42;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  })();
  return Array.from({ length: 16 }, (_, i) => ({
    id: `E${(i + 1).toString().padStart(2, '0')}`,
    x: 0.5 + rng() * 9,
    y: 0.5 + rng() * 9
  }));
}
