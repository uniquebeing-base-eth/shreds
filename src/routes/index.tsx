import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Trophy, User, Users, Package, Gem, Wallet, Flame, Gift, Star,
  Sparkles, Lightbulb, X, ChevronLeft, ChevronRight, Award, Zap,
} from "lucide-react";
import starterAsset from "@/assets/pack-starter.png.asset.json";
import mysteryAsset from "@/assets/pack-mystery.png.asset.json";
import alphaAsset from "@/assets/pack-alpha.png.asset.json";
import legendaryAsset from "@/assets/pack-legendary.png.asset.json";
import explorerAsset from "@/assets/pack-explorer.png.asset.json";
import logoAsset from "@/assets/shreds-logo.png.asset.json";

export const Route = createFileRoute("/")({ component: HomeScreen });

type Pack = {
  id: string; name: string; image: string; accent: string; glow: string;
  price: string; owners: string; shredded: string; discoveries: string;
};

const PACKS: Pack[] = [
  { id: "starter", name: "Starter Pack", image: starterAsset.url, accent: "oklch(0.88 0.28 135)", glow: "oklch(0.88 0.28 135 / 55%)", price: "FREE", owners: "102K+", shredded: "248K+", discoveries: "127+" },
  { id: "mystery", name: "Mystery Pack", image: mysteryAsset.url, accent: "oklch(0.68 0.22 300)", glow: "oklch(0.68 0.22 300 / 55%)", price: "1.00 USDM", owners: "58K+", shredded: "142K+", discoveries: "89+" },
  { id: "alpha", name: "Alpha Pack", image: alphaAsset.url, accent: "oklch(0.82 0.17 85)", glow: "oklch(0.82 0.17 85 / 55%)", price: "2.50 USDM", owners: "24K+", shredded: "71K+", discoveries: "54+" },
  { id: "legendary", name: "Legendary Pack", image: legendaryAsset.url, accent: "oklch(0.78 0.2 60)", glow: "oklch(0.78 0.2 60 / 55%)", price: "10.00 USDM", owners: "6.2K+", shredded: "18K+", discoveries: "32+" },
  { id: "ultimate", name: "Ultimate Pack", image: explorerAsset.url, accent: "oklch(0.85 0.18 75)", glow: "oklch(0.85 0.18 75 / 55%)", price: "25.00 USDM", owners: "812", shredded: "2.1K", discoveries: "18+" },
];

type Discovery = {
  kind: "USDM" | "USDT" | "XP" | "TOKEN" | "CARD" | "FACT" | "DYK";
  title: string; sub: string; color: string; Icon: React.ComponentType<{ className?: string }>;
};

const DISCOVERY_POOL: Discovery[] = [
  { kind: "USDM", title: "2.50 USDM", sub: "Stablecoin", color: "oklch(0.7 0.2 145)", Icon: Wallet },
  { kind: "USDT", title: "1.00 USDT", sub: "USDT on Celo", color: "oklch(0.7 0.18 165)", Icon: Wallet },
  { kind: "XP", title: "150 XP", sub: "Experience", color: "oklch(0.68 0.22 250)", Icon: Star },
  { kind: "TOKEN", title: "1 Shred Token", sub: "Token", color: "oklch(0.82 0.17 85)", Icon: Gem },
  { kind: "CARD", title: "Neon Cube", sub: "Rare Collectible", color: "oklch(0.68 0.22 300)", Icon: Award },
  { kind: "DYK", title: "Did You Know?", sub: "Celo runs on carbon-negative infra", color: "oklch(0.68 0.22 300)", Icon: Lightbulb },
  { kind: "FACT", title: "MiniPay Fact", sub: "MiniPay serves 7M+ users worldwide", color: "oklch(0.7 0.2 145)", Icon: Sparkles },
  { kind: "FACT", title: "Celo Fact", sub: "Blocks finalize in ~1 second", color: "oklch(0.7 0.2 200)", Icon: Sparkles },
];

const LIVE_EVENTS = [
  { user: "Ada", text: "discovered", accent: "2.50 USDM", from: "Mystery Pack" },
  { user: "David", text: "unlocked", accent: "a Rare Collection Card", from: "Alpha Pack" },
  { user: "Sarah", text: "found", accent: "a MiniPay Fact", from: "Starter Pack" },
  { user: "Michael", text: "completed", accent: "a Collection", from: "Legendary Pack" },
  { user: "Lin", text: "discovered", accent: "5.00 USDT", from: "Ultimate Pack" },
  { user: "Kwame", text: "unlocked", accent: "a Legendary Card", from: "Legendary Pack" },
];

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#4ade80,#22c55e)",
  "linear-gradient(135deg,#a78bfa,#7c3aed)",
  "linear-gradient(135deg,#fbbf24,#f59e0b)",
  "linear-gradient(135deg,#60a5fa,#2563eb)",
  "linear-gradient(135deg,#f472b6,#db2777)",
  "linear-gradient(135deg,#34d399,#0d9488)",
];

function useMiniPayWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "unavailable">("idle");

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      setStatus("connecting");
      try {
        const eth = (typeof window !== "undefined" ? (window as any).ethereum : null);
        if (!eth) { if (!cancelled) setStatus("unavailable"); return; }
        // MiniPay auto-connects — accounts are immediately available.
        if (eth.isMiniPay) {
          const accounts: string[] = await eth.request({ method: "eth_accounts" });
          if (!cancelled && accounts?.[0]) { setAddress(accounts[0]); setStatus("connected"); return; }
        }
        // Fallback: any injected wallet
        const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
        if (!cancelled && accounts?.[0]) { setAddress(accounts[0]); setStatus("connected"); }
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    }
    connect();
    return () => { cancelled = true; };
  }, []);

  return { address, status };
}

function shortAddr(a: string | null) {
  if (!a) return "";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

/* ----------------- Home Screen ----------------- */

function HomeScreen() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"idle" | "slashing" | "opening" | "revealing">("idle");
  const [reveals, setReveals] = useState<Discovery[]>([]);
  const [collection, setCollection] = useState<Discovery[]>([]);
  const [tickerIdx, setTickerIdx] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const wallet = useMiniPayWallet();

  const pack = PACKS[index];

  // ticker rotation
  useEffect(() => {
    const t = setInterval(() => setTickerIdx((i) => (i + 1) % LIVE_EVENTS.length), 3500);
    return () => clearInterval(t);
  }, []);

  const goPrev = () => setIndex((i) => (i - 1 + PACKS.length) % PACKS.length);
  const goNext = () => setIndex((i) => (i + 1) % PACKS.length);

  const runShred = useCallback(() => {
    if (phase !== "idle") return;
    // pick 2-4 discoveries
    const n = 2 + Math.floor(Math.random() * 3);
    const items: Discovery[] = [];
    const pool = [...DISCOVERY_POOL];
    for (let i = 0; i < n; i++) {
      items.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    setReveals(items);
    setPhase("slashing");
    setTimeout(() => setPhase("opening"), 550);
    setTimeout(() => {
      setPhase("revealing");
      setCollection((c) => [...items.filter(i => i.kind === "CARD" || i.kind === "DYK" || i.kind === "FACT"), ...c].slice(0, 40));
    }, 1350);
  }, [phase]);

  const closeReveal = () => { setPhase("idle"); setReveals([]); };

  return (
    <div className="min-h-dvh w-full text-foreground pb-20">
      <div className="mx-auto w-full max-w-md px-4 pt-6">
        {/* Header */}
        <header className="grid grid-cols-[64px_1fr_64px] items-center gap-2">
          <button
            onClick={() => setShowLeaderboard(true)}
            className="flex flex-col items-center gap-1 group"
            aria-label="Leaderboard"
          >
            <div className="icon-tile w-14 h-14 rounded-2xl flex items-center justify-center group-active:scale-95 transition">
              <Trophy className="w-7 h-7 text-[color:var(--gold)]" />
            </div>
            <span className="text-[10px] font-semibold tracking-widest text-muted-foreground">LEADERBOARD</span>
          </button>

          <div className="flex flex-col items-center">
            <img src={logoAsset.url} alt="Shreds" className="h-14 w-auto object-contain drop-shadow-[0_0_25px_oklch(0.88_0.28_135/0.45)]" />
            <div className="mt-1 text-[10px] font-bold tracking-[0.28em]">
              <span className="text-foreground">DISCOVER. </span>
              <span className="text-shred">COLLECT. </span>
              <span className="text-[color:var(--gold)]">EARN.</span>
            </div>
          </div>

          <button
            onClick={() => setShowProfile(true)}
            className="flex flex-col items-center gap-1 group"
            aria-label="Profile"
          >
            <div className="icon-tile w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden group-active:scale-95 transition">
              <div className="w-full h-full flex items-center justify-center" style={{ background: AVATAR_GRADIENTS[0] }}>
                <User className="w-7 h-7 text-white" />
              </div>
            </div>
            <span className="text-[10px] font-semibold tracking-widest text-muted-foreground">PROFILE</span>
          </button>
        </header>

        {/* Stats row */}
        <div className="stat-card mt-5 rounded-2xl px-3 py-3 grid grid-cols-4 gap-2">
          <Stat icon={<Users className="w-4 h-4 text-shred" />} value="184K+" label="SHREDDERS" />
          <Stat icon={<Package className="w-4 h-4 text-[color:oklch(0.7_0.18_240)]" />} value="2.8M+" label="PACKS SHREDDED" />
          <Stat icon={<Gem className="w-4 h-4 text-[color:var(--royal)]" />} value="945K+" label="DISCOVERIES" />
          <Stat icon={<Wallet className="w-4 h-4 text-[color:var(--gold)]" />} value="$126K+" label="REWARDS" />
        </div>

        {/* Pack carousel */}
        <PackCarousel
          index={index}
          onPrev={goPrev}
          onNext={goNext}
          onShred={runShred}
          phase={phase}
        />

        {/* Pack details */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          <MiniStat Icon={Star} value={pack.price} label="PRICE" tint="oklch(0.88 0.28 135)" />
          <MiniStat Icon={Users} value={pack.owners} label="OWNERS" tint="oklch(0.7 0.2 145)" />
          <MiniStat Icon={Flame} value={pack.shredded} label="SHREDDED" tint="oklch(0.75 0.2 45)" />
          <MiniStat Icon={Gift} value={pack.discoveries} label="DISCOVERIES" tint="oklch(0.68 0.22 300)" />
        </div>

        {/* Dots */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {PACKS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              aria-label={`Go to ${p.name}`}
              className="h-2 rounded-full transition-all"
              style={{
                width: i === index ? 22 : 8,
                background: i === index ? pack.accent : "oklch(0.35 0.02 150)",
                boxShadow: i === index ? `0 0 12px ${pack.glow}` : "none",
              }}
            />
          ))}
        </div>

        {/* Hint */}
        <div className="mt-4 text-center">
          <div className="font-display text-2xl text-shred text-glow-shred">SLASH ACROSS TO SHRED</div>
          <div className="text-xs tracking-[0.25em] font-semibold text-muted-foreground mt-1">
            REVEAL YOUR DISCOVERIES
          </div>
        </div>

        {/* Wallet chip */}
        <div className="mt-4 flex justify-center">
          <div className="stat-card rounded-full px-3 py-1.5 text-[11px] font-semibold flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${wallet.status === "connected" ? "bg-shred" : "bg-muted-foreground"} animate-pulse`} />
            {wallet.status === "connected" && <>MiniPay · {shortAddr(wallet.address)}</>}
            {wallet.status === "connecting" && <>Connecting MiniPay…</>}
            {wallet.status === "unavailable" && <>Open in MiniPay to auto-connect</>}
            {wallet.status === "idle" && <>Initializing wallet…</>}
          </div>
        </div>
      </div>

      {/* Live activity */}
      <LiveTicker event={LIVE_EVENTS[tickerIdx]} idx={tickerIdx} />

      {/* Reveal overlay */}
      {phase !== "idle" && (
        <RevealOverlay phase={phase} reveals={reveals} pack={pack} onClose={closeReveal} />
      )}

      {showLeaderboard && <LeaderboardSheet onClose={() => setShowLeaderboard(false)} />}
      {showProfile && <ProfileSheet onClose={() => setShowProfile(false)} wallet={wallet.address} collection={collection} />}
    </div>
  );
}

/* ----------------- Small pieces ----------------- */

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center gap-1">{icon}<span className="font-bold text-sm">{value}</span></div>
      <div className="text-[9px] font-bold tracking-widest text-muted-foreground mt-0.5 leading-tight">{label}</div>
    </div>
  );
}

function MiniStat({ Icon, value, label, tint }: { Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; value: string; label: string; tint: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Icon className="w-5 h-5 mb-1" style={{ color: tint }} />
      <div className="font-bold text-sm leading-none">{value}</div>
      <div className="text-[9px] font-bold tracking-widest text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

/* ----------------- Pack Carousel ----------------- */

function PackCarousel({
  index, onPrev, onNext, onShred, phase,
}: {
  index: number; onPrev: () => void; onNext: () => void; onShred: () => void; phase: "idle" | "slashing" | "opening" | "revealing";
}) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const [slash, setSlash] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const prev = PACKS[(index - 1 + PACKS.length) % PACKS.length];
  const next = PACKS[(index + 1) % PACKS.length];
  const pack = PACKS[index];

  function onPointerDown(e: React.PointerEvent) {
    start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    const dt = Date.now() - start.current.t;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    start.current = null;
    if (phase !== "idle") return;
    // slash: fast diagonal / horizontal-ish long swipe
    const dist = Math.hypot(dx, dy);
    if (dist > 90 && dt < 700 && absY > 20 && absX > 40 && absX / absY < 4) {
      // record slash line relative to container
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const sx = start.current ? 0 : (e.clientX - dx) - rect.left;
        setSlash({ x1: (e.clientX - dx) - rect.left, y1: (e.clientY - dy) - rect.top, x2: e.clientX - rect.left, y2: e.clientY - rect.top });
        void sx;
      }
      onShred();
      setTimeout(() => setSlash(null), 900);
      return;
    }
    // swipe navigation
    if (absX > absY && absX > 50) { dx < 0 ? onNext() : onPrev(); }
  }

  return (
    <div
      ref={containerRef}
      className="relative mt-4 h-[440px] select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* prev peek */}
      <PackImage pack={prev} className="absolute left-[-40%] top-1/2 -translate-y-1/2 h-[70%] opacity-50 blur-[1px]" />
      {/* next peek */}
      <PackImage pack={next} className="absolute right-[-40%] top-1/2 -translate-y-1/2 h-[70%] opacity-50 blur-[1px]" />

      {/* current */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-full w-full flex items-center justify-center float-y">
          <div
            className="absolute inset-0 rounded-[40%] blur-3xl opacity-70"
            style={{ background: `radial-gradient(ellipse at center, ${pack.glow}, transparent 60%)` }}
          />
          <PackImage
            pack={pack}
            className={`relative h-full max-h-[440px] w-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)] ${phase === "opening" || phase === "revealing" ? "pack-tearing" : ""}`}
          />
          {/* claw slash svg */}
          {slash && (
            <svg className="claw absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${containerRef.current?.clientWidth ?? 300} ${containerRef.current?.clientHeight ?? 440}`}>
              {[-14, 0, 14].map((off, i) => {
                const nx = -(slash.y2 - slash.y1);
                const ny = slash.x2 - slash.x1;
                const len = Math.hypot(nx, ny) || 1;
                const ox = (nx / len) * off, oy = (ny / len) * off;
                return (
                  <path
                    key={i}
                    d={`M ${slash.x1 + ox} ${slash.y1 + oy} L ${slash.x2 + ox} ${slash.y2 + oy}`}
                    stroke="oklch(0.92 0.3 130)"
                    strokeWidth={i === 1 ? 6 : 4}
                    strokeLinecap="round"
                    fill="none"
                  />
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Arrows */}
      <button
        onClick={onPrev}
        aria-label="Previous pack"
        className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full stat-card flex items-center justify-center active:scale-95"
      >
        <ChevronLeft className="w-5 h-5 text-shred" />
      </button>
      <button
        onClick={onNext}
        aria-label="Next pack"
        className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full stat-card flex items-center justify-center active:scale-95"
      >
        <ChevronRight className="w-5 h-5 text-shred" />
      </button>
    </div>
  );
}

function PackImage({ pack, className }: { pack: Pack; className?: string }) {
  return <img src={pack.image} alt={pack.name} draggable={false} className={className} />;
}

/* ----------------- Reveal Overlay ----------------- */

function RevealOverlay({ phase, reveals, pack, onClose }: {
  phase: "slashing" | "opening" | "revealing" | "idle"; reveals: Discovery[]; pack: Pack; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-md flex flex-col items-center justify-center px-6">
      {phase === "slashing" && (
        <div className="font-display text-4xl text-shred text-glow-shred animate-pulse">SHREDDING…</div>
      )}
      {phase === "opening" && (
        <div className="font-display text-4xl text-shred text-glow-shred">TEARING OPEN…</div>
      )}
      {phase === "revealing" && (
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-xs tracking-[0.3em] font-bold text-muted-foreground">FROM {pack.name.toUpperCase()}</div>
            <div className="font-display text-4xl text-shred text-glow-shred mt-1">YOUR DISCOVERIES</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {reveals.map((d, i) => (
              <div
                key={i}
                className="reveal-pop rounded-2xl p-4 flex flex-col items-center text-center relative overflow-hidden"
                style={{
                  animationDelay: `${i * 180}ms`,
                  background: `linear-gradient(180deg, oklch(0.22 0.04 150 / 90%), oklch(0.14 0.02 150 / 95%))`,
                  border: `1px solid ${d.color}`,
                  boxShadow: `0 0 30px ${d.color.replace(")", " / 35%)")}`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                  style={{ background: `radial-gradient(circle, ${d.color.replace(")", " / 60%)")}, transparent)` }}
                >
                  <d.Icon className="w-7 h-7" />
                </div>
                <div className="font-bold text-lg leading-tight">{d.title}</div>
                <div className="text-[10px] tracking-widest font-semibold text-muted-foreground mt-1 uppercase">{d.sub}</div>
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="mt-8 w-full py-3 rounded-2xl font-bold tracking-wider bg-shred text-primary-foreground active:scale-[0.98] glow-shred"
          >
            COLLECT & CONTINUE
          </button>
        </div>
      )}
    </div>
  );
}

/* ----------------- Live Ticker ----------------- */

function LiveTicker({ event, idx }: { event: typeof LIVE_EVENTS[number]; idx: number }) {
  return (
    <div className="fixed bottom-3 inset-x-0 flex justify-center px-3 z-30 pointer-events-none">
      <div key={idx} className="ticker-in stat-card rounded-2xl px-3 py-2 flex items-center gap-2 w-full max-w-md pointer-events-auto">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-shred/15 text-shred text-[10px] font-bold tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-shred animate-pulse" /> LIVE
        </div>
        <div
          className="w-7 h-7 rounded-full shrink-0"
          style={{ background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length] }}
        />
        <div className="text-xs flex-1 truncate">
          <span className="font-bold">{event.user}</span>{" "}
          <span className="text-muted-foreground">{event.text}</span>{" "}
          <span className="font-bold text-shred">{event.accent}</span>{" "}
          <span className="text-muted-foreground">from a</span>{" "}
          <span className="font-bold text-[color:var(--royal)]">{event.from}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">now</span>
        <Zap className="w-4 h-4 text-shred" />
      </div>
    </div>
  );
}

/* ----------------- Leaderboard ----------------- */

const LB_USERS = [
  "Ada", "David", "Sarah", "Michael", "Lin", "Kwame", "Nia", "Jorge", "Priya", "Mateo",
];

function LeaderboardSheet({ onClose }: { onClose: () => void }) {
  const tabs = ["Daily", "Weekly", "Monthly", "All Time"] as const;
  const [tab, setTab] = useState<typeof tabs[number]>("Weekly");
  const rows = useMemo(() => {
    const seed = tab === "Daily" ? 1 : tab === "Weekly" ? 3 : tab === "Monthly" ? 7 : 11;
    return LB_USERS.map((u, i) => ({
      user: u, xp: (10000 * (10 - i) + seed * 137 * (i + 1)).toLocaleString(),
    }));
  }, [tab]);

  return (
    <Sheet title="Leaderboard" onClose={onClose} Icon={Trophy}>
      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold tracking-wider transition ${tab === t ? "bg-shred text-primary-foreground glow-shred" : "stat-card text-muted-foreground"}`}
          >{t.toUpperCase()}</button>
        ))}
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.user} className="stat-card rounded-xl px-3 py-3 flex items-center gap-3">
            <div className="w-8 text-center font-display text-xl" style={{ color: i === 0 ? "var(--gold)" : i === 1 ? "oklch(0.8 0.02 150)" : i === 2 ? "oklch(0.68 0.15 40)" : "var(--muted-foreground)" }}>
              #{i + 1}
            </div>
            <div className="w-9 h-9 rounded-full" style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }} />
            <div className="flex-1 font-bold">{r.user}</div>
            <div className="text-shred font-bold">{r.xp} <span className="text-[10px] tracking-widest text-muted-foreground">XP</span></div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/* ----------------- Profile ----------------- */

function ProfileSheet({ onClose, wallet, collection }: { onClose: () => void; wallet: string | null; collection: Discovery[] }) {
  const cards = collection.filter(c => c.kind === "CARD").length;
  const dyk = collection.filter(c => c.kind === "DYK").length;
  const facts = collection.filter(c => c.kind === "FACT").length;
  return (
    <Sheet title="Profile" onClose={onClose} Icon={User}>
      <div className="stat-card rounded-2xl p-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl" style={{ background: AVATAR_GRADIENTS[0] }} />
        <div className="flex-1">
          <div className="font-display text-2xl">SHREDDER_01</div>
          <div className="text-xs text-muted-foreground truncate">{wallet ? shortAddr(wallet) : "Wallet not connected"}</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="px-2 py-0.5 rounded-full bg-shred/15 text-shred text-[10px] font-bold tracking-wider">LVL 7</div>
            <div className="text-xs text-muted-foreground">1,250 / 2,000 XP</div>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-shred glow-shred" style={{ width: "62%" }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <ProfileStat label="PACKS" value="42" />
        <ProfileStat label="REWARDS" value="$18.40" />
        <ProfileStat label="XP" value="1,250" />
        <ProfileStat label="CARDS" value={String(cards)} />
        <ProfileStat label="DID YOU KNOW" value={String(dyk)} />
        <ProfileStat label="SHRED FACTS" value={String(facts)} />
      </div>

      <div className="mt-6">
        <div className="text-xs tracking-[0.25em] font-bold text-muted-foreground mb-2">ACHIEVEMENTS</div>
        <div className="grid grid-cols-4 gap-2">
          {["First Shred", "10 Packs", "Rare Find", "Streak x3"].map((a, i) => (
            <div key={a} className="stat-card rounded-xl p-2 flex flex-col items-center text-center">
              <Award className="w-6 h-6 text-[color:var(--gold)]" />
              <div className="text-[10px] font-bold mt-1 leading-tight">{a}</div>
              {i > 1 && <div className="text-[9px] text-muted-foreground">locked</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="text-xs tracking-[0.25em] font-bold text-muted-foreground mb-2">COLLECTION PROGRESS</div>
        <ProgressBar label="Collection Cards" value={cards} max={20} />
        <ProgressBar label="Did You Know" value={dyk} max={15} />
        <ProgressBar label="Shred Facts" value={facts} max={25} />
      </div>
    </Sheet>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card rounded-xl p-3 text-center">
      <div className="font-display text-xl">{value}</div>
      <div className="text-[9px] tracking-widest font-bold text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">{value}/{max}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-shred" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ----------------- Sheet ----------------- */

function Sheet({ title, onClose, children, Icon }: { title: string; onClose: () => void; children: React.ReactNode; Icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-end sm:items-center justify-center">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto no-scrollbar rounded-t-3xl sm:rounded-3xl bg-card border border-border p-5 reveal-pop">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-shred" />
            <h2 className="font-display text-2xl">{title.toUpperCase()}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full stat-card flex items-center justify-center" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
