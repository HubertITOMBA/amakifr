"use client";

import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { NewsletterSection } from "@/components/home/NewsletterSection";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  MessageCircle, 
  Users, 
  Send,
  CheckCircle,
  Facebook,
  Twitter,
  Linkedin,
  Instagram
} from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-8">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 shadow-2xl">
              <MessageCircle className="h-16 w-16 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white drop-shadow-lg">
            Contactez-Nous
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-purple-100">
            Restez connecté avec AMAKI France et rejoignez notre communauté
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Mail className="h-5 w-5 mr-2" />
              Newsletter
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Users className="h-5 w-5 mr-2" />
              Communauté
            </Badge>
          </div>
        </div>
      </section>

      {/* Section Newsletter et Contact */}
      <NewsletterSection />

      {/* Section Informations Supplémentaires */}
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Informations Pratiques
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Retrouvez toutes les informations nécessaires pour nous contacter et participer à nos activités
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Horaires */}
            <Card className="p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg mr-4">
                  <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Horaires
                </h3>
              </div>
              <div className="space-y-2 text-gray-600 dark:text-gray-300">
                <p><strong>Lundi - Vendredi:</strong> 9h00 - 18h00</p>
                <p><strong>Samedi:</strong> 10h00 - 16h00</p>
                <p><strong>Dimanche:</strong> Fermé</p>
              </div>
            </Card>

            {/* Téléphones */}
            <Card className="p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg mr-4">
                  <Phone className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Téléphones
                </h3>
              </div>
              <div className="space-y-3 text-gray-600 dark:text-gray-300">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">+33 7 58 43 47 58</p>
                  <p className="text-sm">Contact association</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">+33 7 51 06 62 64</p>
                  <p className="text-sm">Admin / Webmaster</p>
                </div>
              </div>
            </Card>

            {/* Réactivité */}
            <Card className="p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg mr-4">
                  <Send className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Réactivité
                </h3>
              </div>
              <div className="space-y-2 text-gray-600 dark:text-gray-300">
                <p><strong>Email:</strong> Réponse sous 24h</p>
                <p><strong>WhatsApp:</strong> Réponse immédiate</p>
                <p><strong>Urgences:</strong> Contact direct</p>
              </div>
            </Card>

            {/* Événements */}
            <Card className="p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg mr-4">
                  <Users className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Événements
                </h3>
              </div>
              <div className="space-y-2 text-gray-600 dark:text-gray-300">
                <p><strong>Réunions:</strong> 1er samedi du mois</p>
                <p><strong>Événements:</strong> Tous les mois</p>
                <p><strong>Formations:</strong> Sur demande</p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Section Réseaux Sociaux */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Suivez-Nous sur les Réseaux Sociaux
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Restez informé de nos dernières actualités et événements
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Card className="p-6 text-center hover:shadow-xl transition-all duration-300 cursor-pointer group">
              <div className="flex flex-col items-center">
                <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                  <Facebook className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Facebook
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Actualités et événements
                </p>
              </div>
            </Card>

            <Card className="p-6 text-center hover:shadow-xl transition-all duration-300 cursor-pointer group">
              <div className="flex flex-col items-center">
                <div className="p-4 bg-sky-100 dark:bg-sky-900 rounded-full mb-4 group-hover:bg-sky-200 dark:group-hover:bg-sky-800 transition-colors">
                  <Twitter className="h-8 w-8 text-sky-600 dark:text-sky-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Twitter
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  News et discussions
                </p>
              </div>
            </Card>

            <Card className="p-6 text-center hover:shadow-xl transition-all duration-300 cursor-pointer group">
              <div className="flex flex-col items-center">
                <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                  <Linkedin className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  LinkedIn
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Networking professionnel
                </p>
              </div>
            </Card>

            <Card className="p-6 text-center hover:shadow-xl transition-all duration-300 cursor-pointer group">
              <div className="flex flex-col items-center">
                <div className="p-4 bg-pink-100 dark:bg-pink-900 rounded-full mb-4 group-hover:bg-pink-200 dark:group-hover:bg-pink-800 transition-colors">
                  <Instagram className="h-8 w-8 text-pink-600 dark:text-pink-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Instagram
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Photos et moments
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
