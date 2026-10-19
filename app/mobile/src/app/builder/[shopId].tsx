import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  apiFetch,
  apiGet,
  formatEtb,
  type Catalog,
} from "@/lib/api";
import { useLang } from "@/lib/i18n";

const CURRENCIES = ["ETB", "CNY", "USD"];

type Part = {
  nameAm: string;
  currency: string;
  cost: string;
  qty: string;
  markup: string;
};

export default function BuilderScreen() {
  const insets = useSafeAreaInsets();
  const { shopId, orderId, taxRegime } = useLocalSearchParams<{
    shopId: string;
    orderId: string;
    taxRegime: string;
  }>();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [parts, setParts] = useState<Part[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLang();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await apiGet<Catalog>(`/v1/shops/${shopId}/catalog`);
        if (alive) setCatalog(c);
      } catch {
        if (alive) setError(t("est.catErr"));
      }
    })();
    return () => {
      alive = false;
    };
  }, [shopId]);

  const toggle = (id: string) => {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const addPart = () =>
    setParts((p) => [
      ...p,
      { nameAm: "", currency: "CNY", cost: "", qty: "1", markup: "" },
    ]);

  const setPart = (i: number, patch: Partial<Part>) =>
    setParts((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const regime = taxRegime ?? "vat_15";

  const preview = (() => {
    if (!catalog) return null;
    let sub = 0;
    let taxL = 0;
    let taxP = 0;
    for (const j of catalog.jobs) {
      if (!picked.has(j.id)) continue;
      sub += j.laborHours * j.laborRateEtb;
      taxL += j.laborHours * j.laborRateEtb * (regime === "tot_10_2" ? 0.1 : regime === "vat_15" ? 0.15 : 0);
    }
    for (const p of parts) {
      const cost = Number(p.cost);
      if (!p.nameAm.trim() || !(cost > 0)) continue;
      const fx = catalog.fx.rates[p.currency] ?? 1;
      const markup = p.markup === "" ? catalog.fx.markupPct : Number(p.markup);
      const qty = Number(p.qty) || 1;
      const etb = Math.round(cost * fx * (1 + markup / 100) * qty * 100) / 100;
      sub += etb;
      taxP += etb * (regime === "tot_10_2" ? 0.02 : regime === "vat_15" ? 0.15 : 0);
    }
    const tax = Math.round((taxL + taxP) * 100) / 100;
    const total = Math.round((sub + tax) * 100) / 100;
    return { sub: Math.round(sub * 100) / 100, tax, total };
  })();

  const hasLines =
    picked.size > 0 || parts.some((p) => p.nameAm.trim() && Number(p.cost) > 0);

  const save = async (send: boolean) => {
    if (busy || !hasLines || !shopId || !orderId || !catalog) return;
    setBusy(true);
    setError(null);
    const { status, data } = await apiFetch<{ versionId?: string; error?: string }>(
      "POST",
      `/v1/shops/${shopId}/orders/${String(orderId)}/estimate`,
      {
        services: catalog.jobs
          .filter((j) => picked.has(j.id))
          .map((j) => ({ cannedJobId: j.id })),
        parts: parts
          .filter((p) => p.nameAm.trim() && Number(p.cost) > 0)
          .map((p) => ({
            nameAm: p.nameAm.trim(),
            qty: Number(p.qty) || 1,
            costOriginal: Number(p.cost),
            currency: p.currency,
            markupPct: p.markup === "" ? undefined : Number(p.markup),
          })),
      }
    );
    if (status !== 201) {
      setBusy(false);
      setError(t("est.saveErr"));
      return;
    }
    if (!send) {
      setBusy(false);
      router.back();
      return;
    }
    const sent = await apiFetch<{ token?: string }>(
      "POST",
      `/v1/shops/${shopId}/orders/${String(orderId)}/estimate/send`
    );
    setBusy(false);
    if (sent.status === 200 && sent.data.token) {
      router.replace({
        pathname: "/estimate/[shopId]",
        params: { shopId: String(shopId), token: sent.data.token },
      });
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Text style={styles.back}>{t("nav.back")} {t("nav.board")}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t("est.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {!catalog && !error && (
        <ActivityIndicator color="#10b981" style={{ marginTop: 32 }} />
      )}

      {catalog && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.section}>{t("est.jobs")}</Text>
          {catalog.jobs.map((j) => (
            <Pressable
              key={j.id}
              onPress={() => toggle(j.id)}
              style={({ pressed }) => [
                styles.job,
                picked.has(j.id) && styles.jobPicked,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.box, picked.has(j.id) && styles.boxChecked]}>
                {picked.has(j.id) && <Text style={styles.check}>✓</Text>}
              </View>
              <View style={styles.jobInfo}>
                <Text style={styles.jobName}>{j.nameAm}</Text>
                <Text style={styles.jobSub}>
                  {j.laborHours} ሰዓት × {formatEtb(j.laborRateEtb)} {t("cur.ETB")}
                </Text>
              </View>
              <Text style={styles.jobPrice}>
                {formatEtb(j.laborHours * j.laborRateEtb)}
              </Text>
            </Pressable>
          ))}

          <Text style={styles.section}>{t("est.parts")}</Text>
          {parts.map((p, i) => (
            <View key={i} style={styles.part}>
              <TextInput
                value={p.nameAm}
                onChangeText={(t) => setPart(i, { nameAm: t })}
                placeholder={t("est.partName")}
                placeholderTextColor="#52525b"
                style={[styles.input, styles.partName]}
              />
              <View style={styles.partRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chips}>
                    {CURRENCIES.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setPart(i, { currency: c })}
                        style={[
                          styles.pchip,
                          p.currency === c && styles.pchipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.pchipText,
                            p.currency === c && styles.pchipTextActive,
                          ]}
                        >
                          {t(`cur.${c}`)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
                <TextInput
                  value={p.cost}
                  onChangeText={(t) => setPart(i, { cost: t.replace(/[^\d.]/g, "") })}
                  keyboardType="decimal-pad"
                  placeholder={t("est.partCost")}
                  placeholderTextColor="#52525b"
                  style={[styles.input, styles.partField]}
                />
                <TextInput
                  value={p.qty}
                  onChangeText={(t) => setPart(i, { qty: t.replace(/\D/g, "") })}
                  keyboardType="number-pad"
                  placeholder={t("est.partQty")}
                  placeholderTextColor="#52525b"
                  style={[styles.input, styles.partQty]}
                />
              </View>
            </View>
          ))}
          <Pressable
            onPress={addPart}
            style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
          >
            <Text style={styles.newBtnText}>{t("est.addPart")}</Text>
          </Pressable>
          <Text style={styles.hint}>
            {t("est.fxNote").replace("{pct}", String(catalog.fx.markupPct))}
          </Text>

          {preview && hasLines && (
            <View style={styles.preview}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t("est.subtotal")}</Text>
                <Text style={styles.totalVal}>{formatEtb(preview.sub)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t("est.tax")}</Text>
                <Text style={styles.totalVal}>{formatEtb(preview.tax)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.grandLabel}>{t("est.total")}</Text>
                <Text style={styles.grandVal}>
                  {formatEtb(preview.total)} {t("cur.ETB")}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.payRow}>
            <Pressable
              disabled={!hasLines || busy}
              onPress={() => save(false)}
              style={({ pressed }) => [
                styles.payBtn,
                styles.payBtnGhost,
                pressed && styles.pressed,
                (!hasLines || busy) && styles.disabled,
              ]}
            >
              <Text style={styles.payBtnGhostText}>{t("act.save")}</Text>
            </Pressable>
            <Pressable
              disabled={!hasLines || busy}
              onPress={() => save(true)}
              style={({ pressed }) => [
                styles.payBtn,
                pressed && styles.pressed,
                (!hasLines || busy) && styles.disabled,
              ]}
            >
              <Text style={styles.payBtnText}>
                {busy ? t("act.busy") : t("act.send")}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
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
  back: { color: "#71717a", fontSize: 13, width: 40 },
  headerTitle: { color: "#fafafa", fontSize: 15, fontWeight: "700" },
  scroll: { paddingBottom: 40 },
  section: {
    color: "#71717a",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  job: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#111113",
    borderColor: "#262626",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  jobPicked: { borderColor: "#10b981" },
  jobInfo: { flexShrink: 1, flex: 1 },
  jobName: { color: "#fafafa", fontSize: 14, fontWeight: "600" },
  jobSub: { color: "#71717a", fontSize: 12, marginTop: 2 },
  jobPrice: { color: "#a1a1aa", fontSize: 13 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: "#10b981", borderColor: "#10b981" },
  check: { color: "#052e1b", fontSize: 13, fontWeight: "700" },
  part: {
    backgroundColor: "#111113",
    borderColor: "#262626",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  partName: { marginBottom: 8 },
  partRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  partField: { flex: 1 },
  partQty: { width: 60 },
  chips: { flexDirection: "row", gap: 6 },
  pchip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pchipActive: { backgroundColor: "#10b981", borderColor: "#10b981" },
  pchipText: { color: "#a1a1aa", fontSize: 11 },
  pchipTextActive: { color: "#052e1b", fontWeight: "600" },
  input: {
    backgroundColor: "#18181b",
    borderColor: "#3f3f46",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    color: "#fafafa",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  newBtn: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
    paddingVertical: 10,
    alignItems: "center",
  },
  newBtnText: { color: "#a1a1aa", fontSize: 13, fontWeight: "600" },
  hint: { color: "#52525b", fontSize: 11, marginTop: 10, lineHeight: 16 },
  preview: {
    backgroundColor: "#111113",
    borderColor: "#262626",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    gap: 4,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { color: "#71717a", fontSize: 13 },
  totalVal: { color: "#d4d4d8", fontSize: 13 },
  grandLabel: { color: "#fafafa", fontSize: 15, fontWeight: "700" },
  grandVal: { color: "#10b981", fontSize: 15, fontWeight: "700" },
  payRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  payBtn: {
    flex: 1,
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  payBtnText: { color: "#052e1b", fontWeight: "700", fontSize: 14 },
  payBtnGhost: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
  },
  payBtnGhostText: { color: "#a1a1aa", fontWeight: "600", fontSize: 14 },
  error: { color: "#f87171", marginTop: 16, textAlign: "center" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
