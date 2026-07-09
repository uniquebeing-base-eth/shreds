export async function initializeFarcasterMiniApp(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const looksLikeMiniApp = Boolean(
    window.ReactNativeWebView || window.parent !== window,
  );

  if (!looksLikeMiniApp) return false;

  try {
    const mod = await import(/* @vite-ignore */ "@farcaster/miniapp-sdk");
    const sdk = (mod as {
      sdk?: {
        actions?: { ready?: (options?: Record<string, unknown>) => unknown };
        ready?: (options?: Record<string, unknown>) => unknown;
      };
    }).sdk;

    const ready = sdk?.actions?.ready ?? sdk?.ready;
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
