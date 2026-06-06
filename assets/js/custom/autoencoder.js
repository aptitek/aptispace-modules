// =====================================================================
// autoencoder.js — Hourglass Simulation driven by Tabset
// =====================================================================

function selectTabByTitle(title) {
  const links = document.querySelectorAll(".ae-tabset .nav-link");
  for (const link of links) {
    if (link.textContent.replace(/\uFFFD/g, "").trim() === title) {
      link.click();
      break;
    }
  }
}

/**
 * Render a dynamic hourglass autoencoder simulation driven by the active tabset state.
 * @param {HTMLElement} containerEl
 * @param {{ bottleneckDim, inputDim, activeState }} params
 */
export function updateAutoencoderViz(containerEl, { bottleneckDim = 4, inputDim = 32, activeState = "ENCODING" } = {}) {
  if (!containerEl) return;

  const dIN = Math.max(8, Math.min(128, Math.round(+inputDim)));
  const dBN = Math.max(2, Math.min(16, Math.round(+bottleneckDim)));

  // If already initialized on this container, just update parameters
  if (containerEl.__state) {
    const st = containerEl.__state._internal;
    st.inputDim = dIN;
    st.bottleneckDim = dBN;
    st.activeStateId = activeState;
    st.updateNeck();
    st.adjustParticlesCount();
    
    // Return the playback controller API
    return containerEl.__state.api;
  }

  // --- Initial Setup ---
  containerEl.innerHTML = "";
  containerEl.style.setProperty("display", "flex");
  containerEl.style.setProperty("justify-content", "center");
  containerEl.style.setProperty("align-items", "center");

  const W = 320, H = 400;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.setProperty("width", "100%");
  svg.style.setProperty("height", "100%");
  svg.style.setProperty("background", "transparent");
  containerEl.appendChild(svg);

  // Helper for SVG elements
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  // Define gradients and filter effects
  const defs = svgEl("defs");
  svg.appendChild(defs);

  const glassGrad = svgEl("linearGradient", { id: "glassGrad", x1: "0%", y1: "0%", x2: "100%", y2: "0%" });
  glassGrad.appendChild(svgEl("stop", { offset: "0%", "stop-color": "rgba(38, 139, 210, 0.16)" }));
  glassGrad.appendChild(svgEl("stop", { offset: "50%", "stop-color": "rgba(38, 139, 210, 0.05)" }));
  glassGrad.appendChild(svgEl("stop", { offset: "100%", "stop-color": "rgba(38, 139, 210, 0.22)" }));
  defs.appendChild(glassGrad);

  // Wooden support caps and pillars (behind the glass)
  const capTop = svgEl("rect", { x: "15", y: "15", width: "290", height: "10", fill: "var(--sol-base01)", rx: "3" });
  const capBottom = svgEl("rect", { x: "15", y: "375", width: "290", height: "10", fill: "var(--sol-base01)", rx: "3" });
  const leftRod = svgEl("rect", { x: "18", y: "25", width: "6", height: "350", fill: "var(--sol-base02)", rx: "2" });
  const rightRod = svgEl("rect", { x: "296", y: "25", width: "6", height: "350", fill: "var(--sol-base02)", rx: "2" });
  svg.append(leftRod, rightRod, capTop, capBottom);

  // Glass volume fill path (will have its "d" set dynamically in stateObj.updateNeck)
  const bgPath = svgEl("path", { fill: "url(#glassGrad)" });
  svg.appendChild(bgPath);

  // Particle container group
  const particleGroup = svgEl("g");
  svg.appendChild(particleGroup);

  // Hourglass Glass Borders (front walls)
  const wallLeft = svgEl("path", { fill: "none", stroke: "var(--sol-base00)", "stroke-width": "3.5" });
  const wallRight = svgEl("path", { fill: "none", stroke: "var(--sol-base00)", "stroke-width": "3.5" });
  const lidTop = svgEl("line", { x1: 30, y1: 25, x2: 290, y2: 25, stroke: "var(--sol-base00)", "stroke-width": "4" });
  const lidBottom = svgEl("line", { x1: 30, y1: 375, x2: 290, y2: 375, stroke: "var(--sol-base00)", "stroke-width": "4" });
  svg.append(wallLeft, wallRight, lidTop, lidBottom);

  // Translucent highlights for 3D glass reflection (thick blur highlights + sharp shiny cores)
  const leftHighlight = svgEl("path", {
    d: "M 52,32 C 52,108 140,128 140,158",
    fill: "none",
    stroke: "rgba(253, 246, 227, 0.25)",
    "stroke-width": "4.5",
    "stroke-linecap": "round"
  });
  const leftHighlightCore = svgEl("path", {
    d: "M 53,34 C 53,106 138,126 138,156",
    fill: "none",
    stroke: "rgba(253, 246, 227, 0.75)",
    "stroke-width": "1.2",
    "stroke-linecap": "round"
  });
  const rightHighlight = svgEl("path", {
    d: "M 180,242 C 180,272 268,292 268,368",
    fill: "none",
    stroke: "rgba(253, 246, 227, 0.25)",
    "stroke-width": "4.5",
    "stroke-linecap": "round"
  });
  const rightHighlightCore = svgEl("path", {
    d: "M 182,244 C 182,270 266,290 266,366",
    fill: "none",
    stroke: "rgba(253, 246, 227, 0.75)",
    "stroke-width": "1.2",
    "stroke-linecap": "round"
  });
  svg.append(leftHighlight, leftHighlightCore, rightHighlight, rightHighlightCore);

  // Setup Simulation State & Math
  const stateObj = {
    inputDim: dIN,
    bottleneckDim: dBN,
    activeStateId: activeState,
    particles: [],
    time: 0,
    isPlaying: false,
    stateTimer: 0,
    
    // Updates hourglass neck bounds dynamically based on bottleneck dimension
    updateNeck() {
      const neckHalfWidth = 10 + (this.bottleneckDim / 16) * 35;
      
      const leftD = `M 40,25 C 40,120 ${160 - neckHalfWidth},140 ${160 - neckHalfWidth},180 L ${160 - neckHalfWidth},220 C ${160 - neckHalfWidth},260 40,280 40,375`;
      const rightD = `M 280,25 C 280,120 ${160 + neckHalfWidth},140 ${160 + neckHalfWidth},180 L ${160 + neckHalfWidth},220 C ${160 + neckHalfWidth},260 280,280 280,375`;
      
      wallLeft.setAttribute("d", leftD);
      wallRight.setAttribute("d", rightD);
      
      const bgD = `${leftD} L 280,375 C 280,280 ${160 + neckHalfWidth},260 ${160 + neckHalfWidth},220 L ${160 + neckHalfWidth},180 C ${160 + neckHalfWidth},140 280,120 280,25 Z`;
      bgPath.setAttribute("d", bgD);
    },

    // Dynamically spawn or clean up particles to match target inputDim
    adjustParticlesCount() {
      while (this.particles.length < this.inputDim) {
        const circle = svgEl("circle", { r: 3.5, fill: "var(--sol-blue)" });
        particleGroup.appendChild(circle);
        this.particles.push({
          el: circle,
          x: 100 + Math.random() * 120,
          y: 30 + Math.random() * 40,
          tx: 160,
          ty: 200
        });
      }
      while (this.particles.length > this.inputDim) {
        const p = this.particles.pop();
        p.el.remove();
      }
    }
  };

  stateObj.updateNeck();
  stateObj.adjustParticlesCount();

  let animationId = null;

  function tick() {
    stateObj.time += 0.02;

    // Auto-advance logic for playback: INPUT → ENCODING → LATENT → DECODING → OUTPUT → INPUT
    if (stateObj.isPlaying) {
      stateObj.stateTimer += 1;
      if (stateObj.stateTimer >= 150) {
        stateObj.stateTimer = 0;
        
        const sequence = ["L'Entrée", "L'Encodeur", "Le Bottleneck", "Le Décodeur", "La Sortie"];
        const stateIds = ["INPUT", "ENCODING", "LATENT", "DECODING", "OUTPUT"];
        const idx = stateIds.indexOf(stateObj.activeStateId);
        const nextIdx = (idx + 1) % sequence.length;
        
        window.__aeProgrammaticClick = true;
        selectTabByTitle(sequence[nextIdx]);
        window.__aeProgrammaticClick = false;
      }
    }

    const files = Math.max(1, Math.min(3, Math.floor(stateObj.bottleneckDim / 4)));

    stateObj.particles.forEach((p, i) => {
      let tx = p.x;
      let ty = p.y;
      let targetColor = "var(--sol-blue)";

      // Deterministic layout coordinates
      const col = i % 8;
      const row = Math.floor(i / 8);

      switch (stateObj.activeStateId) {
        case "INPUT":
          // Spread out grid at the top of the hourglass
          tx = 80 + col * 22;
          ty = 40 + row * 14;
          targetColor = "var(--sol-blue)";
          break;

        case "ENCODING":
          // Funneling downwards into neck
          const flowProgress = (stateObj.time + i * 0.07) % 1.0;
          const startX = 80 + col * 22;
          const startY = 40 + row * 14;
          const endX = 160 + (i % files - (files - 1) / 2) * 8;
          const endY = 180;

          tx = startX * (1 - flowProgress) + endX * flowProgress;
          ty = startY * (1 - flowProgress) + endY * flowProgress;
          targetColor = "var(--sol-yellow)";
          break;

        case "LATENT":
          // Tightly packed grid in the neck (Bottleneck)
          const latCol = i % files;
          const latRow = Math.floor(i / files);
          tx = 160 + (latCol - (files - 1) / 2) * 10;
          ty = 185 + latRow * 8;
          targetColor = "var(--sol-green)";
          break;

        case "DECODING":
          // Expanding from neck downwards
          const decodeProgress = (stateObj.time + i * 0.07) % 1.0;
          const dStartX = 160 + (i % files - (files - 1) / 2) * 8;
          const dStartY = 220;
          const dEndX = 80 + col * 22;
          const dEndY = 300 + row * 14;

          tx = dStartX * (1 - decodeProgress) + dEndX * decodeProgress;
          ty = dStartY * (1 - decodeProgress) + dEndY * decodeProgress;
          targetColor = "var(--sol-orange)";
          break;

        case "OUTPUT":
          // Spread out grid at the bottom of the hourglass (mirror of INPUT)
          tx = 80 + col * 22;
          ty = 300 + row * 14;
          targetColor = "var(--sol-violet)";
          break;
      }

      // Smooth step easing + jitter/noise to simulate sand grains
      p.x += (tx - p.x) * 0.08 + (Math.random() - 0.5) * 0.6;
      p.y += (ty - p.y) * 0.08 + (Math.random() - 0.5) * 0.6;

      // Ensure particles stay inside physical container bounds
      p.x = Math.max(45, Math.min(275, p.x));
      p.y = Math.max(30, Math.min(370, p.y));

      p.el.setAttribute("cx", p.x.toFixed(1));
      p.el.setAttribute("cy", p.y.toFixed(1));
      p.el.setAttribute("fill", targetColor);
    });

    animationId = requestAnimationFrame(tick);
  }

  // Define the external controller API
  const api = {
    start: () => {
      stateObj.isPlaying = true;
      stateObj.stateTimer = 0;
    },
    pause: () => {
      stateObj.isPlaying = false;
    },
    reset: () => {
      stateObj.isPlaying = false;
      stateObj.stateTimer = 0;
      window.__aeProgrammaticClick = true;
      selectTabByTitle("L'Entrée");
      window.__aeProgrammaticClick = false;
    },
    restart: () => {
      stateObj.isPlaying = true;
      stateObj.stateTimer = 0;
      window.__aeProgrammaticClick = true;
      selectTabByTitle("L'Entrée");
      window.__aeProgrammaticClick = false;
    }
  };

  // Save reference on container to allow hot-reloading/updates
  containerEl.__state = {
    _internal: stateObj,
    api,
    destroy: () => {
      if (animationId) cancelAnimationFrame(animationId);
      delete containerEl.__state;
    }
  };

  tick();

  return api;
}
