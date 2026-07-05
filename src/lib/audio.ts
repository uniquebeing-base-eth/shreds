// Global theme + shred audio manager. Assets live in /public/audio so they
// ship with the deployed build (works in MiniPay outside the preview).
type AudioBus = {
  theme: HTMLAudioElement | null;
  shred: HTMLAudioElement | null;
  muted: boolean;
  started: boolean;
};

const bus: AudioBus = { theme: null, shred: null, muted: false, started: false };
const MUTE_KEY = "shreds_muted";

function ensure() {
  if (typeof window === "undefined") return;
  if (!bus.theme) {
    const t = new Audio("/audio/theme.mp3");
    t.loop = true;
    t.preload = "auto";
    t.volume = 0;
    bus.theme = t;
  }
  if (!bus.shred) {
    const s = new Audio("/audio/shred.m4a");
    s.preload = "auto";
    s.volume = 0.9;
    bus.shred = s;
  }
  try { bus.muted = localStorage.getItem(MUTE_KEY) === "1"; } catch { /* noop */ }
}

const THEME_VOL = 0.35;

function fade(el: HTMLAudioElement, to: number, ms: number) {
  const from = el.volume;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export const audio = {
  init() { ensure(); },
  async startTheme() {
    ensure();
    if (!bus.theme || bus.started) return;
    try {
      await bus.theme.play();
      bus.started = true;
      fade(bus.theme, bus.muted ? 0 : THEME_VOL, 900);
    } catch { /* autoplay blocked — will start on first user gesture */ }
  },
  duckTheme() {
    ensure();
    if (bus.theme && !bus.muted) fade(bus.theme, THEME_VOL * 0.15, 260);
  },
  restoreTheme() {
    ensure();
    if (bus.theme && !bus.muted) fade(bus.theme, THEME_VOL, 600);
  },
  playShred() {
    ensure();
    if (!bus.shred || bus.muted) return;
    try { bus.shred.currentTime = 0; void bus.shred.play(); } catch { /* noop */ }
  },
  isMuted() { ensure(); return bus.muted; },
  setMuted(v: boolean) {
    ensure();
    bus.muted = v;
    try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* noop */ }
    if (bus.theme) fade(bus.theme, v ? 0 : (bus.started ? THEME_VOL : 0), 300);
    if (v && bus.shred) bus.shred.pause();
    if (!v && !bus.started) void audio.startTheme();
  },
};
