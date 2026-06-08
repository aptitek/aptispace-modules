// ==========================================
// simulation-control.js — Generic simulation playback controls
// ==========================================

const ICONS = {
  play:    "bi-play-fill",
  pause:   "bi-pause-fill",
  stop:    "bi-stop-fill",
  restart: "bi-arrow-clockwise"
};

const TITLES = {
  play:    "Démarrer",
  pause:   "Pause",
  stop:    "Arrêter",
  restart: "Rejouer"
};

function resolveTarget(target) {
  return typeof target === "string" ? document.querySelector(target) : target;
}

function createIcon(className) {
  const icon = document.createElement("i");
  icon.className = `bi ${className}`;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function createButton(iconClass, title, extraClass) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `simulation-control-btn ${extraClass}`;
  btn.title = title;
  btn.setAttribute("aria-label", title);
  btn.appendChild(createIcon(iconClass));
  return btn;
}

/**
 * Creates icon-only Start / Pause / Stop / Restart controls for simulations.
 * Designed to sit in a `.tabs` bar via `.simulation-control .control {.tab-right .no-pane}`.
 *
 * State machine:
 *   idle  ──[▶]──▶  running  ──[⏸]──▶  paused
 *                   running  ──[⏹]──▶  idle
 *                   paused   ──[▶]──▶  running  (resume)
 *                   paused   ──[⏹]──▶  idle
 *                   paused   ──[↺]──▶  running  (restart from beginning)
 *
 * Button visibility by state:
 *   idle    → [▶]
 *   running → [⏸]* [⏹]           (* if pausable !== false)
 *   paused  → [▶] [⏹] [↺]
 *
 * @param {HTMLElement|string} target  - Host element or CSS selector.
 * @param {Object} options
 * @param {Function} [options.onStart]       - idle/paused → running (start or resume).
 * @param {Function} [options.onPause]       - running → paused.
 * @param {Function} [options.onStop]        - * → idle (reset).
 * @param {Function} [options.onRestart]     - paused → running from beginning.
 * @param {Function} [options.onStateChange] - Receives { state, hasStarted }.
 * @param {boolean}  [options.pausable=true] - Whether to show the pause button.
 * @param {Promise}  [invalidation]          - OJS invalidation promise.
 * @returns Controller: { start, pause, stop, restart, setState, destroy, state, hasStarted }
 */
export function createSimulationControl(target, options = {}, invalidation) {
  const host = resolveTarget(target);
  if (!host) throw new Error(`createSimulationControl: element not found — "${target}"`);

  const pausable = options.pausable !== false;
  const state = { current: "idle", hasStarted: false };

  host.textContent = "";
  host.classList.add("simulation-control");
  host.setAttribute("data-state", "idle");

  const playBtn    = createButton(ICONS.play,    TITLES.play,    "sc-play");
  const pauseBtn   = createButton(ICONS.pause,   TITLES.pause,   "sc-pause");
  const stopBtn    = createButton(ICONS.stop,    TITLES.stop,    "sc-stop");
  const restartBtn = createButton(ICONS.restart, TITLES.restart, "sc-restart");

  host.append(playBtn, pauseBtn, stopBtn, restartBtn);

  const setVisible = (btn, visible) => {
    btn.classList.toggle("d-none", !visible);
  };

  const render = () => {
    const s       = state.current;
    const running = s === "running";
    const paused  = s === "paused";
    const idle    = s === "idle";

    setVisible(playBtn,    !running);
    setVisible(pauseBtn,   running && pausable);
    setVisible(stopBtn,    !idle);
    setVisible(restartBtn, paused);

    host.setAttribute("data-state", s);
    options.onStateChange?.({ state: s, hasStarted: state.hasStarted });
  };

  const setState = (nextState) => {
    state.current = nextState;
    if (nextState === "running" || nextState === "paused") {
      state.hasStarted = true;
    } else if (nextState === "idle") {
      state.hasStarted = false;
    }
    render();
  };

  const start = () => {
    options.onStart?.();
    setState("running");
  };

  const pause = () => {
    options.onPause?.();
    setState("paused");
  };

  const stop = () => {
    options.onStop?.();
    setState("idle");
  };

  const restart = () => {
    options.onRestart?.();
    setState("running");
  };

  const onPlayClick = () => {
    start();
  };

  playBtn.addEventListener("click",    onPlayClick);
  pauseBtn.addEventListener("click",   pause);
  stopBtn.addEventListener("click",    stop);
  restartBtn.addEventListener("click", restart);

  render();

  const destroy = () => {
    playBtn.removeEventListener("click",    onPlayClick);
    pauseBtn.removeEventListener("click",   pause);
    stopBtn.removeEventListener("click",    stop);
    restartBtn.removeEventListener("click", restart);
  };

  invalidation?.then(destroy);

  return {
    start,
    pause,
    stop,
    restart,
    setState,
    destroy,
    get state()      { return state.current; },
    get hasStarted() { return state.hasStarted; }
  };
}
