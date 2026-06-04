// ==========================================
// svg.js - Generic SVG DOM Helpers
// ==========================================

function resolveElement(elementOrSelector) {
  return typeof elementOrSelector === "string"
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
}

export function getBackgroundImageUrl(elementOrSelector) {
  const element = resolveElement(elementOrSelector);
  if (!element) return null;

  const style = getComputedStyle(element).backgroundImage;
  const match = style.match(/url\("?([^"\)]+)"?\)/);
  return match?.[1] || null;
}

/**
 * Loads an external SVG and injects it inline into a container.
 *
 * @param {string|Element} elementOrSelector
 * @param {Object} options
 * @returns {Promise<Element|undefined>}
 */
export async function loadInlineSvg(elementOrSelector, options = {}) {
  const container = resolveElement(elementOrSelector);
  if (!container) return undefined;

  const svgUrl = options.url || getBackgroundImageUrl(container);
  if (!svgUrl) return container;

  try {
    const response = await fetch(svgUrl);
    if (!response.ok) return container;

    container.innerHTML = await response.text();
    if (options.clearBackground !== false) {
      container.style.setProperty("background-image", "none");
    }
  } catch (error) {
    const label = options.errorLabel || "loadInlineSvg";
    console.error(`${label}: unable to load inline SVG`, error);
  }

  return container;
}

/**
 * Binds interactive behavior to mapped SVG elements.
 *
 * @param {string|Element} elementOrSelector
 * @param {Object} idMap
 * @param {Function} onSelect
 * @param {Object} options
 */
export function bindSvgElements(elementOrSelector, idMap, onSelect, options = {}) {
  const container = resolveElement(elementOrSelector);
  if (!container) return;

  const interactiveClass = options.interactiveClass || "dynamic-svg-interactive";

  Object.entries(idMap || {}).forEach(([id, mappedValue]) => {
    const element = container.querySelector(`#${id}`);
    if (!element) return;

    element.classList.add(interactiveClass);
    element.onclick = event => {
      event.preventDefault();
      if (typeof onSelect === "function") {
        onSelect(id, mappedValue, event);
      }
    };
  });
}

/**
 * Binds mapped SVG elements to Quarto tab labels.
 *
 * @param {string|Element} svgElementOrSelector
 * @param {string} tabsetSelector
 * @param {Object} idMap
 */
export function bindSvgToTabs(svgElementOrSelector, tabsetSelector, idMap) {
  bindSvgElements(svgElementOrSelector, idMap, (id, tabLabel) => {
    const links = document.querySelectorAll(`${tabsetSelector} .nav-link`);
    for (const link of links) {
      if (link.textContent.includes(tabLabel)) {
        link.click();
        break;
      }
    }
  });
}

/**
 * Applies a state class to an SVG container and toggles mapped flow elements.
 *
 * @param {string|Element} elementOrSelector
 * @param {string} state
 * @param {Object} options
 */
export function applySvgState(elementOrSelector, state, options = {}) {
  const container = resolveElement(elementOrSelector);
  if (!container) return;

  const stateClasses = options.stateClasses || [];
  const activeStateClass = options.activeStateClass || (value => `is-active-${value}`);
  const flowClass = options.flowClass || "is-flowing";
  const allFlowIds = options.flowIds || Array.from(new Set(Object.values(options.flowMap || {}).flat()));
  const activeFlowIds = options.flowMap?.[state] || [];

  stateClasses.forEach(className => container.classList.remove(className));
  container.classList.add(activeStateClass(state));

  allFlowIds.forEach(id => {
    const element = container.querySelector(`#${id}`);
    if (element) element.classList.remove(flowClass);
  });

  activeFlowIds.forEach(id => {
    const element = container.querySelector(`#${id}`);
    if (element) element.classList.add(flowClass);
  });
}
