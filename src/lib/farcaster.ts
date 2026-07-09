let farcasterReadyPromise: Promise<boolean> | null = null;

export async function initializeFarcasterMiniApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (farcasterReadyPromise) return farcasterReadyPromise;

  farcasterReadyPromise = (async () => {
    try {
      const mod = await import("[@farcaster](https://farcaster.xyz/farcaster)/miniapp-sdk");

      const sdk = (mod as {
        sdk?: {
          actions?: {
            ready?: () => Promise<void> | void;
          };
        };
      }).sdk;

      if (typeof sdk?.actions?.ready !== "function") {
        console.error("Farcaster Mini App SDK ready action unavailable");
        return false;
      }

      await sdk.actions.ready();

      return true;
    } catch (error) {
      console.error("Failed to initialize Farcaster Mini App", error);
      return false;
    }
  })();

  return farcasterReadyPromise;
}
