"use client";

import { useState, useEffect } from "react";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, Users, Vote, Award, CheckCircle, Trophy } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function EvenementsPage() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  
  // S'assurer que le composant est monté côté client pour éviter les problèmes d'hydratation
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Vérifier que l'utilisateur est authentifié
  // On attend que le composant soit monté et que le statut soit déterminé
  const isAuthenticated = mounted && status === "authenticated" && !!session?.user && !!session.user.id;
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 dark:from-slate-800 dark:to-slate-700">
      <DynamicNavbar />
      
      {/* Hero Section - Élections en avant */}
      <section className="relative py-24 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-indigo-500/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-8">
            <div className="bg-white/30 backdrop-blur-sm rounded-full p-6 shadow-2xl">
              <Vote className="h-16 w-16 text-white" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-white drop-shadow-lg">
            ÉLECTIONS 2026
          </h1>
          <p className="text-2xl md:text-3xl mb-8 text-blue-100 font-semibold">
            Renouvellement du Bureau - 29 Novembre 2025
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Badge variant="secondary" className="bg-white/30 text-white border-white/40 text-xl px-8 py-4 font-semibold">
              <Calendar className="h-6 w-6 mr-3" />
              29 Novembre 2025
            </Badge>
            <Badge variant="secondary" className="bg-white/30 text-white border-white/40 text-xl px-8 py-4 font-semibold">
              <Users className="h-6 w-6 mr-3" />
              Tous les membres
            </Badge>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 max-w-4xl mx-auto">
            <p className="text-lg text-white font-medium">
              <strong>Événement majeur :</strong> Pour la première fois, nous élirons également les membres du comité directeur. 
              Votre participation est essentielle pour l'avenir de notre association.
            </p> 
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Informations principales */}
            <div className="lg:col-span-2 space-y-8">
              {/* Carte d'information principale - ÉLECTIONS */}
              <Card className="border-4 border-blue-300 dark:border-blue-700 shadow-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30">
                <CardHeader className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-800/50 dark:to-indigo-800/50 border-b-2 border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-full shadow-lg">
                      <Award className="h-10 w-10 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-3xl text-blue-900 dark:text-blue-100 font-bold">
                        🗳️ ÉLECTIONS DU BUREAU
                      </CardTitle>
                      <CardDescription className="text-xl text-blue-700 dark:text-blue-300 font-semibold">
                        Renouvellement des postes de direction - Événement majeur
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="flex items-start gap-3">
                        <Calendar className="h-6 w-6 text-blue-600 mt-1" />
                        <div>
                          <h3 className="font-semibold text-lg mb-2">Date des élections</h3>
                          <p className="text-gray-600 dark:text-gray-300">
                            Vendredi 29 Novembre 2025 - Assemblée Générale
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin className="h-6 w-6 text-blue-600 mt-1" />
                        <div>
                          <h3 className="font-semibold text-lg mb-2">Lieu</h3>
                          <p className="text-gray-600 dark:text-gray-300">
                            77124 VILLENOY
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h3 className="font-semibold text-lg mb-4 text-blue-900 dark:text-blue-100">
                        Postes à pourvoir
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span>Président(e) + Vice-Président(e)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span>Secrétaire + Vice-Secrétaire</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span>Trésorier(ère) + Vice-Trésorier(ère)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span>Commissaire aux comptes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span>Membres du Comité Directeur</span>
                        </div>
                      </div>
                      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <strong>Nouveauté :</strong> Pour la première fois, nous élirons également les membres du comité directeur.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Critères du candidat à la présidence */}
              <Card className="shadow-lg border-2 border-green-200 dark:border-green-800">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/50 dark:to-emerald-900/50">
                  <CardTitle className="text-2xl text-green-900 dark:text-green-100 flex items-center gap-3">
                    <Award className="h-8 w-8 text-green-600" />
                    Profil Type du Candidat à la Présidence
                  </CardTitle>
                  <CardDescription className="text-lg text-green-700 dark:text-green-300">
                    Critères et qualités recherchées pour notre futur président
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
                      <h3 className="font-semibold text-lg mb-4 text-green-900 dark:text-green-100">
                        Qualités Essentielles
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-1" />
                          <span className="text-sm">Motivation et implication active</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-1" />
                          <span className="text-sm">Volonté d'assumer les responsabilités</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-1" />
                          <span className="text-sm">Honnêteté et transparence</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-1" />
                          <span className="text-sm">Respect des valeurs de l'association</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-1" />
                          <span className="text-sm">Aptitude à écouter et gérer les conflits</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-1" />
                          <span className="text-sm">Rigueur et capacité de planification</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-1" />
                          <span className="text-sm">Capacité à inspirer et fédérer</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-1" />
                          <span className="text-sm">Être à jour des cotisations</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h3 className="font-semibold text-lg mb-4 text-blue-900 dark:text-blue-100">
                        Présentation du Projet
                      </h3>
                      <p className="text-blue-800 dark:text-blue-200">
                        Chaque candidat aura l'opportunité de présenter son projet avant le scrutin. 
                        Cette présentation est essentielle pour permettre aux membres de faire un choix éclairé.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Processus électoral */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-3">
                    <Vote className="h-8 w-8 text-indigo-600" />
                    Processus Électoral
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="bg-indigo-100 dark:bg-indigo-900/50 rounded-full p-3 flex-shrink-0">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">1</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2">Candidatures</h3>
                        <p className="text-gray-600 dark:text-gray-300">
                          Dépôt des candidatures selon le calendrier établi. Chaque candidat doit présenter son programme et ses motivations.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="bg-indigo-100 dark:bg-indigo-900/50 rounded-full p-3 flex-shrink-0">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">2</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2">Campagne</h3>
                        <p className="text-gray-600 dark:text-gray-300">
                          Période de campagne électorale avec présentation des candidats et débats.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="bg-indigo-100 dark:bg-indigo-900/50 rounded-full p-3 flex-shrink-0">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">3</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2">Vote</h3>
                        <p className="text-gray-600 dark:text-gray-300">
                          Vote secret lors de l'Assemblée Générale. Chaque membre dispose d'une voix par poste.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="bg-indigo-100 dark:bg-indigo-900/50 rounded-full p-3 flex-shrink-0">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">4</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2">Proclamation</h3>
                        <p className="text-gray-600 dark:text-gray-300">
                          Dépouillement et proclamation des résultats en présence de tous les membres.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 
              ================================================
              Bouton pour afficher les résultats des élections 
              ================================================
              */}
              {/* <Card className="border-2 border-blue-500 shadow-xl bg-gradient-to-r from-blue-50 via-white to-red-50 dark:from-blue-900/20 dark:via-slate-800 dark:to-red-900/20">
                <CardContent className="p-8 text-center">
                  <div className="space-y-6">
                    <div className="flex justify-center">
                      <div className="bg-gradient-to-r from-blue-600 via-white to-red-600 p-4 rounded-full shadow-lg">
                        <Trophy className="h-12 w-12 text-yellow-500" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        🏆 Résultats des Élections Disponibles
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 mb-6">
                        Découvrez les résultats officiels des élections et rencontrez vos nouveaux dirigeants élus
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Link href="/resultats">
                        <Button className="bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 text-white px-8 py-4 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg">
                          <Trophy className="h-5 w-5 mr-2" />
                          Voir les Résultats
                        </Button>
                      </Link>
                      <Button variant="outline" className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20 px-8 py-4 rounded-lg font-semibold transition-all duration-300">
                        <Award className="h-5 w-5 mr-2" />
                        Féliciter les Élus
                      </Button>
                    </div>
                    <div className="flex justify-center items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Résultats officiels validés</span>
                    </div>
                  </div>
                </CardContent>
              </Card> */}

            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Carte d'action rapide - ÉLECTIONS - Visible uniquement pour les utilisateurs connectés */}
              {isAuthenticated && (
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
                  <CardHeader>
                    <CardTitle className="text-xl text-green-800 dark:text-green-200">
                      Participez !
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Link href="/candidatures" className="block">
                      <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                        <Users className="h-4 w-4 mr-2" />
                        Devenir Candidat
                      </Button>
                    </Link>
                    <Link href="/candidats" className="block">
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                        <Award className="h-4 w-4 mr-2" />
                        Voir les Candidats
                      </Button>
                    </Link>
                    <Button variant="outline" className="w-full border-green-600 text-green-600 hover:bg-green-50">
                      <Vote className="h-4 w-4 mr-2" />
                      Voter
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Informations importantes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Informations Importantes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-blue-600 mt-1" />
                    <div>
                      <h4 className="font-semibold">Date d'élection</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        29 Novembre 2025
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Award className="h-5 w-5 text-blue-600 mt-1" />
                    <div>
                      <h4 className="font-semibold">Entrée en fonction</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Janvier 2026
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-600 mt-1" />
                    <div>
                      <h4 className="font-semibold">Passation de pouvoir</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Lors de la réunion de décembre 2025
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Message du Secrétaire */}
              <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
                <CardHeader>
                  <CardTitle className="text-xl text-indigo-800 dark:text-indigo-200">
                    Message du Secrétaire
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-white/50 dark:bg-white/10 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 italic mb-3">
                      "Merci de votre attention et de votre engagement envers notre association."
                    </p>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">
                        Hubert ITOMBA
                      </p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">
                        Secrétaire - Amaki en France
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full border-indigo-600 text-indigo-600 hover:bg-indigo-50">
                    Nous Contacter
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action - ÉLECTIONS */}
      <section className="py-20 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white drop-shadow-lg">
              🗳️ VOTRE VOIX COMPTE !
            </h2>
            <p className="text-xl md:text-2xl mb-8 text-blue-100 font-semibold">
              Participez activement à la vie démocratique de votre amicale. 
              Chaque vote compte pour construire l'avenir ensemble.
            </p>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 mb-8">
              <p className="text-lg text-white font-medium">
                <strong>Date importante :</strong> 29 Novembre 2025 - Ne manquez pas ce moment historique !
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 text-xl px-8 py-4 font-bold shadow-xl">
                <Vote className="h-6 w-6 mr-3" />
                Participer aux Élections
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 text-xl px-8 py-4 font-bold">
                <Calendar className="h-6 w-6 mr-3" />
                Ajouter au Calendrier
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
