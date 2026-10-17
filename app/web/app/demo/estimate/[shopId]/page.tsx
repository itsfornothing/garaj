import { connection } from "next/server";
import Link from "next/link";
import { apiJson } from "../../../lib/api";
import EstimateApprover, {
  type EstimatePayload,
} from "../EstimateApprover";

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
  return { title: `ግምት ማገናኛ · ${shopId.slice(0, 8)} · ጋራዥ` };
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

  if (!loaded.ok) {
    const copy =
      loaded.linkError === "expired"
        ? {
            title: "ጊዜው አልቋል።",
            body: "የማገናኛው ጊዜ አልቋል። ጋራዥዎን ደውለው አዲስ አገናኝ እንዲልክ ጠይቁ።",
          }
        : {
            title: "የማገናኛው ትክክል አይደለም።",
            body: "ይህ ማገናኛ አልተጠቀመም ወይም ተሠርዟል። ጋራዥዎን ደውለው አዲስ አገናኝ እንዲልክ ጠይቁ።",
          };
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-32 text-center">
        <div className="max-w-md rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <p className="font-medium">{copy.title}</p>
          <p className="mt-1 opacity-90">{copy.body}</p>
        </div>
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
  const head = loaded.payload.head;
  const expired = new Date(head.tokenExpiresAt) < new Date();

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
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
            ({head.revision}ኛ ድጋሚ)
          </span>
        </h1>
        <EstimateApprover data={loaded.payload} token={token!} />
        <p className="mt-6 text-center text-xs text-zinc-400">
          ለደንበኛዎች የሚተላለፈው የግምት ማገናኛ ይህ ነው — ስልክ ጥሪ ትርጉም እምቢ።
        </p>
      </main>
    </div>
  );
}
