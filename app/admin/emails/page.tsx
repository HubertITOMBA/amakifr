"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserMultiSelectComboboxWithFilters } from "@/components/admin/UserMultiSelectComboboxWithFilters";
import {
  Mail,
  Plus,
  Search,
  Filter,
  Trash2,
  X,
  Send,
  Users,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getAllEmails,
  deleteEmail,
  sendEmails,
} from "@/actions/emails";
import { ViewEmailDialog } from "./ViewEmailDialog";
import { getAllUsersForAdmin } from "@/actions/user";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AdminEmailsPage() {
  const [emails, setEmails] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSent, setFilterSent] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Formulaire de création
  const [formData, setFormData] = useState({
    userIds: [] as string[],
    subject: "",
    body: "",
  });
  const [sending, setSending] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [emailsResult, usersResult] = await Promise.all([
        getAllEmails({ limit: 1000 }),
        getAllUsersForAdmin(),
      ]);

      if (emailsResult.success && emailsResult.emails) {
        setEmails(emailsResult.emails);
      }

      if (usersResult.success && usersResult.users) {
        // Filtrer pour ne garder que les utilisateurs avec un adhérent
        const adherentsUsers = usersResult.users.filter((user: any) => user.adherent);
        setUsers(adherentsUsers);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSendEmails = async () => {
    if (formData.userIds.length === 0 || !formData.subject || !formData.body) {
      toast.error("Veuillez sélectionner au moins un adhérent et remplir tous les champs obligatoires");
      return;
    }

    try {
      setSending(true);
      console.log("[Emails] Début de l'envoi pour", formData.userIds.length, "adhérent(s)");
      
      const result = await sendEmails({
        userIds: formData.userIds,
        subject: formData.subject,
        body: formData.body,
      });

      console.log("[Emails] Résultat:", result);

      if (result.success) {
        toast.success(result.message || `${result.count} email(s) envoyé(s) avec succès`);
        setShowCreateDialog(false);
        setFormData({
          userIds: [],
          subject: "",
          body: "",
        });
        loadData();
      } else {
        const errorMessage = result.error || "Erreur lors de l'envoi des emails";
        console.error("[Emails] Erreur:", errorMessage);
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error("[Emails] Exception:", error);
      const errorMessage = error?.message || error?.toString() || "Erreur lors de l'envoi des emails";
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (emailId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet email de l'historique ?")) {
      return;
    }

    const result = await deleteEmail(emailId);
    if (result.success) {
      setEmails((prev) => prev.filter((e) => e.id !== emailId));
      toast.success("Email supprimé de l'historique");
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const filteredEmails = emails.filter((email) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        email.subject.toLowerCase().includes(searchLower) ||
        email.body.toLowerCase().includes(searchLower) ||
        (email.User?.name && email.User.name.toLowerCase().includes(searchLower)) ||
        (email.User?.email && email.User.email.toLowerCase().includes(searchLower)) ||
        (email.recipientEmail && email.recipientEmail.toLowerCase().includes(searchLower)) ||
        (email.CreatedBy?.name && email.CreatedBy.name.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }

    if (filterSent !== "all") {
      if (filterSent === "sent" && !email.sent) return false;
      if (filterSent === "failed" && email.sent) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-4 sm:py-6 px-4 sm:px-6">
        <div className="space-y-4 sm:space-y-6">
          {/* En-tête */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
                <Mail className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
                Gestion des Emails
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
                Envoyez des emails et consultez l'historique des emails envoyés
              </p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10">
                  <Plus className="h-4 w-4 mr-2" />
                  Envoyer un email
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    Envoyer un email
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Envoyez un email à un ou plusieurs adhérents, ou à tous les adhérents
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="userIds" className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Adhérent(s) * <span className="text-gray-500 font-normal">(qui recevront l'email)</span>
                    </Label>
                    <div className="mt-1.5">
                      <UserMultiSelectComboboxWithFilters
                        users={users}
                        value={formData.userIds}
                        onValueChange={(value) =>
                          setFormData({ ...formData, userIds: value })
                        }
                        placeholder="Rechercher et sélectionner des adhérents..."
                        disabled={sending}
                        showAllOption={true}
                      />
                    </div>
                    {formData.userIds.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1.5">
                        {formData.userIds.length === users.length
                          ? `Tous les adhérents sélectionnés (${formData.userIds.length})`
                          : `${formData.userIds.length} adhérent(s) sélectionné(s)`}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="subject" className="text-xs sm:text-sm">
                      Objet * <span className="text-gray-500">(max 255 caractères)</span>
                    </Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) =>
                        setFormData({ ...formData, subject: e.target.value })
                      }
                      placeholder="Ex: Information importante pour les adhérents"
                      maxLength={255}
                      className="mt-1 text-sm h-9 sm:h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="body" className="text-xs sm:text-sm">
                      Corps du message * <span className="text-gray-500">(contenu de l'email)</span>
                    </Label>
                    <Textarea
                      id="body"
                      value={formData.body}
                      onChange={(e) =>
                        setFormData({ ...formData, body: e.target.value })
                      }
                      placeholder="Rédigez votre message ici..."
                      rows={8}
                      className="mt-1 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                      Les retours à la ligne seront préservés dans l'email. Vous pouvez utiliser du HTML pour formater le texte.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                      className="w-full sm:w-auto text-sm h-9 sm:h-10"
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={handleSendEmails}
                      disabled={sending}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10"
                    >
                      {sending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Envoyer l'email
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filtres */}
          <Card className="shadow-md border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                Filtres
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher par objet, contenu, destinataire..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 text-sm h-9 sm:h-10"
                  />
                </div>
                <Select value={filterSent} onValueChange={setFilterSent}>
                  <SelectTrigger className="w-full sm:w-48 text-sm h-9 sm:h-10">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="sent">Envoyés</SelectItem>
                    <SelectItem value="failed">Échecs</SelectItem>
                  </SelectContent>
                </Select>
                {(filterSent !== "all" || searchTerm) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFilterSent("all");
                      setSearchTerm("");
                    }}
                    className="w-full sm:w-auto text-sm h-9 sm:h-10"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Réinitialiser
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Liste des emails */}
          <Card className="shadow-md border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">
                Historique des emails ({filteredEmails.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-0 sm:px-0 pb-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <Mail className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 text-center">
                    Aucun email trouvé
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">Statut</TableHead>
                        <TableHead>Destinataire</TableHead>
                        <TableHead>Objet</TableHead>
                        <TableHead>Contenu</TableHead>
                        <TableHead>Envoyé par</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const startIndex = (currentPage - 1) * pageSize;
                        const endIndex = startIndex + pageSize;
                        const paginatedEmails = filteredEmails.slice(startIndex, endIndex);
                        
                        return paginatedEmails.map((email) => (
                          <TableRow key={email.id}>
                            <TableCell className="text-center">
                              {email.sent ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1 justify-center">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Envoyé
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 flex items-center gap-1 justify-center">
                                  <XCircle className="h-3 w-3" />
                                  Échec
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">
                                  {email.User?.adherent
                                    ? `${email.User.adherent.firstname || ""} ${email.User.adherent.lastname || ""}`.trim() || email.User?.name || "—"
                                    : email.User?.name || "—"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {email.recipientEmail || email.User?.email || "—"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium max-w-xs truncate">
                                {email.subject}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                {email.body}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">
                                  {email.CreatedBy?.name || "—"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {email.CreatedBy?.email || "—"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-gray-500">
                                {formatDistanceToNow(
                                  new Date(email.createdAt),
                                  {
                                    addSuffix: true,
                                    locale: fr,
                                  }
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <ViewEmailDialog email={email} />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(email.id)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  {filteredEmails.length > 0 && (() => {
                    const totalPages = Math.ceil(filteredEmails.length / pageSize);
                    return (
                      <div className="bg-white dark:bg-gray-800 mt-5 flex flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4 sm:gap-0 px-4 sm:px-6">
                        <div className="ml-5 mt-2 flex-1 text-sm text-muted-foreground dark:text-gray-400">
                          {filteredEmails.length} ligne(s) au total
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
      </div>
    </div>
  );
}
