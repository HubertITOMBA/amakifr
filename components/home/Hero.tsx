import Image from "next/image";
import Link from "next/link";
import HeroImage from "@/public/images/logoAmaki.jpeg";
import { LoginButton } from "../auth/login-button";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Calendar, Award } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background avec dégradé */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800" />
      
      {/* Éléments décoratifs */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-500" />
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
                <span className="block bg-gradient-to-r from-yellow-400 to-orange-500 text-transparent bg-clip-text">
                  AMAKI France
                </span>
              </h1>
              
              <p className="text-xl lg:text-2xl text-blue-100 leading-relaxed">
                L'Amicale des Anciens Élèves de Kipako - 
                <span className="block font-semibold text-white">
                  Unis par l'excellence, guidés par la solidarité, l'intégation, le respect ...
                </span>
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <LoginButton>
                <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8 py-4 rounded-xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-1">
                  Rejoindre l'AMAKI
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </LoginButton>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="border-2 border-white/30 text-white hover:bg-white/10 font-semibold px-8 py-4 rounded-xl backdrop-blur-lg transition-all duration-300"
              >
                Découvrir nos Événements
              </Button>
            </div>
            
            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-8 pt-8">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-lg mx-auto mb-2">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">500+</div>
                <div className="text-sm text-blue-200">Membres Actifs</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-lg mx-auto mb-2">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">10+</div>
                <div className="text-sm text-blue-200">Années d'Existence</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-lg mx-auto mb-2">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">50+</div>
                <div className="text-sm text-blue-200">Événements</div>
              </div>
            </div>
          </div>
          
          {/* Image hero */}
          <div className="relative">
            <div className="relative">
              {/* Cercle décoratif */}
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-2xl opacity-30 animate-pulse" />
              
              {/* Image principale */}
              <div className="relative bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl">
                <Image
                  src={HeroImage}
                  alt="Logo AMAKI"
                  className="w-full h-auto rounded-2xl shadow-xl"
                />
                
                {/* Badge flottant */}
                <div className="absolute -top-4 -right-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg">
                  Depuis 2016
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
