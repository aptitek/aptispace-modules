// =====================================================================
// kl-divergence.js — KL divergence between two Gaussians
// =====================================================================
import { resolveCssValue } from "../core.js";
import { createMultiLine } from "../plots.js";

function gaussianPDF(x, mu, sigma) {
  const s2 = sigma * sigma;
  return (1 / Math.sqrt(2 * Math.PI * s2)) * Math.exp(-((x - mu) ** 2) / (2 * s2));
}

// KL(N(mu,sigma²) || N(0,1)) — closed-form for diagonal Gaussians
function klDivergence(mu, sigma) {
  return 0.5 * (sigma * sigma + mu * mu - 1 - 2 * Math.log(sigma));
}

/**
 * Update the KL divergence interactive chart.
 * @param {HTMLElement} chartEl   Plotly container
 * @param {HTMLElement} klValEl   Element that displays the KL value
 * @param {{ mu, sigma }} params
 */
export function updateKLViz(chartEl, klValEl, { mu = 0, sigma = 1 } = {}) {
  if (!chartEl) return;

  const muN  = +mu;
  const sigN = Math.max(0.1, +sigma);

  const xs = [];
  for (let x = -5; x <= 5; x += 0.05) xs.push(+x.toFixed(2));

  const qY = xs.map(x => gaussianPDF(x, muN, sigN));     // q(z|x)
  const pY = xs.map(x => gaussianPDF(x, 0, 1));          // p(z) = N(0,1)

  const kl = klDivergence(muN, sigN);

  // Shaded area between curves (approximation of KL region)
  const fillY = xs.map((x, i) => Math.max(0, qY[i] - pY[i]));

  const cBlue    = resolveCssValue("var(--sol-blue)");
  const cRed     = resolveCssValue("var(--sol-red)");
  const cOrange  = resolveCssValue("var(--sol-orange)");

  const traces = [
    // Fill area where q > p
    {
      x: [...xs, ...xs.slice().reverse()],
      y: [...qY.map((q, i) => Math.max(q, pY[i])), ...pY.slice().reverse()],
      type: "scatter",
      fill: "toself",
      fillcolor: `${cOrange}22`,
      line: { width: 0 },
      hoverinfo: "skip",
      showlegend: false,
    },
    // p(z) = N(0,1) — prior (fixed)
    {
      x: xs,
      y: pY,
      type: "scatter",
      mode: "lines",
      name: "p(z) = N(0, 1)  — a priori",
      line: { color: cBlue, width: 2.5, dash: "dash" },
    },
    // q(z|x) — posterior
    {
      x: xs,
      y: qY,
      type: "scatter",
      mode: "lines",
      name: `q(z|x) = N(${muN.toFixed(2)}, ${sigN.toFixed(2)}²)`,
      line: { color: cRed, width: 2.5 },
    },
  ];

  createMultiLine(chartEl, traces, {
    showlegend: true,
    xaxis: { range: [-5, 5], title: { text: "z" } },
    yaxis: { range: [0, 0.85], title: { text: "densité" } },
    layout: {
      legend: { x: 0.01, y: 0.99, xanchor: "left", yanchor: "top", bgcolor: "transparent", font: { size: 11 } },
      height: 260,
    },
  });

  if (klValEl) {
    klValEl.textContent = kl.toFixed(4);
    const isSmall = kl < 0.1;
    klValEl.setAttribute("data-state", isSmall ? "success" : kl < 1 ? "warning" : "danger");
  }
}
