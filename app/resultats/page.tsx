"use client";

import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Crown, 
  Award, 
  Users, 
  Calendar, 
  MapPin, 
  CheckCircle,
  Star,
  Trophy,
  Shield,
  Heart,
  Sparkles
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function ResultatsElectionsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />

      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-blue-600 via-white to-red-600 text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute top-32 right-20 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000" />
          <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-2000" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-8">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 shadow-2xl">
              <Trophy className="h-16 w-16 text-white" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white drop-shadow-lg">
            Résultats des Élections
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-blue-100">
            Découvrez les nouveaux dirigeants de notre association
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Calendar className="h-5 w-5 mr-2" />
              Élections 2024
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Users className="h-5 w-5 mr-2" />
              Nouveau Bureau
            </Badge>
          </div>
        </div>
      </section>

      {/* Section Président */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-3 rounded-full text-lg font-semibold mb-6">
              <Crown className="h-6 w-6" />
              Président Élu
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Notre Nouveau Président
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Félicitations à notre nouveau président qui dirigera notre association avec sagesse et détermination
            </p>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            {/* Image du Président */}
            <div className="flex-1 max-w-md w-full">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl blur-lg opacity-30" />
                <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
                  <div className="relative rounded-xl overflow-hidden">
                    <Image
                      src="/ressources/President.jpeg"
                      alt="Président élu"
                      width={400}
                      height={400}
                      className="w-full h-auto object-cover"
                      priority
                    />
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                      <div className="bg-yellow-500 text-white p-1.5 sm:p-2 rounded-full">
                        <Crown className="h-4 w-4 sm:h-6 sm:w-6" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Informations du Président */}
            <div className="flex-1 space-y-6">
              <Card className="border-2 border-yellow-200 dark:border-yellow-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Star className="h-6 w-6 text-yellow-500" />
                    Président Élu
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 p-6 rounded-lg">
                    <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Le président élu
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                      Nous sommes fiers de présenter notre nouveau président, élu démocratiquement par les membres de notre association. 
                      Sa vision et son engagement seront les piliers de notre développement futur.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Élu démocratiquement</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-blue-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Mandat de 2 ans</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Heart className="h-5 w-5 text-red-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Engagement total</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Vision innovante</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Section Vice-Président */}
      <section className="py-20 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-full text-lg font-semibold mb-6">
              <Award className="h-6 w-6" />
              Vice-Président Élu
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Notre Nouveau Vice-Président
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Un partenaire de confiance pour accompagner notre président dans la gestion de l'association
            </p>
          </div>

          <div className="flex flex-col lg:flex-row-reverse items-center gap-8 lg:gap-12">
            {/* Image du Vice-Président */}
            <div className="flex-1 max-w-md w-full">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-2xl blur-lg opacity-30" />
                <div className="relative bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl">
                  <div className="relative rounded-xl overflow-hidden">
                    <Image
                      src="/ressources/Vice.jpeg"
                      alt="Vice-Président élu"
                      width={400}
                      height={400}
                      className="w-full h-auto object-cover"
                      priority
                    />
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                      <div className="bg-blue-500 text-white p-1.5 sm:p-2 rounded-full">
                        <Award className="h-4 w-4 sm:h-6 sm:w-6" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Informations du Vice-Président */}
            <div className="flex-1 space-y-6">
              <Card className="border-2 border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <Award className="h-6 w-6 text-blue-500" />
                    Vice-Président Élu
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-lg">
                    <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Le vice-président élu
                    </p>
                    <p className="text-gray-600 dark:text-gray-300">
                      Notre nouveau vice-président apporte son expertise et son dévouement pour soutenir 
                      notre président dans la réalisation de nos objectifs communs.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Soutien au président</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-blue-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Représentation</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Heart className="h-5 w-5 text-red-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Engagement</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Innovation</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Section Statistiques */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Statistiques des Élections
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Un aperçu des résultats de nos élections démocratiques
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center p-8 border-2 border-green-200 dark:border-green-800">
              <div className="bg-green-100 dark:bg-green-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">85%</h3>
              <p className="text-gray-600 dark:text-gray-300">Participation</p>
            </Card>

            <Card className="text-center p-8 border-2 border-blue-200 dark:border-blue-800">
              <div className="bg-blue-100 dark:bg-blue-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">100%</h3>
              <p className="text-gray-600 dark:text-gray-300">Transparence</p>
            </Card>

            <Card className="text-center p-8 border-2 border-purple-200 dark:border-purple-800">
              <div className="bg-purple-100 dark:bg-purple-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">2</h3>
              <p className="text-gray-600 dark:text-gray-300">Nouveaux Dirigeants</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Section CTA */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Félicitations à nos Nouveaux Dirigeants !
          </h2>
          <p className="text-xl mb-8 text-indigo-100">
            Nous sommes confiants que cette nouvelle équipe dirigera notre association vers un avenir brillant
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/evenements">
              <Button size="lg" className="bg-white text-indigo-600 hover:bg-gray-100 px-8 py-4">
                Voir nos Événements
              </Button>
            </Link>
            <Link href="/amicale">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-4">
                Découvrir l'Association
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
