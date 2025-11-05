import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/home/Navbar";
import { Hero } from "@/components/home/Hero";

import { ThemeProvider } from "next-themes";
import { LoginButton } from "@/components/auth/login-button";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { Toaster } from "sonner";
import SessionAutoSignout from "@/components/SessionAutoSignout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "amaki.fr",
  description: "Amicale des anciens élèves de Kipaku en Francep",
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
            <SessionAutoSignout />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
