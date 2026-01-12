"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Scale, Building2, Calendar, Users, Shield, Download, ExternalLink, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";

interface StatuAmakiProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StatuAmaki({ open, onOpenChange }: StatuAmakiProps) {
  const user = useCurrentUser();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Statuts de l'Association AMAKI France
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Statuts validés et signés le 29 novembre 2025
          </p>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-180px)] px-6">
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
                  régie par la loi du 1er juillet 1901 et le décret du 16 août 1901.
                </p>
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-700 rounded-md">
                  <p className="text-xs text-green-800 dark:text-green-200 font-semibold">
                    ✓ Le Nouveau Statut validé et signé par les autorités le 29 novembre 2025
                  </p>
                </div>
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

            {/* TITRE I */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                Dénomination – Objet – Siège Social et Durée
              </h3>
            </div>

            {/* Article 1 - Dénomination */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 1 - Dénomination</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Il est fondé entre les adhérents aux présents statuts une association régie par la loi du 
                  1er juillet 1901 et le décret du 16 août 1901, ayant pour titre :
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 font-semibold">
                  « AMICALE DES ANCIENS ÉLÈVES DE KIPAKU France »<br />
                  En sigle « AMAKI France »
                </p>
              </CardContent>
            </Card>

            {/* Article 2 - Objet */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ARTICLE 2 - OBJET</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  L'association a pour objet :
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                  <li>Aider les membres se trouvant sur le territoire Français à s'intégrer dans la société.</li>
                  <li>Raffermir les liens d'amitiés</li>
                  <li>Créer un espace de solidarité mutuelle entre les différents membres, porter une assistance aux personnes démunies.</li>
                  <li>Insérer socialement les jeunes à travers les chantiers citoyens, dynamiser, valoriser les partenariats et la coopération Nord-sud</li>
                  <li>Accompagner les projets des membres immigrés pour l'aide aux retours au pays</li>
                  <li>Veiller à la transmission du patrimoine de nos origines à nos enfants nés hors de notre pays.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Article 3 - Siège Social */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ARTICLE 3 - SIÈGE SOCIAL</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Le siège social est fixé au <strong>119 rue des Grands Champs 77000 LIEUSAINT</strong>. 
                  Il pourra être transféré en tout autre lieu du territoire Français par décision de l'assemblée générale.
                </p>
              </CardContent>
            </Card>

            {/* Article 4 - Durée */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 4 - DURÉE</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  La durée de l'association est illimitée.
                </p>
              </CardContent>
            </Card>

            {/* Article 5 - Moyens d'action */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 5 – Moyens d'action</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Les moyens d'action de l'association sont notamment :
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                  <li>L'organisation des séminaires, conférences, formations, les réunions</li>
                  <li>Organisation des spectacles, des soirées culturelles</li>
                  <li>Toutes actions entrant dans l'objet de l'association</li>
                </ul>
              </CardContent>
            </Card>

            {/* TITRE II */}
            <div className="mb-6 mt-8">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                Composition des Membres - Admission – Cotisations – Perte – Radiation
              </h3>
            </div>

            {/* Article 6 - Composition */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  ARTICLE 6 - COMPOSITION
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  L'association se compose de :
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                  <li><strong>Membres fondateurs</strong> : qui sont à l'origine de la création de l'association</li>
                  <li><strong>Membres d'honneur</strong> : qui ont rendu des services signalés à l'association (dispensés de cotisations)</li>
                  <li><strong>Membres bienfaiteurs</strong> : qui versent un droit d'entrée de 500 € et une cotisation annuelle de 1000 €</li>
                  <li><strong>Membres actifs ou adhérents</strong> : qui versent annuellement une cotisation</li>
                  <li><strong>Membres sympathisants</strong> : qui manifestent l'intérêt à l'association et les membres de familles des adhérents actifs</li>
                </ul>
              </CardContent>
            </Card>

            {/* Article 7 - Admission */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ARTICLE 7 – Admission et adhésion</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Pour faire partie de l'association, il faut être agréé par le bureau, qui statue, lors de 
                  chacune de ses réunions, sur les demandes d'admission présentées.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  L'adhérent doit souscrire aux obligations de publications, de cotisations, et de 
                  signature d'un code de bonne conduite.
                </p>
              </CardContent>
            </Card>

            {/* Article 8 - Membres */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ARTICLE 8 – Membres</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Membres actifs :</strong> ceux qui ont pris l'engagement de verser annuellement une 
                  cotisation fixée chaque année par l'assemblée générale.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Membres d'honneur :</strong> ceux qui ont rendu des services signalés à l'association ; 
                  ils sont dispensés de cotisations.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Membres bienfaiteurs :</strong> les personnes qui versent un droit d'entrée de 500 € 
                  et une cotisation annuelle de 1000 € fixée chaque année par l'assemblée générale.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Membres sympathisants :</strong> tous ceux qui manifestent l'intérêt à l'association, 
                  et les membres de familles des adhérents actifs (enfants, époux(ses), etc.)
                </p>
              </CardContent>
            </Card>

            {/* Article 9 - Cotisations */}
            <Card className="border-green-200 bg-green-50 dark:bg-green-950">
              <CardHeader>
                <CardTitle className="text-lg">ARTICLE 9 - Cotisations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  La cotisation des membres est fixée à un montant de <strong>15 euros le mois</strong> et 
                  à <strong>180 euros annuellement</strong>.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  Toutefois, l'assemblée générale peut modifier le montant des cotisations dans le 
                  règlement intérieur afin d'éviter une révision des statuts.
                </p>
              </CardContent>
            </Card>

            {/* Article 10 - Perte */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ARTICLE 10 - Perte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  La qualité de membre de l'association se perd par :
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                  <li>Le décès</li>
                  <li>La démission adressée par écrit au président de l'association</li>
                  <li>L'exclusion prononcée par l'assemblée générale pour infractions aux présents statuts ou motifs graves portant préjudice moral ou matériel à l'association</li>
                  <li>Le non-paiement de la cotisation</li>
                  <li>L'absence prolongée</li>
                </ul>
              </CardContent>
            </Card>

            {/* Article 11 - Radiations */}
            <Card className="border-red-200 bg-red-50 dark:bg-red-950">
              <CardHeader>
                <CardTitle className="text-lg">ARTICLE 11 - Radiations</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  La radiation prononcée par le conseil d'administration pour non-paiement de la cotisation ou 
                  pour motif grave. L'intéressé ayant été invité (par lettre recommandée) à fournir des explications 
                  devant le bureau et/ou par écrit.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  Toutefois, le membre est dans un délai de 15 jours, formulées sa défense par écrit ou par 
                  audition des dirigeants de l'association.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  La radiation ou non est prononcée après avis et décision des trois quarts des membres du bureau.
                </p>
              </CardContent>
            </Card>

            {/* TITRE III */}
            <div className="mb-6 mt-8">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                Affiliation - Ressources
              </h3>
            </div>

            {/* Article 12 - Affiliation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 12 – Affiliation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  La présente association peut par ailleurs adhérer à d'autres associations, unions ou 
                  regroupements par décision du conseil d'administration.
                </p>
              </CardContent>
            </Card>

            {/* Article 13 - Ressources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 13 – Ressources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Les ressources de l'association comprennent :
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                  <li>Le montant des droits d'entrée et des cotisations</li>
                  <li>Les subventions de l'État, des départements et des communes</li>
                  <li>La vente des produits, de services ou de prestation fournies par l'association</li>
                  <li>Toutes les ressources autorisées par les lois et règlements en vigueur</li>
                </ul>
              </CardContent>
            </Card>

            {/* TITRE IV */}
            <div className="mb-6 mt-8">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                Décisions collectives
              </h3>
            </div>

            {/* Articles 14 - Assemblée Générale Ordinaire */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Articles 14 - Assemblée Générale Ordinaire</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  L'Assemblée Générale Ordinaire se tient au minimum une fois par an et rassemble tous 
                  les membres de l'association à jour de leur cotisation.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Au moins quinze jours avant la date prévue, les membres sont convoqués par le Président, 
                  le Conseil d'Administration, ou par un tiers des membres de l'association.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Les décisions sont adoptées à la majorité des membres présents. La validité des délibérations 
                  de l'assemblée générale ordinaire sont prises à la majorité de deux tiers des membres présents.
                </p>
              </CardContent>
            </Card>

            {/* ARTICLE 15 - ASSEMBLEE GENERALE EXTRAORDINAIRE */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ARTICLE 15 - ASSEMBLÉE GÉNÉRALE EXTRAORDINAIRE</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Le président peut convoquer une assemblée générale extraordinaire, sur demande de la moitié 
                  plus un des membres inscrits, ou à la demande d'un quart des membres à jour de cotisations, 
                  uniquement pour modification des statuts, dissolution ou pour des actes portant sur des immeubles.
                </p>
              </CardContent>
            </Card>

            {/* TITRE V */}
            <div className="mb-6 mt-8">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                CONSEIL D'ADMINISTRATION
              </h3>
            </div>

            {/* ARTICLE 16 - CONSEIL D'ADMINISTRATION */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">ARTICLE 16 - CONSEIL D'ADMINISTRATION</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  L'association est dirigée par un conseil d'administration, élus pour deux années par 
                  l'assemblée générale. Les membres sont rééligibles.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Le conseil d'administration se réunit au moins une fois tous les six mois, sur 
                  convocation du président, ou à la demande du quart de ses membres.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Les décisions sont prises à la majorité des voix ; en cas de partage, la voix du président 
                  est prépondérante.
                </p>
              </CardContent>
            </Card>

            {/* Article 17 – Composition du bureau */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 17 – Composition du bureau du conseil d'administration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Le conseil d'administration est composé de :
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 ml-4">
                  <li>Un président</li>
                  <li>Un vice-président</li>
                  <li>Un(e) secrétaire et, s'il y a lieu, un secrétaire adjoint</li>
                  <li>Un trésorier(e) et, si besoin est, un trésorier adjoint</li>
                </ul>
              </CardContent>
            </Card>

            {/* Article 18 – Indemnités */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 18 – Indemnités</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Toutes les fonctions, y compris celles des membres du conseil d'administration et du 
                  bureau sont gratuites et bénévoles. Seuls les frais occasionnés par l'accomplissement 
                  de leur mandat sont remboursés sur justificatifs.
                </p>
              </CardContent>
            </Card>

            {/* Article 19 – Règlement intérieur */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 19 – Règlement intérieur</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Un règlement intérieur peut être établi par le conseil d'administration, qui le fait alors 
                  approuver par l'assemblée générale ordinaire. Ce règlement éventuel est destiné à fixer les 
                  divers points non prévus par les présents statuts.
                </p>
              </CardContent>
            </Card>

            {/* TITRE VI */}
            <div className="mb-6 mt-8">
              <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                TITRE VI : Dissolution – Transformation – Fusion
              </h3>
            </div>

            {/* Article 21 – Dissolution */}
            <Card className="border-red-200 bg-red-50 dark:bg-red-950">
              <CardHeader>
                <CardTitle className="text-lg">Article 21 – Dissolution</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Outre les causes de dissolution légale, l'association prend fin par la dissolution 
                  anticipée décidée par les adhérents à la majorité prévue pour la modification des statuts.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  En cas de dissolution prononcée par les deux tiers au moins des membres présents à 
                  l'Assemblée générale, un ou plusieurs liquidateurs sont nommés par celle-ci.
                </p>
              </CardContent>
            </Card>

            {/* Article 22 – Liquidation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article 22 – Liquidation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  La dissolution de l'association entraîne sa liquidation. Le liquidateur est nommé par 
                  décision des adhérents à la majorité simple des voix.
                </p>
              </CardContent>
            </Card>

            {/* Signature */}
            <Card className="border-green-200 bg-green-50 dark:bg-green-950">
              <CardHeader>
                <CardTitle className="text-lg">Validation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Ainsi établis, les présents statuts ont été approuvés par l'assemblée générale 
                  constitutive de l'association.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">
                  Fait à VILLENOY, le 29 novembre 2025
                </p>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">Le Secrétaire</p>
                    <p className="text-gray-700 dark:text-gray-300">Hubert ITOMBA</p>
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">Le Président</p>
                    <p className="text-gray-700 dark:text-gray-300">Simon BAVUEZA TONGI</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Fermer
            </Button>
            {user ? (
              <Button
                onClick={() => window.open('/api/documents/statut', '_blank')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger le PDF
              </Button>
            ) : (
              <Button
                disabled
                className="flex-1 bg-slate-400 text-slate-600 cursor-not-allowed"
                title="Connectez-vous pour télécharger le document"
              >
                <Lock className="h-4 w-4 mr-2" />
                Réservé aux membres
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

