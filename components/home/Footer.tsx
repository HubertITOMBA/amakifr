import Image from "next/image";
import Link from "next/link";
import { Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram } from "lucide-react";

export function Footer() {
  const quickLinks = [
    { name: "Accueil", href: "/" },
    { name: "L'Amicale", href: "/amicale" },
    { name: "Événements", href: "/evenements" },
    { name: "Agenda", href: "/agenda" },
    { name: "Contact", href: "/contact" }
  ];

  const resources = [
    { name: "Devenir Membre", href: "/membership" },
    { name: "Bourses d'Études", href: "/scholarships" },
    { name: "Mentorat", href: "/mentoring" },
    { name: "Réseau Professionnel", href: "/network" },
    { name: "Archives", href: "/archives" }
  ];

  const socialLinks = [
    { name: "Facebook", icon: Facebook, href: "#" },
    { name: "Twitter", icon: Twitter, href: "#" },
    { name: "LinkedIn", icon: Linkedin, href: "#" },
    { name: "Instagram", icon: Instagram, href: "#" }
  ];

  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo et description */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-6">
              {/* <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">A</span>
              </div> */}
              <h3 className="text-2xl font-bold">
                Ama<span className="text-red-500">K</span>i France
              </h3>
            </Link>
            <p className="text-gray-300 mb-6 leading-relaxed">
              L'Amicale des Anciens Élèves de Kipako, 
              unie par l'intégration, le respect, la solidarité, 
              l'excellence et l'entraide pour construire l'avenir ensemble.
            </p>
            <div className="flex space-x-4">
              {socialLinks.map((social) => (
                <Link
                  key={social.name}
                  href={social.href}
                  className="p-2 bg-slate-800 rounded-lg hover:bg-blue-600 transition-colors duration-300"
                >
                  <social.icon className="h-5 w-5" />
                </Link>
              ))}
            </div>
          </div>
          
          {/* Liens rapides */}
          <div>
            <h4 className="text-lg font-semibold mb-6">Navigation</h4>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-gray-300 hover:text-white transition-colors duration-300"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Ressources */}
          <div>
            <h4 className="text-lg font-semibold mb-6">Ressources</h4>
            <ul className="space-y-3">
              {resources.map((resource) => (
                <li key={resource.name}>
                  <Link
                    href={resource.href}
                    className="text-gray-300 hover:text-white transition-colors duration-300"
                  >
                    {resource.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Contact */}
          <div>
            <h4 className="text-lg font-semibold mb-6">Contact</h4>
            <div className="space-y-4">
              <div className="flex items-start">
                <Mail className="h-5 w-5 text-blue-400 mr-3 mt-1" />
                <div>
                  <p className="text-gray-300">contact@amaki.fr</p>
                  <p className="text-sm text-gray-400">Email principal</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <Phone className="h-5 w-5 text-blue-400 mr-3 mt-1" />
                <div>
                  <p className="text-gray-300">+06 XX XX XX XX</p>
                  <p className="text-sm text-gray-400">Téléphone</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <MapPin className="h-5 w-5 text-blue-400 mr-3 mt-1" />
                <div>
                  <p className="text-gray-300">119 rue des Grands Champs, 77000 Lieusaint</p>
                  <p className="text-sm text-gray-400">Siège social</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Ligne de séparation */}
        <div className="border-t border-slate-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm">
               AMAKI France- Amicale des Anciens Élèves de Kipako en France © 2026 Tous droits réservés.
            </div>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/privacy" className="text-gray-400 hover:text-white text-sm transition-colors duration-300">
                Politique de Confidentialité
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-white text-sm transition-colors duration-300">
                Conditions d'Utilisation
              </Link>
              <Link href="/cookies" className="text-gray-400 hover:text-white text-sm transition-colors duration-300">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

