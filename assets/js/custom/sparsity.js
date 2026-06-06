// ==========================================
// sparsity.js — Sparsity Simulator Component
// ==========================================

import { createTerminal } from "./terminal.js";
import { createSimulationControl } from "./simulation-control.js";
import { createVuMeter, createLine } from "../plots.js";

/**
 * Initializes and manages the Sparsity Simulator (Le Mur de la Sparsité).
 * Coordinates text rendering, terminal simulation, vu-meter gauge, memory history plot,
 * and updates reactive OJS variables for metrics and circular progress comparisons.
 */
export function createSparsitySimulator({
  terminalSelector,
  vuSelector,
  historySelector,
  controlSelector,
  tweetSelector,
  onUpdate,
  invalidation
}) {
  const defaultText = "L' IA transforme notre façon de travailler chaque jour.";
  const maxVisibleTokens = 3500;
  const vocabSize = 100000;
  const docCount = 10000;

  // 1. Resolve tweet container and render text spans
  const tweetContainer = typeof tweetSelector === "string" ? document.querySelector(tweetSelector) : tweetSelector;
  const words = defaultText.split(" ");
  
  const initTweetEmbed = () => {
    if (tweetContainer) {
      tweetContainer.innerHTML = `
        <div class="tweet-embed">
          <div class="tweet-header">
            <i class="bi bi-twitter text-info"></i>
            <span>Twitter @Aptitek</span>
          </div>
          <div class="tweet-content"></div>
          <div class="tweet-footer">10:14 AM · 8 Mai 2026</div>
        </div>
      `;
      const contentEl = tweetContainer.querySelector(".tweet-content");
      contentEl.innerHTML = words.map(w => `<span class="tweet-word">${w}</span>`).join(" ");
    }
  };
  initTweetEmbed();

  // 2. Initialize terminal
  const terminal = createTerminal(terminalSelector, { defaultPrompt: false, showCursor: false });

  // 3. Keep track of simulation states
  let isRunning = false;
  let intervalId = null;
  let currentTokenIndex = 0;
  let zerosCount = 0;
  let onesCount = 0;
  let wordsHighlighted = 0;
  let currentDisplayMB = 204.8; // smooth interpolation memory tracker
  let activeLine = null; // single continuous line handle to prevent erratic wrapping

  // Initialize random indices for 1s (matching the 9 words of the tweet)
  const onesIndices = [120, 480, 920, 1340, 1780, 2120, 2450, 2890, 3210];
  const onesSet = new Set(onesIndices);

  // Randomized tweet word highlighting order
  let randomIndices = [];
  const shuffleWordIndices = () => {
    randomIndices = Array.from({ length: words.length }, (_, i) => i)
      .sort(() => Math.random() - 0.5);
  };
  shuffleWordIndices();

  // Keep history arrays for memory plot (pre-filled rolling buffer)
  const historyX = Array.from({ length: 100 }, (_, i) => i);
  const historyY = Array.from({ length: 100 }, () => 204.8 + (Math.random() - 0.5) * 40);

  const clearHighlights = () => {
    if (tweetContainer) {
      tweetContainer.querySelectorAll(".tweet-word").forEach(span => {
        span.classList.remove("highlight");
      });
    }
  };

  // 4. Rolling background resource updates (Vu Meter and Line chart)
  const updateRollingCharts = () => {
    const totalTokens = (currentTokenIndex === vocabSize) ? vocabSize : currentTokenIndex;
    const baseMB = (docCount * totalTokens * 4) / (1024 * 1024);
    const targetMB = Math.max(204.8, baseMB);
    
    // Smooth transition: current value climbs/slides towards targetMB
    const alpha = 0.15; // interpolation coefficient
    currentDisplayMB = currentDisplayMB + alpha * (targetMB - currentDisplayMB);

    // Add realistic sensor noise (jitter) to the monitors
    const jitter = (Math.random() - 0.5) * 35;
    const currentVal = Math.max(0, Math.min(4096, currentDisplayMB + jitter));

    // Update Vu Meter
    createVuMeter(vuSelector, currentVal, 4096, {
      layout: { title: "Usage Mémoire (Matrice)" }
    });

    // Update Rolling Line History
    historyY.push(currentVal);
    if (historyY.length > 100) {
      historyY.shift();
    }
    createLine(historySelector, { x: historyX, y: historyY }, "Historique RAM (MB)", {
      layout: {
        margin: { t: 40, b: 25, l: 45, r: 15 },
        xaxis: { showgrid: false, zeroline: false, visible: false },
        yaxis: { range: [0, 4096], showgrid: true }
      }
    });
  };

  // Start the background rolling monitor loop
  let rollingIntervalId = setInterval(updateRollingCharts, 120);

  // Updates non-rolling metrics and progress indicators
  const updateMetrics = () => {
    const densityVal = (onesCount / (zerosCount + onesCount || 1)) * 100;
    const densityLabel = densityVal.toFixed(4) + " %";

    // Propagate updates to OJS
    if (typeof onUpdate === "function") {
      onUpdate({
        densityVal,
        density: densityLabel
      });
    }
  };

  const resetSimulation = () => {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    currentTokenIndex = 0;
    zerosCount = 0;
    onesCount = 0;
    wordsHighlighted = 0;
    currentDisplayMB = 204.8;
    activeLine = null;
    shuffleWordIndices();
    clearHighlights();
    terminal.clear();
    updateMetrics();
  };

  const runTick = () => {
    if (currentTokenIndex >= maxVisibleTokens) {
      isRunning = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      // Append truncation log
      terminal.writeLine("... [Mémoire saturée : " + (vocabSize - maxVisibleTokens).toLocaleString("fr-FR") + " zéros supplémentaires tronqués] ...", {
        html: false,
        type: "danger"
      });

      // Jump to full vector size
      zerosCount += (vocabSize - maxVisibleTokens);
      currentTokenIndex = vocabSize;

      // Highlight all words
      if (tweetContainer) {
        tweetContainer.querySelectorAll(".tweet-word").forEach(span => {
          span.classList.add("highlight");
        });
      }

      updateMetrics();
      
      // Update simulation controller UI state
      if (ctrl) {
        ctrl.setState("idle");
      }
      return;
    }

    // Initialize or resolve single active line to prevent line breaks
    if (!activeLine) {
      activeLine = terminal.writeLine("", { html: true });
    }

    // Print a chunk of 80 tokens in one terminal line to keep animation fluid and visible
    const chunkSize = 80;
    let lineHTML = "";
    
    for (let i = 0; i < chunkSize && currentTokenIndex < maxVisibleTokens; i++) {
      if (onesSet.has(currentTokenIndex)) {
        lineHTML += '<span class="token-highlight">1</span>';
        onesCount++;
        
        // Highlight word in the tweet using randomized indices
        if (tweetContainer && wordsHighlighted < randomIndices.length) {
          const idx = randomIndices[wordsHighlighted];
          const spans = tweetContainer.querySelectorAll(".tweet-word");
          if (spans[idx]) {
            spans[idx].classList.add("highlight");
          }
          wordsHighlighted++;
        }
      } else {
        lineHTML += "0";
        zerosCount++;
      }
      currentTokenIndex++;
    }

    // Append directly to active continuous line's inner HTML
    activeLine.setContent(activeLine.contentSpan.innerHTML + lineHTML);
    updateMetrics();
  };

  const startTimer = () => {
    isRunning = true;
    intervalId = setInterval(runTick, 35); // optimal fast playback delay
  };

  const pauseTimer = () => {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  // 5. Create control callbacks
  const ctrl = createSimulationControl(controlSelector, {
    onStart: () => {
      if (currentTokenIndex >= vocabSize) {
        resetSimulation();
      }
      if (!isRunning) {
        startTimer();
      }
    },
    onPause: () => {
      pauseTimer();
    },
    onStop: () => {
      resetSimulation();
    },
    onRestart: () => {
      resetSimulation();
      startTimer();
    }
  }, invalidation);

  // Initialize metrics
  updateMetrics();

  const destroy = () => {
    resetSimulation();
    if (rollingIntervalId) {
      clearInterval(rollingIntervalId);
      rollingIntervalId = null;
    }
    if (ctrl) ctrl.destroy();
    if (terminal) terminal.destroy();
  };

  if (invalidation) {
    invalidation.then(destroy);
  }

  return {
    destroy,
    reset: resetSimulation
  };
}
