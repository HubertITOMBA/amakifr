"use client";

import { useParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import {
  getEvenementById,
  setEventParticipationStatus,
} from "@/actions/evenements";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { DataTable } from "@/components/admin/DataTable";
import {
  inscriptionParticipantKindLabel,
  resolveInscriptionParticipantKind,
  type EventFinancialSummary,
  type EventParticipationSummary,
} from "@/lib/services/evenements/admin-event-stats";

type InscriptionRow = {
  id: string;
  adherentId: string | null;
  visiteurNom: string | null;
  visiteurEmail: string | null;
  nombrePersonnes: number;
  statut: string;
  montantAttendu: number;
  montantPaye: number;
  montantRestant: number;
  statutPaiement: string;
  dateInscription: string;
  participationStatut: string;
  justificatifFournit: boolean;
  nomAffiche: string;
  emailAffiche: string;
  typeParticipant: "Adherent" | "Visiteur";
  Adherent?: {
    civility?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    User?: { email?: string | null } | null;
  } | null;
};

const columnHelper = createColumnHelper<InscriptionRow>();

const getStatusColor = (statut: string) => {
  switch (statut) {
    case "Publie":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "Archive":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "Brouillon":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getStatusLabel = (statut: string) => {
  switch (statut) {
    case "Publie":
      return "Publié";
    case "Archive":
      return "Archivé";
    case "Brouillon":
      return "Brouillon";
    default:
      return statut;
  }
};

const getStatutPaiementEvenementLabel = (statut: string) => {
  switch (statut) {
    case "NonApplicable":
      return "Non applicable";
    case "APayer":
      return "À payer";
    case "PartiellementPaye":
      return "Partiellement payé";
    case "Paye":
      return "Payé";
    case "EnAttenteValidation":
      return "En attente de validation";
    default:
      return statut || "—";
  }
};

const formatEuro = (value: number | string | null | undefined) => {
  const n = Number(value ?? 0);
  return `${n.toFixed(2).replace(".", ",")} €`;
};

/**
 * Consultation admin d'un événement : synthèse participants + paiements,
 * table inscriptions filtrable/triable.
 */
export default function ConsultationEvenementPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [evenement, setEvenement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingInscriptionId, setSavingInscriptionId] = useState<string | null>(
    null
  );
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [paiementFilter, setPaiementFilter] = useState<string>("all");
  const [statutInscFilter, setStatutInscFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "dateInscription", desc: true },
  ]);

  useEffect(() => {
    if (id) {
      void loadEvenement();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadEvenement = async () => {
    try {
      setLoading(true);
      const result = await getEvenementById(id);
      if (result.success && result.data) {
        setEvenement(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveParticipation = async (
    inscriptionId: string,
    participationStatut: string,
    justificatifFournit: boolean
  ) => {
    try {
      setSavingInscriptionId(inscriptionId);
      const result = await setEventParticipationStatus({
        inscriptionId,
        participationStatut: participationStatut as
          | "Present"
          | "Absent"
          | "Excuse"
          | "NonRenseigne",
        justificatifFournit,
      });
      if (result.success) {
        toast.success("Participation mise à jour");
        await loadEvenement();
      } else {
        toast.error(result.error || "Échec de mise à jour");
      }
    } finally {
      setSavingInscriptionId(null);
    }
  };

  const rows: InscriptionRow[] = useMemo(() => {
    if (!evenement?.Inscriptions) return [];
    return evenement.Inscriptions.map((insc: any) => {
      const typeParticipant = resolveInscriptionParticipantKind(insc.adherentId);
      const attendu = Number(insc.montantAttendu ?? 0);
      const paye = Number(insc.montantPaye ?? 0);
      const nomAffiche =
        typeParticipant === "Adherent"
          ? `${insc.Adherent?.firstname ?? ""} ${insc.Adherent?.lastname ?? ""}`.trim() ||
            "Adhérent"
          : insc.visiteurNom || "Visiteur";
      const emailAffiche =
        typeParticipant === "Adherent"
          ? insc.Adherent?.User?.email || ""
          : insc.visiteurEmail || "";
      return {
        id: insc.id,
        adherentId: insc.adherentId ?? null,
        visiteurNom: insc.visiteurNom ?? null,
        visiteurEmail: insc.visiteurEmail ?? null,
        nombrePersonnes: insc.nombrePersonnes ?? 1,
        statut: insc.statut || "EnAttente",
        montantAttendu: attendu,
        montantPaye: paye,
        montantRestant: Math.max(0, attendu - paye),
        statutPaiement: insc.statutPaiement || "NonApplicable",
        dateInscription: insc.dateInscription || insc.createdAt,
        participationStatut: insc.participationStatut || "NonRenseigne",
        justificatifFournit: Boolean(insc.justificatifFournit),
        nomAffiche,
        emailAffiche,
        typeParticipant,
        Adherent: insc.Adherent ?? null,
      };
    });
  }, [evenement]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (typeFilter === "adherents" && row.typeParticipant !== "Adherent") {
        return false;
      }
      if (typeFilter === "visiteurs" && row.typeParticipant !== "Visiteur") {
        return false;
      }
      if (paiementFilter !== "all" && row.statutPaiement !== paiementFilter) {
        return false;
      }
      if (statutInscFilter !== "all" && row.statut !== statutInscFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const hay = `${row.nomAffiche} ${row.emailAffiche}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, paiementFilter, statutInscFilter, searchTerm]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("typeParticipant", {
        header: "Type",
        cell: ({ getValue }) =>
          inscriptionParticipantKindLabel(getValue()),
        size: 100,
      }),
      columnHelper.accessor("nomAffiche", {
        header: "Nom",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-medium truncate">
              {row.original.nomAffiche}
            </span>
            {row.original.emailAffiche ? (
              <span className="text-xs text-slate-500 truncate">
                {row.original.emailAffiche}
              </span>
            ) : null}
          </div>
        ),
        size: 180,
      }),
      columnHelper.accessor("nombrePersonnes", {
        header: "Personnes",
        size: 90,
      }),
      columnHelper.accessor("statut", {
        header: "Statut inscription",
        size: 120,
      }),
      columnHelper.accessor("montantAttendu", {
        header: "Attendu",
        cell: ({ row }) =>
          row.original.statutPaiement === "NonApplicable" ||
          row.original.montantAttendu <= 0
            ? "—"
            : formatEuro(row.original.montantAttendu),
        size: 100,
      }),
      columnHelper.accessor("montantPaye", {
        header: "Payé",
        cell: ({ row }) =>
          row.original.statutPaiement === "NonApplicable" ||
          row.original.montantAttendu <= 0
            ? "—"
            : formatEuro(row.original.montantPaye),
        size: 90,
      }),
      columnHelper.accessor("montantRestant", {
        header: "Reste",
        cell: ({ row }) =>
          row.original.statutPaiement === "NonApplicable" ||
          row.original.montantAttendu <= 0
            ? "—"
            : formatEuro(row.original.montantRestant),
        size: 90,
      }),
      columnHelper.accessor("statutPaiement", {
        header: "Statut paiement",
        cell: ({ getValue }) => getStatutPaiementEvenementLabel(getValue()),
        size: 140,
      }),
      columnHelper.accessor("dateInscription", {
        header: "Date inscription",
        cell: ({ getValue }) => {
          const v = getValue();
          return v ? new Date(v).toLocaleString("fr-FR") : "—";
        },
        size: 150,
      }),
      columnHelper.display({
        id: "participation",
        header: "Participation",
        enableSorting: false,
        cell: ({ row }) => {
          const insc = row.original;
          return (
            <div className="flex flex-col gap-1.5 py-1">
              <Select
                value={insc.participationStatut || "NonRenseigne"}
                onValueChange={(v) => {
                  const next = {
                    ...evenement,
                    Inscriptions: evenement.Inscriptions.map((i: any) =>
                      i.id === insc.id
                        ? { ...i, participationStatut: v }
                        : i
                    ),
                  };
                  setEvenement(next);
                }}
              >
                <SelectTrigger className="w-[150px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Present">Présent</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                  <SelectItem value="Excuse">Excusé</SelectItem>
                  <SelectItem value="NonRenseigne">Non renseigné</SelectItem>
                </SelectContent>
              </Select>
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(insc.justificatifFournit)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEvenement({
                      ...evenement,
                      Inscriptions: evenement.Inscriptions.map((i: any) =>
                        i.id === insc.id
                          ? { ...i, justificatifFournit: checked }
                          : i
                      ),
                    });
                  }}
                />
                Justificatif
              </label>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  void handleSaveParticipation(
                    insc.id,
                    insc.participationStatut || "NonRenseigne",
                    Boolean(insc.justificatifFournit)
                  )
                }
                disabled={savingInscriptionId === insc.id}
              >
                Enregistrer
              </Button>
            </div>
          );
        },
        size: 170,
      }),
    ],
    [evenement, savingInscriptionId]
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  if (loading) {
    return (
      <Modal title="Détails de l'événement" confirmOnClose={false}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    );
  }

  if (!evenement) {
    return (
      <Modal title="Détails de l'événement" confirmOnClose={false}>
        <div className="text-center py-8 text-gray-500">
          Événement introuvable
        </div>
      </Modal>
    );
  }

  const participation =
    (evenement.participationSummary as EventParticipationSummary | null) ??
    null;
  const financial =
    (evenement.financialSummary as EventFinancialSummary | null) ?? null;
  const capacite = evenement.placesDisponibles;

  return (
    <Modal title="Détails de l'événement" confirmOnClose={false}>
      <div className="space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Titre</Label>
            <div className="text-sm mt-1 font-medium">{evenement.titre}</div>
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <div className="text-sm mt-1">{evenement.description}</div>
          </div>
          {evenement.contenu && (
            <div className="md:col-span-2">
              <Label>Contenu</Label>
              <div className="text-sm mt-1 whitespace-pre-wrap">
                {evenement.contenu}
              </div>
            </div>
          )}
          <div>
            <Label>Date de début</Label>
            <div className="text-sm mt-1">
              {new Date(evenement.dateDebut).toLocaleString("fr-FR")}
            </div>
          </div>
          {evenement.dateFin && (
            <div>
              <Label>Date de fin</Label>
              <div className="text-sm mt-1">
                {new Date(evenement.dateFin).toLocaleString("fr-FR")}
              </div>
            </div>
          )}
          <div>
            <Label>Catégorie</Label>
            <div className="text-sm mt-1">
              <Badge variant="outline">{evenement.categorie}</Badge>
            </div>
          </div>
          <div>
            <Label>Statut</Label>
            <div className="text-sm mt-1">
              <Badge
                className={`${getStatusColor(evenement.statut)} text-xs`}
              >
                {getStatusLabel(evenement.statut)}
              </Badge>
            </div>
          </div>
          {evenement.prix !== null && evenement.prix !== undefined && (
            <div>
              <Label>Prix unitaire</Label>
              <div className="text-sm mt-1">
                {Number(evenement.prix).toFixed(2).replace(".", ",")} €
              </div>
            </div>
          )}
          {evenement.lieu && (
            <div>
              <Label>Lieu</Label>
              <div className="text-sm mt-1">{evenement.lieu}</div>
            </div>
          )}
        </div>

        {participation && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-800 p-3 space-y-2">
            <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Participants
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-500">
                  Adhérents
                </span>
                {participation.inscriptionsAdherents}
                <span className="text-xs text-slate-500">
                  {" "}
                  ({participation.personnesAdherents} pers.)
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-500">
                  Visiteurs
                </span>
                {participation.inscriptionsVisiteurs}
                <span className="text-xs text-slate-500">
                  {" "}
                  ({participation.personnesVisiteurs} pers.)
                </span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-500">
                  Total inscriptions
                </span>
                {participation.totalInscriptions}
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-500">
                  Total personnes
                </span>
                {participation.totalPersonnes}
              </div>
            </div>
            {capacite != null && (
              <div className="text-sm text-slate-700 dark:text-slate-300">
                Places réservées :{" "}
                <strong>
                  {participation.totalPersonnes} / {capacite}
                </strong>
              </div>
            )}
          </div>
        )}

        {financial?.isPayant && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-800 p-3 space-y-2">
            <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              Finances événement
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-500">
                  Attendu total
                </span>
                {formatEuro(financial.montantAttenduTotal)}
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-500">
                  Encaissé validé
                </span>
                {formatEuro(financial.montantPayeTotal)}
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-500">
                  Restant
                </span>
                {formatEuro(financial.montantRestantTotal)}
              </div>
              <div>
                <span className="block text-[10px] uppercase font-semibold text-slate-500">
                  En attente validation
                </span>
                {formatEuro(financial.montantEnAttenteValidation)}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="text-sm font-semibold">
            Inscriptions ({filteredRows.length}
            {filteredRows.length !== rows.length ? ` / ${rows.length}` : ""})
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <Input
              placeholder="Rechercher nom / email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="sm:max-w-xs"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="adherents">Adhérents</SelectItem>
                <SelectItem value="visiteurs">Visiteurs</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paiementFilter} onValueChange={setPaiementFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Paiement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous paiements</SelectItem>
                <SelectItem value="NonApplicable">Non applicable</SelectItem>
                <SelectItem value="APayer">À payer</SelectItem>
                <SelectItem value="EnAttenteValidation">En attente</SelectItem>
                <SelectItem value="PartiellementPaye">
                  Partiellement payé
                </SelectItem>
                <SelectItem value="Paye">Payé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statutInscFilter} onValueChange={setStatutInscFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Statut inscription" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="EnAttente">En attente</SelectItem>
                <SelectItem value="Confirmee">Confirmée</SelectItem>
                <SelectItem value="Annulee">Annulée</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rows.length === 0 ? (
            <div className="text-sm text-slate-500 py-4">
              Aucune inscription
            </div>
          ) : (
            <DataTable
              table={table}
              emptyMessage="Aucune inscription pour ces filtres"
              compact={true}
              headerBold
              headerUppercase={false}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
