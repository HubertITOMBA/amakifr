"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actionListNotesFraisComptabilite } from "@/actions/frais-avances";
import { isNotesFraisEnabledClientHint } from "@/lib/frais-avances/feature-flag-client";
import {
  NoteFraisEtatFinancierBadge,
  NoteFraisModeBadge,
  NoteFraisMontantBadge,
  NoteFraisStatutBadge,
} from "@/components/frais-avances/note-frais-badges";

type Row = {
  noteId: string;
  libelle: string;
  statut: string;
  montantAccepte: string;
  montantDemande: string;
  modeChoix: string | null;
  etatFinancier: string | null;
  alerteEtatFinancier?: boolean;
  restantDu: string | null;
  montantRembourseUtilise: string;
  montantCompensationUtilise: string;
  adherentLabel: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

/**
 * Liste comptable paginée — sans justificatifs / description / référence.
 */
export default function AdminFraisAvancesComptabilitePage() {
  const enabledHint = isNotesFraisEnabledClientHint();
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    pageCount: 0,
  });
  const [etat, setEtat] = useState("all");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabledHint) return;
    void (async () => {
      const res = await actionListNotesFraisComptabilite({
        etatFinancier: etat as
          | "all"
          | "NON_REGLEE"
          | "PARTIELLEMENT_REGLEE"
          | "REGLEE",
        page,
        pageSize: 20,
      });
      if (!res.success) {
        setError(res.error);
        setRows([]);
        return;
      }
      const payload = res.data as { items: Row[]; pagination: Pagination };
      setRows(payload.items);
      setPagination(payload.pagination);
      setError(null);
    })();
  }, [etat, page, enabledHint]);

  if (!enabledHint) {
    return (
      <div className="p-4 sm:p-8">
        <p
          className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3"
          role="status"
        >
          Module indisponible.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 sm:p-8">
      <Card className="mx-auto max-w-5xl border-emerald-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-emerald-600/90 to-emerald-500/90 text-white rounded-t-lg">
          <CardTitle>Comptabilité des frais avancés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <Select
            value={etat}
            onValueChange={(v) => {
              setPage(1);
              setEtat(v);
            }}
          >
            <SelectTrigger className="w-full sm:w-56" aria-label="État financier">
              <SelectValue placeholder="État financier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les états</SelectItem>
              <SelectItem value="NON_REGLEE">Non réglée</SelectItem>
              <SelectItem value="PARTIELLEMENT_REGLEE">
                Partiellement réglée
              </SelectItem>
              <SelectItem value="REGLEE">Réglée</SelectItem>
            </SelectContent>
          </Select>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <p className="text-xs text-slate-600">
            {pagination.total} note(s) — page {pagination.page || 1}
            {pagination.pageCount ? ` / ${pagination.pageCount}` : ""}
          </p>

          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.noteId}>
                <Link
                  href={`/admin/frais-avances/${r.noteId}`}
                  className="block rounded-lg border border-slate-200 bg-white p-3 hover:bg-emerald-50/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{r.libelle}</span>
                    <NoteFraisStatutBadge statut={r.statut} />
                    {r.modeChoix ? (
                      <NoteFraisModeBadge mode={r.modeChoix} />
                    ) : null}
                    {r.etatFinancier ? (
                      <NoteFraisEtatFinancierBadge etat={r.etatFinancier} />
                    ) : null}
                    {r.alerteEtatFinancier ? (
                      <span className="text-xs text-amber-800">
                        État incohérent
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {r.adherentLabel ? <span>{r.adherentLabel}</span> : null}
                    <NoteFraisMontantBadge
                      label="Accepté"
                      value={r.montantAccepte}
                    />
                    {r.restantDu != null ? (
                      <NoteFraisMontantBadge
                        label="Restant"
                        value={r.restantDu}
                      />
                    ) : null}
                    <NoteFraisMontantBadge
                      label="Remboursé"
                      value={r.montantRembourseUtilise}
                    />
                    <NoteFraisMontantBadge
                      label="Compensé"
                      value={r.montantCompensationUtilise}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {pagination.pageCount > 1 ? (
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Précédent
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pagination.pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
