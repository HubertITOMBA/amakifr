"use client";

import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Phone
} from "lucide-react";
import Image from "next/image";

// Données pour les objectifs
const objectives = [
  {
    id: 1,
    title: "Intégration",
    description: "Faciliter l'intégration des anciens élèves de Kipako en France",
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
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-8">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 shadow-2xl">
              <Users className="h-16 w-16 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white drop-shadow-lg">
            L'Amicale AMAKI
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-purple-100">
            Qui sommes-nous et quels sont nos objectifs
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Users className="h-5 w-5 mr-2" />
              Communauté
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Target className="h-5 w-5 mr-2" />
              Objectifs
            </Badge>
          </div>
        </div>
      </section>

      {/* Section Qui sommes-nous */}
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Qui Sommes-Nous ?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              L'Amicale des Anciens Élèves de Kipako en France (AMAKI France) est une association 
              à but non lucratif créée en 2016 pour rassembler et accompagner les anciens élèves 
              de l'École de Kipako établis en France.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                120+ Membres
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Anciens élèves actifs dans toute la France
              </p>
            </Card>

            <Card className="text-center p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full">
                  <Calendar className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                8 Ans d'Existence
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Depuis notre création en 2016
              </p>
            </Card>

            <Card className="text-center p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded-full">
                  <MapPin className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Présence Nationale
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Membres dans toutes les régions de France
              </p>
            </Card>

            <Card className="text-center p-6 hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-orange-100 dark:bg-orange-900 rounded-full">
                  <Award className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                50+ Événements
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Organisés depuis notre création
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Section Nos Objectifs */}
      <section className="py-16 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Nos Objectifs
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Nos trois piliers fondamentaux qui guident toutes nos actions
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {objectives.map((objective) => {
              const colorClass = colorClasses[objective.color as keyof typeof colorClasses];
              const IconComponent = objective.icon;

              return (
                <Card key={objective.id} className="p-8 hover:shadow-xl transition-all duration-300">
                  <div className="text-center mb-6">
                    <div className={`inline-flex p-4 rounded-full ${colorClass.bg} mb-4`}>
                      <IconComponent className={`h-8 w-8 ${colorClass.text}`} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                      {objective.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                      {objective.description}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {objective.details.map((detail, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-600 dark:text-gray-300 text-sm">
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
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Nos Valeurs
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Les principes qui nous guident dans toutes nos actions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => {
              const colorClass = colorClasses[value.color as keyof typeof colorClasses];
              const IconComponent = value.icon;

              return (
                <Card key={index} className="p-6 text-center hover:shadow-xl transition-all duration-300">
                  <div className={`inline-flex p-3 rounded-full ${colorClass.bg} mb-4`}>
                    <IconComponent className={`h-6 w-6 ${colorClass.text}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">
                    {value.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section Notre Histoire */}
      <section className="py-16 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Notre Histoire
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Les étapes importantes de notre développement
            </p>
          </div>

          <div className="space-y-8">
            {achievements.map((achievement, index) => (
              <Card key={index} className="p-6 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {achievement.year}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {achievement.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {achievement.description}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Star className="h-6 w-6 text-yellow-500" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Section Contact */}
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Rejoignez-Nous
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Vous êtes un ancien élève de Kipako ? Rejoignez notre communauté et participez à nos activités
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="p-6 text-center hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Email
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                contact@amaki.fr
              </p>
              <Button variant="outline" className="w-full">
                <Mail className="h-4 w-4 mr-2" />
                Nous écrire
              </Button>
            </Card>

            <Card className="p-6 text-center hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full">
                  <Phone className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Téléphone
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                +33 6 XX XX XX XX
              </p>
              <Button variant="outline" className="w-full">
                <Phone className="h-4 w-4 mr-2" />
                Nous appeler
              </Button>
            </Card>

            <Card className="p-6 text-center hover:shadow-xl transition-all duration-300">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-purple-100 dark:bg-purple-900 rounded-full">
                  <MapPin className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Adresse
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                119 rue des Grands Champs<br />
                77000 Lieusaint
              </p>
              <Button variant="outline" className="w-full">
                <MapPin className="h-4 w-4 mr-2" />
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
