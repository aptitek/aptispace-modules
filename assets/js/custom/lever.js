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
const ARC_BOLT_SVG = new URL('../../ui/arc-bolt.svg', import.meta.url).href;

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
  const handle  = wrapper.querySelector('.lever-handle');

  // Handle pixel positions — must match _lever.scss
  const TOP_ON  = 18;
  const TOP_OFF = 82;
  const MID     = (TOP_ON + TOP_OFF) / 2;

  wrapper.value = false;

  let dragging = false;
  let startY   = 0;
  let startTop = TOP_OFF;

  const getY = e => e.touches ? e.touches[0].clientY : e.clientY;

  async function _applyState(on) {
    wrapper.value = on;
    housing.classList.toggle('is-on', on);
    handle.style.top = ''; // release inline style → CSS spring transition takes over
    if (on) await _buildArc(housing);
    wrapper.dispatchEvent(new CustomEvent('input'));
  }

  function _onDragStart(e) {
    e.preventDefault();
    dragging = true;
    startY   = getY(e);
    startTop = wrapper.value ? TOP_ON : TOP_OFF;
    housing.classList.add('is-dragging');
    document.body.style.userSelect = 'none';
  }

  function _onDragMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const raw = startTop + (getY(e) - startY);
    handle.style.top = Math.min(TOP_OFF, Math.max(TOP_ON, raw)) + 'px';
  }

  function _onDragEnd() {
    if (!dragging) return;
    dragging = false;
    housing.classList.remove('is-dragging');
    document.body.style.userSelect = '';
    const current = parseFloat(handle.style.top);
    const landed  = isNaN(current) ? (wrapper.value ? TOP_ON : TOP_OFF) : current;
    _applyState(landed < MID);
  }

  handle.addEventListener('mousedown',  _onDragStart);
  handle.addEventListener('touchstart', _onDragStart, { passive: false });
  document.addEventListener('mousemove', _onDragMove);
  document.addEventListener('touchmove', _onDragMove, { passive: false });
  document.addEventListener('mouseup',   _onDragEnd);
  document.addEventListener('touchend',  _onDragEnd);

  // Clean up global listeners when OJS re-renders the cell
  if (invalidation) {
    invalidation.then(() => {
      handle.removeEventListener('mousedown',  _onDragStart);
      handle.removeEventListener('touchstart', _onDragStart);
      document.removeEventListener('mousemove', _onDragMove);
      document.removeEventListener('touchmove', _onDragMove);
      document.removeEventListener('mouseup',   _onDragEnd);
      document.removeEventListener('touchend',  _onDragEnd);
    });
  }

  return wrapper;
}
