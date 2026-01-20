"use client";

import Image from "next/image";
import { Users, Calendar, Heart, Award, Handshake, Shield, Users2 } from "lucide-react";
import { motion } from "framer-motion";

export function AboutSection() {
  // Année de création de l'association (utilisée pour afficher un compteur dynamique)
  // Ex: si création en 2011 et année courante 2026 => 15 ans
  const anneeCreation = 2011;
  const anneesExistence = Math.max(1, new Date().getFullYear() - anneeCreation);

  return (
    <section className="py-20 bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden">
      {/* Decorative background elements - opacité réduite */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-0 w-64 h-64 bg-blue-300/8 dark:bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-purple-300/8 dark:bg-purple-600/5 rounded-full blur-3xl" />
      </div>
      
      {/* Top decorative border - plus subtil */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400/30 dark:via-blue-600/15 via-purple-400/30 dark:via-purple-600/15 to-transparent opacity-40" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Frame wrapper */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative"
        >
          {/* Decorative corners - couleurs plus douces */}
          <div className="absolute -top-6 -left-6 w-24 h-24 border-t-4 border-l-4 border-blue-400/40 dark:border-blue-600/25 rounded-tl-3xl opacity-60" />
          <div className="absolute -top-6 -right-6 w-24 h-24 border-t-4 border-r-4 border-indigo-400/40 dark:border-indigo-600/25 rounded-tr-3xl opacity-60" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 border-b-4 border-l-4 border-purple-400/40 dark:border-purple-600/25 rounded-bl-3xl opacity-60" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 border-b-4 border-r-4 border-pink-400/40 dark:border-pink-600/25 rounded-br-3xl opacity-60" />
          
          {/* Main content with decorative frame - gradient wrapper plus subtil */}
          <div className="p-1 bg-gradient-to-r from-blue-200/40 via-indigo-200/40 to-purple-200/40 dark:from-blue-900/25 dark:via-indigo-900/25 dark:to-purple-900/25 rounded-3xl shadow-2xl">
            <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-3xl p-8 md:p-12 lg:p-16">
              <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-blue-50/30 to-indigo-50/30 dark:from-slate-900/80 dark:via-blue-950/25 dark:to-indigo-950/25 rounded-3xl" />
            
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Contenu texte */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
                L'Amicale des Anciens Élèves de Kipaku en France
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Depuis sa création, AMAKI rassemble les anciens élèves de Kipaku 
                autour de valeurs communes : l'intégration, le respect, la solidarité, l'excellence et l'entraide.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">75+</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Membres actifs</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{anneesExistence}+</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Années d'existence</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Heart className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">50+</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Événements organisés</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <Award className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">100%</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Satisfaction</p>
                </div>
              </div>
            </div>
            
            <div className="pt-6">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                Notre mission est de maintenir les liens d'amitié entre les anciens élèves, 
                promouvoir l'excellence académique et professionnelle, et contribuer au 
                développement de notre communauté. Nous organisons régulièrement des 
                événements, des conférences et des actions caritatives.
              </p>
              
              <div className="space-y-3">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
                  Nos objectifs :
                </h4>
                <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 dark:text-blue-400 font-bold mt-1">•</span>
                    <span>Favoriser l'intégration des membres sur le territoire français</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 dark:text-blue-400 font-bold mt-1">•</span>
                    <span>Renforcer les liens d'amitié et de solidarité entre ses membres</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 dark:text-blue-400 font-bold mt-1">•</span>
                    <span>Apporter un soutien mutuel, notamment aux personnes en difficulté</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 dark:text-blue-400 font-bold mt-1">•</span>
                    <span>Promouvoir l'insertion sociale et citoyenne des jeunes par des chantiers, formations, et partenariats Nord-Sud</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 dark:text-blue-400 font-bold mt-1">•</span>
                    <span>Accompagner les projets de retour volontaire au pays d'origine</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-blue-600 dark:text-blue-400 font-bold mt-1">•</span>
                    <span>Préserver et transmettre le patrimoine culturel et les valeurs d'origine aux enfants nés hors du pays</span>
                  </li>
                </ul>
              </div>
              
             
            </div>
          </motion.div>
          
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            {/* Decorative frame around image */}
            <div className="relative p-4 bg-gradient-to-br from-blue-100/60 via-indigo-100/60 to-purple-100/60 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 rounded-3xl shadow-2xl">
              {/* <div className="relative h-96 rounded-2xl overflow-hidden border-4 border-white/50 dark:border-slate-700/50">
                <Image
                  src="/images/logoAmakiOld.jpeg"
                  alt="Équipe AMAKI"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute bottom-6 left-6 text-white">
                  <h3 className="text-xl font-bold drop-shadow-lg">Notre Équipe</h3>
                  <p className="text-sm opacity-90 font-medium">Ensemble pour l'excellence</p>
                </div>
              </div> */}
              
              {/* Enhanced decorative elements - opacité réduite */}
              <div className="absolute -top-2 -right-2 w-16 h-16 bg-gradient-to-br from-blue-400/40 to-indigo-500/40 dark:from-blue-600/20 dark:to-indigo-600/20 rounded-full opacity-70 animate-pulse shadow-lg blur-sm" />
              <div className="absolute -bottom-2 -left-2 w-12 h-12 bg-gradient-to-br from-green-400/40 to-emerald-500/40 dark:from-green-600/20 dark:to-emerald-600/20 rounded-full opacity-70 animate-pulse delay-1000 shadow-lg blur-sm" />
              <div className="absolute top-1/2 -right-4 w-8 h-8 bg-gradient-to-br from-purple-400/40 to-pink-500/40 dark:from-purple-600/20 dark:to-pink-600/20 rounded-full opacity-60 animate-pulse delay-500 shadow-lg blur-sm" />
            </div>
          </motion.div>
            </div>
          </div>
        </div>
        </motion.div>
      </div>
      
      {/* Bottom decorative border */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400/30 dark:via-indigo-600/15 via-pink-400/30 dark:via-pink-600/15 to-transparent opacity-40" />
    </section>
  );
}