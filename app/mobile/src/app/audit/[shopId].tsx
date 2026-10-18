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
  id: string;
  action: string;
  refType: string | null;
  actorUserId: string | null;
  channel: string | null;
  at: string;
};

const ACTION_COLORS: Record<string, string> = {
  order_status_changed: "#8b5cf6",
  estimate_sent: "#8b5cf6",
  estimate_decided: "#8b5cf6",
  payment_recorded: "#10b981",
  invoice_issued: "#10b981",
};

export default function AuditScreen() {
  const insets = useSafeAreaInsets();
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const [rows, setRows] = useState<Row[] | null>(null);
  const { t } = useLang();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGet<{ entries: Row[] }>(
          `/v1/shops/${shopId}/audit`
        );
        if (alive) setRows(data.entries);
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
      </View>
      <Text style={styles.title}>{t("aud.title")}</Text>

      {!rows && <ActivityIndicator color="#10b981" style={{ marginTop: 32 }} />}

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {rows?.length === 0 && (
          <Text style={styles.empty}>{t("aud.none")}</Text>
        )}
        {rows?.map((r) => (
          <View key={r.id} style={styles.row}>
            <View
              style={[
                styles.dot,
                { backgroundColor: ACTION_COLORS[r.action] ?? "#52525b" },
              ]}
            />
            <View style={styles.body}>
              <Text style={styles.action}>
                {t(`aud.a.${r.action}`)}
                {r.refType ? ` · ${r.refType}` : ""}
              </Text>
              <Text style={styles.meta}>
                {r.actorUserId ? r.actorUserId.slice(0, 8) : "—"} ·{" "}
                {r.channel ?? "web"} · {r.at.slice(0, 16).replace("T", " ")}
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
  header: { paddingVertical: 12 },
  back: { color: "#71717a", fontSize: 13 },
  title: { color: "#fafafa", fontSize: 22, fontWeight: "700", marginTop: 4 },
  list: { paddingTop: 16, gap: 14 },
  row: { flexDirection: "row", gap: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  body: { flex: 1 },
  action: { color: "#fafafa", fontSize: 14, fontWeight: "500" },
  meta: { color: "#52525b", fontSize: 12, marginTop: 2 },
  empty: { color: "#52525b", textAlign: "center", marginTop: 24 },
});
