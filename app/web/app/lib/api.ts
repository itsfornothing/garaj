export const API_URL = process.env.API_URL ?? "http://localhost:8787";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export type Shop = {
  id: string;
  name: string;
  shopType: "general" | "tire" | "ev" | string;
  taxRegime: "vat_15" | "tot_10_2" | "exempt";
  plan: string;
  city: string;
};

export type Order = {
  id: string;
  status: string;
  intakeAt: string;
  promisedAt: string | null;
  customerNameAm: string;
  customerPhone: string;
  make: string;
  model: string;
  plateNumber: string | null;
};

export const statusAm: Record<string, string> = {
  received: "ተቀብሎ",
  inspection: "ምርመራ ላይ",
  estimate_sent: "ግምት ተላከ",
  estimate_declined: "ግምት እምቢ",
  approved: "ፈቃድ ተሰጠ",
  in_progress: "ሥራ ላይ",
  complete: "ተጠናቋል",
  paid: "ተከፍሏል",
  cancelled: "ተሰርዟል",
};

export const statusOrder = [
  "received",
  "inspection",
  "estimate_sent",
  "approved",
  "in_progress",
  "complete",
  "paid",
] as const;
