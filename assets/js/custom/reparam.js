// =====================================================================
// reparam.js — Reparameterization trick: SVG flow diagram
// =====================================================================

/**
 * Render two-column SVG comparing standard sampling vs reparameterization.
 * @param {HTMLElement} containerEl
 */
export function createReparamViz(containerEl) {
  if (!containerEl) return;

  containerEl.innerHTML = "";

  const W = 600, H = 280;

  const cBlue   = "var(--sol-blue)";
  const cRed    = "var(--sol-red)";
  const cGreen  = "var(--sol-green)";
  const cOrange = "var(--sol-orange)";
  const cBase01 = "var(--sol-base01)";
  const cBase1  = "var(--sol-base1)";
  const cBg     = "var(--body-bg)";
  const cText   = "var(--body-color)";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.setProperty("width", "100%");
  svg.style.setProperty("height", "auto");
  svg.style.setProperty("overflow", "visible");
  containerEl.appendChild(svg);

  function el(tag, attrs = {}, styles = {}) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    for (const [k, v] of Object.entries(styles)) e.style.setProperty(k, v);
    return e;
  }

  function text(content, x, y, opts = {}) {
    const t = el("text", {
      x, y,
      "text-anchor": opts.anchor || "middle",
      "font-size": opts.size || "12",
      "font-family": "inherit",
      "font-weight": opts.bold ? "bold" : "normal",
    }, { fill: opts.color || cText });
    t.textContent = content;
    svg.appendChild(t);
  }

  function node(cx, cy, r, borderColor, label, sublabel, labelColor) {
    svg.appendChild(el("circle", { cx, cy, r }, { fill: cBg, stroke: borderColor, "stroke-width": "2.5" }));
    if (label) text(label, cx, cy + 4, { size: "13", bold: true, color: labelColor || borderColor });
    if (sublabel) text(sublabel, cx, cy + r + 14, { size: "11", color: cBase1 });
  }

  function arrow(x1, y1, x2, y2, color, dashed = false, blocked = false) {
    const dash = dashed ? "5,3" : undefined;
    svg.appendChild(el("line", {
      x1, y1, x2, y2,
      "stroke-width": "2",
      "stroke-dasharray": dash,
      "marker-end": "url(#arrowhead)",
    }, { stroke: color }));
    if (blocked) {
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      // Red circle with X
      svg.appendChild(el("circle", { cx: mx, cy: my, r: 8 }, { fill: "rgba(220,50,47,0.13)", stroke: cRed, "stroke-width": "1.5" }));
      const cross1 = el("line", { x1: mx - 4, y1: my - 4, x2: mx + 4, y2: my + 4, "stroke-width": "2" }, { stroke: cRed });
      const cross2 = el("line", { x1: mx + 4, y1: my - 4, x2: mx - 4, y2: my + 4, "stroke-width": "2" }, { stroke: cRed });
      svg.appendChild(cross1);
      svg.appendChild(cross2);
    }
  }

  // ── Arrow marker ────────────────────────────────────────────────────
  const defs = el("defs");
  const marker = el("marker", { id: "arrowhead", markerWidth: "8", markerHeight: "6", refX: "6", refY: "3", orient: "auto" });
  const polygon = el("polygon", { points: "0 0, 8 3, 0 6" }, { fill: cBase01 });
  marker.appendChild(polygon);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // ─────────────────────────────────────────────────────────────────────
  // LEFT PANEL: Standard sampling (gradient blocked)
  // ─────────────────────────────────────────────────────────────────────
  const lCX = 145;

  // Column header
  text("❌  Échantillonnage standard", lCX, 24, { size: "13", bold: true, color: cRed });
  text("(gradient bloqué)", lCX, 40, { size: "11", color: cBase1 });

  // Encoder output: mu, sigma
  node(lCX, 90, 20, cBlue, "μ, σ", "encodeur", cBlue);

  // Stochastic node
  node(lCX, 170, 20, cOrange, "~", "z ~ N(μ, σ²)", cOrange);

  // Arrow encoder → stochastic (with block)
  arrow(lCX, 112, lCX, 148, cBase01, false, true);

  // Arrow stochastic → z output (blocked)
  arrow(lCX, 192, lCX, 240, cBase01);

  // z output
  text("z", lCX, 255, { size: "13", bold: true, color: cOrange });

  // Gradient back arrow (blocked)
  svg.appendChild(el("path", {
    d: `M ${lCX + 28} 250 C ${lCX + 55} 250 ${lCX + 55} 170 ${lCX + 28} 170`,
    fill: "none",
    "stroke-dasharray": "4,3",
    "stroke-width": "1.8",
    "marker-end": "url(#arrowhead)",
  }, { stroke: cRed }));
  const blockCircle = el("circle", { cx: lCX + 55, cy: 210, r: 9 }, { fill: "rgba(220,50,47,0.13)", stroke: cRed, "stroke-width": "1.5" });
  svg.appendChild(blockCircle);
  svg.appendChild(el("line", { x1: lCX + 50, y1: 205, x2: lCX + 60, y2: 215, "stroke-width": "2" }, { stroke: cRed }));
  svg.appendChild(el("line", { x1: lCX + 60, y1: 205, x2: lCX + 50, y2: 215, "stroke-width": "2" }, { stroke: cRed }));
  text("∂L/∂μ", lCX + 75, 213, { size: "10", color: cRed });
  text("bloqué", lCX + 75, 225, { size: "10", color: cRed });

  // ── Divider ────────────────────────────────────────────────────────
  svg.appendChild(el("line", { x1: W / 2, y1: 10, x2: W / 2, y2: H - 10 }, { stroke: cBase01, "stroke-width": "1", "stroke-dasharray": "4,4" }));

  // ─────────────────────────────────────────────────────────────────────
  // RIGHT PANEL: Reparameterization (gradient flows)
  // ─────────────────────────────────────────────────────────────────────
  const rCX = W - 145;

  // Column header
  text("✅  Astuce de reparamétrisation", rCX, 24, { size: "13", bold: true, color: cGreen });
  text("(gradient s'écoule)", rCX, 40, { size: "11", color: cBase1 });

  // Encoder output: mu, sigma
  node(rCX, 90, 20, cBlue, "μ, σ", "encodeur", cBlue);

  // External noise ε node (top right)
  node(rCX + 60, 155, 16, cOrange, "ε", "ε ~ N(0,1)", cOrange);

  // Deterministic transform node
  node(rCX, 170, 20, cGreen, "+", "z = μ + σ·ε", cGreen);

  // Arrows
  arrow(rCX, 112, rCX, 148, cBase01);
  // ε into transform
  svg.appendChild(el("line", { x1: rCX + 44, y1: 155, x2: rCX + 22, y2: 165, "stroke-width": "2" }, { stroke: cOrange }));

  arrow(rCX, 192, rCX, 240, cBase01);

  // z output
  text("z", rCX, 255, { size: "13", bold: true, color: cGreen });

  // Gradient back arrow (flowing)
  svg.appendChild(el("path", {
    d: `M ${rCX + 28} 250 C ${rCX + 55} 250 ${rCX + 55} 170 ${rCX + 28} 170`,
    fill: "none",
    "stroke-dasharray": "4,3",
    "stroke-width": "1.8",
    "marker-end": "url(#arrowhead)",
  }, { stroke: cGreen }));
  text("∂L/∂μ", rCX + 75, 213, { size: "10", color: cGreen });
  text("∂L/∂σ", rCX + 75, 225, { size: "10", color: cGreen });
  text("✓ coule", rCX + 75, 237, { size: "10", color: cGreen });

  // Equation at bottom
  text("z = μ + σ ⊙ ε,   ε ~ N(0, I)", W / 2, H - 8, { size: "12", color: cBase1 });
}
