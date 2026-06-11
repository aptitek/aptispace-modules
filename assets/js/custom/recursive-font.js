/**
 * Recursive Font Sampler Component
 * 
 * Provides interactive vertical sliders for MONO, CASL, wght, slnt, and CRSV axes,
 * updating a text preview area in real-time.
 */

/**
 * Creates the Recursive font interactive sampler widget.
 * 
 * @param {HTMLElement|string} target Container element or selector
 * @param {Object} options Configuration options
 * @param {string} [options.text='Recursive'] Initial preview text
 * @param {string} [options.pangram] Custom French pangram
 * @param {number} [options.mono=0] Initial MONO value
 * @param {number} [options.casl=0] Initial CASL value
 * @param {number} [options.wght=400] Initial wght value
 * @param {number} [options.slnt=0] Initial slnt value
 * @param {number} [options.crsv=0.5] Initial CRSV value
 * @param {Promise} [invalidation] OJS invalidation promise for cleanup
 */
export function createRecursiveFontSampler(target, options = {}, invalidation) {
  const container = typeof target === 'string' ? document.querySelector(target) : target;
  if (!container) return null;

  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'recursive-sampler-wrapper';

  const slidersContainer = document.createElement('div');
  slidersContainer.className = 'recursive-sliders-container';
  wrapper.appendChild(slidersContainer);

  const previewContainer = document.createElement('div');
  previewContainer.className = 'recursive-preview-container';
  wrapper.appendChild(previewContainer);

  // Preview elements
  const textInput = document.createElement('input');
  textInput.setAttribute('type', 'text');
  textInput.className = 'recursive-text-input';
  textInput.setAttribute('placeholder', 'Saisissez votre texte de prévisualisation...');
  textInput.value = options.text || 'Recursive';
  previewContainer.appendChild(textInput);

  const displayArea = document.createElement('div');
  displayArea.className = 'recursive-preview-display';
  previewContainer.appendChild(displayArea);

  const previewLarge = document.createElement('div');
  previewLarge.className = 'recursive-preview-large';
  previewLarge.textContent = textInput.value;
  displayArea.appendChild(previewLarge);

  const previewSmall = document.createElement('div');
  previewSmall.className = 'recursive-preview-small';
  previewSmall.textContent = options.pangram || 'Portez ce vieux whisky au juge blond qui fume.';
  displayArea.appendChild(previewSmall);

  // State
  const state = {
    mono: options.mono ?? 0,
    casl: options.casl ?? 0,
    wght: options.wght ?? 400,
    slnt: options.slnt ?? 0,
    crsv: options.crsv ?? 0.5
  };

  // Define axes config
  const axes = [
    { key: 'mono', label: 'MONO', min: 0, max: 1, step: 0.01, color: 'var(--sol-blue)' },
    { key: 'casl', label: 'CASL', min: 0, max: 1, step: 0.01, color: 'var(--sol-green)' },
    { key: 'wght', label: 'wght', min: 300, max: 1000, step: 1, color: 'var(--sol-orange)' },
    { key: 'slnt', label: 'slnt', min: -15, max: 0, step: 0.1, color: 'var(--sol-red)' },
    { key: 'crsv', label: 'CRSV', min: 0, max: 1, step: 0.01, color: 'var(--sol-violet)' }
  ];

  const sliders = {};

  const updatePreview = () => {
    const fontSettings = `'MONO' ${state.mono}, 'CASL' ${state.casl}, 'wght' ${state.wght}, 'slnt' ${state.slnt}, 'CRSV' ${state.crsv}`;
    previewLarge.style.setProperty('font-variation-settings', fontSettings);
    previewSmall.style.setProperty('font-variation-settings', fontSettings);

    // Dispatch update
    container.value = { ...state, text: textInput.value };
    container.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // Build each slider
  axes.forEach(axis => {
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'recursive-slider';
    sliderWrapper.style.setProperty('--current-color', axis.color);

    const header = document.createElement('div');
    header.className = 'slider-header';
    
    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = axis.label;
    header.appendChild(labelEl);

    const valDisplay = document.createElement('div');
    valDisplay.className = 'slider-value';
    header.appendChild(valDisplay);
    sliderWrapper.appendChild(header);

    const trackContainer = document.createElement('div');
    trackContainer.className = 'slider-track-container';

    const fill = document.createElement('div');
    fill.className = 'slider-fill';
    trackContainer.appendChild(fill);

    const thumb = document.createElement('div');
    thumb.className = 'slider-thumb';
    trackContainer.appendChild(thumb);

    const input = document.createElement('input');
    input.setAttribute('type', 'range');
    input.className = 'slider-input';
    input.setAttribute('orient', 'vertical');
    input.min = String(axis.min);
    input.max = String(axis.max);
    input.step = String(axis.step);
    input.value = String(state[axis.key]);
    trackContainer.appendChild(input);
    sliderWrapper.appendChild(trackContainer);

    const updateSlider = (v) => {
      state[axis.key] = v;
      const pct = ((v - axis.min) / (axis.max - axis.min)) * 100;
      fill.style.setProperty('height', pct + '%');
      thumb.style.setProperty('bottom', `calc(${pct}% - 8px)`);
      valDisplay.textContent = axis.step < 1 ? v.toFixed(2) : Math.round(v);
      updatePreview();
    };

    input.oninput = () => updateSlider(parseFloat(input.value));
    updateSlider(state[axis.key]);

    sliders[axis.key] = {
      updateValue: (v) => {
        if (parseFloat(input.value) === v) return;
        input.value = String(v);
        updateSlider(v);
      }
    };

    slidersContainer.appendChild(sliderWrapper);
  });

  // Handle text input changes
  textInput.oninput = () => {
    previewLarge.textContent = textInput.value || ' ';
    updatePreview();
  };

  // Expose update API
  container.update = (values) => {
    if (!values) return;
    Object.keys(values).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (sliders[lowerKey] && values[key] !== undefined) {
        sliders[lowerKey].updateValue(parseFloat(values[key]));
      }
      if (lowerKey === 'text' && values[key] !== undefined) {
        textInput.value = values[key];
        previewLarge.textContent = values[key] || ' ';
      }
    });
  };

  const destroy = () => {
    textInput.oninput = null;
    container.innerHTML = '';
  };

  container.destroy = destroy;
  
  if (invalidation) {
    invalidation.then(destroy);
  }

  container.appendChild(wrapper);
  updatePreview();

  return container;
}
