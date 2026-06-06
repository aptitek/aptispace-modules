/**
 * terminal.js
 * Composant générique pour simuler un terminal en mode texte.
 * Permet d'écrire du texte progressivement, de gérer des spinners et des barres de progression.
 */

function resolveElement(elementOrSelector) {
  return typeof elementOrSelector === "string"
    ? document.querySelector(elementOrSelector)
    : elementOrSelector;
}

/**
 * Crée un terminal interactif sur l'élément spécifié.
 *
 * @param {string|Element} selectorOrElement - L'élément conteneur.
 * @param {Object} options - Options de configuration du terminal.
 * @param {string} [options.defaultPrompt="› "] - Le prompt par défaut.
 * @returns {Object} L'API de contrôle du terminal.
 */
export function createTerminal(selectorOrElement, options = {}) {
  let container = resolveElement(selectorOrElement);
  if (!container) {
    console.warn(`createTerminal: Conteneur introuvable pour "${selectorOrElement}".`);
    return null;
  }

  // Si le conteneur a la classe .terminal, on cible son .card-body (généré par le filtre Quarto)
  const body = container.querySelector(".card-body") || container;
  
  const defaultPromptChar = options.defaultPrompt !== undefined ? options.defaultPrompt : "› ";
  
  let promptCursorLine = null;

  /**
   * Ajoute une ligne dans le terminal.
   */
  function writeLine(text = "", lineOptions = {}) {
    const lineEl = document.createElement("div");
    lineEl.className = "terminal-line";
    
    // Classes additionnelles facultatives (ex. fw-bold)
    if (lineOptions.class) {
      lineEl.classList.add(lineOptions.class);
    }
    
    // Couleurs sémantiques Bootstrap (ex. warning -> text-warning)
    if (lineOptions.type) {
      lineEl.classList.add(`text-${lineOptions.type}`);
    }

    const showPrompt = lineOptions.prompt ?? (options.defaultPrompt !== false);
    if (showPrompt) {
      const promptSpan = document.createElement("span");
      promptSpan.className = "terminal-prompt";
      promptSpan.textContent = lineOptions.promptChar || defaultPromptChar;
      lineEl.appendChild(promptSpan);
    }

    const contentSpan = document.createElement("span");
    contentSpan.className = "terminal-line-content";
    if (lineOptions.html) {
      contentSpan.innerHTML = text;
    } else {
      contentSpan.textContent = text;
    }
    lineEl.appendChild(contentSpan);

    // Si le promptCursorLine existe, on insère la nouvelle ligne AVANT le curseur de prompt global
    if (promptCursorLine && promptCursorLine.element.parentNode === body) {
      body.insertBefore(lineEl, promptCursorLine.element);
    } else {
      body.appendChild(lineEl);
    }

    // Auto-scroll du terminal vers le bas
    container.scrollTop = container.scrollHeight;

    const lineHandle = {
      element: lineEl,
      contentSpan: contentSpan,
      setContent(newText) {
        if (lineOptions.html) {
          contentSpan.innerHTML = newText;
        } else {
          contentSpan.textContent = newText;
        }
        container.scrollTop = container.scrollHeight;
      },
      addCursor() {
        contentSpan.classList.add("terminal-cursor");
      },
      removeCursor() {
        contentSpan.classList.remove("terminal-cursor");
      }
    };

    return lineHandle;
  }

  /**
   * Écrit du texte progressivement (effet machine à écrire).
   */
  async function type(text, typeOptions = {}) {
    const line = writeLine("", {
      prompt: typeOptions.prompt,
      type: typeOptions.type,
      class: typeOptions.class,
      promptChar: typeOptions.promptChar
    });

    if (typeOptions.showCursor !== false) {
      line.addCursor();
    }

    const speed = typeOptions.speed ?? 30;
    for (let i = 0; i <= text.length; i++) {
      line.setContent(text.slice(0, i));
      if (speed > 0 && i < text.length) {
        await new Promise(resolve => setTimeout(resolve, speed));
      }
    }

    if (typeOptions.keepCursor !== true) {
      line.removeCursor();
    }

    return line;
  }

  /**
   * Affiche une barre de progression en mode texte.
   */
  function writeProgress(label, initialPercent = 0, progressOptions = {}) {
    const line = writeLine("", {
      prompt: progressOptions.prompt ?? false,
      type: progressOptions.type,
      class: progressOptions.class
    });

    const width = progressOptions.width || 20;

    function formatBar(percent, currentLabel) {
      const clamped = Math.min(100, Math.max(0, percent));
      const filledCount = Math.round((clamped / 100) * width);
      const emptyCount = width - filledCount;
      const bar = "█".repeat(filledCount) + "░".repeat(emptyCount);
      return `${currentLabel} [${bar}] ${Math.round(clamped)}%`;
    }

    line.setContent(formatBar(initialPercent, label));

    return {
      update(percent, newLabel = label) {
        line.setContent(formatBar(percent, newLabel));
      },
      finish(finalText, finalType = null) {
        if (finalText !== undefined) {
          line.setContent(finalText);
        }
        if (finalType) {
          line.element.className = "terminal-line";
          if (progressOptions.class) line.element.classList.add(progressOptions.class);
          line.element.classList.add(`text-${finalType}`);
        }
        line.removeCursor();
      }
    };
  }

  /**
   * Lance un spinner textuel animé.
   */
  function startSpinner(label, spinnerOptions = {}) {
    const line = writeLine("", {
      prompt: spinnerOptions.prompt ?? false,
      type: spinnerOptions.type,
      class: spinnerOptions.class
    });

    const frames = spinnerOptions.frames || ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let frameIndex = 0;
    let currentLabel = label;

    const intervalId = setInterval(() => {
      const frame = frames[frameIndex];
      line.setContent(`${frame} ${currentLabel}`);
      frameIndex = (frameIndex + 1) % frames.length;
    }, spinnerOptions.interval || 80);

    return {
      updateLabel(newLabel) {
        currentLabel = newLabel;
      },
      stop(finalText, finalType = null) {
        clearInterval(intervalId);
        if (finalText !== undefined) {
          line.setContent(finalText);
        }
        if (finalType) {
          line.element.className = "terminal-line";
          if (spinnerOptions.class) line.element.classList.add(spinnerOptions.class);
          line.element.classList.add(`text-${finalType}`);
        }
        line.removeCursor();
      }
    };
  }

  /**
   * Vide le terminal.
   */
  function clear() {
    body.innerHTML = "";
    promptCursorLine = null;
  }

  /**
   * Gère le curseur de prompt global persistant à la fin du terminal.
   */
  function setPromptCursor(visible) {
    if (visible) {
      if (!promptCursorLine) {
        promptCursorLine = writeLine("", { prompt: true });
        promptCursorLine.addCursor();
      }
    } else {
      if (promptCursorLine) {
        promptCursorLine.element.remove();
        promptCursorLine = null;
      }
    }
  }

  // Si l'option showCursor est activée, on affiche le curseur initial
  if (options.showCursor !== false) {
    setPromptCursor(true);
  }

  return {
    writeLine,
    type,
    writeProgress,
    startSpinner,
    clear,
    setPromptCursor,
    destroy() {
      clear();
    }
  };
}
