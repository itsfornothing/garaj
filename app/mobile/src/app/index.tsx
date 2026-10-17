import { useEffect, useState } from "react";
import { Link, Stack } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  apiGet,
  type Order,
  type Shop,
} from "@/lib/api";

export default function ShopsScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<
    { shop: Shop; active: number; paid: number }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { shops } = await apiGet<{ shops: Shop[] }>("/v1/shops");
        const rows = await Promise.all(
          shops.map(async (shop) => {
            const { orders } = await apiGet<{ orders: Order[] }>(
              `/v1/shops/${shop.id}/orders`
            );
            const active = orders.filter(
              (o) => !["paid", "cancelled"].includes(o.status)
            ).length;
            const paid = orders.filter((o) => o.status === "paid").length;
            return { shop, active, paid };
          })
        );
        if (alive) setRows(rows);
      } catch {
        if (alive) setError("አገልግሎቱን ማግኘት አልተቻለም — API በርት ይሆን?");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={styles.badge}>ለኢትዮጵያ ጋራዦች የተመሰረተ</Text>
      <Text style={styles.h1}>ጋራዥዎን በስልክዎ ያስተዳድሩ</Text>
      <Text style={styles.sub}>
        ተቀብሎ ከተከፍሏል ድረስ — ሁሉም በአንድ ቦታ። በአማርኛ ፊደል፣ በብር።
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}
      {!rows && !error && (
        <ActivityIndicator color="#10b981" style={{ marginTop: 32 }} />
      )}

      {rows?.map(({ shop, active, paid }) => (
        <Link
          key={shop.id}
          href={{ pathname: "/board/[shopId]", params: { shopId: shop.id } }}
          asChild
        >
          <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.cardTop}>
              <Text style={styles.shopName}>{shop.name}</Text>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {shop.shopType === "ev" ? "ኤቪ" : shop.shopType === "tire" ? "ጎማ" : "አጠቃላይ"}
                  {shop.taxRegime === "vat_15" ? " · ቫት 15%" : ""}
                </Text>
              </View>
            </View>
            <Text style={styles.counts}>
              {active} ንቁ ሥራ · {paid} የተከፈሉ
            </Text>
            <Text style={styles.cta}>ሠሌዳውን ይክፈቱ →</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090b" },
  content: { paddingHorizontal: 20 },
  badge: {
    alignSelf: "flex-start",
    color: "#34d399",
    backgroundColor: "rgba(16,185,129,0.12)",
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  h1: {
    color: "#fafafa",
    fontSize: 30,
    fontWeight: "700",
    marginTop: 14,
  },
  sub: { color: "#a1a1aa", fontSize: 15, lineHeight: 23, marginTop: 8 },
  card: {
    backgroundColor: "#111113",
    borderColor: "#262626",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  shopName: { color: "#fafafa", fontSize: 16, fontWeight: "600", flexShrink: 1 },
  chip: {
    backgroundColor: "#1c1c1f",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { color: "#a1a1aa", fontSize: 11 },
  counts: { color: "#71717a", fontSize: 13, marginTop: 10 },
  cta: { color: "#10b981", fontSize: 14, fontWeight: "600", marginTop: 12 },
  error: { color: "#f87171", marginTop: 24, textAlign: "center" },
});
