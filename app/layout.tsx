import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import '@/lib/env-init';
import "react-toastify/dist/ReactToastify.css";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Hero } from "@/components/home/Hero";

import { ThemeProvider } from "next-themes";
import { LoginButton } from "@/components/auth/login-button";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { Toaster } from "sonner";
import SessionAutoSignout from "@/components/SessionAutoSignout";
import { ReactToastifyProvider } from "@/components/providers/react-toastify-provider";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ChatBotProvider } from "@/components/user/ChatBotProvider";
import { BuildIdChecker } from "@/components/BuildIdChecker";
import { ChunkErrorHandler } from "@/components/ChunkErrorHandler";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Désactiver le preload pour éviter les problèmes SSL en développement
  fallback: ["system-ui", "arial"],
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // Désactiver le preload pour éviter les problèmes SSL en développement
  fallback: ["monospace"],
  adjustFontFallback: true,
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://amaki.fr");
const siteName = "AMAKI France";
const siteDescription = "Portail de l'Amicale des anciens élèves de Kipaku en France";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl.replace(/\/$/, "")),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AMAKI",
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteUrl,
    siteName,
    title: siteName,
    description: siteDescription,
    images: [
      {
        url: "/web-app-manifest-512x512.png",
        width: 512,
        height: 512,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/web-app-manifest-512x512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3B82F6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning={true}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthSessionProvider>
          <ThemeProvider
             attribute="class"
             defaultTheme="system"
             enableSystem
             disableTransitionOnChange
          >
            {/* 
            <Hero /> */}
            
            {children}
            <ToastProvider />
            <Toaster richColors position="top-right" />
            <ReactToastifyProvider />
            {/* TODO: Réactiver la déconnexion automatique après le développement */}
            {/* <SessionAutoSignout /> */}
            <InstallPrompt />
            <ChatBotProvider />
            <BuildIdChecker />
            <ChunkErrorHandler />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
