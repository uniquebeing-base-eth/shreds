// Server fn: sends USDM from the rewarder wallet to the player after a shred.
// Uses BACKEND_SIGNER_KEY on Celo mainnet. The signer must be allow-listed on
// the RewardDistributor contract (rewarders[signer] == true).
//
// Security:
//   - requireSupabaseAuth: only signed-in users can call.
//   - Amount is rolled SERVER-SIDE from the pack tier; client amountUsdm is ignored.
//   - Replay protection is enforced ON-CHAIN via claimId (deterministic per user+nonce).
//   - Pre-flight checks: rewarder allow-list, USDM treasury balance, claimId not used.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rollUsdm } from "./rewards";
import {
  PACK_KEY,
  PACK_PRICE_USDM,
  REWARDS_ABI,
  REWARDS_CONTRACT,
  USDM_ADDRESS,
  ERC20_ABI,
} from "./contracts";
import {
  getRuntimeEnv,
  normalizePrivateKey,
  resolveCeloRpcUrl,
} from "./reward-distribution";

const Input = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  packId: z.enum(["starter", "mystery", "alpha", "legendary", "explorer"]),
  nonce: z.string().min(4).max(128),
});

export const distributeReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const runtimeEnv = getRuntimeEnv();
    const pk = normalizePrivateKey(
      runtimeEnv.BACKEND_SIGNER_KEY || runtimeEnv.VITE_BACKEND_SIGNER_KEY,
    );
    if (!pk) {
      console.error("[reward] missing BACKEND_SIGNER_KEY", {
        runtimeEnvKeys: Object.keys(runtimeEnv).sort(),
      });
      return { ok: false, error: "Reward signer not configured" };
    }

    // Server-side amount roll. Ignore any client-supplied value entirely.
    // Hard ceiling per pack as defence-in-depth in case the table is edited.
    const priceCap = Number(PACK_PRICE_USDM[data.packId] || 0) * 4 || 0.05;
    const rolled = rollUsdm(data.packId);
    const amount = Math.min(Math.max(rolled, 0), priceCap);
    if (amount <= 0) {
      console.info("[reward] skipped zero reward", { packId: data.packId });
      return { ok: true, skipped: true };
    }

    const [
      viem,
      { privateKeyToAccount },
      { celo },
    ] = await Promise.all([
      import("viem"),
      import("viem/accounts"),
      import("viem/chains"),
    ]);
    const {
      createWalletClient,
      createPublicClient,
      http,
      parseUnits,
      keccak256,
      encodePacked,
    } = viem;

    const rpcUrl = resolveCeloRpcUrl(runtimeEnv);
    const account = privateKeyToAccount(pk as `0x${string}`);
    const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain: celo, transport: http(rpcUrl) });

    const amountWei = parseUnits(amount.toString(), 18);
    // packKey: 0 for starter (off-chain), otherwise the on-chain id.
    const packKey = BigInt(PACK_KEY[data.packId] ?? 0);

    // Deterministic claimId bound to the authenticated user + nonce. Because
    // it's keyed by userId, two different users can't collide and the same
    // user replaying the same nonce hits the contract's claimed[] guard.
    const claimId = keccak256(
      encodePacked(
        ["string", "address", "string", "string"],
        [context.userId, data.wallet as `0x${string}`, data.packId, data.nonce],
      ),
    );

    console.info("[reward] distribute start", {
      userId: context.userId,
      wallet: data.wallet,
      packId: data.packId,
      amount,
      signer: account.address,
      rpcUrl,
      claimId,
    });

    try {
      // Pre-flight: signer must be an authorised rewarder.
      const isRewarder = await publicClient.readContract({
        address: REWARDS_CONTRACT as `0x${string}`,
        abi: REWARDS_ABI,
        functionName: "rewarders",
        args: [account.address],
      });
      if (!isRewarder) {
        console.error("[reward] signer not authorised as rewarder", { signer: account.address });
        return { ok: false, error: "signer_not_rewarder" };
      }

      // Pre-flight: claim not yet used.
      const alreadyClaimed = await publicClient.readContract({
        address: REWARDS_CONTRACT as `0x${string}`,
        abi: REWARDS_ABI,
        functionName: "claimed",
        args: [claimId],
      });
      if (alreadyClaimed) {
        console.info("[reward] claim already used", { claimId });
        return { ok: true, skipped: true, reason: "already_claimed" };
      }

      // Pre-flight: rewards contract holds enough USDM.
      const treasuryBal = (await publicClient.readContract({
        address: USDM_ADDRESS as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [REWARDS_CONTRACT as `0x${string}`],
      })) as bigint;
      if (treasuryBal < amountWei) {
        console.error("[reward] treasury underfunded", {
          have: treasuryBal.toString(),
          need: amountWei.toString(),
        });
        return { ok: false, error: "treasury_underfunded" };
      }

      // Simulate first so we surface reverts as clean errors (no gas burn).
      const { request } = await publicClient.simulateContract({
        account,
        address: REWARDS_CONTRACT as `0x${string}`,
        abi: REWARDS_ABI,
        functionName: "distribute",
        args: [
          claimId,
          data.wallet as `0x${string}`,
          packKey,
          0n, // celoAmount — we only pay USDM
          [USDM_ADDRESS as `0x${string}`],
          [amountWei],
        ],
      });

      const hash = await walletClient.writeContract(request);
      console.info("[reward] tx sent", { hash, signer: account.address });

      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
      const ok = receipt.status === "success";
      console.info("[reward] receipt", { hash, status: receipt.status, block: receipt.blockNumber });
      if (!ok) console.error("[reward] tx reverted", { receipt });

      return {
        ok,
        txHash: hash,
        amount,
        signer: account.address,
        claimId,
      };
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      console.error("[reward] distribute error", {
        wallet: data.wallet,
        packId: data.packId,
        amount,
        signer: account?.address,
        error: msg,
        stack: (e as Error)?.stack,
      });
      return { ok: false, error: msg.slice(0, 300) || "send_failed" };
    }
  });
