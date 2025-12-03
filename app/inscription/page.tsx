"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Users, 
  Calendar, 
  Briefcase, 
  Home, 
  Users2, 
  FileText, 
  CheckCircle, 
  ArrowRight,
  Shield,
  Heart,
  Network,
  Sparkles
} from "lucide-react";
import { Conditions } from "@/components/conditions";
import { StatuAmaki } from "@/components/statuamaki";
import { RegisterFormEmbedded } from "@/components/auth/register-form-embedded";
import { motion } from "framer-motion";

export default function InscriptionPage() {
  const [showConditions, setShowConditions] = useState(false);
  const [showStatut, setShowStatut] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="relative max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-6"
          >
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-sm font-medium text-blue-700 dark:text-blue-300">
              <Sparkles className="h-4 w-4 mr-2" />
              Rejoignez notre communauté
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white">
              Rejoignez la Communauté des Anciens Élèves de Kipaku en France
              <span className="block text-blue-600 dark:text-blue-400 mt-2">
                Ouverte à Tous
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Bienvenue dans notre application officielle dédiée aux anciens élèves de Kipaku installés en France.
              Notre objectif : <strong className="text-gray-900 dark:text-white">Intégration, respect, solidarité, rassembler, connecter, entraider</strong> et favoriser le partage d'opportunités au sein d'un réseau dynamique et bienveillant.
            </p>

            <p className="text-base sm:text-lg text-gray-700 dark:text-gray-400 max-w-2xl mx-auto">
              Que vous soyez ancien élève, ami de Kipaku, professionnel, parent ou simplement intéressé par la communauté, <strong className="text-blue-600 dark:text-blue-400">vous êtes le bienvenu</strong>.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Rejoindre notre plateforme, c'est accéder à :
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: Users,
                title: "Une communauté active et solidaire",
                description: "Connectez-vous avec d'autres membres et partagez vos expériences",
              },
              {
                icon: Briefcase,
                title: "Des annonces",
                description: "Emploi, logement, entraide, événements - tout au même endroit",
              },
              {
                icon: Users2,
                title: "Un annuaire de membres",
                description: "Trouvez et contactez facilement d'autres membres de la communauté",
              },
              {
                icon: FileText,
                title: "Des groupes thématiques",
                description: "Rejoignez des groupes selon vos centres d'intérêt",
              },
              {
                icon: Shield,
                title: "Des ressources exclusives",
                description: "Accédez à du contenu réservé aux membres et aux actualités",
              },
              {
                icon: Network,
                title: "Des opportunités de networking",
                description: "En France et ailleurs, développez votre réseau professionnel",
              },
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <benefit.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <CardTitle className="text-lg">{benefit.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Conditions Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="border-blue-200 dark:border-blue-800 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Shield className="h-6 w-6" />
                  Conditions d'adhésion
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <p className="text-gray-700 dark:text-gray-300">
                  Pour garantir un espace sécurisé et agréable, tout membre s'engage à :
                </p>
                <ul className="space-y-2">
                  {[
                    "Fournir des informations exactes lors de l'inscription",
                    "Respecter les autres membres et les règles de courtoisie",
                    "Ne pas diffuser de contenu offensant, frauduleux ou illégal",
                    "Ne pas utiliser la plateforme à des fins commerciales abusives",
                    "Signaler tout comportement inapproprié",
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    L'accès est ouvert :
                  </p>
                  <ul className="space-y-1">
                    {[
                      "aux anciens élèves de Kipaku",
                      "aux sympathisants de Kipaku",
                      "à toute personne souhaitant rejoindre et respecter notre communauté",
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="text-blue-600 dark:text-blue-400 mr-1">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowConditions(true)}
                    className="flex-1 border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/30"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Conditions complètes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowStatut(true)}
                    className="flex-1 border-blue-300 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/30"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Notre statut
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Formulaire d'inscription */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="space-y-8"
          >
            <div className="text-center space-y-4">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                Créez votre compte maintenant
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Remplissez le formulaire ci-dessous pour rejoindre notre communauté
              </p>
              <div className="flex flex-wrap justify-center gap-6 pt-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Gratuit et sans engagement
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Modifiable à tout moment
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Communauté bienveillante
                </div>
              </div>
            </div>

            {/* Formulaire d'inscription intégré */}
            <div className="flex justify-center">
              <div className="w-full max-w-[600px]">
                <RegisterFormEmbedded />
              </div>
            </div>

            {/* Lien vers la connexion */}
            <div className="text-center pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Vous avez déjà un compte ?
              </p>
              <Link href="/auth/sign-in">
                <Button variant="outline" size="lg" className="text-base px-6 py-3">
                  Se connecter
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Dialogs */}
      <Conditions open={showConditions} onOpenChange={setShowConditions} />
      <StatuAmaki open={showStatut} onOpenChange={setShowStatut} />
    </div>
  );
}

