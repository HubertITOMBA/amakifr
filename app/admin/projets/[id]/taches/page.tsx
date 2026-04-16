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
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700";
    case "EnAttente":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200 border-orange-200 dark:border-orange-800";
    case "EnCours":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border-blue-200 dark:border-blue-800";
    case "EnPause":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800";
    case "Terminee":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border-green-200 dark:border-green-800";
    case "Annulee":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 border-red-200 dark:border-red-800";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700";
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
                      className="border-2 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      <CardHeader className="pb-3">
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
                              <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3">
                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-200">
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
                              <div className="rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-3">
                                <div className="flex items-center gap-2 text-xs font-semibold text-blue-800 dark:text-blue-200">
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

