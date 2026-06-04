// ==========================================
// card.js — Generic Card and Tabset utilities
// ==========================================
// Usage (OJS):
//   import { createTabsetWatcher, initTabIcons } from "./assets/js/custom/card.js"
//

import { createTabsetWatcher as _createTabsetWatcher, initTabIcons as _initTabIcons, initTabActions as _initTabActions } from "../core.js";

/**
 * Re-exporting core tabset and icon components to centralize card and tab behaviors.
 */
export const createTabsetWatcher = _createTabsetWatcher;
export const initTabIcons = _initTabIcons;
export const initTabActions = _initTabActions;

/**
 * High-fidelity Tabset Manager to orchestrate tab switching and value dispatching.
 *
 * @param {string} selector    - CSS selector for the tabset root (.panel-tabset)
 * @param {Object} labelMap    - Plain-text tab label -> value mapping
 * @param {Function} onChange  - Callback triggered with mapped value when tab switches
 * @returns {Object}           - Tabset controller: { destroy() }
 */
export function registerTabset(selector, labelMap, onChange) {
  return createTabsetWatcher(selector, labelMap, onChange);
}
