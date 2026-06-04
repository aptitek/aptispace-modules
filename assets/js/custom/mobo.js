// ==========================================
// mobo.js — Engine de simulation de carte mère unifié
// ==========================================
// Usage (OJS):
//   import { initMoboSvg, renderMobo } from "./assets/js/custom/mobo.js"
//
//   init = initMoboSvg("#motherboard-view")
//   updateMotherboardUI = renderMobo(hardwareState)
//

import { renderTemplate } from "../core.js";

/**
 * Charge dynamiquement l'SVG de la carte mère et l'intègre en ligne dans le conteneur
 * pour permettre un accès DOM JavaScript complet à ses éléments internes.
 *
 * @param {string} selector - Sélecteur CSS du conteneur
 */
export async function initMoboSvg(selector) {
  const container = document.querySelector(selector);
  if (!container) return;

  // L'URL de l'SVG par défaut
  let svgUrl = new URL('../../ui/motherboard.svg', import.meta.url).href;
  
  const style = getComputedStyle(container).backgroundImage;
  const match = style.match(/url\("?([^"\)]+)"?\)/);
  if (match && match[1]) {
    svgUrl = match[1];
  }

  try {
    const res = await fetch(svgUrl);
    if (res.ok) {
      const svgText = await res.text();
      container.innerHTML = svgText;
      container.style.backgroundImage = 'none'; // Efface l'image de fond statique
    }
  } catch (e) {
    console.error("initMoboSvg: Impossible de charger l'SVG en ligne —", e);
  }
}

/**
 * Met à jour le flux d'exécution matériel, applique les classes d'états et anime les bus de données.
 *
 * @param {string} hardwareState - L'état actif ('ssd', 'ram', 'l3', 'l2_l1', 'cpu_reg')
 */
export function renderMobo(hardwareState) {
  // A. Cible le conteneur principal du simulateur
  const container = document.querySelector("#motherboard-view");
  if (!container) return;

  // Nettoyage des anciennes classes d'états
  const states = ["is-active-ssd", "is-active-ram", "is-active-l3", "is-active-l2-l1", "is-active-cpu-reg"];
  states.forEach(s => container.classList.remove(s));

  // Injection du nouvel état actif
  const activeClass = `is-active-${hardwareState}`;
  container.classList.add(activeClass);

  // B. Contrôle dynamique des bus de données animés
  const busSsdChipset = container.querySelector("#bus-ssd-chipset");
  const busChipsetRam = container.querySelector("#bus-chipset-ram");
  const busRamChipset = container.querySelector("#bus-ram-chipset");
  const busChipsetCpu = container.querySelector("#bus-chipset-cpu");
  const busCpuInternal = container.querySelector("#bus-cpu-internal");
  const busCpuInternalL2L1 = container.querySelector("#bus-cpu-internal-6");
  const busCpuInternalL1Reg = container.querySelector("#bus-cpu-internal-6-5");
  const busRamCpu = container.querySelector("#bus-ram-cpu");

  // Reset des bus
  [
    busSsdChipset, busChipsetRam, busRamChipset, busChipsetCpu, 
    busCpuInternal, busCpuInternalL2L1, busCpuInternalL1Reg, busRamCpu
  ].forEach(bus => {
    if (bus) bus.classList.remove("is-flowing");
  });

  // Activation des flux néons selon l'état
  if (hardwareState === "ram") {
    if (busSsdChipset) busSsdChipset.classList.add("is-flowing");
    if (busChipsetRam) busChipsetRam.classList.add("is-flowing");
  } 
  else if (hardwareState === "l3") {
    if (busRamChipset) busRamChipset.classList.add("is-flowing");
    if (busChipsetRam) busChipsetRam.classList.add("is-flowing");
    if (busChipsetCpu) busChipsetCpu.classList.add("is-flowing");
    if (busRamCpu) busRamCpu.classList.add("is-flowing");
  } 
  else if (hardwareState === "l2_l1") {
    if (busCpuInternal) busCpuInternal.classList.add("is-flowing");
    if (busCpuInternalL2L1) busCpuInternalL2L1.classList.add("is-flowing");
  } 
  else if (hardwareState === "cpu_reg") {
    if (busCpuInternalL1Reg) busCpuInternalL1Reg.classList.add("is-flowing");
  }
}
