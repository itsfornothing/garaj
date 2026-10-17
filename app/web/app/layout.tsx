import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Ethiopic } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ethiopic = Noto_Sans_Ethiopic({
  variable: "--font-noto-ethiopic",
  subsets: ["ethiopic"],
});

export const metadata: Metadata = {
  title: "GarAj · ጋራዥ — ጋራዥዎን በስልክዎ ያስተዳድሩ",
  description:
    "Amharic-first garage management for Ethiopian garages and EV service centers. በአማርኛ የተመሰረተ የጋራዥ አስተዳደር ለኢትዮጵያ ጋራዦች እና ለኤሌክትሪክ ተሽከርካርዮች አገልግሎት ማዕከላት።",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="am"
      className={`${geistSans.variable} ${geistMono.variable} ${ethiopic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
