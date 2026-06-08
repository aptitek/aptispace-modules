/**
 * document.js
 * Composant générique pour afficher un document avec une loupe interactive.
 * Le conteneur cible doit contenir .magnify-base et .magnify-reveal.
 *
 * @param {string} containerSelector - Sélecteur CSS du conteneur.
 * @param {Object} options
 * @param {number} [options.radius=80] - Rayon de la loupe en pixels.
 * @returns {{ startScan, resetScan, destroy }}
 */
export function createMagnifyingDocument(containerSelector, options = {}) {
  const container = document.querySelector(containerSelector);
  if (!container) {
    console.error(`Magnifying document container ${containerSelector} not found.`);
    return null;
  }

  const baseLayer  = container.querySelector(".magnify-base");
  const revealLayer = container.querySelector(".magnify-reveal");

  if (!baseLayer || !revealLayer) {
    console.error(`.magnify-base or .magnify-reveal not found inside ${containerSelector}.`);
    return null;
  }

  const radius = options.radius || 80;

  // Scanner laser optionnel — ajouté à la couche de base si absent
  let scanner = baseLayer.querySelector(".magnify-scanner");
  if (!scanner) {
    scanner = document.createElement("div");
    scanner.className = "magnify-scanner";
    baseLayer.appendChild(scanner);
  }

  // Loupe — créée si absente, taille pilotée par CSS via --glass-radius
  let glass = container.querySelector(".magnify-glass");
  if (!glass) {
    glass = document.createElement("div");
    glass.className = "magnify-glass";
    glass.style.setProperty("--glass-radius", `${radius}px`);
    const handle = document.createElement("div");
    handle.className = "magnify-handle";
    glass.appendChild(handle);
    container.appendChild(glass);
  }

  const handle = glass.querySelector(".magnify-handle");
  container.classList.add("magnify-wrapper");

  let currentX = 140;
  let currentY = 160;

  function updateGlass(x, y) {
    glass.style.setProperty("left", `${x}px`);
    glass.style.setProperty("top",  `${y}px`);
    revealLayer.style.setProperty("clip-path", `circle(${radius}px at ${x}px ${y}px)`);
  }

  updateGlass(currentX, currentY);

  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  function onMouseDown(e) {
    isDragging = true;
    const rect = container.getBoundingClientRect();
    dragOffset.x = (e.clientX - rect.left) - currentX;
    dragOffset.y = (e.clientY - rect.top)  - currentY;
    container.classList.add("is-dragging");
    e.preventDefault();
    e.stopPropagation();
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    const rect = container.getBoundingClientRect();
    currentX = Math.max(0, Math.min(e.clientX - rect.left  - dragOffset.x, rect.width));
    currentY = Math.max(0, Math.min(e.clientY - rect.top   - dragOffset.y, rect.height));
    updateGlass(currentX, currentY);
  }

  function onMouseUp() {
    if (isDragging) {
      isDragging = false;
      container.classList.remove("is-dragging");
    }
  }

  function onTouchStart(e) {
    isDragging = true;
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    dragOffset.x = (touch.clientX - rect.left) - currentX;
    dragOffset.y = (touch.clientY - rect.top)  - currentY;
    container.classList.add("is-dragging");
    e.preventDefault();
    e.stopPropagation();
  }

  function onTouchMove(e) {
    if (!isDragging) return;
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    currentX = Math.max(0, Math.min(touch.clientX - rect.left - dragOffset.x, rect.width));
    currentY = Math.max(0, Math.min(touch.clientY - rect.top  - dragOffset.y, rect.height));
    updateGlass(currentX, currentY);
    e.preventDefault();
  }

  handle.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup",   onMouseUp);
  handle.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove",  onTouchMove,  { passive: false });
  window.addEventListener("touchend",   onMouseUp);

  // --- API scan ---
  let scanTimer = null;

  function startScan(durationMs = 3000) {
    resetScan();
    requestAnimationFrame(() => {
      scanner.style.setProperty("--scan-duration", `${durationMs}ms`);
      scanner.classList.add("is-scanning");
      requestAnimationFrame(() => {
        scanner.style.setProperty("top", "100%");
      });
      scanTimer = setTimeout(resetScan, durationMs + 50);
    });
  }

  function resetScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanner.classList.remove("is-scanning");
    scanner.style.removeProperty("top"); // retour au top: -10px défini en CSS
  }

  function destroy() {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup",   onMouseUp);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend",  onMouseUp);
    if (glass   && container.contains(glass))  container.removeChild(glass);
    if (scanner && baseLayer.contains(scanner)) baseLayer.removeChild(scanner);
    container.classList.remove("magnify-wrapper");
  }

  return { startScan, resetScan, destroy };
}
