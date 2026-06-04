// ==========================================
// dynamic-svg.js - Compatibility SVG Adapters
// ==========================================

import { bindSvgElements, bindSvgToTabs } from "../svg.js";

export function createDynamicSvg(svgSelector, idMap, onClick) {
  return bindSvgElements(svgSelector, idMap, onClick);
}

export function bindSvgToTabset(svgSelector, tabsetSelector, idMap) {
  return bindSvgToTabs(svgSelector, tabsetSelector, idMap);
}
