export function walletToProfileId(wallet: string): string {
  const normalized = wallet.toLowerCase().trim();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  const tail = `${hex}${hex}${hex}${hex}`.slice(0, 32);
  return `${tail.slice(0, 8)}-${tail.slice(8, 12)}-4${tail.slice(13, 16)}-8${tail.slice(17, 20)}-${tail.slice(20, 32)}`;
}
