// ==========================================
// attention-token-graph.js - Carte d'attention en puzzle WebGL
// ==========================================
import * as THREE from "https://esm.sh/three@0.160.0?bundle";
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

function attentionColor(weight = 0) {
  const t = Math.max(0, Math.min(1, (weight - 0.05) / 0.4));
  return interpolateHexColor(SOL_FALLBACKS.green, SOL_FALLBACKS.red, t);
}

function makePuzzleShape(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, -y);
    else shape.lineTo(x, -y);
  });
  shape.closePath();
  return shape;
}

function simplifyPoints(points, stride = 5) {
  if (stride <= 1 || points.length < 24) return points;
  const simplified = points.filter((_, index) => index % stride === 0);
  return simplified.length >= 12 ? simplified : points;
}

function makeDomLabel(text, { color, size, backgroundColor = null }) {
  const label = document.createElement("div");
  label.textContent = text;
  label.style.setProperty("position", "absolute");
  label.style.setProperty("left", "0");
  label.style.setProperty("top", "0");
  label.style.setProperty("transform", "translate(-50%, -50%)");
  label.style.setProperty("padding", "0.12rem 0.35rem");
  label.style.setProperty("border-radius", "999px");
  label.style.setProperty("font-family", resolveCssValue("var(--font-code)") || "Consolas, monospace");
  label.style.setProperty("font-size", `${size}px`);
  label.style.setProperty("font-weight", "700");
  label.style.setProperty("line-height", "1.1");
  label.style.setProperty("pointer-events", "none");
  label.style.setProperty("white-space", "pre");
  label.style.setProperty("color", color);
  if (backgroundColor) label.style.setProperty("background-color", backgroundColor);
  return label;
}

function projectToOverlay(position, camera, width, height) {
  const projected = position.clone().project(camera);
  return {
    x: (projected.x * 0.5 + 0.5) * width,
    y: (-projected.y * 0.5 + 0.5) * height,
    visible: projected.z >= -1 && projected.z <= 1
  };
}

function disposeObject(object) {
  object.traverse(child => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach(material => material.dispose?.());
  });
}

function colorLinearNodes(count) {
  const palette = [
    "var(--sol-blue)", "var(--sol-cyan)", "var(--sol-green)",
    "var(--sol-yellow)", "var(--sol-orange)", "var(--sol-magenta)", "var(--sol-violet)"
  ];
  const result = [];
  for (let i = 0; i < count; i++) {
    const forbidden = i > 0 ? new Set([result[i - 1]]) : new Set();
    const available = palette.filter(c => !forbidden.has(c));
    let best = available[0];
    let maxDist = -1;
    for (const c of available) {
      const last = result.lastIndexOf(c);
      const dist = last === -1 ? Infinity : i - last;
      if (dist > maxDist) { maxDist = dist; best = c; }
    }
    result.push(best);
  }
  return result;
}

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
  const pieceSize = options.pieceSize ?? 1;
  const pieceDepth = options.pieceDepth ?? 0.16;
  const height = options.height ?? Math.max(targetEl.getBoundingClientRect().height || 0, 440);
  const nodeColors = colorLinearNodes(tokens.length);
  let activeIndex = Math.max(0, tokens.indexOf(options.activeToken || "mange"));
  let mode = options.mode || "assembled";
  let frameId = null;
  let width = targetEl.getBoundingClientRect().width || 720;

  targetEl.style.setProperty("min-height", `${height}px`);
  targetEl.style.setProperty("position", "relative");

  const controls = document.createElement("div");
  controls.className = "d-flex justify-content-end gap-2 mb-2";
  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "btn btn-sm btn-outline-primary";
  controls.appendChild(toggleButton);

  const graphHost = document.createElement("div");
  graphHost.className = "w-100";
  graphHost.setAttribute("role", "img");
  graphHost.setAttribute("aria-label", "Carte d'attention interactive en pièces de puzzle 3D");
  graphHost.style.setProperty("height", `${height}px`);
  graphHost.style.setProperty("position", "relative");
  targetEl.appendChild(controls);
  targetEl.appendChild(graphHost);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearAlpha(0);
  renderer.domElement.className = "w-100 d-block";
  graphHost.appendChild(renderer.domElement);

  const overlay = document.createElement("div");
  overlay.style.setProperty("position", "absolute");
  overlay.style.setProperty("inset", "0");
  overlay.style.setProperty("overflow", "hidden");
  overlay.style.setProperty("pointer-events", "none");
  graphHost.appendChild(overlay);

  scene.add(new THREE.AmbientLight(new THREE.Color(resolveCssValue("var(--sol-base2)") || SOL_FALLBACKS.base2), 1.45));
  const key = new THREE.DirectionalLight(new THREE.Color(resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3), 2.7);
  key.position.set(-3, 4, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(resolveCssValue("var(--sol-cyan)") || SOL_FALLBACKS.cyan), 0.65);
  rim.position.set(4, -3, 5);
  scene.add(rim);

  const board = new THREE.Group();
  scene.add(board);
  const grid = generatePuzzleGrid(1, tokens.length);
  const nodes = tokens.map((token, index) => ({
    id: token,
    label: token,
    index,
    color: nodeColors[index],
    edges: grid[index]?.edges || [0, 1, 0, -1],
    edgeProfiles: grid[index]?.edgeProfiles || [],
    phase: Math.random() * Math.PI * 2,
    baseRx: (Math.random() - 0.5) * 0.16,
    baseRy: (Math.random() - 0.5) * 0.16,
    baseRz: (Math.random() - 0.5) * 0.14
  }));
  const labels = [];
  const lines = [];

  nodes.forEach(node => {
    const shape = makePuzzleShape(simplifyPoints(generatePuzzlePieceShape(pieceSize, node.edges, node.edgeProfiles), 5));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: pieceDepth, bevelEnabled: false, curveSegments: 1 });
    geometry.center();
    const color = resolveCssValue(node.color) || SOL_FALLBACKS.blue;
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.72, metalness: 0.04 }));
    mesh.rotation.set(node.baseRx, node.baseRy, node.baseRz);
    mesh.userData = { node, baseRotation: mesh.rotation.clone() };
    board.add(mesh);
    node.mesh = mesh;

    const label = makeDomLabel(node.label, {
      color: resolveCssValue("var(--sol-base03)") || SOL_FALLBACKS.base03,
      size: 14,
      backgroundColor: resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3
    });
    overlay.appendChild(label);
    labels.push({ element: label, node, offset: new THREE.Vector3(0, 0.06, 0.28) });
  });

  function linksForActive() {
    return matrix[activeIndex]
      .map((weight, index) => ({ weight, index }))
      .filter(({ index }) => index !== activeIndex)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, maxLinks)
      .map(({ weight, index }) => ({ source: nodes[activeIndex], target: nodes[index], weight, label: `${Math.round(weight * 100)}%` }))
      .concat([{ source: nodes[activeIndex], target: nodes[activeIndex], weight: matrix[activeIndex][activeIndex], label: `${Math.round(matrix[activeIndex][activeIndex] * 100)}%`, self: true }]);
  }

  function getCircleRadius() {
    return options.radius ?? (nodes.length / (2 * Math.PI)) * pieceSize * 1.3;
  }

  function applyPositions() {
    if (mode === "assembled") {
      nodes.forEach((node, index) => {
        node.target = new THREE.Vector3((index - (nodes.length - 1) / 2) * pieceSize * 0.96, 0, 0);
      });
      return;
    }
    const radius = getCircleRadius();
    nodes.forEach((node, index) => {
      const angle = -Math.PI / 2 + (index / nodes.length) * Math.PI * 2;
      node.target = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    });
  }

  function clearLines() {
    lines.forEach(({ line, label }) => {
      line.geometry.dispose();
      line.material.dispose();
      board.remove(line);
      label?.remove();
    });
    lines.length = 0;
  }

  function rebuildLines() {
    clearLines();
    if (mode !== "circle") return;
    linksForActive().forEach(link => {
      const color = attentionColor(link.weight);
      const geometry = new THREE.BufferGeometry().setFromPoints([
        link.source.mesh.position.clone().setZ(0.3),
        link.target.mesh.position.clone().setZ(0.3)
      ]);
      const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.72 });
      const line = new THREE.Line(geometry, material);
      board.add(line);
      const label = makeDomLabel(link.self ? `self ${link.label}` : link.label, {
        color,
        size: 11,
        backgroundColor: resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3
      });
      overlay.appendChild(label);
      lines.push({ line, source: link.source, target: link.target, label, weight: link.weight, self: link.self });
    });
  }

  function refresh() {
    toggleButton.textContent = mode === "assembled" ? "Désassembler" : "Assembler";
    nodes.forEach(node => {
      const isActive = node.index === activeIndex;
      const color = resolveCssValue(isActive ? "var(--sol-yellow)" : node.color) || SOL_FALLBACKS.blue;
      node.mesh.material.color.set(color);
    });
    applyPositions();
    rebuildLines();
  }

  function resize() {
    width = graphHost.getBoundingClientRect().width || width || 720;
    renderer.setSize(width, height);
    const aspect = width / height;
    let viewWidth, viewHeight;
    if (mode === "assembled") {
      viewWidth = nodes.length * pieceSize * 1.08 + pieceSize * 0.6;
      viewHeight = viewWidth / aspect;
      if (viewHeight < pieceSize * 2.4) { viewHeight = pieceSize * 2.4; viewWidth = viewHeight * aspect; }
    } else {
      const r = getCircleRadius();
      viewHeight = (r + pieceSize * 0.9) * 2.3;
      viewWidth = viewHeight * aspect;
    }
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
  }

  function updateDomLabels() {
    labels.forEach(({ element, node, offset }) => {
      const screen = projectToOverlay(node.mesh.position.clone().add(offset), camera, width, height);
      element.style.setProperty("transform", `translate(${screen.x}px, ${screen.y}px) translate(-50%, -50%)`);
      element.style.setProperty("display", screen.visible ? "block" : "none");
    });
    lines.forEach(({ label, source, target, self }) => {
      if (!label) return;
      const pos = self
        ? source.mesh.position.clone().add(new THREE.Vector3(0, pieceSize * 0.58, 0.42))
        : source.mesh.position.clone().add(target.mesh.position).multiplyScalar(0.5).setZ(0.42);
      const screen = projectToOverlay(pos, camera, width, height);
      label.style.setProperty("transform", `translate(${screen.x}px, ${screen.y}px) translate(-50%, -50%)`);
      label.style.setProperty("display", screen.visible ? "block" : "none");
    });
  }

  function updateLineGeometry() {
    lines.forEach(({ line, source, target, self }) => {
      if (self) {
        line.geometry.setFromPoints([
          source.mesh.position.clone().add(new THREE.Vector3(-pieceSize * 0.22, pieceSize * 0.36, 0.3)),
          source.mesh.position.clone().add(new THREE.Vector3(pieceSize * 0.22, pieceSize * 0.36, 0.3))
        ]);
      } else {
        line.geometry.setFromPoints([source.mesh.position.clone().setZ(0.3), target.mesh.position.clone().setZ(0.3)]);
      }
      line.geometry.attributes.position.needsUpdate = true;
    });
  }

  const resizeObserver = new ResizeObserver(() => {
    resize();
    updateDomLabels();
  });
  resizeObserver.observe(graphHost);
  applyPositions();
  refresh();
  resize();

  function animate(time = 0) {
    const t = time * 0.001;
    nodes.forEach(node => {
      node.mesh.position.lerp(node.target, 0.12);
      const base = node.mesh.userData.baseRotation;
      node.mesh.rotation.x = base.x + Math.sin(t * 0.45 + node.phase) * 0.018;
      node.mesh.rotation.y = base.y + Math.cos(t * 0.4 + node.phase) * 0.018;
      node.mesh.rotation.z = base.z;
    });
    updateLineGeometry();
    renderer.render(scene, camera);
    updateDomLabels();
    frameId = requestAnimationFrame(animate);
  }
  frameId = requestAnimationFrame(animate);

  function selectNearest(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = camera.left + ((event.clientX - rect.left) / Math.max(1, rect.width)) * (camera.right - camera.left);
    const y = camera.top - ((event.clientY - rect.top) / Math.max(1, rect.height)) * (camera.top - camera.bottom);
    const nearest = nodes
      .map(node => ({ node, distance: Math.hypot(node.mesh.position.x - x, node.mesh.position.y - y) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (event.type === "pointermove") {
      renderer.domElement.style.setProperty("cursor", nearest?.distance <= pieceSize * 0.75 ? "pointer" : "default");
      return;
    }
    if (nearest?.distance <= pieceSize * 0.75) {
      activeIndex = nearest.node.index;
      mode = "circle";
      refresh();
      resize();
    }
  }

  renderer.domElement.addEventListener("pointermove", selectNearest);
  renderer.domElement.addEventListener("click", selectNearest);
  toggleButton.addEventListener("click", () => {
    mode = mode === "assembled" ? "circle" : "assembled";
    refresh();
    resize();
  });

  const api = {
    assemble() {
      mode = "assembled";
      refresh();
      resize();
    },
    disassemble() {
      mode = "circle";
      refresh();
      resize();
    },
    destroy() {
      if (frameId) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", selectNearest);
      renderer.domElement.removeEventListener("click", selectNearest);
      clearLines();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      overlay.remove();
      controls.remove();
      graphHost.remove();
    }
  };

  if (invalidation && typeof invalidation.then === "function") invalidation.then(() => api.destroy());
  return api;
}
