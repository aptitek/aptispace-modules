// ==========================================
// lever.js — Analog lever switch component
// ==========================================
// Usage (OJS):
//   import { createLever } from "./assets/js/custom/lever.js"
//   viewof powerOn = createLever("#power-lever", invalidation)
//
// The matching DOM structure must exist in the page (fenced divs in Quarto):
//   ::: {#power-lever .lever-wrapper}
//   ::: {.lever-housing}
//   [ON]{.lever-label-top}  ::: {.lever-slot} :::
//   ::: {.lever-handle} ::: ::: {.lever-led} :::
//   [OFF]{.lever-label-bottom}
//   :::
//   [Circuit coupé]{.lever-status .is-off}
//   :::

// Resolved path to the SVG asset relative to this module
import { createVerticalDragToggle } from "../components.js";

const ARC_BOLT_SVG = new URL('../../ui/arc-bolt.svg', import.meta.url).href;
const LEVER_ON_TOP = 18;
const LEVER_OFF_TOP = 82;

// ── Private: inject the arc-flash element (fetches SVG once, caches it) ──────

let _arcSvgCache = null;

async function _loadArcSvg() {
  if (_arcSvgCache !== null) return _arcSvgCache;
  try {
    const res = await fetch(ARC_BOLT_SVG);
    _arcSvgCache = res.ok ? await res.text() : '';
  } catch {
    _arcSvgCache = '';
  }
  return _arcSvgCache;
}

async function _buildArc(housing) {
  let arc = housing.querySelector('.lever-arc');
  if (!arc) {
    arc = document.createElement('div');
    arc.className = 'lever-arc';
    arc.innerHTML = await _loadArcSvg();
    housing.appendChild(arc);
  }

  arc.classList.remove('arc-flash');
  void arc.offsetWidth; // force reflow to restart animation
  arc.classList.add('arc-flash');
}

// ── Public: createLever ───────────────────────────────────────────────────────

/**
 * Wires drag interaction onto an existing lever DOM structure.
 *
 * @param {string}   selector    - CSS selector for the `.lever-wrapper` element
 * @param {Promise}  invalidation - OJS invalidation promise for listener cleanup
 * @returns {Element} OJS-observable element (.value = boolean, dispatches 'input')
 */
export function createLever(selector, invalidation) {
  const wrapper = document.querySelector(selector);
  if (!wrapper) throw new Error(`createLever: element not found — "${selector}"`);

  const housing = wrapper.querySelector('.lever-housing');
  return createVerticalDragToggle({
    element: wrapper,
    handleSelector: '.lever-handle',
    stateElement: housing,
    onPosition: LEVER_ON_TOP,
    offPosition: LEVER_OFF_TOP,
    invalidation,
    onChange: on => on ? _buildArc(housing) : undefined
  });
}
