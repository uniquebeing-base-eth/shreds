This is a large scope. I want to confirm the approach before touching code so we don't rip up files twice.

## Scope

1. **Pack + global stats update live** — Move stats into DB, subscribe via realtime, increment after every shred.
2. **Live activity feed = every discovery** — Insert one feed row per USDM/CARD/FACT/XP item, broadcast via realtime, rotate in ticker.
3. **Reward distribution (on-chain USDM)** — Backend server function signs and *relays* (sends) the RewardDistributor tx from the signer wallet after each shred. Currently only signs; not sending.
4. **Help "?" button + Onboarding replay + FAQ page** — Add `?` next to Leaderboard, opens sheet: "Replay tutorial" + FAQ (links + Q&A).
5. **Preload critical assets** — `<link rel="preload">` for pack sealed+shredded images, discovery icons, onboarding, and `new Image().src=…` warm-up on mount.
6. **Celo network guard** — Before any tx, if `wallet.chainId !== CELO` prompt switch; block until on Celo. Already partly in `wallet.ts`, extend to buy handler UI.
7. **Farcaster `sdk.ready()`** — Already called on mount; keep as-is (already after init).
8. **Preview image (og:image + Farcaster manifest)** — Replace `/image.png` with the uploaded hero (the "Shreds Discover Collect Earn" key art). Reused across og:image, twitter:image, Farcaster manifest, `fc:miniapp` embed.

## Data model changes (new migration)

```sql
-- Per-pack counters (single row per pack_id)
CREATE TABLE public.pack_stats (
  pack_id text PRIMARY KEY,
  owners int NOT NULL DEFAULT 0,
  shreds int NOT NULL DEFAULT 0,
  drops int NOT NULL DEFAULT 0
);
-- Seed all 5 packs at 0.

-- Global rollup (single row id=1)
CREATE TABLE public.global_stats (
  id int PRIMARY KEY DEFAULT 1,
  shredders int NOT NULL DEFAULT 0,
  packs_shredded int NOT NULL DEFAULT 0,
  discoveries int NOT NULL DEFAULT 0,
  rewards_usdm numeric NOT NULL DEFAULT 0
);

-- Live feed
CREATE TABLE public.live_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  wallet text,
  kind text NOT NULL,       -- USDM | CARD | FACT | XP
  text text NOT NULL,
  amount numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

- All 3 tables: `GRANT SELECT ON … TO anon, authenticated;` writes only via `service_role` (via server fn). RLS enabled with read-only public policies.
- Add all 3 to `supabase_realtime` publication.

## Server-side changes

- `recordShred` (existing): after inserting discoveries, also
  - increment `pack_stats` (shreds+1, drops += items.length, owners+1 if first-time buyer of this pack for this user — tracked via existence in `pack_purchases`).
  - increment `global_stats` (packs_shredded+1, discoveries += items.length, rewards_usdm += usdm total, shredders+1 if first-ever pack for user).
  - insert one `live_feed` row per item (USDM/CARD/FACT; XP optional).
- **New**: `distributeReward` server fn — signs & *sends* USDM transfer from `REWARD_SIGNER` wallet using viem + `BACKEND_SIGNER_KEY`. Simple ERC20 `transfer(user, amountWei)` from the rewarder EOA (contract already holds USDM). Called by client right after successful shred.

## Frontend changes

- `index.tsx`:
  - Subscribe to `pack_stats`, `global_stats`, `live_feed` via realtime; render live numbers on packs + header + ticker.
  - After successful shred: call `recordShred` then `distributeReward` (fire-and-forget with toast).
  - Add `?` button in header → `HelpSheet` (Replay tutorial + FAQ w/ social links).
  - Preload effect: warm all `PACK_IMG`/`SHREDDED_IMG`/`DISCOVERY_IMG` at mount.
  - Guard buy: `if (!wallet.isCorrectChain) { await wallet.connect(); }` before `buyPackOnChain`.
- `__root.tsx`: add `<link rel="preload" as="image" href="/packs/…">` for the 5 sealed packs; update og:image if we swap `/image.png`.
- Replace `public/image.png` with uploaded hero via `code--copy`.

## Verification per fix

- After each batch, run `bun run build` (typecheck+build) via exec.
- Smoke test the home page with Playwright (screenshot header, packs, feed).

Confirm this approach and I'll execute in one turn.
