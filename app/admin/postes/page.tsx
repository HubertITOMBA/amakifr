"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Eye, Edit, Trash2, Power, PowerOff, Plus } from "lucide-react";
import Link from "next/link";
import { getAllPostesTemplates, deletePosteTemplate, togglePosteTemplateStatus } from "@/actions/postes";
import { toast } from "sonner";

type PosteTemplate = {
  id: string;
  code: string;
  libelle: string;
  description?: string;
  ordre: number;
  actif: boolean;
  nombreMandatsDefaut: number;
  dureeMandatDefaut?: number;
  createdAt: string;
  _count: { positions: number };
};

export default function AdminPostesPage() {
  const [postes, setPostes] = useState<PosteTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getAllPostesTemplates();
      if (res.success && res.data) {
        setPostes(res.data as unknown as PosteTemplate[]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string, usages: number) => {
    if (usages > 0) {
      toast.error("Impossible de supprimer un poste utilisé dans une élection");
      return;
    }
    if (!confirm("Supprimer ce poste ?")) return;
    try {
      const res = await deletePosteTemplate(id);
      if (res.success) {
        toast.success("Poste supprimé");
        await loadData();
      } else {
        toast.error(res.error || "Échec de la suppression");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleToggleStatus = async (id: string, actif: boolean) => {
    try {
      const res = await togglePosteTemplateStatus(id, !actif);
      if (res.success) {
        toast.success(!actif ? "Poste activé" : "Poste désactivé");
        await loadData();
      } else {
        toast.error(res.error || "Échec de la modification du statut");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la modification");
    }
  };

  const sortedPostes = [...postes].sort((a, b) => {
    if (a.ordre !== b.ordre) return a.ordre - b.ordre;
    return a.libelle.localeCompare(b.libelle);
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Award className="h-5 w-5 mr-2" />
            Gestion des Postes Électoraux
          </CardTitle>
          <Link href="/admin/postes/gestion">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau poste
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Libellé</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ordre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Utilisations</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedPostes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        Aucun poste enregistré
                      </td>
                    </tr>
                  ) : (
                    sortedPostes.map((poste) => (
                      <tr key={poste.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{poste.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{poste.libelle}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-md truncate">{poste.description || "—"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{poste.ordre}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={poste.actif ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"}>
                            {poste.actif ? "Actif" : "Inactif"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{poste._count.positions}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex space-x-2">
                            <Link href={`/admin/postes/${poste.id}/consultation`}>
                              <Button size="sm" variant="outline">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/admin/postes/${poste.id}/edition`}>
                              <Button size="sm" variant="outline">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button size="sm" variant="outline" onClick={() => handleToggleStatus(poste.id, poste.actif)}>
                              {poste.actif ? <PowerOff className="h-4 w-4 text-red-600" /> : <Power className="h-4 w-4 text-green-600" />}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(poste.id, poste._count.positions)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
