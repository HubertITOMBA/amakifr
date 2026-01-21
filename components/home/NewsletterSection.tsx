"use client";

import { Mail, Send, CheckCircle, Users, Calendar, MessageCircle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function NewsletterSection() {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-700/95 via-indigo-800/95 to-slate-900 dark:from-slate-900 dark:via-indigo-950/90 dark:to-slate-950 relative overflow-hidden">
      {/* Decorative background elements - opacité réduite */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/8 dark:bg-white/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/8 dark:bg-white/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
      
      {/* Top decorative border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Frame wrapper */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative"
        >
          {/* Decorative corners */}
          <div className="absolute -top-6 -left-6 w-24 h-24 border-t-4 border-l-4 border-white/40 rounded-tl-3xl" />
          <div className="absolute -top-6 -right-6 w-24 h-24 border-t-4 border-r-4 border-white/40 rounded-tr-3xl" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 border-b-4 border-l-4 border-white/40 rounded-bl-3xl" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 border-b-4 border-r-4 border-white/40 rounded-br-3xl" />
          
          <div className="relative bg-white/10 backdrop-blur-lg rounded-3xl p-8 md:p-12 border-2 border-white/20 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Contenu principal */}
          <div className="text-white">
            <h2 className="text-4xl font-bold mb-6">
              Restez Connecté avec AMAKI France
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Recevez nos dernières actualités, invitations aux événements et 
              opportunités de networking directement dans votre boîte mail.
            </p>
            
            {/* Formulaire d'inscription */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      placeholder="Votre adresse email"
                      className="w-full pl-10 pr-4 py-3 rounded-lg border-0 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-white/50 focus:outline-none"
                    />
                  </div>
                </div>
                <button className="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-300 flex items-center justify-center">
                  <Send className="h-5 w-5 mr-2" />
                  S'abonner
                </button>
              </div>
              
              {/* Avantages de l'inscription */}
              <div className="space-y-3">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                  <span className="opacity-90">Invitations exclusives aux événements</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                  <span className="opacity-90">Opportunités de networking</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                  <span className="opacity-90">Actualités de l'association</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                  <span className="opacity-90">Conseils professionnels</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Section contact et réseaux sociaux */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-6">
              Contactez-Nous
            </h3>
            
            <div className="space-y-6">
              {/* Informations de contact */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="p-2 bg-white/20 rounded-lg mr-4">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Email</p>
                    <p className="text-white/80">asso.amaki@gmail.com</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="p-2 bg-white/20 rounded-lg mr-4">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">WhatsApp</p>
                    <p className="text-white/80">+33 7 58 43 47 58</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="p-2 bg-white/20 rounded-lg mr-4">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">119 rue des Grands Champs</p>
                    <p className="text-white/80">77127 Lieusaint</p>
                  </div>
                </div>
              </div>
              
              {/* Réseaux sociaux */}
              <div className="pt-6 border-t border-white/20">
                <p className="text-white font-semibold mb-4">Suivez-nous</p>
                <div className="flex space-x-4">
                  <button className="p-3 bg-white/20 rounded-lg hover:bg-white/30 transition-colors duration-300">
                    <span className="text-white font-semibold">FB</span>
                  </button>
                  <button className="p-3 bg-white/20 rounded-lg hover:bg-white/30 transition-colors duration-300">
                    <span className="text-white font-semibold">TW</span>
                  </button>
                  <button className="p-3 bg-white/20 rounded-lg hover:bg-white/30 transition-colors duration-300">
                    <span className="text-white font-semibold">LI</span>
                  </button>
                  <button className="p-3 bg-white/20 rounded-lg hover:bg-white/30 transition-colors duration-300">
                    <span className="text-white font-semibold">IG</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Bottom decorative border */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
    </section>
  );
}

