"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserMultiSelectComboboxWithFilters } from "@/components/admin/UserMultiSelectComboboxWithFilters";
import {
  Bell,
  Plus,
  Search,
  Filter,
  CheckCheck,
  Trash2,
  X,
  Send,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getAllNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  createNotifications,
} from "@/actions/notifications";
import { getAllUsersForAdmin } from "@/actions/user";
import { toast } from "sonner";
import { TypeNotification } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const getNotificationIcon = (type: TypeNotification) => {
  switch (type) {
    case "Systeme":
      return "🔔";
    case "Email":
      return "📧";
    case "Action":
      return "⚡";
    case "Cotisation":
      return "💰";
    case "Idee":
      return "💡";
    case "Election":
      return "🗳️";
    case "Evenement":
      return "📅";
    default:
      return "📢";
  }
};

const getNotificationColor = (type: TypeNotification) => {
  switch (type) {
    case "Systeme":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "Email":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "Action":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
    case "Cotisation":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "Idee":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "Election":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
    case "Evenement":
      return "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
};

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Formulaire de création
  const [formData, setFormData] = useState({
    userIds: [] as string[],
    type: TypeNotification.Systeme,
    titre: "",
    message: "",
    lien: "",
  });
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [notificationsResult, usersResult] = await Promise.all([
        getAllNotifications({ limit: 100 }),
        getAllUsersForAdmin(),
      ]);

      if (notificationsResult.success && notificationsResult.notifications) {
        setNotifications(notificationsResult.notifications);
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

  const handleCreateNotification = async () => {
    if (formData.userIds.length === 0 || !formData.titre || !formData.message) {
      toast.error("Veuillez sélectionner au moins un adhérent et remplir tous les champs obligatoires");
      return;
    }

    try {
      setCreating(true);
      console.log("[Notifications] Début de la création pour", formData.userIds.length, "adhérent(s)");
      
      const result = await createNotifications({
        userIds: formData.userIds,
        type: formData.type,
        titre: formData.titre,
        message: formData.message,
        lien: formData.lien || undefined,
      });

      console.log("[Notifications] Résultat:", result);

      if (result.success) {
        toast.success(result.message || `${result.count} notification(s) créée(s) avec succès`);
        setShowCreateDialog(false);
        setFormData({
          userIds: [],
          type: TypeNotification.Systeme,
          titre: "",
          message: "",
          lien: "",
        });
        loadData();
      } else {
        const errorMessage = result.error || "Erreur lors de la création des notifications";
        console.error("[Notifications] Erreur:", errorMessage);
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error("[Notifications] Exception:", error);
      const errorMessage = error?.message || error?.toString() || "Erreur lors de la création des notifications";
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (notificationId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette notification ?")) {
      return;
    }

    const result = await deleteNotification(notificationId);
    if (result.success) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      toast.success("Notification supprimée");
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        notification.titre.toLowerCase().includes(searchLower) ||
        notification.message.toLowerCase().includes(searchLower) ||
        (notification.User?.name &&
          notification.User.name.toLowerCase().includes(searchLower)) ||
        (notification.User?.email &&
          notification.User.email.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }

    if (filterType !== "all" && notification.type !== filterType) {
      return false;
    }

    if (filterStatus !== "all") {
      if (filterStatus === "read" && !notification.lue) return false;
      if (filterStatus === "unread" && notification.lue) return false;
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
                <Bell className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
                Gestion des Notifications
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
                Créez et gérez les notifications pour tous les utilisateurs
              </p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une notification
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    Créer une nouvelle notification
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Envoyez une notification à un ou plusieurs adhérents, ou à tous les adhérents
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="userIds" className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Adhérent(s) * <span className="text-gray-500 font-normal">(qui recevront la notification)</span>
                    </Label>
                    <div className="mt-1.5">
                      <UserMultiSelectComboboxWithFilters
                        users={users}
                        value={formData.userIds}
                        onValueChange={(value) =>
                          setFormData({ ...formData, userIds: value })
                        }
                        placeholder="Rechercher et sélectionner des adhérents..."
                        disabled={creating}
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
                    <Label htmlFor="type" className="text-xs sm:text-sm">
                      Type de notification *
                    </Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          type: value as TypeNotification,
                        })
                      }
                    >
                      <SelectTrigger className="mt-1 text-sm h-9 sm:h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TypeNotification.Systeme}>
                          Système
                        </SelectItem>
                        <SelectItem value={TypeNotification.Email}>
                          Email
                        </SelectItem>
                        <SelectItem value={TypeNotification.Action}>
                          Action
                        </SelectItem>
                        <SelectItem value={TypeNotification.Cotisation}>
                          Cotisation
                        </SelectItem>
                        <SelectItem value={TypeNotification.Idee}>
                          Idée
                        </SelectItem>
                        <SelectItem value={TypeNotification.Election}>
                          Élection
                        </SelectItem>
                        <SelectItem value={TypeNotification.Evenement}>
                          Événement
                        </SelectItem>
                        <SelectItem value={TypeNotification.Autre}>
                          Autre
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="titre" className="text-xs sm:text-sm">
                      Titre * <span className="text-gray-500">(max 255 caractères)</span>
                    </Label>
                    <Input
                      id="titre"
                      value={formData.titre}
                      onChange={(e) =>
                        setFormData({ ...formData, titre: e.target.value })
                      }
                      placeholder="Ex: Votre idée a été validée"
                      maxLength={255}
                      className="mt-1 text-sm h-9 sm:h-10"
                    />
                  </div>

                  <div>
                    <Label htmlFor="message" className="text-xs sm:text-sm">
                      Message * <span className="text-gray-500">(détails de la notification)</span>
                    </Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      placeholder="Ex: Félicitations ! Votre idée a été validée par l'administration."
                      rows={4}
                      className="mt-1 text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="lien" className="text-xs sm:text-sm">
                      Lien de redirection <span className="text-gray-500">(optionnel)</span>
                    </Label>
                    <Input
                      id="lien"
                      value={formData.lien}
                      onChange={(e) =>
                        setFormData({ ...formData, lien: e.target.value })
                      }
                      placeholder="Ex: /idees/123"
                      maxLength={500}
                      className="mt-1 text-sm h-9 sm:h-10"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      URL vers laquelle rediriger l'utilisateur quand il clique sur la notification
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
                      onClick={handleCreateNotification}
                      disabled={creating}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10"
                    >
                      {creating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Création...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Créer la notification
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
                    placeholder="Rechercher par titre, message, utilisateur..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 text-sm h-9 sm:h-10"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full sm:w-48 text-sm h-9 sm:h-10">
                    <SelectValue placeholder="Tous les types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="Systeme">Système</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Action">Action</SelectItem>
                    <SelectItem value="Cotisation">Cotisation</SelectItem>
                    <SelectItem value="Idee">Idée</SelectItem>
                    <SelectItem value="Election">Élection</SelectItem>
                    <SelectItem value="Evenement">Événement</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-48 text-sm h-9 sm:h-10">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="unread">Non lues</SelectItem>
                    <SelectItem value="read">Lues</SelectItem>
                  </SelectContent>
                </Select>
                {(filterType !== "all" ||
                  filterStatus !== "all" ||
                  searchTerm) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFilterType("all");
                      setFilterStatus("all");
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

          {/* Liste des notifications */}
          <Card className="shadow-md border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">
                Toutes les notifications ({filteredNotifications.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-0 sm:px-0 pb-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <Bell className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 text-center">
                    Aucune notification trouvée
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">Type</TableHead>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Titre</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead className="text-center">Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const startIndex = (currentPage - 1) * pageSize;
                        const endIndex = startIndex + pageSize;
                        const paginatedNotifications = filteredNotifications.slice(startIndex, endIndex);
                        
                        return paginatedNotifications.map((notification) => (
                          <TableRow key={notification.id}>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              <span className="text-xl">
                                {getNotificationIcon(notification.type)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">
                                {notification.User?.name || "—"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {notification.User?.email || "—"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">
                              {notification.titre}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
                              {notification.message}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={notification.lue ? "outline" : "default"}
                              className={
                                notification.lue
                                  ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                                  : "bg-blue-600 text-white"
                              }
                            >
                              {notification.lue ? "Lue" : "Non lue"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-gray-500">
                              {formatDistanceToNow(
                                new Date(notification.createdAt),
                                {
                                  addSuffix: true,
                                  locale: fr,
                                }
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(notification.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ));
                      })()}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  {filteredNotifications.length > 0 && (() => {
                    const totalPages = Math.ceil(filteredNotifications.length / pageSize);
                    return (
                      <div className="bg-white dark:bg-gray-800 mt-5 flex flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4 sm:gap-0 px-4 sm:px-6">
                        <div className="ml-5 mt-2 flex-1 text-sm text-muted-foreground dark:text-gray-400">
                          {filteredNotifications.length} ligne(s) au total
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

