import Image from "next/image";
import Link from "next/link";
import HeroImage from "@/public/images/amakifav.jpeg";
import { RegisterButton } from "../auth/register-button";
import { LoginButton } from "../auth/login-button";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Calendar, Award, LogIn } from "lucide-react";

export function Hero() {
  // Année de création de l'association (utilisée pour afficher un compteur dynamique)
  const anneeCreation = 2011;
  const anneesExistence = Math.max(1, new Date().getFullYear() - anneeCreation);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background avec dégradé - plus doux en mode sombre */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-700/90 via-indigo-800/90 to-slate-900 dark:from-slate-900 dark:via-indigo-950/80 dark:to-slate-950" />
      
      {/* Éléments décoratifs - opacité réduite */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/10 dark:bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-400/10 dark:bg-indigo-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-400/10 dark:bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Contenu principal */}
          <div className="text-white space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-lg rounded-full text-sm font-medium">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
                Communauté Active
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
                Bienvenue à 
                <span className="block bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-300 dark:from-amber-400/80 dark:via-yellow-400/80 dark:to-orange-400/80 text-transparent bg-clip-text">
                  AMA<span className="bg-gradient-to-r from-orange-400 via-red-500 to-orange-500 dark:from-orange-500 dark:via-red-600 dark:to-orange-600 text-transparent bg-clip-text drop-shadow-[0_0_8px_rgba(239,68,68,0.9)] dark:drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] font-extrabold">K</span>I France
                </span>
              </h1>
              
              <p className="text-xl lg:text-2xl text-blue-50 dark:text-slate-300 leading-relaxed">
                L'Amicale des Anciens Élèves de Kipaku 
                <span className="block font-semibold text-white">
                  Unis et guidés par l'intégration, le respect, la solidarité, l'excellence et l'entraide ...
                </span>
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <RegisterButton mode="modal">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8 py-4 rounded-xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-1">
                  Rejoindre AMAKI
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </RegisterButton>
              
              <LoginButton mode="modal">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="border-2 border-white text-white bg-white/10 hover:bg-white hover:text-blue-700 font-semibold px-8 py-4 rounded-xl backdrop-blur-lg transition-all duration-300 shadow-lg"
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  Se connecter
                </Button>
              </LoginButton>
              
              <Link href="/evenements">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="border-2 border-white text-white bg-white/10 hover:bg-white hover:text-blue-700 font-semibold px-8 py-4 rounded-xl backdrop-blur-lg transition-all duration-300 shadow-lg"
                >
                  Nos Événements
                </Button>
              </Link>
            </div>
            
            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-8 pt-8">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-lg mx-auto mb-2">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">50+</div>
                <div className="text-sm text-blue-100 dark:text-slate-400">Membres Actifs</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-lg mx-auto mb-2">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">{anneesExistence}+</div>
                <div className="text-sm text-blue-100 dark:text-slate-400">Années d'Existence</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-lg mx-auto mb-2">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">53+</div>
                <div className="text-sm text-blue-100 dark:text-slate-400">Événements</div>
              </div>
            </div>
          </div>
          
          {/* Image hero */}
          <div className="relative">
            <div className="relative">
              {/* Cercle décoratif */}
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 to-indigo-600/20 dark:from-blue-600/10 dark:to-indigo-700/10 rounded-full blur-2xl opacity-30 animate-pulse" />
              
              {/* Image principale */}
              <div className="relative bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl">
                <Image
                  src={HeroImage}
                  alt="Logo AMAKI"
                  className="w-full h-auto rounded-2xl shadow-xl"
                />
                
                {/* Badge flottant */}
                <div className="absolute -top-4 -right-4 bg-gradient-to-r from-amber-400/90 to-orange-400/90 dark:from-amber-500/70 dark:to-orange-500/70 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg backdrop-blur-sm">
                  Depuis {anneeCreation}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white/60 animate-bounce">
        <div className="flex flex-col items-center">
          <span className="text-sm mb-2">Découvrez plus</span>
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/60 rounded-full mt-2 animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  );
}
