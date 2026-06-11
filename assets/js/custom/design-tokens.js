/**
 * design-tokens.js
 * 
 * Simulateur de pipeline de Design Tokens (Style Dictionary).
 * Met à jour un mockup de carte d'interface et génère du code
 * multi-plateforme en temps réel (JSON, CSS, SCSS, Swift, Jetpack Compose).
 */

function resolveElement(elementOrSelector) {
  return typeof elementOrSelector === "string"
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
}

const COLOR_MAP = {
  "Bleu (sol-blue)": { hex: "#268bd2", primitive: "blue-500", cssVar: "var(--sol-blue)" },
  "Vert (sol-green)": { hex: "#859900", primitive: "green-500", cssVar: "var(--sol-green)" },
  "Orange (sol-orange)": { hex: "#cb4b16", primitive: "orange-500", cssVar: "var(--sol-orange)" },
  "Violet (sol-violet)": { hex: "#6c71c4", primitive: "violet-500", cssVar: "var(--sol-violet)" }
};

const WEIGHT_MAP = {
  "Normal (400)": 400,
  "Gras (700)": 700,
  "Extra-Gras (900)": 900
};

export function createDesignTokenSimulator(target, options = {}, invalidation) {
  const container = resolveElement(target);
  if (!container) return null;

  // Options configuration
  const config = {
    brandColor: options.brandColor || "Bleu (sol-blue)",
    baseSpacing: parseFloat(options.baseSpacing) || 16,
    borderRadius: parseFloat(options.borderRadius) || 12,
    fontWeight: options.fontWeight || "Gras (700)",
    useMono: options.useMono === true,
    mockupContainer: options.mockupContainer,
    jsonCode: options.jsonCode,
    cssCode: options.cssCode,
    scssCode: options.scssCode,
    swiftCode: options.swiftCode,
    composeCode: options.composeCode
  };

  const update = () => {
    const colorObj = COLOR_MAP[config.brandColor] || COLOR_MAP["Bleu (sol-blue)"];
    const weightVal = WEIGHT_MAP[config.fontWeight] || 700;

    // 1. Mettre à jour le mockup
    const mockupEl = resolveElement(config.mockupContainer);
    if (mockupEl) {
      mockupEl.innerHTML = `
        <div class="tokens-mockup" style="
          --sim-brand-color: ${colorObj.hex};
          --sim-base-spacing: ${config.baseSpacing}px;
          --sim-border-radius: ${config.borderRadius}px;
          --sim-font-weight: ${weightVal};
          font-family: ${config.useMono ? '"Recursive", monospace' : '"Outfit", sans-serif'};
        ">
          <div class="mockup-header">
            <span class="bi-cpu mockup-icon"></span>
            <h5 class="mockup-title">Visualiseur de Modèle</h5>
          </div>
          <div class="mockup-body">
            <p class="mockup-text">Ce composant réagit en temps réel aux variations de nos design tokens sémantiques.</p>
            <div class="mockup-bar-container">
              <div class="mockup-bar-fill"></div>
            </div>
          </div>
          <div class="mockup-footer">
            <button class="mockup-btn">Lancer l'App</button>
          </div>
        </div>
      `;
    }

    // 2. Générer les codes de sortie
    const jsonCode = getJson(colorObj, config.baseSpacing, config.borderRadius, weightVal, config.useMono);
    const cssCode = getCss(colorObj, config.baseSpacing, config.borderRadius, weightVal, config.useMono);
    const scssCode = getScss(colorObj, config.baseSpacing, config.borderRadius, weightVal, config.useMono);
    const swiftCode = getSwift(colorObj, config.baseSpacing, config.borderRadius, weightVal, config.useMono);
    const composeCode = getCompose(colorObj, config.baseSpacing, config.borderRadius, weightVal, config.useMono);

    // 3. Mettre à jour les conteneurs de code
    const setCodeText = (selector, code) => {
      const el = resolveElement(selector);
      if (el) {
        const codeNode = el.tagName === "CODE" ? el : el.querySelector("code") || el;
        codeNode.textContent = code;
      }
    };

    setCodeText(config.jsonCode, jsonCode);
    setCodeText(config.cssCode, cssCode);
    setCodeText(config.scssCode, scssCode);
    setCodeText(config.swiftCode, swiftCode);
    setCodeText(config.composeCode, composeCode);

    // Dispatcher la valeur pour OJS si besoin
    container.dispatchEvent(new CustomEvent("input", { 
      detail: { ...config, color: colorObj, weight: weightVal } 
    }));
  };

  // Exposer une méthode de mise à jour pour OJS
  container.update = (newOptions) => {
    if (newOptions.brandColor !== undefined) config.brandColor = newOptions.brandColor;
    if (newOptions.baseSpacing !== undefined) config.baseSpacing = parseFloat(newOptions.baseSpacing) || 16;
    if (newOptions.borderRadius !== undefined) config.borderRadius = parseFloat(newOptions.borderRadius) || 12;
    if (newOptions.fontWeight !== undefined) config.fontWeight = newOptions.fontWeight;
    if (newOptions.useMono !== undefined) config.useMono = newOptions.useMono === true;
    update();
  };

  const destroy = () => {
    const mockupEl = resolveElement(config.mockupContainer);
    if (mockupEl) mockupEl.innerHTML = "";
    const jsonEl = resolveElement(config.jsonCode);
    if (jsonEl) jsonEl.textContent = "";
    const cssEl = resolveElement(config.cssCode);
    if (cssEl) cssEl.textContent = "";
    const scssEl = resolveElement(config.scssCode);
    if (scssEl) scssEl.textContent = "";
    const swiftEl = resolveElement(config.swiftCode);
    if (swiftEl) swiftEl.textContent = "";
    const composeEl = resolveElement(config.composeCode);
    if (composeEl) composeEl.textContent = "";
  };

  if (invalidation) {
    invalidation.then(destroy);
  }

  // Lancer le premier rendu
  update();

  return container;
}

/* -----------------------------------------------------------------------------
   GÉNÉRATEURS DE CODE DE PIPELINE
   ----------------------------------------------------------------------------- */

function getJson(color, spacing, radius, weight, mono) {
  return JSON.stringify({
    "color": {
      "primitive": {
        [color.primitive]: { "value": color.hex }
      },
      "semantic": {
        "brand-primary": { "value": `{color.primitive.${color.primitive}}` },
        "text-main": { "value": "#839496" },
        "bg-surface": { "value": "#073642" }
      }
    },
    "spacing": {
      "primitive": {
        "base": { "value": `${spacing}px` }
      },
      "semantic": {
        "layout-padding": { "value": "{spacing.primitive.base}" },
        "gap-medium": { "value": "{spacing.primitive.base}" }
      }
    },
    "radius": {
      "component": {
        "card-border": { "value": `${radius}px` },
        "button-border": { "value": `${radius}px` }
      }
    },
    "font": {
      "family": {
        "base": { "value": mono ? "Recursive, monospace" : "Outfit, sans-serif" }
      },
      "weight": {
        "title": { "value": String(weight) }
      }
    }
  }, null, 2);
}

function getCss(color, spacing, radius, weight, mono) {
  return `:root {
  /* --- Primitives --- */
  --color-${color.primitive}: ${color.hex};
  --spacing-base: ${spacing}px;
  --font-family-base: ${mono ? '"Recursive", monospace' : '"Outfit", sans-serif'};

  /* --- Semantics --- */
  --color-brand-primary: var(--color-${color.primitive});
  --color-text-main: var(--sol-base00);
  --color-bg-surface: var(--sol-base02);
  --spacing-layout-padding: var(--spacing-base);
  --spacing-gap-medium: var(--spacing-base);

  /* --- Component --- */
  --radius-card-border: ${radius}px;
  --radius-button-border: ${radius}px;
  --font-weight-title: ${weight};
}`;
}

function getScss(color, spacing, radius, weight, mono) {
  return `// --- Primitives ---
$color-${color.primitive}: ${color.hex};
$spacing-base: ${spacing}px;
$font-family-base: ${mono ? '"Recursive", monospace' : '"Outfit", sans-serif'};

// --- Semantics ---
$color-brand-primary: $color-${color.primitive};
$color-text-main: $sol-base00;
$color-bg-surface: $sol-base02;
$spacing-layout-padding: $spacing-base;
$spacing-gap-medium: $spacing-base;

// --- Component ---
$radius-card-border: ${radius}px;
$radius-button-border: ${radius}px;
$font-weight-title: ${weight};`;
}

function getSwift(color, spacing, radius, weight, mono) {
  const camelColor = color.primitive.replace(/-([a-z0-9])/g, g => g[1].toUpperCase());
  const formattedColor = camelColor.charAt(0).toUpperCase() + camelColor.slice(1);
  return `import SwiftUI

struct AppDesignTokens {
    // --- Primitives ---
    static let color${formattedColor} = Color(hex: "${color.hex}")
    static let spacingBase: CGFloat = ${spacing.toFixed(1)}
    static let fontFamilyBase = "${mono ? "Recursive" : "Outfit"}"

    // --- Semantics ---
    static let colorBrandPrimary = color${formattedColor}
    static let colorTextMain = Color(hex: "#839496")
    static let colorBgSurface = Color(hex: "#073642")
    static let spacingLayoutPadding = spacingBase
    static let spacingGapMedium = spacingBase

    // --- Component ---
    static let radiusCardBorder: CGFloat = ${radius.toFixed(1)}
    static let radiusButtonBorder: CGFloat = ${radius.toFixed(1)}
    static let fontWeightTitle = Font.Weight.${weight === 400 ? "regular" : weight === 700 ? "bold" : "black"}
}`;
}

function getCompose(color, spacing, radius, weight, mono) {
  const pascalColor = color.primitive.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const hexValue = color.hex.replace('#', '0xFF').toUpperCase();
  return `package com.aptispace.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.font.FontFamily

object AppDesignTokens {
    // --- Primitives ---
    val Color${pascalColor} = Color(${hexValue})
    val SpacingBase = ${spacing}.dp
    val FontFamilyBase = ${mono ? "FontFamily.Monospace" : "FontFamily.Default"}

    // --- Semantics ---
    val ColorBrandPrimary = Color${pascalColor}
    val ColorTextMain = Color(0xFF839496)
    val ColorBgSurface = Color(0xFF073642)
    val SpacingLayoutPadding = SpacingBase
    val SpacingGapMedium = SpacingBase

    // --- Component ---
    val RadiusCardBorder = ${radius}.dp
    val RadiusButtonBorder = ${radius}.dp
    val FontWeightTitle = ${weight === 400 ? "FontWeight.Normal" : weight === 700 ? "FontWeight.Bold" : "FontWeight.ExtraBold"}
}`;
}
