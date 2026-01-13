"use client";

import { useState } from "react";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Bell, 
  MapPin,
  Info,
  Download,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { exportCandidatsToPDF, exportCandidatsToWord } from "@/lib/export-candidats";
import { PositionType } from "@prisma/client";
import { POSTES_LABELS } from "@/lib/elections-constants";

// Données statiques des candidats (seront importées dans la base par l'admin)
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

type CandidateKey = string;

export default function CandidatsPage() {
  // État pour stocker les candidats sélectionnés
  const [selectedCandidates, setSelectedCandidates] = useState<Set<CandidateKey>>(new Set());

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

  const handleCandidateToggle = (candidateKey: CandidateKey) => {
    setSelectedCandidates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(candidateKey)) {
        newSet.delete(candidateKey);
      } else {
        newSet.add(candidateKey);
      }
      return newSet;
    });
  };

  const electionDate = "29 novembre 2025";
  const dateClotureCandidatures = "15/11/2025 à 20h30";
  const dateClotureCampagne = "28/11/2025 à 20h30";

  const handleExportPDF = async () => {
    const promise = exportCandidatsToPDF(
      STATIC_CANDIDATES,
      electionDate,
      dateClotureCandidatures,
      dateClotureCampagne
    );

    toast.promise(promise, {
      loading: "Génération du PDF en cours...",
      success: "PDF généré avec succès !",
      error: "Erreur lors de la génération du PDF",
    });
  };

  const handleExportWord = async () => {
    const promise = exportCandidatsToWord(
      STATIC_CANDIDATES,
      electionDate,
      dateClotureCandidatures,
      dateClotureCampagne
    );

    toast.promise(promise, {
      loading: "Génération du document Word en cours...",
      success: "Document Word généré avec succès !",
      error: "Erreur lors de la génération du document Word",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      
      {/* Hero Section */}
      <section className="relative py-8 sm:py-10 bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-indigo-500/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-3">
            <div className="bg-white/30 backdrop-blur-sm rounded-full p-3 sm:p-4 shadow-2xl">
              <Bell className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 text-white drop-shadow-lg">
            🔔 Élections Amaki France – {electionDate} 🇨🇩🇨🇩🇨🇩
          </h1>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {/* Message d'introduction */}
            <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 !py-0">
              <CardContent className="p-4 sm:p-5">
                <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 leading-relaxed mb-2">
                  <strong>Chers membres d'Amaki France,</strong>
                </p>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                  Nous avons le plaisir de vous présenter la liste officielle des candidats retenus pour les élections du {electionDate}.
                </p>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed mt-2">
                  Nous rappelons que la clôture des candidatures est intervenue le {dateClotureCandidatures}, et que la campagne électorale se déroule jusqu'au {dateClotureCampagne}.
                </p>
              </CardContent>
            </Card>

            {/* Informations importantes */}
            <Card className="border-2 border-yellow-200 dark:border-yellow-800 shadow-lg bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 !py-0">
              <CardHeader className="bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/50 dark:to-amber-900/50 border-b-2 border-yellow-200 dark:border-yellow-800 py-3 px-4">
                <CardTitle className="text-lg sm:text-xl text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
                  <Info className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600 dark:text-yellow-400" />
                  📌 Information importante
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <p className="text-sm sm:text-base text-yellow-800 dark:text-yellow-200">
                  M. Papy MBAMBI a retiré toutes ses candidatures et ne participe donc plus au processus électoral.
                </p>
              </CardContent>
            </Card>

            {/* Liste des candidats par poste */}
            <Card className="border-2 border-blue-200 dark:border-blue-800 shadow-lg bg-white dark:bg-slate-800 !py-0">
              <CardHeader className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 border-b-2 border-blue-200 dark:border-blue-800 py-3 px-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-xl sm:text-2xl text-blue-900 dark:text-blue-100 font-bold">
                    Liste des candidats
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleExportPDF}
                      variant="outline"
                      size="sm"
                      className="bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                    <Button
                      onClick={handleExportWord}
                      variant="outline"
                      size="sm"
                      className="bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Word
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="space-y-4">
                  {STATIC_CANDIDATES.map((group) => {
                    const posteLabel = POSTES_LABELS[group.position] || group.position;
                    
                    return (
                      <div key={group.position} className="space-y-2">
                        <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 dark:from-blue-700 dark:via-blue-800 dark:to-indigo-800 rounded-lg px-4 py-2.5 shadow-md border-2 border-blue-400 dark:border-blue-600">
                          <div className="flex items-center gap-2.5">
                            <div className="bg-white/20 dark:bg-white/10 rounded-full p-1.5 backdrop-blur-sm">
                              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
                            </div>
                            <h3 className="text-base sm:text-lg font-bold text-white drop-shadow-sm">
                              {posteLabel}
                            </h3>
                          </div>
                        </div>
                        
                        {group.candidates.length === 0 ? (
                          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 pl-6">
                            Aucun candidat
                          </p>
                        ) : (
                          <div className="space-y-2 pl-6">
                            {group.candidates.map((candidate, index) => {
                              const civility = getCivilityLabel(candidate.civility);
                              const fullName = `${candidate.firstname} ${candidate.lastname}`;
                              const candidateKey = `${group.position}-${index}`;
                              const isSelected = selectedCandidates.has(candidateKey);
                              
                              return (
                                <div 
                                  key={candidateKey} 
                                  className={`flex items-start gap-2 p-2 rounded-lg border-2 transition-colors cursor-pointer ${
                                    isSelected 
                                      ? "bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600" 
                                      : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
                                  }`}
                                  onClick={() => handleCandidateToggle(candidateKey)}
                                >
                                  <div className="flex items-center gap-2 flex-1">
                                    <Checkbox
                                      id={`candidate-${candidateKey}`}
                                      checked={isSelected}
                                      onCheckedChange={() => handleCandidateToggle(candidateKey)}
                                      className="h-4 w-4 sm:h-5 sm:w-5 border-2"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <label 
                                      htmlFor={`candidate-${candidateKey}`}
                                      className="flex-1 cursor-pointer"
                                    >
                                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                                        {civility && <span className="mr-2">{civility}</span>}
                                        {fullName}
                                      </p>
                                    </label>
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
            <Card className="border-2 border-green-200 dark:border-green-800 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 !py-0">
              <CardContent className="p-4 sm:p-5 text-center">
                <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 leading-relaxed mb-2">
                  Nous souhaitons à tous les candidats une excellente campagne et invitons chaque membre à participer activement à ce moment important de la vie de notre association.
                </p>
                <p className="text-base sm:text-lg font-bold text-green-800 dark:text-green-200 mt-3">
                  Ensemble pour une Amaki France forte et dynamique ! 💙🤝🇫🇷🇨🇩🇨🇩🇨🇩
                </p>
                <p className="text-sm sm:text-base text-green-700 dark:text-green-300 mt-1">
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
