import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Image,
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
  formatEtb,
  type InvoicePayload,
} from "@/lib/api";
import { useLang } from "@/lib/i18n";

const PROVIDERS = ["telebirr", "cbe_birr", "ebirr", "mpesa", "card"];

export default function InvoiceScreen() {
  const insets = useSafeAreaInsets();
  const { shopId, orderId } = useLocalSearchParams<{
    shopId: string;
    orderId: string;
  }>();
  const [inv, setInv] = useState<InvoicePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"invoice" | "chapa">("invoice");
  const [provider, setProvider] = useState("telebirr");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const { t } = useLang();

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!shopId || !orderId) return;
      const { status, data } = await apiFetch<InvoicePayload & { error?: string }>(
        "POST",
        `/v1/shops/${shopId}/orders/${String(orderId)}/invoice`
      );
      if (!alive) return;
      if (status === 201 || status === 200) setInv(data);
      else setError(data.error === "no_approved_version" ? t("inv.noVersion") : t("inv.openFailed"));
    })();
    return () => {
      alive = false;
    };
  }, [shopId, orderId]);

  const pay = async (method: string) => {
    if (busy || !inv || !shopId) return;
    setBusy(true);
    setPayError(null);
    if (method !== "cash") await new Promise((r) => setTimeout(r, 700));
    const { status, data } = await apiFetch<{
      ok?: boolean;
      providerRef?: string | null;
      error?: string;
    }>("POST", `/v1/shops/${shopId}/invoices/${inv.id}/pay`, { method });
    setBusy(false);
    if (status === 200 && data.ok) {
      setInv({
        ...inv,
        status: "paid",
        amountPaidEtb: inv.totalEtb,
        payments: [
          ...inv.payments,
          {
            method,
            amountEtb: inv.totalEtb,
            providerRef: data.providerRef ?? null,
            paidAt: new Date().toISOString(),
          },
        ],
      });
      setView("invoice");
    } else {
      setPayError(
        data.error === "already_paid_or_partial"
          ? t("inv.wasPaid")
          : t("inv.fail")
      );
    }
  };

  const paid = inv?.status === "paid";
  const lastRef = inv?.payments.filter((p) => p.providerRef).slice(-1)[0];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Text style={styles.back}>{t("nav.back")} {t("nav.board")}</Text>
        </Pressable>
        {inv && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{inv.invoiceNumber}</Text>
          </View>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {!inv && !error && (
        <ActivityIndicator color="#10b981" style={{ marginTop: 32 }} />
      )}

      {inv && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.customer}>
            {inv.customerNameAm} · {inv.make} {inv.model}
            {inv.plateNumber ? ` · ${inv.plateNumber}` : ""}
          </Text>

          {paid && (
            <View style={styles.paidBox}>
              <Text style={styles.paidTitle}>{t("inv.paid")} ✓</Text>
              {lastRef?.providerRef && (
                <Text style={styles.paidRef}>
                  {t(`pay.${lastRef.method}`)} ·{" "}
                  {lastRef.providerRef}
                </Text>
              )}
            </View>
          )}

          {inv.lines.map((l) => (
            <View key={`${l.lineKind}-${l.nameAm}`} style={styles.lineRow}>
              <Text style={styles.lineName}>
                {l.nameAm} × {l.qty}
              </Text>
              <Text style={styles.lineAmt}>{formatEtb(Number(l.lineTotalEtb))}</Text>
            </View>
          ))}

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t("est.subtotal")}</Text>
              <Text style={styles.totalVal}>{formatEtb(Number(inv.subtotalEtb))}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {t("est.tax")} {inv.taxType === "vat_15" ? "15%" : ""}
              </Text>
              <Text style={styles.totalVal}>{formatEtb(Number(inv.taxEtb))}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.grandLabel}>{t("est.total")}</Text>
              <Text style={styles.grandVal}>
                {formatEtb(Number(inv.totalEtb))} ብር
              </Text>
            </View>
          </View>

          <View style={styles.qrBox}>
            <Image source={{ uri: inv.qrDataUrl }} style={styles.qr} />
            <Text style={styles.qrNote}>{t("inv.qr")}</Text>
          </View>

          {!paid && view === "invoice" && (
            <View style={styles.payRow}>
              <Pressable
                disabled={busy}
                onPress={() => pay("cash")}
                style={({ pressed }) => [
                  styles.payBtn,
                  styles.payBtnGhost,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}
              >
                <Text style={styles.payBtnGhostText}>{t("inv.cash")}</Text>
              </Pressable>
              <Pressable
                onPress={() => setView("chapa")}
                style={({ pressed }) => [
                  styles.payBtn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.payBtnText}>{t("inv.pay")}</Text>
              </Pressable>
            </View>
          )}

          {!paid && view === "chapa" && (
            <View style={styles.chapaBox}>
              <Text style={styles.chapaTitle}>{t("inv.pay")}</Text>
              <Text style={styles.chapaNote}>{t("inv.mockNote")}</Text>
              <Text style={styles.fieldLabel}>{t("inv.provider")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chips}>
                  {PROVIDERS.map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setProvider(p)}
                      style={[
                        styles.pchip,
                        provider === p && styles.pchipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pchipText,
                          provider === p && styles.pchipTextActive,
                        ]}
                      >
                        {t(`pay.${p}`)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              {provider !== "card" && (
                <>
                  <Text style={styles.fieldLabel}>{t("inv.phone")}</Text>
                  <TextInput
                    value={phone}
                    onChangeText={(t) =>
                      setPhone(t.replace(/\D/g, "").slice(0, 9))
                    }
                    onFocus={(e) => {
                      if (!phone) setPhone("09");
                    }}
                    keyboardType="number-pad"
                    placeholder="09xx xxx xxx"
                    placeholderTextColor="#52525b"
                    style={styles.input}
                  />
                </>
              )}
              {payError && <Text style={styles.payError}>{payError}</Text>}
              <View style={styles.payRow}>
                <Pressable
                  disabled={busy}
                  onPress={() => setView("invoice")}
                  style={({ pressed }) => [
                    styles.payBtn,
                    styles.payBtnGhost,
                    pressed && styles.pressed,
                    busy && styles.disabled,
                  ]}
                >
                  <Text style={styles.payBtnGhostText}>{t("inv.back")}</Text>
                </Pressable>
                <Pressable
                  disabled={busy || (provider !== "card" && phone.length < 9)}
                  onPress={() => pay(provider)}
                  style={({ pressed }) => [
                    styles.payBtn,
                    pressed && styles.pressed,
                    (busy || (provider !== "card" && phone.length < 9)) &&
                      styles.disabled,
                  ]}
                >
                  <Text style={styles.payBtnText}>
                    {busy ? t("inv.processing") : t("inv.confirm")}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
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
  back: { color: "#71717a", fontSize: 13 },
  chip: {
    backgroundColor: "#1c1c1f",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: "#a1a1aa", fontSize: 11 },
  scroll: { paddingBottom: 40 },
  customer: { color: "#d4d4d8", fontSize: 13, marginTop: 4 },
  paidBox: {
    backgroundColor: "#053B29",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  paidTitle: { color: "#6EE7B7", fontWeight: "700" },
  paidRef: { color: "#a7f3d0", fontSize: 12, marginTop: 2 },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#262626",
  },
  lineName: { color: "#e4e4e7", fontSize: 13, flexShrink: 1, marginRight: 8 },
  lineAmt: { color: "#a1a1aa", fontSize: 13 },
  totals: { marginTop: 12, gap: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { color: "#71717a", fontSize: 13 },
  totalVal: { color: "#d4d4d8", fontSize: 13 },
  grandLabel: { color: "#fafafa", fontSize: 15, fontWeight: "700" },
  grandVal: { color: "#10b981", fontSize: 15, fontWeight: "700" },
  qrBox: { alignItems: "center", marginTop: 16 },
  qr: { width: 110, height: 110, borderRadius: 8, backgroundColor: "#fff" },
  qrNote: { color: "#52525b", fontSize: 11, marginTop: 6 },
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
  chapaBox: {
    backgroundColor: "#111113",
    borderColor: "#262626",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
  },
  chapaTitle: { color: "#fafafa", fontWeight: "700" },
  chapaNote: { color: "#52525b", fontSize: 11, marginTop: 2 },
  fieldLabel: { color: "#a1a1aa", fontSize: 12, marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: "row", gap: 6, paddingRight: 16 },
  pchip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pchipActive: { backgroundColor: "#10b981", borderColor: "#10b981" },
  pchipText: { color: "#a1a1aa", fontSize: 12 },
  pchipTextActive: { color: "#052e1b", fontWeight: "600" },
  input: {
    backgroundColor: "#18181b",
    borderColor: "#3f3f46",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    color: "#fafafa",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  payError: { color: "#f87171", fontSize: 13, marginTop: 10 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  error: { color: "#f87171", marginTop: 24, textAlign: "center" },
});
