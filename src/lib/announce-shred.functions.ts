// Public server fn: records a shred to the DB (stats + live feed).
// Called client-side after a successful reveal. No auth required — this is
// broadcast data used by every viewer. Rate-limit-safe: any spam would only
// pollute the live ticker, and duplicates are eventually pruned by the LIMIT.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Item = z.object({
  kind: z.enum(["USDM", "USDT", "XP", "CARD", "FACT"]),
  title: z.string().min(1).max(80),
  amount: z.number().optional(),
});

const Input = z.object({
  packId: z.enum(["starter", "mystery", "alpha", "legendary", "explorer"]),
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/).nullable(),
  username: z.string().min(1).max(32),
  items: z.array(Item).min(1).max(8),
});

export const announceShred = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Determine "new owner" (first shred of this pack by this wallet)
    // and "new shredder" (first shred ever by this wallet).
    let isNewOwner = true;
    let isNewShredder = true;
    if (data.wallet) {
      const w = data.wallet.toLowerCase();
      const { count: packCount } = await supabaseAdmin
        .from("live_feed")
        .select("id", { count: "exact", head: true })
        .eq("wallet", w)
        .eq("pack_id", data.packId);
      isNewOwner = (packCount ?? 0) === 0;
      const { count: allCount } = await supabaseAdmin
        .from("live_feed")
        .select("id", { count: "exact", head: true })
        .eq("wallet", w);
      isNewShredder = (allCount ?? 0) === 0;
    }

    const rewards = data.items
      .filter((i) => i.kind === "USDM" || i.kind === "USDT")
      .reduce((s, i) => s + (i.amount ?? 0), 0);

    // Update stats atomically
    await supabaseAdmin.rpc("apply_shred", {
      _pack_id: data.packId,
      _drops: data.items.length,
      _rewards_usdm: rewards,
      _is_new_owner: isNewOwner,
      _is_new_shredder: isNewShredder,
    });

    // Insert one feed row per item (skip XP to keep feed tight)
    const feedRows = data.items
      .filter((i) => i.kind !== "XP")
      .map((i) => ({
        username: data.username,
        wallet: data.wallet?.toLowerCase() ?? null,
        pack_id: data.packId,
        kind: i.kind,
        text: i.kind === "USDM" || i.kind === "USDT"
          ? `discovered ${i.amount?.toFixed(i.amount && i.amount < 0.01 ? 3 : 2)} ${i.kind}`
          : i.kind === "CARD"
          ? `collected ${i.title}`
          : `discovered a fact`,
        amount: i.amount ?? null,
      }));

    if (feedRows.length > 0) {
      await supabaseAdmin.from("live_feed").insert(feedRows);
    }

    return { ok: true, isNewOwner, isNewShredder };
  });
