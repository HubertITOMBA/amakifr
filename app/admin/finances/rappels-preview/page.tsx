"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  ShieldAlert,
  UserX,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getPreviewRappelsDetteAction } from "@/actions/cotisations/preview-rappels-dette";
import type {
  PreviewRappelAdherentRow,
  PreviewRappelsDetteResult,
} from "@/lib/services/cotisations/rappel-dette/preview-rappels-admin";
import {
  canAccessPreviewRappelsDette,
  PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/preview-access";
import {
  buildHomonymFicheReferences,
  formatPreviewAmountDisplay,
  formatPreviewDueDisplay,
  formatPreviewEuroAmount,
  HOMONYM_DISPLAY_NOTICE,
} from "@/lib/services/cotisations/rappel-dette/preview-display";
import type { LabeledReason } from "@/lib/services/cotisations/rappel-dette/reason-labels";

function formatDateFr(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function ReasonGroup({
  title,
  items,
  tone,
}: {
  title: string;
  items: LabeledReason[];
  tone: "global" | "line" | "tech";
}) {
  // Ne pas afficher le titre suivi de « — » quand la liste est vide.
  if (items.length === 0) {
    return null;
  }

  const toneClass =
    tone === "tech"
      ? "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/50 dark:text-red-100"
      : tone === "line"
        ? "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        : "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-100";

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <Badge
            key={`${title}-${item.code}`}
            variant="outline"
            title={item.code}
            className={`text-[10px] ${toneClass}`}
          >
            {item.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

type AdherentTableVariant = "eligible" | "excluded" | "failed";

const TABLE_HEAD_BY_VARIANT: Record<
  AdherentTableVariant,
  { thead: string; th: string }
> = {
  eligible: {
    thead:
      "bg-emerald-100 dark:bg-emerald-950/70 border-b border-emerald-300 dark:border-emerald-700",
    th: "text-emerald-950 dark:text-emerald-50",
  },
  excluded: {
    thead:
      "bg-amber-100 dark:bg-amber-950/70 border-b border-amber-300 dark:border-amber-700",
    th: "text-amber-950 dark:text-amber-50",
  },
  failed: {
    thead:
      "bg-red-100 dark:bg-red-950/70 border-b border-red-300 dark:border-red-700",
    th: "text-red-950 dark:text-red-50",
  },
};

function AdherentTable({
  rows,
  emptyLabel,
  showLineReasons,
  tech,
  homonymRefs,
  variant,
}: {
  rows: PreviewRappelAdherentRow[];
  emptyLabel: string;
  showLineReasons: boolean;
  tech?: boolean;
  /** Références « Fiche N » pour les seuls displayName en collision (toutes listes). */
  homonymRefs: ReadonlyMap<string, string>;
  variant: AdherentTableVariant;
}) {
  const head = TABLE_HEAD_BY_VARIANT[variant];
  const thBase = `px-3 py-3 font-semibold text-sm font-sans ${head.th}`;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 py-6 px-4 text-center font-sans">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-900 font-sans">
      <table className="w-full min-w-[640px] text-sm font-sans">
        <thead className={head.thead}>
          <tr>
            <th className={`${thBase} text-left`}>Adhérent</th>
            <th className={`${thBase} text-right tabular-nums whitespace-nowrap`}>
              Brut
            </th>
            <th className={`${thBase} text-right tabular-nums whitespace-nowrap`}>
              Avoirs
            </th>
            <th className={`${thBase} text-right tabular-nums whitespace-nowrap`}>
              Nette
            </th>
            <th className={`${thBase} text-left`}>Motifs</th>
            <th className={`${thBase} text-right whitespace-nowrap`}>Échéance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.adherentId}
              className="border-t border-slate-100 dark:border-slate-800 odd:bg-white even:bg-slate-50/70 dark:odd:bg-gray-900 dark:even:bg-slate-800/40"
            >
              <td className="px-3 py-2.5 text-left font-medium text-slate-900 dark:text-slate-100">
                <div className="flex flex-col gap-0.5">
                  <span>{row.displayName}</span>
                  {homonymRefs.get(row.adherentId) ? (
                    <>
                      <span className="text-xs font-normal text-slate-600 dark:text-slate-300">
                        {homonymRefs.get(row.adherentId)}
                      </span>
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        {HOMONYM_DISPLAY_NOTICE}
                      </span>
                    </>
                  ) : null}
                </div>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-xs text-slate-800 dark:text-slate-200">
                {formatPreviewAmountDisplay(
                  row.montantBrut,
                  row.computationKind
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-xs text-slate-800 dark:text-slate-200">
                {formatPreviewAmountDisplay(
                  row.avoirDisponible,
                  row.computationKind
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-xs font-semibold text-slate-900 dark:text-slate-100">
                {formatPreviewAmountDisplay(
                  row.detteNette,
                  row.computationKind
                )}
              </td>
              <td className="px-3 py-2.5 text-left space-y-2">
                <ReasonGroup
                  title={tech ? "Échec technique" : "Motifs adhérent"}
                  items={row.globalReasonLabels}
                  tone={tech ? "tech" : "global"}
                />
                {showLineReasons ? (
                  <ReasonGroup
                    title="Lignes non retenues (détail)"
                    items={row.ignoredReasonLabels}
                    tone="line"
                  />
                ) : null}
              </td>
              <td className="px-3 py-2.5 text-right text-xs tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                {formatPreviewDueDisplay(
                  formatDateFr(row.earliestDueDate),
                  row.computationKind
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Prévisualisation dry-run des rappels cotisations/dettes (R1 Lot 2).
 * Aucun bouton d’envoi — lecture seule. Garde ADMIN|PRESID côté serveur obligatoire.
 */
export default function AdminRappelsPreviewPage() {
  const user = useCurrentUser();
  const clientCanAccess = canAccessPreviewRappelsDette(user?.role);

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [data, setData] = useState<PreviewRappelsDetteResult | null>(null);

  const homonymRefs = useMemo(() => {
    if (!data) {
      return new Map<string, string>();
    }
    return buildHomonymFicheReferences([
      ...data.eligible,
      ...data.excluded,
      ...data.failed,
    ]);
  }, [data]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setAccessDenied(false);
      const result = await getPreviewRappelsDetteAction();
      if (!result.success) {
        if (
          result.code === "FORBIDDEN" ||
          result.code === "UNAUTHENTICATED" ||
          result.error === PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE
        ) {
          setAccessDenied(true);
          setData(null);
          return;
        }
        toast.error(result.error || "Erreur de prévisualisation");
        setData(null);
        return;
      }
      setData(result.data);
    } catch (error) {
      console.error("[AdminRappelsPreviewPage]", {
        category: "load_failed",
        name: error instanceof Error ? error.name : "unknown",
      });
      toast.error("Erreur lors du chargement de la prévisualisation");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (accessDenied || (!loading && user && !clientCanAccess && !data)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4 sm:p-6">
        <Card className="max-w-lg border-red-200 dark:border-red-800 shadow-lg w-full pt-0 gap-0">
          <CardHeader className="bg-gradient-to-r from-red-500/90 to-red-600/90 text-white rounded-t-lg px-4 sm:px-6 py-3 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldAlert className="h-5 w-5" />
              {PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-sm text-slate-700 dark:text-slate-200 px-4 sm:px-6 pb-4">
            <p>
              Cette prévisualisation est réservée aux administrateurs et au
              président.
            </p>
            <Link
              href="/admin/finances"
              className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour aux finances
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <Link
          href="/admin/finances"
          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Finances
        </Link>

        {/* Header principal : conteneur unique — évite pb/gap résiduels de Card (bande blanche). */}
        <div className="overflow-hidden rounded-xl border border-blue-300/60 dark:border-indigo-700 shadow-lg bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-700 dark:from-blue-700 dark:via-indigo-700 dark:to-indigo-900 font-sans">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0 flex items-start gap-3 sm:gap-4">
              <span
                aria-hidden
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20 ring-1 ring-white/30"
              >
                <Eye className="h-5 w-5 text-white" />
              </span>
              <div className="min-w-0">
                <h1 className="font-sans font-semibold text-xl sm:text-2xl tracking-tight text-white leading-tight">
                  Prévisualisation des rappels
                </h1>
                <p className="font-sans mt-1.5 text-sm text-blue-50/95 max-w-xl leading-snug">
                  Consultez les adhérents éligibles et les montants à rappeler.
                  Aucun rappel ne sera envoyé.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="w-full sm:w-auto shrink-0 font-sans bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-800 border border-white shadow-sm disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Actualiser
            </Button>
          </div>
        </div>

        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-semibold">
              Prévisualisation — aucun envoi
            </p>
            <p className="text-xs mt-0.5 text-amber-900/80 dark:text-amber-100/80">
              Aucun e-mail, notification, push ou relance n’est créé ou
              déclenché depuis cet écran.
            </p>
          </div>
        </div>

        {data?.incomplete && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 text-red-950 shadow-sm dark:border-red-700 dark:bg-red-950/40 dark:text-red-50"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-sm font-semibold">
                {data.incompleteAlert ?? "Prévisualisation incomplète"}
              </p>
              <p className="text-xs mt-0.5 text-red-900/80 dark:text-red-100/80">
                {data.totals.failedCount} calcul(s) n’ont pas abouti. Les totaux
                ci-dessous sont <strong>partiels</strong> et ne doivent pas être
                lus comme une absence de dette.
              </p>
            </div>
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 font-sans">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800/40 font-sans">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Date de référence
                </div>
                <div className="text-base font-semibold text-slate-950 dark:text-slate-50 mt-1">
                  {formatDateFr(data.computedAt)}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                  {data.timezone}
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-gray-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 font-sans">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Adhérents scannés
                </div>
                <div className="text-2xl font-semibold text-slate-950 dark:text-slate-50 mt-1 flex items-center gap-2 tabular-nums">
                  <Users className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                  {data.totals.adherentsScanned}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800/40 font-sans">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Éligibles
                  {data.totals.totalsPartial ? " (partiel)" : ""}
                </div>
                <div className="text-2xl font-semibold text-emerald-900 dark:text-emerald-200 mt-1 tabular-nums">
                  {data.totals.eligibleCount}
                </div>
                <div className="text-sm text-emerald-900 dark:text-emerald-200 mt-1 whitespace-nowrap tabular-nums">
                  Brut : {formatPreviewEuroAmount(data.totals.montantBrutEligibleTotal)}
                </div>
                <div className="text-sm text-emerald-900 dark:text-emerald-200 whitespace-nowrap tabular-nums">
                  Nette : {formatPreviewEuroAmount(data.totals.detteNetteEligibleTotal)}
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/40 font-sans">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Exclus (métier)
                </div>
                <div className="text-2xl font-semibold text-amber-900 dark:text-amber-200 mt-1 tabular-nums">
                  {data.totals.excludedCount}
                </div>
                <div className="text-sm text-amber-900 dark:text-amber-200 mt-1">
                  Échecs techniques : {data.totals.failedCount}
                </div>
              </div>
            </div>

            {/* Sections listes : conteneur unique overflow-hidden — pas de CardContent
                (évite pt/gap/pb Card → ~40px blanc sous le bandeau). */}
            <section className="overflow-hidden rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-lg font-sans">
              <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 text-white px-4 sm:px-5 py-3 sm:py-3.5">
                <h2 className="text-base sm:text-lg font-semibold text-white flex flex-wrap items-center gap-2 sm:gap-3 font-sans">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>Adhérents éligibles</span>
                  <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/25 font-semibold">
                    {data.eligible.length}
                  </Badge>
                </h2>
              </div>
              <AdherentTable
                rows={data.eligible}
                emptyLabel="Aucun adhérent éligible à la date de référence."
                showLineReasons
                homonymRefs={homonymRefs}
                variant="eligible"
              />
            </section>

            <section className="overflow-hidden rounded-xl border border-amber-200 dark:border-amber-800 shadow-lg font-sans">
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 text-white px-4 sm:px-5 py-3 sm:py-3.5">
                <h2 className="text-base sm:text-lg font-semibold text-white flex flex-wrap items-center gap-2 sm:gap-3 font-sans">
                  <UserX className="h-5 w-5 shrink-0" />
                  <span>Exclusions métier</span>
                  <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/25 font-semibold">
                    {data.excluded.length}
                  </Badge>
                </h2>
              </div>
              <AdherentTable
                rows={data.excluded}
                emptyLabel="Aucune exclusion métier."
                showLineReasons
                homonymRefs={homonymRefs}
                variant="excluded"
              />
            </section>

            {(data.failed.length > 0 || data.incomplete) && (
              <section className="overflow-hidden rounded-xl border border-red-200 dark:border-red-800 shadow-lg font-sans">
                <div className="bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 text-white px-4 sm:px-5 py-3 sm:py-3.5">
                  <h2 className="text-base sm:text-lg font-semibold text-white flex flex-wrap items-center gap-2 sm:gap-3 font-sans">
                    <XCircle className="h-5 w-5 shrink-0" />
                    <span>Calculs non aboutis</span>
                    <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/25 font-semibold">
                      {data.failed.length}
                    </Badge>
                  </h2>
                </div>
                <AdherentTable
                  rows={data.failed}
                  emptyLabel="Aucun échec technique."
                  showLineReasons={false}
                  tech
                  homonymRefs={homonymRefs}
                  variant="failed"
                />
              </section>
            )}
          </>
        ) : (
          <Card className="border-slate-200 dark:border-slate-700 shadow-sm">
            <CardContent className="py-10 text-center text-sm text-slate-600 dark:text-slate-300">
              Impossible de charger la prévisualisation.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
