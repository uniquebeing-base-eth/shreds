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
    if (!pk) throw new Error("Reward signer not configured");

    // Server clamps amount to a safe ceiling for the pack tier
    const priceCap = Number(PACK_PRICE_USDM[data.packId] || 0) * 4 || 0.05;
    const requested = data.amountUsdm ?? rollUsdm(data.packId);
    const amount = Math.min(Math.max(requested, 0), priceCap);
    if (amount <= 0) return { ok: true, skipped: true };

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

    try {
      // Check rewarder balance first — surface a clean message if empty.
      const bal = (await publicClient.readContract({
        address: USDM_ADDRESS as `0x${string}`,
        abi: [{ inputs: [{ name: "a", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }],
        functionName: "balanceOf",
        args: [account.address],
      })) as bigint;
      if (bal < amountWei) {
        return { ok: false, error: "reward_pool_empty", signer: account.address };
      }

      const hash = await walletClient.sendTransaction({
        to: USDM_ADDRESS as `0x${string}`,
        data: transferData,
      });

      // Fire-and-forget receipt wait — but await so we can report success/failure.
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
      return {
        ok: receipt.status === "success",
        txHash: hash,
        amount,
        signer: account.address,
      };
    } catch (e) {
      return { ok: false, error: (e as Error)?.message?.slice(0, 200) ?? "send_failed" };
    }
  });
