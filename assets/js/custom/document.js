/**
 * document.js
 * Composant générique pour afficher un document avec une loupe interactive (Magnifying Glass)
 * Permet d'explorer une couche cachée (reveal) sur un document de base.
 */

/**
 * Crée un composant de document interactif avec loupe.
 * Le conteneur cible doit déjà contenir les éléments .magnify-base et .magnify-reveal.
 * 
 * @param {string} containerSelector - Sélecteur CSS du conteneur cible.
 * @param {Object} options - Configuration.
 * @param {number} [options.radius=80] - Rayon de la loupe en pixels.
 * @returns {Object} Un moteur d'interaction { startScan, resetScan, destroy }
 */
export function createMagnifyingDocument(containerSelector, options = {}) {
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.error(`Magnifying document container ${containerSelector} not found.`);
    return null;
  }

  const baseLayer = container.querySelector(".magnify-base");
  const revealLayer = container.querySelector(".magnify-reveal");

  if (!baseLayer || !revealLayer) {
    console.error(`Magnifying layers .magnify-base or .magnify-reveal not found inside ${containerSelector}.`);
    return null;
  }

  const radius = options.radius || 80;

  // Scanner laser optionnel ajouté à la couche de base
  let scanner = baseLayer.querySelector(".magnify-scanner");
  if (!scanner) {
    scanner = document.createElement("div");
    scanner.className = "magnify-scanner";
    baseLayer.appendChild(scanner);
  }

  // Création de la loupe
  let glass = container.querySelector(".magnify-glass");
  if (!glass) {
    glass = document.createElement("div");
    glass.className = "magnify-glass";
    glass.style.width = `${radius * 2}px`;
    glass.style.height = `${radius * 2}px`;
    
    const handle = document.createElement("div");
    handle.className = "magnify-handle";
    glass.appendChild(handle);
    container.appendChild(glass);
  }

  const handle = glass.querySelector(".magnify-handle");

  // Ajout de la classe d'initialisation sur le wrapper
  container.classList.add("magnify-wrapper");

  // --- Logique d'interaction ---
  let currentX = 140;
  let currentY = 160;

  function updateGlass(x, y) {
    glass.style.left = `${x}px`;
    glass.style.top = `${y}px`;
    revealLayer.style.clipPath = `circle(${radius}px at ${x}px ${y}px)`;
  }

  // Position initiale
  updateGlass(currentX, currentY);

  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  function onMouseDown(e) {
    isDragging = true;
    const rect = container.getBoundingClientRect();
    dragOffset.x = (e.clientX - rect.left) - currentX;
    dragOffset.y = (e.clientY - rect.top) - currentY;
    glass.style.transition = "none";
    revealLayer.style.transition = "none";
    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    currentX = Math.max(0, Math.min(x, rect.width));
    currentY = Math.max(0, Math.min(y, rect.height));
    updateGlass(currentX, currentY);
  }

  function onMouseUp() {
    if (isDragging) {
      isDragging = false;
      glass.style.transition = "transform 0.1s ease-out";
    }
  }

  function onTouchStart(e) {
    isDragging = true;
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    dragOffset.x = (touch.clientX - rect.left) - currentX;
    dragOffset.y = (touch.clientY - rect.top) - currentY;
    glass.style.transition = "none";
    revealLayer.style.transition = "none";
    e.preventDefault();
    e.stopPropagation();
  }

  function onTouchMove(e) {
    if (!isDragging) return;
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    const x = touch.clientX - rect.left - dragOffset.x;
    const y = touch.clientY - rect.top - dragOffset.y;
    currentX = Math.max(0, Math.min(x, rect.width));
    currentY = Math.max(0, Math.min(y, rect.height));
    updateGlass(currentX, currentY);
    e.preventDefault();
  }

  // Écouteurs d'événements
  handle.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  handle.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onMouseUp);

  // --- API ---
  let scanTimer = null;

  function startScan(durationMs = 3000) {
    resetScan();
    
    // On attend une frame pour que le reset soit pris en compte
    requestAnimationFrame(() => {
      scanner.classList.add("is-scanning");
      scanner.style.transition = `top ${durationMs}ms linear`;
      
      // On déclenche le mouvement
      requestAnimationFrame(() => {
        scanner.style.top = "100%";
      });
      
      scanTimer = setTimeout(() => {
        scanner.classList.remove("is-scanning");
        scanner.style.top = "-10px";
      }, durationMs + 50);
    });
  }

  function resetScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanner.classList.remove("is-scanning");
    scanner.style.transition = "none";
    scanner.style.top = "-10px";
  }

  function destroy() {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onMouseUp);
    
    // On retire la loupe et le scanner si présents
    if (glass && container.contains(glass)) {
      container.removeChild(glass);
    }
    if (scanner && baseLayer.contains(scanner)) {
      baseLayer.removeChild(scanner);
    }
    container.classList.remove("magnify-wrapper");
  }

  return { startScan, resetScan, destroy };
}
