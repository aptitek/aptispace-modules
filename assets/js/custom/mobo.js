// ==========================================
// mobo.js — Engine de simulation de carte mère unifié
// ==========================================
// Usage (OJS):
//   import { initMoboSvg, renderMobo } from "./assets/js/custom/mobo.js"
//
//   init = initMoboSvg("#motherboard-view")
//   updateMotherboardUI = renderMobo(hardwareState)
//

import { applySvgState, getBackgroundImageUrl, loadInlineSvg } from "../svg.js";

const MOTHERBOARD_SVG = new URL('../../ui/motherboard.svg', import.meta.url).href;
const MOTHERBOARD_SELECTOR = "#motherboard-view";
const HARDWARE_STATES = ["ssd", "ram", "l3", "l2_l1", "cpu_reg"];
const BUS_IDS = [
  "bus-ssd-chipset",
  "bus-chipset-ram",
  "bus-ram-chipset",
  "bus-chipset-cpu",
  "bus-cpu-internal",
  "bus-cpu-internal-6",
  "bus-cpu-internal-6-5",
  "bus-ram-cpu"
];
const HARDWARE_FLOW_MAP = {
  ram: ["bus-ssd-chipset", "bus-chipset-ram"],
  l3: ["bus-ram-chipset", "bus-chipset-ram", "bus-chipset-cpu", "bus-ram-cpu"],
  l2_l1: ["bus-cpu-internal", "bus-cpu-internal-6"],
  cpu_reg: ["bus-cpu-internal-6-5"]
};

/**
 * Charge dynamiquement l'SVG de la carte mère et l'intègre en ligne dans le conteneur
 * pour permettre un accès DOM JavaScript complet à ses éléments internes.
 *
 * @param {string} selector - Sélecteur CSS du conteneur
 */
export async function initMoboSvg(selector, options = {}) {
  return loadInlineSvg(selector, {
    url: options.url || getBackgroundImageUrl(selector) || MOTHERBOARD_SVG,
    errorLabel: "initMoboSvg"
  });
}

/**
 * Met à jour le flux d'exécution matériel, applique les classes d'états et anime les bus de données.
 *
 * @param {string} hardwareState - L'état actif ('ssd', 'ram', 'l3', 'l2_l1', 'cpu_reg')
 */
export function renderMobo(hardwareState) {
  applySvgState(MOTHERBOARD_SELECTOR, hardwareState, {
    stateClasses: HARDWARE_STATES.map(state => `is-active-${state}`),
    flowIds: BUS_IDS,
    flowMap: HARDWARE_FLOW_MAP
  });
}
