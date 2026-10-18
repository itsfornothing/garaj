import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { useLang } from "@/lib/i18n";

export default function BoardScreen() {
  const insets = useSafeAreaInsets();
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { t, lang, setLang } = useLang();

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
        if (alive) setError(t("nav.error"));
      }
    })();
    return () => {
      alive = false;
    };
  }, [shopId, reloadKey]);

  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1);
    }, [])
  );

  const list = orders?.filter(
    (o) => filter === "all" || o.status === filter
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Text style={styles.back}>{t("nav.back")} {t("nav.brand")}</Text>
        </Pressable>
        <View style={styles.chip}>
          <Text style={styles.chipText}>
            {shop?.shopType === "ev" ? t("shop.ev") : shop?.shopType === "tire" ? t("shop.tire") : t("shop.general")}
            {shop?.taxRegime === "vat_15" ? ` · ${t("est.taxV")}` : ""}
          </Text>
        </View>
      </View>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{shop?.name ?? ""}</Text>
        <View style={styles.titleBtns}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/intake/[shopId]",
                params: { shopId: String(shopId) },
              })
            }
            style={({ pressed }) => [styles.newOrderBtn, pressed && styles.pressed]}
          >
            <Text style={styles.newOrderText}>+ {t("intake.title")}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={t("nav.menu")}
            onPress={() => setMenuOpen(true)}
            style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}
          >
            <Text style={styles.menuText}>⋯</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.sheetTitle}>{shop?.name ?? t("nav.menu")}</Text>
            <MenuItem
              label={t("nav.invoices")}
              onPress={() => {
                setMenuOpen(false);
                router.push({ pathname: "/invoices/[shopId]", params: { shopId: String(shopId) } });
              }}
            />
            <MenuItem
              label={t("nav.audit")}
              onPress={() => {
                setMenuOpen(false);
                router.push({ pathname: "/audit/[shopId]", params: { shopId: String(shopId) } });
              }}
            />
            <MenuItem
              label={lang === "am" ? "English" : "አማርኛ"}
              onPress={() => setLang(lang === "am" ? "en" : "am")}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <FilterChip label={t("board.filterAll")} active={filter === "all"} onPress={() => setFilter("all")} />
          {statusOrder.map((s) => (
            <FilterChip
              key={s}
              label={t(`st.${s}`)}
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
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              shopId={String(shopId)}
              taxRegime={shop?.taxRegime ?? "vat_15"}
              onDone={() => setReloadKey((k) => k + 1)}
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>{t("nav.empty")}</Text>
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

function MenuItem({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
    >
      <Text style={styles.menuItemText}>{label}</Text>
    </Pressable>
  );
}

function OrderCard({
  order,
  shopId,
  onDone,
  taxRegime,
}: {
  order: Order;
  shopId: string;
  onDone: () => void;
  taxRegime: string;
}) {
  const c = chipColors[order.status] ?? chipColors.cancelled;
  const { t } = useLang();
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
      <Text style={styles.plate}>{t("board.plate")}: {order.plateNumber ?? "—"}</Text>
      <Text style={styles.customer}>
        {order.customerNameAm} · {order.customerPhone}
      </Text>
      {order.promisedAt && (
        <Text style={styles.promised}>
          {t("board.promised")}: {order.promisedAt.slice(0, 10)}
        </Text>
      )}
      <OrderOps
        order={order}
        shopId={shopId}
        taxRegime={taxRegime}
        onDone={onDone}
      />
    </View>
  );
}

const ADVANCE_NEXT: Record<string, string> = {
  received: "inspection",
  approved: "in_progress",
  in_progress: "complete",
};



function OrderOps({
  order,
  shopId,
  taxRegime,
  onDone,
}: {
  order: Order;
  shopId: string;
  taxRegime: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { t } = useLang();
  const nextTo = ADVANCE_NEXT[order.status];
  const label = nextTo ? t(`act.${nextTo}`) : null;

  const advance = async () => {
    if (busy || !nextTo) return;
    setBusy(true);
    const { status } = await apiFetch(
      "POST",
      `/v1/shops/${shopId}/orders/${order.id}/status`,
      { to: nextTo }
    );
    setBusy(false);
    if (status === 200) onDone();
  };

  const resendLink = async () => {
    if (busy) return;
    setBusy(true);
    const { status, data } = await apiFetch<{ token?: string }>(
      "POST",
      `/v1/shops/${shopId}/orders/${order.id}/estimate/send`
    );
    setBusy(false);
    if (status === 200 && data.token) {
      router.push({
        pathname: "/estimate/[shopId]",
        params: { shopId, token: data.token },
      });
    } else {
      onDone();
    }
  };

  const openBuilder = () =>
    router.push({
      pathname: "/builder/[shopId]",
      params: { shopId, orderId: order.id, taxRegime },
    });

  const openInvoice = () =>
    router.push({
      pathname: "/invoice/[shopId]",
      params: { shopId, orderId: order.id },
    });

  const buildLabel =
    order.status === "received" ||
    order.status === "inspection" ||
    order.status === "estimate_declined"
      ? t("act.build")
      : null;
  const invoiceLabel =
    order.status === "complete" || order.status === "paid"
      ? order.invoiceId
        ? t("act.viewInvoice")
        : t("act.invoice")
      : null;

  if (!label && !buildLabel && !invoiceLabel && order.status !== "estimate_sent")
    return null;

  return (
    <View style={styles.opsRow}>
      {label ? (
        <Pressable
          disabled={busy}
          onPress={advance}
          style={({ pressed }) => [
            styles.opBtn,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          <Text style={styles.opText}>{busy ? t("act.busy") : label}</Text>
        </Pressable>
      ) : null}
      {buildLabel ? (
        <Pressable
          onPress={openBuilder}
          style={({ pressed }) => [
            styles.opBtn,
            styles.opBtnAlt,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.opText, styles.opTextAlt]}>{buildLabel}</Text>
        </Pressable>
      ) : null}
      {order.status === "estimate_sent" ? (
        <Pressable
          disabled={busy}
          onPress={resendLink}
          style={({ pressed }) => [
            styles.opBtn,
            styles.opBtnAlt,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          <Text style={[styles.opText, styles.opTextAlt]}>
            {t("act.resend")}
          </Text>
        </Pressable>
      ) : null}
      {invoiceLabel ? (
        <Pressable
          onPress={openInvoice}
          style={({ pressed }) => [
            styles.opBtn,
            styles.opBtnAlt,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.opText, styles.opTextAlt]}>{invoiceLabel}</Text>
        </Pressable>
      ) : null}
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
  title: { color: "#fafafa", fontSize: 20, fontWeight: "700", flexShrink: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  newOrderBtn: {
    backgroundColor: "#10b981",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  newOrderText: { color: "#052e1b", fontSize: 12, fontWeight: "700" },
  titleBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuBtn: {
    borderColor: "#3f3f46",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  menuText: { color: "#a1a1aa", fontSize: 16, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#111113",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 18,
    paddingHorizontal: 18,
    gap: 4,
  },
  sheetTitle: { color: "#71717a", fontSize: 13, fontWeight: "600", marginBottom: 8 },
  menuItem: {
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#262626",
  },
  menuItemText: { color: "#fafafa", fontSize: 15, fontWeight: "500" },
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
  opsRow: { marginTop: 10, flexDirection: "row", gap: 8 },
  opBtn: {
    backgroundColor: "#10b981",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  opBtnAlt: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(139,92,246,0.4)",
  },
  opText: { color: "#052e1b", fontSize: 12, fontWeight: "600" },
  opTextAlt: { color: "#c4b5fd" },
  error: { color: "#f87171", marginTop: 24, textAlign: "center" },
});
