"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Eye, Edit, Trash2, CheckCircle2, XCircle, DoorOpen, Plus, MoreHorizontal, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import Link from "next/link";
import { getAllVotesForAdmin, adminDeleteVote, adminUpdateVoteStatus, getElectionsLightForAdmin, updateElectionStatus } from "@/actions/elections";
import { ElectionStatus } from "@prisma/client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface VoteRow {
  id: string;
  election: { id: string; titre: string; status: string };
  position: { id: string; titre: string };
  adherent: { id: string; User?: { name?: string; email?: string } };
  candidacy?: { id: string; adherent: { User?: { name?: string; email?: string } } } | null;
  status: string;
  createdAt?: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "Valide":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "Blanc":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    case "Annule":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "Valide":
      return "Valide";
    case "Blanc":
      return "Blanc";
    case "Annule":
      return "Annulé";
    default:
      return status;
  }
};

export default function AdminVotesPage() {
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [electionsOptions, setElectionsOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedElectionId, setSelectedElectionId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadAll = async () => {
    const res = await getAllVotesForAdmin();
    if (res.success) setVotes(res.votes as any);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadAll();
        const elecRes = await getElectionsLightForAdmin();
        if (elecRes.success) setElectionsOptions((elecRes.elections || []).map((e: any) => ({ id: e.id, label: e.titre })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = async (v: VoteRow) => {
    if (!confirm("Supprimer ce vote ?")) return;
    const res = await adminDeleteVote(v.id);
    if (res.success) {
      toast.success("Vote supprimé");
      await loadAll();
    } else {
      toast.error(res.error || "Erreur lors de la suppression");
    }
  };

  const handleVoteStatusChange = async (voteId: string, status: "Valide" | "Blanc" | "Annule") => {
    const res = await adminUpdateVoteStatus(voteId, status);
    if (res.success) {
      setVotes(prev => prev.map(v => (v.id === voteId ? { ...v, status } as any : v)));
      toast.success(`Vote ${status === "Valide" ? "validé" : status === "Blanc" ? "mis en blanc" : "annulé"}`);
    } else {
      toast.error(res.error || "Erreur lors de la mise à jour");
    }
  };

  const openElection = async () => {
    if (!selectedElectionId) return toast.message("Sélectionnez une élection");
    const res = await updateElectionStatus(selectedElectionId, ElectionStatus.Ouverte);
    if (res.success) {
      toast.success("Élection ouverte");
      await loadAll();
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const closeElection = async () => {
    if (!selectedElectionId) return toast.message("Sélectionnez une élection");
    const res = await updateElectionStatus(selectedElectionId, ElectionStatus.Cloturee);
    if (res.success) {
      toast.success("Élection clôturée");
      await loadAll();
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const cancelElection = async () => {
    if (!selectedElectionId) return toast.message("Sélectionnez une élection");
    const res = await updateElectionStatus(selectedElectionId, ElectionStatus.Annulee as any);
    if (res.success) {
      toast.success("Élection annulée");
      await loadAll();
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Award className="h-5 w-5 mr-2 text-green-600" />
            Gestion des Votes
          </CardTitle>
          <Link href="/admin/votes/gestion">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau vote
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 mb-4">
            <div className="w-72">
              <Label>Action sur une élection</Label>
              <Select value={selectedElectionId} onValueChange={setSelectedElectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une élection" />
                </SelectTrigger>
                <SelectContent>
                  {electionsOptions.map(opt => (
                    <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={openElection} title="Ouvrir l'élection">
              <DoorOpen className="h-4 w-4 mr-1" /> Ouvrir
            </Button>
            <Button variant="outline" onClick={closeElection}>
              Clôturer
            </Button>
            <Button variant="outline" onClick={cancelElection}>
              Annuler
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Élection</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Poste</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Adhérent</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Choix</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {(() => {
                    const startIndex = (currentPage - 1) * pageSize;
                    const endIndex = startIndex + pageSize;
                    const paginatedVotes = votes.slice(startIndex, endIndex);
                    
                    if (votes.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                            Aucun vote enregistré
                          </td>
                        </tr>
                      );
                    }
                    
                    return paginatedVotes.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {v.election?.titre}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {v.position?.titre}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {v.adherent?.User?.name || v.adherent?.User?.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {v.candidacy?.adherent?.User?.name || (v.status === "Blanc" ? "Blanc" : "—")}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={`${getStatusColor(v.status)} text-xs font-semibold`}>
                            {getStatusLabel(v.status)}
                          </Badge>
                        </td>
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
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link 
                                    href={`/admin/votes/${v.id}/consultation`}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <Eye className="h-4 w-4" />
                                    <span>Voir les détails</span>
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link 
                                    href={`/admin/votes/${v.id}/edition`}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span>Éditer</span>
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleVoteStatusChange(v.id, "Valide")}
                                  className="flex items-center gap-2 cursor-pointer text-green-600 dark:text-green-400 focus:text-green-600 dark:focus:text-green-400"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span>Valider</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleVoteStatusChange(v.id, "Blanc")}
                                  className="flex items-center gap-2 cursor-pointer text-gray-600 dark:text-gray-400 focus:text-gray-600 dark:focus:text-gray-400"
                                >
                                  <span className="h-4 w-4 flex items-center justify-center">○</span>
                                  <span>Mettre en blanc</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleVoteStatusChange(v.id, "Annule")}
                                  className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                >
                                  <XCircle className="h-4 w-4" />
                                  <span>Annuler</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(v)}
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
              {votes.length > 0 && (() => {
                const totalPages = Math.ceil(votes.length / pageSize);
                return (
                  <div className="hidden md:flex bg-white dark:bg-gray-800 mt-5 flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4 sm:gap-0">
                    <div className="ml-5 mt-2 flex-1 text-sm text-muted-foreground dark:text-gray-400">
                      {votes.length} ligne(s) au total
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
