// ==========================================
// ram-storage-graph.js - Visualisation RAM ligne/colonne
// ==========================================
import ForceGraph from "https://esm.sh/force-graph";
import { getThemeColor, resolveCssValue, utils, StateMachine } from "../core.js";
import { SOL_FALLBACKS, drawRoundedRect } from "../networks.js";

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

