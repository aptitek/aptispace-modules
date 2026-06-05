// ==========================================
// simulation-control.js — Generic simulation playback controls
// ==========================================

const DEFAULT_LABELS = {
  start: "Démarrer",
  pause: "Pause",
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

function createButton({ className, iconClass, label }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.append(createIcon(iconClass), document.createTextNode(label));
  return button;
}

/**
 * Creates a reusable Start/Pause/Restart control for simulations.
 *
 * @param {HTMLElement|string} target - Host element or selector.
 * @param {Object} options - Hooks called when the user controls playback.
 * @param {Function} [options.onStart] - Called when playback starts/resumes.
 * @param {Function} [options.onPause] - Called when playback pauses.
 * @param {Function} [options.onRestart] - Called when playback restarts.
 * @param {Function} [options.onStateChange] - Receives { state, hasStarted }.
 * @param {Object} [options.labels] - Optional button labels.
 * @param {Promise} [invalidation] - OJS invalidation promise.
 * @returns {Object} Controller with start, pause, restart, setState and destroy.
 */
export function createSimulationControl(target, options = {}, invalidation) {
  const host = resolveTarget(target);
  if (!host) throw new Error(`createSimulationControl: element not found — "${target}"`);

  const labels = { ...DEFAULT_LABELS, ...(options.labels || {}) };
  const state = {
    current: "idle",
    hasStarted: false
  };

  host.textContent = "";
  host.classList.add("simulation-control");
  host.setAttribute("data-state", state.current);

  const playPauseButton = createButton({
    className: "simulation-control-btn simulation-control-toggle",
    iconClass: "bi-play-fill",
    label: labels.start
  });

  const restartButton = createButton({
    className: "simulation-control-btn simulation-control-restart d-none",
    iconClass: "bi-arrow-clockwise",
    label: labels.restart
  });

  host.append(playPauseButton, restartButton);

  const render = () => {
    const isRunning = state.current === "running";
    const label = isRunning ? labels.pause : labels.start;

    playPauseButton.setAttribute("aria-pressed", isRunning ? "true" : "false");
    playPauseButton.replaceChildren(createIcon(isRunning ? "bi-pause-fill" : "bi-play-fill"), document.createTextNode(label));
    restartButton.classList.toggle("d-none", !state.hasStarted);
    host.setAttribute("data-state", state.current);

    options.onStateChange?.({ state: state.current, hasStarted: state.hasStarted });
  };

  const setState = (nextState) => {
    state.current = nextState;
    if (nextState === "running" || nextState === "paused") state.hasStarted = true;
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

  const restart = () => {
    options.onRestart?.();
    setState("running");
  };

  const toggle = () => {
    if (state.current === "running") pause();
    else start();
  };

  playPauseButton.addEventListener("click", toggle);
  restartButton.addEventListener("click", restart);
  render();

  const destroy = () => {
    playPauseButton.removeEventListener("click", toggle);
    restartButton.removeEventListener("click", restart);
  };

  invalidation?.then(destroy);

  return {
    start,
    pause,
    restart,
    setState,
    destroy,
    get state() {
      return state.current;
    },
    get hasStarted() {
      return state.hasStarted;
    }
  };
}
