"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";

export type Lang = "am" | "en";

type Entry = { am: string; en: string };

export const DICT: Record<string, Entry> = {
  // Brand / home
  "brand.tagline": { am: "ለኢትዮጵያ ጋራዦች የተመሰረተ", en: "Built for Ethiopian garages" },
  "home.hero": {
    am: "ጋራዥዎን ከተቀቢባ እስከ ተከፍሏል — ሁሉም በአንድ ቦታ",
    en: "Your garage, from take-in to paid — all on one board",
  },
  "home.lead": {
    am: "ጋራዥ ለኢትዮጵያ ጋራጆች እና የኤሌክትሪክ ተሽከርካሪ አገልግሎት ማዕከላት የተሰራ መስታወት ነው — ደንበኛ ተቀብሎ፣ ግምት ላክ፣ ውሳኔ ተቀብል፣ ሥራ ስራ … እስከ ተከፍሏል ባንድ ሰሌዳ ላይ።",
    en: "GarAj is a workshop platform built for Ethiopian garages and EV centers: take customer and car details in, build the estimate with jobs and parts, send the approval link, then run the job to invoices, taxes and payments — all from one board.",
  },
  "home.howwhy": {
    am: "ጋራዥ እንዴት ነገዎችን ሳስተዳድር ይሰድፈዋል",
    en: "What the platform does, step by step",
  },
  "home.w1": { am: "1 · ተቀበል", en: "1 · Take the job in" },
  "home.w1b": {
    am: "ደንበኛ በሰሌዳ ቁጥር፣ በስልክ ወይም በስም በአንድ ሳጥን ይፈልጉ። አዲስ ከሆነ ተሽከርካሪውን በፍቃድ ይመዝገቡ (ማዕከል፣ ሞዴል፣ የነዳጅ አይነት።",
    en: "Search the customer by plate, phone or name in one box. New face? Register the car (make, model, fuel type — EV chips included) with consent.",
  },
  "home.w2": { am: "2 · ግምት አዘጋጅ", en: "2 · Build the estimate" },
  "home.w2b": {
    am: "ካታሎግ ሥራዎችን ይምረጡ (ሰዓት × የሠራተኛ ተመን) እና ክፍሎችን ይጨምሩ — ቻይና ወይም ዶላር ዋጋ በዛሬ የጽሑፍ ተመና ወደ ብር ይቀየራል።",
    en: "Pick canned jobs (labor hours × birr rate) and add parts — imported parts price in CNY or USD and convert at today's desk rate with your markup.",
  },
  "home.w3": { am: "3 · ፈቅድ በኮድ", en: "3 · Approve by code" },
  "home.w3b": {
    am: "ደንበኛው በራሱ ስልክ ይከፈታል፣ መስመሮችን በዋጋ ይመልከታል፣ ሙሉ ወይም ክፍል ይፈቅዳል — በስልክዎ የመጨረሻ 4 ቁጥሮች ያረጋግጣል።",
    en: "The customer opens the link on their own phone, sees each line priced, and approves all or part — then verifies it with the last 4 digits of their phone.",
  },
  "home.w4": { am: "4 · ደረሰኝ ባንድ እንተወ", en: "4 · Invoice in one tap" },
  "home.w4b": {
    am: "ሥራው ሲታረግ ደረሰኙ እራሱን ይፈጥራል — ተራ ቁጥር፣ ቫት ወይም የአገልግሎት ታክስ በንግድዎ አይነት፣ እና የሞባይል እይታ ኮድ።",
    en: "When the job is done, the invoice follows: global sequential number (INV-2019/00005), VAT or service tax by your regime, and a QR receipt code.",
  },
  "home.w5": { am: "5 · ዴሞ ቻፓ ክፍያ", en: "5 · Pay with Chapa (demo)" },
  "home.w5b": {
    am: "ደንበኛው በሚያውቀው መብራ ይከፍላል — ቴሌብር፣ CBE ብር፣ e-Birr፣ M-Pesa ወይም ካርድ። እውነተኛ ቻፓ በG4 ይገናኛል፤ ዛሬ ዴሞው ዑደቱን ያጠናቃል።",
    en: "The customer pays in the way they know — telebirr, CBE Birr, e-Birr, M-Pesa or card. Real Chapa lands in G4; today the demo path completes the loop.",
  },
  "home.w6": { am: "6 · መረጃ በታሪክ", en: "6 · Everything audited" },
  "home.w6b": {
    am: "እያንዳንዱ ውሳኔ — ምዝገባ፣ የሁኔታ መቀየር፣ ፈቃድ፣ ክፍያ — በታሪክ ለግዜው ተመዝግቧል። ገንዘብ ላለተነካ ሠሌዳ ላይ ነገ ታፈልጉ ይሬሳል።",
    en: "Every decision — intake, status changes, approvals, payments — is written to an audit trail with before/after, actor and channel. If it moved money, it's on the record.",
  },
  "home.try": { am: "የዴሞ ሰሌዳ ይሞክሩ", en: "Try the live demo" },
  "home.trySub": {
    am: "ሦስት የሚሰሩ ጋራጆች — ከተቀብሎ ሥራዎች፣ ግምቶች እና ክፍያዎች ጋር ተዘጋጅተዋል። አንዱን ስምጡ ከዚያ ሁሉንም ቅደም ተከተል በአምስት ደቂቃ ያጠናቃሉ።",
    en: "Three working garages, pre-seeded with jobs, invoices and payments — click one and run the whole flow in under five minutes.",
  },
  "home.cta": { am: "አሁኑኑ ይሞክሩ →", en: "Try it now →" },
  "intake.short": { am: "አዲስ ሥራ", en: "New job" },
  "est.taxX": { am: "ታክስ ነጻ", en: "No tax" },
  "est.hours": { am: "ሰዓት", en: "h" },
  "est.failSave": {
    am: "ግምቱን ማስቀመጥ አልተቻለም — እንደገና ይሞክሩ።",
    en: "Couldn't save the estimate — try again.",
  },
  "cust.forPrefix": { am: "ለ", en: "for" },
  "aud.a.order_intake": { am: "አዲስ ሥራ ተቀብለናል", en: "New job registered" },
  "aud.a.order_status_changed": { am: "የሥራ ሁኔታ ተቀየረ", en: "Job status changed" },
  "aud.a.estimate_drafted": { am: "ግምት ተዘጋጅቷል", en: "Estimate drafted" },
  "aud.a.estimate_sent": { am: "ግምት ተልኗል", en: "Estimate sent" },
  "aud.a.approval_recorded": { am: "ደንበኛው ውሳኔ ሰጠ", en: "Customer decided" },
  "aud.a.invoice_issued": { am: "ደረሰኝ ተገናዘበ", en: "Invoice issued" },
  "aud.a.payment_recorded": { am: "ክፍያ ተመዝግቧል", en: "Payment recorded" },
  "home.sub": {
    am: "ተቀብሎ ከተከፍሏል ድረስ — ግምት፣ ፈቃድ፣ ደረሰኝ እና ገቢ ወጪ ሁሉም በአንድ ቦታ። በአማርኛ ፊደል፣ በብር።",
    en: "From intake to paid — estimates, approvals, invoices and cash flow in one place. In Ethiopic script, in Birr.",
  },
  "home.how": { am: "እንዴት እንደሚሰራ", en: "How it works" },
  "home.demoShops": { am: "ምሳሌ ጋራዦች", en: "Demo garages" },
  "home.demoSub": {
    am: "እውነተኛ የሥራ ፍሰት ለማሳየት የተዘጋጁ ምሳሌዎች — በነፃ ይጎብኙ።",
    en: "Live boards with seeded data — explore freely.",
  },
  "home.openBoard": { am: "ሰሌዳውን ይክፈቱ", en: "Open board" },
  "home.activeJobs": { am: "ንቁ ሥራ", en: "Active jobs" },
  "home.paidJobs": { am: "የተከፈሉ", en: "Paid" },
  "home.f.heap": { am: "ግምት በተልእኮ ይፈቀዳ", en: "Estimates by message link" },
  "home.f.heapB": {
    am: "ደንበኛው የጥገና ግምት በተልእኮ አገናኝ ያገኛል — የፈቀደውን በራሱ ይመረርታል፤ የስልክ ጥሪ አያስፍልግም።",
    en: "The customer approves the estimate from a message link — no phone calls needed.",
  },
  "home.f.report": { am: "ዕለታዊ ሪፖርት", en: "Daily report" },
  "home.f.reportB": {
    am: "ምን ተጠናቋል፣ ምን ቀርቧል፣ ስንት ወጥቷል — በየቀኑ በአንድ አጭር ሪፖርት።",
    en: "Done, pending and cash — one short report each day.",
  },
  "home.f.offline": { am: "ከመስመር ውጭ የሚሰራ", en: "Works offline" },
  "home.f.offlineB": {
    am: "ኢንተርኔት ሲቋረጥ ሥራው አይቋረጥም — ፍርም ይከማቻል፣ ሲገናኝ ይቀርጻል።",
    en: "When the internet drops, work doesn't — actions queue and sync on reconnect.",
  },
  "home.f.ev": { am: "የኤሌክትሪክ ተሽከርካሪ ይቀበላል", en: "EV-ready" },
  "home.f.evB": {
    am: "ባትሪ፣ ሶፍትዌር እና የኤሌክትሪክ ተሽከርካሪ ጥገናዎች በቀጥታ ከደንበኛ ታሪክ ጋር ይተባባራሉ።",
    en: "Battery, software and EV repairs tracked against each customer's history.",
  },
  "home.s1": { am: "ሰሌዳውን ይክፈቱ", en: "Open a board" },
  "home.s1b": {
    am: "ከታች ካሉት ምሳሌ ጋራዦች አንዱን ይምረጡ — የተቀበሉዎት ሥራዎች በየሁኔታቸው ይታያሉ።",
    en: "Pick a demo garage below — every job shows up by stage.",
  },
  "home.s2": { am: "ግምት አገናኝ ላክ", en: "Send the estimate" },
  "home.s2b": {
    am: "በሰሌዳው ላይ ግምት አዘጋጅ ይንኩ — የዴንበኛው ስውር አገናኝ ወዲያውኑ ይሰራል።",
    en: "Tap build-estimate on the board — the customer's secret link is issued instantly.",
  },
  "home.s3": { am: "ውሳኔውን ይመልከቱ", en: "Watch the approval" },
  "home.s3b": {
    am: "ደንበኛው በስልክ ቁጥሩ የመጨረሻ 4 አሃዞች ማረጋገጥ ፈቅዶታል — ሥራው በራሱ ወደ «ፈቃድ ተሰጠ» ያልቃል።",
    en: "The customer confirms the last 4 digits of their phone and approves — the job moves itself.",
  },
  "home.coming": { am: "ይመጣል", en: "Roadmap" },
  "footer.note": {
    am: "ጋራዥ · በአማርኛ ፊደል የተገነባ የጋራዥ አስተዳደር ስርዓት።",
    en: "GarAj · garage management built in Ethiopic script.",
  },

  // Language
  "lang.toggle": { am: "EN", en: "አማ" },

  // Shop meta
  "shop.general": { am: "አጠቃላይ ጋራዥ", en: "General garage" },
  "shop.ev": { am: "ኤቪ ጋራዥ", en: "EV garage" },
  "shop.tire": { am: "ጎማ ጋራዥ", en: "Tire shop" },
  "shop.vat": { am: "ቫት 15%", en: "VAT 15%" },
  "shop.tot": { am: "ታክስ በአገልግሎት 10% · በክፍልፊት 2%", en: "Service 10% · Parts 2%" },
  "shop.exempt": { am: "ግብይት ነጻ", en: "Tax exempt" },
  "shop.notFound": { am: "ጋራዥ አልተገኘም።", en: "Garage not found." },
  "shop.back": { am: "ወደ ቀጥታ ይመለሱ", en: "Back home" },

  // Nav
  "nav.brand": { am: "ጋራዥ", en: "GarAj" },
  "nav.board": { am: "ሰሌዳ", en: "Board" },
  "nav.invoices": { am: "ደረሰኞች", en: "Invoices" },
  "nav.audit": { am: "ታሪክ", en: "Audit trail" },
  "nav.intake": { am: "አዲስ ሥራ ተቀበል", en: "New job" },
  "nav.customerLink": { am: "የደንበኛ እይታ (ምሳሌ)", en: "Customer view (demo)" },
  "nav.loading": { am: "በመጫን ላይ…", en: "Loading…" },

  // Board
  "board.empty": { am: "ባዶ", en: "Empty" },
  "board.plate": { am: "ሰሌዳ", en: "Plate" },
  "board.promised": { am: "ተስፋ ቀን", en: "Promised" },
  "st.received": { am: "ተቀብሎ", en: "Received" },
  "st.inspection": { am: "ምርመራ ላይ", en: "Inspection" },
  "st.estimate_sent": { am: "ግምት ተላከ", en: "Estimate sent" },
  "st.estimate_declined": { am: "ግምት እምቢ", en: "Declined" },
  "st.approved": { am: "ፈቃድ ተሰጠ", en: "Approved" },
  "st.in_progress": { am: "ሥራ ላይ", en: "In progress" },
  "st.complete": { am: "ተጠናቋል", en: "Complete" },
  "st.paid": { am: "ተከፍሏል", en: "Paid" },
  "st.cancelled": { am: "ተሰርዟል", en: "Cancelled" },

  // Order actions
  "act.inspect": { am: "ምርመራ ግባ", en: "Inspect" },
  "act.build": { am: "ግምት አዘጋጅ", en: "Build estimate" },
  "act.send": { am: "ማስቀመጥ + አገናኝ ላክ", en: "Save + send link" },
  "act.save": { am: "ማስቀመጥ", en: "Save" },
  "act.startWork": { am: "ሥራ ጀምር", en: "Start work" },
  "act.finish": { am: "ተጠናቋል", en: "Mark complete" },
  "act.invoice": { am: "ደረሰኝ አዘጋጅ", en: "Issue invoice" },
  "act.viewInvoice": { am: "ደረሰኝ እይ", en: "View invoice" },
  "act.cancel": { am: "ተሰርዟል", en: "Cancel job" },
  "act.busy": { am: "በመላክ ላይ…", en: "Sending…" },

  // Dialogs — intake
  "intake.title": { am: "አዲስ ሥራ ተቀበል", en: "New job" },
  "intake.search": { am: "ሰሌዳ / ስልክ / ስም ይፈልጉ", en: "Search plate / phone / name" },
  "intake.newVehicle": { am: "+ አዲስ ደንበኛ / ተሽከርካሪ", en: "+ New customer / vehicle" },
  "intake.plate": { am: "ሰሌዳ ቁጥር (አማራጭ)", en: "Plate number (optional)" },
  "intake.make": { am: "ማዕከል (ማምረቻ ስም)", en: "Make" },
  "intake.model": { am: "ሞዴል", en: "Model" },
  "intake.fuel": { am: "የነዳጅ አይነት", en: "Fuel type" },
  "intake.name": { am: "የደንበኛ ስም", en: "Customer name" },
  "intake.phone": { am: "ስልክ", en: "Phone" },
  "intake.odometer": { am: "በሚስ ማሽን ቁጥር (አማራጭ)", en: "Odometer km (optional)" },
  "intake.notes": { am: "ማስታወሻ (አማራጭ)", en: "Notes (optional)" },
  "intake.consent": { am: "ደንበኛው የመረጃ ማካፈል ፈቃድ ሰጠ (ግዴታ)", en: "Customer consented to data sharing (required)" },
  "intake.submit": { am: "ተቀበል", en: "Register" },
  "intake.close": { am: "ተዘጋ", en: "Close" },
  "fm.fuel.petrol": { am: "ነዳጅ", en: "Petrol" },
  "fm.fuel.diesel": { am: "ናፍጣ", en: "Diesel" },
  "fm.fuel.ev": { am: "ኤሌክትሪክ", en: "EV" },
  "fm.fuel.hybrid": { am: "ሃይብሪድ", en: "Hybrid" },
  "fm.fuel.plug_in_hybrid": { am: "ፕላግ-ኢን ሃይብሪድ", en: "Plug-in hybrid" },
  "fm.fuel.cng": { am: "ጋዝ (CNG)", en: "CNG" },
  "fm.fuel.lpg": { am: "ጋዝ (LPG)", en: "LPG" },

  // Dialogs — estimate builder
  "est.title": { am: "ግምት አዘጋጅ", en: "Build estimate" },
  "est.jobs": { am: "የሥራ አይነቶች", en: "Jobs" },
  "est.parts": { am: "የተካፋይ (ክፍሎች)", en: "Parts" },
  "est.addPart": { am: "+ ክፍል ጨምር", en: "+ Add part" },
  "est.fxNote": {
    am: "ውጭ ምንዛሬ በዛሬ የጽሑፍ ተመና ወደ ብር ይቀየራል (ማርጅን 20%)።",
    en: "Foreign currency converts to Birr at the desk rate (20% margin).",
  },
  "est.savedNoLink": {
    am: "ተቀምጧል — ነገር ግን አገናኝ መላክ አልተቻለም።",
    en: "Saved, but the customer link could not be sent.",
  },
  "est.fxDesk": {
    am: "(ዴሞ የተመና፡ 1 ¥ = {cny} ብር · 1 $ = {usd} ብር · {pct}% ተጨማሪ · {asOf})",
    en: "(demo desk rate: 1 ¥ = {cny} ETB · 1 $ = {usd} ETB · {pct}% markup · {asOf})",
  },
  "act.copy": { am: "ቅዳ", en: "Copy" },
  "est.noApproved": {
    am: "ለዚህ ሥራ የፈቀደ ግምት አለም — በመጀመሪያ ግምት ይዘጋጁ።",
    en: "No approved estimate for this job — build one first.",
  },
  "intake.fuelOther": { am: "ሌላ", en: "Other" },
  "est.subtotal": { am: "ድምር", en: "Subtotal" },
  "est.tax": { am: "ቫት/ክፍያ", en: "Tax" },
  "est.total": { am: "ጠቅላላ", en: "Total" },
  "est.partCost": { am: "ዋጋ", en: "Cost" },
  "est.partQty": { am: "ብዛት", en: "Qty" },
  "est.partName": { am: "የብሬክ ፓድ (ፊት)", en: "Brake pad (front)" },
  "cur.ETB": { am: "ብር", en: "ETB" },
  "cur.CNY": { am: "¥ (ቻይና)", en: "CNY" },
  "cur.USD": { am: "$", en: "USD" },

  // Dialogs — invoice / pay
  "inv.pay": { am: "በቻፓ ይክፈሉ (ዴሞ)", en: "Pay with Chapa (demo)" },
  "inv.cash": { am: "ገንዘብ ተከፍሏል", en: "Cash received" },
  "inv.close": { am: "ተዘጋ", en: "Close" },
  "inv.paid": { am: "ተከፍሏል", en: "Paid" },
  "inv.cashLabel": { am: "በገንዘብ", en: "Cash" },
  "inv.qr": { am: "የሞባይል እይታ ኮድ", en: "Mobile receipt code" },
  "inv.provider": { am: "የመክፈያ አቅርቦት", en: "Payment provider" },
  "inv.phone": { am: "ሃዋላ ስልክ ቁጥር", en: "Wallet phone" },
  "inv.confirm": { am: "ክፍያ አረጋግጥ", en: "Confirm payment" },
  "inv.back": { am: "ወደ ኋላ", en: "Back" },
  "inv.mockNote": {
    am: "ይህ የተመሳሳይ (ዴሞ) ክፍያ ነው — እውነተኛ ቻፓ በG4 ይገናኛል።",
    en: "This is a simulated (demo) payment — real Chapa lands in G4.",
  },
  "inv.processing": { am: "በማስተላለፍ ላይ…", en: "Processing…" },
  "inv.wasPaid": { am: "ደረሰኙ ቀድሞ ተከፍሏል።", en: "Already paid." },
  "inv.fail": { am: "ክፍያው አልተሳካም — እንደገና ይሞክሩ።", en: "Payment failed — try again." },
  "pay.telebirr": { am: "ቴሌብር", en: "telebirr" },
  "pay.cbe_birr": { am: "CBE Birr", en: "CBE Birr" },
  "pay.ebirr": { am: "e-Birr", en: "e-Birr" },
  "pay.mpesa": { am: "M-Pesa", en: "M-Pesa" },
  "pay.card": { am: "ካርድ", en: "Card" },
  "pay.cash": { am: "ገንዘብ", en: "Cash" },

  // Invoices page
  "invPage.title": { am: "ደረሰኞች", en: "Invoices" },
  "invPage.none": { am: "እስካሁን ደረሰኝ አልተገኘም።", en: "No invoices yet." },
  "invPage.unpaid": { am: "ክፍያ ቀርቧል", en: "Unpaid" },
  "invPage.paidChip": { am: "ተከፍሏል", en: "Paid" },
  "invPage.voided": { am: "ተሰርዟል", en: "Voided" },

  // Audit page
  "aud.title": { am: "የውሳኔ ታሪክ", en: "Audit trail" },
  "aud.sub": {
    am: "ማን ምን ፈጠረ — ማንኛውም ሥራ፣ ግምት፣ ደረሰኝ እና ክፍያ እዚህ ይጠቀሳል።",
    en: "Who did what — every intake, estimate decision, invoice and payment, recorded.",
  },
  "aud.none": { am: "እንቅስቃሴ ከሌለ።", en: "No activity yet." },

  // Customer estimate view
  "cust.badLink": { am: "አገናኙ ትክክል አይደለም", en: "This link is not valid" },
  "cust.badLinkB": {
    am: "አገናኝ አልታወቀም — እባክዎ አዲስ አገናኝ እንዲልኩልዎ ጋራዥዎን ያማክሩ።",
    en: "This link can't be recognised — ask the garage to send a fresh one.",
  },
  "cust.locked": { am: "ደህንነት ለመጠበቅ ነገው ተዘግቷል", en: "Too many attempts" },
  "cust.lockedB": {
    am: "ብዙ ጊዜ ተሞክሮ ነገው ተዘግቷል — ከትንሽ በኋላ እንደገና ይሞክሩ።",
    en: "The link is locked for a short while for safety — try again later.",
  },
  "cust.expired": { am: "አገናኙ ጊዜው አልፏል", en: "This link expired" },
  "cust.expiredB": {
    am: "አገናኙ የቆየ ነገር ጊዜው አልፏል — አዲስ እንዲልኩ ይጠይቁ።",
    en: "This link has timed out — ask for a fresh one.",
  },
  "cust.loading": { am: "በመጫን ላይ…", en: "Loading…" },
  "cust.pinLabel": { am: "የእርስዎ የስልክ ቁጥር መጨረሻ 4 አሃዞች", en: "Last 4 digits of your phone" },
  "cust.pinHint": { am: "የእርስዎ መረጃ ለመጠበቅ ብቻ።", en: "Just to keep your data safe." },
  "cust.wrongPin": { am: "ስልክ ቁጥሩ የተሳሳተ ነው። ቀሪ መሞከሪያ", en: "Wrong digits. Attempts left" },
  "cust.approveAll": { am: "ሁሉንም አግብት", en: "Approve everything" },
  "cust.declineAll": { am: "ሁሉንም እምቢ", en: "Decline all" },
  "cust.approveSel": { am: "የመረጡትን አግብት", en: "Approve selection" },
  "cust.deferNote": { am: "ቀሪ መስመሮች ለወደፊት ይቀራሉ።", en: "Remaining items: decide later" },
  "cust.thanks": {
    am: "ፈቃድዎ ተመዝግቧል — እናመሰግናለን! ጋራዥዎ ሥራውን ይጀምራል።",
    en: "Your approval is recorded — thank you! The garage starts work now.",
  },
  "cust.declined": {
    am: "ግምቱ እምቢ ተብሎ ተመዝግቧል። ጋራዥዎ በቅርቡ ተለዋጭ አማራጭ ያሳያል።",
    en: "Declined — the garage will show you alternatives shortly.",
  },
  "cust.kindService": { am: "ሥራ", en: "Service" },
  "cust.kindPart": { am: "ክፍል", en: "Part" },
  "cust.already": { am: "ውሳኔው ተቀርቧል", en: "Decision already recorded" },
  "cust.alreadyB": {
    am: "የሚያስፈልገውን ውሳኔ አገናኝ ውስጥ በሌላ ጊዜ ተሠርቷል።",
    en: "This link has already been used to record the decision.",
  },
  "cust.busy": { am: "በመሮጥ ላይ…", en: "Working…" },
  "cust.ready": { am: "ግምት ተዘጋጅቧል", en: "Estimate ready" },
  "cust.linkInvalid": { am: "አገናኝ የተሳሳተ ነው።", en: "This link appears broken." },
  "cust.shopLines": { am: "የጥገና መስመሮች", en: "Repair lines" },
  "cust.remainder": { am: "የመሰባሰቢያ ተከታታ ወስን", en: "Defer remaining" },
  "cust.note": { am: "ማስታወሻ", en: "Note" },
};

const LangCtx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof DICT | string) => string;
}>({ lang: "am", setLang: () => {}, t: (k) => k });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("am");
  useEffect(() => {
    const saved = window.localStorage.getItem("garaj.lang");
    if (saved === "en" || saved === "am") setLangState(saved);
  }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("garaj.lang", l);
  }, []);
  const t = useCallback(
    (k: string) => {
      const e = DICT[k];
      return e ? (lang === "en" ? e.en : e.am) : k;
    },
    [lang]
  );
  return (
    <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>
  );
}

export function useLang() {
  return useContext(LangCtx);
}
