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

/**
 * Initializes a generic interactive SVG component.
 *
 * @param {string|Element} elementOrSelector
 * @param {Object} config
 * @returns {Promise<Object>}
 */
export async function initInteractiveSvg(elementOrSelector, config = {}) {
  const container = resolveElement(elementOrSelector);
  if (!container) return { container: null, update: () => {} };

  // 1. Load the inline SVG
  await loadInlineSvg(container, {
    url: config.url,
    errorLabel: config.errorLabel || "initInteractiveSvg"
  });

  // 2. Add classes to elements dynamically on init if specified
  if (config.elementClasses) {
    Object.entries(config.elementClasses).forEach(([id, classes]) => {
      const el = container.querySelector(`#${id}`);
      if (el) {
        classes.forEach(c => el.classList.add(c));
      }
    });
  }

  // 3. Bind elements to tabs if tabset and mapping are provided
  if (config.tabsetSelector && config.tabElementMap) {
    bindSvgToTabs(container, config.tabsetSelector, config.tabElementMap);
  }

  // 4. Define interactive class on clickable elements
  if (config.tabElementMap) {
    const interactiveClass = config.interactiveClass || "dynamic-svg-interactive";
    Object.keys(config.tabElementMap).forEach(id => {
      const el = container.querySelector(`#${id}`);
      if (el) el.classList.add(interactiveClass);
    });
  }

  // 5. Define a state updater
  const update = (state) => {
    // A. Update container active state class
    if (config.states) {
      config.states.forEach(s => {
        container.classList.remove(config.activeStateClass?.(s) || `is-active-${s}`);
      });
    }
    container.classList.add(config.activeStateClass?.(state) || `is-active-${state}`);

    // B. Update active elements classes (generic styling)
    const activeClass = config.activeClass || "svg-active-element";
    if (config.activeElementMap) {
      // Remove active class from all mapped elements
      const allActiveIds = Array.from(new Set(Object.values(config.activeElementMap).flat()));
      allActiveIds.forEach(id => {
        const el = container.querySelector(`#${id}`);
        if (el) el.classList.remove(activeClass);
      });

      // Add active class to elements for the current state
      const currentActiveIds = config.activeElementMap[state] || [];
      currentActiveIds.forEach(id => {
        const el = container.querySelector(`#${id}`);
        if (el) el.classList.add(activeClass);
      });
    }

    // C. Update flow elements classes
    if (config.flowMap) {
      const flowClass = config.flowClass || "is-flowing";
      const allFlowIds = config.flowIds || Array.from(new Set(Object.values(config.flowMap).flat()));
      allFlowIds.forEach(id => {
        const el = container.querySelector(`#${id}`);
        if (el) el.classList.remove(flowClass);
      });

      const currentFlowIds = config.flowMap[state] || [];
      currentFlowIds.forEach(id => {
        const el = container.querySelector(`#${id}`);
        if (el) el.classList.add(flowClass);
      });
    }
  };

  return {
    container,
    update
  };
}

