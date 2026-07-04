import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/**
 * Procedural, seamless-looping ambient synth using the Web Audio API.
 * No external asset dependency — plays only after first user interaction
 * to comply with browser autoplay policies.
 */
export function BackgroundMusic() {
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("shreds_muted") === "1";
  });
  const [started, setStarted] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<Array<{ stop: () => void }>>([]);

  const start = useCallback(() => {
    if (ctxRef.current) return;
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.22;
    masterRef.current = master;

    // Simple stereo delay/reverb-ish for atmosphere
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(master);
    master.connect(ctx.destination);

    // Chord: A minor 9 arpeggio – exciting-but-mellow
    const notes = [220.0, 261.63, 329.63, 392.0, 493.88, 587.33];
    const patternInterval = 0.32; // seconds per step
    const loopLength = 16; // steps
    let step = 0;

    const scheduleStep = (when: number) => {
      const freq = notes[step % notes.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = step % 4 === 0 ? "triangle" : "sine";
      osc.frequency.value = freq * (step % 8 === 7 ? 2 : 1);
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(0.18, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.9);
      osc.connect(gain);
      gain.connect(master);
      gain.connect(delay);
      osc.start(when);
      osc.stop(when + 1.0);
      step = (step + 1) % loopLength;
    };

    // Soft pad drone
    const pad = ctx.createOscillator();
    const padGain = ctx.createGain();
    pad.type = "sawtooth";
    pad.frequency.value = 110;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 500;
    padGain.gain.value = 0.06;
    pad.connect(padFilter).connect(padGain).connect(master);
    pad.start();

    // LFO on pad filter for movement
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(padFilter.frequency);
    lfo.start();

    let next = ctx.currentTime + 0.1;
    const timer = window.setInterval(() => {
      while (next < ctx.currentTime + 0.5) {
        scheduleStep(next);
        next += patternInterval;
      }
    }, 100);

    nodesRef.current.push({
      stop: () => {
        window.clearInterval(timer);
        try { pad.stop(); } catch { /* noop */ }
        try { lfo.stop(); } catch { /* noop */ }
      },
    });

    setStarted(true);
  }, [muted]);

  // Kick off on first user interaction anywhere
  useEffect(() => {
    if (started) return;
    const handler = () => { start(); cleanup(); };
    const cleanup = () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("touchstart", handler);
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    window.addEventListener("touchstart", handler, { once: true });
    return cleanup;
  }, [start, started]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem("shreds_muted", next ? "1" : "0"); } catch { /* noop */ }
    if (masterRef.current && ctxRef.current) {
      masterRef.current.gain.setTargetAtTime(next ? 0 : 0.22, ctxRef.current.currentTime, 0.05);
    }
    if (!started && !next) start();
  };

  useEffect(() => () => {
    nodesRef.current.forEach((n) => n.stop());
    ctxRef.current?.close().catch(() => { /* noop */ });
  }, []);

  return (
    <button
      onClick={toggleMute}
      aria-label={muted ? "Unmute background music" : "Mute background music"}
      className="fixed top-2 right-2 z-40 icon-tile w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
    >
      {muted
        ? <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
        : <Volume2 className="w-3.5 h-3.5 text-shred" />}
    </button>
  );
}
