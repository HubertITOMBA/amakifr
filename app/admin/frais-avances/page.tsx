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
import {
  actionListAdminNotesFrais,
  actionGetNotesFraisNavCapabilities,
} from "@/actions/frais-avances";
import { isNotesFraisEnabledClientHint } from "@/lib/frais-avances/feature-flag-client";
import {
  NoteFraisEtatFinancierBadge,
  NoteFraisMontantBadge,
  NoteFraisStatutBadge,
} from "@/components/frais-avances/note-frais-badges";

type AdminNote = {
  id: string;
  libelle: string;
  statut: string;
  alerteSansDestinataire: boolean;
  alerteEtatFinancier?: boolean;
  montantDemande: string | number;
  montantAccepte?: string | number | null;
  restantDu?: string;
  etatFinancier?: string;
  justificatifsReadyCount?: number;
  Adherent?: { firstname: string; lastname: string };
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

/**
 * Liste admin des notes soumises / décidées (pagination serveur).
 */
export default function AdminFraisAvancesPage() {
  const enabledHint = isNotesFraisEnabledClientHint();
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    pageCount: 0,
  });
  const [onlyAlerte, setOnlyAlerte] = useState(false);
  const [statut, setStatut] = useState<string>("all");
  const [etatFinancier, setEtatFinancier] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [canReadFinancial, setCanReadFinancial] = useState(false);

  useEffect(() => {
    if (!enabledHint) {
      setNotes([]);
      return;
    }
    void (async () => {
      const nav = await actionGetNotesFraisNavCapabilities();
      if (nav.success) {
        setCanReadFinancial(nav.data.canReadFinancial);
      }
      const res = await actionListAdminNotesFrais({
        onlyAlerteSansDestinataire: onlyAlerte,
        statut: statut as "all" | "SOUMISE" | "VALIDEE" | "REJETEE",
        etatFinancier: etatFinancier as
          | "all"
          | "NON_REGLEE"
          | "PARTIELLEMENT_REGLEE"
          | "REGLEE",
        page,
        pageSize: 20,
      });
      if (!res.success) {
        setError(res.error);
        setNotes([]);
        return;
      }
      const payload = res.data as {
        items: AdminNote[];
        pagination: Pagination;
      };
      setNotes(payload.items);
      setPagination(payload.pagination);
      setError(null);
    })();
  }, [onlyAlerte, statut, etatFinancier, page, enabledHint]);

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
      <Card className="mx-auto max-w-5xl border-blue-200 shadow-lg">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-gradient-to-r from-blue-500/90 to-blue-600/90 text-white rounded-t-lg">
          <CardTitle>Frais avancés</CardTitle>
          <div className="flex flex-wrap gap-2">
            {canReadFinancial && (
              <Link href="/admin/frais-avances/comptabilite">
                <Button
                  type="button"
                  variant="secondary"
                  className="text-slate-900"
                >
                  Comptabilité
                </Button>
              </Link>
            )}
            <Link href="/admin/frais-avances/archives">
              <Button
                type="button"
                variant="secondary"
                className="text-slate-900"
              >
                Archives
              </Button>
            </Link>
            <Button
              type="button"
              variant={onlyAlerte ? "secondary" : "outline"}
              className="text-slate-900"
              onClick={() => {
                setPage(1);
                setOnlyAlerte((v) => !v);
              }}
            >
              {onlyAlerte ? "Toutes" : "Alertes destinataires"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select
              value={statut}
              onValueChange={(v) => {
                setPage(1);
                setStatut(v);
              }}
            >
              <SelectTrigger className="w-full sm:w-48" aria-label="Statut">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="SOUMISE">Soumise</SelectItem>
                <SelectItem value="VALIDEE">Validée</SelectItem>
                <SelectItem value="REJETEE">Rejetée</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={etatFinancier}
              onValueChange={(v) => {
                setPage(1);
                setEtatFinancier(v);
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
          </div>

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
            {notes.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/admin/frais-avances/${n.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-3 hover:bg-blue-50/50 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm text-slate-900">
                      {n.libelle}
                    </span>
                    <NoteFraisStatutBadge statut={n.statut} />
                    {n.etatFinancier ? (
                      <NoteFraisEtatFinancierBadge etat={n.etatFinancier} />
                    ) : null}
                    {n.alerteEtatFinancier ? (
                      <span className="text-xs text-amber-800">État incohérent</span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                    {n.Adherent ? (
                      <span>
                        {n.Adherent.firstname} {n.Adherent.lastname}
                      </span>
                    ) : null}
                    <NoteFraisMontantBadge
                      label="Demandé"
                      value={String(n.montantDemande)}
                    />
                    {n.montantAccepte != null ? (
                      <NoteFraisMontantBadge
                        label="Accepté"
                        value={String(n.montantAccepte)}
                      />
                    ) : null}
                    {n.restantDu != null ? (
                      <NoteFraisMontantBadge
                        label="Restant"
                        value={n.restantDu}
                      />
                    ) : null}
                    {typeof n.justificatifsReadyCount === "number" ? (
                      <span>{n.justificatifsReadyCount} PJ</span>
                    ) : null}
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
