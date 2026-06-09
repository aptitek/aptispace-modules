// ==========================================
// kv-puzzle-graph.js - Scores QK en puzzle WebGL
// ==========================================
import * as THREE from "https://esm.sh/three";
import { resolveCssValue } from "../core.js";
import { SOL_FALLBACKS } from "../networks.js";
import { generatePuzzleGrid, generatePuzzlePieceShape } from "../networks3d.js";

function interpolateHexColor(fromHex, toHex, t) {
  const from = fromHex.slice(1);
  const to = toHex.slice(1);
  const r = Math.round(parseInt(from.slice(0, 2), 16) + (parseInt(to.slice(0, 2), 16) - parseInt(from.slice(0, 2), 16)) * t);
  const g = Math.round(parseInt(from.slice(2, 4), 16) + (parseInt(to.slice(2, 4), 16) - parseInt(from.slice(2, 4), 16)) * t);
  const b = Math.round(parseInt(from.slice(4, 6), 16) + (parseInt(to.slice(4, 6), 16) - parseInt(from.slice(4, 6), 16)) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function scoreColor(strength) {
  const t = Math.max(0, Math.min(1, strength));
  const stops = [
    SOL_FALLBACKS.blue,
    SOL_FALLBACKS.cyan,
    SOL_FALLBACKS.green,
    SOL_FALLBACKS.yellow,
    SOL_FALLBACKS.orange,
    SOL_FALLBACKS.red,
    SOL_FALLBACKS.magenta,
    SOL_FALLBACKS.violet
  ];
  const n = stops.length - 1;
  const scaled = t * n;
  const i = Math.min(Math.floor(scaled), n - 1);
  return interpolateHexColor(stops[i], stops[i + 1], scaled - i);
}

function softmaxColor(strength) {
  const t = Math.max(0, Math.min(1, strength));
  return interpolateHexColor(SOL_FALLBACKS.blue, SOL_FALLBACKS.red, t);
}

function darkenRgb(rgbStr, factor) {
  const m = rgbStr.match(/\d+/g);
  if (!m) return rgbStr;
  return `rgb(${Math.round(+m[0] * factor)}, ${Math.round(+m[1] * factor)}, ${Math.round(+m[2] * factor)})`;
}

function makePuzzleShape(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) {
      shape.moveTo(x, -y);
      return;
    }
    shape.lineTo(x, -y);
  });
  shape.closePath();
  return shape;
}

function simplifyOutlinePoints(points, stride = 2) {
  const step = Math.max(1, Math.floor(stride));
  if (step === 1 || points.length < 24) return points;
  const simplified = points.filter((_, index) => index % step === 0);
  return simplified.length >= 12 ? simplified : points;
}

function makeDomLabel(text, { color, size, backgroundColor = null }) {
  const label = document.createElement("div");
  label.className = "kv-puzzle-label";
  label.textContent = text;
  label.style.setProperty("position", "absolute");
  label.style.setProperty("left", "0");
  label.style.setProperty("top", "0");
  label.style.setProperty("transform", "translate(-50%, -50%)");
  label.style.setProperty("padding", "0.12rem 0.28rem");
  label.style.setProperty("border-radius", "0.35rem");
  label.style.setProperty("font-family", resolveCssValue("var(--font-code)") || "Consolas, monospace");
  label.style.setProperty("font-size", `${size}px`);
  label.style.setProperty("font-weight", "700");
  label.style.setProperty("line-height", "1.12");
  label.style.setProperty("white-space", "pre");
  label.style.setProperty("text-align", "center");
  label.style.setProperty("pointer-events", "none");
  label.style.setProperty("color", color);
  if (backgroundColor) {
    label.style.setProperty("background-color", backgroundColor);
  }
  return label;
}

function buildKvPuzzleData(options = {}) {
  const tokens = options.tokens || [
    "Le", "petit", "chat", "curieux", "observe", "la", "fenêtre", "quand",
    "la", "pluie", "tombe", "sur", "les", "tuiles", "rouges", "du",
    "vieux", "toit", "pendant", "que", "la", "lampe", "éclaire", "doucement",
    "son", "bol", "vide", "près", "du", "canapé", "bleu", "calme"
  ];
  const rows = options.rows ?? 4;
  const cols = options.cols ?? 8;
  const expectedTokenCount = rows * cols;
  const boardTokens = tokens.slice(0, expectedTokenCount);
  while (boardTokens.length < expectedTokenCount) {
    boardTokens.push(`tok${boardTokens.length + 1}`);
  }

  const qValues = options.qValues || boardTokens.map((_, index) => 8 + ((index * 7 + 11) % 23));
  const kValues = options.kValues || boardTokens.map((_, index) => 7 + ((index * 5 + 17) % 19));
  const grid = generatePuzzleGrid(rows, cols);
  const nodes = boardTokens.map((token, index) => {
    const gridPiece = grid[index];
    return {
      id: `${token}-${index}`,
      label: token,
      q: qValues[index] ?? 0,
      k: kValues[index] ?? 0,
      score: 0,
      strength: 0,
      index,
      r: gridPiece?.r ?? Math.floor(index / cols),
      c: gridPiece?.c ?? index % cols,
      edges: gridPiece?.edges || [0, 1, 0, -1],
      edgeProfiles: gridPiece?.edgeProfiles || [],
      baseRx: (Math.random() - 0.5) * 0.34,
      baseRy: (Math.random() - 0.5) * 0.34,
      baseRz: (Math.random() - 0.5) * 0.28,
      gapX: (Math.random() - 0.5) * 0.22,
      gapY: (Math.random() - 0.5) * 0.2,
      gapZ: (Math.random() - 0.5) * 0.08,
      phase: Math.random() * Math.PI * 2
    };
  });

  const links = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sourceIndex = r * cols + c;
      if (c < cols - 1) {
        const targetIndex = sourceIndex + 1;
        const q = qValues[sourceIndex] ?? 0;
        const k = kValues[targetIndex] ?? 0;
        links.push({
          source: nodes[sourceIndex].id,
          target: nodes[targetIndex].id,
          sourceIndex,
          targetIndex,
          q,
          k,
          product: q * k
        });
      }
      if (r < rows - 1) {
        const targetIndex = sourceIndex + cols;
        const q = qValues[sourceIndex] ?? 0;
        const k = kValues[targetIndex] ?? 0;
        links.push({
          source: nodes[sourceIndex].id,
          target: nodes[targetIndex].id,
          sourceIndex,
          targetIndex,
          q,
          k,
          product: q * k
        });
      }
    }
  }

  const products = links.map(link => link.product);
  const minScore = Math.min(...products);
  const maxScore = Math.max(...products);
  const scoreRange = Math.max(1, maxScore - minScore);

  if (options.softmax) {
    const mean = products.reduce((a, b) => a + b, 0) / products.length;
    const variance = products.reduce((a, b) => a + (b - mean) ** 2, 0) / products.length;
    const std = Math.sqrt(Math.max(1, variance));
    const normalized = products.map(p => (p - mean) / std);
    const maxNorm = Math.max(...normalized);
    const exps = normalized.map(p => Math.exp(p - maxNorm));
    const expSum = exps.reduce((a, b) => a + b, 0);
    const smValues = exps.map(e => e / expSum);
    const smMax = Math.max(...smValues);
    const smMin = Math.min(...smValues);
    const smRange = Math.max(1e-9, smMax - smMin);
    links.forEach((link, i) => {
      link.softmaxValue = smValues[i];
      link.softmaxStrength = (smValues[i] - smMin) / smRange;
    });
  }

  nodes.forEach(node => {
    const relatedLinks = links.filter(link => link.source === node.id || link.target === node.id);
    node.score = Math.max(...relatedLinks.map(l => l.product), 0);
    node.strength = (node.score - minScore) / scoreRange;
    if (options.softmax) {
      node.softmaxValue = Math.max(...relatedLinks.map(l => l.softmaxValue ?? 0), 0);
      node.softmaxStrength = Math.max(...relatedLinks.map(l => l.softmaxStrength ?? 0), 0);
    }
  });

  return { rows, cols, nodes, links, minScore, scoreRange };
}

function projectToOverlay(position, camera, width, height) {
  const projected = position.clone().project(camera);
  return {
    x: (projected.x * 0.5 + 0.5) * width,
    y: (-projected.y * 0.5 + 0.5) * height,
    visible: projected.z >= -1 && projected.z <= 1
  };
}

function distanceToSegment(point, start, end) {
  const vx = end.x - start.x;
  const vy = end.y - start.y;
  const wx = point.x - start.x;
  const wy = point.y - start.y;
  const lenSq = vx * vx + vy * vy;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / lenSq)) : 0;
  const px = start.x + t * vx;
  const py = start.y + t * vy;
  const dx = point.x - px;
  const dy = point.y - py;
  return {
    distance: Math.sqrt(dx * dx + dy * dy),
    closest: new THREE.Vector3(px, py, Math.max(start.z, end.z) + 0.28),
    t
  };
}

function disposeObject(object) {
  object.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach(material => {
      if (material.map) material.map.dispose();
      material.dispose?.();
    });
  });
}

/**
 * Puzzle board that shows raw Q·K scores before softmax normalization.
 */
export function createKvPuzzleGraph(container, options = {}, invalidation = null) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) {
    console.warn("createKvPuzzleGraph: Target container not found.", container);
    return null;
  }
  targetEl.innerHTML = "";

  const data = buildKvPuzzleData(options);
  const pieceSize = options.pieceSize ?? 1;
  const pieceDepth = options.pieceDepth ?? 0.2;
  const pointStride = options.pointStride ?? 8;
  const animatePieces = options.animatePieces ?? false;
  const showLines = options.showLines ?? true;
  const showLabels = options.showLabels ?? true;
  const useSoftmax = options.softmax ?? false;
  const colorFn = useSoftmax ? (s) => darkenRgb(softmaxColor(s), 0.8) : scoreColor;
  const strengthOf = (node) => useSoftmax ? (node.softmaxStrength ?? 0) : (node.effectiveStrength ?? node.strength);
  const linkStrengthOf = (link) => useSoftmax ? (link.softmaxStrength ?? 0) : (link.effectiveStrength ?? (link.product - data.minScore) / data.scoreRange);
  const height = options.height ?? Math.max(targetEl.getBoundingClientRect().height || 0, 520);
  const backgroundColor = resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3;
  const textColor = resolveCssValue("var(--sol-base03)") || SOL_FALLBACKS.base03;
  let frameId = null;
  let labelFrameId = null;
  const pendingLabelBuilders = [];
  const overlayLabels = [];
  const hoverableLinks = [];
  let overlayWidth = 1;
  let overlayHeight = height;
  data.nodes.forEach(node => { node.userAngle = 0; });
  let dragState = null;
  targetEl.style.setProperty("min-height", `${height}px`);
  targetEl.style.setProperty("position", "relative");
  if (useSoftmax) {
    targetEl.style.setProperty("background-color", resolveCssValue("var(--sol-base2)") || SOL_FALLBACKS.base2);
  }

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  camera.position.set(0, 0, 9);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearAlpha(0);
  renderer.domElement.className = "w-100 d-block";
  targetEl.appendChild(renderer.domElement);

  const overlay = document.createElement("div");
  overlay.className = "kv-puzzle-label-layer";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.setProperty("position", "absolute");
  overlay.style.setProperty("inset", "0");
  overlay.style.setProperty("pointer-events", "none");
  overlay.style.setProperty("overflow", "hidden");
  targetEl.appendChild(overlay);

  const hoverLabel = makeDomLabel("", {
    color: textColor,
    size: 10,
    backgroundColor
  });
  hoverLabel.style.setProperty("display", "none");
  overlay.appendChild(hoverLabel);
  let hoveredNode = null;

  const ambient = new THREE.AmbientLight(new THREE.Color(resolveCssValue("var(--sol-base2)") || SOL_FALLBACKS.base2), 1.45);
  scene.add(ambient);
  const keyLight = new THREE.DirectionalLight(new THREE.Color(resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3), 2.8);
  keyLight.position.set(-2.5, 3, 7);
  scene.add(keyLight);
  const sideLight = new THREE.DirectionalLight(new THREE.Color(resolveCssValue("var(--sol-yellow)") || SOL_FALLBACKS.yellow), 0.45);
  sideLight.position.set(2.5, 1.5, 3);
  scene.add(sideLight);
  const rimLight = new THREE.DirectionalLight(new THREE.Color(resolveCssValue("var(--sol-cyan)") || SOL_FALLBACKS.cyan), 0.65);
  rimLight.position.set(4, -3, 5);
  scene.add(rimLight);

  const board = new THREE.Group();
  scene.add(board);

  const enqueueLabel = builder => {
    pendingLabelBuilders.push(builder);
  };

  const nodeById = new Map(data.nodes.map(node => [node.id, node]));
  data.nodes.forEach(node => {
    const rawPoints = generatePuzzlePieceShape(pieceSize, node.edges, node.edgeProfiles);
    const points = simplifyOutlinePoints(rawPoints, pointStride);
    const shape = makePuzzleShape(points);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: pieceDepth,
      bevelEnabled: options.bevelEnabled ?? false,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 1,
      curveSegments: 1
    });
    geometry.center();
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorFn(strengthOf(node))),
      roughness: 0.72,
      metalness: 0.05
    });
    const mesh = new THREE.Mesh(geometry, material);
    const x = (node.c - (data.cols - 1) / 2) * pieceSize * 1.08 + node.gapX;
    const y = -((node.r - (data.rows - 1) / 2) * pieceSize * 0.98 + node.gapY);
    mesh.position.set(x, y, node.gapZ);
    mesh.rotation.set(node.baseRx, node.baseRy, node.baseRz);
    mesh.userData = { node, baseRotation: mesh.rotation.clone() };
    board.add(mesh);
    node.mesh = mesh;

    if (showLabels) {
      enqueueLabel(() => {
        const wordLabel = makeDomLabel(node.label, {
          color: textColor,
          size: 12,
          backgroundColor
        });
        return {
          element: wordLabel,
          position: new THREE.Vector3(x, y + 0.07, 0.18)
        };
      });
    }

  });

  if (showLines) data.links.forEach(link => {
    const source = nodeById.get(link.source);
    const target = nodeById.get(link.target);
    if (!source?.mesh || !target?.mesh) return;
    const t = linkStrengthOf(link);
    const color = colorFn(t);
    const start = source.mesh.position;
    const end = target.mesh.position;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(start.x, start.y, 0.24),
      new THREE.Vector3(end.x, end.y, 0.24)
    ]);
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.56 + Math.max(0, Math.min(1, t)) * 0.34
    });
    const line = new THREE.Line(geometry, material);
    link.sourceNode = source;
    link.targetNode = target;
    link.line = line;
    hoverableLinks.push(link);
    board.add(line);
  });

  function drainLabelQueue() {
    const batchSize = options.labelBatchSize ?? 4;
    for (let i = 0; i < batchSize && pendingLabelBuilders.length > 0; i++) {
      const label = pendingLabelBuilders.shift()();
      overlay.appendChild(label.element);
      overlayLabels.push(label);
    }
    if (pendingLabelBuilders.length > 0) {
      labelFrameId = requestAnimationFrame(drainLabelQueue);
    } else {
      labelFrameId = null;
    }
  }

  function resize() {
    const rect = targetEl.getBoundingClientRect();
    const width = Math.max(1, rect.width || 860);
    renderer.setSize(width, height);
    overlayWidth = width;
    overlayHeight = height;
    const aspect = width / height;
    const boardWidth = data.cols * pieceSize * 1.08;
    const boardHeight = data.rows * pieceSize * 1.05;
    const viewHeight = Math.max(boardHeight, boardWidth / aspect) * 1.25;
    const viewWidth = viewHeight * aspect;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();

  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(targetEl);
  resize();

  function updateOverlayLabels() {
    overlayLabels.forEach(label => {
      const screen = projectToOverlay(label.position, camera, overlayWidth, overlayHeight);
      label.element.style.setProperty("transform", `translate(${screen.x}px, ${screen.y}px) translate(-50%, -50%)`);
      label.element.style.setProperty("display", screen.visible ? "block" : "none");
    });

    if (hoveredNode?.mesh) {
      const screen = projectToOverlay(
        hoveredNode.hoverPosition || new THREE.Vector3(hoveredNode.mesh.position.x, hoveredNode.mesh.position.y - 0.44, 0.55),
        camera,
        overlayWidth,
        overlayHeight
      );
      hoverLabel.style.setProperty("transform", `translate(${screen.x}px, ${screen.y}px) translate(-50%, -50%)`);
      hoverLabel.style.setProperty("display", screen.visible ? "block" : "none");
    }
  }

  function selectHoveredNode(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const worldX = camera.left + (px / Math.max(1, rect.width)) * (camera.right - camera.left);
    const worldY = camera.top - (py / Math.max(1, rect.height)) * (camera.top - camera.bottom);
    const pointer = new THREE.Vector3(worldX, worldY, 0.24);
    let nearestLink = null;
    let nearestLinkHit = null;
    let nearestLinkDistance = Infinity;
    let nearest = null;
    let nearestDistance = Infinity;

    hoverableLinks.forEach(link => {
      const source = link.sourceNode?.mesh?.position;
      const target = link.targetNode?.mesh?.position;
      if (!source || !target) return;
      const hit = distanceToSegment(pointer, source, target);
      if (hit.distance < nearestLinkDistance) {
        nearestLink = link;
        nearestLinkHit = hit;
        nearestLinkDistance = hit.distance;
      }
    });

    if (nearestLink && nearestLinkHit && nearestLinkDistance <= pieceSize * 0.13 && nearestLinkHit.t > 0.12 && nearestLinkHit.t < 0.88) {
      const source = nearestLink.sourceNode;
      const target = nearestLink.targetNode;
      const forward = (source.q ?? 0) * (target.k ?? 0);
      const backward = (target.q ?? 0) * (source.k ?? 0);
      const hoverStrength = linkStrengthOf(nearestLink);
      hoveredNode = {
        mesh: source.mesh,
        hoverPosition: nearestLinkHit.closest,
        strength: hoverStrength
      };
      const fwdPct = useSoftmax ? ` (${((nearestLink.softmaxValue ?? 0) * 100).toFixed(1)}%)` : "";
      hoverLabel.textContent = `${source.label} → ${target.label}\nq=${source.q} k=${target.k} q×k=${forward}${fwdPct}\n${target.label} → ${source.label}\nq=${target.q} k=${source.k} q×k=${backward}`;
      hoverLabel.style.setProperty("color", colorFn(hoverStrength));
      renderer.domElement.style.setProperty("cursor", "pointer");
      return;
    }

    data.nodes.forEach(node => {
      if (!node.mesh) return;
      const dx = node.mesh.position.x - worldX;
      const dy = node.mesh.position.y - worldY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < nearestDistance) {
        nearest = node;
        nearestDistance = distance;
      }
    });

    if (!nearest || nearestDistance > pieceSize * 0.58) {
      hoveredNode = null;
      hoverLabel.style.setProperty("display", "none");
      renderer.domElement.style.setProperty("cursor", "default");
      return;
    }

    hoveredNode = nearest;
    hoverLabel.textContent = useSoftmax
      ? `${nearest.label}\nmax ${((nearest.softmaxValue ?? 0) * 100).toFixed(1)}%`
      : `${nearest.label}\nmax=${Math.round(nearest.score)}`;
    hoverLabel.style.setProperty("color", colorFn(strengthOf(nearest)));
    renderer.domElement.style.setProperty("cursor", "pointer");

  }

  function clearHoveredNode() {
    hoveredNode = null;
    hoverLabel.style.setProperty("display", "none");
    if (!dragState) renderer.domElement.style.setProperty("cursor", "default");
  }

  function recomputeEffectiveScores() {
    data.links.forEach(link => {
      const source = nodeById.get(link.source);
      const target = nodeById.get(link.target);
      const angleDiff = (source?.userAngle ?? 0) - (target?.userAngle ?? 0);
      link.effectiveProduct = link.product * (1 + Math.cos(angleDiff)) / 2;
    });
    const effProducts = data.links.map(l => l.effectiveProduct);
    const effMin = Math.min(...effProducts);
    const effRange = Math.max(1e-9, Math.max(...effProducts) - effMin);
    if (useSoftmax) {
      const mean = effProducts.reduce((a, b) => a + b, 0) / effProducts.length;
      const variance = effProducts.reduce((a, b) => a + (b - mean) ** 2, 0) / effProducts.length;
      const std = Math.sqrt(Math.max(1, variance));
      const normalized = effProducts.map(p => (p - mean) / std);
      const maxNorm = Math.max(...normalized);
      const exps = normalized.map(p => Math.exp(p - maxNorm));
      const expSum = exps.reduce((a, b) => a + b, 0);
      const smValues = exps.map(e => e / expSum);
      const smMax = Math.max(...smValues);
      const smMin = Math.min(...smValues);
      const smRange = Math.max(1e-9, smMax - smMin);
      data.links.forEach((link, i) => {
        link.softmaxValue = smValues[i];
        link.softmaxStrength = (smValues[i] - smMin) / smRange;
      });
    } else {
      data.links.forEach(link => {
        link.effectiveStrength = (link.effectiveProduct - effMin) / effRange;
      });
    }
    data.nodes.forEach(node => {
      const rel = data.links.filter(l => l.source === node.id || l.target === node.id);
      if (useSoftmax) {
        node.softmaxValue = Math.max(...rel.map(l => l.softmaxValue ?? 0), 0);
        node.softmaxStrength = Math.max(...rel.map(l => l.softmaxStrength ?? 0), 0);
      } else {
        node.effectiveStrength = Math.max(...rel.map(l => l.effectiveStrength ?? 0), 0);
      }
    });
  }

  function updateMeshColors() {
    data.nodes.forEach(node => {
      if (node.mesh) node.mesh.material.color.set(colorFn(strengthOf(node)));
    });
    hoverableLinks.forEach(link => {
      if (!link.line) return;
      const t = linkStrengthOf(link);
      link.line.material.color.set(colorFn(t));
      link.line.material.opacity = 0.56 + t * 0.34;
    });
  }

  function handlePointerDown(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const worldX = camera.left + ((event.clientX - rect.left) / Math.max(1, rect.width)) * (camera.right - camera.left);
    const worldY = camera.top - ((event.clientY - rect.top) / Math.max(1, rect.height)) * (camera.top - camera.bottom);
    let nearest = null;
    let nearestDist = Infinity;
    data.nodes.forEach(node => {
      if (!node.mesh) return;
      const d = Math.hypot(node.mesh.position.x - worldX, node.mesh.position.y - worldY);
      if (d < nearestDist) { nearest = node; nearestDist = d; }
    });
    if (!nearest || nearestDist > pieceSize * 0.58) return;
    dragState = {
      node: nearest,
      startUserAngle: nearest.userAngle ?? 0,
      startPointerAngle: Math.atan2(worldY - nearest.mesh.position.y, worldX - nearest.mesh.position.x),
      pieceX: nearest.mesh.position.x,
      pieceY: nearest.mesh.position.y
    };
    renderer.domElement.setPointerCapture(event.pointerId);
    renderer.domElement.style.setProperty("cursor", "grabbing");
  }

  function handlePointerMove(event) {
    if (dragState) {
      const rect = renderer.domElement.getBoundingClientRect();
      const worldX = camera.left + ((event.clientX - rect.left) / Math.max(1, rect.width)) * (camera.right - camera.left);
      const worldY = camera.top - ((event.clientY - rect.top) / Math.max(1, rect.height)) * (camera.top - camera.bottom);
      const newAngle = Math.atan2(worldY - dragState.pieceY, worldX - dragState.pieceX);
      let delta = newAngle - dragState.startPointerAngle;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      dragState.node.userAngle = dragState.startUserAngle + delta;
      recomputeEffectiveScores();
      updateMeshColors();
      return;
    }
    selectHoveredNode(event);
  }

  function handlePointerUp() {
    if (!dragState) return;
    dragState = null;
    renderer.domElement.style.setProperty("cursor", "default");
  }

  recomputeEffectiveScores();

  renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerup", handlePointerUp);
  renderer.domElement.addEventListener("pointerleave", clearHoveredNode);

  function animate(time = 0) {
    board.children.forEach(child => {
      const node = child.userData?.node;
      const baseRotation = child.userData?.baseRotation;
      if (!node || !baseRotation) return;
      if (animatePieces) {
        const t = time * 0.001;
        child.rotation.x = baseRotation.x + Math.sin(t * 0.8 + node.phase) * 0.025;
        child.rotation.y = baseRotation.y + Math.cos(t * 0.7 + node.phase) * 0.025;
      }
      child.rotation.z = baseRotation.z + (node.userAngle ?? 0);
    });
    renderer.render(scene, camera);
    updateOverlayLabels();
    frameId = requestAnimationFrame(animate);
  }
  frameId = requestAnimationFrame(animate);
  labelFrameId = requestAnimationFrame(drainLabelQueue);

  const api = {
    destroy() {
      if (frameId) cancelAnimationFrame(frameId);
      if (labelFrameId) cancelAnimationFrame(labelFrameId);
      pendingLabelBuilders.length = 0;
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointerleave", clearHoveredNode);
      resizeObserver.disconnect();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      overlay.remove();
      targetEl.innerHTML = "";
    }
  };

  if (invalidation && typeof invalidation.then === "function") {
    invalidation.then(() => api.destroy());
  }

  return api;
}
