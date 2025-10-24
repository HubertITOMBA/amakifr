import Image from "next/image";
import { Users, Calendar, Heart, Award, Handshake, Shield, Users2 } from "lucide-react";

export function AboutSection() {
  return (
    <section className="py-20 bg-white dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Contenu texte */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
                L'Amicale des Anciens Élèves de Kipako en France
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Depuis sa création, AMAKI rassemble les anciens élèves de Kipako 
                autour de valeurs communes : la solidarité, l'intégration, l'excellence et l'entraide.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">500+</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Membres actifs</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">15+</p>
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
          </div>
          
          {/* Image */}
          <div className="relative">
            <div className="relative h-96 rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src="/images/logoAmaki.jpeg"
                alt="Équipe AMAKI"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute bottom-6 left-6 text-white">
                <h3 className="text-xl font-semibold">Notre Équipe</h3>
                <p className="text-sm opacity-90">Ensemble pour l'excellence</p>
              </div>
            </div>
            
            {/* Éléments décoratifs */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-500 rounded-full opacity-20 animate-pulse" />
            <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-green-500 rounded-full opacity-20 animate-pulse delay-1000" />
          </div>
        </div>
      </div>
    </section>
  );
}