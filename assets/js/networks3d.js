// ==========================================
// networks3d.js - Primitives 3D et Puzzle
// ==========================================
import ForceGraph from "https://esm.sh/force-graph";
import { resolveCssValue, utils } from "./core.js";
import { SOL_FALLBACKS, drawRoundedRect } from "./networks.js";

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

/**
 * Creates a 3D rotating node force graph on a 2D Canvas context.
 */
export function create3DPieceGraph(container, graphData, options = {}) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) {
    console.warn("create3DPieceGraph: Target container not found.", container);
    return null;
  }
  targetEl.innerHTML = "";

  const defaultOptions = {
    nodeSize: 34,
    nodeBg: "var(--sol-blue)",
    nodeBorder: "var(--sol-base02)",
    nodeText: "var(--sol-base3)",
    fontSize: 10,
    fontFamily: "var(--font-code, Consolas, monospace)",
    linkWidth: 1.5,
    cooldownTicks: Infinity,
    cameraDistance: 180,
    lightDirection: [-0.3, -0.4, 0.85],
    ambientLight: 0.3,
    rotationSpeed: 1.0,
    isPuzzle: false,
    rows: 3,
    cols: 3,
    onNodeClick: null
  };
  const cfg = { ...defaultOptions, ...options };

  // Light Vector setup
  let lx, ly, lz, lLength, normLx, normLy, normLz;
  function updateLight() {
    lx = cfg.lightDirection[0];
    ly = cfg.lightDirection[1];
    lz = cfg.lightDirection[2];
    lLength = Math.sqrt(lx*lx + ly*ly + lz*lz);
    normLx = lx / lLength;
    normLy = ly / lLength;
    normLz = lz / lLength;
  }
  updateLight();

  let isAssembled = false;

  // 1. Generate Puzzle Grid if requested
  if (cfg.isPuzzle && (!graphData || !graphData.nodes || graphData.nodes.length === 0)) {
    const rows = cfg.rows;
    const cols = cfg.cols;
    const gridData = generatePuzzleGrid(rows, cols);

    const colors = [
      "var(--sol-blue)",
      "var(--sol-cyan)",
      "var(--sol-green)",
      "var(--sol-yellow)",
      "var(--sol-orange)",
      "var(--sol-magenta)",
      "var(--sol-violet)"
    ];

    const nodes = gridData.map(item => {
      const id = `p_${item.r}_${item.c}`;
      const colorIdx = (item.r * cols + item.c) % colors.length;
      return {
        id,
        label: `${item.r + 1},${item.c + 1}`,
        r: item.r,
        c: item.c,
        edges: item.edges,
        edgeProfiles: item.edgeProfiles,
        shape: "puzzle",
        color: colors[colorIdx]
      };
    });

    const links = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        links.push({ source: `p_${r}_${c}`, target: `p_${r}_${c + 1}` });
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        links.push({ source: `p_${r}_${c}`, target: `p_${r + 1}_${c}` });
      }
    }

    graphData = { nodes, links };
  }

  const cols = Math.max(...graphData.nodes.map(n => n.c ?? 0)) + 1;
  const rows = Math.max(...graphData.nodes.map(n => n.r ?? 0)) + 1;

  // 2. Prepare nodes 3D meshes & rotations
  graphData.nodes.forEach(node => {
    node.rx = Math.random() * 2 * Math.PI;
    node.ry = Math.random() * 2 * Math.PI;
    node.rz = Math.random() * 2 * Math.PI;

    node.drx = (Math.random() * 0.015 + 0.005) * cfg.rotationSpeed * (Math.random() < 0.5 ? 1 : -1);
    node.dry = (Math.random() * 0.015 + 0.005) * cfg.rotationSpeed * (Math.random() < 0.5 ? 1 : -1);
    node.drz = (Math.random() * 0.01 + 0.002) * cfg.rotationSpeed * (Math.random() < 0.5 ? 1 : -1);

    const size = node.size || cfg.nodeSize;
    node.model3d = get3DModel(node, size);
  });

  function get3DModel(node, size) {
    if (node.svgPath) {
      const sampled = sampleSvgPath(node.svgPath, 36);
      const scaled = centerAndScalePoints(sampled, size);
      return extrudePolygon(scaled, size * 0.35);
    }

    switch (node.shape) {
      case "cube":
        const half = size / 2;
        return {
          vertices: [
            [-half, -half, -half], [half, -half, -half], [half, half, -half], [-half, half, -half],
            [-half, -half, half], [half, -half, half], [half, half, half], [-half, half, half]
          ],
          faces: [
            [4, 5, 6, 7], // Front
            [1, 0, 3, 2], // Back
            [0, 1, 5, 4], // Top
            [3, 7, 6, 2], // Bottom
            [0, 4, 7, 3], // Left
            [1, 2, 6, 5]  // Right
          ]
        };
      case "tetrahedron":
        const s = size * 0.65;
        return {
          vertices: [
            [s, s, s], [-s, -s, s], [-s, s, -s], [s, -s, -s]
          ],
          faces: [
            [0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]
          ]
        };
      case "star":
        return extrudePolygon(generateStar2D(5, size * 0.22, size * 0.5), size * 0.35);
      case "gear":
        return extrudePolygon(generateGear2D(8, size * 0.35, size * 0.5), size * 0.35);
      case "puzzle":
        return extrudePolygon(generatePuzzlePieceShape(size, node.edges || [1, -1, 1, -1], node.edgeProfiles), size * 0.32);
      case "cylinder":
      case "disk":
        return extrudePolygon(generateRegularPolygon2D(18, size * 0.5), size * 0.35);
      case "hexagon":
        return extrudePolygon(generateRegularPolygon2D(6, size * 0.5), size * 0.35);
      default:
        return extrudePolygon(generateRegularPolygon2D(16, size * 0.5), size * 0.35);
    }
  }

  // 3. Initialize ForceGraph
  const graph = ForceGraph()(targetEl)
    .graphData(graphData)
    .backgroundColor('transparent')
    .cooldownTicks(cfg.cooldownTicks)
    .linkWidth(cfg.linkWidth)
    .linkColor(() => isAssembled ? "transparent" : (resolveCssValue("var(--sol-base1)") || SOL_FALLBACKS.base1))
    .linkDirectionalArrowLength(() => isAssembled ? 0 : 4)
    .linkDirectionalArrowRelPos(1);

  const containerRect = targetEl.getBoundingClientRect();
  graph.width(cfg.width || containerRect.width || 600);
  graph.height(cfg.height || containerRect.height || 350);

  graph.d3Force('charge').strength(-cfg.nodeSize * 9);
  graph.d3Force('link')?.distance(cfg.nodeSize * 3.5);

  // Custom Node 3D Canvas drawing
  graph.nodeCanvasObject((node, ctx, globalScale) => {
    // 1. Update rotations
    if (isAssembled) {
      node.rx = normalizeAngle(node.rx) * 0.8;
      node.ry = normalizeAngle(node.ry) * 0.8;
      node.rz = normalizeAngle(node.rz) * 0.8;

      if (Math.abs(node.rx) < 0.001) node.rx = 0;
      if (Math.abs(node.ry) < 0.001) node.ry = 0;
      if (Math.abs(node.rz) < 0.001) node.rz = 0;
    } else {
      const vx = node.vx || 0;
      const vy = node.vy || 0;
      const speedScale = 0.002;

      node.rx = (node.rx + (node.drx || 0.01) + vy * speedScale) % (2 * Math.PI);
      node.ry = (node.ry + (node.dry || 0.015) + vx * speedScale) % (2 * Math.PI);
      node.rz = (node.rz + (node.drz || 0.005) + (vx + vy) * 0.5 * speedScale) % (2 * Math.PI);
    }

    // 2. Rotate all vertices in 3D
    const cosX = Math.cos(node.rx), sinX = Math.sin(node.rx);
    const cosY = Math.cos(node.ry), sinY = Math.sin(node.ry);
    const cosZ = Math.cos(node.rz), sinZ = Math.sin(node.rz);

    const rotatedVertices = node.model3d.vertices.map(v => {
      // Rotation X
      let x1 = v[0];
      let y1 = v[1] * cosX - v[2] * sinX;
      let z1 = v[1] * sinX + v[2] * cosX;

      // Rotation Y
      let x2 = x1 * cosY + z1 * sinY;
      let y2 = y1;
      let z2 = -x1 * sinY + z1 * cosY;

      // Rotation Z
      let x3 = x2 * cosZ - y2 * sinZ;
      let y3 = x2 * sinZ + y2 * cosZ;
      let z3 = z2;

      return [x3, y3, z3];
    });

    // 3. Prepare face data (normal and center Z for depth sorting)
    const facesData = node.model3d.faces.map((faceIndices, faceIndex) => {
      const faceVertices = faceIndices.map(idx => rotatedVertices[idx]);
      const [normNx, normNy, normNz] = computeFaceNormal3D(faceVertices);

      let centerZ = 0;
      faceVertices.forEach(v => centerZ += v[2]);
      centerZ /= faceVertices.length;

      return {
        faceIndex,
        isCap: faceIndex < 2,
        indices: faceIndices,
        vertices: faceVertices,
        normal: [normNx, normNy, normNz],
        centerZ: centerZ
      };
    });

    // 4. Stable rendering order.
    // Puzzle pieces create many tiny side faces; keep their order stable, but do not draw back faces.
    const sideFaces = facesData
      .filter(f => !f.isCap && f.normal[2] > -0.08)
      .sort((a, b) => a.faceIndex - b.faceIndex);
    const capFaces = facesData
      .filter(f => f.isCap && f.normal[2] > -0.08)
      .sort((a, b) => {
      const depthA = a.centerZ + (a.isCap ? 0.02 : 0);
      const depthB = b.centerZ + (b.isCap ? 0.02 : 0);
      if (Math.abs(depthA - depthB) > 0.0001) return depthA - depthB;
      return a.faceIndex - b.faceIndex;
    });
    const visibleFaces = [...sideFaces, ...capFaces];

    const baseColor = node.color || cfg.nodeBg;
    const borderColor = node.borderColor || cfg.nodeBorder;

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // 5. Draw each visible face
    visibleFaces.forEach(face => {
      const dot = face.normal[0] * normLx + face.normal[1] * normLy + face.normal[2] * normLz;
      const intensity = cfg.ambientLight + (1 - cfg.ambientLight) * Math.max(0, dot);

      // Project using perspective focal length
      const projected = face.vertices.map(v => {
        const d = cfg.cameraDistance;
        const scale = d / (d - v[2]);
        return [
          node.x + v[0] * scale,
          node.y + v[1] * scale
        ];
      });

      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      for (let i = 1; i < projected.length; i++) {
        ctx.lineTo(projected[i][0], projected[i][1]);
      }
      ctx.closePath();

      ctx.fillStyle = shadeColor(baseColor, intensity);
      ctx.fill();

      if (face.isCap) {
        ctx.strokeStyle = resolveCssValue(borderColor) || borderColor;
        ctx.lineWidth = 0.6 / globalScale;
        ctx.stroke();
      }
    });

    // 6. Draw Label text over the piece
    if (node.label && !isAssembled) {
      const fSize = cfg.fontSize / globalScale;
      ctx.font = `bold ${fSize}px ${cfg.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const textWidth = ctx.measureText(node.label).width;
      ctx.fillStyle = utils.rgba(resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3, 0.75);
      drawRoundedRect(ctx, node.x - textWidth/2 - 2, node.y - fSize/2 - 2, textWidth + 4, fSize + 4, 2);
      ctx.fill();

      ctx.fillStyle = resolveCssValue(node.textColor || cfg.nodeText) || cfg.nodeText;
      ctx.fillText(node.label, node.x, node.y);
    }

    ctx.restore();
  });

  // 4. Expose assembly state and controls
  graph.assemble = () => {
    isAssembled = true;
    graphData.nodes.forEach(node => {
      if (node.r !== undefined && node.c !== undefined) {
        node.fx = (node.c - (cols - 1) / 2) * (node.size || cfg.nodeSize);
        node.fy = (node.r - (rows - 1) / 2) * (node.size || cfg.nodeSize);
      }
    });
    graph.d3ReheatSimulation();
  };

  graph.disassemble = () => {
    isAssembled = false;
    graphData.nodes.forEach(node => {
      node.fx = null;
      node.fy = null;

      // Random kick to burst out
      node.vx = (Math.random() - 0.5) * 60;
      node.vy = (Math.random() - 0.5) * 60;

      node.drx = (Math.random() * 0.015 + 0.005) * cfg.rotationSpeed * (Math.random() < 0.5 ? 1 : -1);
      node.dry = (Math.random() * 0.015 + 0.005) * cfg.rotationSpeed * (Math.random() < 0.5 ? 1 : -1);
      node.drz = (Math.random() * 0.01 + 0.002) * cfg.rotationSpeed * (Math.random() < 0.5 ? 1 : -1);
    });
    graph.d3ReheatSimulation();
  };

  graph.isAssembled = () => isAssembled;

  graph.updateOptions = (newOpts) => {
    Object.assign(cfg, newOpts);
    if (newOpts.lightDirection) {
      updateLight();
    }
  };

  if (cfg.onNodeClick) {
    graph.onNodeClick((node, event) => {
      cfg.onNodeClick(node, event);
    });
  }

  return graph;
}

