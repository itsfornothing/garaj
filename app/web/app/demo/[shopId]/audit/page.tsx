import { connection } from "next/server";
import ShopWorkspace from "../ShopWorkspace";

export const instant = false;

export default async function AuditPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  await connection();
  const { shopId } = await params;
  return <ShopWorkspace shopId={shopId} tab="audit" />;
}
