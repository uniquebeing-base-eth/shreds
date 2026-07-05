// Server fns backing profile, leaderboard, activity, and pack purchase records.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* -------------------- Profile / username -------------------- */

export const upsertProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      username: z.string().min(1).max(32).optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      id: context.userId,
      wallet: data.wallet.toLowerCase(),
      ...(data.username ? { username: data.username } : {}),
    };
    const { error } = await context.supabase.from("profiles").upsert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles").select("*").eq("id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

/* -------------------- Discoveries / activity -------------------- */

const DiscoveryInput = z.object({
  packId: z.enum(["starter", "mystery", "alpha", "legendary", "explorer"]),
  items: z.array(z.object({
    kind: z.enum(["USDM", "USDT", "XP", "CARD", "FACT"]),
    title: z.string(),
    sub: z.string(),
    rarity: z.enum(["Common", "Rare", "Epic", "Legendary"]).optional(),
    amount: z.number().optional(), // USDM/USDT amount or XP points
  })).min(1).max(8),
});

export const recordShred = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => DiscoveryInput.parse(raw))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    // Add XP for each item that has an amount + kind == XP; increment shred counter.
    const xpGain = data.items
      .filter((i) => i.kind === "XP" && typeof i.amount === "number")
      .reduce((s, i) => s + (i.amount ?? 0), 0);

    await supabase.rpc("increment_shred_stats", {
      _user: context.userId,
      _xp: xpGain,
      _pack: data.packId,
    });

    const rows = data.items.map((i) => ({
      user_id: context.userId,
      pack_id: data.packId,
      kind: i.kind,
      title: i.title,
      sub: i.sub,
      rarity: i.rarity ?? "Common",
      amount: i.amount ?? null,
    }));
    const { error } = await supabase.from("discoveries").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, xp: xpGain };
  });

export const listMyDiscoveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("discoveries")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* -------------------- Leaderboard -------------------- */

export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => z.object({
    range: z.enum(["daily", "weekly", "monthly", "all"]).default("weekly"),
  }).parse(raw ?? {}))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: rows, error } = await supa
      .from("leaderboard_view")
      .select("username, wallet, xp, packs_shredded, range")
      .eq("range", data.range)
      .order("xp", { ascending: false })
      .limit(50);
    if (error) return [];
    return rows ?? [];
  });
