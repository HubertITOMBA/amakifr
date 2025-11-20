import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "react-toastify/dist/ReactToastify.css";
import { Navbar } from "@/components/home/Navbar";
import { Hero } from "@/components/home/Hero";

import { ThemeProvider } from "next-themes";
import { LoginButton } from "@/components/auth/login-button";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { Toaster } from "sonner";
import SessionAutoSignout from "@/components/SessionAutoSignout";
import { ReactToastifyProvider } from "@/components/providers/react-toastify-provider";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AMAKI France",
  description: "Portail de l'Amicale des anciens élèves de Kipaku en France",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AMAKI",
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
            <SessionAutoSignout />
            <InstallPrompt />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
