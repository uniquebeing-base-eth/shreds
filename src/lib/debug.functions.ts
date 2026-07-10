import { createServerFn } from "@tanstack/react-start";
import { getRuntimeEnv, normalizePrivateKey, resolveCeloRpcUrl } from "./reward-distribution";
import { REWARDS_CONTRACT, USDM_ADDRESS, REWARDS_ABI, ERC20_ABI } from "./contracts";

// Debug endpoint to verify server function reachability and probe on-chain state
export const debugReward = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const env = getRuntimeEnv();
    const rpcUrl = resolveCeloRpcUrl(env);
    const pk = normalizePrivateKey(env.BACKEND_SIGNER_KEY || env.VITE_BACKEND_SIGNER_KEY);
    const out: Record<string, unknown> = {
      ok: true,
      hasBackendSigner: Boolean(pk),
      rewardsContract: REWARDS_CONTRACT,
      celoRpc: rpcUrl,
    };

    if (pk) {
      try {
        const [{ createPublicClient, http }, { privateKeyToAccount }] = await Promise.all([
          import("viem"),
          import("viem/accounts"),
        ]);
        const { celo } = await import("viem/chains");
        const account = privateKeyToAccount(pk as `0x${string}`);
        const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });

        const isRewarder = await publicClient.readContract({ address: REWARDS_CONTRACT as `0x${string}`, abi: REWARDS_ABI, functionName: "rewarders", args: [account.address] });
        const treasuryBal = await publicClient.readContract({ address: USDM_ADDRESS as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [REWARDS_CONTRACT as `0x${string}`] });

        out.signer = account.address;
        out.isRewarder = Boolean(isRewarder);
        out.treasuryBalance = treasuryBal?.toString?.() ?? String(treasuryBal);
      } catch (onchainErr) {
        out.onchainError = (onchainErr as Error)?.message ?? String(onchainErr);
      }
    }

    return out;
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? String(e) };
  }
});
