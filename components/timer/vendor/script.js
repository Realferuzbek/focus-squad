const ASSET_BASE = "/api/timer-assets/assets/";

const MODE_CONFIG = {
  pomodoro: {
    label: "Pomodoro",
    minutes: 50,
    className: "mode-pomodoro",
  },
  short: {
    label: "Short Break",
    minutes: 5,
    className: "mode-short",
  },
  long: {
    label: "Long Break",
    minutes: 15,
    className: "mode-long",
  },
};

const TEMPLATE = `
  <div class="timer-app">
    <div class="timer-app__background" aria-hidden="true"></div>
    <main class="timer-app__container">
      <header class="timer-header">
        <div class="timer-header__chips" role="tablist" aria-label="Timer modes">
          <button class="chip is-active" type="button" role="tab" aria-selected="true" data-mode="pomodoro">Pomodoro</button>
          <button class="chip" type="button" role="tab" aria-selected="false" data-mode="short">Short Break</button>
          <button class="chip" type="button" role="tab" aria-selected="false" data-mode="long">Long Break</button>
        </div>
        <div class="timer-header__actions">
          <button class="icon-button" type="button" aria-label="Timer settings" data-action="settings">
            <svg class="timer__icon timer__icon--gear" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
              <path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm9 4a7.9 7.9 0 0 0-.15-1.5l2.02-1.57-2-3.46-2.48.64a8.1 8.1 0 0 0-2.1-1.21L14 2h-4l-.29 2.54a8.1 8.1 0 0 0-2.1 1.21l-2.48-.64-2 3.46 2.02 1.57A8.5 8.5 0 0 0 3 12c0 .51.05 1.02.15 1.5L1.13 15.1l2 3.46 2.48-.64c.62.5 1.34.9 2.1 1.21L10 22h4l.29-2.54c.76-.31 1.48-.71 2.1-1.21l2.48.64 2-3.46-2.02-1.57c.1-.48.15-.99.15-1.5z" />
            </svg>
          </button>
          <button class="icon-button" type="button" aria-label="Reset timer" data-action="reset">
            <svg class="timer__icon timer__icon--reset" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
              <path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
            </svg>
          </button>
          <button class="icon-button" type="button" aria-label="Toggle fullscreen" data-action="fullscreen">
            <svg class="timer__icon timer__icon--fullscreen" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
              <path d="M7 14H5v5h5v-2H7v-3zm12 5h-5v-2h3v-3h2v5zM7 5h3V3H5v5h2V5zm12 5V3h-5v2h3v3h2z" />
            </svg>
          </button>
        </div>
      </header>
      <section class="timer-display" aria-live="polite">
        <div class="timer-display__digits" data-testid="timer-digits">
          <span class="timer-digit" data-unit="minutes-tens">5</span>
          <span class="timer-digit" data-unit="minutes-ones">0</span>
          <span class="timer-colon" aria-hidden="true">:</span>
          <span class="timer-digit" data-unit="seconds-tens">0</span>
          <span class="timer-digit" data-unit="seconds-ones">0</span>
        </div>
        <div class="timer-progress" role="presentation">
          <svg viewBox="0 0 120 120" class="progress-ring">
            <circle class="progress-ring__background" cx="60" cy="60" r="54"></circle>
            <circle class="progress-ring__progress" cx="60" cy="60" r="54"></circle>
          </svg>
        </div>
        <button class="timer-toggle" type="button" data-action="toggle">Start</button>
      </section>
      <footer class="timer-footer">
        <span class="timer-footer__chip">Moon Phase</span>
        <span class="timer-footer__chip">Deep Focus</span>
      </footer>
    </main>
    <dialog class="timer-settings" aria-label="Timer settings">
      <form method="dialog" class="timer-settings__panel">
        <h2 class="timer-settings__title">Timer Settings</h2>
        <div class="timer-settings__grid">
          <label class="timer-settings__field">
            <span>Pomodoro</span>
            <input type="number" name="pomodoro" min="1" max="180" step="1" value="50" />
          </label>
          <label class="timer-settings__field">
            <span>Short Break</span>
            <input type="number" name="short" min="1" max="60" step="1" value="5" />
          </label>
          <label class="timer-settings__field">
            <span>Long Break</span>
            <input type="number" name="long" min="1" max="90" step="1" value="15" />
          </label>
        </div>
        <div class="timer-settings__actions">
          <button type="button" data-action="settings-cancel" class="ghost-button">Cancel</button>
          <button type="submit" class="primary-button">Save</button>
        </div>
      </form>
    </dialog>
    <audio class="timer-audio" src="${ASSET_BASE}alarm.mp3" preload="auto"></audio>
  </div>
`;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return {
    minutes,
    seconds,
    minuteDigits: `${minutes}`.padStart(2, "0"),
    secondDigits: `${seconds}`.padStart(2, "0"),
  };
}

function updateDigits(root, remaining) {
  const { minuteDigits, secondDigits } = formatTime(remaining);
  root.querySelector('[data-unit="minutes-tens"]').textContent = minuteDigits[0];
  root.querySelector('[data-unit="minutes-ones"]').textContent = minuteDigits[1];
  root.querySelector('[data-unit="seconds-tens"]').textContent = secondDigits[0];
  root.querySelector('[data-unit="seconds-ones"]').textContent = secondDigits[1];
}

function updateProgressCircle(circle, progress) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  circle.style.strokeDasharray = `${circumference}`;
  circle.style.strokeDashoffset = `${circumference - progress * circumference}`;
}

function clampDuration(minutes) {
  if (Number.isNaN(minutes)) return 1;
  return Math.min(180, Math.max(1, minutes));
}

function bindSettingsDialog(root, state, actions) {
  const dialog = root.querySelector(".timer-settings");
  const cancelButton = root.querySelector('[data-action="settings-cancel"]');
  const form = dialog.querySelector("form");

  function populateValues() {
    form.pomodoro.value = state.durations.pomodoro;
    form.short.value = state.durations.short;
    form.long.value = state.durations.long;
  }

  function open() {
    populateValues();
    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    }
  }

  function close() {
    if (dialog.open) {
      dialog.close();
    }
  }

  cancelButton.addEventListener("click", () => {
    close();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextDurations = {
      pomodoro: clampDuration(parseInt(form.pomodoro.value, 10)),
      short: clampDuration(parseInt(form.short.value, 10)),
      long: clampDuration(parseInt(form.long.value, 10)),
    };
    actions.updateDurations(nextDurations);
    close();
  });

  return { open, close };
}

function createState(root, win) {
  const progressCircle = root.querySelector(".progress-ring__progress");
  const audio = root.querySelector(".timer-audio");
  const toggleButton = root.querySelector('[data-action="toggle"]');
  const chipButtons = Array.from(root.querySelectorAll('[data-mode]'));
  const chipHandlers = new Map();

  if (!progressCircle || !audio || !toggleButton) {
    throw new Error("Timer markup is missing required elements");
  }

  audio.load();

  const state = {
    mode: "pomodoro",
    durations: {
      pomodoro: MODE_CONFIG.pomodoro.minutes,
      short: MODE_CONFIG.short.minutes,
      long: MODE_CONFIG.long.minutes,
    },
    remaining: MODE_CONFIG.pomodoro.minutes * 60,
    running: false,
    intervalId: null,
  };

  function setMode(nextMode, { preserveRunning = false } = {}) {
    if (!MODE_CONFIG[nextMode]) return;
    state.mode = nextMode;
    const minutes = state.durations[nextMode];
    state.remaining = minutes * 60;
    if (!preserveRunning) {
      state.running = false;
      if (state.intervalId) {
        win.clearInterval(state.intervalId);
        state.intervalId = null;
      }
      toggleButton.textContent = "Start";
    }

    chipButtons.forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.mode === nextMode);
      chip.setAttribute("aria-selected", chip.dataset.mode === nextMode ? "true" : "false");
    });

    root.querySelector(".timer-app").classList.remove(...Object.values(MODE_CONFIG).map((mode) => mode.className));
    root.querySelector(".timer-app").classList.add(MODE_CONFIG[nextMode].className);

    updateDigits(root, state.remaining);
    updateProgressCircle(progressCircle, 0);
  }

  function tick() {
    if (state.remaining <= 0) {
      stop();
      audio.currentTime = 0;
      audio.play().catch(() => undefined);
      toggleButton.textContent = "Restart";
      updateProgressCircle(progressCircle, 1);
      return;
    }
    state.remaining -= 1;
    const { durations, mode } = state;
    const totalSeconds = durations[mode] * 60;
    const progress = 1 - state.remaining / totalSeconds;
    updateDigits(root, state.remaining);
    updateProgressCircle(progressCircle, progress);
  }

  function start() {
    if (state.running) return;
    state.running = true;
    toggleButton.textContent = "Pause";
    state.intervalId = win.setInterval(tick, 1000);
  }

  function stop() {
    state.running = false;
    toggleButton.textContent = "Start";
    if (state.intervalId) {
      win.clearInterval(state.intervalId);
      state.intervalId = null;
    }
  }

  function reset() {
    stop();
    setMode(state.mode);
  }

  function toggle() {
    if (state.running) {
      stop();
    } else {
      start();
    }
  }

  function updateDurations(nextDurations) {
    state.durations = {
      ...state.durations,
      ...nextDurations,
    };
    setMode(state.mode);
  }

  toggleButton.addEventListener("click", toggle);
  root.querySelector('[data-action="reset"]').addEventListener("click", reset);

  chipButtons.forEach((chip) => {
    const handler = () => {
      stop();
      setMode(chip.dataset.mode);
    };
    chip.addEventListener("click", handler);
    chipHandlers.set(chip, handler);
  });

  setMode("pomodoro");

  return {
    start,
    stop,
    toggle,
    reset,
    setMode,
    updateDurations,
    get dialog() {
      return root.querySelector(".timer-settings");
    },
    destroy() {
      stop();
      toggleButton.removeEventListener("click", toggle);
      root.querySelector('[data-action="reset"]').removeEventListener("click", reset);
      chipButtons.forEach((chip) => {
        const handler = chipHandlers.get(chip);
        if (handler) {
          chip.removeEventListener("click", handler);
        }
      });
    },
  };
}

function bindFullscreen(root, doc) {
  const button = root.querySelector('[data-action="fullscreen"]');
  if (!button) {
    return () => undefined;
  }

  const container = root.closest(".vendor-timer-root") ?? root;

  function updateLabel() {
    const isFullscreen = doc.fullscreenElement === container;
    button.setAttribute("aria-pressed", isFullscreen ? "true" : "false");
  }

  async function toggleFullscreen() {
    try {
      if (doc.fullscreenElement) {
        if (typeof doc.exitFullscreen === "function") {
          await doc.exitFullscreen();
        } else if (typeof doc.webkitExitFullscreen === "function") {
          await doc.webkitExitFullscreen();
        } else if (typeof doc.msExitFullscreen === "function") {
          await doc.msExitFullscreen();
        }
        return;
      }
      const request =
        container.requestFullscreen ||
        container.webkitRequestFullscreen ||
        container.mozRequestFullScreen ||
        container.msRequestFullscreen;
      if (typeof request === "function") {
        await request.call(container);
      }
    } finally {
      updateLabel();
    }
  }

  const handleChange = () => {
    updateLabel();
  };

  const changeEvents = [
    "fullscreenchange",
    "webkitfullscreenchange",
    "mozfullscreenchange",
    "msfullscreenchange",
  ];

  button.addEventListener("click", () => {
    toggleFullscreen().catch(() => undefined);
  });

  changeEvents.forEach((eventName) => {
    doc.addEventListener(eventName, handleChange);
  });
  updateLabel();

  return () => {
    changeEvents.forEach((eventName) => {
      doc.removeEventListener(eventName, handleChange);
    });
  };
}

export function mountTimer(root) {
  if (!(root instanceof HTMLElement)) {
    throw new Error("mountTimer(root) expects a valid HTMLElement root");
  }

  root.innerHTML = TEMPLATE;

  const doc = root.ownerDocument ?? document;
  const win = doc.defaultView ?? window;

  root.style.setProperty("--timer-bg-url", `url(${ASSET_BASE}backgrounds/background_3.jpg)`);

  const appRoot = root.querySelector(".timer-app");
  if (!appRoot) {
    throw new Error("Failed to initialize timer app");
  }

  const state = createState(root, win);
  const { open, close } = bindSettingsDialog(root, state, state);
  const settingsButton = root.querySelector('[data-action="settings"]');
  if (!settingsButton) {
    throw new Error("Timer settings button missing");
  }

  const handleSettingsClick = () => {
    state.stop();
    open();
  };

  settingsButton.addEventListener("click", handleSettingsClick);

  const fullscreenCleanup = bindFullscreen(root, doc);

  let isDestroyed = false;

  return () => {
    if (isDestroyed) return;
    isDestroyed = true;
    state.stop();
    state.destroy();
    close();
    fullscreenCleanup();
    settingsButton.removeEventListener("click", handleSettingsClick);
    root.replaceChildren();
  };
}
