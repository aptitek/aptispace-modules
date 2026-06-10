/**
 * Creates a premium interactive vertical Blade slider widget.
 *
 * @param {Object} options
 * @param {string} options.label
 * @param {number} [options.value=8]
 * @param {number} [options.min=1]
 * @param {number} [options.max=8]
 * @param {string} [options.height='220px']
 * @returns {HTMLDivElement}
 */
export function createBladeSlider({ label, value = 8, min = 1, max = 8, height = '220px' } = {}) {
  const container = document.createElement('div');
  container.className = 'blade-slider';
  container.style.setProperty('min-height', height);

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

  const segmentsContainer = document.createElement('div');
  segmentsContainer.className = 'blade-segments';
  const segments = [];
  for (let i = 0; i < max; i++) {
    const seg = document.createElement('div');
    seg.className = 'segment';
    segmentsContainer.appendChild(seg);
    segments.push(seg);
  }
  trackContainer.appendChild(segmentsContainer);

  const blade = document.createElement('div');
  blade.className = 'blade-handle';
  trackContainer.appendChild(blade);

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'slider-input';
  input.setAttribute('orient', 'vertical');
  input.min = min;
  input.max = max;
  input.step = 1;
  input.value = value;
  trackContainer.appendChild(input);
  container.appendChild(trackContainer);

  const update = (v) => {
    const pct = (v / max) * 100;
    blade.style.setProperty('top', pct + '%');

    segments.forEach((seg, i) => {
      seg.classList.toggle('is-active', i < v);
    });

    valueDisplay.textContent = v;
    container.value = v;
    container.dispatchEvent(new CustomEvent("input"));
  };

  input.oninput = () => update(parseInt(input.value));
  update(value);

  return container;
}
