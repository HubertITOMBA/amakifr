"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Euro, User, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCotisationsMensuellesByPeriode } from "@/actions/cotisations-mensuelles";
import { createPaiement } from "@/actions/paiements";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from "@tanstack/react-table";

const MOIS_OPTIONS = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Février" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Août" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Décembre" },
];

type CotisationRow = {
  id: string;
  periode: string;
  annee: number;
  mois: number;
  adherentId: string;
  montantAttendu: number;
  montantPaye: number;
  montantRestant: number;
  statut: string;
  TypeCotisation?: { nom: string };
  Adherent?: { firstname: string; lastname: string; User?: { email: string } };
  _count?: { Paiements: number };
};

const columnHelper = createColumnHelper<CotisationRow>();

interface PaiementCotisationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PaiementCotisationsDialog({
  open,
  onOpenChange,
  onSuccess,
}: PaiementCotisationsDialogProps) {
  const now = new Date();
  const [periode, setPeriode] = useState(() => {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
  });
  const [adherentFilter, setAdherentFilter] = useState("");
  const [cotisations, setCotisations] = useState<CotisationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payFormOpen, setPayFormOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CotisationRow | null>(null);
  const [payForm, setPayForm] = useState({
    montant: "",
    datePaiement: new Date().toISOString().split("T")[0],
    moyenPaiement: "Especes" as "Especes" | "Cheque" | "Virement" | "CarteBancaire",
    reference: "",
  });

  const loadCotisations = useCallback(async () => {
    if (!open || !periode) return;
    setLoading(true);
    try {
      const res = await getCotisationsMensuellesByPeriode(periode);
      if (res.success && res.data) {
        setCotisations(res.data as CotisationRow[]);
      } else {
        toast.error(res.error || "Erreur chargement");
        setCotisations([]);
      }
    } catch (e) {
      toast.error("Erreur chargement cotisations");
      setCotisations([]);
    } finally {
      setLoading(false);
    }
  }, [open, periode]);

  useEffect(() => {
    loadCotisations();
  }, [loadCotisations]);

  useEffect(() => {
    setGlobalFilter(adherentFilter);
  }, [adherentFilter]);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return {
        periode: false,
        type: false,
        montantAttendu: false,
        montantPaye: false,
        montantRestant: false,
        statut: false,
      };
    }
    return {};
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setColumnVisibility({
          periode: false,
          type: false,
          montantAttendu: false,
          montantPaye: false,
          montantRestant: false,
          statut: false,
        });
      } else {
        setColumnVisibility({});
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filteredData = useMemo(() => {
    return cotisations.filter((row) => {
      if (!globalFilter.trim()) return true;
      const q = globalFilter.trim().toLowerCase();
      const name = [row.Adherent?.firstname, row.Adherent?.lastname].filter(Boolean).join(" ");
      const email = row.Adherent?.User?.email || "";
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
    });
  }, [cotisations, globalFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("periode", {
        header: "Période",
        cell: ({ row }) => {
          const m = MOIS_OPTIONS.find((o) => o.value === row.original.mois);
          return (
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {m?.label ?? row.original.mois} {row.original.annee}
            </span>
          );
        },
        size: 100,
      }),
      columnHelper.accessor(
        (r) => `${r.Adherent?.firstname} ${r.Adherent?.lastname}`,
        {
          id: "adherent",
          header: "Adhérent",
          cell: ({ row }) => {
            const a = row.original.Adherent;
            const type = row.original.TypeCotisation?.nom;
            const restant = row.original.montantRestant;
            return (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {a?.firstname} {a?.lastname}
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 md:hidden ml-6">
                  {type} · Reste {restant.toFixed(2)} €
                </span>
              </div>
            );
          },
          size: 200,
        }
      ),
      columnHelper.accessor((r) => r.TypeCotisation?.nom, {
        id: "type",
        header: "Type",
        cell: ({ row }) => (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {row.original.TypeCotisation?.nom ?? "—"}
          </span>
        ),
        size: 140,
      }),
      columnHelper.accessor("montantAttendu", {
        header: "Attendu",
        cell: ({ row }) => (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {row.original.montantAttendu.toFixed(2)} €
          </span>
        ),
        size: 90,
      }),
      columnHelper.accessor("montantPaye", {
        header: "Payé",
        cell: ({ row }) => (
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            {row.original.montantPaye.toFixed(2)} €
          </span>
        ),
        size: 90,
      }),
      columnHelper.accessor("montantRestant", {
        header: "Restant",
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {row.original.montantRestant.toFixed(2)} €
          </span>
        ),
        size: 90,
      }),
      columnHelper.accessor("statut", {
        header: "Statut",
        cell: ({ row }) => {
          const s = row.original.statut;
          const cls =
            s === "Paye"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : s === "PartiellementPaye"
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
          return <Badge className={cls}>{s}</Badge>;
        },
        size: 120,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const c = row.original;
          const restant = c.montantRestant;
          const isPaying = payingId === c.id;
          const openPay = () => {
            setSelectedRow(c);
            setPayForm({
              montant: restant > 0 ? restant.toFixed(2) : "",
              datePaiement: new Date().toISOString().split("T")[0],
              moyenPaiement: "Especes",
              reference: "",
            });
            setPayFormOpen(true);
          };
          if (restant <= 0) {
            return (
              <span className="text-xs text-gray-500 dark:text-gray-400">Payé</span>
            );
          }
          return (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs"
              onClick={openPay}
              disabled={isPaying}
            >
              {isPaying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Euro className="h-3 w-3 mr-1" />
                  Payer
                </>
              )}
            </Button>
          );
        },
        size: 100,
      }),
    ],
    [payingId]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    defaultColumn: { minSize: 50, maxSize: 400 },
  });

  const handleSubmitPay = async () => {
    if (!selectedRow || !payForm.montant) {
      toast.error("Montant requis");
      return;
    }
    const montant = parseFloat(payForm.montant.replace(",", "."));
    if (isNaN(montant) || montant <= 0) {
      toast.error("Montant invalide");
      return;
    }
    setPayingId(selectedRow.id);
    try {
      const result = await createPaiement({
        adherentId: selectedRow.adherentId,
        montant,
        datePaiement: payForm.datePaiement,
        moyenPaiement: payForm.moyenPaiement,
        reference: payForm.reference || undefined,
        cotisationMensuelleId: selectedRow.id,
      });
      if (result.success) {
        toast.success(result.message);
        setPayFormOpen(false);
        setSelectedRow(null);
        loadCotisations();
        onSuccess?.();
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl"
          aria-describedby="dialog-desc-cotisations"
        >
          <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-3">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Saisie des paiements par cotisation
            </DialogTitle>
            <DialogDescription id="dialog-desc-cotisations" className="text-sm text-gray-500 dark:text-gray-400">
              Liste des cotisations mensuelles. Filtrer par mois et par adhérent, puis cliquer sur Payer pour enregistrer un paiement manuel (synchronisé avec paiements_cotisation).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-3 flex-1 min-h-0">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="periode-mois" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  Mois
                </Label>
                <Select
                  value={periode}
                  onValueChange={setPeriode}
                >
                  <SelectTrigger id="periode-mois" className="w-[180px] bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const d = new Date(now.getFullYear(), now.getMonth() - 12 + i, 1);
                      const y = d.getFullYear();
                      const m = d.getMonth() + 1;
                      const val = `${y}-${String(m).padStart(2, "0")}`;
                      const label = `${MOIS_OPTIONS[m - 1]?.label ?? m} ${y}`;
                      return (
                        <SelectItem key={val} value={val} className="text-gray-900 dark:text-gray-100">
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un adhérent (nom, email)..."
                  value={adherentFilter}
                  onChange={(e) => setAdherentFilter(e.target.value)}
                  className="pl-8 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
                </div>
              ) : filteredData.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
                  Aucune cotisation pour ce mois ou ce filtre.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[320px] md:min-w-0">
                    <thead>
                      {table.getHeaderGroups().map((hg) => (
                        <tr key={hg.id} className="bg-emerald-100/80 dark:bg-emerald-900/30 border-b border-emerald-200 dark:border-emerald-800">
                          {hg.headers.map((h) => {
                            const isMobileOnly = h.column.id !== "adherent" && h.column.id !== "actions";
                            return (
                              <th
                                key={h.id}
                                className={`text-left px-2 py-2 font-semibold text-emerald-900 dark:text-emerald-100 text-xs uppercase tracking-wider ${isMobileOnly ? "hidden md:table-cell" : ""}`}
                                style={{ width: h.getSize(), minWidth: isMobileOnly ? undefined : h.getSize() }}
                              >
                                {flexRender(h.column.columnDef.header, h.getContext())}
                              </th>
                            );
                          })}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.map((row, idx) => (
                        <tr
                          key={row.id}
                          className={`border-b border-gray-200 dark:border-gray-700 ${
                            idx % 2 === 0
                              ? "bg-white dark:bg-gray-900"
                              : "bg-gray-50/50 dark:bg-gray-800/50"
                          } hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10`}
                        >
                          {row.getVisibleCells().map((cell) => {
                            const isMobileOnly = cell.column.id !== "adherent" && cell.column.id !== "actions";
                            return (
                              <td
                                key={cell.id}
                                className={`px-2 py-2 text-gray-900 dark:text-gray-100 align-top ${isMobileOnly ? "hidden md:table-cell" : ""}`}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {filteredData.length} cotisation(s) · Mois par défaut : mois en cours
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={payFormOpen} onOpenChange={setPayFormOpen}>
        <DialogContent className="max-w-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-base text-gray-900 dark:text-gray-100">
              Enregistrer le paiement
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              {selectedRow && (
                <> {selectedRow.Adherent?.firstname} {selectedRow.Adherent?.lastname} · {selectedRow.TypeCotisation?.nom} · Reste {selectedRow.montantRestant.toFixed(2)} €</>
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
              <Button variant="outline" onClick={() => setPayFormOpen(false)} className="text-gray-700 dark:text-gray-300">
                Annuler
              </Button>
              <Button
                onClick={handleSubmitPay}
                disabled={payingId !== null}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {payingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
