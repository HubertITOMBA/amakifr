"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { HistoriqueCotisationsTable } from "@/components/user/HistoriqueCotisationsTable";
import { useUserProfile } from "@/hooks/use-user-profile";
import { getUserDataForAdminView } from "@/actions/user";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, CalendarDays, History, Printer, User } from "lucide-react";

export default function HistoriqueCotisationsPage() {
  const { data: session } = useSession();
  const { userProfile, loading: profileLoading } = useUserProfile();
  const searchParams = useSearchParams();
  const viewAsUserId = searchParams?.get("viewAs") ?? null;
  const isAdmin = (session?.user as any)?.role === "ADMIN";
  const isViewAsMode = Boolean(viewAsUserId && isAdmin);

  const [viewAsProfile, setViewAsProfile] = useState<any>(null);
  const [viewAsLoading, setViewAsLoading] = useState(false);
  const [historiqueCotisations, setHistoriqueCotisations] = useState<any[]>([]);
  const [historiqueFilterMois, setHistoriqueFilterMois] = useState<string>("all");
  const [historiqueFilterAnnee, setHistoriqueFilterAnnee] = useState<string>("all");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const adherent = isViewAsMode && viewAsProfile?.adherent ? viewAsProfile.adherent : (userProfile?.adherent as any);
  const loading = isViewAsMode ? viewAsLoading : profileLoading;

  const backToCotisationsHref = useMemo(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("section", "cotisations");
    const qs = params.toString();
    return qs ? `/user/profile?${qs}` : "/user/profile?section=cotisations";
  }, [searchParams]);

  useEffect(() => {
    if (!isViewAsMode || !viewAsUserId) {
      setViewAsProfile(null);
      return;
    }
    let cancelled = false;
    setViewAsLoading(true);
    getUserDataForAdminView(viewAsUserId)
      .then((res) => {
        if (!cancelled && res.success && res.user) setViewAsProfile(res.user);
        else if (!cancelled) setViewAsProfile(null);
      })
      .finally(() => {
        if (!cancelled) setViewAsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isViewAsMode, viewAsUserId]);

  useEffect(() => {
    if (!adherent?.CotisationsMensuelles) {
      setHistoriqueCotisations([]);
      return;
    }
    // FILTRE CRITIQUE : Exclure les lignes où l'adhérent payeur est le bénéficiaire (il ne doit pas payer son assistance)
    const list = [...(adherent.CotisationsMensuelles || [])]
      .filter((cot: any) => {
        const adherentBeneficiaireId = cot.adherentBeneficiaireId ?? cot.CotisationDuMois?.adherentBeneficiaireId;
        const typeNom = cot.TypeCotisation?.nom ?? '';
        const estAssistance = cot.TypeCotisation?.aBeneficiaire === true || (typeNom && String(typeNom).toLowerCase().includes('assistance'));
        if (estAssistance && adherentBeneficiaireId && cot.adherentId === adherentBeneficiaireId) {
          return false; // Exclure cette ligne
        }
        return true;
      })
      .sort(
        (a: any, b: any) => (b.annee !== a.annee ? b.annee - a.annee : b.mois - a.mois)
      );
    setHistoriqueCotisations(list);
  }, [adherent?.CotisationsMensuelles]);

  const filteredHistoriqueCotisations = useMemo(() => {
    return historiqueCotisations.filter((c: any) => {
      const matchMois = historiqueFilterMois === "all" || Number(c.mois) === Number(historiqueFilterMois);
      const matchAnnee = historiqueFilterAnnee === "all" || Number(c.annee) === Number(historiqueFilterAnnee);
      return matchMois && matchAnnee;
    });
  }, [historiqueCotisations, historiqueFilterMois, historiqueFilterAnnee]);

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  if (loading && !adherent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const viewAsLabel =
    isViewAsMode && viewAsProfile?.adherent
      ? [viewAsProfile.adherent.civility, viewAsProfile.adherent.firstname, viewAsProfile.adherent.lastname]
          .filter(Boolean)
          .join(" ")
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #historique-print-root,
          #historique-print-root * {
            visibility: visible !important;
          }
          #historique-print-root {
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

      <DynamicNavbar />

      <section className="py-8 sm:py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="no-print mb-6 flex flex-wrap items-center gap-3">
            <Link
              href={backToCotisationsHref}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors -ml-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux cotisations
            </Link>
            {viewAsLabel && (
              <Badge variant="secondary" className="gap-1.5 text-xs font-medium">
                <User className="h-3.5 w-3.5" />
                Vue admin : {viewAsLabel}
              </Badge>
            )}
          </div>

          <Card className="border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white">
              <CardTitle className="flex items-center gap-2 text-xl">
                <History className="h-5 w-5" />
                Historique des cotisations par mois
              </CardTitle>
              <CardDescription className="text-indigo-100 dark:text-indigo-200 mt-1">
                Détail de vos cotisations mensuelles et paiements. Utilisez l’impression du navigateur pour enregistrer en PDF.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 pb-6 px-6">
              <div id="historique-print-root">
                <div className="no-print flex flex-wrap items-center gap-3 mb-6">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Période
                  </Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-[220px] justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {historiqueFilterMois === "all" || historiqueFilterAnnee === "all"
                          ? "Tous les mois et années"
                          : format(
                              new Date(Number(historiqueFilterAnnee), Number(historiqueFilterMois) - 1, 1),
                              "MMMM yyyy",
                              { locale: fr }
                            ).replace(/^\w/, (c) => c.toUpperCase())}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" align="start">
                      <CalendarUI
                        mode="single"
                        selected={
                          historiqueFilterMois !== "all" && historiqueFilterAnnee !== "all"
                            ? new Date(Number(historiqueFilterAnnee), Number(historiqueFilterMois) - 1, 1)
                            : undefined
                        }
                        onSelect={(date) => {
                          if (date) {
                            setHistoriqueFilterMois(String(date.getMonth() + 1));
                            setHistoriqueFilterAnnee(String(date.getFullYear()));
                            setCalendarOpen(false);
                          }
                        }}
                        defaultMonth={
                          historiqueFilterMois !== "all" && historiqueFilterAnnee !== "all"
                            ? new Date(Number(historiqueFilterAnnee), Number(historiqueFilterMois) - 1, 1)
                            : new Date()
                        }
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 text-indigo-600 dark:text-indigo-400"
                    onClick={() => {
                      setHistoriqueFilterMois("all");
                      setHistoriqueFilterAnnee("all");
                    }}
                  >
                    Voir tout
                  </Button>
                  <Button onClick={handlePrint} className="ml-auto">
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimer / PDF
                  </Button>
                </div>

                <HistoriqueCotisationsTable cotisations={filteredHistoriqueCotisations} />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}
