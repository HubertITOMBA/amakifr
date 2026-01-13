"use client";

import { Hero } from "@/components/home/Hero";
import Emblacarousel from "@/components/home/Home-carousel";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { AboutSection } from "@/components/home/AboutSection";
import { ValuesSection } from "@/components/home/ValuesSection";
import { EventsSection } from "@/components/home/EventsSection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { Footer } from "@/components/home/Footer";
import { SessionDebug } from "@/components/debug/session-debug";
import { motion } from "framer-motion";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { LoginButton } from "@/components/auth/login-button";

function InactivityNotification() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Vérifier si l'utilisateur a été déconnecté pour inactivité
    const inactivity = searchParams.get("inactivity");
    if (inactivity === "true") {
      // Afficher un message professionnel
      toast.warning("Session expirée", {
        description: "Vous avez été déconnecté automatiquement après 15 minutes d'inactivité pour des raisons de sécurité. Veuillez vous reconnecter pour continuer.",
        duration: 10000,
        icon: <AlertCircle className="h-5 w-5" />,
        action: {
          label: "Se connecter",
          onClick: () => {
            router.push("/?openLogin=true");
          }
        }
      });

      // Nettoyer l'URL en retirant le paramètre
      const newUrl = window.location.pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router]);

  return null;
}

function AutoOpenLoginModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [shouldOpen, setShouldOpen] = useState(false);

  useEffect(() => {
    const openLogin = searchParams.get("openLogin");
    const inactivity = searchParams.get("inactivity");
    
    if (openLogin === "true") {
      setShouldOpen(true);
      
      // Si c'est une déconnexion pour inactivité, afficher aussi un toast informatif
      if (inactivity === "true") {
        toast.warning("Session expirée", {
          description: "Vous avez été déconnecté automatiquement après 15 minutes d'inactivité pour des raisons de sécurité.",
          duration: 8000,
          icon: <AlertCircle className="h-5 w-5" />,
        });
      }
      
      // Nettoyer l'URL en retirant les paramètres
      const newUrl = window.location.pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (shouldOpen) {
      // Ouvrir le modal après un court délai pour s'assurer que le composant est monté
      const timer = setTimeout(() => {
        const trigger = document.querySelector('[data-auto-open-login]') as HTMLElement;
        if (trigger) {
          trigger.click();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [shouldOpen]);

  if (!shouldOpen) return null;

  return (
    <LoginButton mode="modal">
      <button 
        type="button" 
        data-auto-open-login
        style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}
      />
    </LoginButton>
  );
}

export default function Home() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 relative overflow-hidden">
      {/* Background decorative elements - plus subtils */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400/8 dark:bg-blue-600/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-indigo-400/8 dark:bg-indigo-600/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-400/8 dark:bg-purple-600/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>
      
      <div className="relative z-10">
        <Suspense fallback={null}>
          <InactivityNotification />
          <AutoOpenLoginModal />
        </Suspense>
        
        <DynamicNavbar />
        
        {/* Hero Section with decorative frame */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <Hero />
        </motion.div>
        
      
        
        {/* About Section */}
        <AboutSection />
        
        {/* Values Section */}
        <ValuesSection />
        
        {/* Events Section */}
        <EventsSection />
        
        {/* Testimonials Section */}
        <TestimonialsSection />
        
        {/* Newsletter Section */}
        <NewsletterSection />
        
        {/* Footer */}
        <Footer />
        
        {/* Debug Session (seulement en développement) */}
        <SessionDebug />
      </div>
    </div>
  );
}
