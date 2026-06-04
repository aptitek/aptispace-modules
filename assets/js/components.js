// ==========================================
// components.js - Generic DOM Components
// ==========================================

import { theme } from "./core.js";
import { tokenizeText } from "./encoding.js";

function resolveElement(elementOrSelector) {
  return typeof elementOrSelector === "string"
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
}

function normalizeToken(token, index, color, label) {
  const text = typeof token === "object" ? token.text : token;
  return {
    ...(typeof token === "object" ? token : {}),
    text,
    index,
    color,
    label
  };
}

/**
 * Creates a generic token stream component in an existing container.
 *
 * @param {string|Element} selectorOrElement
 * @param {Object} options
 * @returns {{ element: Element, update: Function, destroy: Function }}
 */
export function createTokenStream(selectorOrElement, options = {}) {
  let container = resolveElement(selectorOrElement);

  if (!container) {
    console.warn(`createTokenStream: Container not found for selector "${selectorOrElement}". Falling back to a detached div.`);
    container = document.createElement("div");
  }

  container.classList.add(options.containerClass || "token-stream");

  const tokenizer = options.tokenizer || (text => tokenizeText(text, options.tokenizerOptions));
  const spaceMarker = options.spaceMarker !== undefined ? options.spaceMarker : "Ġ";
  const showLabels = options.showLabels !== false;
  const generateIds = options.generateIds !== false;
  const colors = options.colors || [
    theme.colors.info,
    theme.colors.danger,
    theme.colors.success,
    theme.colors.warning,
    theme.colors.primary,
    theme.colors.debug
  ];

  let currentTokens = [];

  function render(tokensToRender) {
    container.innerHTML = "";
    currentTokens = tokensToRender || [];

    if (currentTokens.length === 0) {
      container.classList.add("is-empty");
      const emptyMessage = document.createElement("div");
      emptyMessage.className = options.emptyClass || "text-muted p-3 italic small";
      emptyMessage.textContent = options.emptyMessage || "Aucun texte à afficher...";
      container.appendChild(emptyMessage);
      return;
    }

    container.classList.remove("is-empty");

    currentTokens.forEach((token, index) => {
      const textValue = typeof token === "object" ? token.text : token;
      const hasSpace = typeof token === "object" ? !!token.hasSpace : false;
      const isFragment = typeof token === "object" ? !!token.isFragment : false;
      const color = typeof token === "object" && token.color
        ? token.color
        : colors[index % colors.length];

      let label = "";
      if (showLabels) {
        if (typeof token === "object" && token.label !== undefined) {
          label = token.label;
        } else if (generateIds) {
          label = typeof token === "object" && token.id !== undefined
            ? token.id
            : Math.floor(Math.abs(Math.sin(index + 1) * 90000) + 10000);
        }
      }

      const tooltip = typeof token === "object" && token.tooltip
        ? token.tooltip
        : `Token: "${textValue}"\nIndex: ${index}\nFragment: ${isFragment ? "Oui" : "Non"}${label ? `\nID: ${label}` : ""}`;

      const tokenElement = document.createElement("div");
      tokenElement.className = options.itemClass || "token-item";
      tokenElement.style.setProperty("--token-color", color);

      const node = document.createElement("div");
      node.className = `${options.nodeClass || "token-node"} ${isFragment ? "is-fragment" : ""}`.trim();
      node.setAttribute("title", tooltip);

      if (hasSpace && spaceMarker) {
        const marker = document.createElement("span");
        marker.className = options.spaceMarkerClass || "space-marker";
        marker.textContent = spaceMarker;
        node.appendChild(marker);
      }

      const textSpan = document.createElement("span");
      textSpan.textContent = textValue;
      node.appendChild(textSpan);
      tokenElement.appendChild(node);

      if (showLabels && label) {
        const labelElement = document.createElement("div");
        labelElement.className = options.labelClass || "token-id";
        labelElement.textContent = label;
        tokenElement.appendChild(labelElement);
      }

      node.addEventListener("click", event => {
        const normalized = normalizeToken(token, index, color, label);
        if (typeof options.onTokenClick === "function") {
          options.onTokenClick(normalized, index, event);
        }
        container.dispatchEvent(new CustomEvent("token-click", {
          detail: { token, index, color, label }
        }));
      });

      node.addEventListener("mouseenter", event => {
        if (typeof options.onTokenHover === "function") {
          options.onTokenHover(normalizeToken(token, index, color, label), index, true, event);
        }
      });

      node.addEventListener("mouseleave", event => {
        if (typeof options.onTokenHover === "function") {
          options.onTokenHover(normalizeToken(token, index, color, label), index, false, event);
        }
      });

      container.appendChild(tokenElement);
    });
  }

  let initialTokens = options.tokens;
  if (!initialTokens && options.text) {
    initialTokens = tokenizer(options.text);
  }
  render(initialTokens);

  const controller = {
    element: container,
    update: newTokensOrText => {
      const nextTokens = typeof newTokensOrText === "string"
        ? tokenizer(newTokensOrText)
        : newTokensOrText;
      render(nextTokens);
      return controller;
    },
    destroy: () => {
      container.innerHTML = "";
      container.classList.remove(options.containerClass || "token-stream", "is-empty");
    }
  };

  return controller;
}

/**
 * Wires vertical drag-to-toggle behavior onto an existing DOM structure.
 *
 * @param {Object} options
 * @returns {Element}
 */
export function createVerticalDragToggle(options = {}) {
  const wrapper = resolveElement(options.element || options.selector);
  if (!wrapper) throw new Error(`createVerticalDragToggle: element not found — "${options.selector}"`);

  const handle = resolveElement(options.handle) || wrapper.querySelector(options.handleSelector || ".drag-toggle-handle");
  const stateElement = resolveElement(options.stateElement) || wrapper.querySelector(options.stateSelector || ".drag-toggle-state");
  if (!handle || !stateElement) {
    throw new Error("createVerticalDragToggle: handle and state element are required.");
  }

  const onPosition = options.onPosition ?? 18;
  const offPosition = options.offPosition ?? 82;
  const threshold = options.threshold ?? ((onPosition + offPosition) / 2);
  const getY = event => event.touches ? event.touches[0].clientY : event.clientY;

  wrapper.value = options.initialValue ?? false;

  let dragging = false;
  let startY = 0;
  let startTop = offPosition;

  async function applyState(on) {
    wrapper.value = on;
    stateElement.classList.toggle(options.activeClass || "is-on", on);
    handle.style.removeProperty("top");
    if (typeof options.onChange === "function") {
      await options.onChange(on, wrapper);
    }
    wrapper.dispatchEvent(new CustomEvent(options.eventName || "input"));
  }

  function onDragStart(event) {
    event.preventDefault();
    dragging = true;
    startY = getY(event);
    startTop = wrapper.value ? onPosition : offPosition;
    stateElement.classList.add(options.draggingClass || "is-dragging");
    document.body.classList.add("is-user-select-disabled");
  }

  function onDragMove(event) {
    if (!dragging) return;
    event.preventDefault();
    const raw = startTop + (getY(event) - startY);
    handle.style.top = `${Math.min(offPosition, Math.max(onPosition, raw))}px`;
  }

  function onDragEnd() {
    if (!dragging) return;
    dragging = false;
    stateElement.classList.remove(options.draggingClass || "is-dragging");
    document.body.classList.remove("is-user-select-disabled");
    const current = parseFloat(handle.style.top);
    const landed = Number.isNaN(current) ? (wrapper.value ? onPosition : offPosition) : current;
    applyState(landed < threshold);
  }

  handle.addEventListener("mousedown", onDragStart);
  handle.addEventListener("touchstart", onDragStart, { passive: false });
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("touchmove", onDragMove, { passive: false });
  document.addEventListener("mouseup", onDragEnd);
  document.addEventListener("touchend", onDragEnd);

  const destroy = () => {
    handle.removeEventListener("mousedown", onDragStart);
    handle.removeEventListener("touchstart", onDragStart);
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchend", onDragEnd);
    document.body.classList.remove("is-user-select-disabled");
  };

  wrapper.destroy = destroy;
  if (options.invalidation) {
    options.invalidation.then(destroy);
  }

  return wrapper;
}
