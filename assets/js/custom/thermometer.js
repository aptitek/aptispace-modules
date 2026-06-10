/**
 * Creates a premium interactive vertical Thermometer slider widget.
 *
 * @param {Object} options
 * @param {string} options.label
 * @param {number} [options.value=0.7]
 * @param {number} [options.min=0]
 * @param {number} [options.max=2]
 * @param {number} [options.step=0.01]
 * @param {string} [options.height='220px']
 * @returns {HTMLDivElement}
 */
export function createThermometer({ label, value = 0.7, min = 0, max = 2, step = 0.01, height = '220px' } = {}) {
  const container = document.createElement('div');
  container.className = 'thermometer-slider';
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

  // Frost overlay
  const frost = document.createElement('div');
  frost.className = 'frost-overlay';
  trackContainer.appendChild(frost);

  // Ticks
  const ticks = document.createElement('div');
  ticks.className = 'thermometer-ticks';
  for (let i = 0; i < 6; i++) {
    const tick = document.createElement('div');
    tick.className = 'tick';
    ticks.appendChild(tick);
  }
  trackContainer.appendChild(ticks);

  const fill = document.createElement('div');
  fill.className = 'slider-fill';
  trackContainer.appendChild(fill);

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'slider-input';
  input.setAttribute('orient', 'vertical');
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  trackContainer.appendChild(input);
  container.appendChild(trackContainer);

  const bulb = document.createElement('div');
  bulb.className = 'thermometer-bulb';

  const bulbIcon = document.createElement('i');
  bulbIcon.className = 'bi';
  bulbIcon.style.setProperty("color", "rgba(255, 255, 255, 0.9)");
  bulbIcon.style.setProperty("font-size", "1.6rem");
  bulbIcon.style.setProperty("display", "flex");
  bulbIcon.style.setProperty("align-items", "center");
  bulbIcon.style.setProperty("justify-content", "center");
  bulbIcon.style.setProperty("height", "100%");
  bulb.appendChild(bulbIcon);
  container.appendChild(bulb);

  const update = (v) => {
    const pct = ((v - min) / (max - min)) * 100;
    fill.style.setProperty('height', Math.max(5, pct) + "%");

    // Dynamic colors and effects
    if (v < 0.4) {
      container.style.setProperty('--current-color', 'var(--sol-blue)');
      container.classList.add('is-cold');
      bulbIcon.className = 'bi bi-snow';
    } else if (v > 1.4) {
      container.style.setProperty('--current-color', 'var(--sol-red)');
      container.classList.remove('is-cold');
      bulbIcon.className = 'bi bi-fire';
    } else {
      container.style.setProperty('--current-color', 'var(--sol-green)');
      container.classList.remove('is-cold');
      bulbIcon.className = 'bi bi-thermometer-half';
    }

    valueDisplay.textContent = v.toFixed(2);
    container.value = v;
    container.dispatchEvent(new CustomEvent("input"));
  };

  input.oninput = () => update(parseFloat(input.value));
  update(value);

  return container;
}
