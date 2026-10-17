import { useEffect, useMemo, useState } from "react";
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
import { apiGet, formatEtb, type EstimateDemo } from "@/lib/api";

type Decision = "approved_all" | "approved_lines" | "declined";

export default function EstimateScreen() {
  const insets = useSafeAreaInsets();
  const { shopId } = useLocalSearchParams<{ shopId: string }>();

  const [data, setData] = useState<EstimateDemo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [last4, setLast4] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const est = await apiGet<EstimateDemo>(
          `/v1/shops/${shopId}/estimate-demo`
        );
        if (!alive) return;
        setData(est);
        setSelected(new Set(est.lines.map((l) => l.id)));
      } catch {
        if (alive) setLoadError("ምንም በመጠባበቅ ላይ ያለ ግምት የለም።");
      }
    })();
    return () => {
      alive = false;
    };
  }, [shopId]);

  const expired = data ? new Date(data.tokenExpiresAt) < new Date() : false;
  const selectedTotal = useMemo(
    () =>
      data
        ? data.lines
            .filter((l) => selected.has(l.id))
            .reduce((s, l) => s + Number(l.qty) * Number(l.unitPriceEtb), 0)
        : 0,
    [data, selected]
  );

  const toggle = (id: string) => {
    setDecision(null);
    setPinError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const attempt = (kind: Decision) => {
    if (!data) return;
    if (last4 !== data.customerPhone.slice(-4)) {
      setPinError("የስልክ ቁጥርዎ የመጨረሻዎቹ 4 አይመስሉም።");
      return;
    }
    setPinError(null);
    setDecision(kind);
  };

  const taxLabel =
    data?.taxType === "vat_15"
      ? "ቫት 15%"
      : data?.taxType === "tot_10_2"
        ? "ታክስ በአገልግሎት 10%"
        : data?.taxType ?? "";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <Pressable hitSlop={12} onPress={() => router.back()}>
        <Text style={styles.back}>← ጋራዥ</Text>
      </Pressable>

      {!data && !loadError && (
        <ActivityIndicator color="#10b981" style={{ marginTop: 40 }} />
      )}
      {loadError && <Text style={styles.loadError}>{loadError}</Text>}

      {data && (
        <>
          <View style={styles.titleRow}>
            <Text style={styles.h1}>የጥገና ግምት</Text>
            <View style={[styles.revisionChip, expired && styles.revisionExpired]}>
              <Text style={expired ? styles.revisionExpiredText : styles.revisionText}>
                {expired ? "ጊዜ አልቋል" : "ግምት ተቀብላችኋል"}
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.vehicle}>
                {data.make} {data.model}
              </Text>
              <Text style={styles.plate}>ሰሌዳ {data.plateNumber ?? "—"}</Text>
            </View>
            <Text style={styles.shopLine}>
              {data.shopName} · ለ{data.customerNameAm}
            </Text>
          </View>

          {expired ? (
            <View style={styles.expiredBox}>
              <Text style={styles.expiredText}>
                የማገናኛው ጊዜ አልቋል። ጋራዥዎን ደውለው አዲስ አገናኝ እንዲልክ ጠይቁ።
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                {data.lines.map((l, i) => {
                  const on = selected.has(l.id);
                  return (
                    <Pressable
                      key={l.id}
                      onPress={() => toggle(l.id)}
                      style={[
                        styles.line,
                        i > 0 && styles.lineBorder,
                      ]}
                    >
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on && <Text style={styles.checkMark}>✓</Text>}
                      </View>
                      <View style={styles.lineBody}>
                        <Text style={styles.lineName}>
                          {l.nameAm}
                          <Text style={styles.lineKind}>
                            {l.kind === "service" ? "  ሥራ" : "  ምርት"}
                          </Text>
                        </Text>
                        <Text style={styles.lineSub}>
                          {Number(l.qty)} × {formatEtb(Number(l.unitPriceEtb))} ብር
                        </Text>
                      </View>
                      <Text style={styles.lineTotal}>
                        {formatEtb(Number(l.qty) * Number(l.unitPriceEtb))} ብር
                      </Text>
                    </Pressable>
                  );
                })}
                <View style={styles.totals}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>ጠቅላላ</Text>
                    <Text style={styles.totalValue}>
                      {formatEtb(Number(data.subtotalEtb))} ብር
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>ታክስ ({taxLabel})</Text>
                    <Text style={styles.totalValue}>
                      {formatEtb(Number(data.taxEtb))} ብር
                    </Text>
                  </View>
                  <View style={[styles.totalRow, styles.totalGrand]}>
                    <Text style={styles.totalGrandLabel}>ጠቅላላ ለመክፈል</Text>
                    <Text style={styles.totalGrandValue}>
                      {formatEtb(Number(data.totalEtb))} ብር
                    </Text>
                  </View>
                  <Text style={styles.demoNote}>
                    መምረጥ የእይታ ማሳያ ብቻ ነው — እውነተኛ ውሳኔ አይቀረጽም።
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.pinLabel}>
                  የስልክ ቁጥርዎ የመጨረሻ 4 አሃዞች
                </Text>
                <TextInput
                  value={last4}
                  onChangeText={(t) => {
                    setLast4(t.replace(/\D/g, "").slice(0, 4));
                    setPinError(null);
                    setDecision(null);
                  }}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="· · · ·"
                  placeholderTextColor="#52525b"
                  style={styles.pinInput}
                />
                {pinError && <Text style={styles.pinError}>{pinError}</Text>}
              </View>

              {decision ? (
                <View style={styles.decisionBox}>
                  <Text style={styles.decisionText}>
                    {decision === "declined"
                      ? "ግምቱ እምቢ ተብሎ ተመዝግቧል። ጋራዥዎ በቅርቡ ተለዋጭ አማራጭ ገልጸልዎታል።"
                      : `ፈቃድ ተመዝግቧል — ${decision === "approved_all" ? "ሙሉ ግምት" : `${selected.size} መስመሮች`}። ጋራዥዎ ሥራውን ይጀምራል።`}
                  </Text>
                  <Text style={styles.decisionNote}>
                    (ይህ ማሳያ ብቻ ነው — እውነተኛ ውሳኔ አልተመዘገበም።)
                  </Text>
                </View>
              ) : (
                <>
                  <Pressable
                    disabled={selected.size === 0}
                    style={({ pressed }) => [
                      styles.approveBtn,
                      pressed && styles.pressed,
                      selected.size === 0 && styles.disabled,
                    ]}
                    onPress={() =>
                      attempt(
                        selected.size === data.lines.length
                          ? "approved_all"
                          : "approved_lines"
                      )
                    }
                  >
                    <Text style={styles.approveText}>
                      {selected.size === data.lines.length
                        ? "ሙሉ ግምት ፈቅድ"
                        : `${selected.size} መስመሮችን ብቻ ፈቅድ`}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.declineBtn,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => attempt("declined")}
                  >
                    <Text style={styles.declineText}>ፈቅዳም እምቢ</Text>
                  </Pressable>
                </>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090b" },
  content: { paddingHorizontal: 16 },
  back: { color: "#71717a", fontSize: 13 },
  loadError: { color: "#a1a1aa", marginTop: 24, textAlign: "center" },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 14,
  },
  h1: { color: "#fafafa", fontSize: 20, fontWeight: "700" },
  revisionChip: { backgroundColor: "rgba(139,92,246,0.18)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  revisionText: { color: "#c4b5fd", fontSize: 11, fontWeight: "600" },
  revisionExpired: { backgroundColor: "rgba(251,191,36,0.16)" },
  revisionExpiredText: { color: "#fcd34d", fontSize: 11, fontWeight: "600" },
  card: {
    backgroundColor: "#111113",
    borderColor: "#262626",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  vehicle: { color: "#fafafa", fontSize: 16, fontWeight: "600", flexShrink: 1 },
  plate: { color: "#71717a", fontSize: 13 },
  shopLine: { color: "#a1a1aa", fontSize: 13, marginTop: 4 },
  expiredBox: {
    backgroundColor: "rgba(251,191,36,0.12)",
    borderColor: "rgba(251,191,36,0.4)",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  expiredText: { color: "#fcd34d", fontSize: 14, lineHeight: 22 },
  line: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  lineBorder: { borderTopColor: "#1f1f22", borderTopWidth: StyleSheet.hairlineWidth },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#3f3f46",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: "#059669", borderColor: "#059669" },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  lineBody: { flex: 1 },
  lineName: { color: "#fafafa", fontSize: 15, fontWeight: "500" },
  lineKind: { color: "#52525b", fontSize: 11, fontWeight: "400" },
  lineSub: { color: "#71717a", fontSize: 13, marginTop: 2 },
  lineTotal: { color: "#fafafa", fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] },
  totals: {
    borderTopColor: "#262626",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
    paddingTop: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalLabel: { color: "#a1a1aa", fontSize: 13 },
  totalValue: { color: "#d4d4d8", fontSize: 13, fontVariant: ["tabular-nums"] },
  totalGrand: {
    borderTopColor: "#3f3f46",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    marginTop: 6,
    paddingTop: 10,
  },
  totalGrandLabel: { color: "#fafafa", fontSize: 15, fontWeight: "600" },
  totalGrandValue: { color: "#fafafa", fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  demoNote: { color: "#52525b", fontSize: 11, marginTop: 8 },
  pinLabel: { color: "#d4d4d8", fontSize: 14, fontWeight: "500" },
  pinInput: {
    backgroundColor: "#1c1c1f",
    borderColor: "#3f3f46",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    color: "#fafafa",
    fontSize: 18,
    letterSpacing: 6,
    textAlign: "center",
    paddingVertical: 10,
    marginTop: 10,
    width: 140,
  },
  pinError: { color: "#f87171", fontSize: 13, marginTop: 8 },
  decisionBox: {
    backgroundColor: "rgba(16,185,129,0.12)",
    borderColor: "rgba(16,185,129,0.4)",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
  },
  decisionText: { color: "#6ee7b7", fontSize: 14, lineHeight: 22 },
  decisionNote: { color: "rgba(110,231,183,0.6)", fontSize: 11, marginTop: 6 },
  approveBtn: {
    backgroundColor: "#059669",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  approveText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  declineBtn: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
    paddingVertical: 14,
    alignItems: "center",
  },
  declineText: { color: "#d4d4d8", fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
});
