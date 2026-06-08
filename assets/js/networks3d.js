// ==========================================
// networks3d.js - Primitives 3D et Puzzle
// ==========================================
import * as THREE from "https://esm.sh/three";
import { resolveCssValue } from "./core.js";
import { SOL_FALLBACKS } from "./networks.js";

// =====================================================================
// 🧩 UTILITIES FOR 3D ROTATING SHAPES & PROCEDURAL PUZZLE GRID
// =====================================================================

/**
 * Normalizes an angle to the range [-PI, PI] for smooth interpolation.
 */
export function normalizeAngle(angle) {
  let a = angle % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Shades a color based on light intensity, resolving CSS variables.
 */
export function shadeColor(colorStr, intensity) {
  const color = resolveCssValue(colorStr) || colorStr;
  let r = 0, g = 0, b = 0, a = 1;

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else if (color.startsWith('rgb')) {
    const parts = color.match(/[\d\.]+/g);
    if (parts) {
      r = parseInt(parts[0]);
      g = parseInt(parts[1]);
      b = parseInt(parts[2]);
      if (parts[3] !== undefined) a = parseFloat(parts[3]);
    }
  } else {
    // Return original color if parsing is not supported
    return color;
  }

  const shadedR = Math.min(255, Math.max(0, Math.round(r * intensity)));
  const shadedG = Math.min(255, Math.max(0, Math.round(g * intensity)));
  const shadedB = Math.min(255, Math.max(0, Math.round(b * intensity)));

  return `rgba(${shadedR}, ${shadedG}, ${shadedB}, ${a})`;
}

/**
 * Samples 2D points along a browser-native SVG path string.
 */
export function sampleSvgPath(pathString, numPoints = 40) {
  if (typeof document === "undefined") return [];
  try {
    const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathEl.setAttribute("d", pathString);
    const totalLength = pathEl.getTotalLength();
    const points = [];

    for (let i = 0; i < numPoints; i++) {
      const distance = (i * totalLength) / (numPoints - 1);
      const pt = pathEl.getPointAtLength(distance);
      points.push([pt.x, pt.y]);
    }

    // Filter out duplicate points
    const uniquePoints = [];
    points.forEach(p => {
      if (uniquePoints.length === 0) {
        uniquePoints.push(p);
      } else {
        const last = uniquePoints[uniquePoints.length - 1];
        const dist = Math.sqrt((p[0] - last[0])**2 + (p[1] - last[1])**2);
        if (dist > 0.01) {
          uniquePoints.push(p);
        }
      }
    });

    // Ensure first and last points do not duplicate
    if (uniquePoints.length > 2) {
      const first = uniquePoints[0];
      const last = uniquePoints[uniquePoints.length - 1];
      const dist = Math.sqrt((last[0] - first[0])**2 + (last[1] - first[1])**2);
      if (dist < 0.1) {
        uniquePoints.pop();
      }
    }

    return uniquePoints;
  } catch (err) {
    console.warn("sampleSvgPath error:", err);
    return [[-10, -10], [10, -10], [10, 10], [-10, 10]]; // fallback square
  }
}

/**
 * Centers a list of 2D points at (0, 0) and scales them to a target size.
 */
function centerAndScalePoints(points, targetSize) {
  if (!points || points.length === 0) return [];
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  points.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });

  const width = maxX - minX;
  const height = maxY - minY;
  const cx = minX + width / 2;
  const cy = minY + height / 2;
  const maxDim = Math.max(width, height);
  const scale = maxDim > 0 ? targetSize / maxDim : 1;

  return points.map(([x, y]) => [
    (x - cx) * scale,
    (y - cy) * scale
  ]);
}

/**
 * Generates a beautiful 5-pointed (or N-pointed) star.
 */
function generateStar2D(numPoints = 5, rInner = 10, rOuter = 22) {
  const points = [];
  for (let i = 0; i < numPoints * 2; i++) {
    const angle = (i * Math.PI) / numPoints - Math.PI / 2;
    const r = (i % 2 === 0) ? rOuter : rInner;
    points.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  return points;
}

/**
 * Generates a beautiful gear polygon with custom teeth.
 */
function generateGear2D(numTeeth = 8, rInner = 15, rOuter = 22) {
  const points = [];
  const numPoints = numTeeth * 4;
  for (let i = 0; i < numPoints; i++) {
    const angle = (i * 2 * Math.PI) / numPoints;
    const toothPart = i % 4;
    let r = rInner;
    if (toothPart === 1 || toothPart === 2) {
      r = rOuter;
    }
    points.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  return points;
}

/**
 * Generates a regular polygon with N sides.
 */
function generateRegularPolygon2D(sides = 6, radius = 20) {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return points;
}

/**
 * Generates the 2D polygon of a puzzle piece with matching edges.
 * edges = [top, right, bottom, left] where 0=flat, 1=tab (out), -1=blank (in)
 */
function smoothPuzzleProfilePoints(controlPoints, steps = 5) {
  const points = [];

  for (let i = 0; i < controlPoints.length - 1; i++) {
    const from = controlPoints[i];
    const to = controlPoints[i + 1];

    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const eased = t * t * (3 - 2 * t);
      points.push({
        u: from.u + (to.u - from.u) * eased,
        h: from.h + (to.h - from.h) * eased
      });
    }
  }

  points.push(controlPoints[controlPoints.length - 1]);
  return points;
}

function createPuzzleEdgeProfile() {
  const center = 0.5 + (Math.random() - 0.5) * 0.12;
  const leftNeckHalf = 0.085 + Math.random() * 0.035;
  const rightNeckHalf = 0.075 + Math.random() * 0.04;
  const headHalf = 0.18 + Math.random() * 0.035;
  const leftNeck = Math.max(0.2, center - leftNeckHalf);
  const rightNeck = Math.min(0.8, center + rightNeckHalf);
  const leftHead = Math.max(0.14, center - headHalf);
  const rightHead = Math.min(0.86, center + headHalf);
  const height = 0.3 + Math.random() * 0.06;
  const stemHeight = height * (0.14 + Math.random() * 0.04);
  const leftCapBaseHeight = height * (0.32 + Math.random() * 0.06);
  const rightCapBaseHeight = height * (0.32 + Math.random() * 0.06);
  const crownOffset = (Math.random() - 0.5) * 0.02;

  const controlPoints = [
    { u: 0.0, h: 0.0 },
    { u: Math.max(0.04, leftHead - 0.08), h: 0.0 },
    { u: leftNeck, h: 0.0 },
    { u: center - leftNeckHalf * 0.52, h: stemHeight },
    { u: leftHead, h: leftCapBaseHeight },
    { u: center - headHalf * 0.88, h: height * 0.72 },
    { u: center - headHalf * 0.62, h: height * 0.9 },
    { u: center - headHalf * 0.28, h: height * 0.99 },
    { u: center + crownOffset, h: height },
    { u: center + headHalf * 0.28, h: height * 0.99 },
    { u: center + headHalf * 0.62, h: height * 0.9 },
    { u: center + headHalf * 0.88, h: height * 0.72 },
    { u: rightHead, h: rightCapBaseHeight },
    { u: center + rightNeckHalf * 0.58, h: stemHeight * (0.9 + Math.random() * 0.22) },
    { u: rightNeck, h: 0.0 },
    { u: Math.min(0.98, rightHead + 0.08), h: 0.0 },
    { u: 1.0, h: 0.0 }
  ];

  return {
    points: smoothPuzzleProfilePoints(controlPoints)
  };
}

function getPuzzleEdgePoints(edge) {
  const points = edge.profile?.points || createPuzzleEdgeProfile().points;
  if (!edge.reverse) return points;

  return points
    .slice()
    .reverse()
    .map(pt => ({ u: 1 - pt.u, h: pt.h }));
}

function normalizePuzzleEdge(edge, edgeProfile) {
  const profileDescriptor = edgeProfile && edgeProfile.profile
    ? edgeProfile
    : { profile: edgeProfile, reverse: false };

  if (typeof edge === "object" && edge !== null) {
    return {
      sign: edge.sign ?? 0,
      profile: edge.profile || profileDescriptor.profile || createPuzzleEdgeProfile(),
      reverse: Boolean(edge.reverse ?? profileDescriptor.reverse)
    };
  }

  return {
    sign: edge ?? 0,
    profile: profileDescriptor.profile || createPuzzleEdgeProfile(),
    reverse: Boolean(profileDescriptor.reverse)
  };
}

export function generatePuzzlePieceShape(size, edges = [0, 0, 0, 0], edgeProfiles = []) {
  const half = size / 2;
  const points = [];
  const samplesPerEdge = 32;

  const corners = [
    [-half, -half], // Top-Left
    [half, -half],  // Top-Right
    [half, half],   // Bottom-Right
    [-half, half]   // Bottom-Left
  ];

  for (let i = 0; i < 4; i++) {
    const p1 = corners[i];
    const p2 = corners[(i + 1) % 4];
    const edge = normalizePuzzleEdge(edges[i], edgeProfiles[i]);
    const sign = edge.sign;

    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.sqrt(dx*dx + dy*dy);
    const tx = dx / len;
    const ty = dy / len;

    // Outward normal vector
    const nx = ty;
    const ny = -tx;
    const edgePoints = sign === 0
      ? Array.from({ length: samplesPerEdge }, (_, j) => ({ u: j / samplesPerEdge, h: 0 }))
      : getPuzzleEdgePoints(edge);

    for (const pt of edgePoints.slice(0, -1)) {
      const h = pt.h * sign * size;

      const px = p1[0] + pt.u * dx + h * nx;
      const py = p1[1] + pt.u * dy + h * ny;
      points.push([px, py]);
    }
  }

  return points;
}

export function computeFaceNormal3D(vertices) {
  let nx = 0;
  let ny = 0;
  let nz = 0;

  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    nx += (current[1] - next[1]) * (current[2] + next[2]);
    ny += (current[2] - next[2]) * (current[0] + next[0]);
    nz += (current[0] - next[0]) * (current[1] + next[1]);
  }

  const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (length <= 0.000001) {
    return [0, 0, 1];
  }

  return [nx / length, ny / length, nz / length];
}

/**
 * Extrudes a 2D polygon into a 3D solid mesh.
 */
export function extrudePolygon(points2d, thickness) {
  const N = points2d.length;
  const halfT = thickness / 2;
  const vertices = [];

  // Front vertices (z = +halfT)
  for (let i = 0; i < N; i++) {
    vertices.push([points2d[i][0], points2d[i][1], halfT]);
  }
  // Back vertices (z = -halfT)
  for (let i = 0; i < N; i++) {
    vertices.push([points2d[i][0], points2d[i][1], -halfT]);
  }

  const faces = [];

  // Front face (CCW order)
  const frontFace = [];
  for (let i = 0; i < N; i++) {
    frontFace.push(i);
  }
  faces.push(frontFace);

  // Back face (reversed CCW order for outward normal)
  const backFace = [];
  for (let i = N - 1; i >= 0; i--) {
    backFace.push(N + i);
  }
  faces.push(backFace);

  // Side faces connecting front and back edges
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    // CCW side face: F_i -> B_i -> B_next -> F_next
    faces.push([i, N + i, N + next, next]);
  }

  return { vertices, faces };
}

/**
 * Generates a procedural puzzle grid with matching edges.
 */
export function generatePuzzleGrid(rows, cols) {
  const horizontalEdges = Array.from({ length: rows - 1 }, () => Array(cols).fill(0));
  const verticalEdges = Array.from({ length: rows }, () => Array(cols - 1).fill(0));
  const horizontalProfiles = Array.from({ length: rows - 1 }, () => Array(cols).fill(null));
  const verticalProfiles = Array.from({ length: rows }, () => Array(cols - 1).fill(null));

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      horizontalEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
      horizontalProfiles[r][c] = createPuzzleEdgeProfile();
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      verticalEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
      verticalProfiles[r][c] = createPuzzleEdgeProfile();
    }
  }

  const grid = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const top = r === 0 ? 0 : -horizontalEdges[r - 1][c];
      const bottom = r === rows - 1 ? 0 : horizontalEdges[r][c];
      const left = c === 0 ? 0 : -verticalEdges[r][c - 1];
      const right = c === cols - 1 ? 0 : verticalEdges[r][c];
      const topProfile = r === 0 ? null : horizontalProfiles[r - 1][c];
      const bottomProfile = r === rows - 1 ? null : horizontalProfiles[r][c];
      const leftProfile = c === 0 ? null : verticalProfiles[r][c - 1];
      const rightProfile = c === cols - 1 ? null : verticalProfiles[r][c];

      grid.push({
        r,
        c,
        edges: [top, right, bottom, left],
        edgeProfiles: [
          topProfile ? { profile: topProfile, reverse: false } : null,
          rightProfile ? { profile: rightProfile, reverse: false } : null,
          bottomProfile ? { profile: bottomProfile, reverse: true } : null,
          leftProfile ? { profile: leftProfile, reverse: true } : null
        ]
      });
    }
  }
  return grid;
}

// =====================================================================
// 🕸️ 3D PIECE FORCE GRAPH
// =====================================================================

function makeThreeShape(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, -y);
    else shape.lineTo(x, -y);
  });
  shape.closePath();
  return shape;
}

function simplifyThreePoints(points, stride = 3) {
  const step = Math.max(1, Math.floor(stride));
  if (step === 1 || points.length < 24) return points;
  const simplified = points.filter((_, index) => index % step === 0);
  return simplified.length >= 12 ? simplified : points;
}

function makeExtrudedGeometry(points, depth, stride = 3) {
  const shape = makeThreeShape(simplifyThreePoints(points, stride));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 1
  });
  geometry.center();
  return geometry;
}

function geometryForPieceNode(node, size, depth, stride = 3) {
  if (node.svgPath) {
    const sampled = sampleSvgPath(node.svgPath, 40);
    const scaled = centerAndScalePoints(sampled, size);
    return makeExtrudedGeometry(scaled, depth, Math.max(1, stride - 1));
  }

  switch (node.shape) {
    case "cube":
      return new THREE.BoxGeometry(size, size, depth * 2.4);
    case "star":
      return makeExtrudedGeometry(generateStar2D(5, size * 0.22, size * 0.5), depth, 1);
    case "gear":
      return makeExtrudedGeometry(generateGear2D(8, size * 0.35, size * 0.5), depth, 1);
    case "puzzle":
      return makeExtrudedGeometry(generatePuzzlePieceShape(size, node.edges || [1, -1, 1, -1], node.edgeProfiles), depth, stride);
    case "cylinder":
    case "disk":
      return new THREE.CylinderGeometry(size * 0.5, size * 0.5, depth * 2, 32).rotateX(Math.PI / 2);
    case "hexagon":
      return makeExtrudedGeometry(generateRegularPolygon2D(6, size * 0.5), depth, 1);
    default:
      return makeExtrudedGeometry(generateRegularPolygon2D(16, size * 0.5), depth, 1);
  }
}

function makeOverlayLabel(text, color, fontSize = 11) {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.setProperty("position", "absolute");
  el.style.setProperty("left", "0");
  el.style.setProperty("top", "0");
  el.style.setProperty("transform", "translate(-50%, -50%)");
  el.style.setProperty("padding", "0.12rem 0.28rem");
  el.style.setProperty("border-radius", "0.35rem");
  el.style.setProperty("font-family", "var(--font-code, Consolas, monospace)");
  el.style.setProperty("font-size", `${fontSize}px`);
  el.style.setProperty("font-weight", "700");
  el.style.setProperty("line-height", "1.1");
  el.style.setProperty("white-space", "pre");
  el.style.setProperty("pointer-events", "none");
  el.style.setProperty("color", color);
  el.style.setProperty("background-color", resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3);
  return el;
}

function projectOverlay(position, camera, width, height) {
  const projected = position.clone().project(camera);
  return {
    x: (projected.x * 0.5 + 0.5) * width,
    y: (-projected.y * 0.5 + 0.5) * height,
    visible: projected.z >= -1 && projected.z <= 1
  };
}

function disposeThreeObject(object) {
  object.traverse(child => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach(material => material.dispose?.());
  });
}

/**
 * Creates a WebGL 3D piece graph with procedural puzzle support.
 */
export function create3DPieceGraph(container, graphData, options = {}) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) {
    console.warn("create3DPieceGraph: Target container not found.", container);
    return null;
  }
  targetEl.innerHTML = "";
  targetEl.style.setProperty("position", "relative");

  const cfg = {
    nodeSize: 34,
    nodeBg: "var(--sol-blue)",
    nodeText: "var(--sol-base3)",
    fontSize: 10,
    rotationSpeed: 1,
    cameraDistance: 180,
    ambientLight: 0.35,
    lightDirection: [-0.3, -0.4, 0.85],
    isPuzzle: false,
    rows: 3,
    cols: 3,
    height: 350,
    pointStride: 4,
    pieceDepth: 8,
    onNodeClick: null,
    ...options
  };

  if (cfg.isPuzzle && (!graphData || !graphData.nodes || graphData.nodes.length === 0)) {
    const gridData = generatePuzzleGrid(cfg.rows, cfg.cols);
    const colors = [
      "var(--sol-blue)",
      "var(--sol-cyan)",
      "var(--sol-green)",
      "var(--sol-yellow)",
      "var(--sol-orange)",
      "var(--sol-magenta)",
      "var(--sol-violet)"
    ];
    const nodes = gridData.map(item => ({
      id: `p_${item.r}_${item.c}`,
      label: `${item.r + 1},${item.c + 1}`,
      r: item.r,
      c: item.c,
      edges: item.edges,
      edgeProfiles: item.edgeProfiles,
      shape: "puzzle",
      color: colors[(item.r * cfg.cols + item.c) % colors.length]
    }));
    const links = [];
    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols - 1; c++) links.push({ source: `p_${r}_${c}`, target: `p_${r}_${c + 1}` });
    }
    for (let r = 0; r < cfg.rows - 1; r++) {
      for (let c = 0; c < cfg.cols; c++) links.push({ source: `p_${r}_${c}`, target: `p_${r + 1}_${c}` });
    }
    graphData = { nodes, links };
  }

  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];
  const cols = Math.max(1, Math.max(...nodes.map(n => n.c ?? 0)) + 1);
  const rows = Math.max(1, Math.max(...nodes.map(n => n.r ?? 0)) + 1);
  let isAssembled = false;
  let width = targetEl.getBoundingClientRect().width || 600;
  const height = cfg.height || targetEl.getBoundingClientRect().height || 350;
  let frameId = null;

  targetEl.style.setProperty("min-height", `${height}px`);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
  camera.position.set(0, 0, 900);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearAlpha(0);
  renderer.domElement.className = "w-100 d-block";
  targetEl.appendChild(renderer.domElement);

  const overlay = document.createElement("div");
  overlay.style.setProperty("position", "absolute");
  overlay.style.setProperty("inset", "0");
  overlay.style.setProperty("overflow", "hidden");
  overlay.style.setProperty("pointer-events", "none");
  targetEl.appendChild(overlay);

  const ambient = new THREE.AmbientLight(new THREE.Color(resolveCssValue("var(--sol-base2)") || SOL_FALLBACKS.base2), 1.2);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(new THREE.Color(resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3), 2.5);
  key.position.set(-120, 160, 300);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(resolveCssValue("var(--sol-cyan)") || SOL_FALLBACKS.cyan), 0.7);
  rim.position.set(180, -140, 220);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);
  const meshById = new Map();
  const labels = [];
  const lines = [];

  function randomSpreadPosition(index) {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2;
    const radius = cfg.nodeSize * Math.max(cols, rows) * 0.9;
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, (Math.random() - 0.5) * cfg.nodeSize * 0.35);
  }

  function assembledPosition(node) {
    const spacing = cfg.nodeSize * 1.02;
    return new THREE.Vector3((node.c - (cols - 1) / 2) * spacing, -((node.r - (rows - 1) / 2) * spacing), 0);
  }

  nodes.forEach((node, index) => {
    const size = node.size || cfg.nodeSize;
    const color = resolveCssValue(node.color || cfg.nodeBg) || SOL_FALLBACKS.blue;
    const geometry = geometryForPieceNode(node, size, size * 0.22, cfg.pointStride);
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.72, metalness: 0.04 });
    const mesh = new THREE.Mesh(geometry, material);
    const start = cfg.isPuzzle ? randomSpreadPosition(index) : randomSpreadPosition(index);
    mesh.position.copy(start);
    mesh.rotation.set((Math.random() - 0.5) * 0.65, (Math.random() - 0.5) * 0.65, (Math.random() - 0.5) * 0.5);
    mesh.userData = { node, phase: Math.random() * Math.PI * 2, baseRotation: mesh.rotation.clone() };
    group.add(mesh);
    meshById.set(node.id, mesh);

    const label = makeOverlayLabel(node.label || node.id, resolveCssValue(node.textColor || cfg.nodeText) || SOL_FALLBACKS.base3, cfg.fontSize);
    overlay.appendChild(label);
    labels.push({ element: label, mesh, offset: new THREE.Vector3(0, 0, size * 0.25) });
  });

  links.forEach(link => {
    const sourceId = typeof link.source === "object" ? link.source.id : link.source;
    const targetId = typeof link.target === "object" ? link.target.id : link.target;
    const source = meshById.get(sourceId);
    const target = meshById.get(targetId);
    if (!source || !target) return;
    const geometry = new THREE.BufferGeometry().setFromPoints([source.position.clone(), target.position.clone()]);
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color(resolveCssValue("var(--sol-base1)") || SOL_FALLBACKS.base1), transparent: true, opacity: 0.45 });
    const line = new THREE.Line(geometry, material);
    group.add(line);
    lines.push({ line, source, target });
  });

  function updateLines() {
    lines.forEach(({ line, source, target }) => {
      line.geometry.setFromPoints([source.position.clone(), target.position.clone()]);
      line.geometry.attributes.position.needsUpdate = true;
    });
  }

  function layoutTargets() {
    nodes.forEach((node, index) => {
      const mesh = meshById.get(node.id);
      if (!mesh) return;
      mesh.userData.target = isAssembled && node.r !== undefined && node.c !== undefined
        ? assembledPosition(node)
        : randomSpreadPosition(index);
    });
  }
  layoutTargets();

  function resize() {
    width = targetEl.getBoundingClientRect().width || width || 600;
    renderer.setSize(width, height);
    const aspect = width / height;
    const cameraScale = Math.max(0.55, Math.min(1.75, cfg.cameraDistance / 180));
    const viewHeight = cfg.nodeSize * Math.max(rows * 1.8, cols / aspect * 1.6, 5) * cameraScale;
    const viewWidth = viewHeight * aspect;
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
  }

  function applyLighting() {
    ambient.intensity = 0.75 + Math.max(0.05, Math.min(0.8, cfg.ambientLight)) * 1.6;
    const [lx, ly, lz] = cfg.lightDirection || [-0.3, -0.4, 0.85];
    key.position.set(lx * 400, ly * 400, Math.max(0.2, lz) * 400);
  }

  function updateLabels() {
    labels.forEach(({ element, mesh, offset }) => {
      const screen = projectOverlay(mesh.position.clone().add(offset), camera, width, height);
      element.style.setProperty("transform", `translate(${screen.x}px, ${screen.y}px) translate(-50%, -50%)`);
      element.style.setProperty("display", screen.visible ? "block" : "none");
    });
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(targetEl);
  applyLighting();
  resize();

  function animate(time = 0) {
    const t = time * 0.001;
    group.children.forEach(child => {
      if (!child.isMesh) return;
      const target = child.userData.target || child.position;
      child.position.lerp(target, 0.08);
      const phase = child.userData.phase || 0;
      const base = child.userData.baseRotation;
      child.rotation.x = base.x + Math.sin(t * cfg.rotationSpeed * 0.7 + phase) * 0.035;
      child.rotation.y = base.y + Math.cos(t * cfg.rotationSpeed * 0.6 + phase) * 0.035;
      child.rotation.z = base.z + Math.sin(t * cfg.rotationSpeed * 0.35 + phase) * 0.018;
    });
    updateLines();
    renderer.render(scene, camera);
    updateLabels();
    frameId = requestAnimationFrame(animate);
  }
  frameId = requestAnimationFrame(animate);

  const graph = {
    assemble() {
      isAssembled = true;
      layoutTargets();
    },
    disassemble() {
      isAssembled = false;
      layoutTargets();
    },
    isAssembled() {
      return isAssembled;
    },
    updateOptions(newOpts = {}) {
      Object.assign(cfg, newOpts);
      applyLighting();
      resize();
    },
    destroy() {
      if (frameId) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      disposeThreeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      overlay.remove();
      targetEl.innerHTML = "";
    }
  };

  if (cfg.onNodeClick) {
    renderer.domElement.addEventListener("click", event => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = camera.left + ((event.clientX - rect.left) / Math.max(1, rect.width)) * (camera.right - camera.left);
      const y = camera.top - ((event.clientY - rect.top) / Math.max(1, rect.height)) * (camera.top - camera.bottom);
      const nearest = nodes
        .map(node => ({ node, mesh: meshById.get(node.id) }))
        .filter(item => item.mesh)
        .map(item => ({ ...item, d: Math.hypot(item.mesh.position.x - x, item.mesh.position.y - y) }))
        .sort((a, b) => a.d - b.d)[0];
      if (nearest && nearest.d <= cfg.nodeSize * 0.8) cfg.onNodeClick(nearest.node, event);
    });
  }

  return graph;
}
