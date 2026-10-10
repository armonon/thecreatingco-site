import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./studio-workspace.css";
import "./workspace-sizing.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = { colorScheme: "dark", themeColor: "#090b12", width: "device-width", initialScale: 1, viewportFit: "cover" };

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3001";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  return {
    metadataBase: base,
    applicationName: "ScenePilot Lite",
    title: "ScenePilot Lite — Automatic Music Video Editing",
    description: "The fast, local browser edition of ScenePilot: analyze a track, direct the cut, refine the master, and render a 1080p MP4.",
    openGraph: { title: "ScenePilot — Cut. Compose. Deliver.", description: "Beat-aware Browser Lite editing with a professional Desktop Pro timeline, nested motion compositions, multi-track audio and delivery queue.", images: [{ url: "/og.png", width: 1659, height: 948 }] },
    twitter: { card: "summary_large_image", title: "ScenePilot — Cut. Compose. Deliver.", description: "Browser Lite for the first cut. Desktop Pro for multi-track editing, motion compositions and professional delivery.", images: ["/og.png"] },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "ScenePilot" },
    formatDetection: { telephone: false },
    icons: {
      icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/app-icon-192.png", type: "image/png", sizes: "192x192" }],
      shortcut: "/app-icon-192.png",
      apple: [{ url: "/app-icon-192.png", sizes: "192x192" }],
    },
    other: { "mobile-web-app-capable": "yes" },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
