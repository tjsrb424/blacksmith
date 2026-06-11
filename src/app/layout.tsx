import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/app/providers";
import {
  getAdsenseClientId,
  isH5AdBreakTestMode,
} from "@/lib/ads/adConfig";
import { isCrazyGamesBuild } from "@/lib/distribution";
import { PLATFORM } from "@/lib/platform";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const crazyGamesBuild = isCrazyGamesBuild();
const adsenseClientId = getAdsenseClientId();
const h5AdBreakTestMode = isH5AdBreakTestMode();
const adsenseScriptSrc = adsenseClientId
  ? `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      adsenseClientId,
    )}`
  : null;

export const metadata: Metadata = crazyGamesBuild
  ? {
      title: "World's Greatest Blacksmith",
      description:
        "Upgrade, sell, forge, and climb the rankings in a casual blacksmith enhancement game.",
    }
  : {
      title: "세계 최강의 대장장이",
      description:
        "세계 최강의 대장장이는 무기 강화, 판매, 제련, 초월, 랭킹 경쟁을 즐기는 웹 기반 캐주얼 강화 게임입니다.",
    };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={crazyGamesBuild ? "en" : "ko"}
      data-platform={PLATFORM}
      className={`${geistSans.variable} ${geistMono.variable} h-full overflow-hidden antialiased`}
    >
      <head>
        {!crazyGamesBuild && adsenseClientId && adsenseScriptSrc ? (
          <script
            id="adsense-h5-loader"
            async
            src={adsenseScriptSrc}
            crossOrigin="anonymous"
            data-ad-client={adsenseClientId}
            data-ad-frequency-hint="30s"
            {...(h5AdBreakTestMode ? { "data-adbreak-test": "on" } : {})}
            suppressHydrationWarning
          />
        ) : null}
      </head>
      <body
        data-platform={PLATFORM}
        className="flex h-full flex-col overflow-hidden bg-[#070708] text-zinc-100"
      >
        <Providers
          adsenseClientId={adsenseClientId}
          h5AdBreakTestMode={h5AdBreakTestMode}
        >
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
