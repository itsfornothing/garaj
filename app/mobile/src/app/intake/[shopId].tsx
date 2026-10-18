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
import { apiFetch, apiGet } from "@/lib/api";

const FUELS = [
  { value: "petrol", label: "ነዳጅ" },
  { value: "diesel", label: "ዲዝኤል" },
  { value: "bev", label: "ኤሌክትሪክ" },
  { value: "hev", label: "ሃይብሪድ" },
  { value: "phev", label: "ሃይብሪድ (ፕላግ-ኢን)" },
  { value: "lpg", label: "ኤልፒጂ" },
  { value: "other", label: "ሌላ" },
];

type VehicleHit = {
  id: string;
  make: string;
  model: string;
  year: number | null;
  fuelType: string;
  plateNumber: string | null;
  customerNameAm: string;
  customerPhone: string;
};

export default function IntakeScreen() {
  const insets = useSafeAreaInsets();
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<VehicleHit[] | null>(null);
  const [selected, setSelected] = useState<VehicleHit | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [fuel, setFuel] = useState("petrol");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [odometer, setOdometer] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (q.trim().length < 2 || selected) {
        if (alive) setHits(null);
        return;
      }
      try {
        const { vehicles } = await apiGet<{ vehicles: VehicleHit[] }>(
          `/v1/shops/${shopId}/vehicles?q=${encodeURIComponent(q.trim())}`
        );
        if (alive) setHits(vehicles);
      } catch {
        if (alive) setHits([]);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, shopId, selected]);

  const submit = async () => {
    if (busy || !consent || !shopId) return;
    setBusy(true);
    setError(null);
    const body = selected
      ? { vehicleId: selected.id, notes: notes || undefined, odometerKm: odometer ? Number(odometer) : undefined, consent: true }
      : {
          phone,
          customerNameAm: name,
          make,
          model,
          fuelType: fuel,
          plateNumber: plate || undefined,
          notes: notes || undefined,
          odometerKm: odometer ? Number(odometer) : undefined,
          consent: true,
        };
    const { status, data } = await apiFetch<{ error?: string }>(
      "POST",
      `/v1/shops/${shopId}/intake`,
      body
    );
    setBusy(false);
    if (status === 201) {
      setDone("ተቀብለናል ✓");
      setTimeout(() => router.back(), 600);
    } else {
      setError(
        data.error === "consent_required"
          ? "የደንበኛ ፍቃድ ማረጋገጥ አስፈላጊ ነው።"
          : data.error === "phone_invalid"
            ? "ስልክ ቁጥሩ ትክክል አይደለም።"
            : data.error === "name_required"
              ? "የደንበኛ ስም ያስፈልጋል።"
              : data.error === "vehicle_fields_required"
                ? "የተሽከርካሪ መረጃ ይሙሉ (ማዕከል/ሞዴል)።"
                : "መመዝገብ አልተቻለም — እንደገና ይሞክሩ።"
      );
    }
  };

  const canSubmit =
    consent &&
    !busy &&
    (selected
      ? true
      : name.trim().length > 1 &&
        phone.replace(/\D/g, "").length >= 9 &&
        make.trim().length > 0 &&
        model.trim().length > 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={() => router.back()}>
          <Text style={styles.back}>← ሰሌዳ</Text>
        </Pressable>
        <Text style={styles.headerTitle}>አዲስ ሥራ ተቀበል</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!selected && !isNew && (
          <>
            <Text style={styles.label}>ሰሌዳ / ስልክ / ስም ይፈልጉ</Text>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="3-AA ወይም 0911…"
              placeholderTextColor="#52525b"
              style={styles.input}
            />
            {hits === null && q.trim().length < 2 && (
              <Text style={styles.hint}>
                ደንበኛ አገኘው? ያስገቡ። አዲስ ከሆነ ከታች ይመዝገቡ።
              </Text>
            )}
            {hits?.length === 0 && q.trim().length >= 2 && (
              <Text style={styles.hint}>አልተገኘም — አዲስ ይመዝገቡ።</Text>
            )}
            {hits?.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => setSelected(v)}
                style={({ pressed }) => [
                  styles.hit,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.hitMain}>
                  {v.make} {v.model} {v.year ? `· ${v.year}` : ""}
                </Text>
                <Text style={styles.hitSub}>
                  {v.customerNameAm} · {v.customerPhone}
                  {v.plateNumber ? ` · ${v.plateNumber}` : ""}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setIsNew(true)}
              style={({ pressed }) => [styles.newBtn, pressed && styles.pressed]}
            >
              <Text style={styles.newBtnText}>+ አዲስ ደንበኛ / ተሽከርካሪ</Text>
            </Pressable>
          </>
        )}

        {selected && (
          <View style={styles.selBox}>
            <Text style={styles.selMain}>
              {selected.make} {selected.model}
            </Text>
            <Text style={styles.hitSub}>
              {selected.customerNameAm} · {selected.customerPhone}
            </Text>
          </View>
        )}

        {isNew && !selected && (
          <>
            <Text style={styles.label}>ሰሌዳ ቁጥር (አማራጭ)</Text>
            <TextInput
              value={plate}
              onChangeText={setPlate}
              placeholder="3-AA-12045"
              placeholderTextColor="#52525b"
              style={styles.input}
            />
            <Text style={styles.label}>ማዕከል (የትምህርት ወይም የማምረቻ ስም)</Text>
            <TextInput
              value={make}
              onChangeText={setMake}
              placeholder="ቶዮታ"
              placeholderTextColor="#52525b"
              style={styles.input}
            />
            <Text style={styles.label}>ሞዴል</Text>
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder="ኮሮላ"
              placeholderTextColor="#52525b"
              style={styles.input}
            />
            <Text style={styles.label}>የነዳጅ አይነት</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chips}>
                {FUELS.map((f) => (
                  <Pressable
                    key={f.value}
                    onPress={() => setFuel(f.value)}
                    style={[styles.pchip, fuel === f.value && styles.pchipActive]}
                  >
                    <Text
                      style={[
                        styles.pchipText,
                        fuel === f.value && styles.pchipTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.label}>የደንበኛ ስም</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="ሰሎሞን አንድሳ"
              placeholderTextColor="#52525b"
              style={styles.input}
            />
            <Text style={styles.label}>ስልክ</Text>
            <TextInput
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/[^\d+]/g, "").slice(0, 13))}
              keyboardType="phone-pad"
              placeholder="+2519113010111"
              placeholderTextColor="#52525b"
              style={styles.input}
            />
          </>
        )}

        {(selected || isNew) && (
          <>
            <Text style={styles.label}>በሚስ ማሽን ቁጥር (አማራጭ)</Text>
            <TextInput
              value={odometer}
              onChangeText={(t) => setOdometer(t.replace(/\D/g, "").slice(0, 7))}
              keyboardType="number-pad"
              placeholder="45000"
              placeholderTextColor="#52525b"
              style={styles.input}
            />
            <Text style={styles.label}>ማስታወሻ (አማራጭ)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="ብሬክ ድምጽ ይሰማል…"
              placeholderTextColor="#52525b"
              multiline
              style={[styles.input, styles.notes]}
            />
            <Pressable
              onPress={() => setConsent(!consent)}
              style={styles.consentRow}
            >
              <View style={[styles.box, consent && styles.boxChecked]}>
                {consent && <Text style={styles.check}>✓</Text>}
              </View>
              <Text style={styles.consentText}>
                ደንበኛው የመረጃ ማካፈል ፈቃድ ሰጠ (ግዴታ)
              </Text>
            </Pressable>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {done && <Text style={styles.done}>{done}</Text>}

        {(selected || isNew) && (
          <Pressable
            disabled={!canSubmit}
            onPress={submit}
            style={({ pressed }) => [
              styles.submit,
              pressed && styles.pressed,
              !canSubmit && styles.disabled,
            ]}
          >
            <Text style={styles.submitText}>
              {busy ? "በመመዝገብ ላይ…" : "ተቀበል"}
            </Text>
          </Pressable>
        )}
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
  back: { color: "#71717a", fontSize: 13, width: 40 },
  headerTitle: { color: "#fafafa", fontSize: 15, fontWeight: "700" },
  scroll: { paddingBottom: 40 },
  label: { color: "#a1a1aa", fontSize: 12, marginTop: 14, marginBottom: 6 },
  hint: { color: "#52525b", fontSize: 12, marginTop: 12 },
  input: {
    backgroundColor: "#18181b",
    borderColor: "#3f3f46",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    color: "#fafafa",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notes: { minHeight: 70, textAlignVertical: "top" },
  hit: {
    backgroundColor: "#111113",
    borderColor: "#262626",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  hitMain: { color: "#fafafa", fontSize: 14, fontWeight: "600" },
  hitSub: { color: "#71717a", fontSize: 12, marginTop: 2 },
  newBtn: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#3f3f46",
    paddingVertical: 10,
    alignItems: "center",
  },
  newBtnText: { color: "#a1a1aa", fontSize: 13, fontWeight: "600" },
  selBox: {
    backgroundColor: "#111113",
    borderColor: "#262626",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  selMain: { color: "#fafafa", fontSize: 14, fontWeight: "600" },
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
  consentRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 10 },
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
  consentText: { color: "#d4d4d8", fontSize: 13, flexShrink: 1 },
  submit: {
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 18,
  },
  submitText: { color: "#052e1b", fontWeight: "700", fontSize: 15 },
  done: { color: "#6EE7B7", textAlign: "center", marginTop: 12 },
  error: { color: "#f87171", marginTop: 12, textAlign: "center" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
