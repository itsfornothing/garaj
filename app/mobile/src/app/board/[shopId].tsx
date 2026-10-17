import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  apiFetch,
  apiGet,
  chipColors,
  statusAm,
  statusOrder,
  type Order,
  type Shop,
} from "@/lib/api";

export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { shops } = await apiGet<{ shops: Shop[] }>("/v1/shops");
        const found = shops.find((s) => s.id === shopId) ?? null;
        if (alive) setShop(found);
        if (!found) return;
        const { orders } = await apiGet<{ orders: Order[] }>(
          `/v1/shops/${found.id}/orders`
        );
        if (alive) setOrders(orders);
      } catch {
        if (alive) setError("መረጃውን ማምጣት አልተቻለም።");
      }
    })();
    return () => {
      alive = false;
    };
  }, [shopId]);

  const canSend = orders?.some((o) =>
    ["estimate_sent", "estimate_declined", "approved", "inspection"].includes(
      o.status
    )
  );

  async function sendEstimateLink() {
    if (!shopId || sending) return;
    setSending(true);
    const { status, data } = await apiFetch<{ token?: string }>(
      "POST",
      `/v1/shops/${shopId}/estimate-demo/send`
    );
    if (status === 200 && data.token) {
      router.push({
        pathname: "/estimate/[shopId]",
        params: { shopId: String(shopId), token: data.token },
      });
    } else {
      setError("ግምቱን መላክ አልተቻለም — እባክዎ እንደገና ይሞክሩ።");
    }
    setSending(false);
  }

  const list = orders?.filter(
    (o) => filter === "all" || o.status === filter
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Text style={styles.back}>← ጋራዥ</Text>
        </Pressable>
        <View style={styles.chip}>
          <Text style={styles.chipText}>
            {shop?.shopType === "ev" ? "ኤቪ ጋራዥ" : shop?.shopType === "tire" ? "ጎማ ጋራዥ" : "አጠቃላይ ጋራዥ"}
            {shop?.taxRegime === "vat_15" ? " · ቫት 15%" : ""}
          </Text>
        </View>
      </View>
      <Text style={styles.title}>{shop?.name ?? ""}</Text>

      {canSend && (
        <Pressable
          onPress={sendEstimateLink}
          disabled={sending}
          style={({ pressed }) => [
            styles.estimateBanner,
            (pressed || sending) && styles.pressed,
            sending && styles.disabled,
          ]}
        >
          <Text style={styles.estimateText}>
            {sending ? "ግምት በመላክ ላይ…" : "አዲስ ግምት አገናኝ ላክ"}
          </Text>
          <Text style={styles.estimateArrow}>→</Text>
        </Pressable>
      )}

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <FilterChip label="ሁሉም" active={filter === "all"} onPress={() => setFilter("all")} />
          {statusOrder.map((s) => (
            <FilterChip
              key={s}
              label={statusAm[s]}
              active={filter === s}
              onPress={() => setFilter(s)}
            />
          ))}
        </ScrollView>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {!orders && !error && (
        <ActivityIndicator color="#10b981" style={{ marginTop: 24 }} />
      )}

      {list && (
        <FlatList
          data={list}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <OrderCard order={item} />}
          ListEmptyComponent={
            <Text style={styles.empty}>በዚህ ሁኔታ ምንም የለም።</Text>
          }
        />
      )}
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filter, active && styles.filterActive]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function OrderCard({ order }: { order: Order }) {
  const c = chipColors[order.status] ?? chipColors.cancelled;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.vehicle}>
          {order.make} {order.model}
        </Text>
        <View style={[styles.statusChip, { backgroundColor: c.bg }]}>
          <Text style={[styles.statusChipText, { color: c.text }]}>
            {statusAm[order.status] ?? order.status}
          </Text>
        </View>
      </View>
      <Text style={styles.plate}>ሰሌዳ: {order.plateNumber ?? "—"}</Text>
      <Text style={styles.customer}>
        {order.customerNameAm} · {order.customerPhone}
      </Text>
      {order.promisedAt && (
        <Text style={styles.promised}>
          ተስፋ ቀን: {order.promisedAt.slice(0, 10)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090b", paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  back: { color: "#71717a", fontSize: 13 },
  chip: {
    backgroundColor: "#1c1c1f",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: "#a1a1aa", fontSize: 11 },
  title: { color: "#fafafa", fontSize: 20, fontWeight: "700" },
  estimateBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(139,92,246,0.14)",
    borderColor: "rgba(139,92,246,0.35)",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
  },
  estimateText: { color: "#c4b5fd", fontSize: 13, flexShrink: 1 },
  estimateArrow: { color: "#c4b5fd", fontSize: 15 },
  chipsRow: { gap: 8, paddingVertical: 14, paddingRight: 16 },
  filter: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterActive: { backgroundColor: "#10b981", borderColor: "#10b981" },
  filterText: { color: "#a1a1aa", fontSize: 13 },
  filterTextActive: { color: "#052e1b", fontWeight: "600" },
  listContent: { paddingBottom: 32, gap: 10 },
  card: {
    backgroundColor: "#111113",
    borderColor: "#262626",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  vehicle: { color: "#fafafa", fontSize: 15, fontWeight: "600", flexShrink: 1 },
  statusChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusChipText: { fontSize: 11, fontWeight: "600" },
  plate: { color: "#71717a", fontSize: 13, marginTop: 4 },
  customer: { color: "#d4d4d8", fontSize: 13, marginTop: 6 },
  promised: { color: "#fbbf24", fontSize: 12, marginTop: 6 },
  empty: { color: "#52525b", textAlign: "center", marginTop: 24 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  error: { color: "#f87171", marginTop: 24, textAlign: "center" },
});
