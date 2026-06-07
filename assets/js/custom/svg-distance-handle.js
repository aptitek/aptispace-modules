// =====================================================================
// svg-distance-handle.js — Generic draggable SVG distance handle
// =====================================================================

const SVG_NS = "http://www.w3.org/2000/svg";

let gradientCounter = 0;

function svgEl(tag, attrs = {}, styles = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  Object.entries(styles).forEach(([key, value]) => node.style.setProperty(key, value));
  return node;
}

function resolveTarget(target) {
  return typeof target === "string" ? document.querySelector(target) : target;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAnchor(anchor, fallback) {
  return {
    id: anchor.id ?? fallback.id,
    label: anchor.label ?? fallback.label,
    x: anchor.x ?? fallback.x,
    y: anchor.y ?? fallback.y,
    radius: anchor.radius ?? fallback.radius,
    auraRadius: anchor.auraRadius ?? fallback.auraRadius,
    auraOpacity: anchor.auraOpacity ?? fallback.auraOpacity,
    color: anchor.color ?? fallback.color,
    textColor: anchor.textColor ?? fallback.textColor
  };
}

function normalizeAnchors(anchors, width, height) {
  const defaults = [
    {
      id: "a",
      label: "A",
      x: width * 0.15,
      y: height / 2,
      radius: 30,
      auraRadius: 60,
      auraOpacity: 0.2,
      color: "var(--accent-info)",
      textColor: "var(--sol-base3)"
    },
    {
      id: "b",
      label: "B",
      x: width * 0.85,
      y: height / 2,
      radius: 30,
      auraRadius: 60,
      auraOpacity: 0.2,
      color: "var(--accent-danger)",
      textColor: "var(--sol-base3)"
    }
  ];

  return defaults.map((fallback, index) => normalizeAnchor(anchors?.[index] ?? {}, fallback));
}

function positionFromAlpha(alpha, anchors) {
  const [a, b] = anchors;
  return {
    x: a.x + alpha * (b.x - a.x),
    y: a.y + alpha * (b.y - a.y)
  };
}

function getDistanceState(position, anchors) {
  const [a, b] = anchors;
  const distanceA = Math.hypot(position.x - a.x, position.y - a.y);
  const distanceB = Math.hypot(position.x - b.x, position.y - b.y);
  const total = distanceA + distanceB;
  const alpha = total === 0 ? 0 : distanceA / total;

  return {
    alpha: clamp(alpha, 0, 1),
    distances: {
      [a.id]: distanceA,
      [b.id]: distanceB
    },
    nearestAnchor: distanceA <= distanceB ? a : b
  };
}

function defaultStatusFormatter({ nearestAnchor }) {
  return {
    label: `Proche de ${nearestAnchor.label}`,
    color: nearestAnchor.color
  };
}

/**
 * Creates a reusable two-anchor SVG plane with a free draggable handle.
 *
 * `alpha` is derived from the handle distance to both anchors:
 * alpha = distance(anchor A) / (distance(anchor A) + distance(anchor B)).
 *
 * @param {HTMLElement|string} target
 * @param {Object} options
 * @param {Promise} invalidation
 * @returns {{ svg: SVGElement, update: Function, destroy: Function }}
 */
export function createSvgDistanceHandle(target, options = {}, invalidation) {
  const host = resolveTarget(target);
  if (!host) return null;

  const width = options.width ?? 560;
  const height = options.height ?? 280;
  const gradientId = `distanceHandleGradient${gradientCounter++}`;
  let anchors = normalizeAnchors(options.anchors, width, height);
  let currentAlpha = clamp(options.alpha ?? 0.15, 0, 1);
  let currentPosition = options.position
    ? { ...options.position }
    : positionFromAlpha(currentAlpha, anchors);
  let statusFormatter = options.statusFormatter ?? defaultStatusFormatter;
  let alphaLabelFormatter = options.alphaLabelFormatter ?? (({ alpha }) => `alpha = ${alpha.toFixed(2)}`);
  let footerLabel = options.footerLabel ?? "Distance relative";
  let footerColor = options.footerColor ?? "var(--sol-base1)";
  let renderOverlay = options.renderOverlay;
  let onChange = options.onChange;
  let activePointerId = null;
  let isDragging = false;
  const showAnchorLine = options.showAnchorLine !== false;
  const showAnchors = options.showAnchors !== false;
  const showHandleLabel = options.showHandleLabel !== false;
  const showStatusLabel = options.showStatusLabel !== false;
  const showFooter = options.showFooter !== false;
  const handleLabelOffsetY = options.handleLabelOffsetY ?? 28;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "xMidYMid meet",
    role: "img",
    "aria-label": options.ariaLabel ?? "Poignée SVG déplaçable entre deux ancres"
  }, {
    width: "100%",
    height: "auto",
    display: "block",
    background: options.background ?? "transparent",
    "border-radius": options.borderRadius ?? "12px",
    "touch-action": "none",
    ...(options.styles ?? {})
  });

  const defs = svgEl("defs");
  svg.appendChild(defs);

  const line = svgEl("line", {
    "stroke-width": 2,
    "stroke-dasharray": "6,4"
  }, { stroke: options.lineColor ?? "var(--sol-base01)" });
  line.style.setProperty("display", showAnchorLine ? "" : "none");
  svg.appendChild(line);

  const anchorEls = anchors.map((anchor, index) => {
    const anchorGradientId = `${gradientId}-${index}`;
    const grad = svgEl("radialGradient", { id: anchorGradientId });
    const stop1 = svgEl("stop", { offset: "0%" }, {
      "stop-color": anchor.color,
      "stop-opacity": String(anchor.auraOpacity)
    });
    const stop2 = svgEl("stop", { offset: "100%" }, {
      "stop-color": anchor.color,
      "stop-opacity": "0"
    });
    grad.append(stop1, stop2);
    defs.appendChild(grad);

    const aura = svgEl("circle", {}, { fill: `url(#${anchorGradientId})` });
    const point = svgEl("circle", { "stroke-width": 2 }, {
      fill: anchor.color,
      stroke: "var(--sol-base3)"
    });
    const label = svgEl("text", {
      "text-anchor": "middle",
      dy: ".35em",
      "font-size": "14px",
      "font-weight": "700"
    }, { fill: anchor.textColor });
    label.textContent = anchor.label;
    aura.style.setProperty("display", showAnchors ? "" : "none");
    point.style.setProperty("display", showAnchors ? "" : "none");
    label.style.setProperty("display", showAnchors ? "" : "none");

    svg.append(aura, point, label);
    return { aura, point, label, stop1, index };
  });

  const overlayLayer = svgEl("g");
  svg.appendChild(overlayLayer);

  const handle = svgEl("circle", {
    r: options.handleRadius ?? 12,
    "stroke-width": 2
  }, {
    fill: options.handleColor ?? "var(--accent-warning)",
    stroke: "var(--sol-base3)",
    filter: `drop-shadow(0 0 8px ${options.handleColor ?? "var(--accent-warning)"})`,
    cursor: "grab",
    "touch-action": "none"
  });
  svg.appendChild(handle);

  const alphaLabel = svgEl("text", {
    "text-anchor": "middle",
    "font-size": "11px",
    "font-weight": "700"
  }, { fill: options.handleColor ?? "var(--accent-warning)" });
  alphaLabel.style.setProperty("display", showHandleLabel ? "" : "none");
  svg.appendChild(alphaLabel);

  const statusLabel = svgEl("text", {
    x: width / 2,
    y: 24,
    "text-anchor": "middle",
    "font-size": "13px",
    "font-weight": "700"
  });
  statusLabel.style.setProperty("display", showStatusLabel ? "" : "none");
  svg.appendChild(statusLabel);

  const footer = svgEl("text", {
    x: width - 10,
    y: height - 8,
    "text-anchor": "end",
    "font-size": "10px",
    "font-weight": "700"
  });
  footer.style.setProperty("display", showFooter ? "" : "none");
  svg.appendChild(footer);

  function render() {
    const distanceState = getDistanceState(currentPosition, anchors);
    currentAlpha = distanceState.alpha;

    line.setAttribute("x1", anchors[0].x);
    line.setAttribute("y1", anchors[0].y);
    line.setAttribute("x2", anchors[1].x);
    line.setAttribute("y2", anchors[1].y);

    anchorEls.forEach(({ aura, point, label, stop1, index }) => {
      const anchor = anchors[index];
      stop1.style.setProperty("stop-color", anchor.color);
      stop1.style.setProperty("stop-opacity", String(anchor.auraOpacity));
      aura.setAttribute("cx", anchor.x);
      aura.setAttribute("cy", anchor.y);
      aura.setAttribute("r", anchor.auraRadius);
      point.setAttribute("cx", anchor.x);
      point.setAttribute("cy", anchor.y);
      point.setAttribute("r", anchor.radius);
      point.style.setProperty("fill", anchor.color);
      label.setAttribute("x", anchor.x);
      label.setAttribute("y", anchor.y);
      label.style.setProperty("fill", anchor.textColor);
      label.textContent = anchor.label;
    });

    overlayLayer.textContent = "";
    renderOverlay?.({
      layer: overlayLayer,
      createSvgElement: svgEl,
      width,
      height,
      ...distanceState,
      position: currentPosition,
      anchors
    });

    handle.setAttribute("cx", currentPosition.x);
    handle.setAttribute("cy", currentPosition.y);
    alphaLabel.setAttribute("x", currentPosition.x);
    alphaLabel.setAttribute("y", clamp(currentPosition.y + handleLabelOffsetY, 12, height - 8));
    alphaLabel.textContent = alphaLabelFormatter({ ...distanceState, position: currentPosition, anchors });

    const status = statusFormatter({ ...distanceState, position: currentPosition, anchors });
    statusLabel.textContent = status.label;
    statusLabel.style.setProperty("fill", status.color);
    footer.textContent = footerLabel;
    footer.style.setProperty("fill", footerColor);

    return distanceState;
  }

  function emitChange() {
    const distanceState = render();
    onChange?.({ ...distanceState, position: currentPosition, anchors });
  }

  function updateFromCoords(clientX, clientY) {
    const rect = svg.getBoundingClientRect();
    currentPosition = {
      x: clamp(((clientX - rect.left) / rect.width) * width, 0, width),
      y: clamp(((clientY - rect.top) / rect.height) * height, 0, height)
    };
    emitChange();
  }

  function onPointerDown(event) {
    isDragging = true;
    activePointerId = event.pointerId;
    handle.style.setProperty("cursor", "grabbing");
    svg.setPointerCapture(activePointerId);
    updateFromCoords(event.clientX, event.clientY);
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!isDragging) return;
    if (activePointerId !== null && event.pointerId !== activePointerId) return;
    updateFromCoords(event.clientX, event.clientY);
  }

  function onPointerEnd() {
    if (!isDragging) return;
    isDragging = false;
    if (activePointerId !== null && svg.hasPointerCapture(activePointerId)) {
      svg.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
    handle.style.setProperty("cursor", "grab");
  }

  function update(nextOptions = {}) {
    anchors = normalizeAnchors(nextOptions.anchors ?? anchors, width, height);
    statusFormatter = nextOptions.statusFormatter ?? statusFormatter;
    alphaLabelFormatter = nextOptions.alphaLabelFormatter ?? alphaLabelFormatter;
    footerLabel = nextOptions.footerLabel ?? footerLabel;
    footerColor = nextOptions.footerColor ?? footerColor;
    renderOverlay = nextOptions.renderOverlay ?? renderOverlay;
    onChange = nextOptions.onChange ?? onChange;

    if (nextOptions.position) {
      currentPosition = { ...nextOptions.position };
    } else if (Number.isFinite(nextOptions.alpha)) {
      currentPosition = positionFromAlpha(clamp(nextOptions.alpha, 0, 1), anchors);
    }

    return render();
  }

  function destroy() {
    svg.removeEventListener("pointerdown", onPointerDown);
    svg.removeEventListener("pointermove", onPointerMove);
    svg.removeEventListener("pointerup", onPointerEnd);
    svg.removeEventListener("pointercancel", onPointerEnd);
  }

  host.textContent = "";
  host.appendChild(svg);
  svg.addEventListener("pointerdown", onPointerDown);
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerEnd);
  svg.addEventListener("pointercancel", onPointerEnd);

  render();
  invalidation?.then(destroy);

  return {
    svg,
    update,
    destroy,
    get alpha() {
      return currentAlpha;
    },
    get position() {
      return { ...currentPosition };
    }
  };
}
