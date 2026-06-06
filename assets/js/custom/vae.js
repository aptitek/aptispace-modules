// =====================================================================
// vae.js — VAE simulations (interpolation & VQ-VAE codebook)
// =====================================================================

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}, styles = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  Object.entries(styles).forEach(([key, value]) => node.style.setProperty(key, value));
  return node;
}

/**
 * Render latent space interpolation between two endpoints
 */
export function renderLatentInterpolation({ mode = "AE (Déterministe)", alpha = 0.15 } = {}) {
  const isVae = mode.startsWith("VAE");
  const width = 560;
  const height = 280;
  const pointA = { x: width * 0.15, y: height / 2 };
  const pointB = { x: width * 0.85, y: height / 2 };
  const cursorX = pointA.x + alpha * (pointB.x - pointA.x);
  const auraRadius = isVae ? 120 : 35;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "xMidYMid meet"
  }, {
    width: "100%",
    height: "auto",
    display: "block",
    background: "var(--sol-base03)",
    "border-radius": "12px"
  });

  const defs = svgEl("defs");
  [
    ["nodeA", "var(--accent-info)"],
    ["nodeB", "var(--accent-danger)"]
  ].forEach(([id, color]) => {
    const gradient = svgEl("radialGradient", { id });
    gradient.appendChild(svgEl("stop", { offset: "0%" }, {
      "stop-color": color,
      "stop-opacity": isVae ? "0.35" : "0.15"
    }));
    gradient.appendChild(svgEl("stop", { offset: "100%" }, {
      "stop-color": color,
      "stop-opacity": "0"
    }));
    defs.appendChild(gradient);
  });
  svg.appendChild(defs);

  svg.appendChild(svgEl("line", {
    x1: pointA.x, y1: height / 2, x2: pointB.x, y2: height / 2,
    "stroke-width": 2, "stroke-dasharray": "6,4"
  }, { stroke: "var(--sol-base01)" }));

  [
    { point: pointA, id: "nodeA", color: "var(--accent-info)", label: "Chat" },
    { point: pointB, id: "nodeB", color: "var(--accent-danger)", label: "Chien" }
  ].forEach(({ point, id, color, label }) => {
    svg.appendChild(svgEl("circle", { cx: point.x, cy: point.y, r: auraRadius }, {
      fill: `url(#${id})`
    }));
    svg.appendChild(svgEl("circle", {
      cx: point.x, cy: point.y, r: 30, "stroke-width": 2
    }, { fill: color, stroke: "var(--sol-base3)" }));
    const text = svgEl("text", {
      x: point.x, y: point.y, "text-anchor": "middle", dy: ".35em",
      "font-size": "14px", "font-weight": "700"
    }, { fill: "var(--sol-base3)" });
    text.textContent = label;
    svg.appendChild(text);
  });

  svg.appendChild(svgEl("circle", {
    cx: cursorX, cy: height / 2, r: 10, "stroke-width": 2
  }, {
    fill: "var(--accent-warning)",
    stroke: "var(--sol-base3)",
    filter: "drop-shadow(0 0 8px var(--accent-warning))"
  }));

  const alphaLabel = svgEl("text", {
    x: cursorX, y: height / 2 + 26, "text-anchor": "middle",
    "font-size": "10px", "font-weight": "700"
  }, { fill: "var(--accent-warning)" });
  alphaLabel.textContent = `alpha = ${alpha.toFixed(2)}`;
  svg.appendChild(alphaLabel);

  const inGap = alpha > 0.2 && alpha < 0.8;
  const state = isVae
    ? alpha < 0.2
      ? { label: "Chat", color: "var(--accent-info)" }
      : alpha > 0.8
        ? { label: "Chien", color: "var(--accent-danger)" }
        : { label: "Interpolation continue", color: "var(--accent-warning)" }
    : { label: inGap ? "Trou sémantique (AE)" : "Zone valide", color: inGap ? "var(--accent-danger)" : "var(--accent-success)" };

  const stateLabel = svgEl("text", {
    x: width / 2, y: 24, "text-anchor": "middle",
    "font-size": "13px", "font-weight": "700"
  }, { fill: state.color });
  stateLabel.textContent = state.label;
  svg.appendChild(stateLabel);

  const modeLabel = svgEl("text", {
    x: width - 10, y: height - 8, "text-anchor": "end",
    "font-size": "10px", "font-weight": "700"
  }, { fill: isVae ? "var(--accent-success)" : "var(--accent-danger)" });
  modeLabel.textContent = isVae ? "VAE - espace continu" : "AE - espace fragmenté";
  svg.appendChild(modeLabel);

  return svg;
}

function metricCard(label, value, valueClass) {
  const card = document.createElement("div");
  card.className = "card p-3 flex-fill text-center shadow-none border";
  card.style.setProperty("background", "var(--sol-base2)");
  card.style.setProperty("border-color", "var(--sol-base1)");
  
  const labelEl = document.createElement("div");
  labelEl.className = "text-muted small text-uppercase fw-bold mb-1";
  labelEl.textContent = label;
  
  const valueEl = document.createElement("div");
  valueEl.className = `fw-bold font-monospace fs-5 ${valueClass}`;
  valueEl.textContent = value;
  
  card.append(labelEl, valueEl);
  return card;
}

/**
 * Render VQ-VAE metrics
 */
export function renderVqVaeMetrics({ codebook = [], x = 0, y = 0 } = {}) {
  const nearest = codebook.reduce((best, point) => {
    const distance = Math.hypot(point.x - x, point.y - y);
    return distance < best.distance ? { point, distance } : best;
  }, { point: codebook[0], distance: Infinity });

  const distState = nearest.distance < 1.5 ? "text-success" : nearest.distance < 3 ? "text-warning" : "text-danger";
  const row = document.createElement("div");
  row.className = "d-flex flex-column flex-sm-row gap-3 mb-3";
  row.append(
    metricCard("Vecteur continu", `[${x.toFixed(2)}, ${y.toFixed(2)}]`, "text-info"),
    metricCard("Code VQ (k*)", nearest.point?.id ?? "-", "text-success"),
    metricCard("Distance Euclidienne", nearest.distance.toFixed(3), distState)
  );
  return row;
}

/**
 * Render VQ-VAE 2D Codebook Quantization Visualization using pure vanilla DOM
 */
export function renderVqVaeCodebook(containerEl, { codebook = [], x = 3.4, y = 7.8 } = {}) {
  if (!containerEl) return;
  containerEl.innerHTML = "";

  const qx = +x, qy = +y;

  // Find nearest
  let minD = Infinity, nearest = codebook[0];
  codebook.forEach(pt => {
    const d = Math.hypot(pt.x - qx, pt.y - qy);
    if (d < minD) {
      minD = d;
      nearest = pt;
    }
  });

  const W = 400, H = 360;
  const toX = v => (v / 10) * W;
  const toY = v => (v / 10) * H;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: "xMidYMid meet"
  }, {
    width: "100%",
    "max-width": "440px",
    height: "auto",
    display: "block",
    margin: "0 auto",
    background: "var(--sol-base03)",
    "border-radius": "12px"
  });

  // Grid lines
  [2, 4, 6, 8].forEach(v => {
    svg.appendChild(svgEl("line", {
      x1: toX(v), y1: 0, x2: toX(v), y2: H,
      "stroke-width": "0.5"
    }, { stroke: "var(--sol-base02)" }));
    svg.appendChild(svgEl("line", {
      x1: 0, y1: toY(v), x2: W, y2: toY(v),
      "stroke-width": "0.5"
    }, { stroke: "var(--sol-base02)" }));
  });

  // Codebook points
  codebook.forEach(pt => {
    const isNearest = pt.id === nearest.id;
    svg.appendChild(svgEl("circle", {
      cx: toX(pt.x), cy: toY(pt.y), r: isNearest ? 9 : 5,
      fill: isNearest ? "var(--sol-green)" : "var(--sol-base01)",
      stroke: isNearest ? "var(--sol-base3)" : "none",
      "stroke-width": isNearest ? 1.5 : 0
    }));
    if (isNearest) {
      svg.appendChild(svgEl("rect", {
        x: toX(pt.x) + 12, y: toY(pt.y) - 10, width: 30, height: 18, rx: 4
      }, { fill: "var(--sol-green)" }));
      
      const txt = svgEl("text", {
        x: toX(pt.x) + 27, y: toY(pt.y) + 1, dy: ".35em",
        "text-anchor": "middle",
        "font-size": "9px",
        "font-weight": "700"
      }, {
        fill: "var(--sol-base3)",
        "font-family": "var(--font-code, monospace)"
      });
      txt.textContent = pt.id;
      svg.appendChild(txt);
    }
  });

  // Quantization line (dashed line between input and nearest)
  svg.appendChild(svgEl("line", {
    x1: toX(qx), y1: toY(qy),
    x2: toX(nearest.x), y2: toY(nearest.y),
    "stroke-width": 2, "stroke-dasharray": "5,3"
  }, { stroke: "var(--sol-red)" }));

  // Distance label at midpoint
  const mx = (toX(qx) + toX(nearest.x)) / 2;
  const my = (toY(qy) + toY(nearest.y)) / 2;
  svg.appendChild(svgEl("rect", {
    x: mx - 20, y: my - 9, width: 40, height: 18, rx: 4
  }, { fill: "var(--sol-base02)", opacity: 0.9 }));
  
  const distTxt = svgEl("text", {
    x: mx, y: my + 1, dy: ".35em",
    "text-anchor": "middle",
    "font-size": "9px",
    "font-weight": "700"
  }, {
    fill: "var(--sol-red)",
    "font-family": "var(--font-code, monospace)"
  });
  distTxt.textContent = `d=${minD.toFixed(2)}`;
  svg.appendChild(distTxt);

  // Input vector (blue circle with label)
  svg.appendChild(svgEl("circle", {
    cx: toX(qx), cy: toY(qy), r: 12,
    stroke: "var(--sol-base3)", "stroke-width": 2
  }, {
    fill: "var(--sol-blue)",
    filter: "drop-shadow(0 0 6px var(--sol-blue))"
  }));
  
  svg.appendChild(svgEl("rect", {
    x: toX(qx) - 52, y: toY(qy) - 28, width: 104, height: 18, rx: 4
  }, { fill: "var(--sol-blue)" }));
  
  const inTxt = svgEl("text", {
    x: toX(qx), y: toY(qy) - 19, dy: ".35em",
    "text-anchor": "middle",
    "font-size": "9px",
    "font-weight": "700"
  }, {
    fill: "var(--sol-base3)",
    "font-family": "var(--font-code, monospace)"
  });
  inTxt.textContent = `IN [${qx.toFixed(1)}, ${qy.toFixed(1)}]`;
  svg.appendChild(inTxt);

  // Quantized label below nearest point
  svg.appendChild(svgEl("rect", {
    x: toX(nearest.x) - 52, y: toY(nearest.y) + 14, width: 104, height: 18, rx: 4
  }, { fill: "var(--sol-green)" }));
  
  const vqTxt = svgEl("text", {
    x: toX(nearest.x), y: toY(nearest.y) + 23, dy: ".35em",
    "text-anchor": "middle",
    "font-size": "9px",
    "font-weight": "700"
  }, {
    fill: "var(--sol-base3)",
    "font-family": "var(--font-code, monospace)"
  });
  vqTxt.textContent = `VQ [${nearest.x.toFixed(1)}, ${nearest.y.toFixed(1)}]`;
  svg.appendChild(vqTxt);

  containerEl.appendChild(svg);
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
