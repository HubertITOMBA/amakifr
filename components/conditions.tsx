"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Euro, Users, CheckCircle, Calendar, AlertCircle, Handshake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ConditionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Conditions({ open, onOpenChange }: ConditionsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Conditions d'Adhésion à AMAKI France
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] px-6">
          <div className="py-6 space-y-6">
            {/* Introduction */}
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Handshake className="h-5 w-5 text-blue-600" />
                  Bienvenue dans notre communauté
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  L'<strong>Amicale des Anciens Élèves de Kipaku en France (AMAKI France)</strong> accueille avec plaisir 
                  toute personne souhaitant rejoindre notre communauté. Bien que nos adhérents soient majoritairement 
                  d'anciens élèves de Kipaku, <strong>toute personne partageant nos valeurs et nos objectifs peut faire 
                  une demande d'adhésion</strong>.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Badge variant="outline" className="bg-white dark:bg-gray-800">
                    <Users className="h-3 w-3 mr-1" />
                    Ouvert à tous
                  </Badge>
                  <Badge variant="outline" className="bg-white dark:bg-gray-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Adhésion simple
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Conditions d'éligibilité */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Qui peut adhérer ?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Peuvent adhérer à l'association :
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                  <li><strong>Les anciens élèves de l'École de Kipaku</strong> résidant en France ou à l'étranger</li>
                  <li><strong>Toute personne</strong> partageant les valeurs et les objectifs de l'association</li>
                  <li><strong>Les personnes morales</strong> (associations, entreprises) souhaitant soutenir nos actions</li>
                </ul>
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Note importante :</strong> Bien que nos adhérents soient majoritairement d'anciens élèves de Kipaku, 
                      l'association est ouverte à toute personne souhaitant contribuer à nos objectifs d'intégration, 
                      d'entraide et de solidarité.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Frais d'adhésion */}
            <Card className="border-green-200 bg-green-50 dark:bg-green-950">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Euro className="h-5 w-5 text-green-600" />
                  Frais d'Adhésion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Frais d'adhésion unique</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Payable une seule fois lors de l'adhésion</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600 dark:text-green-400 whitespace-nowrap">50,00 €</p>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      <strong>Évolution possible :</strong> Ce montant pourra être modifié après un vote de l'assemblée générale 
                      de l'association. Toute modification sera communiquée à l'avance aux membres.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cotisation mensuelle */}
            <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Euro className="h-5 w-5 text-purple-600" />
                  Cotisation Mensuelle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Cotisation mensuelle</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Payable chaque mois pour maintenir le statut de membre actif</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">15,00 €</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">par mois</p>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      <strong>Évolution possible :</strong> Ce montant pourra être modifié après un vote de l'assemblée générale 
                      de l'association. Toute modification sera communiquée à l'avance aux membres.
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Avantages de la cotisation :</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300 ml-4">
                    <li>Accès à tous les événements et activités de l'association</li>
                    <li>Participation aux assemblées générales avec droit de vote</li>
                    <li>Accès aux services d'entraide et de soutien</li>
                    <li>Recevoir les communications et informations de l'association</li>
                    <li>Bénéficier des réductions et avantages négociés par l'association</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Separator />

            {/* Processus d'adhésion */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  Processus d'Adhésion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">1</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Remplir le formulaire d'adhésion</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Complétez le formulaire en ligne avec vos informations personnelles et votre motivation.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">2</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Examen de la demande</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Le conseil d'administration examine votre demande sous 15 jours ouvrés.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">3</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Validation et paiement</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Une fois votre demande acceptée, vous recevrez les instructions pour effectuer le paiement 
                        des frais d'adhésion et de la première cotisation mensuelle.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">Bienvenue dans l'association !</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Vous recevrez vos identifiants et pourrez accéder à tous les services de l'association.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Modalités de paiement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Modalités de Paiement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Les paiements peuvent être effectués par :
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                  <li><strong>Virement bancaire</strong> (recommandé)</li>
                  <li><strong>Chèque</strong> à l'ordre de "AMAKI France"</li>
                  <li><strong>Espèces</strong> lors des événements de l'association</li>
                  <li><strong>Carte bancaire</strong> via notre plateforme en ligne</li>
                </ul>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-4">
                  Les coordonnées bancaires vous seront communiquées après validation de votre demande d'adhésion.
                </p>
              </CardContent>
            </Card>

            {/* Réunions Mensuelles Obligatoires */}
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  Réunions Mensuelles Obligatoires
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-orange-300 dark:border-orange-700">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                        Participation Obligatoire
                      </p>
                      <p className="text-sm text-orange-800 dark:text-orange-200">
                        <strong>Les réunions mensuelles sont obligatoires</strong> pour tous les membres actifs de l'association.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">Fréquence</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Les adhérents doivent assister à <strong>une réunion mensuelle</strong>.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">Planification</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>La date et le lieu de la réunion du mois suivant sont fixés un mois à l'avance</strong> 
                        lors de la réunion en cours. Cela permet à tous les membres de s'organiser à l'avance.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">Caractère Obligatoire</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Ces réunions sont <strong>à caractère obligatoire</strong> pour tous les membres actifs. 
                        En cas d'absence justifiée, le membre doit informer le secrétariat au moins 48 heures à l'avance.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>Objectif :</strong> Les réunions mensuelles permettent de maintenir la cohésion de l'association, 
                    d'échanger sur les projets en cours, de prendre des décisions collectives et de renforcer les liens 
                    entre les membres.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Engagement */}
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
              <CardHeader>
                <CardTitle className="text-lg">Engagement des Membres</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  En adhérant à AMAKI France, vous vous engagez à respecter les statuts de l'association, 
                  à participer activement à la vie associative dans la mesure du possible, notamment en assistant 
                  aux réunions mensuelles obligatoires, et à contribuer aux objectifs d'entraide, de solidarité 
                  et de respect mutuel qui sont au cœur de notre mission.
                </p>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

