// =====================================================================
// color-wheel.js — Cercle chromatique interactif discret pour harmonies
// =====================================================================
import { resolveCssValue } from "../core.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// Palette unifiée (Johannes Itten RYB par défaut si les variables CSS ne sont pas dispo)
const DEFAULT_PALETTE = [
  "#FFDF00", // 0: Jaune
  "#FF9F00", // 1: Jaune-Orange
  "#FF6F00", // 2: Orange
  "#FF3F00", // 3: Rouge-Orange
  "#E30613", // 4: Rouge
  "#9A004F", // 5: Rouge-Violet
  "#4A0072", // 6: Violet
  "#1A237E", // 7: Bleu-Violet
  "#005F9E", // 8: Bleu
  "#008B8B", // 9: Bleu-Vert
  "#008F39", // 10: Vert
  "#A3D900"  // 11: Jaune-Vert
];

/**
 * Récupère la couleur unifiée depuis les tokens CSS ou la palette de repli.
 */
function getWheelColor(index) {
  const varName = `--wheel-color-${index}`;
  const resolved = resolveCssValue(`var(${varName})`);
  if (resolved && resolved.startsWith("#")) {
    return resolved;
  }
  return DEFAULT_PALETTE[index] || "#000000";
}

/**
 * Convertit des coordonnées polaires en coordonnées cartésiennes.
 */
function polarToCartesian(cx, cy, r, angleInDegrees) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: cx + (r * Math.cos(angleInRadians)),
    y: cy + (r * Math.sin(angleInRadians))
  };
}

/**
 * Génère le chemin SVG d'un arc de cercle (donut segment).
 */
function getArcPath(cx, cy, rIn, rOut, startAngle, endAngle) {
  const startOut = polarToCartesian(cx, cy, rOut, startAngle);
  const endOut = polarToCartesian(cx, cy, rOut, endAngle);
  const startIn = polarToCartesian(cx, cy, rIn, startAngle);
  const endIn = polarToCartesian(cx, cy, rIn, endAngle);
  
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  
  return [
    "M", startOut.x, startOut.y,
    "A", rOut, rOut, 0, largeArcFlag, 1, endOut.x, endOut.y,
    "L", endIn.x, endIn.y,
    "A", rIn, rIn, 0, largeArcFlag, 0, startIn.x, startIn.y,
    "Z"
  ].join(" ");
}

/**
 * Convertit une couleur HSL en chaîne hexadécimale standard #RRGGBB.
 */
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  
  const rHex = Math.round((r + m) * 255).toString(16).padStart(2, '0');
  const gHex = Math.round((g + m) * 255).toString(16).padStart(2, '0');
  const bHex = Math.round((b + m) * 255).toString(16).padStart(2, '0');
  
  return `#${rHex}${gHex}${bHex}`;
}

/**
 * Crée un widget de cercle chromatique interactif et discret.
 *
 * @param {HTMLElement|string} target Conteneur cible
 * @param {Object} options Options de configuration
 * @param {string} [options.mode='complementary'] Mode d'harmonie ('complementary' | 'triadic' | 'tetradic')
 * @param {number} [options.baseHue=0] Teinte de base de départ (0 - 360)
 * @param {Function} [options.onChange] Callback exécuté lors du changement de sélection
 * @param {Promise} invalidation Promesse d'invalidation (Observable JS)
 */
export function createColorWheel(target, options = {}, invalidation) {
  const host = typeof target === "string" ? document.querySelector(target) : target;
  if (!host) return null;

  const width = 300;
  const height = 300;
  const cx = width / 2;
  const cy = height / 2;
  const rOut = 130;
  const rIn = 85;
  const rLine = 73; // Rayon pour les lignes de connexion d'harmonie

  let currentMode = options.mode ?? "complementary";
  let currentBaseIndex = Math.round((options.baseHue ?? 0) / 30) % 12;
  const onChange = options.onChange;

  // Création du conteneur du widget
  const container = document.createElement("div");
  container.className = "color-wheel-widget";

  // Création du SVG
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "color-wheel-svg");
  svg.style.setProperty("width", "100%");
  svg.style.setProperty("height", "auto");
  container.appendChild(svg);

  // Calque pour les lignes d'harmonies (en dessous des secteurs)
  const harmonyLayer = document.createElementNS(SVG_NS, "g");
  harmonyLayer.setAttribute("class", "harmony-layer");
  svg.appendChild(harmonyLayer);

  // Calque pour les secteurs de couleur
  const sectorsLayer = document.createElementNS(SVG_NS, "g");
  sectorsLayer.setAttribute("class", "sectors-layer");
  svg.appendChild(sectorsLayer);

  // Cercle central d'affichage
  const centerCircle = document.createElementNS(SVG_NS, "circle");
  centerCircle.setAttribute("cx", String(cx));
  centerCircle.setAttribute("cy", String(cy));
  centerCircle.setAttribute("r", "35");
  centerCircle.setAttribute("class", "color-wheel-center-circle");
  svg.appendChild(centerCircle);

  // Dessin des 12 secteurs discrets
  const sectors = [];
  for (let i = 0; i < 12; i++) {
    const startAngle = i * 30 - 15;
    const endAngle = i * 30 + 15;
    const pathStr = getArcPath(cx, cy, rIn, rOut, startAngle, endAngle);

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", pathStr);
    path.setAttribute("class", "color-wheel-sector");
    path.style.setProperty("--sector-color", getWheelColor(i));
    path.dataset.index = String(i);

    path.addEventListener("click", () => {
      currentBaseIndex = i;
      updateUI();
      emitChange();
    });

    sectorsLayer.appendChild(path);

    sectors.push(path);
  }

  /**
   * Calcule les indices de secteur actifs pour l'harmonie courante.
   */
  function getActiveIndices() {
    switch (currentMode) {
      case "triadic":
      case "ternary":
        return [
          currentBaseIndex,
          (currentBaseIndex + 4) % 12,
          (currentBaseIndex + 8) % 12
        ];
      case "tetradic":
      case "quaternary":
        return [
          currentBaseIndex,
          (currentBaseIndex + 3) % 12,
          (currentBaseIndex + 6) % 12,
          (currentBaseIndex + 9) % 12
        ];
      case "complementary":
      default:
        return [
          currentBaseIndex,
          (currentBaseIndex + 6) % 12
        ];
    }
  }

  /**
   * Met à jour le rendu visuel (highlights, lignes d'harmonie, etc.).
   */
  function updateUI() {
    const activeIndices = getActiveIndices();

    // 1. Mise à jour de l'apparence des secteurs
    sectors.forEach((sector, i) => {
      sector.classList.remove("is-active", "is-inactive");
      if (activeIndices.includes(i)) {
        sector.classList.add("is-active");
      } else {
        sector.classList.add("is-inactive");
      }
    });

    // 2. Mise à jour de la couleur du cercle central
    const baseColorHex = getWheelColor(currentBaseIndex);
    centerCircle.style.setProperty("--center-color", baseColorHex);

    // 3. Dessin du polygone/ligne de connexion d'harmonie dans le calque central
    harmonyLayer.innerHTML = "";

    const coords = activeIndices.map(index => {
      const angle = index * 30;
      return polarToCartesian(cx, cy, rLine, angle);
    });

    if (coords.length === 2) {
      // Harmonie complémentaire : une simple ligne
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(coords[0].x));
      line.setAttribute("y1", String(coords[0].y));
      line.setAttribute("x2", String(coords[1].x));
      line.setAttribute("y2", String(coords[1].y));
      line.setAttribute("class", "harmony-connector-line");
      harmonyLayer.appendChild(line);
    } else if (coords.length > 2) {
      // Triade ou Tétrade : un polygone fermé
      const polygon = document.createElementNS(SVG_NS, "polygon");
      const pointsStr = coords.map(c => `${c.x},${c.y}`).join(" ");
      polygon.setAttribute("points", pointsStr);
      polygon.setAttribute("class", "harmony-connector-polygon");
      harmonyLayer.appendChild(polygon);
    }

    // Ajout de petits nœuds visuels à chaque sommet du graphe de connexion
    coords.forEach(coord => {
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", String(coord.x));
      dot.setAttribute("cy", String(coord.y));
      dot.setAttribute("r", "5");
      dot.setAttribute("class", "harmony-connector-node");
      harmonyLayer.appendChild(dot);
    });
  }

  /**
   * Retourne la palette de couleurs calculée (Hues + Hexs).
   */
  function getPalette() {
    const activeIndices = getActiveIndices();
    return activeIndices.map(index => {
      const hex = getWheelColor(index);
      return {
        index,
        hue: index * 30,
        hex,
        hsl: hex
      };
    });
  }

  /**
   * Émet l'événement réactif à destination d'Observable JS.
   */
  function emitChange() {
    const palette = getPalette();
    const state = {
      baseHue: currentBaseIndex * 30,
      mode: currentMode,
      colors: palette.map(p => p.hex),
      palette: palette
    };

    container.dispatchEvent(new Event("input", { bubbles: true }));
    
    if (typeof onChange === "function") {
      onChange(state);
    }
  }

  /**
   * Met à jour dynamiquement la configuration du cercle chromatique.
   */
  function update(newOptions = {}) {
    if (newOptions.mode !== undefined) {
      currentMode = newOptions.mode;
    }
    if (newOptions.baseHue !== undefined) {
      currentBaseIndex = Math.round(newOptions.baseHue / 30) % 12;
    }
    updateUI();
    emitChange();
  }

  function destroy() {
    // Retirer les écouteeurs sur les secteurs
    sectors.forEach(sector => {
      sector.replaceWith(sector.cloneNode(true));
    });
    host.textContent = "";
  }

  // Attachement des propriétés sur le conteneur DOM pour liaison OJS (viewof)
  container.update = update;
  container.destroy = destroy;
  Object.defineProperty(container, "value", {
    get() {
      const palette = getPalette();
      return {
        baseHue: currentBaseIndex * 30,
        mode: currentMode,
        colors: palette.map(p => p.hex),
        palette: palette
      };
    },
    configurable: true
  });

  // Initialisation du DOM
  host.textContent = "";
  host.appendChild(container);
  
  updateUI();
  
  // Petite pause pour permettre l'accrochage d'Observable JS
  setTimeout(emitChange, 0);

  if (invalidation) {
    invalidation.then(destroy);
  }

  return container;
}

/**
 * Crée un cercle chromatique statique de Johannes Itten avec son triangle et son hexagone internes.
 *
 * @param {HTMLElement|string} target Conteneur cible
 */
export function createIttenWheel(target) {
  const host = typeof target === "string" ? document.querySelector(target) : target;
  if (!host) return null;

  const width = 380;
  const height = 380;
  const cx = width / 2;
  const cy = height / 2;
  const R = 110; // Rayon du polygone intérieur (hexagon)
  const rIn = 110; // Rayon interne de la couronne
  const rOut = 150; // Rayon externe de la couronne

  const container = document.createElement("div");
  container.className = "itten-wheel-widget";

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "itten-wheel-svg");
  svg.style.setProperty("width", "100%");
  svg.style.setProperty("height", "auto");
  container.appendChild(svg);

  // Couleurs du modèle RYB de Johannes Itten (définies depuis les variables CSS unifiées)
  const rybColors = [
    { name: "Jaune", type: "primary", hex: getWheelColor(0) },
    { name: "Jaune-Orange", type: "tertiary", hex: getWheelColor(1) },
    { name: "Orange", type: "secondary", hex: getWheelColor(2) },
    { name: "Rouge-Orange", type: "tertiary", hex: getWheelColor(3) },
    { name: "Rouge", type: "primary", hex: getWheelColor(4) },
    { name: "Rouge-Violet", type: "tertiary", hex: getWheelColor(5) },
    { name: "Violet", type: "secondary", hex: getWheelColor(6) },
    { name: "Bleu-Violet", type: "tertiary", hex: getWheelColor(7) },
    { name: "Bleu", type: "primary", hex: getWheelColor(8) },
    { name: "Bleu-Vert", type: "tertiary", hex: getWheelColor(9) },
    { name: "Vert", type: "secondary", hex: getWheelColor(10) },
    { name: "Jaune-Vert", type: "tertiary", hex: getWheelColor(11) }
  ];


  // Calcul des coordonnées des 6 sommets de l'hexagone
  const hexPoints = [];
  for (let i = 0; i < 6; i++) {
    const angleRad = (i * 60 - 90) * Math.PI / 180;
    hexPoints.push({
      x: cx + R * Math.cos(angleRad),
      y: cy + R * Math.sin(angleRad)
    });
  }

  // 1. Dessiner le triangle central divisé en 3 cerfs-volants (kites) meeting au centre O
  const O = { x: cx, y: cy };
  const A = hexPoints[0]; // Jaune (Top)
  const B = hexPoints[2]; // Rouge (Bottom-Right)
  const C = hexPoints[4]; // Bleu (Bottom-Left)

  // Midpoints du triangle central
  const M_AB = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const M_BC = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
  const M_CA = { x: (C.x + A.x) / 2, y: (C.y + A.y) / 2 };

  // Kite Jaune
  const pathJaune = document.createElementNS(SVG_NS, "path");
  pathJaune.setAttribute("d", `M ${A.x} ${A.y} L ${M_AB.x} ${M_AB.y} L ${O.x} ${O.y} L ${M_CA.x} ${M_CA.y} Z`);
  pathJaune.setAttribute("class", "itten-kite");
  pathJaune.style.setProperty("--kite-color", rybColors[0].hex);
  svg.appendChild(pathJaune);

  // Kite Rouge
  const pathRouge = document.createElementNS(SVG_NS, "path");
  pathRouge.setAttribute("d", `M ${B.x} ${B.y} L ${M_BC.x} ${M_BC.y} L ${O.x} ${O.y} L ${M_AB.x} ${M_AB.y} Z`);
  pathRouge.setAttribute("class", "itten-kite");
  pathRouge.style.setProperty("--kite-color", rybColors[4].hex);
  svg.appendChild(pathRouge);

  // Kite Bleu
  const pathBleu = document.createElementNS(SVG_NS, "path");
  pathBleu.setAttribute("d", `M ${C.x} ${C.y} L ${M_CA.x} ${M_CA.y} L ${O.x} ${O.y} L ${M_BC.x} ${M_BC.y} Z`);
  pathBleu.setAttribute("class", "itten-kite");
  pathBleu.style.setProperty("--kite-color", rybColors[8].hex);
  svg.appendChild(pathBleu);

  // 2. Dessiner les 3 triangles secondaires externes formant l'hexagone
  // Triangle Orange : A (Jaune), B (Rouge) et hexPoints[1] (Orange apex)
  const triOrange = document.createElementNS(SVG_NS, "polygon");
  triOrange.setAttribute("points", `${A.x},${A.y} ${hexPoints[1].x},${hexPoints[1].y} ${B.x},${B.y}`);
  triOrange.setAttribute("class", "itten-triangle");
  triOrange.style.setProperty("--triangle-color", rybColors[2].hex);
  svg.appendChild(triOrange);

  // Triangle Violet : B (Rouge), C (Bleu) et hexPoints[3] (Violet apex)
  const triViolet = document.createElementNS(SVG_NS, "polygon");
  triViolet.setAttribute("points", `${B.x},${B.y} ${hexPoints[3].x},${hexPoints[3].y} ${C.x},${C.y}`);
  triViolet.setAttribute("class", "itten-triangle");
  triViolet.style.setProperty("--triangle-color", rybColors[6].hex);
  svg.appendChild(triViolet);

  // Triangle Vert : C (Bleu), A (Jaune) et hexPoints[5] (Vert apex)
  const triVert = document.createElementNS(SVG_NS, "polygon");
  triVert.setAttribute("points", `${C.x},${C.y} ${hexPoints[5].x},${hexPoints[5].y} ${A.x},${A.y}`);
  triVert.setAttribute("class", "itten-triangle");
  triVert.style.setProperty("--triangle-color", rybColors[10].hex);
  svg.appendChild(triVert);

  // 3. Dessiner la couronne de 12 secteurs
  for (let i = 0; i < 12; i++) {
    const startAngle = i * 30 - 15;
    const endAngle = i * 30 + 15;
    const pathStr = getArcPath(cx, cy, rIn, rOut, startAngle, endAngle);

    const sector = document.createElementNS(SVG_NS, "path");
    sector.setAttribute("d", pathStr);
    sector.setAttribute("class", "itten-sector");
    sector.style.setProperty("--sector-color", rybColors[i].hex);
    svg.appendChild(sector);
  }

  // 4. Ajouter les étiquettes textuelles (noms des teintes et catégories)
  for (let i = 0; i < 12; i++) {
    const angleDeg = i * 30 - 90;
    const angleRad = angleDeg * Math.PI / 180;

    // Nom de la couleur dans le secteur
    const rText = (rIn + rOut) / 2;
    const tx = cx + rText * Math.cos(angleRad);
    const ty = cy + rText * Math.sin(angleRad);

    // Calcul de la rotation pour suivre la courbure (tangentielle)
    let rot = angleDeg + 90;
    if (Math.cos(angleRad) < -0.001) {
      rot += 180; // Évite d'avoir du texte à l'envers sur la moitié gauche
    }

    const textSector = document.createElementNS(SVG_NS, "text");
    textSector.setAttribute("x", String(tx));
    textSector.setAttribute("y", String(ty));
    textSector.setAttribute("transform", `rotate(${rot}, ${tx}, ${ty})`);
    textSector.setAttribute("class", "itten-label-sector");
    textSector.textContent = rybColors[i].name;
    svg.appendChild(textSector);

    // Catégorie à l'extérieur
    const rLabel = rOut + 18;
    const lx = cx + rLabel * Math.cos(angleRad);
    const ly = cy + rLabel * Math.sin(angleRad);

    const textLabel = document.createElementNS(SVG_NS, "text");
    textLabel.setAttribute("x", String(lx));
    textLabel.setAttribute("y", String(ly));
    
    let catClass = "itten-label-category";
    let catName = "";
    if (rybColors[i].type === "primary") {
      catClass += " cat-primary";
      catName = "Primaire";
    } else if (rybColors[i].type === "secondary") {
      catClass += " cat-secondary";
      catName = "Secondaire";
    } else {
      catClass += " cat-tertiary";
      catName = "Tertiaire";
    }

    textLabel.setAttribute("class", catClass);
    textLabel.textContent = catName;
    svg.appendChild(textLabel);
  }

  host.textContent = "";
  host.appendChild(container);
  return container;
}
