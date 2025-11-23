"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Scale, Building2, Calendar, Users, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StatuAmakiProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StatuAmaki({ open, onOpenChange }: StatuAmakiProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Statut Juridique de l'Association AMAKI France
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] px-6">
          <div className="py-6 space-y-6">
            {/* Introduction */}
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Présentation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  L'<strong>Amicale des Anciens Élèves de Kipaku en France (AMAKI France)</strong> est une association 
                  régie par la loi du 1er juillet 1901 relative au contrat d'association et le décret du 16 août 1901.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Badge variant="outline" className="bg-white dark:bg-gray-800">
                    <Scale className="h-3 w-3 mr-1" />
                    Loi 1901
                  </Badge>
                  <Badge variant="outline" className="bg-white dark:bg-gray-800">
                    <Calendar className="h-3 w-3 mr-1" />
                    Créée en 2016
                  </Badge>
                  <Badge variant="outline" className="bg-white dark:bg-gray-800">
                    <Shield className="h-3 w-3 mr-1" />
                    But non lucratif
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Article 1 - Dénomination */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 1 - Dénomination</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Il est fondé entre les adhérents aux présents statuts une association régie par la loi du 1er juillet 1901 
                  et le décret du 16 août 1901, ayant pour titre : <strong>Amicale des Anciens Élèves de Kipaku en France</strong>, 
                  en abrégé <strong>AMAKI France</strong>.
                </p>
              </CardContent>
            </Card>

            {/* Article 2 - Objet */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 2 - Objet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  L'association a pour objet :
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                  <li>De rassembler les anciens élèves de l'École de Kipaku établis en France</li>
                  <li>De faciliter leur intégration et leur insertion dans la société française</li>
                  <li>De promouvoir l'entraide, la solidarité et le respect mutuel entre les membres</li>
                  <li>De contribuer au développement de la communauté des anciens élèves</li>
                  <li>D'organiser des activités culturelles, sociales et éducatives</li>
                  <li>De maintenir les liens avec l'École de Kipaku et de contribuer à son développement</li>
                </ul>
              </CardContent>
            </Card>

            {/* Article 3 - Siège Social */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 3 - Siège Social</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Le siège social de l'association est fixé au : <strong>119 rue des Grands Champs, 77000 Lieusaint, France</strong>.
                  Il pourra être transféré par simple décision du conseil d'administration.
                </p>
              </CardContent>
            </Card>

            {/* Article 4 - Durée */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 4 - Durée</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  La durée de l'association est illimitée.
                </p>
              </CardContent>
            </Card>

            {/* Article 5 - Composition */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Article 5 - Composition
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  L'association se compose de :
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                  <li><strong>Membres actifs</strong> : Anciens élèves de Kipaku résidant en France, à jour de leur cotisation</li>
                  <li><strong>Membres bienfaiteurs</strong> : Personnes physiques ou morales qui apportent un soutien financier à l'association</li>
                  <li><strong>Membres d'honneur</strong> : Personnes nommées par l'assemblée générale pour services rendus à l'association</li>
                </ul>
              </CardContent>
            </Card>

            {/* Article 6 - Ressources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 6 - Ressources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Les ressources de l'association comprennent :
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                  <li>Les cotisations et droits d'adhésion des membres</li>
                  <li>Les subventions de l'État, des collectivités territoriales et des établissements publics</li>
                  <li>Les dons et legs</li>
                  <li>Les revenus des biens et valeurs de l'association</li>
                  <li>Toutes autres ressources autorisées par la loi</li>
                </ul>
              </CardContent>
            </Card>

            {/* Article 7 - Administration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 7 - Administration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  L'association est administrée par un conseil d'administration élu par l'assemblée générale. 
                  Le conseil d'administration élit parmi ses membres un bureau composé d'un président, d'un ou plusieurs 
                  vice-présidents, d'un secrétaire et d'un trésorier.
                </p>
              </CardContent>
            </Card>

            {/* Article 8 - Assemblée Générale */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 8 - Assemblée Générale</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  L'assemblée générale ordinaire se réunit au moins une fois par an. Elle est convoquée par le président 
                  ou à la demande du quart au moins des membres. L'assemblée générale extraordinaire peut être convoquée 
                  pour modifier les statuts ou décider de la dissolution de l'association.
                </p>
              </CardContent>
            </Card>

            {/* Article 9 - Dissolution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 9 - Dissolution</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  En cas de dissolution, l'assemblée générale extraordinaire désigne un ou plusieurs liquidateurs 
                  chargés de la liquidation des biens de l'association. L'actif net, s'il y a lieu, sera dévolu à 
                  une ou plusieurs associations ayant un objet similaire.
                </p>
              </CardContent>
            </Card>

            {/* Article 10 - Réunions Mensuelles */}
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  Article 10 - Réunions Mensuelles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Les réunions mensuelles sont obligatoires pour tous les membres actifs de l'association.</strong>
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                  <li>Les adhérents doivent assister à une réunion mensuelle</li>
                  <li>La date et le lieu de la réunion du mois suivant sont fixés un mois à l'avance lors de la réunion en cours</li>
                  <li>Ces réunions sont à caractère obligatoire pour tous les membres actifs</li>
                  <li>En cas d'absence justifiée, le membre doit informer le secrétariat au moins 48 heures à l'avance</li>
                </ul>
                <div className="mt-4 p-3 bg-white dark:bg-gray-800 border border-orange-300 dark:border-orange-700 rounded-md">
                  <p className="text-xs text-orange-800 dark:text-orange-200">
                    <strong>Important :</strong> La participation régulière aux réunions mensuelles est essentielle pour 
                    maintenir la cohésion de l'association et assurer le bon fonctionnement de la vie associative.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Règlement Intérieur */}
            <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950">
              <CardHeader>
                <CardTitle className="text-lg">Règlement Intérieur</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Un règlement intérieur peut être établi par le conseil d'administration, qui le fait approuver par 
                  l'assemblée générale. Ce règlement est destiné à fixer les divers points non prévus par les statuts, 
                  notamment ceux qui ont trait à l'administration interne de l'association, y compris les modalités 
                  d'organisation et de participation aux réunions mensuelles.
                </p>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

