"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Search, Calendar, Printer, Eye, Loader2, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getRapportsReunionForAdherents,
  getRapportReunionById,
} from "@/actions/rapports-reunion";
import { toast } from "sonner";
import {
  escapeHtmlText,
  htmlToPlainExcerpt,
  sanitizeRapportHtml,
} from "@/lib/rapports-reunion/html-excerpt";

type RapportListItem = {
  id: string;
  titre: string;
  dateReunion: string | Date;
  contenu: string;
  createdAt: string | Date;
  CreatedBy?: { id: string; name: string | null } | null;
};

/**
 * Liste adhérent des rapports de réunion — lecture seule, HTML TipTap.
 */
function RapportsReunionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [rapports, setRapports] = useState<RapportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedRapport, setSelectedRapport] = useState<RapportListItem | null>(
    null
  );
  const [viewLoading, setViewLoading] = useState(false);

  const loadRapports = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const result = await getRapportsReunionForAdherents();
      if (result.success && result.rapports) {
        setRapports(result.rapports as RapportListItem[]);
      } else {
        const msg = result.error || "Erreur lors du chargement";
        setLoadError(msg);
        toast.error(msg);
        setRapports([]);
      }
    } catch (error) {
      console.error("Erreur:", error);
      const msg = "Erreur lors du chargement des rapports";
      setLoadError(msg);
      toast.error(msg);
      setRapports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleView = useCallback(async (rapportId: string) => {
    try {
      setViewLoading(true);
      const result = await getRapportReunionById(rapportId);
      if (result.success && result.rapport) {
        setSelectedRapport(result.rapport as RapportListItem);
        setShowViewDialog(true);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement du rapport");
    } finally {
      setViewLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRapports();
  }, [loadRapports]);

  useEffect(() => {
    const viewId = searchParams.get("view")?.trim();
    if (!viewId || loading) return;
    void handleView(viewId);
    router.replace("/rapports-reunion", { scroll: false });
  }, [searchParams, loading, handleView, router]);

  const handlePrint = (rapport: RapportListItem) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenêtre d'impression");
      return;
    }
    const safeHtml = sanitizeRapportHtml(String(rapport.contenu || ""));
    const safeTitle = escapeHtmlText(rapport.titre);
    const authorName = rapport.CreatedBy?.name
      ? escapeHtmlText(rapport.CreatedBy.name)
      : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${safeTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
            .meta { color: #666; margin-bottom: 20px; }
            .contenu { line-height: 1.6; word-break: break-word; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>${safeTitle}</h1>
          <div class="meta">
            <p><strong>Date de la réunion :</strong> ${format(new Date(rapport.dateReunion), "dd MMMM yyyy", { locale: fr })}</p>
            <p><strong>Créé le :</strong> ${format(new Date(rapport.createdAt), "dd MMMM yyyy à HH:mm", { locale: fr })}</p>
            ${authorName ? `<p><strong>Créé par :</strong> ${authorName}</p>` : ""}
          </div>
          <div class="contenu">${safeHtml}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const filteredRapports = rapports.filter((rapport) => {
    if (!searchTerm.trim()) return true;
    const search = searchTerm.toLowerCase();
    const excerpt = htmlToPlainExcerpt(rapport.contenu, 500).toLowerCase();
    return (
      rapport.titre.toLowerCase().includes(search) ||
      excerpt.includes(search) ||
      (rapport.CreatedBy?.name || "").toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <DynamicNavbar />

      <section className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <header className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
              Comptes rendus de réunion
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl">
              Consultez les rapports rédigés après les réunions mensuelles.
            </p>
          </header>

          <Card className="shadow-lg border-blue-200 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 sm:py-5">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="h-5 w-5 shrink-0" aria-hidden />
                Rapports disponibles
                {!loading && !loadError ? (
                  <span className="font-normal opacity-90">
                    ({filteredRapports.length})
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="mb-5 sm:mb-6">
                <label htmlFor="rapports-search" className="sr-only">
                  Rechercher un rapport
                </label>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
                    aria-hidden
                  />
                  <Input
                    id="rapports-search"
                    placeholder="Rechercher par titre, auteur ou contenu…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>

              {loading || viewLoading ? (
                <div
                  className="flex flex-col items-center justify-center py-14 gap-3"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-sm text-slate-600">Chargement des rapports…</p>
                </div>
              ) : loadError ? (
                <div
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center"
                  role="alert"
                >
                  <p className="text-sm font-medium text-red-800">{loadError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 border-red-300 text-red-800 hover:bg-red-100"
                    onClick={() => void loadRapports()}
                  >
                    Réessayer
                  </Button>
                </div>
              ) : filteredRapports.length === 0 ? (
                <div className="text-center py-12 px-2">
                  <FileText
                    className="h-12 w-12 mx-auto text-slate-300 mb-3"
                    aria-hidden
                  />
                  <p className="text-slate-700 font-medium">
                    {searchTerm
                      ? "Aucun rapport ne correspond à votre recherche"
                      : "Aucun compte rendu disponible pour le moment"}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    {searchTerm
                      ? "Essayez d’autres mots-clés."
                      : "Les rapports apparaîtront ici une fois rédigés par le bureau."}
                  </p>
                </div>
              ) : (
                <ul className="space-y-3 sm:space-y-4" role="list">
                  {filteredRapports.map((rapport) => {
                    const excerpt = htmlToPlainExcerpt(rapport.contenu, 180);
                    return (
                      <li key={rapport.id}>
                        <article className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1 space-y-2">
                              <h2 className="text-lg sm:text-xl font-semibold text-slate-900 leading-snug">
                                {rapport.titre}
                              </h2>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600">
                                <span className="inline-flex items-center gap-1.5">
                                  <Calendar
                                    className="h-3.5 w-3.5 text-blue-600 shrink-0"
                                    aria-hidden
                                  />
                                  <time
                                    dateTime={new Date(
                                      rapport.dateReunion
                                    ).toISOString()}
                                  >
                                    {format(
                                      new Date(rapport.dateReunion),
                                      "dd MMMM yyyy",
                                      { locale: fr }
                                    )}
                                  </time>
                                </span>
                                {rapport.CreatedBy?.name ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <User
                                      className="h-3.5 w-3.5 text-slate-400 shrink-0"
                                      aria-hidden
                                    />
                                    {rapport.CreatedBy.name}
                                  </span>
                                ) : null}
                              </div>
                              {excerpt ? (
                                <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                                  {excerpt}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 sm:flex-col sm:items-stretch shrink-0">
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none"
                                onClick={() => void handleView(rapport.id)}
                              >
                                <Eye className="h-4 w-4 mr-2" aria-hidden />
                                Lire
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="flex-1 sm:flex-none"
                                onClick={() => handlePrint(rapport)}
                              >
                                <Printer className="h-4 w-4 mr-2" aria-hidden />
                                Imprimer
                              </Button>
                            </div>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Dialog
        open={showViewDialog}
        onOpenChange={(open) => {
          setShowViewDialog(open);
          if (!open) setSelectedRapport(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl pr-6">
              {selectedRapport?.titre}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 mt-2 text-sm text-slate-600">
                {selectedRapport ? (
                  <>
                    <p>
                      <span className="font-medium text-slate-800">
                        Date de la réunion :
                      </span>{" "}
                      {format(
                        new Date(selectedRapport.dateReunion),
                        "dd MMMM yyyy",
                        { locale: fr }
                      )}
                    </p>
                    <p>
                      <span className="font-medium text-slate-800">
                        Créé le :
                      </span>{" "}
                      {format(
                        new Date(selectedRapport.createdAt),
                        "dd MMMM yyyy à HH:mm",
                        { locale: fr }
                      )}
                    </p>
                    {selectedRapport.CreatedBy?.name ? (
                      <p>
                        <span className="font-medium text-slate-800">
                          Créé par :
                        </span>{" "}
                        {selectedRapport.CreatedBy.name}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div
            className="mt-2 prose prose-sm max-w-none bg-slate-50 p-4 sm:p-5 rounded-lg border border-slate-200 text-slate-900 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: sanitizeRapportHtml(
                String(selectedRapport?.contenu || "")
              ),
            }}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowViewDialog(false)}
            >
              Fermer
            </Button>
            {selectedRapport ? (
              <Button type="button" onClick={() => handlePrint(selectedRapport)}>
                <Printer className="h-4 w-4 mr-2" aria-hidden />
                Imprimer
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}

export default function RapportsReunionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <RapportsReunionContent />
    </Suspense>
  );
}
