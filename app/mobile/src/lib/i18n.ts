import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Lang = "am" | "en";

type Entry = { am: string; en: string };

export const DICT: Record<string, Entry> = {
  "nav.back": { am: "← ወደ", en: "← Back" },
  "nav.brand": { am: "ጋራዥ", en: "GarAj" },
  "nav.board": { am: "ሰሌዳ", en: "Board" },
  "nav.invoices": { am: "ደረሰኞች", en: "Invoices" },
  "nav.audit": { am: "ታሪክ", en: "Audit trail" },
  "nav.menu": { am: "ሜኑ", en: "Menu" },
  "nav.newJob": { am: "አዲስ ሥራ ተቀበል", en: "New job" },
  "nav.loading": { am: "በመጫን ላይ…", en: "Loading…" },
  "nav.error": { am: "መረጃውን ማምጣት አልተቻለም።", en: "Couldn't load data." },
  "nav.empty": { am: "ባዶ", en: "Empty" },

  "shop.general": { am: "አጠቃላይ ጋራዥ", en: "General" },
  "shop.ev": { am: "ኤቪ ጋራዥ", en: "EV garage" },
  "shop.tire": { am: "ጎማ ጋራዥ", en: "Tire shop" },
  "shop.pick": { am: "ጋራዥዎን ይምረጡ", en: "Pick your garage" },
  "shop.sub": {
    am: "ከታች የሚታዩት ምሳሌ ጋራዦች ናቸው",
    en: "Demo garages shown below",
  },

  "st.received": { am: "ተቀብሎ", en: "Received" },
  "st.inspection": { am: "ምርመራ ላይ", en: "Inspection" },
  "st.estimate_sent": { am: "ግምት ተላከ", en: "Est. sent" },
  "st.estimate_declined": { am: "ግምት እምቢ", en: "Declined" },
  "st.approved": { am: "ፈቃድ ተሰጠ", en: "Approved" },
  "st.in_progress": { am: "ሥራ ላይ", en: "In progress" },
  "st.complete": { am: "ተጠናቋል", en: "Complete" },
  "st.paid": { am: "ተከፍሏል", en: "Paid" },
  "st.cancelled": { am: "ተሰርዟል", en: "Cancelled" },

  "board.plate": { am: "ሰሌዳ", en: "Plate" },
  "board.promised": { am: "ተስፋ ቀን", en: "Promised" },
  "board.filterAll": { am: "ሁሉም", en: "All" },

  "act.inspect": { am: "ምርመራ ግባ", en: "Inspect" },
  "act.build": { am: "ግምት አዘጋጅ", en: "Estimate" },
  "act.send": { am: "ማስቀመጥ + አገናኝ ላክ", en: "Save + send" },
  "act.save": { am: "ማስቀመጥ", en: "Save" },
  "act.startWork": { am: "ሥራ ጀምር", en: "Start" },
  "act.finish": { am: "ተጠናቋል", en: "Complete" },
  "act.invoice": { am: "ደረሰኝ አዘጋጅ", en: "Invoice" },
  "act.viewInvoice": { am: "ደረሰኝ እይ", en: "View invoice" },
  "act.resend": { am: "አገናኝ እንደገና ላክ", en: "Resend link" },
  "act.busy": { am: "በመላክ ላይ…", en: "Sending…" },
  "act.inspection": { am: "ምርመራ ግባ", en: "Inspect" },
  "act.in_progress": { am: "ሥራ ጀምር", en: "Start" },
  "act.complete": { am: "ተጠናቋል", en: "Complete" },
  "act.estimateSent": { am: "ደንበኛውን ይጠብቁ", en: "Waiting for customer" },

  "intake.title": { am: "አዲስ ሥራ ተቀበል", en: "New job" },
  "intake.search": { am: "ሰሌዳ / ስልክ / ስም ይፈልጉ", en: "Search plate / phone / name" },
  "intake.hint": {
    am: "ደንበኛ አገኘው? ያስገቡ። አዲስ ከሆነ ከታች ይመዝገቡ።",
    en: "Found a customer? Add the job. New customer? Register below.",
  },
  "intake.none": { am: "አልተገኘም — አዲስ ይመዝገቡ።", en: "Not found — register as new." },
  "intake.newVehicle": { am: "+ አዲስ ደንበኛ / ተሽከርካሪ", en: "+ New customer / vehicle" },
  "intake.plate": { am: "ሰሌዳ ቁጥር (አማራጭ)", en: "Plate number (optional)" },
  "intake.make": { am: "ማዕከል (ማምረቻ ስም)", en: "Make" },
  "intake.model": { am: "ሞዴል", en: "Model" },
  "intake.fuel": { am: "የነዳጅ አይነት", en: "Fuel type" },
  "intake.name": { am: "የደንበኛ ስም", en: "Customer name" },
  "intake.phone": { am: "ስልክ", en: "Phone" },
  "intake.odometer": { am: "በሚስ ማሽን ቁጥር (አማራጭ)", en: "Odometer km (optional)" },
  "intake.notes": { am: "ማስታወሻ (አማራጭ)", en: "Notes (optional)" },
  "intake.consent": {
    am: "ደንበኛው የመረጃ ማካፈል ፈቃድ ሰጠ (ግዴታ)",
    en: "Customer consented to data sharing (required)",
  },
  "intake.submit": { am: "ተቀበል", en: "Register" },
  "intake.done": { am: "ተቀብለናል ✓", en: "Registered ✓" },
  "intake.errConsent": {
    am: "የደንበኛ ፍቃድ ማረጋገጥ አስፈላጊ ነው።",
    en: "Consent must be checked.",
  },
  "intake.errPhone": {
    am: "ስልክ ቁጥሩ ትክክል አይደለም።",
    en: "Phone number is not valid.",
  },
  "intake.errName": {
    am: "የደንበኛ ስም ያስፈልጋል።",
    en: "Customer name is required.",
  },
  "intake.errVehicle": {
    am: "የተሽከርካሪ መረጃ ይሙሉ (ማዕከል/ሞዴል)።",
    en: "Vehicle fields (make/model) are required.",
  },

  "fuel.petrol": { am: "ነዳጅ", en: "Petrol" },
  "fuel.diesel": { am: "ዲዝኤል", en: "Diesel" },
  "fuel.bev": { am: "ኤሌክትሪክ", en: "EV" },
  "fuel.hev": { am: "ሃይብሪድ", en: "Hybrid" },
  "fuel.phev": { am: "ሃይብሪድ (ፕላግ)", en: "Plug-in hybrid" },
  "fuel.lpg": { am: "ኤልፒጂ", en: "LPG" },
  "fuel.other": { am: "ሌላ", en: "Other" },

  "est.title": { am: "ግምት አዘጋጅ", en: "Build estimate" },
  "est.jobs": { am: "የሥራ አይነቶች", en: "Jobs" },
  "est.parts": { am: "የተካፋይ (ክፍሎች)", en: "Parts" },
  "est.addPart": { am: "+ ክፍል ጨምር", en: "+ Add part" },
  "est.fxNote": {
    am: "ውጭ ምንዛሬ በዛሬ የጽሑፍ ተመና ወደ ብር ይቀየራል (ማርጅን {pct}%)።",
    en: "FX converts to ETB at today's desk rate (markup {pct}%).",
  },
  "est.partName": { am: "የብሬክ ፓድ (ፊት)", en: "Brake pad (front)" },
  "est.partCost": { am: "ዋጋ", en: "Cost" },
  "est.partQty": { am: "ብዛት", en: "Qty" },
  "est.subtotal": { am: "ድምር", en: "Subtotal" },
  "est.tax": { am: "ቫት/ክፍያ", en: "Tax" },
  "est.total": { am: "ጠቅላላ", en: "Total" },
  "est.catErr": {
    am: "ካታሎግ ማምጣት አልተቻለም።",
    en: "Couldn't load the catalog.",
  },
  "est.saveErr": {
    am: "ማስቀመጥ አልተቻለም — መስመር ይጨምሩ።",
    en: "Couldn't save — add a line first.",
  },
  "cur.ETB": { am: "ብር", en: "ETB" },
  "cur.CNY": { am: "¥ ቻይና", en: "CNY" },
  "cur.USD": { am: "$ ዶላር", en: "USD" },

  "inv.invoice": { am: "ደረሰኝ", en: "Invoice" },
  "inv.paid": { am: "ተከፍሏል", en: "Paid" },
  "inv.cash": { am: "ገንዘብ ተከፍሏል", en: "Cash received" },
  "inv.pay": { am: "በቻፓ ይክፈሉ (ዴሞ)", en: "Pay with Chapa (demo)" },
  "inv.back": { am: "ወደ ኋላ", en: "Back" },
  "inv.confirm": { am: "ክፍያ አረጋግጥ", en: "Confirm" },
  "inv.processing": { am: "በማስተላለፍ ላይ…", en: "Processing…" },
  "inv.mockNote": {
    am: "ይህ የተመሳሳይ (ዴሞ) ክፍያ ነው — እውነተኛ ቻፓ በG4 ይገናኛል።",
    en: "Simulated (demo) payment — real Chapa lands in G4.",
  },
  "inv.provider": { am: "የመክፈያ አቅርቦት", en: "Provider" },
  "inv.phone": { am: "ሃዋላ ስልክ ቁጥር", en: "Wallet phone" },
  "inv.qr": { am: "የሞባይል እይታ ኮድ", en: "Receipt code" },
  "inv.wasPaid": { am: "ደረሰኙ ቀድሞ ተከፍሏል።", en: "Already paid." },
  "inv.fail": { am: "ክፍያው አልተሳካም — እንደገና ይሞክሩ።", en: "Payment failed — try again." },
  "inv.noVersion": {
    am: "የተረጋገጠ ግምት የለም።",
    en: "No approved estimate yet.",
  },
  "inv.openFailed": {
    am: "ደረሰኝ መክፈት አልተቻለም።",
    en: "Couldn't open the invoice.",
  },
  "pay.telebirr": { am: "ቴሌብር", en: "telebirr" },
  "pay.cbe_birr": { am: "CBE Birr", en: "CBE Birr" },
  "pay.ebirr": { am: "e-Birr", en: "e-Birr" },
  "pay.mpesa": { am: "M-Pesa", en: "M-Pesa" },
  "pay.card": { am: "ካርድ", en: "Card" },

  "invList.title": { am: "ደረሰኞች", en: "Invoices" },
  "invList.none": { am: "እስካሁን ደረሰኝ አልተገኘም።", en: "No invoices yet." },
  "invList.unpaid": { am: "ክፍያ ቀርቧል", en: "Unpaid" },
  "invList.voided": { am: "ተሰርዟል", en: "Voided" },

  "aud.title": { am: "የውሳኔ ታሪክ", en: "Audit trail" },
  "aud.none": { am: "እንቅስቃሴ ከሌለ።", en: "No activity yet." },
  "aud.a.order_intake": { am: "አዲስ ሥራ ተቀብለናል", en: "New job registered" },
  "aud.a.order_status_changed": { am: "የሥራ ሁኔታ ተቀየረ", en: "Job status changed" },
  "aud.a.estimate_drafted": { am: "ግምት ተዘጋጅቷል", en: "Estimate drafted" },
  "aud.a.estimate_sent": { am: "ግምት ተልኗል", en: "Estimate sent" },
  "aud.a.approval_recorded": { am: "ደንበኛው ውሳኔ ሰጠ", en: "Customer decided" },
  "aud.a.invoice_issued": { am: "ደረሰኝ ተገናዘበ", en: "Invoice issued" },
  "aud.a.payment_recorded": { am: "ክፍያ ተመዝግቧል", en: "Payment recorded" },

  "est.statuses": { am: "የግምት ሁኔታዎች", en: "Estimate statuses" },
  "est.sentView": { am: "ደንበኛው እይታ", en: "Customer view" },
  "est.taxV": { am: "ቫት 15%", en: "VAT 15%" },
  "est.taxT": { am: "ታክስ በአገልግሎት 10%", en: "Service tax 10%" },
  "est.taxX": { am: "ታክስ ነጻ", en: "Tax exempt" },
  "cust.attempt": { am: "ተቀብላል", en: "OK" },
  "cust.wrongPin": {
    am: "የስልክ ቁጥርዎ የመጨረሻዎቹ 4 አይመስሉም።",
    en: "Last 4 digits don't match.",
  },
  "cust.badLinkB": {
    am: "የማገናኛው ትክክል አይደለም። ይህ ማገናኛ አልተጠቀመም ወይም ተሠርዟል። ጋራዥዎን ደውለው አዲስ አገናኝ እንዲልክ ጠይቁ።",
    en: "This link isn't valid — it was used or revoked. Ask your garage for a new link.",
  },
  "cust.expiredB": {
    am: "የማገናኛው ጊዜ አልቋል። ጋራዥዎን ደውለው አዲስ አገናኝ እንዲልክ ጠይቁ።",
    en: "This link expired. Ask your garage for a new link.",
  },
  "cust.lockedB": {
    am: "ብዙ ውድቅ መረጃ በመጣቡ ላይ ነው — ለ15 ደቂቃ ይህ ማገናኛ ተቀናቅቧል። ጋራዥዎን ደውለው አዲስ አገናኝ እንዲልክ ጠይቁ።",
    en: "Too many wrong attempts — this link is locked for 15 minutes. Ask your garage for a new link.",
  },
  "cust.expired": { am: "ጊዜ አልቋል", en: "Expired" },
  "cust.ready": { am: "ግምት ተዘጋጅቧል", en: "Estimate ready" },
  "cust.kindService": { am: "ሥራ", en: "Service" },
  "cust.kindPart": { am: "ክፍል", en: "Part" },
  "cust.deferNote": {
    am: "የመረጡት መስመሮች ብቻ ተፈቅደዋል — ቀሩት ለወደፊት ወስነው ይሰጣሉ።",
    en: "Only the lines you approved go ahead — the rest are deferred.",
  },
  "cust.pinLabel": {
    am: "የስልክ ቁጥርዎ የመጨረሻ 4 አሃዞች",
    en: "Last 4 digits of your phone",
  },
  "cust.declined": {
    am: "ግምቱ እምቢ ተብሎ ተመዝግቧል። ጋራዥዎ በቅርቡ ተለዋጭ አማራጭ ያሳያል።",
    en: "Declined — the garage will show you alternatives shortly.",
  },
  "cust.thanks": {
    am: "ፈቃድዎ ተመዝግቧል — እናመሰግናለን! ጋራዥዎ ሥራውን ይጀምራል።",
    en: "Your approval is recorded — thank you! The garage starts work now.",
  },
  "cust.secure": {
    am: "ፈቃድዎ በደህንነቱ ተጠብቆ ተመዝግቧል።",
    en: "Your approval is securely recorded.",
  },
  "cust.busy": { am: "በመመዝገብ ላይ…", en: "Recording…" },
  "cust.approveAll": { am: "ሙሉ ግምት ፈቅድ", en: "Approve all" },
  "cust.approveSel": { am: "መስመሮችን ብቻ ፈቅድ", en: "Approve lines only" },
  "cust.declineAll": { am: "ፈቅዳም እምቢ", en: "Decline all" },
};

const LANG_KEY = "garaj.lang";

export function useLang(): {
  lang: Lang;
  t: (key: string) => string;
  setLang: (l: Lang) => void;
} {
  const [lang, setLangState] = useState<Lang>("am");
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (v === "en" || v === "am") setLangState(v);
    });
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l);
  }, []);
  const t = useCallback(
    (key: string) => {
      const e = DICT[key];
      if (!e) return key;
      return lang === "en" ? e.en : e.am;
    },
    [lang]
  );
  return { lang, t, setLang };
}

export function statusKey(status: string): string {
  return DICT[`st.${status}`] ? `st.${status}` : "nav.empty";
}
