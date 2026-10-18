import { connection } from "next/server";
import { apiJson } from "../../../lib/api";
import type { EstimatePayload } from "../EstimateApprover";
import { EstimateGate, EstimateView } from "../EstimateClientView";

export const instant = false;

type Params = Promise<{ shopId: string }>;
type Search = Promise<{ token?: string }>;

type ApiEstimate = EstimatePayload["head"] & {
  lines: EstimatePayload["lines"];
};

type Loaded =
  | { ok: true; payload: EstimatePayload }
  | { ok: false; linkError: "invalid" | "expired" };

async function loadEstimate(
  shopId: string,
  token?: string
): Promise<Loaded> {
  if (!token) return { ok: false, linkError: "invalid" };
  const { status, data } = await apiJson<ApiEstimate & { error?: string }>(
    "GET",
    `/v1/shops/${shopId}/estimate-demo?token=${encodeURIComponent(token)}`
  );
  if (status === 410 || data.error === "link_expired") {
    return { ok: false, linkError: "expired" };
  }
  if (status !== 200) return { ok: false, linkError: "invalid" };
  return {
    ok: true,
    payload: {
      head: {
        versionId: data.versionId,
        revision: data.revision,
        sentAt: data.sentAt,
        tokenExpiresAt: data.tokenExpiresAt,
        subtotalEtb: data.subtotalEtb,
        taxEtb: data.taxEtb,
        taxType: data.taxType,
        totalEtb: data.totalEtb,
        customerNameAm: data.customerNameAm,
        customerPhone: data.customerPhone,
        make: data.make,
        model: data.model,
        plateNumber: data.plateNumber,
        shopName: data.shopName,
      },
      lines: data.lines,
    },
  };
}

export async function generateMetadata({ params }: { params: Params }) {
  const { shopId } = await params;
  return { title: `GarAj · Estimate ${shopId.slice(0, 8)}` };
}

export default async function EstimateDemo({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  await connection();
  const { shopId } = await params;
  const { token } = await searchParams;

  const loaded = await loadEstimate(shopId, token);

  if (!loaded.ok) return <EstimateGate kind={loaded.linkError} />;
  return <EstimateView data={loaded.payload} token={token!} />;
}
