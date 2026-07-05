import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { audio } from "@/lib/audio";

/**
 * Renders the mute toggle and boots the Shreds theme song on first user
 * interaction (browsers block autoplay until then). The audio file lives in
 * /public/audio so it plays inside the deployed MiniPay app, not just preview.
 */
export function BackgroundMusic() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    audio.init();
    setMuted(audio.isMuted());
    // Try to start immediately; if blocked, wait for first gesture.
    void audio.startTheme();
    const kick = () => { void audio.startTheme(); cleanup(); };
    const cleanup = () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
      window.removeEventListener("touchstart", kick);
    };
    window.addEventListener("pointerdown", kick, { once: true });
    window.addEventListener("keydown", kick, { once: true });
    window.addEventListener("touchstart", kick, { once: true });
    return cleanup;
  }, []);

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    audio.setMuted(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={muted ? "Unmute theme music" : "Mute theme music"}
      className="fixed bottom-12 right-2 z-40 icon-tile w-9 h-9 rounded-full flex items-center justify-center active:scale-95 shadow-lg"
    >
      {muted
        ? <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
        : <Volume2 className="w-3.5 h-3.5 text-shred" />}
    </button>
  );
}
