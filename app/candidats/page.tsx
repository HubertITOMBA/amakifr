"use client";

import { useState } from "react";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Bell, 
  MapPin,
  Info
} from "lucide-react";
import { PositionType } from "@prisma/client";
import { POSTES_LABELS } from "@/lib/elections-constants";

// Données statiques des candidats (seront remplacées par les données de la base plus tard)
const STATIC_CANDIDATES = [
  {
    position: PositionType.President,
    candidates: [
      { civility: "Monsieur", firstname: "Simon", lastname: "BAVUEZA TONGI" }
    ]
  },
  {
    position: PositionType.VicePresident,
    candidates: [
      { civility: "Mademoiselle", firstname: "Thaty", lastname: "BISUBULA" },
      { civility: "Monsieur", firstname: "Simon", lastname: "BAVUEZA TONGI" }
    ]
  },
  {
    position: PositionType.Secretaire,
    candidates: [
      { civility: "Monsieur", firstname: "Hubert", lastname: "ITOMBA" },
      { civility: "Monsieur", firstname: "Augustin", lastname: "MAYANGI Chata" }
    ]
  },
  {
    position: PositionType.ViceSecretaire,
    candidates: [] // Aucun candidat
  },
  {
    position: PositionType.Tresorier,
    candidates: [
      { civility: "Monsieur", firstname: "Jimmy", lastname: "DIMONEKENE" },
      { civility: "Monsieur", firstname: "Saintho", lastname: "MANKENDA" }
    ]
  },
  {
    position: PositionType.ViceTresorier,
    candidates: [
      { civility: "Monsieur", firstname: "Saintho", lastname: "MANKENDA" },
      { civility: "Monsieur", firstname: "Dominique", lastname: "BENGA" }
    ]
  },
  {
    position: PositionType.CommissaireComptes,
    candidates: [
      { civility: "Monsieur", firstname: "Hubert", lastname: "ITOMBA" },
      { civility: "Monsieur", firstname: "Saintho", lastname: "MANKENDA" }
    ]
  },
  {
    position: PositionType.MembreComiteDirecteur,
    candidates: [
      { civility: "Monsieur", firstname: "Hubert", lastname: "ITOMBA" },
      { civility: "Monsieur", firstname: "Simon", lastname: "BAVUEZA TONGI" },
      { civility: "Mademoiselle", firstname: "Marie", lastname: "MUILU" },
      { civility: "Monsieur", firstname: "Jimmy", lastname: "DIMONEKENE" }
    ]
  }
];

export default function CandidatsPage() {
  const getCivilityLabel = (civility: string) => {
    switch (civility) {
      case "Monsieur":
        return "M.";
      case "Madame":
        return "Mme";
      case "Mademoiselle":
        return "Miss";
      default:
        return civility;
    }
  };

  const electionDate = "29 novembre 2025";
  const dateClotureCandidatures = "15/11/2025 à 20h30";
  const dateClotureCampagne = "28/11/2025 à 20h30";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-16 sm:py-20 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-indigo-500/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-white/30 backdrop-blur-sm rounded-full p-4 sm:p-6 shadow-2xl">
              <Bell className="h-12 w-12 sm:h-16 sm:w-16 text-white" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-white drop-shadow-lg">
            🔔 Élections Amaki France – {electionDate} 🇨🇩🇨🇩🇨🇩
          </h1>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {/* Message d'introduction */}
            <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30">
              <CardContent className="p-6 sm:p-8">
                <p className="text-base sm:text-lg text-gray-800 dark:text-gray-200 leading-relaxed mb-4">
                  <strong>Chers membres d'Amaki France,</strong>
                </p>
                <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                  Nous avons le plaisir de vous présenter la liste officielle des candidats retenus pour les élections du {electionDate}.
                </p>
                <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                  Nous rappelons que la clôture des candidatures est intervenue le {dateClotureCandidatures}, et que la campagne électorale se déroule jusqu'au {dateClotureCampagne}.
                </p>
              </CardContent>
            </Card>

            {/* Informations importantes */}
            <Card className="border-2 border-yellow-200 dark:border-yellow-800 shadow-lg bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30">
              <CardHeader className="bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/50 dark:to-amber-900/50 border-b-2 border-yellow-200 dark:border-yellow-800">
                <CardTitle className="text-xl sm:text-2xl text-yellow-900 dark:text-yellow-100 flex items-center gap-3">
                  <Info className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600 dark:text-yellow-400" />
                  📌 Information importante
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                <p className="text-base sm:text-lg text-yellow-800 dark:text-yellow-200">
                  M. Papy MBAMBI a retiré toutes ses candidatures et ne participe donc plus au processus électoral.
                </p>
              </CardContent>
            </Card>

            {/* Liste des candidats par poste */}
            <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-lg bg-white dark:bg-slate-800">
              <CardHeader className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 border-b-2 border-blue-200 dark:border-blue-800">
                <CardTitle className="text-2xl sm:text-3xl text-blue-900 dark:text-blue-100 font-bold">
                  Liste des candidats
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 sm:p-8">
                <div className="space-y-8">
                  {STATIC_CANDIDATES.map((group) => {
                    const posteLabel = POSTES_LABELS[group.position] || group.position;
                    
                    return (
                      <div key={group.position} className="space-y-4">
                        <div className="flex items-center gap-3 pb-2 border-b-2 border-blue-200 dark:border-blue-800">
                          <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <h3 className="text-xl sm:text-2xl font-bold text-blue-900 dark:text-blue-100">
                            📍 {posteLabel}
                          </h3>
                        </div>
                        
                        {group.candidates.length === 0 ? (
                          <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 pl-8">
                            Aucun candidat
                          </p>
                        ) : (
                          <div className="space-y-3 pl-8">
                            {group.candidates.map((candidate, index) => {
                              const civility = getCivilityLabel(candidate.civility);
                              const fullName = `${candidate.firstname} ${candidate.lastname}`;
                              
                              return (
                                <div key={`${group.position}-${index}`} className="flex items-start gap-3">
                                  <div className="flex-1">
                                    <p className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                                      {civility && <span className="mr-2">{civility}</span>}
                                      {fullName}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Message de conclusion */}
            <Card className="border-2 border-green-200 dark:border-green-800 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30">
              <CardContent className="p-6 sm:p-8 text-center">
                <p className="text-base sm:text-lg text-gray-800 dark:text-gray-200 leading-relaxed mb-4">
                  Nous souhaitons à tous les candidats une excellente campagne et invitons chaque membre à participer activement à ce moment important de la vie de notre association.
                </p>
                <p className="text-lg sm:text-xl font-bold text-green-800 dark:text-green-200 mt-6">
                  Ensemble pour une Amaki France forte et dynamique ! 💙🤝🇫🇷🇨🇩🇨🇩🇨🇩
                </p>
                <p className="text-base sm:text-lg text-green-700 dark:text-green-300 mt-2">
                  Integration - Respect - Solidarité 🇫🇷🇨🇩🇨🇩🇨🇩
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
