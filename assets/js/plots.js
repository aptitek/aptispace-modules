// ==========================================
// plots.js - Composants Graphiques Plotly Standardisés
// ==========================================
import { getPlotlyTheme } from "./core.js";

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

  Plotly.newPlot(divId, [trace], layout, config);
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