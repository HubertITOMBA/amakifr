"use client";

import { Hero } from "@/components/home/Hero";
import Emblacarousel from "@/components/home/Home-carousel";
import { Navbar } from "@/components/home/Navbar";
import { AboutSection } from "@/components/home/AboutSection";
import { ValuesSection } from "@/components/home/ValuesSection";
import { EventsSection } from "@/components/home/EventsSection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { Footer } from "@/components/home/Footer";
import { SessionDebug } from "@/components/debug/session-debug";
import { motion } from "framer-motion";

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
        <Navbar />
        
        {/* Hero Section with decorative frame */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <Hero />
        </motion.div>
        
        {/* Carousel Section with decorative frame */}
        <section className="py-20 relative">
          {/* Decorative frame elements */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white dark:via-slate-900/50 dark:to-slate-900" />
          
          {/* Top decorative border */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400/40 dark:via-blue-600/20 to-transparent opacity-30" />
          
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Frame wrapper with decorative border */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              {/* Decorative corner elements - couleurs plus subtiles */}
              <div className="absolute -top-4 -left-4 w-20 h-20 border-t-4 border-l-4 border-blue-400/30 dark:border-blue-600/20 rounded-tl-3xl opacity-50" />
              <div className="absolute -top-4 -right-4 w-20 h-20 border-t-4 border-r-4 border-indigo-400/30 dark:border-indigo-600/20 rounded-tr-3xl opacity-50" />
              <div className="absolute -bottom-4 -left-4 w-20 h-20 border-b-4 border-l-4 border-purple-400/30 dark:border-purple-600/20 rounded-bl-3xl opacity-50" />
              <div className="absolute -bottom-4 -right-4 w-20 h-20 border-b-4 border-r-4 border-pink-400/30 dark:border-pink-600/20 rounded-br-3xl opacity-50" />
              
              {/* Content with frame border - gradient wrapper plus subtil */}
              <div className="p-1 bg-gradient-to-r from-blue-200/50 via-indigo-200/50 to-purple-200/50 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 rounded-3xl">
                <div className="relative bg-white/80 dark:bg-slate-900/90 backdrop-blur-lg rounded-3xl p-8 md:p-12 shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-indigo-50/30 to-purple-50/30 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 rounded-3xl" />
                  <div className="relative z-10">
                    <Emblacarousel />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
          
          {/* Bottom decorative border */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400/40 dark:via-indigo-600/20 to-transparent opacity-30" />
        </section>
        
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
