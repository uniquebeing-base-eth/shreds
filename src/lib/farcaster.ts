let farcasterReadyPromise: Promise<boolean> | null = null;

export async function initializeFarcasterMiniApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (farcasterReadyPromise) return farcasterReadyPromise;

  farcasterReadyPromise = (async () => {
    const looksLikeMiniApp = Boolean(
      window.ReactNativeWebView || window.parent !== window,
    );

    if (!looksLikeMiniApp) return false;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const mod = await import(/* @vite-ignore */ "@farcaster/miniapp-sdk");
        const sdk = (mod as { sdk?: unknown; default?: unknown }).sdk ??
          (mod as { default?: unknown }).default;

        if (!sdk || typeof sdk !== "object") {
          throw new Error("sdk-unavailable");
        }

        const ready = (sdk as {
          actions?: { ready?: (options?: Record<string, unknown>) => unknown };
          ready?: (options?: Record<string, unknown>) => unknown;
        }).actions?.ready ?? (sdk as { ready?: (options?: Record<string, unknown>) => unknown }).ready;

        if (typeof ready !== "function") {
          throw new Error("ready-unavailable");
        }

        await ready({});
        return true;
      } catch {
        if (attempt === 4) break;
        await new Promise((resolve) => window.setTimeout(resolve, 250 + attempt * 250));
      }
    }

    return false;
  })();

  return farcasterReadyPromise;
}
