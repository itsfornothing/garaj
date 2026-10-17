import { connection } from "next/server";
import Link from "next/link";
import { apiGet } from "../../../lib/api";
import EstimateApprover, {
  type EstimatePayload,
} from "../EstimateApprover";

export const instant = false;

type Params = Promise<{ shopId: string }>;

type ApiEstimate = {
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
  shopTaxRegime: string;
  lines: {
    id: string;
    kind: string;
    nameAm: string;
    nameEn: string | null;
    qty: string;
    unitPriceEtb: string;
  }[];
};

export async function generateMetadata({ params }: { params: Params }) {
  const { shopId } = await params;
  return { title: `ግምት ማገናኛ · ${shopId.slice(0, 8)} · ጋራዥ` };
}

export default async function EstimateDemo({ params }: { params: Params }) {
  await connection();
  const { shopId } = await params;

  let payload: EstimatePayload;
  try {
    const apiPayload = await apiGet<ApiEstimate>(
      `/v1/shops/${shopId}/estimate-demo`
    );
    payload = {
      head: {
        versionId: apiPayload.versionId,
        revision: apiPayload.revision,
        sentAt: apiPayload.sentAt,
        tokenExpiresAt: apiPayload.tokenExpiresAt,
        subtotalEtb: apiPayload.subtotalEtb,
        taxEtb: apiPayload.taxEtb,
        taxType: apiPayload.taxType,
        totalEtb: apiPayload.totalEtb,
        customerNameAm: apiPayload.customerNameAm,
        customerPhone: apiPayload.customerPhone,
        make: apiPayload.make,
        model: apiPayload.model,
        plateNumber: apiPayload.plateNumber,
        shopName: apiPayload.shopName,
      },
      lines: apiPayload.lines.map((l) => ({
        id: l.id,
        kind: l.kind,
        nameAm: l.nameAm,
        nameEn: l.nameEn,
        qty: l.qty,
        unitPriceEtb: l.unitPriceEtb,
      })),
    };
  } catch {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-32 text-center">
        <h1 className="text-xl font-medium text-zinc-900 dark:text-zinc-50">
          ምንም በመጠባበቅ ላይ ያለ ግምት የለም።
        </h1>
        <p className="max-w-md text-sm text-zinc-500">
          ይህ ማሳያ የሚሰራው ጋራዥ ግምት ላክት የተላከ ሲሆን — የምሳሌ ጋራዥ 1 ቅጥር ብቻ ነው።
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-emerald-700 transition-transform duration-150 ease-out active:scale-[0.97] dark:text-emerald-400"
        >
          ← ወደ ቀጥታ ይመለሱ
        </Link>
      </main>
    );
  }

  const now = new Date();
  const expired = new Date(payload.head.tokenExpiresAt) < now;

  return (
    <div className="flex flex-1 flex-col overflow-x-hidden bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-10 pb-20">
        <div className="mb-2 flex items-center justify-between">
          <Link
            href="/"
            className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ← ጋራዥ
          </Link>
          <span
            className={`rounded-full px-3 py-1 text-xs ${
              expired
                ? "bg-amber-100 text-amber-700"
                : "bg-violet-100 text-violet-700"
            }`}
          >
            {expired ? "ጊዜ አልቋል" : "ግምት ተቀብላችኋል"}
          </span>
        </div>
        <h1 className="mb-6 text-xl font-medium text-zinc-900 dark:text-zinc-50">
          የጥገና ግምት{" "}
          <span className="text-sm font-normal text-zinc-400">
            ደቂቅ {payload.head.revision}
          </span>
        </h1>
        <EstimateApprover data={payload} />
        <p className="mt-6 text-center text-xs text-zinc-400">
          ለደንበኛዎች የሚተላለፈው የግምት ማገናኛ ይህ ነው — ስልክ ጥሪ ትርጉም እምቢ።
        </p>
      </main>
    </div>
  );
}
