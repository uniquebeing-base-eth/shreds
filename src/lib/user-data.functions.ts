// Server fns backing profile, leaderboard, activity, and pack purchase records.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { walletToProfileId } from "@/lib/profile";

/* -------------------- Profile / username -------------------- */

export const upsertProfile = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({
      wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      username: z.string().min(1).max(32).optional(),
    }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalizedWallet = data.wallet.toLowerCase();
    const profileId = walletToProfileId(normalizedWallet);
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("profiles")
      .select("id, username, xp, packs_shredded, level")
      .eq("id", profileId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);

    const payload = {
      id: profileId,
      wallet: normalizedWallet,
      username: data.username ?? existing?.username ?? null,
      xp: existing?.xp ?? 0,
      packs_shredded: existing?.packs_shredded ?? 0,
      level: existing?.level ?? 1,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => z.object({ wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }).parse(raw ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const profileId = walletToProfileId(data.wallet);
    const { data: row, error } = await supabaseAdmin
      .from("profiles").select("*").eq("id", profileId).maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

/* -------------------- Discoveries / activity -------------------- */

const DiscoveryInput = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
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
  .inputValidator((raw: unknown) => DiscoveryInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalizedWallet = data.wallet.toLowerCase();
    const profileId = walletToProfileId(normalizedWallet);
    const xpGain = data.items
      .filter((i) => i.kind === "XP" && typeof i.amount === "number")
      .reduce((s, i) => s + (i.amount ?? 0), 0);

    const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
      .from("profiles")
      .select("id, username, xp, packs_shredded, level")
      .eq("id", profileId)
      .maybeSingle();
    if (profileLookupError) throw new Error(profileLookupError.message);

    const nextXp = Number(existingProfile?.xp ?? 0) + xpGain;
    const nextPacksShredded = Number(existingProfile?.packs_shredded ?? 0) + 1;
    const nextLevel = Math.max(1, Math.floor(nextXp / 500) + 1);

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: profileId,
      wallet: normalizedWallet,
      username: existingProfile?.username ?? null,
      xp: nextXp,
      packs_shredded: nextPacksShredded,
      level: nextLevel,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (profileError) throw new Error(profileError.message);

    const rows = data.items.map((i) => ({
      user_id: profileId,
      pack_id: data.packId,
      kind: i.kind,
      title: i.title,
      sub: i.sub,
      rarity: i.rarity ?? "Common",
      amount: i.amount ?? null,
    }));
    const { error } = await supabaseAdmin.from("discoveries").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, xp: xpGain };
  });

export const listMyDiscoveries = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => z.object({ wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/) }).parse(raw ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const profileId = walletToProfileId(data.wallet);
    const { data: rows, error } = await supabaseAdmin
      .from("discoveries")
      .select("*")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getStatsAndFeed = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => z.object({}).parse(raw ?? {}))
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: packRows, error: packError }, { data: globalRow, error: globalError }, { data: feedRows, error: feedError }] = await Promise.all([
      supabaseAdmin.from("pack_stats").select("pack_id,owners,shreds,drops").order("pack_id"),
      supabaseAdmin.from("global_stats").select("shredders,packs_shredded,discoveries,rewards_usdm").eq("id", 1).maybeSingle(),
      supabaseAdmin.from("live_feed").select("username,wallet,pack_id,kind,text,amount").order("created_at", { ascending: false }).limit(30),
    ]);

    if (packError) throw new Error(packError.message);
    if (globalError) throw new Error(globalError.message);
    if (feedError) throw new Error(feedError.message);

    const packStats = (packRows ?? []).reduce<Record<string, { owners: number; shreds: number; drops: number }>>((acc, row) => {
      acc[row.pack_id] = {
        owners: Number(row.owners ?? 0),
        shreds: Number(row.shreds ?? 0),
        drops: Number(row.drops ?? 0),
      };
      return acc;
    }, {});

    const globalStats = {
      shredders: Number(globalRow?.shredders ?? 0),
      packs_shredded: Number(globalRow?.packs_shredded ?? 0),
      discoveries: Number(globalRow?.discoveries ?? 0),
      rewards_usdm: Number(globalRow?.rewards_usdm ?? 0),
    };

    return {
      packStats,
      globalStats,
      liveFeed: (feedRows ?? []).map((row) => ({
        username: row.username,
        wallet: row.wallet,
        pack_id: row.pack_id,
        kind: row.kind,
        text: row.text,
        amount: row.amount,
      })),
    };
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
      .from("profiles")
      .select("username, wallet, xp, packs_shredded")
      .order("xp", { ascending: false })
      .limit(50);
    if (error) return [];
    return (rows ?? []).map((row) => ({ ...row, range: data.range })) as Array<{
      username: string | null;
      wallet: string | null;
      xp: number;
      packs_shredded: number;
      range: string;
    }>;
  });
