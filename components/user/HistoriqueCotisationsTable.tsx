"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  createColumnHelper,
} from "@tanstack/react-table";

export interface HistoriqueCotisation {
  id: string;
  periode: string;
  annee: number;
  mois: number;
  montantAttendu: number;
  montantPaye: number;
  montantRestant: number;
  statut: string;
  description?: string;
  TypeCotisation?: { nom: string; aBeneficiaire?: boolean };
  AdherentBeneficiaire?: { civility?: string | null; firstname?: string; lastname?: string };
  CotisationDuMois?: { AdherentBeneficiaire?: { civility?: string | null; firstname?: string; lastname?: string } };
  Paiements: Array<{
    id: string;
    montant: number;
    datePaiement: Date | string;
    moyenPaiement: string;
    reference?: string;
    description?: string;
    CreatedBy?: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

export function HistoriqueCotisationsTable({ cotisations }: { cotisations: HistoriqueCotisation[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "periode", desc: true }]);

  const columnHelper = createColumnHelper<HistoriqueCotisation>();

  const columns = useMemo<ColumnDef<HistoriqueCotisation>[]>(
    () => [
      columnHelper.accessor("periode", {
        header: "Mois",
        cell: ({ row }) => {
          const { annee, mois } = row.original;
          const date = new Date(annee, mois - 1, 1);
          const nomMois = date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
          return (
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
              {nomMois.charAt(0).toUpperCase() + nomMois.slice(1)}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "description",
        header: "Description",
        cell: ({ row }) => {
          const o = row.original;
          const desc = o.description;
          const typeNom = o.TypeCotisation?.nom;
          const estAssistance =
            o.TypeCotisation?.aBeneficiaire === true ||
            (typeNom && String(typeNom).toLowerCase().includes("assistance"));
          const benef = o.AdherentBeneficiaire ?? o.CotisationDuMois?.AdherentBeneficiaire;
          let label: string;
          if (estAssistance && benef) {
            const parts = [benef.civility, benef.firstname, benef.lastname].filter(Boolean);
            label = parts.length > 0 ? `${typeNom ?? ""} - ${parts.join(" ")}` : (desc || typeNom || "—");
          } else {
            label = desc || typeNom || "—";
          }
          return (
            <span className="block text-xs text-gray-700 dark:text-gray-300 text-left" title={label}>
              {label}
            </span>
          );
        },
      }),
      columnHelper.accessor("montantAttendu", {
        header: "Montant Attendu",
        cell: ({ row }) => {
          const montant = row.getValue("montantAttendu") as number;
          return (
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {montant.toFixed(2).replace(".", ",")} €
            </span>
          );
        },
      }),
      columnHelper.accessor("montantRestant", {
        header: "Restant",
        cell: ({ row }) => {
          const restant = row.getValue("montantRestant") as number;
          return (
            <span
              className={`text-xs font-medium ${restant > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
            >
              {restant.toFixed(2).replace(".", ",")} €
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "paiements",
        header: "Total Payé",
        cell: ({ row }) => {
          const paiements = row.original.Paiements || [];
          const totalPaye = paiements.reduce((sum: number, p: { montant: number }) => sum + p.montant, 0);
          if (totalPaye === 0) {
            return (
              <span className="text-xs text-gray-400 dark:text-gray-500">Aucun paiement</span>
            );
          }
          return (
            <div className="text-center">
              <span className="text-xs font-bold text-green-600 dark:text-green-400">
                {totalPaye.toFixed(2).replace(".", ",")} €
              </span>
              {paiements.length > 1 && (
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  ({paiements.length} paiement{paiements.length > 1 ? "s" : ""})
                </div>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor("statut", {
        header: "Statut",
        cell: ({ row }) => {
          const restant = row.original.montantRestant;
          const getStatusBadge = () => {
            if (restant === 0) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
            if (restant < row.original.montantAttendu)
              return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
            return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
          };
          return (
            <Badge className={getStatusBadge()}>
              {restant === 0 ? "Payée" : restant < row.original.montantAttendu ? "Partielle" : "En attente"}
            </Badge>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: cotisations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-full align-middle">
        <Table className="min-w-[640px] w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-indigo-50 dark:bg-indigo-900/20">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={[
                      "font-semibold text-xs px-2 py-1.5",
                      header.column.id === "description" ? "text-left" : "text-center",
                    ].join(" ")}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              <>
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={[
                          "text-xs px-2 py-1.5",
                          cell.column.id === "description" ? "text-left" : "text-center",
                        ].join(" ")}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="bg-indigo-100/50 dark:bg-indigo-900/30 border-t-2 border-indigo-200 dark:border-indigo-800 font-semibold">
                  <TableCell
                    colSpan={2}
                    className="text-center text-xs px-2 py-2 text-gray-900 dark:text-gray-100"
                  >
                    Total
                  </TableCell>
                  <TableCell className="text-center text-xs px-2 py-2 text-gray-900 dark:text-gray-100">
                    {cotisations
                      .reduce((s, c) => s + Number(c.montantAttendu), 0)
                      .toFixed(2)
                      .replace(".", ",")}{" "}
                    €
                  </TableCell>
                  <TableCell className="text-center text-xs px-2 py-2 text-red-600 dark:text-red-400">
                    {cotisations
                      .reduce((s, c) => s + Number(c.montantRestant), 0)
                      .toFixed(2)
                      .replace(".", ",")}{" "}
                    €
                  </TableCell>
                  <TableCell className="text-center text-xs px-2 py-2 text-green-600 dark:text-green-400">
                    {cotisations
                      .reduce((s, c) => s + (c.Paiements || []).reduce((sp: number, p: { montant: number }) => sp + Number(p.montant), 0), 0)
                      .toFixed(2)
                      .replace(".", ",")}{" "}
                    €
                  </TableCell>
                  <TableCell className="text-center text-xs px-2 py-2" />
                </TableRow>
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <History className="h-8 w-8 text-gray-400" />
                    <p className="text-gray-500 text-sm">Aucun historique de cotisation disponible.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
