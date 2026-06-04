// ==========================================
// text.js — Labeled Text & Token Stream Component
// ==========================================
// Usage (OJS):
//   import { createLabeledText } from "./assets/js/custom/text.js"
//
//   widget = createLabeledText("#my-token-stream", {
//     text: "L'IA comprend-elle le mot anticonstitutionnellement ? 🤔",
//     onTokenClick: (tok, idx) => console.log(tok, idx)
//   })
//

import { theme } from "../core.js";

/**
 * Default premium tokenizer that splits text into structured tokens resembling BPE tokenization.
 * 
 * @param {string} text - Raw input string to tokenize
 * @returns {Array} - Array of token objects: { text, label, color, isFragment, hasSpace }
 */
export function tokenizeText(text) {
  if (!text || typeof text !== "string") return [];

  // Primordial tokenization matching BPE-like patterns
  const regex = / ?[a-zA-ZÀ-ÿ0-9]+| ?[^\s\w\p{Emoji_Presentation}]+| ?\p{Emoji_Presentation}/gu;
  const matches = text.match(regex) || [];

  const tokens = [];
  matches.forEach((m, idx) => {
    let cleanText = m;
    let hasSpace = false;
    if (m.startsWith(" ")) {
      hasSpace = true;
      cleanText = m.substring(1);
    }

    // Identify fragment pattern mimicking BPE segments
    const lower = cleanText.toLowerCase();
    if (lower === "anticonstitutionnellement") {
      tokens.push({ text: "anti", isFragment: true, hasSpace: hasSpace });
      tokens.push({ text: "constitution", isFragment: true, hasSpace: false });
      tokens.push({ text: "nelle", isFragment: true, hasSpace: false });
      tokens.push({ text: "ment", isFragment: false, hasSpace: false });
    } else if (cleanText.length > 9 && !/\s/.test(cleanText)) {
      // Split long words in half to simulate fragments
      const mid = Math.floor(cleanText.length / 2);
      tokens.push({ text: cleanText.substring(0, mid), isFragment: true, hasSpace: hasSpace });
      tokens.push({ text: cleanText.substring(mid), isFragment: false, hasSpace: false });
    } else {
      tokens.push({ text: cleanText, isFragment: false, hasSpace: hasSpace });
    }
  });

  return tokens;
}

/**
 * Creates and wires up a new Labeled Text / Token Stream visualizer in the DOM.
 * 
 * @param {string|Element} selectorOrElement - The DOM container or CSS selector
 * @param {Object} options - Configuration options
 * @returns {Object} - Controller object with .update(), .element, and .destroy()
 */
export function createLabeledText(selectorOrElement, options = {}) {
  let container = typeof selectorOrElement === "string"
    ? document.querySelector(selectorOrElement)
    : selectorOrElement;

  if (!container) {
    console.warn(`createLabeledText: Container not found for selector "${selectorOrElement}". Falling back to a detached div.`);
    container = document.createElement("div");
  }

  // Ensure standard styling class is applied
  container.classList.add("org-token-stream");

  // Options defaults
  const spaceMarker = options.spaceMarker !== undefined ? options.spaceMarker : "Ġ";
  const showLabels = options.showLabels !== false;
  const generateIds = options.generateIds !== false;
  const colors = options.colors || [
    theme.colors.info,     // var(--sol-blue)
    theme.colors.danger,   // var(--sol-red)
    theme.colors.success,  // var(--sol-green)
    theme.colors.warning,  // var(--sol-orange)
    theme.colors.primary,  // var(--sol-yellow)
    theme.colors.debug     // var(--sol-violet)
  ];

  let currentTokens = [];

  // Setup main render helper
  function render(tokensToRender) {
    container.innerHTML = "";
    currentTokens = tokensToRender || [];

    if (currentTokens.length === 0) {
      container.classList.add("is-empty");
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "text-muted p-3 italic small";
      emptyMsg.textContent = options.emptyMessage || "Aucun texte à afficher...";
      container.appendChild(emptyMsg);
      return;
    }

    container.classList.remove("is-empty");

    currentTokens.forEach((tok, index) => {
      // Determine token attributes
      const textVal = typeof tok === "object" ? tok.text : tok;
      const hasSpace = typeof tok === "object" ? !!tok.hasSpace : false;
      const isFragment = typeof tok === "object" ? !!tok.isFragment : false;
      
      // Determine color
      let color = colors[index % colors.length];
      if (typeof tok === "object" && tok.color) {
        color = tok.color;
      }

      // Determine label/ID
      let labelVal = "";
      if (showLabels) {
        if (typeof tok === "object" && tok.label !== undefined) {
          labelVal = tok.label;
        } else if (generateIds) {
          // Stable pseudo-random ID generator or fallback
          labelVal = typeof tok === "object" && tok.id !== undefined 
            ? tok.id 
            : Math.floor(Math.abs(Math.sin(index + 1) * 90000) + 10000);
        }
      }

      // Tooltip/title details
      let tooltip = "";
      if (typeof tok === "object" && tok.tooltip) {
        tooltip = tok.tooltip;
      } else {
        tooltip = `Token: "${textVal}"\nIndex: ${index}\nFragment: ${isFragment ? 'Oui' : 'Non'}`;
        if (labelVal) tooltip += `\nID: ${labelVal}`;
      }

      // Build DOM structures with vanilla JS for robustness and memory-efficiency
      const tokenEl = document.createElement("div");
      tokenEl.className = "mol-token";
      tokenEl.style.setProperty("--token-color", color);

      const node = document.createElement("div");
      node.className = `token-node ${isFragment ? "is-fragment" : ""}`;
      node.setAttribute("title", tooltip);

      if (hasSpace && spaceMarker) {
        const marker = document.createElement("span");
        marker.className = "space-marker";
        marker.textContent = spaceMarker;
        node.appendChild(marker);
      }

      const textSpan = document.createElement("span");
      textSpan.textContent = textVal;
      node.appendChild(textSpan);

      tokenEl.appendChild(node);

      if (showLabels && labelVal) {
        const labelEl = document.createElement("div");
        labelEl.className = "token-id";
        labelEl.textContent = labelVal;
        tokenEl.appendChild(labelEl);
      }

      // Register interactivity/events
      node.addEventListener("click", (e) => {
        // Dispatch standard click callback
        if (typeof options.onTokenClick === "function") {
          options.onTokenClick({ ...tok, text: textVal, index, color, label: labelVal }, index, e);
        }
        
        // Dispatch CustomEvent on container for reactive OJS observation
        container.dispatchEvent(new CustomEvent("token-click", {
          detail: { token: tok, index, color, label: labelVal }
        }));
      });

      node.addEventListener("mouseenter", (e) => {
        if (typeof options.onTokenHover === "function") {
          options.onTokenHover({ ...tok, text: textVal, index, color, label: labelVal }, index, true, e);
        }
      });

      node.addEventListener("mouseleave", (e) => {
        if (typeof options.onTokenHover === "function") {
          options.onTokenHover({ ...tok, text: textVal, index, color, label: labelVal }, index, false, e);
        }
      });

      container.appendChild(tokenEl);
    });
  }

  // Handle initialization
  let initialTokens = options.tokens;
  if (!initialTokens && options.text) {
    initialTokens = tokenizeText(options.text);
  }
  render(initialTokens);

  // Return component controller/handle
  const controller = {
    element: container,
    update: (newTokensOrText) => {
      let nextTokens = newTokensOrText;
      if (typeof newTokensOrText === "string") {
        nextTokens = tokenizeText(newTokensOrText);
      }
      render(nextTokens);
      return controller;
    },
    destroy: () => {
      container.innerHTML = "";
      container.classList.remove("org-token-stream", "is-empty");
    }
  };

  return controller;
}
