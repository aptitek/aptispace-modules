/**
 * CIELAB Color Space Simulator
 * 
 * Provides color conversion formulas and renders a 3D projected CIELAB sphere
 * with interactive coordinate visualization.
 */

// --- Color Conversion Math ---

/**
 * Converts CIELAB coordinates to sRGB.
 * L* in [0, 100], a* in [-128, 127], b* in [-128, 127]
 */
export function labToRgb(l, a, b) {
  // Defensive type checking and fallbacks
  l = (typeof l === 'number' && !isNaN(l)) ? l : 70;
  a = (typeof a === 'number' && !isNaN(a)) ? a : 20;
  b = (typeof b === 'number' && !isNaN(b)) ? b : 20;

  // Convert LAB to XYZ (D65 reference white)
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  const x3 = x * x * x;
  const y3 = y * y * y;
  const z3 = z * z * z;

  x = x3 > 0.008856 ? x3 : (x - 16 / 116) / 7.787;
  y = y3 > 0.008856 ? y3 : (y - 16 / 116) / 7.787;
  z = z3 > 0.008856 ? z3 : (z - 16 / 116) / 7.787;

  // D65 reference white points in [0, 1] range
  x = x * 0.95047;
  y = y * 1.00000;
  z = z * 1.08883;

  // XYZ to sRGB conversion matrix (standard D65 matrix)
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bVal = x * 0.0557 + y * -0.2040 + z * 1.0570;

  // Apply gamma correction (c is in [0, 1] range)
  const adjust = (c) => {
    c = c > 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  };

  return {
    r: adjust(r),
    g: adjust(g),
    b: adjust(bVal)
  };
}

/**
 * Converts RGB components to a Hex string.
 */
export function rgbToHex(r, g, b) {
  const toHex = (c) => {
    // Ensure value is a valid integer inside [0, 255]
    c = (typeof c === 'number' && !isNaN(c)) ? Math.max(0, Math.min(255, Math.round(c))) : 0;
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Projects 3D CIELAB coordinates onto a 2D canvas/SVG space.
 */
export function projectCielab(l, a, b, cx = 190, cy = 190, R = 130) {
  l = (typeof l === 'number' && !isNaN(l)) ? l : 70;
  a = (typeof a === 'number' && !isNaN(a)) ? a : 20;
  b = (typeof b === 'number' && !isNaN(b)) ? b : 20;

  const cos45 = 0.7071;
  const sin45 = 0.7071;
  // b* is projected at 45 degrees, scaled by 0.55 for depth perspective
  const depthScale = 0.55;

  const x = cx + (a / 128) * R + (b / 128) * R * cos45 * depthScale;
  const y = cy - ((l - 50) / 50) * R - (b / 128) * R * sin45 * depthScale;

  return { x, y };
}

// --- Component Factory ---

/**
 * Creates the interactive CIELAB sphere widget.
 * 
 * @param {HTMLElement|string} target Container element or selector
 * @param {Object} options Options object
 * @param {number} [options.l=70] Initial L* value
 * @param {number} [options.a=20] Initial a* value
 * @param {number} [options.b=20] Initial b* value
 * @param {function} [options.onChange] Callback when values change
 */
export function createCielabSphere(target, { l = 70, a = 20, b = 20, onChange } = {}) {
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!container) return null;

  container.innerHTML = '';

  const widget = document.createElement('div');
  widget.className = 'cielab-widget';

  const viewContainer = document.createElement('div');
  viewContainer.className = 'cielab-container';
  widget.appendChild(viewContainer);

  // 1. Create Background Canvas
  const canvas = document.createElement('canvas');
  canvas.className = 'cielab-canvas';
  canvas.width = 380;
  canvas.height = 380;
  viewContainer.appendChild(canvas);

  // 2. Create SVG Overlay
  const svg = document.createElement('svg');
  svg.setAttribute('class', 'cielab-svg-overlay');
  svg.setAttribute('viewBox', '0 0 380 380');
  viewContainer.appendChild(svg);

  // Render static 3D sphere background once on init
  renderSphereBackground(canvas);

  // State
  let state = { l, a, b };

  // Draw SVG elements
  const cx = 190, cy = 190, R = 130;

  // Markers for arrow heads
  svg.innerHTML = `
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="var(--sol-base01)" />
      </marker>
    </defs>
  `;

  // Draw Left Lightness scale axis
  const scaleAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  scaleAxis.setAttribute('x1', '30');
  scaleAxis.setAttribute('y1', String(cy - R));
  scaleAxis.setAttribute('x2', '30');
  scaleAxis.setAttribute('y2', String(cy + R));
  scaleAxis.setAttribute('class', 'cielab-axis');
  svg.appendChild(scaleAxis);

  // Left scale ticks
  const tickValues = [0, 25, 50, 75, 100];
  tickValues.forEach((val) => {
    const yTick = cy + R - (val / 100) * (2 * R);
    
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', '25');
    tick.setAttribute('y1', String(yTick));
    tick.setAttribute('x2', '30');
    tick.setAttribute('y2', String(yTick));
    tick.setAttribute('class', 'cielab-axis');
    svg.appendChild(tick);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', '15');
    txt.setAttribute('y', String(yTick));
    txt.setAttribute('class', 'cielab-axis-label label-minmax');
    txt.textContent = String(val);
    svg.appendChild(txt);
  });

  // Draw central axes (L*, a*, b*)
  // L* axis (vertical)
  const lAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  lAxis.setAttribute('x1', String(cx));
  lAxis.setAttribute('y1', String(cy + R + 15));
  lAxis.setAttribute('x2', String(cx));
  lAxis.setAttribute('y2', String(cy - R - 15));
  lAxis.setAttribute('class', 'cielab-axis');
  lAxis.setAttribute('marker-end', 'url(#arrow)');
  lAxis.setAttribute('marker-start', 'url(#arrow)');
  svg.appendChild(lAxis);

  // L* label at the top
  const lLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  lLabel.setAttribute('x', String(cx));
  lLabel.setAttribute('y', String(cy - R - 25));
  lLabel.setAttribute('class', 'cielab-axis-label');
  lLabel.textContent = 'L*';
  svg.appendChild(lLabel);

  const lTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  lTitle.setAttribute('x', String(cx));
  lTitle.setAttribute('y', String(cy - R - 40));
  lTitle.setAttribute('class', 'cielab-axis-label label-minmax');
  lTitle.textContent = 'Lightness';
  svg.appendChild(lTitle);

  // a* axis (horizontal)
  const aAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  aAxis.setAttribute('x1', String(cx - R - 15));
  aAxis.setAttribute('y1', String(cy));
  aAxis.setAttribute('x2', String(cx + R + 15));
  aAxis.setAttribute('y2', String(cy));
  aAxis.setAttribute('class', 'cielab-axis');
  aAxis.setAttribute('marker-end', 'url(#arrow)');
  aAxis.setAttribute('marker-start', 'url(#arrow)');
  svg.appendChild(aAxis);

  // a* label at the right
  const aLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  aLabel.setAttribute('x', String(cx + R + 25));
  aLabel.setAttribute('y', String(cy));
  aLabel.setAttribute('class', 'cielab-axis-label');
  aLabel.textContent = 'a*';
  svg.appendChild(aLabel);

  const greenLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  greenLabel.setAttribute('x', String(cx - R - 35));
  greenLabel.setAttribute('y', String(cy));
  greenLabel.setAttribute('class', 'cielab-axis-label label-minmax');
  greenLabel.textContent = 'Green';
  svg.appendChild(greenLabel);

  // b* axis (depth)
  const bStart = projectCielab(50, 0, -145);
  const bEnd = projectCielab(50, 0, 145);
  const bAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  bAxis.setAttribute('x1', String(bStart.x));
  bAxis.setAttribute('y1', String(bStart.y));
  bAxis.setAttribute('x2', String(bEnd.x));
  bAxis.setAttribute('y2', String(bEnd.y));
  bAxis.setAttribute('class', 'cielab-axis');
  bAxis.setAttribute('marker-end', 'url(#arrow)');
  bAxis.setAttribute('marker-start', 'url(#arrow)');
  svg.appendChild(bAxis);

  // b* label at the top-right
  const bLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  bLabel.setAttribute('x', String(bEnd.x + 10));
  bLabel.setAttribute('y', String(bEnd.y - 10));
  bLabel.setAttribute('class', 'cielab-axis-label');
  bLabel.textContent = 'b*';
  svg.appendChild(bLabel);

  const blueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  blueLabel.setAttribute('x', String(bStart.x - 10));
  blueLabel.setAttribute('y', String(bStart.y + 15));
  blueLabel.setAttribute('class', 'cielab-axis-label label-minmax');
  blueLabel.textContent = 'Blue';
  svg.appendChild(blueLabel);

  // Equator ellipse
  const equator = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  equator.setAttribute('cx', String(cx));
  equator.setAttribute('cy', String(cy));
  equator.setAttribute('rx', String(R));
  equator.setAttribute('ry', String(R * 0.55 * 0.7071));
  equator.setAttribute('class', 'cielab-equator');
  svg.appendChild(equator);

  // Projection Lines
  const projVertical = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  projVertical.setAttribute('class', 'cielab-projection');
  svg.appendChild(projVertical);

  const projToCenter = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  projToCenter.setAttribute('class', 'cielab-projection');
  svg.appendChild(projToCenter);

  const projToScale = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  projToScale.setAttribute('class', 'cielab-projection');
  svg.appendChild(projToScale);

  // Text tag showing the L*, a*, b* coordinate values above the swatch
  const coordsLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  coordsLabel.setAttribute('class', 'cielab-axis-label label-minmax');
  coordsLabel.setAttribute('text-anchor', 'middle');
  coordsLabel.style.setProperty('font-size', '10px');
  svg.appendChild(coordsLabel);

  // Target indicator group
  const targetGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  targetGroup.setAttribute('class', 'cielab-indicator-group');
  svg.appendChild(targetGroup);

  // Color Swatch (rounded rectangle)
  const swatch = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  swatch.setAttribute('width', '36');
  swatch.setAttribute('height', '36');
  swatch.setAttribute('rx', '8');
  swatch.setAttribute('ry', '8');
  swatch.setAttribute('class', 'cielab-swatch');
  targetGroup.appendChild(swatch);

  // Dot in the center
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('r', '4');
  dot.setAttribute('class', 'cielab-indicator-dot');
  targetGroup.appendChild(dot);

  // Update visual state
  const updateVisuals = (dispatchEvent = true) => {
    // Ensure state values are valid numbers
    state.l = (typeof state.l === 'number' && !isNaN(state.l)) ? state.l : 70;
    state.a = (typeof state.a === 'number' && !isNaN(state.a)) ? state.a : 20;
    state.b = (typeof state.b === 'number' && !isNaN(state.b)) ? state.b : 20;

    const pt = projectCielab(state.l, state.a, state.b, cx, cy, R);
    const ptPlane = projectCielab(50, state.a, state.b, cx, cy, R);
    const rgb = labToRgb(state.l, state.a, state.b);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

    // Update Swatch Position
    swatch.setAttribute('x', String(pt.x - 18));
    swatch.setAttribute('y', String(pt.y - 18));
    swatch.setAttribute('fill', hex);
    swatch.style.setProperty('fill', hex);

    // Update dot in the center of swatch
    dot.setAttribute('cx', String(pt.x));
    dot.setAttribute('cy', String(pt.y));

    // Update Projection Lines
    // 1. Vertical from swatch to equator plane
    projVertical.setAttribute('x1', String(pt.x));
    projVertical.setAttribute('y1', String(pt.y));
    projVertical.setAttribute('x2', String(ptPlane.x));
    projVertical.setAttribute('y2', String(ptPlane.y));

    // 2. Line from coordinate plane point to the sphere center
    projToCenter.setAttribute('x1', String(ptPlane.x));
    projToCenter.setAttribute('y1', String(ptPlane.y));
    projToCenter.setAttribute('x2', String(cx));
    projToCenter.setAttribute('y2', String(cy));

    // 3. Line from swatch to left Lightness scale
    const yTick = cy + R - (state.l / 100) * (2 * R);
    projToScale.setAttribute('x1', '30');
    projToScale.setAttribute('y1', String(yTick));
    projToScale.setAttribute('x2', String(pt.x));
    projToScale.setAttribute('y2', String(pt.y));

    // Update Coordinate label
    coordsLabel.setAttribute('x', String(pt.x));
    coordsLabel.setAttribute('y', String(pt.y - 24));
    coordsLabel.textContent = `L*:${Math.round(state.l)} a*:${Math.round(state.a)} b*:${Math.round(state.b)}`;

    if (dispatchEvent) {
      // Dispatch update to parent or custom inputs
      container.value = { ...state, hex };
      container.dispatchEvent(new CustomEvent('input', { bubbles: true }));

      if (onChange) {
        onChange(container.value);
      }
    }
  };

  // Drag interaction
  let isDragging = false;

  const handleDrag = (clientX, clientY) => {
    const rect = svg.getBoundingClientRect();
    const mx = ((clientX - rect.left) / rect.width) * 380;
    const my = ((clientY - rect.top) / rect.height) * 380;

    // Horizontal movement controls a*
    const dx = mx - cx;
    state.a = Math.max(-128, Math.min(127, (dx / R) * 128));

    // Vertical movement controls L*
    const dy = cy - my;
    state.l = Math.max(0, Math.min(100, 50 + (dy / R) * 50));

    updateVisuals(true);
  };

  targetGroup.addEventListener('mousedown', (e) => {
    isDragging = true;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      handleDrag(e.clientX, e.clientY);
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Touch support
  targetGroup.addEventListener('touchstart', (e) => {
    isDragging = true;
    if (e.touches.length > 0) {
      handleDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
    e.preventDefault();
  });

  window.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length > 0) {
      handleDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  });

  window.addEventListener('touchend', () => {
    isDragging = false;
  });

  // Public update API
  container.update = (newCoords) => {
    let changed = false;
    if (newCoords.l !== undefined && Math.round(state.l) !== Math.round(newCoords.l)) {
      state.l = newCoords.l;
      changed = true;
    }
    if (newCoords.a !== undefined && Math.round(state.a) !== Math.round(newCoords.a)) {
      state.a = newCoords.a;
      changed = true;
    }
    if (newCoords.b !== undefined && Math.round(state.b) !== Math.round(newCoords.b)) {
      state.b = newCoords.b;
      changed = true;
    }
    if (changed) {
      updateVisuals(false); // Update visuals but don't dispatch input event to avoid loops
    }
  };

  updateVisuals();
  container.appendChild(widget);

  return container;
}

/**
 * Shades a 3D projected CIELAB sphere surface onto the canvas.
 */
function renderSphereBackground(canvas) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const R = 130;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const dx = px - cx;
      const dy = py - cy;
      const dist2 = dx * dx + dy * dy;

      if (dist2 <= R * R) {
        // Pixel is inside the sphere circle boundary
        const idx = (py * width + px) * 4;

        // Calculate surface normal (z is pointing forward)
        const z = Math.sqrt(R * R - dist2);
        const nx = dx / R;
        const ny = -dy / R; // invert y for standard 3D coordinates
        const nz = z / R;

        // Map normal to CIELAB coordinates
        // L* ranges from 0 (bottom, ny=-1) to 100 (top, ny=1)
        const l = 50 + 50 * ny;

        // a* (green-red) corresponds to nx (left-right)
        const a = 128 * nx;

        // b* (blue-yellow) corresponds to depth nz.
        // To show a pleasant variety of hues (green, yellow, red, blue),
        // we skew the coordinates slightly.
        const b = 128 * (nx + ny) * 0.7071;

        // Convert to RGB
        const rgb = labToRgb(l, a, b);

        data[idx] = rgb.r;
        data[idx + 1] = rgb.g;
        data[idx + 2] = rgb.b;
        data[idx + 3] = 255; // Solid opaque sphere
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Add a soft 3D lighting vignette/overlay on top
  const grad = ctx.createRadialGradient(cx - R/3, cy - R/3, R/10, cx, cy, R);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.fill();
}

/**
 * Creates a premium custom vertical slider for CIELAB coordinates.
 * Exposes a value property and updates reactively.
 */
export function createCielabSlider({ label, value = 0, min = -128, max = 127, step = 1, className = '' } = {}) {
  const container = document.createElement('div');
  container.className = `cielab-slider ${className}`;

  const header = document.createElement('div');
  header.className = 'slider-header';

  const labelEl = document.createElement('span');
  labelEl.className = 'label';
  labelEl.textContent = label;
  header.appendChild(labelEl);

  const valueDisplay = document.createElement('div');
  valueDisplay.className = 'slider-value';
  header.appendChild(valueDisplay);
  container.appendChild(header);

  const trackContainer = document.createElement('div');
  trackContainer.className = 'slider-track-container';

  const fill = document.createElement('div');
  fill.className = 'slider-fill';
  trackContainer.appendChild(fill);

  const thumb = document.createElement('div');
  thumb.className = 'slider-thumb';
  trackContainer.appendChild(thumb);

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'slider-input';
  input.setAttribute('orient', 'vertical');
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  trackContainer.appendChild(input);
  container.appendChild(trackContainer);

  const update = (v) => {
    v = (typeof v === 'number' && !isNaN(v)) ? v : value;
    const pct = ((v - min) / (max - min)) * 100;
    fill.style.setProperty('height', pct + '%');
    thumb.style.setProperty('bottom', `calc(${pct}% - 10px)`);
    valueDisplay.textContent = Math.round(v);
    container.value = v;
    container.dispatchEvent(new CustomEvent('input', { bubbles: true }));
  };

  input.oninput = () => update(parseFloat(input.value));
  update(value);

  container.update = (v) => {
    v = (typeof v === 'number' && !isNaN(v)) ? v : value;
    const roundedV = Math.round(v);
    if (Math.round(parseFloat(input.value)) === roundedV) return;
    input.value = String(roundedV);
    update(roundedV);
  };

  return container;
}

