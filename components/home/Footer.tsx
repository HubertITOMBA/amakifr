"use client";

import Image from "next/image";
import Link from "next/link";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Facebook, 
  Twitter, 
  Linkedin, 
  Instagram,
  Heart,
  Users,
  Calendar,
  Award,
  ArrowRight,
  Sparkles,
  Globe,
  Shield
} from "lucide-react";
import { motion } from "framer-motion";
import { QRCodeShare } from "@/components/shared/QRCodeShare";

// Composant pour mettre en évidence une lettre dans le texte
function HighlightedText({ text, highlightIndex }: { text: string; highlightIndex: number }) {
  return (
    <>
      {text.split('').map((char, index) => {
        if (char === ' ') {
          return <span key={index}> </span>;
        }
        if (index === highlightIndex) {
          return (
            <span 
              key={index} 
              className="text-red-500 text-4xl font-bold inline-block transition-all duration-300"
            >
              {char}
            </span>
          );
        }
        return <span key={index}>{char}</span>;
      })}
    </>
  );
}

export function Footer() {
  // Année de création de l'association (utilisée pour afficher un compteur dynamique)
  const anneeCreation = 2011;
  const anneesExistence = Math.max(1, new Date().getFullYear() - anneeCreation);
  const anneeCourante = new Date().getFullYear();

  const quickLinks = [
    { name: "Accueil", href: "/", icon: Heart },
    { name: "L'Amicale", href: "/amicale", icon: Users },
    { name: "Événements", href: "/evenements", icon: Calendar },
    { name: "Agenda", href: "/agenda", icon: Calendar },
    { name: "Contact", href: "/contact", icon: Mail }
  ];

  const resources = [
    { name: "Devenir Membre", href: "/inscription" },
    { name: "Bourses d'Études", href: "/scholarships" },
    { name: "Mentorat", href: "/mentoring" },
    { name: "Réseau Professionnel", href: "/network" },
    { name: "Archives", href: "/archives" }
  ];

  const socialLinks = [
    { name: "Facebook", icon: Facebook, href: "#", color: "hover:bg-blue-600" },
    { name: "Twitter", icon: Twitter, href: "#", color: "hover:bg-sky-500" },
    { name: "LinkedIn", icon: Linkedin, href: "#", color: "hover:bg-blue-700" },
    { name: "Instagram", icon: Instagram, href: "#", color: "hover:bg-pink-600" }
  ];

  const stats = [
    { label: "Membres Actifs", value: "150+", icon: Users },
    { label: "Événements", value: "25+", icon: Calendar },
    { label: "Pays", value: "3", icon: Globe },
    { label: "Années", value: `${anneesExistence}+`, icon: Award }
  ];

  return (
    <footer className="relative bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 text-white overflow-hidden">
      {/* Background animé */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section principale */}
        <div className="py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Logo et description - Prend plus d'espace */}
            <div className="lg:col-span-5">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <Link href="/" className="flex items-center gap-3 mb-8 group">
                  <div className="relative">
                    <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <span className="text-white font-bold text-xl">A</span>
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-pink-500 to-red-500 rounded-full animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                      <HighlightedText text="AMAKI France" highlightIndex={3} />
                    </h3>
                    <p className="text-sm text-purple-200">Association Reconnue d'Intérêt Général</p>
                  </div>
                </Link>
                
                <p className="text-gray-300 mb-8 leading-relaxed text-lg">
                  L'Amicale des Anciens Élèves de Kipaku, 
                  unie par l'intégration, le respect, la solidarité, 
                  la diversité, l'excellence et l'entraide pour construire l'avenir ensemble.
                </p>

                {/* Statistiques */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {stats.map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg">
                          <stat.icon className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="text-xl font-bold text-white">{stat.value}</div>
                          <div className="text-xs text-gray-400">{stat.label}</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* QR Code et Partage */}
                <div className="mb-8">
                  <p className="text-sm font-medium text-gray-300 mb-3">Partager l'application</p>
                  <QRCodeShare />
                </div>

                {/* Réseaux sociaux */}
                <div className="flex space-x-3">
                  {socialLinks.map((social, index) => (
                    <motion.div
                      key={social.name}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <Link
                        href={social.href}
                        className={`p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 ${social.color} transition-all duration-300 hover:scale-110 hover:shadow-lg`}
                      >
                        <social.icon className="h-5 w-5" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Navigation */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true }}
              >
                <h4 className="text-xl font-bold mb-8 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  Navigation
                </h4>
                <ul className="space-y-4">
                  {quickLinks.map((link, index) => (
                    <motion.li
                      key={link.name}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <Link
                        href={link.href}
                        className="flex items-center gap-3 text-gray-300 hover:text-white transition-all duration-300 group"
                      >
                        <link.icon className="h-4 w-4 text-purple-400 group-hover:text-purple-300" />
                        <span className="group-hover:translate-x-1 transition-transform duration-300">
                          {link.name}
                        </span>
                        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Ressources */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                viewport={{ once: true }}
              >
                <h4 className="text-xl font-bold mb-8 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-400" />
                  Ressources
                </h4>
                <ul className="space-y-4">
                  {resources.map((resource, index) => (
                    <motion.li
                      key={resource.name}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <Link
                        href={resource.href}
                        className="text-gray-300 hover:text-white transition-all duration-300 hover:translate-x-1 block"
                      >
                        {resource.name}
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Contact */}
            <div className="lg:col-span-3">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                viewport={{ once: true }}
              >
                <h4 className="text-xl font-bold mb-8 flex items-center gap-2">
                  <Mail className="h-5 w-5 text-green-400" />
                  Contact
                </h4>
                <div className="space-y-6">
                  <div className="flex items-start gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg">
                      <Mail className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">asso.amaki@gmail.com</p>
                      <p className="text-sm text-gray-400">Email principal</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300">
                    <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg">
                      <Phone className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">+33 7 51 06 62 64</p>
                      <p className="text-sm text-gray-400">Téléphone</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300">
                    <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">119 rue des Grands Champs</p>
                      <p className="text-sm text-gray-400">77000 Lieusaint, France</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
        
        {/* Section de séparation avec gradient */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent h-px" />
        </div>
        
        {/* Footer bottom */}
        <div className="py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-gray-400 text-sm text-center md:text-left"
            >
              <p className="mb-2">
                <span className="font-semibold text-white">
                  <HighlightedText text="AMAKI France" highlightIndex={3} />
                </span> - Amicale des Anciens Élèves de Kipaku en France
              </p>
              <p>© {anneeCourante} Tous droits réservés. Fait avec ❤️ pour notre communauté.</p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="flex flex-wrap justify-center md:justify-end gap-6"
            >
              <Link href="/confidentialite" className="text-gray-400 hover:text-white text-sm transition-colors duration-300 hover:underline">
                Politique de Confidentialité
              </Link>
              <Link href="/suppression-donnees" className="text-gray-400 hover:text-white text-sm transition-colors duration-300 hover:underline">
                Suppression des Données
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </footer>
  );
}

