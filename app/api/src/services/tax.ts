// Money + tax: FX for imported parts (PROVISIONAL desk rate until a rate
// table lands in G4), per-regime totals, and Ethiopian fiscal-year helpers.

export const FX_CONFIG = {
  rates: { USD: 138.0, CNY: 19.2, ETB: 1 },
  markupPct: 20,
  asOf: "2026-10 (provisional desk rate)",
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

// Ethiopian calendar year (task: Hamle 1 fiscal boundary pending Spike 5 —
// until then invoice sequences use calendar-year ET, Meskerem 1 ≈ Sep 11).
export function ethiopianYear(d: Date): number {
  const gy = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return m > 9 || (m === 9 && day >= 11) ? gy - 7 : gy - 8;
}

export type Line = { qty: string; unitPriceEtb: string; taxKind: string };

export function computeTotals(lines: Line[], regime: string) {
  const sub = (kind: string) =>
    lines
      .filter((l) => l.taxKind === kind)
      .reduce((s, l) => s + Number(l.qty) * Number(l.unitPriceEtb), 0);
  const subtotal = sub("labor") + sub("part");
  let tax = 0;
  let taxType = "exempt";
  if (regime === "vat_15") {
    tax = subtotal * 0.15;
    taxType = "vat_15";
  } else if (regime === "tot_10_2") {
    tax = sub("labor") * 0.1 + sub("part") * 0.02;
    taxType = "tot_10_2";
  }
  const total = subtotal + tax;
  const r2 = (n: number) => n.toFixed(2);
  return { subtotalEtb: r2(subtotal), taxEtb: r2(tax), taxType, totalEtb: r2(total) };
}
