/**
 * Creates a premium interactive circular/radial slider widget.
 *
 * @param {Object} options
 * @param {string} options.label
 * @param {number} [options.value=0]
 * @param {number} [options.min=0]
 * @param {number} [options.max=100]
 * @param {number} [options.step=1]
 * @param {string} [options.color='var(--sol-yellow)']
 * @param {string} [options.unit='']
 * @param {number} [options.size=100]
 * @returns {HTMLDivElement}
 */
export function createSliderRadial({ label, value = 0, min = 0, max = 100, step = 1, color = 'var(--sol-yellow)', unit = '', size = 100 } = {}) {
  const container = document.createElement('div');
  container.className = 'slider-radial';
  container.style.setProperty('--current-color', color);

  if (label) {
    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = label;
    container.appendChild(labelEl);
  }

  const radialContainer = document.createElement('div');
  radialContainer.className = 'radial-container';
  radialContainer.style.setProperty('width', size + 'px');
  radialContainer.style.setProperty('height', size + 'px');

  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "radial-svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

  const track = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  track.setAttribute("class", "radial-track");
  track.setAttribute("cx", String(size / 2));
  track.setAttribute("cy", String(size / 2));
  track.setAttribute("r", String(r));
  svg.appendChild(track);

  const progress = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  progress.setAttribute("class", "radial-progress");
  progress.setAttribute("cx", String(size / 2));
  progress.setAttribute("cy", String(size / 2));
  progress.setAttribute("r", String(r));
  progress.style.setProperty('stroke-dasharray', String(circ));

  const updateProgress = (v) => {
    const pct = (v - min) / (max - min);
    progress.style.setProperty('stroke-dashoffset', String(circ * (1 - pct)));
  };

  svg.appendChild(progress);
  radialContainer.appendChild(svg);

  const center = document.createElement('div');
  center.className = 'radial-center';
  const valueDisplay = document.createElement('div');
  valueDisplay.className = 'radial-value';
  center.appendChild(valueDisplay);
  radialContainer.appendChild(center);
  container.appendChild(radialContainer);

  const update = (v) => {
    v = Math.max(min, Math.min(max, v));
    if (step) v = Math.round(v / step) * step;

    updateProgress(v);
    valueDisplay.textContent = (step % 1 === 0 ? v : v.toFixed(2)) + unit;
    container.value = v;
    container.dispatchEvent(new CustomEvent("input"));
  };

  let isDragging = false;
  const handleMove = (e) => {
    if (!isDragging) return;
    const rect = radialContainer.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    // Calculate angle (0 at top, clockwise)
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;

    const pct = angle / (2 * Math.PI);
    const v = min + pct * (max - min);
    update(v);
  };

  radialContainer.addEventListener('pointerdown', (e) => {
    isDragging = true;
    radialContainer.setPointerCapture(e.pointerId);
    handleMove(e);
  });

  radialContainer.addEventListener('pointermove', handleMove);

  radialContainer.addEventListener('pointerup', (e) => {
    isDragging = false;
    radialContainer.releasePointerCapture(e.pointerId);
  });

  update(value);
  return container;
}
