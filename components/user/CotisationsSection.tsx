"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  HandHeart,
  History,
  Info,
  Loader2,
  Printer,
  Receipt,
} from "lucide-react";
import { toast } from "react-toastify";

import {
  getSimulationVersementAssistance,
  getSimulationVersementAssistanceForUser,
  getTypesAssistancePourSimulation,
} from "@/actions/paiements";
import { HistoriqueCotisationsTable, HistoriqueCotisation } from "@/components/user/HistoriqueCotisationsTable";

interface DetteInitiale {
  id: string;
  annee: number;
  montant: number;
  montantPaye: number;
  montantRestant: number;
  description?: string | null;
}

interface TypeCotisationLite {
  nom?: string | null;
  montant?: number | null;
  aBeneficiaire?: boolean | null;
}

interface CotisationMensuelleLite {
  id: string;
  mois: number;
  annee: number;
  montantAttendu: number;
  montantPaye: number;
  montantRestant: number;
  dateEcheance: string | Date;
  periode: string;
  statut: string;
  description?: string | null;
  adherentId?: string | null;
  adherentBeneficiaireId?: string | null;
  TypeCotisation?: TypeCotisationLite | null;
  CotisationDuMois?: {
    adherentBeneficiaireId?: string | null;
    AdherentBeneficiaire?: {
      civility?: string | null;
      firstname?: string | null;
      lastname?: string | null;
    } | null;
  } | null;
  Paiements?: HistoriqueCotisation["Paiements"];
}

interface AssistanceLite {
  id: string;
  type: string;
  montant: number;
  montantPaye?: number | null;
  montantRestant?: number | null;
  statut?: string | null;
  dateEvenement: string | Date;
  adherentId?: string | null;
  Adherent?: { firstname?: string | null; lastname?: string | null } | null;
}

interface AvoirLite {
  id: string;
  description?: string | null;
  montantRestant: number;
  montantUtilise?: number | null;
  createdAt: string | Date;
}

interface ObligationCotisationLite {
  id: string;
  type?: string | null;
  description?: string | null;
  montantAttendu?: number | null;
  montantPaye?: number | null;
  montantRestant?: number | null;
}

interface ProfileForCotisations {
  id?: string;
  role?: string | null;
  typeForfait?: { montant?: number | null } | null;
  adherent?: {
    id: string;
    DettesInitiales?: DetteInitiale[] | null;
    CotisationsMensuelles?: CotisationMensuelleLite[] | null;
    Assistances?: AssistanceLite[] | null;
    Avoirs?: AvoirLite[] | null;
    ObligationsCotisation?: ObligationCotisationLite[] | null;
  } | null;
}

interface CotisationMoisItem {
  id: string;
  type: string;
  montant: number;
  montantPaye: number;
  montantRestant: number;
  dateCotisation: string | Date;
  periode: string;
  statut: string;
  description?: string;
  moyenPaiement: string;
  reference: string;
  isCotisationMensuelle?: boolean;
  isAssistance?: boolean;
  isBeneficiaire?: boolean;
  cotisationMensuelleId?: string | null;
  assistanceId?: string | null;
}

export function CotisationsSection({
  profile,
  embed = false,
  viewAsUserId,
  readOnly = false,
}: {
  profile: ProfileForCotisations | null;
  embed?: boolean;
  viewAsUserId?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const showPaymentActions = !readOnly;
  const adherent = profile?.adherent ?? null;
  const dettesInitiales = adherent?.DettesInitiales ?? [];
  const avoirs = adherent?.Avoirs ?? [];
  const cotisationsMensuelles = adherent?.CotisationsMensuelles ?? [];
  const assistances = adherent?.Assistances ?? [];
  const obligationsCotisation = adherent?.ObligationsCotisation ?? [];
  const adherentId = adherent?.id ?? null;

  const now = new Date();
  const [selectedCotisationsMois, setSelectedCotisationsMois] = useState<number>(() => now.getMonth() + 1);
  const [selectedCotisationsAnnee, setSelectedCotisationsAnnee] = useState<number>(() => now.getFullYear());
  const [calendarCotisationsOpen, setCalendarCotisationsOpen] = useState(false);
  const [cotisationsVue, setCotisationsVue] = useState<"mois" | "annee" | "toutes">("mois");
  const [showSimulation, setShowSimulation] = useState(false);
  const [showHistorique, setShowHistorique] = useState(false);
  const handlePrintHistorique = () => {
    if (typeof window !== "undefined") window.print();
  };

  const [typesAssistanceList, setTypesAssistanceList] = useState<Array<{ id: string; nom: string; montant: number }>>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [simulationVersement, setSimulationVersement] = useState<{
    montantFixe: number;
    totalDettes: number;
    totalCotisationsNonPayees: number;
    totalAvoirs: number;
    aDeduire: number;
    montantAVerser: number;
    adherentName: string;
    typeAssistanceNom?: string | null;
  } | null>(null);
  const [loadingSimulation, setLoadingSimulation] = useState(false);

  useEffect(() => {
    if (!showSimulation) {
      setSelectedTypeId("");
      setSimulationVersement(null);
      return;
    }
    if (typesAssistanceList.length === 0) {
      getTypesAssistancePourSimulation().then((r) => {
        if (r.success && r.data?.length) {
          setTypesAssistanceList(r.data);
          setSelectedTypeId(r.data[0]?.id ?? "");
        }
      });
    } else if (!selectedTypeId) {
      setSelectedTypeId(typesAssistanceList[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSimulation]);

  useEffect(() => {
    if (!showSimulation || !selectedTypeId) return;
    setLoadingSimulation(true);
    setSimulationVersement(null);
    const promise =
      viewAsUserId && readOnly
        ? getSimulationVersementAssistanceForUser(viewAsUserId, selectedTypeId)
        : getSimulationVersementAssistance(selectedTypeId);
    promise
      .then((result) => {
        if (result.success && result.data) setSimulationVersement(result.data);
      })
      .finally(() => setLoadingSimulation(false));
  }, [showSimulation, selectedTypeId, viewAsUserId, readOnly]);

  const cotisationsMoisAffichage = useMemo<CotisationMoisItem[]>(() => {
    if (!adherent) return [];
    if (profile?.role === "ADMIN") return [];

    const adherentId = adherent.id;
    const montantForfaitDefaut = profile?.typeForfait?.montant ?? 15.0;

    const buildItemsForMonth = (annee: number, mois: number): CotisationMoisItem[] => {
      const cms = cotisationsMensuelles.filter((cm) => {
        if (Number(cm.mois) !== mois || Number(cm.annee) !== annee) return false;
        // filtre critique : l'adhérent payeur ne paie pas son assistance s'il est bénéficiaire
        const adherentBeneficiaireId = cm.adherentBeneficiaireId ?? cm.CotisationDuMois?.adherentBeneficiaireId;
        const typeNom = cm.TypeCotisation?.nom ?? "";
        const estAssistance =
          cm.TypeCotisation?.aBeneficiaire === true ||
          (typeNom && String(typeNom).toLowerCase().includes("assistance"));
        if (estAssistance && adherentBeneficiaireId && cm.adherentId === adherentBeneficiaireId) return false;
        return true;
      });

      const items: CotisationMoisItem[] = [];

      cms.forEach((cm) => {
        const typeNom = cm.TypeCotisation?.nom ?? "Cotisation";
        const estAssistance =
          cm.TypeCotisation?.aBeneficiaire === true ||
          (typeNom && String(typeNom).toLowerCase().includes("assistance"));
        const isForfait = !estAssistance;
        // Même formule qu'avant refactor : "Type - civilité Prénom Nom"
        const benef: any = (cm as any).AdherentBeneficiaire ?? cm.CotisationDuMois?.AdherentBeneficiaire;
        const partsBenef = benef ? [benef.civility, benef.firstname, benef.lastname].filter(Boolean) : [];
        const descriptionAssistance =
          partsBenef.length > 0
            ? `${typeNom} - ${partsBenef.join(" ")}`
            : cm.description && typeof cm.description === "string" && cm.description.includes(" - ")
              ? cm.description
              : typeNom;
        const description =
          cm.description && typeof cm.description === "string" && cm.description.includes(" - ")
            ? cm.description
            : isForfait
              ? "Cotisation mensuelle forfaitaire"
              : descriptionAssistance;

        items.push({
          id: `cotisation-${cm.id}`,
          type: typeNom,
          montant: Number(cm.montantAttendu),
          montantPaye: Number(cm.montantPaye),
          montantRestant: Number(cm.montantRestant),
          dateCotisation: cm.dateEcheance,
          periode: cm.periode,
          statut: cm.statut,
          description,
          moyenPaiement: "Non payé",
          reference: cm.id,
          isCotisationMensuelle: true,
          cotisationMensuelleId: cm.id,
        });
      });

      if (cms.length === 0) {
        const periode = `${annee}-${String(mois).padStart(2, "0")}`;
        items.push({
          id: `forfait-dynamique-${mois}-${annee}`,
          type: "Forfait mensuel",
          montant: Number(montantForfaitDefaut),
          montantPaye: 0,
          montantRestant: Number(montantForfaitDefaut),
          dateCotisation: new Date(annee, mois - 1, 15),
          periode,
          statut: "EnAttente",
          description: "Cotisation mensuelle forfaitaire (non créée par l'admin)",
          moyenPaiement: "Non payé",
          reference: "dynamique",
          isCotisationMensuelle: false,
          cotisationMensuelleId: null,
        });
      }

      // assistances du mois (uniquement celles que l'adhérent doit payer)
      assistances.forEach((ass) => {
        const d = new Date(ass.dateEvenement);
        if (d.getFullYear() !== annee || d.getMonth() + 1 !== mois) return;
        const isBeneficiaire = ass.adherentId === adherentId;
        if (isBeneficiaire) return;
        items.push({
          id: `assistance-${ass.id}`,
          type: `Assistance ${ass.type}`,
          montant: Number(ass.montant),
          montantPaye: Number(ass.montantPaye ?? 0),
          montantRestant: Number(ass.montantRestant ?? ass.montant),
          dateCotisation: ass.dateEvenement,
          periode: `${annee}-${String(mois).padStart(2, "0")}`,
          statut: ass.statut ?? "EnAttente",
          description: `Assistance pour ${ass.type}${ass.Adherent ? ` (${ass.Adherent.firstname ?? ""} ${ass.Adherent.lastname ?? ""})` : ""}`.trim(),
          moyenPaiement: "Non payé",
          reference: ass.id,
          isAssistance: true,
          assistanceId: ass.id,
        });
      });

      return items;
    };

    if (cotisationsVue === "mois") return buildItemsForMonth(selectedCotisationsAnnee, selectedCotisationsMois);

    if (cotisationsVue === "annee") {
      const months = new Set<number>();
      cotisationsMensuelles
        .filter((cm) => Number(cm.annee) === selectedCotisationsAnnee)
        .forEach((cm) => months.add(Number(cm.mois)));
      assistances.forEach((ass) => {
        const d = new Date(ass.dateEvenement);
        if (d.getFullYear() === selectedCotisationsAnnee) months.add(d.getMonth() + 1);
      });
      const monthsToShow = months.size > 0 ? Array.from(months).sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      return monthsToShow.flatMap((m) => buildItemsForMonth(selectedCotisationsAnnee, m));
    }

    // toutes
    const periodes = new Set<string>();
    cotisationsMensuelles.forEach((cm) => periodes.add(`${cm.annee}-${String(cm.mois).padStart(2, "0")}`));
    assistances.forEach((ass) => {
      const d = new Date(ass.dateEvenement);
      periodes.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return Array.from(periodes)
      .map((p) => {
        const [y, m] = p.split("-");
        return { annee: parseInt(y ?? "0", 10), mois: parseInt(m ?? "0", 10) };
      })
      .sort((a, b) => (b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois))
      .flatMap(({ annee, mois }) => buildItemsForMonth(annee, mois));
  }, [adherent, assistances, cotisationsMensuelles, cotisationsVue, profile?.role, profile?.typeForfait?.montant, selectedCotisationsAnnee, selectedCotisationsMois]);

  const title = useMemo(() => {
    if (cotisationsVue === "mois") {
      const nomMois = new Date(selectedCotisationsAnnee, selectedCotisationsMois - 1, 1).toLocaleDateString("fr-FR", { month: "long" });
      const nomMoisCap = nomMois.charAt(0).toUpperCase() + nomMois.slice(1);
      return `Cotisations du mois de ${nomMoisCap} ${selectedCotisationsAnnee}`;
    }
    if (cotisationsVue === "annee") return `Cotisations de l'année ${selectedCotisationsAnnee}`;
    return "Toutes mes cotisations";
  }, [cotisationsVue, selectedCotisationsAnnee, selectedCotisationsMois]);

  const totalRestantCotisations = useMemo(() => {
    if (!cotisationsMoisAffichage?.length) return 0;
    return cotisationsMoisAffichage.reduce((sum, c) => {
      const restant = Number(c.montantRestant ?? 0);
      const estDynamique = c.isCotisationMensuelle === false && !c.cotisationMensuelleId;
      if (estDynamique) return sum;
      if (restant <= 0) return sum;
      return sum + restant;
    }, 0);
  }, [cotisationsMoisAffichage]);

  const description = useMemo(() => {
    if (cotisationsVue === "mois") return "Cotisations mensuelles + assistances du mois";
    if (cotisationsVue === "annee") return "Toutes les cotisations mensuelles et assistances de l'année";
    return "Toutes vos cotisations mensuelles et assistances";
  }, [cotisationsVue]);

  const historiqueCotisations = useMemo<HistoriqueCotisation[]>(() => {
    if (!cotisationsMensuelles?.length) return [];
    // Aligner le filtre critique de l'historique
    return [...cotisationsMensuelles]
      .filter((cot: any) => {
        const adherentBeneficiaireId = cot.adherentBeneficiaireId ?? cot.CotisationDuMois?.adherentBeneficiaireId;
        const typeNom = cot.TypeCotisation?.nom ?? "";
        const estAssistance =
          cot.TypeCotisation?.aBeneficiaire === true ||
          (typeNom && String(typeNom).toLowerCase().includes("assistance"));
        if (estAssistance && adherentBeneficiaireId && cot.adherentId === adherentBeneficiaireId) return false;
        return true;
      })
      .sort((a: any, b: any) => (b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois)) as any;
  }, [cotisationsMensuelles]);

  return (
    <div className="space-y-3">
      {/* Impression : n'imprimer que l'historique */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #cotisations-historique-print-root,
          #cotisations-historique-print-root * {
            visibility: visible !important;
          }
          #cotisations-historique-print-root {
            position: fixed;
            left: 0;
            top: 0;
            right: 0;
            padding: 16px;
            background: white;
            color: black;
            overflow: visible !important;
          }
          nav,
          footer,
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Mes Cotisations</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">Dettes initiales, cotisations, historique et simulation</p>
        </div>
      </div>

      {avoirs.length > 0 && (
        <Card className="border-green-200 dark:border-green-800 bg-white dark:bg-gray-900 py-0">
          <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 dark:from-green-600 dark:to-green-700 text-white pb-3 pt-3 px-6 gap-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" />
              Mes Avoirs (Crédits Disponibles)
            </CardTitle>
            <CardDescription className="text-green-100 dark:text-green-200 mt-1 text-xs">
              Crédits disponibles à utiliser pour vos prochains paiements
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3 pb-4 px-6">
            <div className="space-y-2">
              {avoirs.map((avoir) => (
                <div
                  key={avoir.id}
                  className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold text-green-900 dark:text-green-100">{avoir.description || "Avoir disponible"}</p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        Créé le {format(new Date(avoir.createdAt), "dd MMMM yyyy", { locale: fr })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {Number(avoir.montantRestant).toFixed(2).replace(".", ",")} €
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-0.5">Comment utiliser vos avoirs ?</p>
                    <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                      Vos avoirs sont automatiquement appliqués lors de vos prochains paiements.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dettesInitiales.length > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 py-0">
          <CardHeader className="bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white pb-3 pt-3 px-6 gap-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4" />
              Dettes Initiales
            </CardTitle>
            <CardDescription className="text-red-100 dark:text-red-200 mt-1 text-xs">
              Dettes de l&apos;adhérent envers l&apos;association (2024, 2025, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3 pb-4 px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-red-50 dark:bg-red-900/20">
                    <TableHead className="font-semibold text-xs text-center">Année</TableHead>
                    <TableHead className="font-semibold text-xs text-center">Montant total</TableHead>
                    <TableHead className="font-semibold text-xs text-center">Montant payé</TableHead>
                    <TableHead className="font-semibold text-xs text-center">Montant restant</TableHead>
                    <TableHead className="font-semibold text-xs text-center">Statut</TableHead>
                    {showPaymentActions && (
                      <TableHead className="font-semibold text-xs text-center w-[120px]">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dettesInitiales.map((d) => {
                    const restant = Number(d.montantRestant ?? 0);
                    const paye = Number(d.montantPaye ?? 0);
                    const total = Number(d.montant ?? 0);
                    const estPaye = restant <= 0;
                    return (
                      <TableRow key={d.id} className="hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <TableCell className="text-center text-xs font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {d.annee}
                        </TableCell>
                        <TableCell className="text-center text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {total.toFixed(2).replace(".", ",")} €
                        </TableCell>
                        <TableCell className="text-center text-xs font-medium text-green-700 dark:text-green-300 whitespace-nowrap">
                          {paye.toFixed(2).replace(".", ",")} €
                        </TableCell>
                        <TableCell className={`text-center text-xs font-bold whitespace-nowrap ${estPaye ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                          {restant.toFixed(2).replace(".", ",")} €
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={estPaye ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}>
                            {estPaye ? "Payée" : "En cours"}
                          </Badge>
                        </TableCell>
                        {showPaymentActions && (
                          <TableCell className="text-center">
                            {estPaye ? (
                              <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                            ) : adherentId ? (
                              <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs px-2"
                                onClick={() => {
                                  router.push(
                                    `/paiement?type=dette-initiale&id=${encodeURIComponent(d.id)}&adherentId=${encodeURIComponent(adherentId)}&montant=${restant}`
                                  );
                                }}
                              >
                                Payer
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() => toast.error("Impossible de récupérer votre identifiant")}
                              >
                                Payer
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-0.5">Information importante</p>
                  <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                    Ces dettes initiales représentent votre dette envers l'association pour les années précédentes (2024, 2025, etc.). Vous pouvez effectuer des paiements partiels ou complets pour régulariser votre situation. L'application a été mise en place le 1er janvier, ces dettes correspondent donc aux années antérieures.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(() => {
        const obligationsAPayer = (obligationsCotisation || []).filter((ob) => Number(ob.montantRestant ?? 0) > 0);
        if (obligationsAPayer.length === 0) return null;
        return (
          <Card className="border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 py-0">
            <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 text-white pb-3 pt-3 px-6 gap-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4" />
                Frais d&apos;adhésion et obligations à payer
              </CardTitle>
              <CardDescription className="text-amber-100 dark:text-amber-200 mt-1 text-xs">
                Paiement par virement ou carte bancaire
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3 pb-4 px-6">
              <div className="space-y-2">
                {obligationsAPayer.map((ob) => {
                  const restant = Number(ob.montantRestant ?? 0);
                  const label = ob.description?.trim() || ob.type || "Obligation";
                  return (
                    <div
                      key={ob.id}
                      className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wide truncate">
                          {label}
                        </p>
                        <p className="text-[11px] text-gray-700 dark:text-gray-300">
                          Attendu: {Number(ob.montantAttendu ?? 0).toFixed(2).replace(".", ",")} € • Restant:{" "}
                          <span className="font-semibold text-amber-700 dark:text-amber-300">
                            {restant.toFixed(2).replace(".", ",")} €
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {readOnly ? (
                          <Badge variant="outline" className="text-xs">
                            Lecture seule
                          </Badge>
                        ) : adherentId ? (
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => {
                              router.push(
                                `/paiement?adherentId=${encodeURIComponent(adherentId)}&montant=${restant}&type=obligation&id=${encodeURIComponent(ob.id)}`
                              );
                            }}
                          >
                            Payer
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => toast.error("Impossible de récupérer votre identifiant")}
                          >
                            Payer
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Afficher :</span>
        <Select value={cotisationsVue} onValueChange={(v: "mois" | "annee" | "toutes") => setCotisationsVue(v)}>
          <SelectTrigger className="w-[160px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mois">Un mois</SelectItem>
            <SelectItem value="annee">Une année</SelectItem>
            <SelectItem value="toutes">Toutes les cotisations</SelectItem>
          </SelectContent>
        </Select>
        {cotisationsVue === "mois" && (
          <>
            <Popover open={calendarCotisationsOpen} onOpenChange={setCalendarCotisationsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-[180px] justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {format(new Date(selectedCotisationsAnnee, selectedCotisationsMois - 1, 1), "MMMM yyyy", { locale: fr }).replace(/^\w/, (c) => c.toUpperCase())}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" align="start">
                <CalendarUI
                  mode="single"
                  selected={new Date(selectedCotisationsAnnee, selectedCotisationsMois - 1, 1)}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedCotisationsAnnee(date.getFullYear());
                      setSelectedCotisationsMois(date.getMonth() + 1);
                      setCalendarCotisationsOpen(false);
                    }
                  }}
                  defaultMonth={new Date(selectedCotisationsAnnee, selectedCotisationsMois - 1, 1)}
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-blue-600 dark:text-blue-400"
              onClick={() => {
                const n = new Date();
                setSelectedCotisationsMois(n.getMonth() + 1);
                setSelectedCotisationsAnnee(n.getFullYear());
              }}
            >
              Mois en cours
            </Button>
          </>
        )}
        {cotisationsVue === "annee" && (
          <>
            <Select value={String(selectedCotisationsAnnee)} onValueChange={(v) => setSelectedCotisationsAnnee(Number(v))}>
              <SelectTrigger className="w-[90px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const currentYear = new Date().getFullYear();
                  const years: number[] = [];
                  for (let y = currentYear - 2; y <= currentYear + 1; y++) years.push(y);
                  return years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-blue-600 dark:text-blue-400"
              onClick={() => setSelectedCotisationsAnnee(new Date().getFullYear())}
            >
              Année en cours
            </Button>
          </>
        )}
      </div>

      <Card className="border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 py-0">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white pb-3 pt-3 px-6 gap-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            {title}
          </CardTitle>
          <CardDescription className="text-blue-100 dark:text-blue-200 mt-1 text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent className="pt-3 pb-4 px-6">
          {cotisationsMoisAffichage.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-gray-500">
              <Receipt className="h-8 w-8 text-gray-400" />
              <p className="text-sm">Aucune cotisation à afficher.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50 dark:bg-blue-900/20">
                      <TableHead className="font-semibold text-xs text-left">Description</TableHead>
                      <TableHead className="font-semibold text-xs text-center w-[120px]">Montant</TableHead>
                      {showPaymentActions && (
                        <TableHead className="font-semibold text-xs text-center w-[140px]">Action</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cotisationsMoisAffichage.map((c) => {
                      const montant = Number(c.montant ?? 0);
                      const restant = Number(c.montantRestant ?? 0);
                      const estDynamique = c.isCotisationMensuelle === false && !c.cotisationMensuelleId;
                      const estPaye = restant <= 0;
                      return (
                        <TableRow key={c.id} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                          <TableCell className="text-xs text-gray-700 dark:text-gray-300 text-left">
                            <span className="block truncate" title={c.description || c.type}>
                              {c.description || c.type}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-gray-900 dark:text-white text-center whitespace-nowrap">
                            {montant.toFixed(2).replace(".", ",")} €
                          </TableCell>
                          {showPaymentActions && (
                            <TableCell className="text-center">
                              {estDynamique ? (
                                <Badge variant="outline" className="text-xs text-gray-500 dark:text-gray-400">
                                  <Info className="h-3 w-3 mr-1" />
                                  En attente de création
                                </Badge>
                              ) : estPaye ? (
                                <Badge className="bg-green-100 text-green-800 text-xs">Payée</Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs px-2"
                                  onClick={() => {
                                    if (!adherentId) {
                                      toast.error("Impossible de récupérer votre identifiant");
                                      return;
                                    }
                                    let url = `/paiement?adherentId=${encodeURIComponent(adherentId)}&montant=${restant}`;
                                    if (c.isCotisationMensuelle && c.cotisationMensuelleId) {
                                      url += `&type=cotisation-mensuelle&id=${encodeURIComponent(c.cotisationMensuelleId)}`;
                                    } else if (c.isAssistance && c.assistanceId) {
                                      url += `&type=assistance&id=${encodeURIComponent(c.assistanceId)}`;
                                    } else {
                                      url += `&type=obligation&id=${encodeURIComponent(c.id)}`;
                                    }
                                    router.push(url);
                                  }}
                                >
                                  Payer
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Ligne total (comme avant) */}
              {(() => {
                const totalDuMois = cotisationsMoisAffichage.reduce((s, c) => s + Number(c.montant ?? 0), 0);
                const totalRestant = cotisationsMoisAffichage.reduce((s, c) => {
                  const restant = Number(c.montantRestant ?? 0);
                  const estDynamique = c.isCotisationMensuelle === false && !c.cotisationMensuelleId;
                  if (estDynamique) return s;
                  return s + Math.max(0, restant);
                }, 0);

                return (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">
                      Total du mois :{" "}
                      <span className="text-base sm:text-lg font-bold text-blue-700 dark:text-blue-300">
                        {totalDuMois.toFixed(2).replace(".", ",")} €
                      </span>{" "}
                      {totalRestant > 0 && (
                        <span className="text-xs sm:text-sm text-red-600 dark:text-red-400">
                          (rest : {totalRestant.toFixed(2).replace(".", ",")} €)
                        </span>
                      )}
                    </div>
                    {!readOnly && adherentId && totalRestant > 0 && (
                      <Button
                        size="sm"
                        className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => {
                          router.push(
                            `/paiement?type=general&adherentId=${encodeURIComponent(adherentId)}&montant=${totalRestant}`
                          );
                        }}
                      >
                        Payer le total
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 py-0">
        <CardHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white pb-3 pt-3 px-6 gap-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Historique des Cotisations par Mois
          </CardTitle>
          <CardDescription className="text-indigo-100 dark:text-indigo-200 mt-1 text-xs">
            Consultez l&apos;historique détaillé et imprimez en PDF si besoin
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-3 pb-4 px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30"
              onClick={() => setShowSimulation((v) => !v)}
            >
              <HandHeart className="h-4 w-4 mr-2" />
              {showSimulation ? "Masquer la simulation" : "Simulation versement assistance"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-indigo-300 dark:border-indigo-700"
              onClick={() => setShowHistorique((v) => !v)}
            >
              <History className="h-4 w-4 mr-2" />
              {showHistorique ? "Masquer l’historique" : "Voir l’historique"}
            </Button>
          </div>

          {showSimulation && (
            <div className="mt-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/20 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <HandHeart className="h-4 w-4 text-purple-700 dark:text-purple-300" />
                  <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                    Simulation de versement assistance
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowSimulation(false)}>
                  Fermer
                </Button>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-purple-700 dark:text-purple-300">Type d&apos;assistance</Label>
                <Select value={selectedTypeId} onValueChange={setSelectedTypeId} disabled={typesAssistanceList.length === 0}>
                  <SelectTrigger className="border-purple-300 dark:border-purple-700 focus:ring-purple-500">
                    <SelectValue placeholder={typesAssistanceList.length === 0 ? "Chargement..." : "Sélectionnez un type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {typesAssistanceList.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="font-medium">{t.nom}</span>{" "}
                        <span className="text-purple-600 dark:text-purple-400 ml-1">({t.montant.toFixed(2)} €)</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4">
                {loadingSimulation ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  </div>
                ) : simulationVersement ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-1.5 px-2 rounded-md bg-blue-50 dark:bg-blue-950/30">
                      <span className="text-muted-foreground font-medium">Montant fixe assistance</span>
                      <span className="font-bold text-blue-700 dark:text-blue-300 text-base">
                        {simulationVersement.montantFixe.toFixed(2)} €
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 px-2 rounded-md bg-red-50 dark:bg-red-950/20">
                      <span className="text-muted-foreground">Dettes initiales à déduire</span>
                      <span className="font-semibold text-red-600 dark:text-red-400">− {simulationVersement.totalDettes.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 px-2 rounded-md bg-orange-50 dark:bg-orange-950/20">
                      <span className="text-muted-foreground">Cotisations non payées à déduire</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">
                        − {simulationVersement.totalCotisationsNonPayees.toFixed(2)} €
                      </span>
                    </div>
                    {simulationVersement.totalAvoirs > 0 && (
                      <div className="flex justify-between items-center py-1.5 px-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30">
                        <span className="text-muted-foreground">Avoirs disponibles</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          + {simulationVersement.totalAvoirs.toFixed(2)} €
                        </span>
                      </div>
                    )}
                    <div
                      className={`border-t pt-3 mt-2 flex justify-between items-center font-bold text-lg px-2 py-2 rounded-md ${
                        simulationVersement.montantAVerser > 0
                          ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800"
                          : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                      }`}
                    >
                      <span className={simulationVersement.montantAVerser > 0 ? "text-green-800 dark:text-green-200" : "text-gray-600 dark:text-gray-400"}>
                        Montant à verser
                      </span>
                      <span className={simulationVersement.montantAVerser > 0 ? "text-green-700 dark:text-green-300 text-xl" : "text-gray-500 dark:text-gray-500 text-xl"}>
                        {simulationVersement.montantAVerser.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                ) : selectedTypeId ? (
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
                    <p className="text-sm text-red-700 dark:text-red-300">Impossible de charger la simulation.</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {showHistorique && (
            <div className="mt-4">
              <div id="cotisations-historique-print-root">
                <div className="no-print mb-3 flex items-center justify-end">
                  <Button onClick={handlePrintHistorique} size="sm" className="h-8">
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimer / PDF
                  </Button>
                </div>
                <HistoriqueCotisationsTable cotisations={historiqueCotisations} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

