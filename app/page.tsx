import { Hero } from "@/components/home/Hero";
import Emblacarousel from "@/components/home/Home-carousel";
import { Navbar } from "@/components/home/Navbar";
import { AboutSection } from "@/components/home/AboutSection";
import { ValuesSection } from "@/components/home/ValuesSection";
import { EventsSection } from "@/components/home/EventsSection";
import { TestimonialsSection } from "@/components/home/TestimonialsSection";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { Footer } from "@/components/home/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      
      {/* Hero Section */}
      <Hero />
      
      {/* Carousel Section */}
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Emblacarousel />
        </div>
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
    </div>
  );
}
