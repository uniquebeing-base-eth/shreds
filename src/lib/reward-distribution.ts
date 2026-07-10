export function normalizePrivateKey(value?: string | null): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return undefined;

  if (!trimmed.startsWith("0x") && /^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return `0x${trimmed}`;
  }

  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

export function resolveCeloRpcUrl(env: Record<string, string | undefined> = {}): string {
  const configured = (env.CELO_RPC_URL || env.VITE_CELO_RPC_URL || env.CELO_RPC || "").trim();
  return configured || "https://forno.celo.org";
}
