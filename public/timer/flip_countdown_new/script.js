// =======================
// Flip Countdown — renderer.js (livestream-safe)
// =======================

// ----- State -----
const DEFAULT_TIMER_MINUTES = Object.freeze({
  pomodoro: 25,
  short: 5,
  long: 15,
});
const TIMER_STORE_KEY = "timer-presets";
const TIMER_MIN_MINUTES = 1;
const TIMER_MAX_MINUTES = 99;
const THEME_NAME_MAP = Object.freeze({
  "assets/backgrounds/background.jpg": "background.name.dark",
  "assets/backgrounds/background_3.jpg": "background.name.grey",
});
const DEFAULT_THEME_KEY = "background.name.new";
const LANGUAGE_KEY = "app-language";
const SUPPORTED_LANGUAGES = ["en", "uz", "ru"];

const TRANSLATIONS = {
  en: {
    "settings.title": "Settings",
    "tab.pomodoro": "Pomodoro",
    "tab.background": "Background",
    "tab.language": "Language",
    "pomodoro.title": "Pomodoro",
    "pomodoro.subtitle": "Dial in focus and breaks for your perfect flow.",
    "pomodoro.field.focus": "Pomodoro",
    "pomodoro.field.short": "Short Break",
    "pomodoro.field.long": "Long Break",
    "pomodoro.minutes": "minutes",
    "pomodoro.reset": "Reset all",
    "pomodoro.close": "Close",
    "pomodoro.save": "Save changes",
    "background.title": "Select theme",
    "background.subtitle":
      "Tap a scene to refresh your focus space in seconds.",
    "background.hint": "Tap to apply",
    "background.active": "Active theme",
    "background.name.dark": "Dark Mountain",
    "background.name.midnight": "Midnight Clouds",
    "background.name.grey": "Grey Moon",
    "background.name.new": "New Background",
    "background.use": "Use background",
    "language.title": "Language",
    "language.subtitle": "Choose how the interface speaks to you.",
    "language.option.en": "English",
    "language.option.uz": "Uzbek",
    "language.option.ru": "Russian",
    "language.hint": "Applies instantly across the app.",
    "language.groupLabel": "Language",
    "controls.start": "start",
    "controls.pause": "pause",
    "mode.pomodoro": "pomodoro",
    "mode.short": "short break",
    "mode.long": "long break",
    "time.editTitle": "Click to set time (MM:SS). Press Enter to apply.",
    "time.placeholder": "MM:SS",
    "fab.fullscreen": "Fullscreen",
    "fab.backgrounds": "Backgrounds",
    "fab.alarm": "Stop alarm",
    "common.close": "Close",
  },
  uz: {
    "settings.title": "Sozlamalar",
    "tab.pomodoro": "Pomodoro",
    "tab.background": "Fon",
    "tab.language": "Til",
    "pomodoro.title": "Pomodoro",
    "pomodoro.subtitle": "Diqqat va tanaffuslarni o‘zingizga moslang.",
    "pomodoro.field.focus": "Pomodoro",
    "pomodoro.field.short": "Qisqa tanaffus",
    "pomodoro.field.long": "Uzoq tanaffus",
    "pomodoro.minutes": "daqiqalar",
    "pomodoro.reset": "Hammasini tiklash",
    "pomodoro.close": "Yopish",
    "pomodoro.save": "Saqlash",
    "background.title": "Fon tanlang",
    "background.subtitle":
      "Bir zumda kayfiyatni yangilash uchun sahnani bosing.",
    "background.hint": "Tanlash uchun bosing",
    "background.active": "Faol fon",
    "background.name.dark": "Qorong‘i Tog‘",
    "background.name.midnight": "Tungi Bulutlar",
    "background.name.grey": "Kulrang Oy",
    "background.name.new": "Yangi fon",
    "background.use": "Fon tanlash",
    "language.title": "Til",
    "language.subtitle": "Interfeys tilini tanlang.",
    "language.option.en": "Inglizcha",
    "language.option.uz": "O‘zbekcha",
    "language.option.ru": "Ruscha",
    "language.hint": "Butun ilova darhol yangilanadi.",
    "language.groupLabel": "Til",
    "controls.start": "boshlash",
    "controls.pause": "to‘xtatish",
    "mode.pomodoro": "pomodoro",
    "mode.short": "qisqa tanaffus",
    "mode.long": "uzoq tanaffus",
    "time.editTitle":
      "Vaqtni sozlash uchun bosing (MM:SS). Enter tugmasini bosing.",
    "time.placeholder": "MM:SS",
    "fab.fullscreen": "To‘liq ekran",
    "fab.backgrounds": "Fonlar",
    "fab.alarm": "Signalni o‘chirish",
    "common.close": "Yopish",
  },
  ru: {
    "settings.title": "Настройки",
    "tab.pomodoro": "Помодоро",
    "tab.background": "Фон",
    "tab.language": "Язык",
    "pomodoro.title": "Помодоро",
    "pomodoro.subtitle": "Настройте работу и перерывы под свой ритм.",
    "pomodoro.field.focus": "Помодоро",
    "pomodoro.field.short": "Короткий перерыв",
    "pomodoro.field.long": "Длинный перерыв",
    "pomodoro.minutes": "минуты",
    "pomodoro.reset": "Сбросить всё",
    "pomodoro.close": "Закрыть",
    "pomodoro.save": "Сохранить",
    "background.title": "Выберите фон",
    "background.subtitle":
      "Нажмите на сцену, чтобы обновить настроение за секунды.",
    "background.hint": "Нажмите, чтобы применить",
    "background.active": "Активный фон",
    "background.name.dark": "Тёмная гора",
    "background.name.midnight": "Ночные облака",
    "background.name.grey": "Серая луна",
    "background.name.new": "Новый фон",
    "background.use": "Использовать фон",
    "language.title": "Язык",
    "language.subtitle": "Выберите язык интерфейса.",
    "language.option.en": "Английский",
    "language.option.uz": "Узбекский",
    "language.option.ru": "Русский",
    "language.hint": "Применяется к приложению мгновенно.",
    "language.groupLabel": "Язык",
    "controls.start": "старт",
    "controls.pause": "пауза",
    "mode.pomodoro": "помодоро",
    "mode.short": "короткий перерыв",
    "mode.long": "длинный перерыв",
    "time.editTitle": "Нажмите, чтобы задать время (ММ:СС). Enter — применить.",
    "time.placeholder": "ММ:СС",
    "fab.fullscreen": "Полный экран",
    "fab.backgrounds": "Фоны",
    "fab.alarm": "Остановить сигнал",
    "common.close": "Закрыть",
  },
};

let currentLanguage = loadLanguage();

function loadLanguage() {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
      return stored;
    }
  } catch (_) {}
  return "en";
}

function t(key) {
  const table = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
  if (Object.prototype.hasOwnProperty.call(table, key)) return table[key];
  if (Object.prototype.hasOwnProperty.call(TRANSLATIONS.en, key))
    return TRANSLATIONS.en[key];
  return key;
}

const MODE_CONFIG = {
  pomodoro: { label: "pomodoro", seconds: DEFAULT_TIMER_MINUTES.pomodoro * 60 },
  short: { label: "short break", seconds: DEFAULT_TIMER_MINUTES.short * 60 },
  long: { label: "long break", seconds: DEFAULT_TIMER_MINUTES.long * 60 },
};
let totalSeconds = 0;
let tickHandle = null;
let countdownDeadline = null;
let alarmPlaying = false;
let compactMode = false;
let activeMode = "pomodoro";
const supportsPerformanceNow =
  typeof performance !== "undefined" && typeof performance.now === "function";

// === Background + Fullscreen wiring ===
const BG_STORE_KEY = "bg-url";
const BG_LEGACY_KEY = "bg:src";
const DEFAULT_BG = "assets/backgrounds/background_3.jpg";
const $ = (sel) => document.querySelector(sel);

function currentBg() {
  try {
    const stored = localStorage.getItem(BG_STORE_KEY);
    if (stored) return stored;
    const legacy = localStorage.getItem(BG_LEGACY_KEY);
    if (legacy) return legacy;
  } catch (_) {}
  return "";
}

let appliedBackground = currentBg();

const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));
const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const timerInputs = {
  pomodoro: document.getElementById("pomodoro-focus"),
  short: document.getElementById("pomodoro-short"),
  long: document.getElementById("pomodoro-long"),
};
const timerSaveBtn = document.getElementById("pomodoro-save-btn");
const timerResetBtn = document.getElementById("pomodoro-reset-btn");
const alarmStopBtn = document.getElementById("fab-alarm-stop");
const languageInputs = Array.from(
  document.querySelectorAll('input[name="language-option"]'),
);
const MODE_LABEL_KEYS = {
  pomodoro: "mode.pomodoro",
  short: "mode.short",
  long: "mode.long",
};

function resolveBackgroundUrl(src) {
  if (!src) return "";
  if (/^(?:https?:|data:|blob:)/i.test(src)) return src;
  try {
    return new URL(src, import.meta.url).toString();
  } catch (_) {
    return src;
  }
}

function normalizeBackgroundKey(url) {
  if (!url) return "";
  const normalized = url.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("assets/backgrounds/");
  if (idx !== -1) {
    return normalized.slice(idx);
  }
  return normalized;
}

function themeNameFor(url) {
  const key = normalizeBackgroundKey(url);
  return THEME_NAME_MAP[key] || DEFAULT_THEME_KEY;
}

function toggleAlarmStopButton(show) {
  if (!alarmStopBtn) return;
  alarmStopBtn.hidden = !show;
  if (show) {
    alarmStopBtn.setAttribute("tabindex", "0");
  } else {
    alarmStopBtn.removeAttribute("tabindex");
  }
}

function handleAlarmSilentStop() {
  if (!alarm) return;
  const alarmInactive = alarm.paused || alarm.ended || alarm.currentTime === 0;
  const buttonVisible = !!alarmStopBtn && !alarmStopBtn.hidden;
  if (!alarmInactive) return;
  if (!alarmPlaying && !buttonVisible) return;

  alarmPlaying = false;
  try {
    alarm.currentTime = 0;
  } catch (_) {}
  toggleAlarmStopButton(false);
}

function updateElementI18n(el) {
  if (!el || !el.dataset) return;
  const key = el.dataset.i18n;
  if (!key) return;
  const text = t(key);
  const attr = el.dataset.i18nAttr;
  const attr2 = el.dataset.i18nAttr2;
  if (attr) el.setAttribute(attr, text);
  if (attr2) el.setAttribute(attr2, text);
  if (!attr) {
    el.textContent = text;
  }
}

function refreshI18nText() {
  document.querySelectorAll("[data-i18n]").forEach(updateElementI18n);
  refreshThemeButtonTexts();
  document.documentElement.lang = currentLanguage;
}

function updateThemeButtonText(btn) {
  if (!btn) return;
  const themeKey = btn.dataset.themeKey || DEFAULT_THEME_KEY;
  const name = t(themeKey);
  const nameEl = btn.querySelector(".theme-name");
  if (nameEl) nameEl.textContent = name;
  const hintEl = btn.querySelector(".theme-hint");
  if (hintEl) hintEl.textContent = t("background.hint");
  const stateEl = btn.querySelector(".theme-state");
  if (stateEl) {
    const active = btn.classList.contains("is-active");
    stateEl.textContent = active ? t("background.active") : "";
    stateEl.hidden = !active;
  }
  const img = btn.querySelector("img");
  if (img) img.alt = `${name} preview`;
  btn.setAttribute("aria-label", `${t("background.use")} ${name}`);
  btn.setAttribute("title", `${t("background.use")} ${name}`);
}

function refreshThemeButtonTexts() {
  document
    .querySelectorAll(".theme-options .thumb")
    .forEach(updateThemeButtonText);
}

function applyLanguage(lang, { persist = true } = {}) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    lang = "en";
  }
  currentLanguage = lang;
  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_KEY, lang);
    } catch (_) {}
  }
  if (languageInputs.length) {
    languageInputs.forEach((input) => {
      input.checked = input.value === lang;
    });
  }
  refreshI18nText();
  syncModeButtons();
  refreshControls();
}

function initLanguageControls() {
  if (!languageInputs.length) return;
  languageInputs.forEach((input) => {
    input.checked = input.value === currentLanguage;
    input.addEventListener("change", () => {
      if (input.checked) {
        applyLanguage(input.value);
      }
    });
  });
}

function applyBackground(url, { persist = true } = {}) {
  if (!url) return;
  const resolved = resolveBackgroundUrl(url);
  if (!resolved) return;
  const cssValue = `url("${resolved}")`;
  if (bgDiv) {
    bgDiv.style.backgroundImage = cssValue;
    bgDiv.style.backgroundSize = "cover";
    bgDiv.style.backgroundPosition = "center";
    bgDiv.style.backgroundRepeat = "no-repeat";
    bgDiv.style.backgroundAttachment = "fixed";
    bgDiv.style.removeProperty("filter");
    bgDiv.style.removeProperty("-webkit-filter");
  }
  document.body.style.backgroundImage = cssValue;
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundRepeat = "no-repeat";
  document.body.style.backgroundAttachment = "fixed";
  document.body.style.removeProperty("filter");
  document.body.style.removeProperty("-webkit-filter");
  appliedBackground = url;
  if (persist) {
    try {
      localStorage.setItem(BG_STORE_KEY, url);
      localStorage.setItem(BG_LEGACY_KEY, url);
    } catch (_) {}
  }
}

function syncThumbSelection(grid, url) {
  if (!grid) return;
  grid.querySelectorAll(".thumb").forEach((btn) => {
    const isActive = btn.dataset.bgOption === url;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
    updateThemeButtonText(btn);
  });
}

function syncModeButtons(mode = activeMode) {
  modeButtons.forEach((btn) => {
    const modeKey = btn.dataset.mode;
    const labelKey = MODE_LABEL_KEYS[modeKey];
    if (labelKey) {
      btn.textContent = t(labelKey);
    }
    const isActive = modeKey === mode;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

function modeMinutesFromConfig() {
  return {
    pomodoro: Math.round(
      (MODE_CONFIG.pomodoro?.seconds ?? DEFAULT_TIMER_MINUTES.pomodoro * 60) /
        60,
    ),
    short: Math.round(
      (MODE_CONFIG.short?.seconds ?? DEFAULT_TIMER_MINUTES.short * 60) / 60,
    ),
    long: Math.round(
      (MODE_CONFIG.long?.seconds ?? DEFAULT_TIMER_MINUTES.long * 60) / 60,
    ),
  };
}

function updateModeConfigFromMinutes(minutes) {
  ["pomodoro", "short", "long"].forEach((key) => {
    if (!MODE_CONFIG[key]) return;
    const base = DEFAULT_TIMER_MINUTES[key];
    const value = minutes?.[key];
    const mins = sanitizeMinutes(value, base);
    MODE_CONFIG[key].seconds = mins * 60;
  });
}

function sanitizeMinutes(value, fallback) {
  const minutes = Number.parseInt(value, 10);
  if (!Number.isFinite(minutes)) return fallback;
  return Math.max(TIMER_MIN_MINUTES, Math.min(TIMER_MAX_MINUTES, minutes));
}

function syncTimerInputs(minutes = modeMinutesFromConfig()) {
  Object.entries(timerInputs).forEach(([key, input]) => {
    if (!input) return;
    const mins = minutes?.[key] ?? DEFAULT_TIMER_MINUTES[key];
    input.value = mins;
  });
}

function readTimerInputs() {
  const current = modeMinutesFromConfig();
  const minutes = { ...current };
  Object.entries(timerInputs).forEach(([key, input]) => {
    if (!input) return;
    const sanitized = sanitizeMinutes(input.value, current[key]);
    minutes[key] = sanitized;
    if (String(sanitized) !== String(input.value)) {
      input.value = sanitized;
    }
  });
  return minutes;
}

function persistTimerMinutes(minutes) {
  try {
    localStorage.setItem(TIMER_STORE_KEY, JSON.stringify(minutes));
  } catch (_) {}
}

function applyTimerMinutes(
  minutes,
  { persist = true, resetTimer = true } = {},
) {
  updateModeConfigFromMinutes(minutes);
  if (persist) persistTimerMinutes(minutes);
  syncTimerInputs(minutes);
  if (resetTimer) {
    reset();
  } else {
    refreshControls();
  }
}

function loadTimerPresets() {
  let stored = null;
  try {
    const raw = localStorage.getItem(TIMER_STORE_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch (_) {}
  const minutes = { ...DEFAULT_TIMER_MINUTES };
  if (stored && typeof stored === "object") {
    ["pomodoro", "short", "long"].forEach((key) => {
      if (key in stored) {
        minutes[key] = sanitizeMinutes(stored[key], minutes[key]);
      }
    });
  }
  updateModeConfigFromMinutes(minutes);
  persistTimerMinutes(minutes);
  return minutes;
}

function refreshControls() {
  const running = isRunning();
  if (startBtn) {
    const labelKey = running ? "controls.pause" : "controls.start";
    const label = t(labelKey);
    startBtn.textContent = label;
    startBtn.classList.toggle("is-running", running);
    startBtn.setAttribute("aria-pressed", running ? "true" : "false");
    startBtn.setAttribute("aria-label", label);
    startBtn.disabled = !running && totalSeconds <= 0;
  }
  if (resetBtn) {
    const preset = MODE_CONFIG[activeMode]?.seconds ?? 0;
    resetBtn.disabled = !running && totalSeconds === preset;
  }
  syncModeButtons();
}

function setActiveMode(mode, { resetToPreset = true } = {}) {
  if (!MODE_CONFIG[mode]) {
    mode = "pomodoro";
  }
  activeMode = mode;
  syncModeButtons(mode);
  if (resetToPreset) {
    pause({ refresh: false });
    stopAlarm(true);
    totalSeconds = MODE_CONFIG[mode].seconds;
    render();
  }
  refreshControls();
}

// Fullscreen helpers (vendor-safe)
function fsSupported() {
  return Boolean(
    document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.msFullscreenEnabled,
  );
}
function inFs() {
  return Boolean(
    document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement,
  );
}
function enterFs() {
  const el = document.documentElement;
  const method =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.msRequestFullscreen;
  if (typeof method === "function") method.call(el);
}
function exitFs() {
  const method =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen;
  if (typeof method === "function") method.call(document);
}
function toggleFs() {
  if (inFs()) {
    exitFs();
  } else {
    applyCompactMode(false);
    enterFs();
  }
}

// Open/close bottom sheet
function openSheet() {
  const sheet = $("#bg-sheet");
  if (!sheet) return;
  sheet.hidden = false;
  document.body.classList.add("sheet-open");
  const trigger = $("#fab-bg");
  trigger?.setAttribute("aria-pressed", "true");
  const panel = sheet.querySelector(".sheet__panel");
  panel?.focus({ preventScroll: true });
}
function closeSheet() {
  const sheet = $("#bg-sheet");
  if (!sheet) return;
  sheet.hidden = true;
  document.body.classList.remove("sheet-open");
  const trigger = $("#fab-bg");
  trigger?.setAttribute("aria-pressed", "false");
  if (trigger && sheet.contains(document.activeElement)) {
    trigger.focus();
  }
}

async function loadImagesManifest() {
  // Prefer server-enumerated list (auto-updates on deploy), fall back to legacy manifest.
  const sources = [
    () => fetch("/api/backgrounds", { cache: "no-store" }),
    () => fetch("assets/images.json", { cache: "no-store" }),
  ];

  for (const getSource of sources) {
    try {
      const res = await getSource();
      if (!res || !res.ok) continue;
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.images)
          ? data.images
          : [];
      const cleaned = list.filter(
        (p) => typeof p === "string" && /\.(png|jpe?g)$/i.test(p),
      );
      if (cleaned.length) {
        const seen = new Set();
        return cleaned.filter((url) => {
          const key = url.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    } catch (_) {
      // try next source
    }
  }

  return [];
}

async function initAppearance() {
  const fsBtn = $("#fab-fs");
  const bgBtn = $("#fab-bg");
  const grid = $("#bg-grid");
  const sheet = $("#bg-sheet");

  // Fullscreen: expose button only if supported (desktop + Android; iOS Safari lacks it)
  if (fsBtn) {
    if (fsSupported()) {
      fsBtn.hidden = false;
      fsBtn.setAttribute("aria-pressed", String(inFs()));
      fsBtn.addEventListener("click", toggleFs);
      document.addEventListener("fullscreenchange", () => {
        fsBtn.setAttribute("aria-pressed", String(inFs()));
      });
    } else {
      fsBtn.remove();
    }
  }

  const images = await loadImagesManifest();
  const saved = currentBg();
  const availableSet = new Set(images);
  const initial =
    saved && availableSet.has(saved) ? saved : images[0] || saved || DEFAULT_BG;

  applyBackground(initial, { persist: Boolean(images.length) });

  if (!grid || !bgBtn || !sheet) {
    return;
  }

  if (images.length > 1) {
    grid.innerHTML = "";
    images.forEach((url) => {
      const btn = document.createElement("button");
      btn.className = "thumb";
      btn.type = "button";
      btn.dataset.bgOption = url;
      const themeKey = themeNameFor(url);
      btn.dataset.themeKey = themeKey;
      btn.setAttribute("role", "listitem");
      btn.innerHTML = `
        <img loading="lazy" decoding="async" src="${url}" alt="">
        <div class="theme-copy">
          <span class="theme-name"></span>
          <span class="theme-hint"></span>
          <span class="theme-state" hidden></span>
        </div>
      `;
      btn.addEventListener("click", () => {
        applyBackground(url);
        syncThumbSelection(grid, url);
        closeSheet();
      });
      grid.appendChild(btn);
    });

    refreshThemeButtonTexts();
    syncThumbSelection(grid, appliedBackground);

    bgBtn.hidden = false;
    bgBtn.setAttribute("aria-pressed", "false");
    bgBtn.addEventListener("click", () => {
      const sheetVisible = !sheet.hidden;
      if (sheetVisible) {
        closeSheet();
      } else {
        openSheet();
      }
    });

    sheet.addEventListener("click", (e) => {
      if (e.target instanceof Element && e.target.hasAttribute("data-close")) {
        closeSheet();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !sheet.hidden) {
        closeSheet();
      }
    });
  } else {
    closeSheet();
    grid.innerHTML = "";
    bgBtn.hidden = true;
    bgBtn.setAttribute("aria-pressed", "false");
  }
}

if (!window.electronAPI) window.electronAPI = { setCompactMode: () => {} };

// ----- Elements -----
const mmTens = document.querySelector(".mm-tens");
const mmOnes = document.querySelector(".mm-ones");
const ssTens = document.querySelector(".ss-tens");
const ssOnes = document.querySelector(".ss-ones");
const timeWrap = document.getElementById("timeWrap");
const timeInput = document.getElementById("timeInput");
const alarm = document.getElementById("alarm");
const bgDiv = document.querySelector(".bg");

// ----- Asset loading (works in dev and packaged) -----
function resolveBundled(relPath) {
  // file:/// URL that works from the current module (asar-safe)
  // When serving on web, host /assets/* alongside this script.
  return new URL(relPath, import.meta.url).toString();
}

function loadBundledAssets() {
  if (bgDiv && !bgDiv.style.backgroundImage) {
    applyBackground(DEFAULT_BG, { persist: false });
  }

  const alarmUrl = resolveBundled("./assets/alarm.mp3");
  alarm.src = alarmUrl;
  alarm.load();
  if (alarmStopBtn && !alarmStopBtn.dataset.bound) {
    alarmStopBtn.addEventListener("click", () => {
      stopAlarm(true);
    });
    alarmStopBtn.dataset.bound = "true";
  }
  if (alarm && !alarm.dataset.boundPauseListener) {
    alarm.addEventListener("pause", handleAlarmSilentStop);
    alarm.addEventListener("ended", handleAlarmSilentStop);
    alarm.dataset.boundPauseListener = "true";
  }
  toggleAlarmStopButton(false);
}

function initModeControls() {
  if (modeButtons.length) {
    modeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetMode = btn.dataset.mode;
        setActiveMode(targetMode, { resetToPreset: true });
      });
    });
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      if (isRunning()) {
        pause();
      } else {
        start();
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      reset();
    });
  }

  setActiveMode(activeMode, { resetToPreset: true });
}

function initTimerSettings() {
  const hasInputs = Object.values(timerInputs).some(Boolean);
  if (!hasInputs) return;

  syncTimerInputs();

  if (timerSaveBtn) {
    timerSaveBtn.addEventListener("click", () => {
      const minutes = readTimerInputs();
      applyTimerMinutes(minutes);
      closeSheet();
    });
  }

  if (timerResetBtn) {
    timerResetBtn.addEventListener("click", () => {
      applyTimerMinutes({ ...DEFAULT_TIMER_MINUTES });
    });
  }
}

// ----- Boot / focus -----
document.addEventListener("DOMContentLoaded", async () => {
  document.body.tabIndex = -1;
  document.body.focus();
  loadTimerPresets();
  initModeControls();
  loadBundledAssets();
  try {
    await initAppearance();
  } catch (err) {
    console.error("Failed to initialize appearance controls:", err);
  }
  initTimerSettings();
  initLanguageControls();
  applyLanguage(currentLanguage, { persist: false });
  render();
  refreshControls();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isRunning()) {
    scheduleTick(true);
  }
});

// ===== Helpers =====
function clampTime(m, s) {
  m = Math.max(0, Math.min(59, Number.isFinite(m) ? m : 0));
  s = Math.max(0, Math.min(59, Number.isFinite(s) ? s : 0));
  return m * 60 + s;
}
function formatMMSS(t) {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return [Math.floor(m / 10), m % 10, Math.floor(s / 10), s % 10];
}
function setDigits([a, b, c, d]) {
  applyDigit(mmTens, a);
  applyDigit(mmOnes, b);
  applyDigit(ssTens, c);
  applyDigit(ssOnes, d);
}
// Plain digits (no flip animation)
function applyDigit(el, next) {
  el.dataset.digit = String(next);
}
function render() {
  setDigits(formatMMSS(totalSeconds));
}

function applyCompactMode(compact) {
  compactMode = Boolean(compact);
  const api = window.electronAPI;
  if (api && typeof api.setCompactMode === "function") {
    api.setCompactMode(compactMode);
  }
}

function isSheetOpen() {
  const sheet = document.getElementById("bg-sheet");
  return Boolean(sheet && !sheet.hidden);
}

function createDeadline(seconds) {
  const normalizedSeconds = Number.isFinite(seconds)
    ? seconds
    : Number(seconds);
  const safeSeconds = Number.isFinite(normalizedSeconds)
    ? normalizedSeconds
    : 0;
  const ms = Math.max(0, safeSeconds * 1000);
  const wall = Date.now() + ms;
  const steadyBase = supportsPerformanceNow ? performance.now() : null;
  const steady = typeof steadyBase === "number" ? steadyBase + ms : null;
  return { wall, steady };
}

function getRemainingMs(deadline = countdownDeadline) {
  if (!deadline) return 0;
  let wallRemaining = deadline.wall - Date.now();
  wallRemaining = Number.isFinite(wallRemaining)
    ? wallRemaining
    : Number.POSITIVE_INFINITY;

  let steadyRemaining = Number.POSITIVE_INFINITY;
  if (supportsPerformanceNow && typeof deadline.steady === "number") {
    steadyRemaining = deadline.steady - performance.now();
    steadyRemaining = Number.isFinite(steadyRemaining)
      ? steadyRemaining
      : Number.POSITIVE_INFINITY;
  }

  let remaining = Math.min(wallRemaining, steadyRemaining);
  if (!Number.isFinite(remaining)) {
    remaining = Number.isFinite(wallRemaining)
      ? wallRemaining
      : steadyRemaining;
  }
  if (!Number.isFinite(remaining)) {
    remaining = 0;
  }
  return Math.max(0, remaining);
}

function isRunning() {
  return countdownDeadline !== null;
}

// ===== Timer helpers =====
function clearScheduledTick() {
  if (tickHandle) {
    clearTimeout(tickHandle);
    tickHandle = null;
  }
}

function scheduleTick(immediate = false) {
  clearScheduledTick();
  if (!isRunning()) return;
  if (immediate) {
    tick();
  } else {
    tickHandle = setTimeout(tick, 250);
  }
}

// ===== Timer (keeps accurate time even while unfocused) =====
function start() {
  if (totalSeconds <= 0 || isRunning()) {
    refreshControls();
    return;
  }
  countdownDeadline = createDeadline(totalSeconds);
  scheduleTick(true);
  refreshControls();
}
function pause(options = {}) {
  const { refresh = true } = options;
  if (isRunning()) {
    const remainingMs = getRemainingMs();
    totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    countdownDeadline = null;
  }
  clearScheduledTick();
  stopAlarm(true);
  if (refresh) refreshControls();
}
function reset() {
  pause({ refresh: false });
  stopAlarm(true);
  const preset = MODE_CONFIG[activeMode]?.seconds ?? 0;
  totalSeconds = preset;
  render();
  refreshControls();
}
function tick() {
  tickHandle = null;
  if (!isRunning()) return;
  const remainingMs = getRemainingMs();
  totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  render();
  if (totalSeconds <= 0) {
    countdownDeadline = null;
    clearScheduledTick();
    refreshControls();
    playAlarm();
    return;
  }
  refreshControls();
  scheduleTick();
}

// ===== Alarm =====
function playAlarm() {
  if (alarmPlaying) return;
  alarm.loop = true;
  alarm.currentTime = 0;
  const promise = alarm.play();
  const onSuccess = () => {
    alarmPlaying = true;
    toggleAlarmStopButton(true);
  };
  const onFailure = () => {
    alarmPlaying = false;
    toggleAlarmStopButton(false);
  };
  if (promise && typeof promise.then === "function") {
    promise.then(onSuccess).catch(onFailure);
  } else {
    onSuccess();
  }
}
function stopAlarm(force = false) {
  if (!alarmPlaying) return;
  const focused = force ? true : document.hasFocus();
  if (!focused) return; // only stop when app is focused
  alarm.pause();
  alarm.currentTime = 0;
  alarmPlaying = false;
  toggleAlarmStopButton(false);
}

// ===== Time input =====
function openTimeInput() {
  const [a, b, c, d] = formatMMSS(totalSeconds || 0);
  timeInput.value = `${a}${b}:${c}${d}`;
  timeInput.classList.add("active");
  timeInput.focus();
  timeInput.select();
}
function applyTimeFromInput() {
  const v = (timeInput.value || "").trim();
  const m = /^([0-5]?\d):([0-5]?\d)$/.exec(v);
  if (m) {
    pause({ refresh: false });
    totalSeconds = clampTime(parseInt(m[1], 10), parseInt(m[2], 10));
    render();
    refreshControls();
  }
  timeInput.classList.remove("active");
}

// ===== Events =====
timeWrap.addEventListener("click", openTimeInput);

timeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    applyTimeFromInput();
  }
  if (e.key === "Escape") {
    e.preventDefault();
    timeInput.classList.remove("active");
  }
});

// Global keys — disabled while editing time input
window.addEventListener("keydown", (e) => {
  if (isSheetOpen()) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSheet();
    }
    return;
  }
  const editing =
    document.activeElement === timeInput &&
    timeInput.classList.contains("active");
  if (editing) return;

  if (e.code === "Space") {
    e.preventDefault();
    if (isRunning()) pause();
    else start();
    return;
  }
  if (e.key === "Escape") {
    reset();
    return;
  }
  if (e.key.toLowerCase() === "j") {
    e.preventDefault();
    const nextCompact = !compactMode;
    if (nextCompact && inFs()) {
      exitFs();
    }
    applyCompactMode(nextCompact);
    return;
  }
});
