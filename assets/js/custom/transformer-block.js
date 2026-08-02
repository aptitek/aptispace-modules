import * as THREE from "https://esm.sh/three@0.160.0";
import { resolveCssValue } from "../core.js";
import { SOL_FALLBACKS } from "../networks.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeDomLabel(text, { color = "#fff", size = 11, backgroundColor = "transparent" } = {}) {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "absolute", top: "0", left: "0", pointerEvents: "none",
    color, fontSize: `${size}px`, fontFamily: "var(--font-body, sans-serif)",
    lineHeight: "1.4", whiteSpace: "nowrap", padding: "2px 6px",
    backgroundColor, borderRadius: "3px",
  });
  el.textContent = text;
  return el;
}

function projectToOverlay(pos3d, camera, w, h) {
  const v = pos3d.clone().project(camera);
  return { x: (v.x * 0.5 + 0.5) * w, y: (1 - (v.y * 0.5 + 0.5)) * h, visible: v.z < 1 };
}

function disposeObject(obj) {
  obj.traverse(c => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
      else c.material.dispose();
    }
  });
}

function solColor(name) {
  return new THREE.Color(resolveCssValue(`var(--sol-${name})`) || SOL_FALLBACKS[name] || "#888");
}

function baseScene(targetEl, height, bgName = "base03") {
  const scene    = new THREE.Scene();
  const camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(new THREE.Color(resolveCssValue(`var(--sol-${bgName})`) || SOL_FALLBACKS[bgName]));
  renderer.domElement.className = "w-100 d-block";
  targetEl.appendChild(renderer.domElement);

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
  targetEl.appendChild(overlay);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.position.set(3, 5, 10);
  scene.add(sun);

  return { scene, camera, renderer, overlay };
}

function makeOrthoResize(targetEl, camera, renderer, height, vHFn) {
  let overlayWidth = 1;
  function resize() {
    const w = Math.max(1, targetEl.getBoundingClientRect().width || 800);
    overlayWidth = w;
    renderer.setSize(w, height);
    const aspect = w / height;
    const vH = vHFn();
    camera.left = -(vH * aspect) / 2;  camera.right = (vH * aspect) / 2;
    camera.top  =  vH / 2;             camera.bottom = -vH / 2;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(targetEl);
  resize();
  return { ro, get overlayWidth() { return overlayWidth; } };
}

// ── 1. Stack overview (side profile) ─────────────────────────────────────────

export function createTransformerStackView(container, options = {}, invalidation = null) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) { console.warn("createTransformerStackView: not found", container); return null; }
  targetEl.innerHTML = "";

  const height = options.height ?? Math.max(targetEl.getBoundingClientRect().height || 0, 480);
  Object.assign(targetEl.style, { minHeight: `${height}px`, position: "relative" });

  const { scene, camera, renderer, overlay } = baseScene(targetEl, height);
  const textColor = resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3;
  const labelBg   = "rgba(0,43,54,0.78)";

  const LAYERS = [
    { id: "residual1", label: "⊕ Add & Norm", colorName: "cyan"   },
    { id: "ffn",       label: "⊙ Feed-Forward", colorName: "orange" },
    { id: "residual2", label: "⊕ Add & Norm", colorName: "cyan"   },
    { id: "output",    label: "⊡ Projection",  colorName: "red"    },
  ];

  const slabW = 3.8, slabH = 0.44, slabD = 0.2, gap = 1.15;
  const topY  = ((LAYERS.length - 1) * gap) / 2;

  LAYERS.forEach((layer, i) => {
    layer.y = topY - i * gap;
    const geo = new THREE.BoxGeometry(slabW, slabH, slabD);
    const mat = new THREE.MeshStandardMaterial({
      color: solColor(layer.colorName), roughness: 0.38, metalness: 0.08,
      transparent: true, opacity: 0.84, emissive: new THREE.Color(0, 0, 0)
    });
    layer.mesh = new THREE.Mesh(geo, mat);
    layer.mesh.position.set(0, layer.y, 0);
    layer.mesh.userData.layerId = layer.id;
    scene.add(layer.mesh);
    layer.mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: solColor(layer.colorName), transparent: true, opacity: 0.45 })
    ));
  });

  // Residual bypass lines (left side)
  const bypassMat = () => new THREE.LineBasicMaterial({ color: solColor("green"), transparent: true, opacity: 0.75 });
  const lx = -slabW / 2 - 0.55;

  function addLine(pts) { scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), bypassMat())); }

  // Bypass 1: top → Add&Norm 1
  addLine([new THREE.Vector3(lx, topY + gap * 0.72, 0), new THREE.Vector3(lx, LAYERS[0].y + slabH / 2, 0)]);
  addLine([new THREE.Vector3(lx, LAYERS[0].y, 0), new THREE.Vector3(-slabW / 2 + 0.06, LAYERS[0].y, 0)]);
  // Bypass 2: after norm1 → Add&Norm 2
  addLine([new THREE.Vector3(lx, LAYERS[0].y - slabH / 2, 0), new THREE.Vector3(lx, LAYERS[2].y + slabH / 2, 0)]);
  addLine([new THREE.Vector3(lx, LAYERS[2].y, 0), new THREE.Vector3(-slabW / 2 + 0.06, LAYERS[2].y, 0)]);
  // Merge dots
  [LAYERS[0].y, LAYERS[2].y].forEach(y => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: solColor("green") }));
    dot.position.set(-slabW / 2 + 0.08, y, 0.12);
    scene.add(dot);
  });

  // Main flow line
  const flowMat = new THREE.LineBasicMaterial({ color: new THREE.Color(SOL_FALLBACKS.base1), transparent: true, opacity: 0.4 });
  addLine([new THREE.Vector3(0, topY + gap * 0.75, 0), new THREE.Vector3(0, -topY - gap * 0.75, 0)]);

  // Animated tokens flowing downward
  const TOKEN_COLORS = ["blue","cyan","green","yellow","orange","red","violet"];
  const tokenCount = 7;
  const tokens = TOKEN_COLORS.map((col, i) => {
    const mat  = new THREE.MeshStandardMaterial({ color: solColor(col), emissive: solColor(col), emissiveIntensity: 0.28, roughness: 0.3 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 10), mat);
    const x    = (i - (tokenCount - 1) / 2) * (slabW * 0.76 / tokenCount);
    mesh.position.set(x, topY + gap * 0.5, 0.28);
    scene.add(mesh);
    return { mesh, x, offset: i / tokenCount };
  });

  // Labels
  let ow = 1;
  const labelItems = [];

  LAYERS.forEach(layer => {
    const lbl = makeDomLabel(layer.label, { color: textColor, size: 12, backgroundColor: labelBg });
    overlay.appendChild(lbl);
    labelItems.push({ element: lbl, position: new THREE.Vector3(0, layer.y, slabD / 2 + 0.12) });
  });

  const annotations = [
    { text: "← depuis attention",     pos: new THREE.Vector3(slabW * 0.42, topY + gap * 0.68, 0) },
    { text: "logits →",               pos: new THREE.Vector3(slabW * 0.42, LAYERS[3].y - gap * 0.6, 0) },
    { text: "connexion\nrésiduelle",  pos: new THREE.Vector3(lx - 0.22, (LAYERS[0].y + LAYERS[2].y) / 2, 0) },
  ];
  annotations.forEach(a => {
    const lbl = makeDomLabel(a.text, { color: resolveCssValue("var(--sol-base1)") || SOL_FALLBACKS.base1, size: 10, backgroundColor: labelBg });
    lbl.style.whiteSpace = "pre";
    overlay.appendChild(lbl);
    labelItems.push({ element: lbl, position: a.pos });
  });

  function updateLabels() {
    labelItems.forEach(lbl => {
      const s = projectToOverlay(lbl.position, camera, ow, height);
      lbl.element.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-50%)`;
    });
  }

  // Hover + click for tab switching
  const raycaster = new THREE.Raycaster();
  const pointer   = new THREE.Vector2();
  const onTabSwitch = options.onTabSwitch ?? null;

  function toNDC(e) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  function onMove(e) {
    toNDC(e);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(LAYERS.map(l => l.mesh));
    renderer.domElement.style.cursor = hit.length ? "pointer" : "default";
    LAYERS.forEach(l => { l.mesh.material.emissiveIntensity = (hit.length && hit[0].object === l.mesh) ? 0.35 : 0; });
  }
  function onClick(e) {
    toNDC(e);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(LAYERS.map(l => l.mesh));
    if (hit.length && onTabSwitch) onTabSwitch(hit[0].object.userData.layerId);
  }
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("click", onClick);

  const ref = makeOrthoResize(targetEl, camera, renderer, height, () => LAYERS.length * gap + gap * 1.5);
  ow = ref.overlayWidth;

  let t = 0, frameId = null;
  const totalRange = (LAYERS.length - 1) * gap + gap * 1.5;
  function animate() {
    t += 0.009;
    tokens.forEach(tok => {
      tok.mesh.position.y = topY + gap * 0.72 - ((tok.offset + t * 0.14) % 1) * totalRange;
    });
    renderer.render(scene, camera);
    updateLabels();
    ow = ref.overlayWidth;
    frameId = requestAnimationFrame(animate);
  }
  frameId = requestAnimationFrame(animate);

  const api = {
    destroy() {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("click", onClick);
      ref.ro.disconnect();
      disposeObject(scene);
      renderer.dispose();
      targetEl.innerHTML = "";
    }
  };
  if (invalidation?.then) invalidation.then(() => api.destroy());
  return api;
}

// ── 2. Residual connection demo ───────────────────────────────────────────────

export function createResidualDemo(container, options = {}, invalidation = null) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) return null;
  targetEl.innerHTML = "";

  const height = options.height ?? Math.max(targetEl.getBoundingClientRect().height || 0, 420);
  Object.assign(targetEl.style, { minHeight: `${height}px`, position: "relative" });

  const { scene, camera, renderer, overlay } = baseScene(targetEl, height);
  const textColor = resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3;
  const labelBg   = "rgba(0,43,54,0.78)";

  const TOKEN_COLORS = ["blue","cyan","green","yellow","orange","red","violet"];
  const N = TOKEN_COLORS.length;
  const xs = [-1.6, 0, 1.6]; // x: bypass, processed, merged

  // Vertical guide lines
  const guideMat = new THREE.LineBasicMaterial({ color: new THREE.Color(SOL_FALLBACKS.base02), transparent: true, opacity: 0.5 });
  xs.forEach(x => {
    const pts = [new THREE.Vector3(x, 2, 0), new THREE.Vector3(x, -2, 0)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), guideMat.clone()));
  });

  // Convergence arrow at bottom: both tracks → merged track
  const arrowMat = new THREE.LineBasicMaterial({ color: solColor("green"), transparent: true, opacity: 0.8 });
  const mergeY = -1.4;
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(xs[0], mergeY + 0.3, 0), new THREE.Vector3(xs[2], mergeY, 0)
  ]), arrowMat.clone()));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(xs[1], mergeY + 0.3, 0), new THREE.Vector3(xs[2], mergeY, 0)
  ]), arrowMat.clone()));

  // Plus symbol at merge point
  const plusGeo1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xs[2] - 0.18, mergeY - 0.04, 0.1), new THREE.Vector3(xs[2] + 0.18, mergeY - 0.04, 0.1)]);
  const plusGeo2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(xs[2], mergeY + 0.14, 0.1), new THREE.Vector3(xs[2], mergeY - 0.22, 0.1)]);
  const plusMat  = new THREE.LineBasicMaterial({ color: solColor("green") });
  scene.add(new THREE.Line(plusGeo1, plusMat));
  scene.add(new THREE.Line(plusGeo2, plusMat.clone()));

  // Token particles — 3 tracks
  const allTokens = [];
  TOKEN_COLORS.forEach((col, i) => {
    const yOff = (i / N) - 0.5;

    // Bypass track (transparent ghost)
    const ghostMat = new THREE.MeshStandardMaterial({
      color: solColor(col), transparent: true, opacity: 0.35,
      roughness: 0.3, emissive: solColor(col), emissiveIntensity: 0.2
    });
    const ghost = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), ghostMat);
    ghost.position.set(xs[0], 2, 0.15);
    scene.add(ghost);

    // Processed track (solid, torus = "transformed")
    const procMat = new THREE.MeshStandardMaterial({
      color: solColor(col), roughness: 0.32, metalness: 0.12,
      emissive: solColor(col), emissiveIntensity: 0.25
    });
    const proc = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 16), procMat);
    proc.position.set(xs[1], 2, 0.15);
    scene.add(proc);

    // Merged track (larger sphere)
    const mergedMat = new THREE.MeshStandardMaterial({
      color: solColor(col), roughness: 0.28, emissive: solColor(col), emissiveIntensity: 0.35
    });
    const merged = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 12), mergedMat);
    merged.position.set(xs[2], 2, 0.15);
    scene.add(merged);

    allTokens.push({ ghost, proc, merged, offset: i / N });
  });

  // Labels
  let ow = 1;
  const labelItems = [];
  [
    { text: "x\n(entrée)",                pos: new THREE.Vector3(xs[0], 2.2, 0) },
    { text: "attention(x)\n(transformé)", pos: new THREE.Vector3(xs[1], 2.2, 0) },
    { text: "x + attention(x)\n(sortie)", pos: new THREE.Vector3(xs[2], 2.2, 0) },
  ].forEach(a => {
    const lbl = makeDomLabel(a.text, { color: textColor, size: 11, backgroundColor: labelBg });
    lbl.style.whiteSpace = "pre";
    overlay.appendChild(lbl);
    labelItems.push({ element: lbl, position: a.pos });
  });

  function updateLabels() {
    labelItems.forEach(lbl => {
      const s = projectToOverlay(lbl.position, camera, ow, height);
      lbl.element.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;
    });
  }

  const { ro } = makeOrthoResize(targetEl, camera, renderer, height, () => 5.5);
  ow = targetEl.getBoundingClientRect().width || 800;

  let t = 0, frameId = null;
  function animate() {
    t += 0.009;
    allTokens.forEach(tok => {
      const y = 2 - ((tok.offset + t * 0.15) % 1) * 5.2;
      tok.ghost.position.y  = y;
      tok.proc.position.y   = y;
      tok.proc.rotation.y  += 0.04;
      // Merged only shows near bottom
      tok.merged.position.y = y < mergeY ? mergeY - 0.4 + ((tok.offset + t * 0.15 - 0.82) % 1) * 2.8
                                          : 999;
    });
    renderer.render(scene, camera);
    updateLabels();
    ow = targetEl.getBoundingClientRect().width || 800;
    frameId = requestAnimationFrame(animate);
  }
  frameId = requestAnimationFrame(animate);

  const api = {
    destroy() { cancelAnimationFrame(frameId); ro.disconnect(); disposeObject(scene); renderer.dispose(); targetEl.innerHTML = ""; }
  };
  if (invalidation?.then) invalidation.then(() => api.destroy());
  return api;
}

// ── 3. LayerNorm iris ──────────────────────────────────────────────────────────

function makeIrisGeo(outerR, innerR) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, Math.max(0.02, innerR), 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape, 64);
}

export function createLayernormIris(container, options = {}, invalidation = null) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) return null;
  targetEl.innerHTML = "";

  const height = options.height ?? Math.max(targetEl.getBoundingClientRect().height || 0, 440);
  Object.assign(targetEl.style, { minHeight: `${height}px`, position: "relative" });

  const { scene, camera, renderer, overlay } = baseScene(targetEl, height);
  const textColor = resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3;
  const labelBg   = "rgba(0,43,54,0.78)";

  const TOKEN_COLORS = ["blue","cyan","green","yellow","orange","red","violet"];
  const N = TOKEN_COLORS.length;
  const outerR = 1.1;

  // Iris geometry (ring with hole)
  const irisMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(resolveCssValue("var(--sol-base02)") || SOL_FALLBACKS.base02),
    roughness: 0.35, metalness: 0.65, side: THREE.DoubleSide
  });
  let openAmount = 0.45; // 0=closed, 1=open
  let irisMesh   = new THREE.Mesh(makeIrisGeo(outerR, openAmount * outerR * 0.88), irisMat);
  irisMesh.position.z = 0.05;
  scene.add(irisMesh);

  // Iris blade decorations (6 lines radiating from inner edge)
  const bladeGroup = new THREE.Group();
  scene.add(bladeGroup);
  const bladeN = 7;
  for (let i = 0; i < bladeN; i++) {
    const a  = (i / bladeN) * Math.PI * 2;
    const r1 = openAmount * outerR * 0.88;
    const r2 = outerR * 0.96;
    const pts = [
      new THREE.Vector3(Math.cos(a) * r1, Math.sin(a) * r1, 0.08),
      new THREE.Vector3(Math.cos(a) * r2, Math.sin(a) * r2, 0.08)
    ];
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: solColor("base01"), transparent: true, opacity: 0.6 })
    );
    bladeGroup.add(line);
  }

  function updateIris(val) {
    openAmount = Math.max(0.05, Math.min(0.95, val));
    irisMesh.geometry.dispose();
    irisMesh.geometry = makeIrisGeo(outerR, openAmount * outerR * 0.88);

    // Update blade lines
    bladeGroup.children.forEach((line, i) => {
      const a  = (i / bladeN) * Math.PI * 2;
      const r1 = openAmount * outerR * 0.88;
      const r2 = outerR * 0.96;
      line.geometry.setFromPoints([
        new THREE.Vector3(Math.cos(a) * r1, Math.sin(a) * r1, 0.08),
        new THREE.Vector3(Math.cos(a) * r2, Math.sin(a) * r2, 0.08)
      ]);
    });
    updateTokens();
  }

  // Input tokens: scattered at various heights (raw activations)
  // They're positioned radially inward, on left side of iris, as small spheres
  const inputGroup  = new THREE.Group();
  const outputGroup = new THREE.Group();
  scene.add(inputGroup);
  scene.add(outputGroup);

  // Input token positions (outside iris, left arc)
  const inputMeshes  = [];
  const outputMeshes = [];

  TOKEN_COLORS.forEach((col, i) => {
    const angle = (-0.6 + 1.2 * (i / (N - 1))) * Math.PI; // spread on left hemisphere
    const spread = (i % 3 === 0 ? 0.22 : i % 3 === 1 ? -0.18 : 0.1); // slight height variation

    const inMat  = new THREE.MeshStandardMaterial({ color: solColor(col), roughness: 0.3, emissive: solColor(col), emissiveIntensity: 0.25 });
    const inMesh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), inMat);
    const inR    = outerR * 1.28 + Math.abs(spread) * 0.6;
    inMesh.position.set(Math.cos(angle) * inR + spread * 0.5, Math.sin(angle) * inR + spread, 0.15);
    inputGroup.add(inMesh);
    inputMeshes.push({ mesh: inMesh, angle, rawSpread: spread });

    // Output tokens (inside iris on right side, normalized = evenly spaced)
    const outMat  = new THREE.MeshStandardMaterial({ color: solColor(col), roughness: 0.3, emissive: solColor(col), emissiveIntensity: 0.3 });
    const outMesh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), outMat);
    const outAngle = -angle; // mirrored
    const outR = outerR * 1.3;
    outMesh.position.set(Math.cos(outAngle) * outR, Math.sin(outAngle) * outR, 0.15);
    outputGroup.add(outMesh);
    outputMeshes.push({ mesh: outMesh, baseAngle: outAngle });
  });

  function updateTokens() {
    // Input: more spread when openAmount is low (normalizing a very spread input)
    const variance = (1 - openAmount) * 0.8 + 0.1;
    inputMeshes.forEach(({ mesh, angle, rawSpread }) => {
      const spread = rawSpread * (1 + variance * 4);
      const inR    = outerR * 1.28 + Math.abs(rawSpread) * 0.6;
      mesh.position.set(Math.cos(angle) * inR + spread * 0.5, Math.sin(angle) * inR + spread, 0.15);
    });
    // Output: always normalized (tight cluster) regardless of input variance
    outputMeshes.forEach(({ mesh, baseAngle }) => {
      const outR = outerR * 1.28 + (1 - openAmount) * 0.05;
      mesh.position.set(Math.cos(baseAngle) * outR, Math.sin(baseAngle) * outR, 0.15);
    });
  }

  // Drag to open/close iris
  let dragging = false, dragStart = null;
  function onDown(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const cx   = e.clientX - rect.left - rect.width / 2;
    const cy   = e.clientY - rect.top  - rect.height / 2;
    const dist = Math.hypot(cx, cy) / (rect.height / (camera.top - camera.bottom));
    if (dist < outerR * 1.1) { dragging = true; dragStart = { y: e.clientY, open: openAmount }; }
  }
  function onMove(e) {
    if (!dragging) { return; }
    renderer.domElement.style.cursor = "ns-resize";
    const dy = (dragStart.y - e.clientY) / 120;
    updateIris(dragStart.open + dy);
  }
  function onUp() { dragging = false; renderer.domElement.style.cursor = ""; }
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointerleave", onUp);

  // Labels
  let ow = 1;
  const labelItems = [];
  [
    { text: "activations\nbrutes",    pos: new THREE.Vector3(-outerR * 1.65, 0, 0) },
    { text: "normalisées\n(μ=0, σ=1)", pos: new THREE.Vector3(outerR * 1.65, 0, 0) },
    { text: "iris de\nnormalisation", pos: new THREE.Vector3(0, -outerR * 1.55, 0) },
    { text: "↕ glisser",             pos: new THREE.Vector3(0.25, outerR * 1.4, 0) },
  ].forEach(a => {
    const lbl = makeDomLabel(a.text, { color: textColor, size: 11, backgroundColor: labelBg });
    lbl.style.whiteSpace = "pre";
    overlay.appendChild(lbl);
    labelItems.push({ element: lbl, position: a.pos });
  });

  function updateLabels() {
    labelItems.forEach(lbl => {
      const s = projectToOverlay(lbl.position, camera, ow, height);
      lbl.element.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-50%)`;
    });
  }

  const { ro } = makeOrthoResize(targetEl, camera, renderer, height, () => 3.8);
  ow = targetEl.getBoundingClientRect().width || 800;

  let t = 0, frameId = null;
  function animate() {
    t += 0.012;
    irisMesh.rotation.z = t * 0.08;
    bladeGroup.rotation.z = t * 0.08;
    renderer.render(scene, camera);
    updateLabels();
    ow = targetEl.getBoundingClientRect().width || 800;
    frameId = requestAnimationFrame(animate);
  }
  frameId = requestAnimationFrame(animate);
  updateTokens();

  const api = {
    destroy() {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointerleave", onUp);
      ro.disconnect();
      disposeObject(scene);
      renderer.dispose();
      targetEl.innerHTML = "";
    }
  };
  if (invalidation?.then) invalidation.then(() => api.destroy());
  return api;
}

// ── 4. FFN lens ───────────────────────────────────────────────────────────────

export function createFfnLens(container, options = {}, invalidation = null) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) return null;
  targetEl.innerHTML = "";

  const height = options.height ?? Math.max(targetEl.getBoundingClientRect().height || 0, 440);
  Object.assign(targetEl.style, { minHeight: `${height}px`, position: "relative" });

  const { scene, camera, renderer, overlay } = baseScene(targetEl, height);
  const textColor = resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3;
  const labelBg   = "rgba(0,43,54,0.78)";

  const TOKEN_COLORS = ["blue","cyan","green","yellow","orange","red","violet"];
  const N = TOKEN_COLORS.length;
  const spacing = 0.72;
  const tokenXs = TOKEN_COLORS.map((_, i) => (i - (N - 1) / 2) * spacing);

  // Token spheres (compressed representation — one sphere per token)
  const compressedMeshes = TOKEN_COLORS.map((col, i) => {
    const mat  = new THREE.MeshStandardMaterial({ color: solColor(col), roughness: 0.32, emissive: solColor(col), emissiveIntensity: 0.25 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), mat);
    mesh.position.set(tokenXs[i], 0, 0);
    scene.add(mesh);
    return mesh;
  });

  // Hidden expanded representation (4 dots per token in a column)
  const expandedGroups = TOKEN_COLORS.map((col, i) => {
    const group = new THREE.Group();
    group.position.set(tokenXs[i], 0, 0);
    group.visible = false;
    const ys = [-0.3, -0.1, 0.1, 0.3];
    ys.forEach((y, j) => {
      const r    = 0.055 + 0.02 * ((j + i) % 3);
      const sat  = 0.4 + 0.6 * (j / 3);
      const mat  = new THREE.MeshStandardMaterial({ color: solColor(col), roughness: 0.3, transparent: true, opacity: sat, emissive: solColor(col), emissiveIntensity: 0.2 * sat });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), mat);
      mesh.position.set(0, y, 0.12);
      group.add(mesh);
    });
    // Vertical connection line
    const linePts = [new THREE.Vector3(0, -0.3, 0.08), new THREE.Vector3(0, 0.3, 0.08)];
    const lineMat = new THREE.LineBasicMaterial({ color: solColor(col), transparent: true, opacity: 0.35 });
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), lineMat));
    scene.add(group);
    return group;
  });

  // Lens (biconvex flat disc) — LatheGeometry of biconvex profile
  const lensPoints = [];
  const lensR = 0.55, lensThick = 0.22;
  for (let i = 0; i <= 24; i++) {
    const r = (i / 24) * lensR;
    const sag = (lensThick / 2) * (1 - (r / lensR) ** 2);
    lensPoints.push(new THREE.Vector2(r, sag));
  }
  const lensGeo = new THREE.LatheGeometry(lensPoints, 32);
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.55, 0.85, 1.0),
    transparent: true, opacity: 0.32,
    roughness: 0.0, metalness: 0.0,
    transmission: 0.7, ior: 1.45,
    side: THREE.DoubleSide
  });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.position.set(0, 0, 0.35);
  scene.add(lens);

  // Lens drag
  let lensX = 0, dragging = false, dragStartX = 0, dragStartLensX = 0;

  function screenToWorld(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const nx   = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const vW   = camera.right - camera.left;
    return camera.left + (nx * 0.5 + 0.5) * vW;
  }

  function onDown(e) {
    const wx = screenToWorld(e);
    if (Math.abs(wx - lensX) < lensR * 1.3) {
      dragging = true; dragStartX = e.clientX; dragStartLensX = lensX;
      renderer.domElement.style.cursor = "ew-resize";
    }
  }
  function onMove(e) {
    if (!dragging) return;
    const rect  = renderer.domElement.getBoundingClientRect();
    const vW    = camera.right - camera.left;
    const dx    = ((e.clientX - dragStartX) / rect.width) * vW;
    lensX = Math.max(tokenXs[0] - spacing * 0.3, Math.min(tokenXs[N - 1] + spacing * 0.3, dragStartLensX + dx));
    lens.position.x = lensX;
    updateExpansion();
  }
  function onUp() { dragging = false; renderer.domElement.style.cursor = ""; }

  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointermove", onMove);
  renderer.domElement.addEventListener("pointerup", onUp);
  renderer.domElement.addEventListener("pointerleave", onUp);

  function updateExpansion() {
    tokenXs.forEach((tx, i) => {
      const dist = Math.abs(tx - lensX);
      const show = dist < lensR * 1.1;
      compressedMeshes[i].visible = !show;
      expandedGroups[i].visible   =  show;
      if (show) {
        const t = 1 - dist / (lensR * 1.1);
        expandedGroups[i].scale.y = 0.2 + 0.8 * t;
        expandedGroups[i].children.forEach((c, j) => {
          if (c.material) c.material.opacity = (j < 4 ? 0.3 + 0.7 * t : 0.35);
        });
      }
    });
  }

  // Labels
  let ow = 1;
  const labelItems = [];
  const annots = [
    { text: "représentation\ncompressée (d=8)",   pos: new THREE.Vector3(-2.4, 0.65, 0) },
    { text: "dimension\nexpansée (d=32)\nsous la lentille", pos: new THREE.Vector3(2.5, 0.5, 0) },
    { text: "↔ déplacer",  pos: new THREE.Vector3(lensX, 0.75, 0.4) },
  ];
  annots.forEach(a => {
    const lbl = makeDomLabel(a.text, { color: textColor, size: 11, backgroundColor: labelBg });
    lbl.style.whiteSpace = "pre";
    overlay.appendChild(lbl);
    labelItems.push({ element: lbl, position: a.pos });
  });
  const lensLabelPos = new THREE.Vector3(0, 0.75, 0.4);

  function updateLabels() {
    labelItems.forEach((lbl, i) => {
      const pos = i === 2 ? new THREE.Vector3(lensX, 0.75, 0.4) : lbl.position;
      const s   = projectToOverlay(pos, camera, ow, height);
      lbl.element.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;
    });
  }

  const { ro } = makeOrthoResize(targetEl, camera, renderer, height, () => 5.5);
  ow = targetEl.getBoundingClientRect().width || 800;

  let t = 0, frameId = null;
  function animate() {
    t += 0.012;
    renderer.render(scene, camera);
    updateLabels();
    ow = targetEl.getBoundingClientRect().width || 800;
    frameId = requestAnimationFrame(animate);
  }
  frameId = requestAnimationFrame(animate);

  const api = {
    destroy() {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointerleave", onUp);
      ro.disconnect(); disposeObject(scene); renderer.dispose(); targetEl.innerHTML = "";
    }
  };
  if (invalidation?.then) invalidation.then(() => api.destroy());
  return api;
}

// ── 5. Output camera + sensor ─────────────────────────────────────────────────

export function createOutputCamera(container, options = {}, invalidation = null) {
  const targetEl = typeof container === "string" ? document.querySelector(container) : container;
  if (!targetEl) return null;
  targetEl.innerHTML = "";

  const height = options.height ?? Math.max(targetEl.getBoundingClientRect().height || 0, 440);
  Object.assign(targetEl.style, { minHeight: `${height}px`, position: "relative" });

  const { scene, camera, renderer, overlay } = baseScene(targetEl, height);
  const textColor = resolveCssValue("var(--sol-base3)") || SOL_FALLBACKS.base3;
  const labelBg   = "rgba(0,43,54,0.78)";

  // Camera body
  const bodyGeo = new THREE.BoxGeometry(2.2, 1.4, 1.0);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(resolveCssValue("var(--sol-base02)") || SOL_FALLBACKS.base02),
    roughness: 0.5, metalness: 0.35
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 0.1, 0);
  scene.add(body);
  body.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo), new THREE.LineBasicMaterial({ color: new THREE.Color(SOL_FALLBACKS.base01), transparent: true, opacity: 0.4 })));

  // Lens mount cylinder (front face)
  const lensMountGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.22, 32);
  const lensMountMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(SOL_FALLBACKS.base01), roughness: 0.35, metalness: 0.6 });
  const lensMount = new THREE.Mesh(lensMountGeo, lensMountMat);
  lensMount.rotation.x = Math.PI / 2;
  lensMount.position.set(0, 0.1, 0.61);
  scene.add(lensMount);

  // Lens glass (circle)
  const lensGlassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.3, 0.6, 0.9), transparent: true, opacity: 0.25,
    roughness: 0, metalness: 0, side: THREE.DoubleSide
  });
  const lensGlass = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), lensGlassMat);
  lensGlass.position.set(0, 0.1, 0.72);
  scene.add(lensGlass);

  // Sensor grid (flat quads inside the camera front face)
  // Show sensor from slightly in front of camera center
  const vocabTokens = ["le", "chat", "mange", "car", "il", "a", "faim", "dort", "court", "vit", "rit", "part", "reste", "arrive", "revient", "tombe"];
  const COLS = 4, ROWS = 4;
  const sensorW = 1.6, sensorH = 1.0;
  const cellW = sensorW / COLS, cellH = sensorH / ROWS;
  const sensorCells = [];

  const sensorGroup = new THREE.Group();
  sensorGroup.position.set(0, 0.1, 0.5);
  scene.add(sensorGroup);

  vocabTokens.forEach((token, idx) => {
    const col   = idx % COLS;
    const row   = Math.floor(idx / COLS);
    const x     = (col - (COLS - 1) / 2) * cellW;
    const y     = -((row - (ROWS - 1) / 2) * cellH);
    const geo   = new THREE.PlaneGeometry(cellW * 0.86, cellH * 0.82);
    const mat   = new THREE.MeshStandardMaterial({
      color: new THREE.Color(SOL_FALLBACKS.base02), roughness: 0.5, emissive: new THREE.Color(0, 0, 0), emissiveIntensity: 0
    });
    const mesh  = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, 0);
    sensorGroup.add(mesh);
    sensorCells.push({ mesh, mat, token, prob: 0 });
  });

  // "Shutter" button as an HTML button overlay
  const btn = document.createElement("button");
  btn.textContent = "Déclencher";
  btn.className   = "btn btn-sm btn-warning";
  Object.assign(btn.style, {
    position: "absolute", bottom: "16px", left: "50%",
    transform: "translateX(-50%)", zIndex: "2", pointerEvents: "all"
  });
  overlay.style.pointerEvents = "none";
  btn.style.pointerEvents = "all";
  overlay.appendChild(btn);

  // Softmax for shutter activation
  function softmax(arr) {
    const max  = Math.max(...arr);
    const exps = arr.map(x => Math.exp(x - max));
    const sum  = exps.reduce((a, b) => a + b, 0);
    return exps.map(x => x / sum);
  }

  function fireShutter() {
    // Random logit distribution — a few tokens get high scores
    const logits = sensorCells.map((_, i) => {
      if (i === 0) return 3.2;  // "le" — high probability next token
      if (i === 3) return 2.1;  // "car"
      if (i === 6) return 1.8;  // "faim"
      return (Math.random() - 0.5) * 2;
    });
    const probs = softmax(logits);
    const TOP_COLORS = [solColor("yellow"), solColor("orange"), solColor("red"), solColor("cyan"), solColor("green")];
    const sorted = [...probs.map((p, i) => ({ p, i }))].sort((a, b) => b.p - a.p);

    sensorCells.forEach((cell, idx) => {
      cell.prob = probs[idx];
      const rank = sorted.findIndex(s => s.i === idx);
      if (rank < 5) {
        cell.mat.emissive = TOP_COLORS[rank];
        cell.mat.emissiveIntensity = probs[idx] * 6;
        cell.mat.color = new THREE.Color(SOL_FALLBACKS.base01);
      } else {
        cell.mat.emissive = new THREE.Color(0, 0, 0);
        cell.mat.emissiveIntensity = 0;
        cell.mat.color  = new THREE.Color(SOL_FALLBACKS.base02);
      }
    });
  }

  btn.addEventListener("click", fireShutter);

  // Labels for vocab tokens on sensor
  let ow = 1;
  const labelItems = [];
  const base3  = resolveCssValue("var(--sol-base3)")  || SOL_FALLBACKS.base3;
  const base00 = resolveCssValue("var(--sol-base00)") || SOL_FALLBACKS.base00;

  sensorCells.forEach((cell, idx) => {
    const col = idx % COLS, row = Math.floor(idx / COLS);
    const x   = (col - (COLS - 1) / 2) * cellW;
    const y   = -((row - (ROWS - 1) / 2) * cellH);
    const lbl = makeDomLabel(cell.token, { color: base3, size: 10, backgroundColor: "transparent" });
    overlay.appendChild(lbl);
    labelItems.push({ element: lbl, position: new THREE.Vector3(x, y + 0.1, 0.5) });
  });

  const titleLbl = makeDomLabel("capteur / vocabulaire", { color: base3, size: 11, backgroundColor: labelBg });
  overlay.appendChild(titleLbl);
  labelItems.push({ element: titleLbl, position: new THREE.Vector3(0, 0.9, 0.5) });

  function updateLabels() {
    labelItems.forEach(lbl => {
      const s = projectToOverlay(lbl.position, camera, ow, height);
      lbl.element.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-50%)`;
    });
  }

  const { ro } = makeOrthoResize(targetEl, camera, renderer, height, () => 5.0);
  ow = targetEl.getBoundingClientRect().width || 800;

  let t = 0, frameId = null;
  function animate() {
    t += 0.01;
    // Gentle camera sway
    camera.position.x = Math.sin(t * 0.18) * 0.12;
    camera.position.y = Math.cos(t * 0.13) * 0.06;
    camera.lookAt(0, 0.1, 0);
    renderer.render(scene, camera);
    updateLabels();
    ow = targetEl.getBoundingClientRect().width || 800;
    frameId = requestAnimationFrame(animate);
  }
  frameId = requestAnimationFrame(animate);

  const api = {
    destroy() {
      cancelAnimationFrame(frameId);
      btn.removeEventListener("click", fireShutter);
      ro.disconnect(); disposeObject(scene); renderer.dispose(); targetEl.innerHTML = "";
    }
  };
  if (invalidation?.then) invalidation.then(() => api.destroy());
  return api;
}
