// =====================================================================
// gradient-surface.js — 3D loss landscape with animated optimizer trajectory
// =====================================================================
import { getPlotlyTheme, getThemeColor } from "../core.js";

function computeTrajectory(gradF, startPos, optType, param, maxSteps, lr) {
  let [t1, t2] = [...startPos];
  let m1 = 0, m2 = 0, v1 = 1e-8, v2 = 1e-8;
  const path = [[t1, t2]];

  for (let i = 0; i < maxSteps; i++) {
    const [g1, g2] = gradF(t1, t2);
    let u1, u2;

    switch (optType) {
      case 'momentum': {
        m1 = param * m1 + (1 - param) * g1;
        m2 = param * m2 + (1 - param) * g2;
        u1 = lr * m1; u2 = lr * m2;
        break;
      }
      case 'rmsprop': {
        v1 = param * v1 + (1 - param) * g1 * g1;
        v2 = param * v2 + (1 - param) * g2 * g2;
        u1 = lr * g1 / (Math.sqrt(v1) + 1e-8);
        u2 = lr * g2 / (Math.sqrt(v2) + 1e-8);
        break;
      }
      case 'adagrad': {
        v1 += g1 * g1; v2 += g2 * g2;
        u1 = param * g1 / (Math.sqrt(v1) + 1e-8);
        u2 = param * g2 / (Math.sqrt(v2) + 1e-8);
        break;
      }
      default: { // adam
        const β2 = 0.999, step = i + 1;
        m1 = param * m1 + (1 - param) * g1;
        m2 = param * m2 + (1 - param) * g2;
        v1 = β2 * v1 + (1 - β2) * g1 * g1;
        v2 = β2 * v2 + (1 - β2) * g2 * g2;
        const m1h = m1 / (1 - param ** step), m2h = m2 / (1 - param ** step);
        const v1h = v1 / (1 - β2 ** step), v2h = v2 / (1 - β2 ** step);
        u1 = lr * m1h / (Math.sqrt(v1h) + 1e-8);
        u2 = lr * m2h / (Math.sqrt(v2h) + 1e-8);
      }
    }

    t1 -= u1; t2 -= u2;
    path.push([t1, t2]);
    if (Math.abs(u1) < 1e-7 && Math.abs(u2) < 1e-7) break;
  }

  return path;
}

// criticalPoints: { pos: [t1, t2], type: 'global'|'local'|'saddle', size?, color?, symbol? }[]
export function createGradientSurface(containerId, {
  lossF    = (t1, t2) => t1 ** 4 / 4 - t1 ** 2 / 2 + t2 ** 2 / 2 + 0.1 * t1,
  gradF    = (t1, t2) => [t1 ** 3 - t1 + 0.1, t2],
  startPos = [1.8, 1.5],
  domain   = { t1: [-2.2, 2.2], t2: [-2, 2] },
  gridSize = 40,
  lr       = 0.1,
  maxSteps = 100,
  criticalPoints = []
} = {}) {
  const el = document.getElementById(containerId);
  if (!el) return null;

  // ── Surface grid ──────────────────────────────────────────────────
  const N = gridSize;
  const t1Arr = Array.from({ length: N }, (_, i) =>
    domain.t1[0] + i * (domain.t1[1] - domain.t1[0]) / (N - 1));
  const t2Arr = Array.from({ length: N }, (_, j) =>
    domain.t2[0] + j * (domain.t2[1] - domain.t2[0]) / (N - 1));
  const zSurface = t2Arr.map(t2v => t1Arr.map(t1v => lossF(t1v, t2v)));

  // ── Theme colours ─────────────────────────────────────────────────
  const yellow = getThemeColor('--sol-yellow', '#b58900');
  const green  = getThemeColor('--sol-green',  '#859900');
  const orange = getThemeColor('--sol-orange', '#cb4b16');
  const gridC  = getThemeColor('--sol-base01', '#586e75');

  const typeColors  = { global: green,  local: yellow, saddle: getThemeColor('--sol-violet', '#6c71c4') };
  const typeSymbols = { global: 'circle', local: 'circle', saddle: 'diamond' };
  const typeSizes   = { global: 12, local: 10, saddle: 10 };

  // ── Static traces (computed once) ─────────────────────────────────
  const surface = {
    type: 'surface', x: t1Arr, y: t2Arr, z: zSurface,
    colorscale: [
      [0,    getThemeColor('--sol-base3',  '#fdf6e3')],
      [0.25, getThemeColor('--sol-cyan',   '#2aa198')],
      [0.6,  getThemeColor('--sol-blue',   '#268bd2')],
      [1,    getThemeColor('--sol-violet', '#6c71c4')]
    ],
    showscale: false, opacity: 0.88,
    lighting: { ambient: 0.7, diffuse: 0.5, roughness: 0.4, specular: 0.1 },
    lightposition: { x: 0, y: -150, z: 300 },
    hoverinfo: 'skip', showlegend: false
  };

  const cpTrace = criticalPoints.length > 0 ? {
    type: 'scatter3d', mode: 'markers',
    x: criticalPoints.map(p => p.pos[0]),
    y: criticalPoints.map(p => p.pos[1]),
    z: criticalPoints.map(p => lossF(p.pos[0], p.pos[1])),
    marker: {
      size:   criticalPoints.map(p => p.size   ?? typeSizes[p.type]   ?? 10),
      color:  criticalPoints.map(p => p.color  ?? typeColors[p.type]  ?? green),
      symbol: criticalPoints.map(p => p.symbol ?? typeSymbols[p.type] ?? 'circle'),
      line:   { color: 'white', width: 2 }
    },
    hoverinfo: 'skip', showlegend: false
  } : null;

  // Always-visible starting position marker
  const startMark = {
    type: 'scatter3d', mode: 'markers',
    x: [startPos[0]], y: [startPos[1]], z: [lossF(startPos[0], startPos[1])],
    marker: { size: 8, color: orange, opacity: 0.65, line: { color: 'white', width: 1.5 } },
    hoverinfo: 'skip', showlegend: false
  };

  const baseData = [surface, ...(cpTrace ? [cpTrace] : []), startMark];
  const nBase = baseData.length; // trajectory traces start at this index

  // ── Plotly layout / config ────────────────────────────────────────
  const layout = {
    ...getPlotlyTheme().layout,
    paper_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 0, r: 0, b: 0, t: 0 },
    showlegend: false,
    scene: {
      xaxis: { title: 'θ₁', gridcolor: gridC, showbackground: false, tickfont: { size: 10 } },
      yaxis: { title: 'θ₂', gridcolor: gridC, showbackground: false, tickfont: { size: 10 } },
      zaxis: { title: 'L(θ)', gridcolor: gridC, showbackground: false, tickfont: { size: 10 } },
      bgcolor: 'rgba(0,0,0,0)',
      camera: { eye: { x: 1.6, y: -1.6, z: 1.2 } },
      aspectmode: 'manual',
      aspectratio: { x: 1.5, y: 1, z: 0.8 }
    }
  };

  const config = { responsive: true, displayModeBar: false };

  // ── Animation state ───────────────────────────────────────────────
  let ready      = false;
  let _animPath  = null;
  let _step      = 0;
  let _timer     = null;
  let _isRunning = false;
  let _onDone    = null;

  // ── Internal helpers ──────────────────────────────────────────────
  function _restyleFrame() {
    const n   = Math.min(_step + 1, _animPath.length);
    const seg = _animPath.slice(0, n);
    const xs  = seg.map(p => p[0]);
    const ys  = seg.map(p => p[1]);
    const zs  = seg.map(p => lossF(p[0], p[1]));

    const sampIdx = xs.map((_, i) => i).filter(i => i % 5 === 0);

    // nBase=trail, nBase+1=dots, nBase+2=ball
    Plotly.restyle(el, {
      x: [xs, sampIdx.map(i => xs[i]), [xs[xs.length - 1]]],
      y: [ys, sampIdx.map(i => ys[i]), [ys[ys.length - 1]]],
      z: [zs, sampIdx.map(i => zs[i]), [zs[zs.length - 1]]]
    }, [nBase, nBase + 1, nBase + 2]);
  }

  function _clearFrames() {
    if (ready) {
      Plotly.restyle(el, { x: [[], [], []], y: [[], [], []], z: [[], [], []] },
        [nBase, nBase + 1, nBase + 2]);
    }
  }

  function _tick() {
    if (!_animPath || _step >= _animPath.length) {
      _isRunning = false;
      clearInterval(_timer); _timer = null;
      _animPath = null; _step = 0; // reset so isPaused → false
      if (_onDone) _onDone();
      return;
    }
    _restyleFrame();
    _step++;
  }

  // ── Public API ────────────────────────────────────────────────────
  async function init() {
    const emptyLine = {
      type: 'scatter3d', mode: 'lines',
      x: [], y: [], z: [], line: { color: yellow, width: 5 },
      hoverinfo: 'skip', showlegend: false
    };
    const emptyDots = {
      type: 'scatter3d', mode: 'markers',
      x: [], y: [], z: [], marker: { size: 4, color: yellow, opacity: 0.7 },
      hoverinfo: 'skip', showlegend: false
    };
    const emptyBall = {
      type: 'scatter3d', mode: 'markers',
      x: [], y: [], z: [], marker: { size: 14, color: yellow, symbol: 'circle', line: { color: 'white', width: 2 } },
      hoverinfo: 'skip', showlegend: false
    };
    await Plotly.newPlot(el, [...baseData, emptyLine, emptyDots, emptyBall], layout, config);
    ready = true;
  }

  // Start fresh animation from step 0
  function play(optType, param, steps = maxSteps, speedMs = 200, onDone = null) {
    if (_timer) { clearInterval(_timer); _timer = null; }
    _animPath  = computeTrajectory(gradF, startPos, optType, param, steps, lr);
    _step      = 0;
    _isRunning = true;
    _onDone    = onDone;
    _clearFrames();
    _timer = setInterval(_tick, speedMs);
  }

  function pause() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    _isRunning = false;
  }

  // Resume from where we paused
  function resume(speedMs = 200, onDone = null) {
    if (!_animPath || _step >= _animPath.length) return;
    if (onDone) _onDone = onDone;
    _isRunning = true;
    _timer = setInterval(_tick, speedMs);
  }

  // Stop and reset visual to empty trajectory
  function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    _isRunning = false;
    _animPath  = null;
    _step      = 0;
    _clearFrames();
  }

  function destroy() {
    stop();
    if (ready) Plotly.purge(el);
    ready = false;
  }

  return {
    init, play, pause, resume, stop, destroy,
    get isRunning() { return _isRunning; },
    // true only between play() and stop()/completion, i.e. can resume
    get isPaused()  { return !_isRunning && _step > 0 && _animPath !== null; }
  };
}
