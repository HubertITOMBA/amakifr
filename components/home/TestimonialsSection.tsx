"use client";

import { Star, Quote } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

export function TestimonialsSection() {
  const testimonials = [
    {
      id: 1,
      name: "Billy KAMBA",
      role: "Ingénieure Logiciel",
      company: "Amaki Savigny",
      graduation: "Promotion 2015",
      image: "/images/testimonial1.jpg",
      content: "L'AMAKI m'a permis de développer mon réseau professionnel et de trouver des opportunités incroyables. L'entraide entre les membres est exceptionnelle.",
      rating: 5
    },
    {
      id: 2,
      name: "Bavueza Tongi Simon",
      role: "Entrepreneur",
      company: "TechStart 91",
      graduation: "Promotion 2012",
      image: "/images/testimonial2.jpg",
      content: "Grâce aux conférences et ateliers de l'AMAKI, j'ai pu lancer ma startup avec succès. Les conseils des anciens élèves ont été déterminants.",
      rating: 5
    },
    {
      id: 3,
      name: "Miss Ekote Henriette",
      role: "Médecin",
      company: "Hôpital Central",
      graduation: "Promotion 2018",
      image: "/images/testimonial3.jpg",
      content: "L'AMAKI m'a aidée à financer mes études de médecine grâce à leur programme de bourses. Aujourd'hui, je peux aider d'autres jeunes à leur tour.",
      rating: 5
    },
    {
      id: 4,
      name: "Miss Muilu",
      role: "Directeur Marketing",
      company: "Orange 77",
      graduation: "Promotion 2010",
      image: "/images/testimonial4.jpg",
      content: "Les valeurs de solidarité et d'excellence de l'AMAKI m'ont accompagné tout au long de ma carrière. C'est une famille pour la vie.",
      rating: 5
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50 dark:from-slate-800 dark:via-slate-850 dark:to-slate-900 relative overflow-hidden">
      {/* Decorative background elements - opacité réduite */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-300/8 dark:bg-indigo-600/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-300/8 dark:bg-blue-600/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
      
      {/* Top decorative border - plus subtil */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400/30 dark:via-indigo-600/15 via-blue-400/30 dark:via-blue-600/15 to-transparent opacity-40" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with frame */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative mb-16"
        >
          {/* Decorative corners - couleurs plus douces */}
          <div className="absolute -top-4 -left-4 w-16 h-16 border-t-4 border-l-4 border-indigo-400/40 dark:border-indigo-600/25 rounded-tl-2xl opacity-50" />
          <div className="absolute -top-4 -right-4 w-16 h-16 border-t-4 border-r-4 border-blue-400/40 dark:border-blue-600/25 rounded-tr-2xl opacity-50" />
          
          <div className="relative bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm rounded-3xl p-8 md:p-12">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-indigo-50/20 to-blue-50/20 dark:from-slate-900/40 dark:via-indigo-950/15 dark:to-blue-950/15 rounded-3xl" />
            <div className="relative z-10 text-center">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 dark:from-indigo-400 dark:via-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                Témoignages de Nos Membres
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Découvrez les histoires de réussite de nos anciens élèves et comment 
                l'AMAKI a contribué à leur parcours professionnel et personnel.
              </p>
            </div>
          </div>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="relative"
            >
              {/* Gradient border wrapper - plus subtil */}
              <div className="p-1 bg-gradient-to-br from-indigo-400/50 via-blue-500/50 to-cyan-500/50 dark:from-indigo-900/30 dark:via-blue-900/30 dark:to-cyan-900/30 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-3">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 relative">
              {/* Icône de citation */}
              <div className="absolute top-6 right-6">
                <Quote className="h-8 w-8 text-blue-500 opacity-20" />
              </div>
              
              {/* Étoiles de notation */}
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              
              {/* Contenu du témoignage */}
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>
              
              {/* Informations sur la personne */}
              <div className="flex items-center">
                <div className="relative h-12 w-12 rounded-full overflow-hidden mr-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {testimonial.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {testimonial.role} chez {testimonial.company}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {testimonial.graduation}
                  </p>
                </div>
              </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Section statistiques */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 relative"
        >
          {/* Decorative corners - couleurs plus douces */}
          <div className="absolute -top-4 -left-4 w-20 h-20 border-t-4 border-l-4 border-green-400/40 dark:border-green-600/25 rounded-tl-3xl opacity-50" />
          <div className="absolute -top-4 -right-4 w-20 h-20 border-t-4 border-r-4 border-emerald-400/40 dark:border-emerald-600/25 rounded-tr-3xl opacity-50" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 border-b-4 border-l-4 border-teal-400/40 dark:border-teal-600/25 rounded-bl-3xl opacity-50" />
          <div className="absolute -bottom-4 -right-4 w-20 h-20 border-b-4 border-r-4 border-cyan-400/40 dark:border-cyan-600/25 rounded-br-3xl opacity-50" />
          
          {/* Gradient border wrapper - plus subtil */}
          <div className="p-1 bg-gradient-to-r from-green-400/50 via-emerald-500/50 to-teal-500/50 dark:from-green-900/30 dark:via-emerald-900/30 dark:to-teal-900/30 rounded-3xl shadow-2xl">
            <div className="bg-gradient-to-br from-white via-green-50/40 to-emerald-50/40 dark:from-slate-800 dark:via-green-950/15 dark:to-emerald-950/15 rounded-3xl p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-green-50/20 to-emerald-50/20 dark:from-slate-800/60 dark:via-green-950/10 dark:to-emerald-950/10 rounded-3xl" />
              <div className="relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
                  <div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">95%</div>
                    <p className="text-gray-600 dark:text-gray-400">Satisfaction des membres</p>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">85%</div>
                    <p className="text-gray-600 dark:text-gray-400">Taux de réussite professionnelle</p>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">70%</div>
                    <p className="text-gray-600 dark:text-gray-400">Membres qui ont trouvé un emploi</p>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">60%</div>
                    <p className="text-gray-600 dark:text-gray-400">Membres entrepreneurs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Bottom decorative border */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400/30 dark:via-blue-600/15 via-indigo-400/30 dark:via-indigo-600/15 to-transparent opacity-40" />
    </section>
  );
}

