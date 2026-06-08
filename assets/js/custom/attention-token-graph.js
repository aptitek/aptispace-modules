// ==========================================
// attention-token-graph.js - Carte d'attention en puzzle
// ==========================================
import ForceGraph from "https://esm.sh/force-graph";
import { resolveCssValue, utils } from "../core.js";
import { SOL_FALLBACKS, drawRoundedRect } from "../networks.js";
import { computeFaceNormal3D, extrudePolygon, generatePuzzleGrid, generatePuzzlePieceShape, normalizeAngle, shadeColor } from "../networks3d.js";

/**
 * Interactive token attention map. Click a token to show its strongest outgoing attention links.
 */
export function createAttentionTokenGraph(container, options = {}, invalidation = null) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) {
    console.warn("createAttentionTokenGraph: Target container not found.", container);
    return null;
  }
  targetEl.innerHTML = "";

  const tokens = options.tokens || ["Le", "chat", "mange", "car", "il", "a", "faim"];
  const matrix = options.matrix || [
    [0.35, 0.35, 0.10, 0.05, 0.05, 0.05, 0.05],
    [0.12, 0.40, 0.22, 0.05, 0.08, 0.05, 0.08],
    [0.05, 0.32, 0.18, 0.10, 0.12, 0.03, 0.20],
    [0.03, 0.08, 0.20, 0.18, 0.12, 0.07, 0.32],
    [0.04, 0.42, 0.12, 0.08, 0.22, 0.04, 0.08],
    [0.02, 0.18, 0.12, 0.08, 0.25, 0.25, 0.10],
    [0.02, 0.20, 0.22, 0.12, 0.18, 0.08, 0.18]
  ];
  const maxLinks = options.maxLinks ?? 3;
  const nodeSize = options.nodeSize ?? 58;
  const labelFontSize = options.labelFontSize ?? 18;
  const initialTargetRect = targetEl.getBoundingClientRect();
  const height = options.height ?? Math.max(initialTargetRect.height || 0, 440);
  const widthFallback = options.width ?? 720;
  const cameraDistance = options.cameraDistance ?? 210;
  const ambientLight = options.ambientLight ?? 0.42;
  const lightDirection = options.lightDirection || [-0.3, -0.4, 0.85];
  const colors = [
    "var(--sol-blue)",
    "var(--sol-cyan)",
    "var(--sol-green)",
    "var(--sol-yellow)",
    "var(--sol-orange)",
    "var(--sol-magenta)",
    "var(--sol-violet)"
  ];
  let activeIndex = Math.max(0, tokens.indexOf(options.activeToken || "mange"));
  let mode = options.mode || "assembled";
  let currentWidth = widthFallback;

  const lightLength = Math.sqrt(
    lightDirection[0] * lightDirection[0] +
    lightDirection[1] * lightDirection[1] +
    lightDirection[2] * lightDirection[2]
  ) || 1;
  const normLx = lightDirection[0] / lightLength;
  const normLy = lightDirection[1] / lightLength;
  const normLz = lightDirection[2] / lightLength;

  const controls = document.createElement("div");
  controls.className = "d-flex justify-content-end gap-2 mb-2";

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "btn btn-sm btn-outline-primary";
  controls.appendChild(toggleButton);

  const graphHost = document.createElement("div");
  graphHost.className = "w-100";
  graphHost.setAttribute("role", "img");
  graphHost.setAttribute("aria-label", "Carte d'attention interactive en pièces de puzzle");
  targetEl.style.setProperty("min-height", `${height}px`);
  graphHost.style.setProperty("height", `${height}px`);

  targetEl.appendChild(controls);
  targetEl.appendChild(graphHost);

  const grid = generatePuzzleGrid(1, tokens.length);
  const nodes = tokens.map((token, index) => ({
    id: token,
    label: token,
    index,
    color: colors[index % colors.length],
    edges: grid[index]?.edges || [0, 1, 0, -1],
    edgeProfiles: grid[index]?.edgeProfiles || [],
    size: nodeSize,
    status: index === activeIndex ? "current" : "default",
    rx: Math.random() * 2 * Math.PI,
    ry: Math.random() * 2 * Math.PI,
    rz: Math.random() * 2 * Math.PI,
    drx: (Math.random() * 0.018 + 0.006) * (Math.random() < 0.5 ? 1 : -1),
    dry: (Math.random() * 0.018 + 0.006) * (Math.random() < 0.5 ? 1 : -1),
    drz: (Math.random() * 0.012 + 0.003) * (Math.random() < 0.5 ? 1 : -1)
  }));
  nodes.forEach(node => {
    node.model3d = extrudePolygon(generatePuzzlePieceShape(node.size, node.edges, node.edgeProfiles), node.size * 0.32);
  });

  const linksForActive = () => matrix[activeIndex]
    .map((weight, index) => ({ weight, index }))
    .filter(({ index }) => index !== activeIndex)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxLinks)
    .map(({ weight, index }) => ({
      source: tokens[activeIndex],
      target: tokens[index],
      label: `${Math.round(weight * 100)}%`,
      weight,
      status: weight >= 0.25 ? "current" : "default"
    }))
    .concat([{
      source: tokens[activeIndex],
      target: tokens[activeIndex],
      label: `${Math.round(matrix[activeIndex][activeIndex] * 100)}%`,
      weight: matrix[activeIndex][activeIndex],
      status: "self",
      self: true
    }]);

  function attentionLinkColor(weight = 0) {
    const t = Math.max(0, Math.min(1, (weight - 0.05) / 0.4));
    const from = SOL_FALLBACKS.green.slice(1);
    const to = SOL_FALLBACKS.red.slice(1);
    const r = Math.round(parseInt(from.slice(0, 2), 16) + (parseInt(to.slice(0, 2), 16) - parseInt(from.slice(0, 2), 16)) * t);
    const g = Math.round(parseInt(from.slice(2, 4), 16) + (parseInt(to.slice(2, 4), 16) - parseInt(from.slice(2, 4), 16)) * t);
    const b = Math.round(parseInt(from.slice(4, 6), 16) + (parseInt(to.slice(4, 6), 16) - parseInt(from.slice(4, 6), 16)) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function attentionLinkWidth(weight = 0) {
    return 1.4 + Math.max(0, Math.min(1, weight / 0.42)) * 3.8;
  }

  function applyModePositions() {
    if (mode === "assembled") {
      nodes.forEach((node, index) => {
        node.fx = (index - (tokens.length - 1) / 2) * nodeSize;
        node.fy = 0;
        node.x = node.fx;
        node.y = node.fy;
        node.angle = 0;
      });
      return;
    }

    const radius = options.radius ?? Math.min(currentWidth, height) * 0.32;
    nodes.forEach((node, index) => {
      const angle = -Math.PI / 2 + (index / tokens.length) * Math.PI * 2;
      node.fx = Math.cos(angle) * radius;
      node.fy = Math.sin(angle) * radius;
      node.x = node.fx;
      node.y = node.fy;
      node.angle = angle + Math.PI / 2;
    });
  }

  function syncNodeStatus() {
    nodes.forEach((node, index) => {
      node.status = index === activeIndex ? "current" : "default";
    });
  }

  function updatePieceRotation(node) {
    if (mode === "assembled") {
      node.rx = normalizeAngle(node.rx) * 0.86;
      node.ry = normalizeAngle(node.ry) * 0.86;
      node.rz = normalizeAngle(node.rz) * 0.86;
      if (Math.abs(node.rx) < 0.001) node.rx = 0;
      if (Math.abs(node.ry) < 0.001) node.ry = 0;
      if (Math.abs(node.rz) < 0.001) node.rz = 0;
      return;
    }

    node.rx = (node.rx + node.drx) % (2 * Math.PI);
    node.ry = (node.ry + node.dry) % (2 * Math.PI);
    node.rz = (node.rz + node.drz) % (2 * Math.PI);
  }

  function drawPuzzlePiece(node, ctx, globalScale = 1) {
    const isActive = node.index === activeIndex;
    const size = node.size || nodeSize;
    const color = resolveCssValue(node.color) || SOL_FALLBACKS.blue;
    const border = resolveCssValue(isActive ? "var(--sol-blue)" : "var(--sol-base01)") || SOL_FALLBACKS.base01;
    const text = resolveCssValue(isActive ? "var(--sol-blue)" : "var(--sol-base03)") || SOL_FALLBACKS.base03;

    updatePieceRotation(node);

    ctx.save();
    if (mode === "circle") {
      ctx.rotate(node.angle || 0);
    }

    const cosX = Math.cos(node.rx), sinX = Math.sin(node.rx);
    const cosY = Math.cos(node.ry), sinY = Math.sin(node.ry);
    const cosZ = Math.cos(node.rz), sinZ = Math.sin(node.rz);

    const rotatedVertices = node.model3d.vertices.map(v => {
      const x1 = v[0];
      const y1 = v[1] * cosX - v[2] * sinX;
      const z1 = v[1] * sinX + v[2] * cosX;
      const x2 = x1 * cosY + z1 * sinY;
      const y2 = y1;
      const z2 = -x1 * sinY + z1 * cosY;
      const x3 = x2 * cosZ - y2 * sinZ;
      const y3 = x2 * sinZ + y2 * cosZ;
      return [x3, y3, z2];
    });

    const facesData = node.model3d.faces.map((faceIndices, faceIndex) => {
      const faceVertices = faceIndices.map(idx => rotatedVertices[idx]);
      const [normNx, normNy, normNz] = computeFaceNormal3D(faceVertices);
      const centerZ = faceVertices.reduce((sum, v) => sum + v[2], 0) / faceVertices.length;
      return {
        faceIndex,
        isCap: faceIndex < 2,
        vertices: faceVertices,
        normal: [normNx, normNy, normNz],
        centerZ
      };
    });

    const visibleFaces = [
      ...facesData
        .filter(face => !face.isCap && face.normal[2] > -0.08)
        .sort((a, b) => a.faceIndex - b.faceIndex),
      ...facesData
        .filter(face => face.isCap && face.normal[2] > -0.08)
        .sort((a, b) => {
          if (Math.abs(a.centerZ - b.centerZ) > 0.0001) return a.centerZ - b.centerZ;
          return a.faceIndex - b.faceIndex;
        })
    ];

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = isActive ? utils.rgba(border, 0.35) : "transparent";
    ctx.shadowBlur = isActive ? 16 : 0;

    visibleFaces.forEach(face => {
      const dot = face.normal[0] * normLx + face.normal[1] * normLy + face.normal[2] * normLz;
      const intensity = ambientLight + (1 - ambientLight) * Math.max(0, dot);
      const projected = face.vertices.map(v => {
        const scale = cameraDistance / (cameraDistance - v[2]);
        return [v[0] * scale, v[1] * scale];
      });

      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i][0], projected[i][1]);
      }
      ctx.closePath();

      ctx.fillStyle = shadeColor(color, intensity);
      ctx.fill();

      if (face.isCap) {
        ctx.shadowBlur = 0;
        ctx.lineWidth = (isActive ? 1.1 : 0.7) / globalScale;
        ctx.strokeStyle = border;
        ctx.stroke();
      }
    });
    ctx.shadowBlur = 0;

    if (mode === "circle") {
      ctx.rotate(-(node.angle || 0));
    }
    const nodeFontSize = Math.max(labelFontSize, size * 0.28) / globalScale;
    ctx.font = `bold ${nodeFontSize}px ${options.fontFamily || "var(--font-code, Consolas, monospace)"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelWidth = ctx.measureText(node.label).width;
    const labelHeight = nodeFontSize + 8 / globalScale;
    drawRoundedRect(ctx, -labelWidth / 2 - 5 / globalScale, -labelHeight / 2, labelWidth + 10 / globalScale, labelHeight, labelHeight / 2);
    ctx.fillStyle = utils.rgba(resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3, 0.78);
    ctx.fill();
    ctx.fillStyle = text;
    ctx.fillText(node.label, 0, 0);
    ctx.restore();
  }

  function currentGraphData() {
    syncNodeStatus();
    applyModePositions();
    toggleButton.textContent = mode === "assembled" ? "Désassembler" : "Assembler";
    return {
      nodes,
      links: mode === "circle" ? linksForActive() : []
    };
  }

  const rect = targetEl.getBoundingClientRect();
  currentWidth = options.width || rect.width || widthFallback;

  const autoZoom = (duration = 300) => {
    requestAnimationFrame(() => {
      try {
        const padding = mode === "assembled" ? nodeSize * 1.35 : nodeSize * 1.55;
        const xs = nodes.map(node => node.x ?? node.fx);
        const ys = nodes.map(node => node.y ?? node.fy);
        const minX = Math.min(...xs) - padding;
        const maxX = Math.max(...xs) + padding;
        const minY = Math.min(...ys) - padding;
        const maxY = Math.max(...ys) + padding;
        const worldWidth = Math.max(1, maxX - minX);
        const worldHeight = Math.max(1, maxY - minY);
        const targetZoom = Math.min(
          (currentWidth || widthFallback) / worldWidth,
          height / worldHeight
        ) * 0.9;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        graph.centerAt(centerX, centerY, duration);
        graph.zoom(targetZoom, duration);
      } catch (err) {
        console.warn("attention graph zoomToFit error:", err);
      }
    });
  };

  const refreshGraph = () => {
    graph.graphData(currentGraphData());
    graph.d3ReheatSimulation();
    autoZoom(280);
  };

  const graph = ForceGraph()(graphHost)
    .graphData(currentGraphData())
    .backgroundColor("transparent")
    .width(options.width || rect.width || widthFallback)
    .height(height)
    .cooldownTicks(Infinity)
    .enableZoomInteraction(false)
    .enablePanInteraction(false)
    .enableNodeDrag(false)
    .nodeCanvasObject((node, ctx, globalScale) => {
      ctx.save();
      ctx.translate(node.x, node.y);
      drawPuzzlePiece(node, ctx, globalScale);
      ctx.restore();
    })
    .nodePointerAreaPaint((node, color, ctx) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize * 0.46, 0, 2 * Math.PI);
      ctx.fill();
    })
    .linkWidth(link => attentionLinkWidth(link.weight))
    .linkColor(link => attentionLinkColor(link.weight))
    .linkDirectionalArrowLength(link => 5 + attentionLinkWidth(link.weight) * 1.5)
    .linkDirectionalArrowColor(link => attentionLinkColor(link.weight))
    .linkDirectionalArrowRelPos(0.88)
    .linkCurvature(link => {
      if (link.self) return 0;
      const sourceIndex = typeof link.source === "object" ? link.source.index : tokens.indexOf(link.source);
      const targetIndex = typeof link.target === "object" ? link.target.index : tokens.indexOf(link.target);
      const span = Math.abs(targetIndex - sourceIndex);
      const direction = targetIndex > sourceIndex ? 1 : -1;
      return direction * (0.22 + span * 0.025);
    })
    .linkCanvasObjectMode(() => "after")
    .linkCanvasObject((link, ctx, globalScale) => {
      const source = link.source;
      const target = link.target;
      if (typeof source !== "object" || typeof target !== "object") return;

      if (link.self) {
        const color = attentionLinkColor(link.weight);
        const loopRadius = (source.size || nodeSize) * 0.72;
        const loopX = source.x;
        const loopY = source.y - loopRadius * 0.72;
        const fSize = 13 / globalScale;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = attentionLinkWidth(link.weight) / globalScale;
        ctx.beginPath();
        ctx.ellipse(loopX, loopY, loopRadius * 0.72, loopRadius * 0.46, -0.35, 0.15 * Math.PI, 1.92 * Math.PI);
        ctx.stroke();

        const arrowAngle = -0.55;
        const arrowX = loopX + Math.cos(arrowAngle) * loopRadius * 0.54;
        const arrowY = loopY + Math.sin(arrowAngle) * loopRadius * 0.35;
        const arrowSize = 7 / globalScale;
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX - Math.cos(arrowAngle - 0.55) * arrowSize, arrowY - Math.sin(arrowAngle - 0.55) * arrowSize);
        ctx.lineTo(arrowX - Math.cos(arrowAngle + 0.55) * arrowSize, arrowY - Math.sin(arrowAngle + 0.55) * arrowSize);
        ctx.closePath();
        ctx.fill();

        ctx.font = `bold ${fSize}px ${options.fontFamily || "var(--font-code, Consolas, monospace)"}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = `self ${link.label}`;
        const textWidth = ctx.measureText(label).width;
        const pillW = textWidth + 10 / globalScale;
        const pillH = fSize + 7 / globalScale;
        const labelY = loopY - loopRadius * 0.5;
        drawRoundedRect(ctx, loopX - pillW / 2, labelY - pillH / 2, pillW, pillH, pillH / 2);
        ctx.fillStyle = utils.rgba(resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3, 0.9);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(label, loopX, labelY);
        ctx.restore();
        return;
      }

      const x = source.x + (target.x - source.x) * 0.5;
      const y = source.y + (target.y - source.y) * 0.5;
      const color = attentionLinkColor(link.weight);
      const fSize = 13 / globalScale;
      ctx.save();
      ctx.font = `bold ${fSize}px ${options.fontFamily || "var(--font-code, Consolas, monospace)"}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const textWidth = ctx.measureText(link.label).width;
      const pillW = textWidth + 10 / globalScale;
      const pillH = fSize + 7 / globalScale;
      drawRoundedRect(ctx, x - pillW / 2, y - pillH / 2, pillW, pillH, pillH / 2);
      ctx.fillStyle = utils.rgba(resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3, 0.9);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(link.label, x, y);
      ctx.restore();
    })
    .onNodeClick(node => {
      // Selection is handled by the native nearest-node click below because
      // ForceGraph hit regions can overlap while pieces rotate in 3D.
    })
    .onNodeHover(node => {
      graphHost.style.setProperty("cursor", node ? "pointer" : "default");
    });

  const resizeObserver = new ResizeObserver(entries => {
    const entry = entries[0];
    currentWidth = options.width || entry.contentRect.width || widthFallback;
    graph.width(currentWidth);
    graph.graphData(currentGraphData());
    graph.d3ReheatSimulation();
    autoZoom(180);
  });
  resizeObserver.observe(targetEl);

  const selectNearestFromEvent = event => {
    const rect = graphHost.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const graphCoords = typeof graph.screen2GraphCoords === "function"
      ? graph.screen2GraphCoords(screenX, screenY)
      : null;
    const nearest = nodes
      .map(node => {
        const dx = (graphCoords?.x ?? Number.NaN) - (node.x ?? node.fx);
        const dy = (graphCoords?.y ?? Number.NaN) - (node.y ?? node.fy);
        return {
          id: node.id,
          distance: Number.isFinite(dx) && Number.isFinite(dy) ? Math.sqrt(dx * dx + dy * dy) : null,
          x: node.x,
          y: node.y,
          fx: node.fx,
          fy: node.fy
        };
      })
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))[0];
    if (event.type === "pointermove") {
      graphHost.style.setProperty("cursor", nearest?.distance !== null && nearest.distance <= nodeSize * 1.25 ? "pointer" : "default");
      return;
    }
    if (event.type === "click" && nearest?.distance !== null && nearest.distance <= nodeSize * 1.25) {
      activeIndex = tokens.indexOf(nearest.id);
      mode = "circle";
      refreshGraph();
    }
  };
  graphHost.addEventListener("pointerdown", selectNearestFromEvent);
  graphHost.addEventListener("pointermove", selectNearestFromEvent);
  graphHost.addEventListener("click", selectNearestFromEvent);

  toggleButton.addEventListener("click", () => {
    mode = mode === "assembled" ? "circle" : "assembled";
    refreshGraph();
  });
  setTimeout(() => autoZoom(300), 0);

  const api = {
    assemble() {
      mode = "assembled";
      refreshGraph();
    },
    disassemble() {
      mode = "circle";
      refreshGraph();
    },
    destroy() {
      resizeObserver.disconnect();
      graphHost.removeEventListener("pointerdown", selectNearestFromEvent);
      graphHost.removeEventListener("pointermove", selectNearestFromEvent);
      graphHost.removeEventListener("click", selectNearestFromEvent);
      controls.remove();
      graphHost.remove();
    }
  };

  if (invalidation) {
    invalidation.then(() => api.destroy());
  }

  return api;
}

