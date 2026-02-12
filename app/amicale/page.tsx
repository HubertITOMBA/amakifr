"use client";

import { useState } from "react";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { ANNEE_CREATION } from "@/lib/constants/association";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatuAmaki } from "@/components/statuamaki";
import { Conditions } from "@/components/conditions";
import { 
  Users, 
  Target, 
  Heart, 
  Award, 
  Globe, 
  BookOpen,
  Handshake,
  Shield,
  Lightbulb,
  Star,
  CheckCircle,
  ArrowRight,
  Calendar,
  MapPin,
  Mail,
  Phone,
  FileText,
  Scale
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Données pour les objectifs
const objectives = [
  {
    id: 1,
    title: "Intégration",
    description: "Faciliter l'intégration des anciens élèves de Kipaku en France",
    icon: Handshake,
    color: "blue",
    details: [
      "Accompagnement dans les démarches administratives",
      "Orientation vers les services publics",
      "Mise en relation avec d'autres membres",
      "Soutien dans la recherche d'emploi"
    ]
  },
  {
    id: 2,
    title: "Respect",
    description: "Promouvoir les valeurs de respect et de solidarité",
    icon: Shield,
    color: "green",
    details: [
      "Respect mutuel entre tous les membres",
      "Solidarité envers les plus démunis",
      "Tolérance et ouverture d'esprit",
      "Égalité des chances pour tous"
    ]
  },
  {
    id: 3,
    title: "Entraide",
    description: "Développer l'esprit d'entraide et de coopération",
    icon: Heart,
    color: "purple",
    details: [
      "Soutien scolaire et professionnel",
      "Partage d'expériences et de connaissances",
      "Aide matérielle en cas de besoin",
      "Mentorat et accompagnement personnalisé"
    ]
  }
];

// Données pour les valeurs
const values = [
  {
    title: "Excellence Académique",
    description: "Promouvoir l'excellence dans l'éducation et la formation",
    icon: Award,
    color: "yellow"
  },
  {
    title: "Solidarité",
    description: "Renforcer les liens de solidarité entre les membres",
    icon: Heart,
    color: "red"
  },
  {
    title: "Développement",
    description: "Contribuer au développement de notre communauté",
    icon: Globe,
    color: "blue"
  },
  {
    title: "Innovation",
    description: "Encourager l'innovation et l'entrepreneuriat",
    icon: Lightbulb,
    color: "green"
  }
];

// Données pour les réalisations
const achievements = [
  {
    year: "2016",
    title: "Création de l'Association",
    description: "Fondation officielle d'AMAKI France"
  },
  {
    year: "2018",
    title: "Première Mission Humanitaire",
    description: "Retour au pays pour des actions de solidarité"
  },
  {
    year: "2020",
    title: "Programme de Mentorat",
    description: "Lancement du programme d'accompagnement des nouveaux membres"
  },
  {
    year: "2023",
    title: "Expansion Nationale",
    description: "Ouverture de nouvelles antennes dans toute la France"
  }
];

const colorClasses = {
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900",
    text: "text-blue-800 dark:text-blue-200",
    badge: "bg-blue-500"
  },
  green: {
    bg: "bg-green-100 dark:bg-green-900",
    text: "text-green-800 dark:text-green-200",
    badge: "bg-green-500"
  },
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900",
    text: "text-purple-800 dark:text-purple-200",
    badge: "bg-purple-500"
  },
  yellow: {
    bg: "bg-yellow-100 dark:bg-yellow-900",
    text: "text-yellow-800 dark:text-yellow-200",
    badge: "bg-yellow-500"
  },
  red: {
    bg: "bg-red-100 dark:bg-red-900",
    text: "text-red-800 dark:text-red-200",
    badge: "bg-red-500"
  }
};

export default function AmicalePage() {
  const [statuOpen, setStatuOpen] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  
  // Année de création de l'association (utilisée pour afficher un compteur dynamique)
  const anneeCreation = ANNEE_CREATION;
  const anneesExistence = Math.max(1, new Date().getFullYear() - anneeCreation);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      <StatuAmaki open={statuOpen} onOpenChange={setStatuOpen} />
      <Conditions open={conditionsOpen} onOpenChange={setConditionsOpen} />
      
      {/* Hero Section */}
      <section className="relative py-8 sm:py-12 md:py-16 lg:py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-4 sm:mb-6 md:mb-8">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-4 sm:p-5 md:p-6 shadow-2xl">
              <Users className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-3 sm:mb-4 md:mb-6 text-white drop-shadow-lg">
            AMA<span className="bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-400 text-transparent bg-clip-text drop-shadow-[0_0_12px_rgba(251,191,36,1)] font-extrabold">K</span>I  France
            
              
             
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl mb-4 sm:mb-6 md:mb-8 text-purple-100 px-4">
            Qui sommes-nous et quels sont nos objectifs
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 justify-center px-4">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs sm:text-sm md:text-base lg:text-lg px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 mr-1.5 sm:mr-2" />
              Communauté
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs sm:text-sm md:text-base lg:text-lg px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3">
              <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 mr-1.5 sm:mr-2" />
              Objectifs
            </Badge>
          </div>
        </div>
      </section>

      {/* Section Qui sommes-nous */}
      <section className="py-8 sm:py-12 md:py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-8 md:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
              Qui Sommes-Nous ?
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
              L'Amicale des Anciens Élèves de Kipaku en France (AMAKI France) est une association 
              à but non lucratif créée en {anneeCreation} pour rassembler et accompagner les anciens élèves 
              de l'École de Kipaku établis en France.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            <Card className="text-center p-4 sm:p-5 md:p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-3 sm:mb-4">
                <div className="p-3 sm:p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Users className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                50+ Membres
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                Anciens élèves actifs dans toute la France
              </p>
            </Card>

            <Card className="text-center p-4 sm:p-5 md:p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-3 sm:mb-4">
                <div className="p-3 sm:p-4 bg-green-100 dark:bg-green-900 rounded-full">
                  <Calendar className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {anneesExistence} Ans d'Existence
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                Depuis notre création en {anneeCreation}
              </p>
            </Card>

            <Card className="text-center p-4 sm:p-5 md:p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-3 sm:mb-4">
                <div className="p-3 sm:p-4 bg-purple-100 dark:bg-purple-900 rounded-full">
                  <MapPin className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Présence Nationale
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                Membres dans toutes les régions de France
              </p>
            </Card>

            <Card className="text-center p-4 sm:p-5 md:p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-3 sm:mb-4">
                <div className="p-3 sm:p-4 bg-orange-100 dark:bg-orange-900 rounded-full">
                  <Award className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                50+ Événements
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                Organisés depuis notre création
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Section Nos Objectifs */}
      <section className="py-8 sm:py-12 md:py-16 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-8 md:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
              Nos Objectifs
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
              Nos trois piliers fondamentaux qui guident toutes nos actions
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            {objectives.map((objective) => {
              const colorClass = colorClasses[objective.color as keyof typeof colorClasses];
              const IconComponent = objective.icon;

              return (
                <Card key={objective.id} className="p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all duration-300">
                  <div className="text-center mb-4 sm:mb-5 md:mb-6">
                    <div className={`inline-flex p-3 sm:p-4 rounded-full ${colorClass.bg} mb-3 sm:mb-4`}>
                      <IconComponent className={`h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 ${colorClass.text}`} />
                    </div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
                      {objective.title}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-4 sm:mb-5 md:mb-6">
                      {objective.description}
                    </p>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    {objective.details.map((detail, index) => (
                      <div key={index} className="flex items-start gap-2 sm:gap-3">
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                          {detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section Nos Valeurs */}
      <section className="py-8 sm:py-12 md:py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-8 md:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
              Nos Valeurs
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
              Les principes qui nous guident dans toutes nos actions
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
            {values.map((value, index) => {
              const colorClass = colorClasses[value.color as keyof typeof colorClasses];
              const IconComponent = value.icon;

              return (
                <Card key={index} className="p-4 sm:p-5 md:p-6 text-center hover:shadow-xl transition-all duration-300">
                  <div className={`inline-flex p-2.5 sm:p-3 rounded-full ${colorClass.bg} mb-3 sm:mb-4`}>
                    <IconComponent className={`h-5 w-5 sm:h-6 sm:w-6 ${colorClass.text}`} />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {value.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    {value.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section Notre Histoire */}
      <section className="py-8 sm:py-12 md:py-16 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-8 md:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
              Notre Histoire
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
              Les étapes importantes de notre développement
            </p>
          </div>

          <div className="space-y-4 sm:space-y-6 md:space-y-8">
            {achievements.map((achievement, index) => (
              <Card key={index} className="p-4 sm:p-5 md:p-6 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base md:text-lg">
                      {achievement.year}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                      {achievement.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                      {achievement.description}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Star className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Section Interview du Président */}
      <section className="py-8 sm:py-12 md:py-16 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-8 md:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
              Notre Président
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
              Découvrez l&apos;interview de notre nouveau président, élu le 29 novembre 2025
            </p>
          </div>
          <div className="flex justify-center">
            <Card className="p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-purple-500 max-w-md w-full group">
              <Link href="/amicale/president-interview" className="block">
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full group-hover:scale-110 transition-transform duration-300">
                      <Star className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                    </div>
                  </div>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                    Interview du Président
                  </h3>
                  <div className="mb-4">
                    <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300">
                      <Calendar className="h-3 w-3 mr-1" />
                      Élu le 29 novembre 2025
                    </Badge>
                  </div>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-4 sm:mb-6">
                    Monsieur Simon Bavueza Tongi
                  </p>
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Lire l&apos;interview
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* Section Informations Légales */}
      <section className="py-8 sm:py-12 md:py-16 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-8 md:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
              Informations Légales
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
              Consultez notre statut juridique et les conditions d&apos;adhésion à l&apos;association
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 max-w-3xl mx-auto">
            <Card className="p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-blue-500" onClick={() => setStatuOpen(true)}>
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                    <Scale className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                  Nos Statuts
                </h3>
                <div className="mb-4">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Validés et signés
                  </Badge>
                </div>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-4 sm:mb-6">
                  Consultez les statuts officiels de l'association AMAKI France, validés par les autorités le 29 novembre 2025
                </p>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <FileText className="h-4 w-4 mr-2" />
                  Consulter les statuts
                </Button>
              </div>
            </Card>

            <Card className="p-4 sm:p-6 md:p-8 hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-purple-500" onClick={() => setConditionsOpen(true)}>
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded-full">
                    <FileText className="h-8 w-8 sm:h-10 sm:w-10 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                  Conditions d'Adhésion
                </h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-4 sm:mb-6">
                  Découvrez les conditions et modalités pour rejoindre l'association
                </p>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Voir les conditions
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Section Contact */}
      <section className="py-8 sm:py-12 md:py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 sm:mb-8 md:mb-12">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
              Rejoignez-Nous
            </h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
              Vous êtes un ancien élève de Kipaku ? Rejoignez notre communauté et participez à nos activités
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <Card className="p-4 sm:p-5 md:p-6 text-center hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-3 sm:mb-4">
                <div className="p-3 sm:p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Mail className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Email
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-3 sm:mb-4">
                asso.amaki@gmail.com
              </p>
              <Button variant="outline" className="w-full text-xs sm:text-sm">
                <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Nous écrire
              </Button>
            </Card>

            <Card className="p-4 sm:p-5 md:p-6 text-center hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-3 sm:mb-4">
                <div className="p-3 sm:p-4 bg-green-100 dark:bg-green-900 rounded-full">
                  <Phone className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Téléphone
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-3 sm:mb-4">
                +33 7 58 43 47 58
              </p>
              <Button variant="outline" className="w-full text-xs sm:text-sm">
                <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Nous appeler
              </Button>
            </Card>

            <Card className="p-4 sm:p-5 md:p-6 text-center hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-3 sm:mb-4">
                <div className="p-3 sm:p-4 bg-purple-100 dark:bg-purple-900 rounded-full">
                  <MapPin className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Adresse
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-3 sm:mb-4">
                119 rue des Grands Champs<br />
                77000 Lieusaint
              </p>
              <Button variant="outline" className="w-full text-xs sm:text-sm">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Nous rendre visite
              </Button>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
