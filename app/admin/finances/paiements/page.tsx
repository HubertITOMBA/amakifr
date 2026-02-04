"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Search, Euro, ArrowLeft, MoreHorizontal, Loader2, CalendarDays, Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { createPaiement } from "@/actions/paiements";
import { getCotisationsMensuellesByPeriode } from "@/actions/cotisations-mensuelles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  createColumnHelper,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import { ColumnVisibilityToggle } from "@/components/admin/ColumnVisibilityToggle";

const MOIS_LABELS: Record<number, string> = { 1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril", 5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août", 9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre" };

const columnHelper = createColumnHelper<any>();

export default function AdminPaiementsPage() {
  // Cotisations mensuelles (vue principale)
  const now = new Date();
  const [periode, setPeriode] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [adherentFilterCotisations, setAdherentFilterCotisations] = useState("");
  const [cotisations, setCotisations] = useState<any[]>([]);
  const [loadingCotisations, setLoadingCotisations] = useState(true);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedCotisationForPay, setSelectedCotisationForPay] = useState<any | null>(null);
  const [payForm, setPayForm] = useState({
    montant: "",
    datePaiement: new Date().toISOString().split("T")[0],
    moyenPaiement: "Especes" as "Especes" | "Cheque" | "Virement" | "CarteBancaire",
    reference: "",
  });
  const [payingId, setPayingId] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCotisationForDetail, setSelectedCotisationForDetail] = useState<any | null>(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("admin-paiements-cotisations-column-visibility");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Object.keys(parsed).length > 0) return parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }
    return { type: false };
  });

  const loadCotisations = useCallback(async () => {
    try {
      setLoadingCotisations(true);
      const res = await getCotisationsMensuellesByPeriode(periode);
      if (res.success && res.data) {
        setCotisations(res.data);
      } else {
        setCotisations([]);
      }
    } catch (e) {
      setCotisations([]);
    } finally {
      setLoadingCotisations(false);
    }
  }, [periode]);

  useEffect(() => {
    loadCotisations();
  }, [loadCotisations]);

  // Filtrer les cotisations par adhérent
  const filteredCotisations = useMemo(() => {
    if (!adherentFilterCotisations.trim()) return cotisations;
    const q = adherentFilterCotisations.trim().toLowerCase();
    return cotisations.filter((c) => {
      const name = [c.Adherent?.firstname, c.Adherent?.lastname].filter(Boolean).join(" ");
      const email = c.Adherent?.User?.email || "";
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
    });
  }, [cotisations, adherentFilterCotisations]);

  const totals = useMemo(() => {
    let attendu = 0, paye = 0, restant = 0;
    filteredCotisations.forEach((c) => {
      attendu += Number(c.montantAttendu ?? 0);
      paye += Number(c.montantPaye ?? 0);
      restant += Number(c.montantRestant ?? 0);
    });
    return { attendu, paye, restant };
  }, [filteredCotisations]);

  const columns = useMemo(
    () => [
      columnHelper.accessor((r) => `${r.mois}-${r.annee}`, {
        id: "periode",
        header: "Période",
        cell: ({ row }) => (
          <span className="text-gray-900 dark:text-gray-100">
            {MOIS_LABELS[row.original.mois] ?? row.original.mois} {row.original.annee}
          </span>
        ),
      }),
      columnHelper.accessor("Adherent", {
        id: "adherent",
        header: "Adhérent",
        cell: ({ row }) => (
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {row.original.Adherent?.firstname} {row.original.Adherent?.lastname}
          </span>
        ),
      }),
      columnHelper.accessor("description", {
        id: "description",
        header: "Description",
        cell: ({ row }) => {
          const c = row.original;
          const label = c.description ?? c.TypeCotisation?.nom ?? (c.mois != null && c.annee != null ? `Cotisation ${MOIS_LABELS[c.mois] ?? c.mois} ${c.annee}` : "—");
          return <span className="text-gray-700 dark:text-gray-300" title={label}>{label}</span>;
        },
      }),
      columnHelper.accessor("TypeCotisation", {
        id: "type",
        header: "Type",
        cell: ({ row }) => (
          <span className="text-gray-700 dark:text-gray-300">{row.original.TypeCotisation?.nom ?? "—"}</span>
        ),
      }),
      columnHelper.accessor("montantAttendu", {
        id: "attendu",
        header: "Attendu",
        cell: ({ row }) => (
          <span className="text-gray-700 dark:text-gray-300">{Number(row.original.montantAttendu).toFixed(2)} €</span>
        ),
      }),
      columnHelper.accessor("montantPaye", {
        id: "paye",
        header: "Payé",
        cell: ({ row }) => (
          <span className="text-green-600 dark:text-green-400 font-medium">{Number(row.original.montantPaye).toFixed(2)} €</span>
        ),
      }),
      columnHelper.accessor("montantRestant", {
        id: "restant",
        header: "Restant",
        cell: ({ row }) => (
          <span className="text-gray-900 dark:text-gray-100 font-semibold">{Number(row.original.montantRestant).toFixed(2)} €</span>
        ),
      }),
      columnHelper.accessor("statut", {
        id: "statut",
        header: "Statut",
        cell: ({ row }) => (
          <Badge
            className={
              row.original.statut === "Paye"
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : row.original.statut === "PartiellementPaye"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                  : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            }
          >
            {row.original.statut}
          </Badge>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        meta: { forceVisible: true },
        cell: ({ row }) => {
          const c = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 data-[state=open]:bg-emerald-100 dark:data-[state=open]:bg-emerald-900/40" aria-label="Menu actions">
                  <MoreHorizontal className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-gray-900 dark:text-gray-100"
                  onClick={() => {
                    setSelectedCotisationForDetail(c);
                    setDetailDialogOpen(true);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Voir les détails
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer text-gray-900 dark:text-gray-100"
                  onClick={() => openPaiementManuel(c)}
                  disabled={Number(c.montantRestant) <= 0}
                >
                  <Euro className="h-4 w-4 mr-2" />
                  Paiement manuel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredCotisations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnVisibility) : updater;
      setColumnVisibility(next);
      try {
        localStorage.setItem("admin-paiements-cotisations-column-visibility", JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
    },
    state: { columnVisibility, pagination },
    onPaginationChange: setPagination,
    initialState: { pagination: { pageSize: 10 } },
  });

  const openPaiementManuel = (row: any) => {
    setSelectedCotisationForPay(row);
    const restant = Number(row.montantRestant ?? 0);
    setPayForm({
      montant: restant > 0 ? restant.toFixed(2) : "",
      datePaiement: new Date().toISOString().split("T")[0],
      moyenPaiement: "Especes",
      reference: "",
    });
    setPayDialogOpen(true);
  };

  const handleSubmitPaiementManuel = async () => {
    if (!selectedCotisationForPay || !payForm.montant) {
      toast.error("Montant requis");
      return;
    }
    const montant = parseFloat(payForm.montant.replace(",", "."));
    if (isNaN(montant) || montant <= 0) {
      toast.error("Montant invalide");
      return;
    }
    setPayingId(selectedCotisationForPay.id);
    try {
      const result = await createPaiement({
        adherentId: selectedCotisationForPay.adherentId,
        montant,
        datePaiement: payForm.datePaiement,
        moyenPaiement: payForm.moyenPaiement,
        reference: payForm.reference || undefined,
        cotisationMensuelleId: selectedCotisationForPay.id,
      });
      if (result.success) {
        toast.success(result.message);
        setPayDialogOpen(false);
        setSelectedCotisationForPay(null);
        loadCotisations();
      } else {
        toast.error(result.error || "Erreur");
      }
    } catch (e) {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="p-4 sm:p-6">
        <div className="mb-4">
          <Link href="/admin/finances">
            <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-300">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
        </div>

        {/* Section Cotisations mensuelles (vue principale) */}
        <Card className="mx-auto max-w-screen-2xl w-full shadow-lg border-2 border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-gray-900 mb-6 !py-0">
          <CardHeader className="bg-gradient-to-r from-green-500/90 via-emerald-400/80 to-green-500/90 dark:from-green-700/50 dark:via-emerald-600/40 dark:to-green-700/50 text-white pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6 gap-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-white">
                  Paiement en espèce de cotisations ({filteredCotisations.length})
                </CardTitle>
                <p className="text-sm text-emerald-100 dark:text-emerald-200/90 mt-1">
                  Enregistrer ici les cotisations en espèces.
                </p>
              </div>
              <ColumnVisibilityToggle table={table} storageKey="admin-paiements-cotisations-column-visibility" />
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6 pb-4">
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Mois</label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[180px] justify-start text-left font-normal bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {(() => {
                        const [y, m] = periode.split("-").map(Number);
                        return `${MOIS_LABELS[m] ?? m} ${y}`;
                      })()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" align="start">
                    <Calendar
                      mode="single"
                      selected={(() => {
                        const [y, m] = periode.split("-").map(Number);
                        return new Date(y, (m ?? 1) - 1, 1);
                      })()}
                      onSelect={(date) => {
                        if (date) {
                          const y = date.getFullYear();
                          const m = date.getMonth() + 1;
                          setPeriode(`${y}-${String(m).padStart(2, "0")}`);
                          setCalendarOpen(false);
                        }
                      }}
                      defaultMonth={(() => {
                        const [y, m] = periode.split("-").map(Number);
                        return new Date(y ?? now.getFullYear(), (m ?? now.getMonth() + 1) - 1, 1);
                      })()}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Filtrer par adhérent (nom, email)..."
                  value={adherentFilterCotisations}
                  onChange={(e) => setAdherentFilterCotisations(e.target.value)}
                  className="pl-9 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            {loadingCotisations ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
              </div>
            ) : (
              <>
                <DataTable table={table} emptyMessage="Aucune cotisation pour ce mois ou ce filtre." headerColor="green" compact headerUppercase={false} headerBold />
                {filteredCotisations.length > 0 && (
                  <>
                    <div className="mt-4 flex flex-wrap items-center gap-4 sm:gap-6 py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700">
                      <span>Total attendu : <span className="text-gray-900 dark:text-gray-100">{totals.attendu.toFixed(2)} €</span></span>
                      <span>Total payé : <span className="text-green-600 dark:text-green-400">{totals.paye.toFixed(2)} €</span></span>
                      <span>Total restant : <span className="text-gray-900 dark:text-gray-100">{totals.restant.toFixed(2)} €</span></span>
                    </div>
                    <div className="hidden md:flex flex-col sm:flex-row items-center justify-between gap-3 py-4 font-semibold rounded-xl border border-gray-200 dark:border-gray-700 px-4 sm:px-6">
                      <div className="text-xs sm:text-sm text-muted-foreground dark:text-gray-400">
                        {table.getFilteredRowModel().rows.length} ligne(s) au total
                      </div>
                      <div className="flex items-center space-x-4 sm:space-x-6">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Lignes par page</p>
                          <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(v) => table.setPageSize(Number(v))}
                          >
                            <SelectTrigger className="h-8 w-[70px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent side="top">
                              {[10, 20, 30, 40, 50].map((size) => (
                                <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="icon" className="h-8 w-8 hidden lg:flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} aria-label="Première page">
                            <ChevronsLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Page précédente">
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Page suivante">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8 hidden lg:flex" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} aria-label="Dernière page">
                            <ChevronsRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

      {/* Dialog Paiement manuel (depuis la liste cotisations, adhérent déjà connu) */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-base text-gray-900 dark:text-gray-100">
              Paiement en espèce
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              {selectedCotisationForPay && (
                <> {selectedCotisationForPay.Adherent?.firstname} {selectedCotisationForPay.Adherent?.lastname} · {selectedCotisationForPay.TypeCotisation?.nom} · Reste {Number(selectedCotisationForPay.montantRestant).toFixed(2)} €</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-sm text-gray-700 dark:text-gray-300">Montant (€) *</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={payForm.montant}
                onChange={(e) => setPayForm((p) => ({ ...p, montant: e.target.value }))}
                placeholder="0,00"
                className="mt-1 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <Label className="text-sm text-gray-700 dark:text-gray-300">Date</Label>
              <Input
                type="date"
                value={payForm.datePaiement}
                onChange={(e) => setPayForm((p) => ({ ...p, datePaiement: e.target.value }))}
                className="mt-1 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <Label className="text-sm text-gray-700 dark:text-gray-300">Moyen</Label>
              <Select
                value={payForm.moyenPaiement}
                onValueChange={(v: "Especes" | "Cheque" | "Virement" | "CarteBancaire") =>
                  setPayForm((p) => ({ ...p, moyenPaiement: v }))
                }
              >
                <SelectTrigger className="mt-1 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Especes">Espèces</SelectItem>
                  <SelectItem value="Cheque">Chèque</SelectItem>
                  <SelectItem value="Virement">Virement</SelectItem>
                  <SelectItem value="CarteBancaire">Carte bancaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-gray-700 dark:text-gray-300">Référence</Label>
              <Input
                value={payForm.reference}
                onChange={(e) => setPayForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="N° chèque, virement..."
                className="mt-1 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPayDialogOpen(false)} className="text-gray-700 dark:text-gray-300">
                Annuler
              </Button>
              <Button
                onClick={handleSubmitPaiementManuel}
                disabled={payingId !== null}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {payingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

        {/* Dialog Voir les détails (cotisation) */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-base text-gray-900 dark:text-gray-100">Détails de la cotisation</DialogTitle>
              <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
                Informations de la cotisation mensuelle
              </DialogDescription>
            </DialogHeader>
            {selectedCotisationForDetail && (
              <div className="space-y-4 pt-2">
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Période</Label>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {MOIS_LABELS[selectedCotisationForDetail.mois] ?? selectedCotisationForDetail.mois} {selectedCotisationForDetail.annee}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Adhérent</Label>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {selectedCotisationForDetail.Adherent?.firstname} {selectedCotisationForDetail.Adherent?.lastname}
                  </p>
                  {selectedCotisationForDetail.Adherent?.User?.email && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">{selectedCotisationForDetail.Adherent.User.email}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Description</Label>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {selectedCotisationForDetail.description ?? selectedCotisationForDetail.TypeCotisation?.nom ?? (selectedCotisationForDetail.mois != null && selectedCotisationForDetail.annee != null ? `Cotisation ${MOIS_LABELS[selectedCotisationForDetail.mois] ?? selectedCotisationForDetail.mois} ${selectedCotisationForDetail.annee}` : "—")}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</Label>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selectedCotisationForDetail.TypeCotisation?.nom ?? "—"}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Attendu</Label>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{Number(selectedCotisationForDetail.montantAttendu).toFixed(2)} €</p>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Payé</Label>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">{Number(selectedCotisationForDetail.montantPaye).toFixed(2)} €</p>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Restant</Label>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{Number(selectedCotisationForDetail.montantRestant).toFixed(2)} €</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Statut</Label>
                  <Badge
                    className={
                      selectedCotisationForDetail.statut === "Paye"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : selectedCotisationForDetail.statut === "PartiellementPaye"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                    }
                  >
                    {selectedCotisationForDetail.statut}
                  </Badge>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

