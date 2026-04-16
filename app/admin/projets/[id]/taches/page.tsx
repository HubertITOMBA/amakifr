"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FolderKanban, ArrowLeft, Users, ListChecks, Loader2 } from "lucide-react";

import { getProjetById } from "@/actions/projets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "react-toastify";

type Affectation = {
  id: string;
  responsable: boolean;
  Adherent: {
    id: string;
    firstname: string | null;
    lastname: string | null;
    civility?: string | null;
  };
};

type SousProjet = {
  id: string;
  titre: string;
  statut: string;
  ordre: number;
  Affectations: Affectation[];
};

type Projet = {
  id: string;
  titre: string;
  SousProjets: SousProjet[];
};

function statutBadgeClass(statut: string) {
  switch (statut) {
    case "APlanifier":
      return "bg-white/80 text-slate-800 border-slate-400 shadow-sm font-semibold dark:bg-slate-950/40 dark:text-slate-100 dark:border-slate-600";
    case "EnAttente":
      return "bg-white/80 text-orange-900 border-orange-500 shadow-sm font-semibold dark:bg-slate-950/40 dark:text-orange-100 dark:border-orange-700";
    case "EnCours":
      return "bg-white/80 text-blue-900 border-blue-500 shadow-sm font-semibold dark:bg-slate-950/40 dark:text-blue-100 dark:border-blue-700";
    case "EnPause":
      return "bg-white/80 text-yellow-950 border-yellow-500 shadow-sm font-semibold dark:bg-slate-950/40 dark:text-yellow-100 dark:border-yellow-700";
    case "Terminee":
      return "bg-white/80 text-green-900 border-green-500 shadow-sm font-semibold dark:bg-slate-950/40 dark:text-green-100 dark:border-green-700";
    case "Annulee":
      return "bg-white/80 text-red-900 border-red-500 shadow-sm font-semibold dark:bg-slate-950/40 dark:text-red-100 dark:border-red-700";
    default:
      return "bg-white/80 text-slate-800 border-slate-400 shadow-sm font-semibold dark:bg-slate-950/40 dark:text-slate-100 dark:border-slate-600";
  }
}

function tacheCardClass(statut: string) {
  switch (statut) {
    case "APlanifier":
      return "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 hover:border-slate-400 dark:hover:border-slate-600 shadow-sm hover:shadow-md";
    case "EnAttente":
      return "border-orange-400 dark:border-orange-800 bg-orange-100 dark:bg-orange-950/35 hover:border-orange-500 dark:hover:border-orange-700 shadow-sm hover:shadow-md";
    case "EnCours":
      return "border-blue-400 dark:border-blue-800 bg-blue-100 dark:bg-blue-950/35 hover:border-blue-500 dark:hover:border-blue-700 shadow-sm hover:shadow-md";
    case "EnPause":
      return "border-yellow-400 dark:border-yellow-800 bg-yellow-100 dark:bg-yellow-950/35 hover:border-yellow-500 dark:hover:border-yellow-700 shadow-sm hover:shadow-md";
    case "Terminee":
      return "border-green-400 dark:border-green-800 bg-green-100 dark:bg-green-950/35 hover:border-green-500 dark:hover:border-green-700 shadow-sm hover:shadow-md";
    case "Annulee":
      return "border-red-400 dark:border-red-800 bg-red-100 dark:bg-red-950/35 hover:border-red-500 dark:hover:border-red-700 shadow-sm hover:shadow-md";
    default:
      return "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 hover:border-slate-400 dark:hover:border-slate-600 shadow-sm hover:shadow-md";
  }
}

function tacheAccentClass(statut: string) {
  switch (statut) {
    case "EnAttente":
      return "bg-orange-500";
    case "EnCours":
      return "bg-blue-500";
    case "EnPause":
      return "bg-yellow-500";
    case "Terminee":
      return "bg-green-500";
    case "Annulee":
      return "bg-red-500";
    case "APlanifier":
    default:
      return "bg-slate-400";
  }
}

export default function AdminProjetTachesPage() {
  const params = useParams();
  const router = useRouter();
  const projetId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [projet, setProjet] = useState<Projet | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getProjetById(projetId);
      if (res.success && res.data) {
        setProjet(res.data as Projet);
      } else {
        toast.error(res.error || "Erreur lors du chargement du projet");
        router.push("/admin/projets");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement du projet");
      router.push("/admin/projets");
    } finally {
      setLoading(false);
    }
  }, [projetId, router]);

  useEffect(() => {
    if (!projetId) return;
    load();
  }, [projetId, load]);

  const sousProjets = useMemo(() => {
    return projet?.SousProjets ?? [];
  }, [projet]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!projet) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800 p-2 sm:p-4">
      <div className="mx-auto max-w-[96rem] w-full space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/admin/projets/${projet.id}`}
              className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
        </div>

        <Card className="shadow-lg border-blue-200">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FolderKanban className="h-5 w-5" />
                Tâches & affectations — {projet.titre}
              </CardTitle>
              <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 border border-white/20 rounded-md px-3 py-1.5">
                <ListChecks className="h-4 w-4" />
                {sousProjets.length} tâche(s)
              </div>
            </div>
            <CardDescription className="text-blue-100 text-xs pb-3">
              Chaque card représente une tâche. Dans les détails : la liste des adhérents affectés.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {sousProjets.length === 0 ? (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Aucune tâche n&apos;est encore créée pour ce projet.
                </p>
                <div className="mt-3">
                  <Button asChild variant="outline" className="border-blue-300 hover:bg-blue-50">
                    <Link href={`/admin/projets/${projet.id}`}>Aller au détail du projet</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {sousProjets.map((tache) => {
                  const affectations = tache.Affectations ?? [];
                  const responsables = affectations.filter((a) => a.responsable);
                  const autres = affectations.filter((a) => !a.responsable);

                  return (
                    <Card
                      key={tache.id}
                      className={`relative overflow-hidden border-2 transition-all ${tacheCardClass(tache.statut)}`}
                    >
                      <div className={`absolute left-0 top-0 h-full w-1.5 ${tacheAccentClass(tache.statut)}`} />
                      <CardHeader className="pt-4 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-base leading-tight">
                            {tache.titre}
                          </CardTitle>
                          <Badge className={statutBadgeClass(tache.statut)} variant="outline">
                            {tache.statut}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          {affectations.length} adhérent(s) affecté(s)
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {affectations.length === 0 ? (
                          <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              Aucun adhérent affecté à cette tâche.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {responsables.length > 0 && (
                              <div className="rounded-md border border-amber-300 dark:border-amber-800 bg-white/75 dark:bg-slate-950/40 p-3 shadow-sm backdrop-blur-sm">
                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-100">
                                  <Users className="h-4 w-4" />
                                  Responsable(s)
                                </div>
                                <ul className="mt-2 space-y-1">
                                  {responsables.map((a) => (
                                    <li key={a.id} className="text-sm text-slate-900 dark:text-slate-100">
                                      {`${a.Adherent?.firstname ?? ""} ${a.Adherent?.lastname ?? ""}`.trim() || "—"}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {autres.length > 0 && (
                              <div className="rounded-md border border-blue-300 dark:border-blue-800 bg-white/75 dark:bg-slate-950/40 p-3 shadow-sm backdrop-blur-sm">
                                <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 dark:text-blue-100">
                                  <Users className="h-4 w-4" />
                                  Affecté(s)
                                </div>
                                <ul className="mt-2 space-y-1">
                                  {autres.map((a) => (
                                    <li key={a.id} className="text-sm text-slate-900 dark:text-slate-100">
                                      {`${a.Adherent?.firstname ?? ""} ${a.Adherent?.lastname ?? ""}`.trim() || "—"}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

