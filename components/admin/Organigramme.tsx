"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, Shield, FileText, Euro, Vote, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface MembreBureau {
  id: string;
  poste: string;
  posteType: string;
  adherent: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
    image?: string;
    name?: string;
  };
  nombreVotes: number;
  dateDebutMandat: Date;
  dateFinMandat: Date;
  dureeMandat: number;
}

interface OrganigrammeProps {
  membres: MembreBureau[];
  election?: {
    id: string;
    titre: string;
    dateCloture: Date;
  } | null;
  className?: string;
}

// Mapping des postes vers les icônes
const getPosteIcon = (posteType: string) => {
  const type = posteType.toLowerCase();
  if (type.includes("president")) return Crown;
  if (type.includes("secretaire")) return FileText;
  if (type.includes("tresorier")) return Euro;
  if (type.includes("commissaire")) return Shield;
  if (type.includes("vice")) return Users;
  return Vote;
};

// Mapping des postes vers les couleurs
const getPosteColor = (posteType: string) => {
  const type = posteType.toLowerCase();
  if (type.includes("president")) return "from-yellow-500 to-amber-600";
  if (type.includes("secretaire")) return "from-blue-500 to-blue-600";
  if (type.includes("tresorier")) return "from-green-500 to-green-600";
  if (type.includes("commissaire")) return "from-purple-500 to-purple-600";
  if (type.includes("vice")) return "from-indigo-500 to-indigo-600";
  return "from-gray-500 to-gray-600";
};

// Structure hiérarchique du bureau
const structureHierarchique = [
  { niveau: 1, postes: ["President", "VicePresident"] },
  { niveau: 2, postes: ["Secretaire", "ViceSecretaire"] },
  { niveau: 3, postes: ["Tresorier", "ViceTresorier"] },
  { niveau: 4, postes: ["CommissaireComptes"] },
  { niveau: 5, postes: ["MembreComiteDirecteur"] },
];

export function Organigramme({ membres, election, className }: OrganigrammeProps) {
  if (!membres || membres.length === 0) {
    return (
      <Card className={`!py-0 border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900 ${className || ""}`}>
        <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-t-lg">
          <CardTitle className="text-base sm:text-lg text-gray-700 dark:text-gray-200">
            Organigramme du Bureau
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              Aucun membre du bureau pour le moment
            </p>
            {election && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Dernière élection : {format(new Date(election.dateCloture), "dd MMMM yyyy", { locale: fr })}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grouper les membres par niveau hiérarchique
  const membresParNiveau = structureHierarchique.map((niveau) => {
    const membresNiveau = membres.filter((m) =>
      niveau.postes.some((p) => m.posteType.includes(p))
    );
    return {
      ...niveau,
      membres: membresNiveau,
    };
  }).filter((n) => n.membres.length > 0);

  const now = new Date();

  return (
    <Card className={`!py-0 border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900 ${className || ""}`}>
      <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-t-lg">
        <CardTitle className="text-base sm:text-lg text-gray-700 dark:text-gray-200">
          Organigramme du Bureau
        </CardTitle>
        {election && (
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
            Élu le {format(new Date(election.dateCloture), "dd MMMM yyyy", { locale: fr })}
          </p>
        )}
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="space-y-6">
          {membresParNiveau.map((niveau, index) => (
            <div key={niveau.niveau} className="space-y-3">
              {/* Ligne de connexion pour les niveaux suivants */}
              {index > 0 && (
                <div className="flex justify-center">
                  <div className="w-0.5 h-6 bg-gray-300 dark:bg-gray-600"></div>
                </div>
              )}

              {/* Membres du niveau */}
              <div className="flex flex-wrap justify-center gap-4">
                {niveau.membres.map((membre) => {
                  const Icon = getPosteIcon(membre.posteType);
                  const couleur = getPosteColor(membre.posteType);
                  const mandatExpire = isBefore(membre.dateFinMandat, now);
                  const mandatExpirant = isBefore(membre.dateFinMandat, new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)) && !mandatExpire;

                  return (
                    <div
                      key={membre.id}
                      className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow min-w-[200px]"
                    >
                      {/* Badge du poste */}
                      <div className={`w-full bg-gradient-to-r ${couleur} text-white rounded-t-lg p-2 mb-3`}>
                        <div className="flex items-center justify-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-xs font-semibold text-center">{membre.poste}</span>
                        </div>
                      </div>

                      {/* Avatar et nom */}
                      <Avatar className="h-16 w-16 mb-2 border-2 border-blue-200 dark:border-blue-800">
                        <AvatarImage src={membre.adherent.image || ""} alt={membre.adherent.nom} />
                        <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">
                          {membre.adherent.prenom[0]}
                          {membre.adherent.nom[0]}
                        </AvatarFallback>
                      </Avatar>

                      <h3 className="font-semibold text-sm text-center text-gray-900 dark:text-white mb-1">
                        {membre.adherent.prenom} {membre.adherent.nom}
                      </h3>

                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-2">
                        {membre.nombreVotes} vote{membre.nombreVotes > 1 ? "s" : ""}
                      </p>

                      {/* Dates du mandat */}
                      <div className="w-full mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                          <span className="font-medium">Mandat :</span>
                          <br />
                          {format(new Date(membre.dateDebutMandat), "dd/MM/yyyy", { locale: fr })} -{" "}
                          {format(new Date(membre.dateFinMandat), "dd/MM/yyyy", { locale: fr })}
                        </p>
                        {mandatExpire && (
                          <Badge className="mt-2 w-full justify-center bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Mandat expiré
                          </Badge>
                        )}
                        {mandatExpirant && !mandatExpire && (
                          <Badge className="mt-2 w-full justify-center bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Expire bientôt
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

