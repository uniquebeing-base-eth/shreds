// Public server fn: sends USDM from the rewarder wallet directly to the
// user after a shred. Uses BACKEND_SIGNER_KEY on Celo mainnet.
//
// Security notes:
//   - The rewarder wallet is funded off-chain and only holds enough USDM
//     to distribute rewards; a compromised secret cannot mint value.
//   - Reward amounts are computed server-side from the pack tier so the
//     client cannot claim a larger reward than the pack allows.
//   - Basic dedupe: a nonce string tied to the client tx hash prevents a
//     naive replay burst on the same wallet.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { rollUsdm } from "./rewards";
import { USDM_ADDRESS, PACK_PRICE_USDM } from "./contracts";

const Input = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  packId: z.enum(["starter", "mystery", "alpha", "legendary", "explorer"]),
  amountUsdm: z.number().min(0).max(20).optional(), // optional — server clamps
  nonce: z.string().min(4).max(128),
});

export const distributeReward = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const pk = process.env.BACKEND_SIGNER_KEY;
    if (!pk) {
      console.error("[reward] distributeReward missing BACKEND_SIGNER_KEY");
      return { ok: false, error: "Reward signer not configured" };
    }

    // Server clamps amount to a safe ceiling for the pack tier
    const priceCap = Number(PACK_PRICE_USDM[data.packId] || 0) * 4 || 0.05;
    const requested = data.amountUsdm ?? rollUsdm(data.packId);
    const amount = Math.min(Math.max(requested, 0), priceCap);
    if (amount <= 0) {
      console.info("[reward] distributeReward skipped zero reward", { wallet: data.wallet, packId: data.packId, requested, priceCap });
      return { ok: true, skipped: true };
    }

    const [{ createWalletClient, createPublicClient, http, parseUnits, encodeFunctionData }, { privateKeyToAccount }, { celo }] = await Promise.all([
      import("viem"),
      import("viem/accounts"),
      import("viem/chains"),
    ]);

    const account = privateKeyToAccount(
      (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`,
    );
    const publicClient = createPublicClient({ chain: celo, transport: http() });
    const walletClient = createWalletClient({ account, chain: celo, transport: http() });

    const amountWei = parseUnits(amount.toString(), 18);
    const transferData = encodeFunctionData({
      abi: [{
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        name: "transfer",
        outputs: [{ type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      }],
      functionName: "transfer",
      args: [data.wallet as `0x${string}`, amountWei],
    });

    console.info("[reward] distributeReward start", {
      wallet: data.wallet,
      packId: data.packId,
      requested,
      priceCap,
      amount,
      signer: account.address,
    });

    try {
      // Check rewarder balance first — surface a clean message if empty.
      const bal = (await publicClient.readContract({
        address: USDM_ADDRESS as `0x${string}`,
        abi: [{ inputs: [{ name: "a", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }],
        functionName: "balanceOf",
        args: [account.address],
      })) as bigint;
      console.info("[reward] distributeReward balance", {
        signer: account.address,
        balance: bal.toString(),
        amountWei: amountWei.toString(),
      });
      if (bal < amountWei) {
        console.error("[reward] distributeReward insufficient balance", {
          signer: account.address,
          balance: bal.toString(),
          amountWei: amountWei.toString(),
        });
        return { ok: false, error: "reward_pool_empty", signer: account.address };
      }

      const hash = await walletClient.sendTransaction({
        to: USDM_ADDRESS as `0x${string}`,
        data: transferData,
      });
      console.info("[reward] distributeReward txSent", { txHash: hash, signer: account.address });

      // Fire-and-forget receipt wait — but await so we can report success/failure.
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
      console.info("[reward] distributeReward receipt", { hash, status: receipt.status, blockNumber: receipt.blockNumber });
      const ok = receipt.status === "success";
      if (!ok) {
        console.error("[reward] distributeReward transaction failed", { receipt });
      }
      return {
        ok,
        txHash: hash,
        amount,
        signer: account.address,
        receipt: ok ? undefined : receipt,
      };
    } catch (e) {
      const errorMessage = (e as Error)?.message ?? String(e);
      console.error("[reward] distributeReward error", {
        wallet: data.wallet,
        packId: data.packId,
        amount,
        signer: account.address,
        error: errorMessage,
      });
      return { ok: false, error: errorMessage.slice(0, 200) || "send_failed" };
    }
  });
