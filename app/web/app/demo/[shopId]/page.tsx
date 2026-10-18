import { connection } from "next/server";
import ShopWorkspace from "./ShopWorkspace";
import { apiGet, type Shop } from "../../lib/api";

export const instant = false;

type Params = Promise<{ shopId: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { shopId } = await params;
  let name = shopId;
  try {
    const { shops } = await apiGet<{ shops: Shop[] }>("/v1/shops");
    const shop = shops.find((s) => s.id === shopId);
    if (shop) name = shop.name;
  } catch {
    // fall back to id in title
  }
  return { title: `${name} · GarAj` };
}

export default async function DemoBoard({ params }: { params: Params }) {
  await connection();
  const { shopId } = await params;
  return <ShopWorkspace shopId={shopId} tab="board" />;
}
