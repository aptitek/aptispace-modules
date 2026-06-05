import { getPlotlyTheme, getThemeColor, utils } from "../core.js";

const SAMPLE_VALUES = [4, 6, 7, 9, 14, 15, 17];

const sum = (values) => values.reduce((total, value) => total + value, 0);

const mean = (values) => sum(values) / values.length;

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const quartiles = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    q1: median(sorted.slice(0, middle)),
    q2: median(sorted),
    q3: median(sorted.slice(middle + 1))
  };
};

const variance = (values) => {
  const avg = mean(values);
  return mean(values.map((value) => (value - avg) ** 2));
};

const standardDeviation = (values) => Math.sqrt(variance(values));

const cleanupPlot = (divId, invalidation) => {
  if (invalidation?.then && globalThis.Plotly) {
    invalidation.then(() => globalThis.Plotly.purge(divId));
  }
};

const palette = () => {
  const blue = getThemeColor("--sol-blue", "var(--sol-blue)");
  const green = getThemeColor("--sol-green", "var(--sol-green)");
  const yellow = getThemeColor("--sol-yellow", "var(--sol-yellow)");
  const orange = getThemeColor("--sol-orange", "var(--sol-orange)");
  const red = getThemeColor("--sol-red", "var(--sol-red)");
  const violet = getThemeColor("--sol-violet", "var(--sol-violet)");
  const base00 = getThemeColor("--sol-base00", "var(--sol-base00)");
  const base01 = getThemeColor("--sol-base01", "var(--sol-base01)");
  const base1 = getThemeColor("--sol-base1", "var(--sol-base1)");
  return { blue, green, yellow, orange, red, violet, base00, base01, base1 };
};

const axisTheme = (colors) => ({
  gridcolor: utils.rgba(colors.base01, 0.18),
  linecolor: utils.rgba(colors.base01, 0.45),
  tickfont: { color: colors.base00 },
  titlefont: { color: colors.base00 },
  zerolinecolor: utils.rgba(colors.base01, 0.28)
});

const baseLayout = (title, colors = palette()) => ({
  title: { text: title, font: { color: colors.base00, size: 15 } },
  template: getPlotlyTheme(),
  margin: { t: 42, b: 38, l: 42, r: 16 },
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  showlegend: false
});

const config = {
  responsive: true,
  displayModeBar: false
};

export function renderMeanGraph(divId, invalidation) {
  if (!globalThis.Plotly) return null;

  const colors = palette();
  const axis = axisTheme(colors);
  const avg = mean(SAMPLE_VALUES);
  const labels = SAMPLE_VALUES.map((value, index) => `v${index + 1}`);

  const traces = [
    {
      x: labels,
      y: SAMPLE_VALUES,
      type: "bar",
      marker: { color: colors.blue, opacity: 0.75 },
      hovertemplate: "Valeur %{y}<extra></extra>"
    },
    {
      x: labels,
      y: SAMPLE_VALUES.map(() => avg),
      type: "scatter",
      mode: "lines",
      line: { color: colors.orange, width: 3, dash: "dash" },
      hovertemplate: `Moyenne ${utils.formatNumber(avg, 2)}<extra></extra>`
    }
  ];

  const layout = {
    ...baseLayout("La moyenne équilibre le groupe", colors),
    xaxis: { ...axis },
    yaxis: { ...axis, title: "Valeur", rangemode: "tozero" },
    annotations: [
      {
        x: labels.at(-1),
        y: avg,
        text: `moyenne = ${utils.formatNumber(avg, 2)}`,
        showarrow: true,
        ax: -45,
        ay: -25,
        font: { color: colors.orange }
      }
    ]
  };

  globalThis.Plotly.newPlot(divId, traces, layout, config);
  cleanupPlot(divId, invalidation);
  return null;
}

export function renderQuartileMedianGraph(divId, invalidation) {
  if (!globalThis.Plotly) return null;

  const colors = palette();
  const axis = axisTheme(colors);
  const sorted = [...SAMPLE_VALUES].sort((a, b) => a - b);
  const { q1, q2, q3 } = quartiles(sorted);

  const traces = [
    {
      x: sorted,
      y: sorted.map(() => 0),
      type: "scatter",
      mode: "lines+markers",
      line: { color: colors.base01, width: 2 },
      marker: { color: colors.blue, size: 12 },
      hovertemplate: "Valeur %{x}<extra></extra>"
    },
    {
      x: [q1, q2, q3],
      y: [0, 0, 0],
      type: "scatter",
      mode: "markers+text",
      marker: { color: [colors.green, colors.orange, colors.violet], size: 18 },
      text: ["Q1", "Médiane", "Q3"],
      textposition: "top center",
      hovertemplate: "%{text} = %{x}<extra></extra>"
    }
  ];

  const layout = {
    ...baseLayout("Les quartiles coupent la série rangée", colors),
    xaxis: { ...axis, title: "Valeurs triées", range: [Math.min(...sorted) - 1, Math.max(...sorted) + 1] },
    yaxis: { visible: false, range: [-0.45, 0.45] },
    shapes: [
      {
        type: "rect",
        x0: q1,
        x1: q3,
        y0: -0.12,
        y1: 0.12,
        fillcolor: utils.rgba(colors.green, 0.18),
        line: { color: colors.green, width: 1 }
      }
    ]
  };

  globalThis.Plotly.newPlot(divId, traces, layout, config);
  cleanupPlot(divId, invalidation);
  return null;
}

export function renderVarianceGraph(divId, invalidation) {
  if (!globalThis.Plotly) return null;

  const colors = palette();
  const axis = axisTheme(colors);
  const avg = mean(SAMPLE_VALUES);
  const deviations = SAMPLE_VALUES.map((value) => (value - avg) ** 2);
  const valueVariance = mean(deviations);

  const trace = {
    x: SAMPLE_VALUES.map(String),
    y: deviations,
    type: "bar",
    marker: { color: deviations.map((value) => value > valueVariance ? colors.red : colors.yellow), opacity: 0.8 },
    hovertemplate: "Écart au carré : %{y:.2f}<extra></extra>"
  };

  const layout = {
    ...baseLayout("La variance mesure les écarts au carré", colors),
    xaxis: { ...axis, title: "Valeur observée" },
    yaxis: { ...axis, title: "Écart au carré" },
    annotations: [
      {
        x: "17",
        y: Math.max(...deviations),
        text: `variance = ${utils.formatNumber(valueVariance, 2)}`,
        showarrow: true,
        ax: -55,
        ay: -20,
        font: { color: colors.red }
      }
    ]
  };

  globalThis.Plotly.newPlot(divId, [trace], layout, config);
  cleanupPlot(divId, invalidation);
  return null;
}

export function renderStandardDeviationGraph(divId, invalidation) {
  if (!globalThis.Plotly) return null;

  const colors = palette();
  const axis = axisTheme(colors);
  const avg = mean(SAMPLE_VALUES);
  const std = standardDeviation(SAMPLE_VALUES);
  const lower = avg - std;
  const upper = avg + std;

  const traces = [
    {
      x: SAMPLE_VALUES,
      y: SAMPLE_VALUES.map(() => 0),
      type: "scatter",
      mode: "markers",
      marker: { color: colors.blue, size: 12 },
      hovertemplate: "Valeur %{x}<extra></extra>"
    },
    {
      x: [avg],
      y: [0],
      type: "scatter",
      mode: "markers+text",
      marker: { color: colors.orange, size: 18 },
      text: ["moyenne"],
      textposition: "top center",
      hovertemplate: `Moyenne ${utils.formatNumber(avg, 2)}<extra></extra>`
    }
  ];

  const layout = {
    ...baseLayout("L'écart type revient à l'unité de départ", colors),
    xaxis: { ...axis, title: "Valeurs", range: [Math.min(...SAMPLE_VALUES) - 1, Math.max(...SAMPLE_VALUES) + 1] },
    yaxis: { visible: false, range: [-0.45, 0.45] },
    shapes: [
      {
        type: "rect",
        x0: lower,
        x1: upper,
        y0: -0.14,
        y1: 0.14,
        fillcolor: utils.rgba(colors.violet, 0.18),
        line: { color: colors.violet, width: 1 }
      },
      {
        type: "line",
        x0: avg,
        x1: avg,
        y0: -0.25,
        y1: 0.25,
        line: { color: colors.orange, width: 3 }
      }
    ],
    annotations: [
      {
        x: lower,
        y: -0.22,
        text: `-1 σ`,
        showarrow: false,
        font: { color: colors.violet }
      },
      {
        x: upper,
        y: -0.22,
        text: `+1 σ`,
        showarrow: false,
        font: { color: colors.violet }
      },
      {
        x: avg,
        y: 0.28,
        text: `σ = ${utils.formatNumber(std, 2)}`,
        showarrow: false,
        font: { color: colors.violet }
      }
    ]
  };

  globalThis.Plotly.newPlot(divId, traces, layout, config);
  cleanupPlot(divId, invalidation);
  return null;
}
