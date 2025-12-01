"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, Eye, Edit, Trash2, Power, PowerOff, Plus, MoreHorizontal, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import Link from "next/link";
import { getAllPostesTemplates, deletePosteTemplate, togglePosteTemplateStatus } from "@/actions/postes";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {(() => {
                    const startIndex = (currentPage - 1) * pageSize;
                    const endIndex = startIndex + pageSize;
                    const paginatedPostes = sortedPostes.slice(startIndex, endIndex);
                    
                    if (sortedPostes.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                            Aucun poste enregistré
                          </td>
                        </tr>
                      );
                    }
                    
                    return paginatedPostes.map((poste) => (
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
                          <div className="flex items-center justify-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="Actions"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Ouvrir le menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link 
                                    href={`/admin/postes/${poste.id}/consultation`}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <Eye className="h-4 w-4" />
                                    <span>Voir les détails</span>
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link 
                                    href={`/admin/postes/${poste.id}/edition`}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span>Éditer</span>
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleToggleStatus(poste.id, poste.actif)}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  {poste.actif ? (
                                    <>
                                      <PowerOff className="h-4 w-4 text-red-600" />
                                      <span className="text-red-600 dark:text-red-400">Désactiver</span>
                                    </>
                                  ) : (
                                    <>
                                      <Power className="h-4 w-4 text-green-600" />
                                      <span className="text-green-600 dark:text-green-400">Activer</span>
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(poste.id, poste._count.positions)}
                                  className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Supprimer</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
              
              {/* Pagination */}
              {sortedPostes.length > 0 && (() => {
                const totalPages = Math.ceil(sortedPostes.length / pageSize);
                return (
                  <div className="bg-white dark:bg-gray-800 mt-5 flex flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4 sm:gap-0">
                    <div className="ml-5 mt-2 flex-1 text-sm text-muted-foreground dark:text-gray-400">
                      {sortedPostes.length} ligne(s) au total
                    </div>

                    <div className="flex items-center space-x-6 lg:space-x-8">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Lignes par page</p>
                        <Select
                          value={`${pageSize}`}
                          onValueChange={(value) => {
                            setPageSize(Number(value));
                            setCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={pageSize} />
                          </SelectTrigger>
                          <SelectContent side="top">
                            {[10, 20, 30, 40, 50].map((size) => (
                              <SelectItem key={size} value={`${size}`}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-center text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        Page {currentPage} sur {totalPages}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        >
                          <span className="sr-only">Aller à la première page</span>
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <span className="sr-only">Page précédente</span>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <span className="sr-only">Page suivante</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                        >
                          <span className="sr-only">Aller à la dernière page</span>
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
