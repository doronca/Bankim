// A signed amount always needs its +/- glyph pinned to the visual left,
// regardless of the surrounding RTL layout — Intl's own "+"/"-" sign lands
// on whichever side the bidi algorithm decides, so it's built by hand here.
export function formatSignedAmount(amount: number, options?: Intl.NumberFormatOptions): string {
  const sign = amount < 0 ? "-" : "+";
  const magnitude = Math.abs(amount).toLocaleString(undefined, { maximumFractionDigits: 0, ...options });
  return `${sign}${magnitude}`;
}
