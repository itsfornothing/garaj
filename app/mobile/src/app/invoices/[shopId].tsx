import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiGet } from "@/lib/api";
import { useLang } from "@/lib/i18n";

type Row = {
  invoiceNumber: string;
  status: string;
  totalEtb: string;
  issuedAt: string;
  customerNameAm: string | null;
  make: string | null;
  model: string | null;
};

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const [rows, setRows] = useState<Row[] | null>(null);
  const { t } = useLang();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGet<{ invoices: Row[] }>(
          `/v1/shops/${shopId}/invoices`
        );
        if (alive) setRows(data.invoices);
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [shopId]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Text style={styles.back}>
            {t("nav.back")} {t("nav.brand")}
          </Text>
        </Pressable>
        <Text style={styles.count}>
          {rows ? `${rows.length}` : "…"}
        </Text>
      </View>
      <Text style={styles.title}>{t("invList.title")}</Text>

      {!rows && <ActivityIndicator color="#10b981" style={{ marginTop: 32 }} />}

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {rows?.length === 0 && (
          <Text style={styles.empty}>{t("invList.none")}</Text>
        )}
        {rows?.map((inv) => (
          <View key={inv.invoiceNumber} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.number}>{inv.invoiceNumber}</Text>
              <Text
                style={[
                  styles.badge,
                  inv.status === "paid"
                    ? styles.badgePaid
                    : inv.status === "voided"
                      ? styles.badgeVoid
                      : styles.badgeDue,
                ]}
              >
                {inv.status === "paid"
                  ? t("inv.paid")
                  : inv.status === "voided"
                    ? t("invList.voided")
                    : t("invList.unpaid")}
              </Text>
            </View>
            <Text style={styles.who}>
              {inv.customerNameAm ?? "—"}
              {inv.make ? ` · ${inv.make} ${inv.model ?? ""}` : ""}
            </Text>
            <View style={styles.footRow}>
              <Text style={styles.date}>{inv.issuedAt.slice(0, 10)}</Text>
              <Text style={styles.total}>
                {Number(inv.totalEtb).toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                })}{" "}
                {t("cur.ETB")}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
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
  count: { color: "#52525b", fontSize: 13 },
  title: { color: "#fafafa", fontSize: 22, fontWeight: "700", marginTop: 4 },
  list: { paddingTop: 16, gap: 10 },
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
  number: { color: "#fafafa", fontSize: 15, fontWeight: "700" },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "600",
    overflow: "hidden",
  },
  badgePaid: { color: "#34d399", backgroundColor: "rgba(16,185,129,0.14)" },
  badgeDue: { color: "#fbbf24", backgroundColor: "rgba(251,191,36,0.12)" },
  badgeVoid: { color: "#71717a", backgroundColor: "#1c1c1f" },
  who: { color: "#d4d4d8", fontSize: 13, marginTop: 6 },
  footRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  date: { color: "#52525b", fontSize: 12 },
  total: { color: "#fafafa", fontSize: 13, fontWeight: "600" },
  empty: { color: "#52525b", textAlign: "center", marginTop: 24 },
});
