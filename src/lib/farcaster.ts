export async function initializeFarcasterMiniApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const looksLikeMiniApp = Boolean(
    window.ReactNativeWebView || window.parent !== window,
  );

  if (!looksLikeMiniApp) return false;

  try {
    const mod = await import(/* @vite-ignore */ "@farcaster/miniapp-sdk");
    const sdk = (mod as { sdk?: unknown; default?: unknown }).sdk ??
      (mod as { default?: unknown }).default;

    if (!sdk || typeof sdk !== "object") return false;

    const maybeIsInMiniApp = (sdk as {
      isInMiniApp?: (timeoutMs?: number) => Promise<boolean>;
    }).isInMiniApp;
    if (typeof maybeIsInMiniApp === "function") {
      const isInMiniApp = await maybeIsInMiniApp(1000).catch(() => false);
      if (!isInMiniApp) return false;
    }

    const ready = (sdk as {
      actions?: { ready?: (options?: Record<string, unknown>) => unknown };
      ready?: (options?: Record<string, unknown>) => unknown;
    }).actions?.ready ?? (sdk as { ready?: (options?: Record<string, unknown>) => unknown }).ready;
    if (typeof ready !== "function") return false;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await ready({});
        return true;
      } catch {
        if (attempt === 2) break;
        await new Promise((resolve) => window.setTimeout(resolve, 150));
      }
    }
  } catch {
    // Ignore and let the app continue rendering; the host will still show the app if the SDK is unavailable.
  }

  return false;
}
