// ==========================================
// plots.js - Composants Graphiques Plotly Standardisés
// ==========================================
import { getPlotlyTheme, getThemeColor } from "./core.js";

/**
 * 📈 Scatter Plot (Nuage de points)
 */
export function createScatter(divId, data, title = "Graphique", options = {}) {
  const trace = {
    x: data.x,
    y: data.y,
    mode: options.mode || 'markers',
    type: 'scatter',
    marker: {
      size: options.markerSize || 8,
      opacity: options.opacity || 0.8,
      ...options.marker
    },
    ...options.trace
  };

  const layout = {
    title: {
      text: title,
      font: { size: 16 }
    },
    template: getPlotlyTheme(),
    margin: { t: 50, b: 50, l: 50, r: 50 },
    ...options.layout
  };

  const config = {
    responsive: true,
    displayModeBar: false,
    ...options.config
  };

  Plotly.newPlot(divId, [trace], layout, config);
}

/**
 * 📉 Line Chart (Courbe)
 */
export function createLine(divId, data, title = "Graphique", options = {}) {
  const trace = {
    x: data.x,
    y: data.y,
    mode: options.mode || 'lines+markers',
    type: 'scatter',
    line: {
      shape: options.shape || 'spline',
      width: options.lineWidth || 3,
      ...options.line
    },
    marker: {
      size: options.markerSize !== undefined ? options.markerSize : 6,
      color: options.markerColor || (options.line ? options.line.color : undefined),
      ...options.marker
    },
    ...options.trace
  };

  const layout = {
    title: {
      text: title,
      font: { size: 16 }
    },
    template: getPlotlyTheme(),
    margin: { t: 50, b: 50, l: 50, r: 50 },
    ...options.layout
  };

  const config = {
    responsive: true,
    displayModeBar: false,
    ...options.config
  };

  Plotly.react(divId, [trace], layout, config);
}

/**
 * 📊 Bar Chart (Diagramme en bâtons)
 */
export function createBar(divId, data, title = "Graphique", options = {}) {
  const trace = {
    x: data.x,
    y: data.y,
    type: 'bar',
    marker: {
      opacity: options.opacity || 0.85,
      ...options.marker
    },
    ...options.trace
  };

  const layout = {
    title: {
      text: title,
      font: { size: 16 }
    },
    template: getPlotlyTheme(),
    margin: { t: 50, b: 50, l: 50, r: 50 },
    ...options.layout
  };

  const config = {
    responsive: true,
    displayModeBar: false,
    ...options.config
  };

  Plotly.newPlot(divId, [trace], layout, config);
}

/**
 * 📊 Stacked Bar Chart (Histogramme empilé)
 */
export function createStackedBar(divId, datasets, title = "", options = {}) {
  const traces = datasets.map(ds => ({
    x: ds.x,
    y: ds.y,
    name: ds.label,
    type: 'bar',
    marker: {
      color: ds.color,
      opacity: options.opacity || 0.85
    },
    ...ds.traceOptions
  }));

  const layout = {
    title: {
      text: title,
      font: { size: 14 }
    },
    barmode: 'stack',
    template: getPlotlyTheme(),
    margin: { t: 30, b: 30, l: 45, r: 15 },
    showlegend: true,
    legend: {
      orientation: "h",
      yanchor: "bottom",
      y: 1.02,
      xanchor: "right",
      x: 1
    },
    ...options.layout
  };

  const config = {
    responsive: true,
    displayModeBar: false,
    ...options.config
  };

  Plotly.newPlot(divId, traces, layout, config);
}


/**
 * 🌪️ Funnel Area (Pyramide/Entonnoir)
 */
export function createFunnel(divId, data, options = {}) {
  const trace = {
    type: 'funnelarea',
    text: data.text,
    values: data.values,
    marker: { colors: options.colors },
    textinfo: "text",
    hoverinfo: "text",
    ...options.trace
  };

  const layout = {
    margin: { t: 10, b: 10, l: 10, r: 10 },
    paper_bgcolor: 'transparent',
    showlegend: false,
    ...options.layout
  };

  Plotly.newPlot(divId, [trace], layout, { displayModeBar: false, responsive: true, ...options.config });
}

/**
 * 🔺 Pyramid Chart (Pyramide symétrique inversée)
 */
export function createPyramid(divId, data, options = {}) {
  const trace = {
    type: 'funnel',
    y: data.text,
    x: data.values,
    text: data.text,
    textposition: options.textposition || 'inside',
    textinfo: options.textinfo || 'text',
    hoverinfo: options.hoverinfo || 'text',
    textfont: {
      color: "white",
      family: "Recursive, sans-serif",
      ...options.textfont
    },
    marker: {
      color: options.colors,
      ...options.marker
    },
    ...options.trace
  };

  const layout = {
    margin: { t: 5, b: 5, l: 5, r: 5 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    yaxis: { visible: false },
    xaxis: { visible: false },
    ...options.layout
  };

  const config = {
    displayModeBar: false,
    responsive: true,
    ...options.config
  };

  Plotly.newPlot(divId, [trace], layout, config);
}

// Alias for spelling compatibility
export const createPiramid = createPyramid;

/**
 * 🌈 Gradient Line Chart — segments colorés individuellement
 * options.gradientColors : tableau de couleurs (une par point)
 */
export function createGradientLine(divId, data, title = "Graphique", options = {}) {
  const { x, y } = data;
  const colors = options.gradientColors || [];
  const lineWidth = options.lineWidth ?? 3;
  const lineShape = options.line?.shape ?? "spline";

  const traces = x.slice(0, -1).map((_, i) => ({
    x: [x[i], x[i + 1]],
    y: [y[i], y[i + 1]],
    type: "scatter",
    mode: "lines",
    line: { color: colors[i] ?? colors.at(-1), width: lineWidth, shape: lineShape },
    showlegend: false,
    hoverinfo: "skip"
  }));

  traces.push({
    x, y,
    type: "scatter",
    mode: "markers",
    marker: { color: colors, size: options.markerSize ?? 8, ...options.marker },
    showlegend: false,
    hovertemplate: options.hovertemplate ?? "%{x} — %{y}<extra></extra>"
  });

  const layout = {
    title: { text: title, font: { size: 16 } },
    template: getPlotlyTheme(),
    margin: { t: 50, b: 50, l: 50, r: 50 },
    ...options.layout
  };

  Plotly.newPlot(divId, traces, layout, {
    responsive: true,
    displayModeBar: false,
    ...options.config
  });
}

/**
 * 📊 VU-Meter / Jauge animée
 * Utilise Plotly.react pour des mises à jour efficaces en animation.
 * Colorie automatiquement selon le niveau : vert → jaune → orange → rouge.
 *
 * @param {string} divId   - ID du conteneur (sans #)
 * @param {number} value   - Valeur courante
 * @param {number} max     - Plafond (défaut : 4096 MB)
 * @param {Object} options - levels, threshold, margin, layout, config
 */
export function createVuMeter(divId, value, max = 4096, options = {}) {
  const pct = Math.min(100, (value / max) * 100);
  const barColor =
    pct < 40 ? getThemeColor("--sol-green",  "#859900")
  : pct < 70 ? getThemeColor("--sol-yellow", "#b58900")
  : pct < 90 ? getThemeColor("--sol-orange", "#cb4b16")
  :             getThemeColor("--sol-red",    "#dc322f");

  const lvl = options.levels ?? [0.4, 0.7, 0.9];

  const trace = [{
    type: "indicator",
    mode: "gauge+number",
    value,
    gauge: {
      axis: {
        range: [0, max],
        ticksuffix: " MB",
        nticks: 5,
        tickcolor: getThemeColor("--sol-base1", "#93a1a1"),
        tickfont: { size: 9 }
      },
      bar: { color: barColor, thickness: 0.55 },
      bgcolor: "transparent",
      borderwidth: 0,
      steps: [
        { range: [0,           lvl[0] * max], color: "rgba(133,153,0,0.12)"  },
        { range: [lvl[0] * max, lvl[1] * max], color: "rgba(181,137,0,0.12)"  },
        { range: [lvl[1] * max, lvl[2] * max], color: "rgba(203,75,22,0.12)"  },
        { range: [lvl[2] * max, max],           color: "rgba(220,50,47,0.18)"  }
      ],
      threshold: {
        line: { color: getThemeColor("--sol-red", "#dc322f"), width: 3 },
        thickness: 0.75,
        value: options.threshold ?? lvl[1] * max
      }
    },
    number: {
      suffix: " MB",
      valueformat: ".0f",
      font: { size: 20, color: barColor }
    },
    domain: { x: [0, 1], y: [0, 1] }
  }];

  const layout = {
    paper_bgcolor: "transparent",
    font: { family: "Recursive, sans-serif", color: getThemeColor("--sol-base01", "#586e75") },
    margin: options.margin ?? { t: 25, b: 5, l: 20, r: 20 },
    ...options.layout
  };

  Plotly.react(divId, trace, layout, {
    responsive: true,
    displayModeBar: false,
    ...options.config
  });
}