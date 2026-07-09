export async function initializeFarcasterMiniApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const mod = await import(/* @vite-ignore */ "@farcaster/miniapp-sdk");
    const sdk = (mod as { sdk?: { actions?: { ready?: () => unknown }; ready?: () => unknown } }).sdk;

    if (!sdk) return false;
    if (typeof sdk.actions?.ready === "function") {
      await sdk.actions.ready();
      return true;
    }
    if (typeof sdk.ready === "function") {
      await sdk.ready();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
