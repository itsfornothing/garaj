export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return (await res.json()) as T;
}

export type Shop = {
  id: string;
  name: string;
  shopType: string;
  taxRegime: string;
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

export type EstimateLine = {
  id: string;
  kind: string;
  nameAm: string;
  nameEn: string | null;
  qty: string;
  unitPriceEtb: string;
};

export type EstimateDemo = {
  versionId: string;
  revision: number;
  sentAt: string;
  tokenExpiresAt: string;
  subtotalEtb: string;
  taxEtb: string;
  taxType: string;
  totalEtb: string;
  customerNameAm: string;
  customerPhone: string;
  make: string;
  model: string;
  plateNumber: string | null;
  shopName: string;
  lines: EstimateLine[];
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

export function formatEtb(n: number): string {
  const s = Math.round(n * 100) / 100;
  const [int, frac] = String(s).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${grouped}.${frac}` : grouped;
}

export const chipColors: Record<string, { bg: string; text: string }> = {
  received: { bg: "#0C3A5B", text: "#7DD3FC" },
  inspection: { bg: "#422006", text: "#FCD34D" },
  estimate_sent: { bg: "#372A63", text: "#C4B5FD" },
  estimate_declined: { bg: "#3F1719", text: "#FCA5A5" },
  approved: { bg: "#1E2352", text: "#A5B4FC" },
  in_progress: { bg: "#0C2E5F", text: "#93C5FD" },
  complete: { bg: "#04312C", text: "#5EEAD4" },
  paid: { bg: "#053B29", text: "#6EE7B7" },
  cancelled: { bg: "#27272A", text: "#A1A1AA" },
};
