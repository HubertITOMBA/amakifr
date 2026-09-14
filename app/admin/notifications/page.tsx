"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Trash2,
  X,
  Send,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Eye,
  Loader2,
  Calendar,
  User,
  Link2,
  Mail,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  deleteNotification,
  createNotifications,
  getAdminNotificationsPage,
  getAdminNotificationDetails,
  type AdminNotificationListItem,
  type AdminNotificationDetails,
} from "@/actions/notifications";
import { getAllUsersForAdmin } from "@/actions/user";
import { toast } from "sonner";
import { TypeNotification } from "@prisma/client";
import { sanitizeNotificationLink } from "@/lib/services/notifications/sanitize-notification-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TYPE_BADGE_CLASS: Record<TypeNotification, string> = {
  Systeme: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border-blue-200 dark:border-blue-800",
  Email: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 border-purple-200 dark:border-purple-800",
  Action: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 border-orange-200 dark:border-orange-800",
  Cotisation: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 border-green-200 dark:border-green-800",
  Idee: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
  Election: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800",
  Evenement: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200 border-pink-200 dark:border-pink-800",
  Chat: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200 border-teal-200 dark:border-teal-800",
  Autre: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700",
};

const PAGE_SIZE = 20;
const SEARCH_MIN_CHARS = 2;

const TYPE_LABELS: Record<TypeNotification, string> = {
  Systeme: "Système",
  Email: "Email",
  Action: "Action",
  Cotisation: "Cotisation",
  Idee: "Idée",
  Election: "Élection",
  Evenement: "Événement",
  Chat: "Chat",
  Autre: "Autre",
};

/**
 * Page admin : consultation et création de notifications.
 * La liste utilise une pagination serveur dédiée (hors flux de création).
 */
export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotificationListItem[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewDetails, setViewDetails] = useState<AdminNotificationDetails | null>(null);

  const [formData, setFormData] = useState({
    userIds: [] as string[],
    type: TypeNotification.Systeme,
    titre: "",
    message: "",
    lien: "",
  });
  const [creating, setCreating] = useState(false);

  const loadRequestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterType, filterStatus]);

  const loadUsers = useCallback(async () => {
    try {
      const usersResult = await getAllUsersForAdmin();
      if (usersResult.success && usersResult.users) {
        const adherentsUsers = usersResult.users.filter((user: any) => user.adherent);
        setUsers(adherentsUsers);
      }
    } catch (error) {
      console.error("Erreur chargement utilisateurs:", error);
    }
  }, []);

  const loadNotifications = useCallback(
    async (options?: { silent?: boolean }) => {
      const requestId = ++loadRequestId.current;
      const silent = options?.silent === true;

      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setListError(null);

        const lueFilter =
          filterStatus === "read"
            ? true
            : filterStatus === "unread"
              ? false
              : undefined;

        const effectiveSearch =
          debouncedSearch.length >= SEARCH_MIN_CHARS
            ? debouncedSearch
            : undefined;

        const result = await getAdminNotificationsPage({
          page: currentPage,
          pageSize: PAGE_SIZE,
          search: effectiveSearch,
          type:
            filterType !== "all"
              ? (filterType as TypeNotification)
              : undefined,
          lue: lueFilter,
        });

        if (requestId !== loadRequestId.current) {
          return;
        }

        if (result.success) {
          setNotifications(result.notifications);
          setTotal(result.total);
          setTotalPages(result.totalPages);
          if (result.page !== currentPage) {
            setCurrentPage(result.page);
          }
        } else {
          setListError(result.error || "Erreur lors du chargement");
          toast.error(result.error || "Erreur lors du chargement");
        }
      } catch (error) {
        if (requestId !== loadRequestId.current) {
          return;
        }
        console.error("Erreur:", error);
        setListError("Erreur lors du chargement");
        toast.error("Erreur lors du chargement");
      } finally {
        if (requestId === loadRequestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [currentPage, debouncedSearch, filterType, filterStatus]
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRefresh = async () => {
    if (loading || refreshing) return;
    await loadNotifications({ silent: true });
  };

  const handleCreateNotification = async () => {
    if (formData.userIds.length === 0 || !formData.titre || !formData.message) {
      toast.error("Veuillez sélectionner au moins un adhérent et remplir tous les champs obligatoires");
      return;
    }

    try {
      setCreating(true);
      const result = await createNotifications({
        userIds: formData.userIds,
        type: formData.type,
        titre: formData.titre,
        message: formData.message,
        lien: formData.lien || undefined,
      });

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
        await loadNotifications({ silent: true });
      } else {
        toast.error(result.error || "Erreur lors de la création des notifications");
      }
    } catch (error: any) {
      console.error("[Notifications] Exception:", error);
      toast.error(`Erreur: ${error?.message || error?.toString() || "création"}`);
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
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success("Notification supprimée");
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const openViewDialog = async (notificationId: string) => {
    setViewOpen(true);
    setViewLoading(true);
    setViewError(null);
    setViewDetails(null);

    try {
      const result = await getAdminNotificationDetails(notificationId);
      if (result.success && result.notification) {
        setViewDetails(result.notification);
      } else {
        setViewError(result.error || "Impossible de charger la notification");
      }
    } catch (error) {
      console.error(error);
      setViewError("Impossible de charger la notification");
    } finally {
      setViewLoading(false);
    }
  };

  const isBusy = loading || refreshing;

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
              <DialogContent
                className="w-[95vw] sm:w-full max-w-2xl max-h-[min(90vh,720px)] overflow-y-auto p-0 overflow-x-hidden"
                showCloseButton={false}
              >
                <DialogHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white px-4 sm:px-5 pt-3 pb-2.5 rounded-t-lg">
                  <DialogTitle className="text-white text-base sm:text-lg font-bold flex items-center gap-2">
                    <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-white shrink-0" />
                    Créer une notification
                  </DialogTitle>
                  <DialogDescription className="text-blue-50 dark:text-blue-100 text-xs sm:text-sm mt-1">
                    Envoyez la notification à un ou plusieurs adhérents.
                  </DialogDescription>
                </DialogHeader>

                <div className="px-4 sm:px-5 py-3 bg-white dark:bg-gray-900 space-y-3">
                  <section
                    className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-2.5 sm:p-3 space-y-1.5"
                    data-testid="create-notification-recipients"
                  >
                    <Label
                      htmlFor="userIds"
                      className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide"
                    >
                      Destinataires *
                    </Label>
                    <p
                      id="create-notification-recipients-help"
                      className="text-xs text-slate-600 dark:text-slate-400"
                    >
                      Recherchez et sélectionnez les adhérents.
                    </p>
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
                    {formData.userIds.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 text-xs"
                        data-testid="create-notification-recipient-count"
                      >
                        {formData.userIds.length === users.length
                          ? `Tous les adhérents (${formData.userIds.length})`
                          : `${formData.userIds.length} adhérent(s) sélectionné(s)`}
                      </Badge>
                    )}
                  </section>

                  <section
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-2.5 sm:p-3 space-y-2.5"
                    data-testid="create-notification-content"
                  >
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                      Contenu
                    </p>

                    <div className="space-y-1">
                      <Label htmlFor="type" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Type *
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
                        <SelectTrigger className="text-sm h-9 border-slate-300 dark:border-slate-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TypeNotification.Systeme}>Système</SelectItem>
                          <SelectItem value={TypeNotification.Email}>Email</SelectItem>
                          <SelectItem value={TypeNotification.Action}>Action</SelectItem>
                          <SelectItem value={TypeNotification.Cotisation}>Cotisation</SelectItem>
                          <SelectItem value={TypeNotification.Idee}>Idée</SelectItem>
                          <SelectItem value={TypeNotification.Election}>Élection</SelectItem>
                          <SelectItem value={TypeNotification.Evenement}>Événement</SelectItem>
                          <SelectItem value={TypeNotification.Autre}>Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="titre" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Titre * <span className="text-slate-500 font-normal">(255 car. max)</span>
                      </Label>
                      <Input
                        id="titre"
                        value={formData.titre}
                        onChange={(e) =>
                          setFormData({ ...formData, titre: e.target.value })
                        }
                        placeholder="Ex: Votre idée a été validée"
                        maxLength={255}
                        className="text-sm h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label
                        htmlFor="message"
                        className="text-xs font-semibold text-slate-700 dark:text-slate-200"
                      >
                        Message *
                      </Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        placeholder="Ex: Félicitations ! Votre idée a été validée."
                        rows={3}
                        className="text-sm min-h-[4.5rem]"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="lien" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Lien
                      </Label>
                      <Input
                        id="lien"
                        value={formData.lien}
                        onChange={(e) =>
                          setFormData({ ...formData, lien: e.target.value })
                        }
                        placeholder="Ex: /idees/123"
                        maxLength={500}
                        aria-describedby="create-notification-lien-help"
                        className="text-sm h-9"
                      />
                      <p
                        id="create-notification-lien-help"
                        className="text-xs text-slate-500"
                      >
                        Facultatif — route interne ou URL HTTPS.
                      </p>
                    </div>
                  </section>

                  <div
                    className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700"
                    data-testid="create-notification-footer"
                  >
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateDialog(false)}
                      disabled={creating}
                      className="w-full sm:w-auto text-sm h-8 sm:h-9 border-slate-300 dark:border-slate-600"
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={handleCreateNotification}
                      disabled={creating}
                      className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm h-8 sm:h-9"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Envoi...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Envoyer
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
                <div className="flex-1 space-y-1.5">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                      data-testid="search-icon"
                    />
                    <Input
                      placeholder="Rechercher par titre, nom ou e-mail"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 sm:pl-10 pr-10 sm:pr-10 text-sm h-9 sm:h-10"
                      aria-describedby="notifications-search-help"
                      data-testid="notifications-search-input"
                    />
                    {searchTerm ? (
                      <button
                        type="button"
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        aria-label="Effacer la recherche"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <p
                    id="notifications-search-help"
                    className="text-xs text-gray-500 dark:text-gray-400"
                    data-testid="notifications-search-help"
                  >
                    {searchTerm.trim().length === 1
                      ? "Saisissez au moins 2 caractères pour lancer la recherche."
                      : "Recherche sur le titre, le nom ou l’e-mail du destinataire (min. 2 caractères)."}
                  </p>
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
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6 flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-base sm:text-lg">
                Toutes les notifications ({total})
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isBusy}
                className="shrink-0"
                aria-label="Actualiser la liste des notifications"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Actualiser
              </Button>
            </CardHeader>
            <CardContent className="pt-0 px-0 sm:px-0 pb-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : listError ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 gap-3">
                  <p className="text-sm text-red-600 dark:text-red-400 text-center">
                    {listError}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => loadNotifications()}>
                    Réessayer
                  </Button>
                </div>
              ) : notifications.length === 0 ? (
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
                        <TableHead>Destinataire</TableHead>
                        <TableHead>Titre</TableHead>
                        <TableHead className="hidden md:table-cell text-center">Type</TableHead>
                        <TableHead className="text-center">Statut</TableHead>
                        <TableHead className="hidden lg:table-cell">Date</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notifications.map((notification) => (
                        <TableRow key={notification.id}>
                          <TableCell>
                            <div className="text-sm min-w-0">
                              <div className="font-medium truncate">
                                {notification.User?.name || "—"}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {notification.User?.email || "—"}
                              </div>
                              <div className="text-xs text-gray-500 lg:hidden mt-0.5">
                                {formatDistanceToNow(new Date(notification.createdAt), {
                                  addSuffix: true,
                                  locale: fr,
                                })}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium max-w-[12rem] sm:max-w-xs truncate">
                              {notification.titre}
                            </div>
                            <div className="text-xs text-gray-500 md:hidden mt-0.5">
                              {TYPE_LABELS[notification.type] || notification.type}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-center">
                            <Badge
                              variant="outline"
                              className={`text-xs ${TYPE_BADGE_CLASS[notification.type] || TYPE_BADGE_CLASS.Autre}`}
                            >
                              {TYPE_LABELS[notification.type] || notification.type}
                            </Badge>
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
                          <TableCell className="hidden lg:table-cell">
                            <div className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(notification.createdAt), {
                                addSuffix: true,
                                locale: fr,
                              })}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openViewDialog(notification.id)}
                                className="h-8 w-8 p-0 border-blue-300 hover:bg-blue-50"
                                title="Voir"
                                aria-label={`Voir la notification ${notification.titre}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(notification.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {total > 0 && (
                    <div className="bg-white dark:bg-gray-800 mt-5 flex flex-col sm:flex-row items-center justify-between py-5 font-semibold rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 gap-4 sm:gap-0 px-4 sm:px-6 mx-2 sm:mx-4 mb-4">
                      <div className="flex-1 text-sm text-muted-foreground dark:text-gray-400">
                        {total} ligne(s) au total — page {currentPage} / {totalPages}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1 || isBusy}
                        >
                          <span className="sr-only">Aller à la première page</span>
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1 || isBusy}
                        >
                          <span className="sr-only">Page précédente</span>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                          }
                          disabled={currentPage >= totalPages || isBusy}
                        >
                          <span className="sr-only">Page suivante</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="hidden h-8 w-8 p-0 lg:flex"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage >= totalPages || isBusy}
                        >
                          <span className="sr-only">Aller à la dernière page</span>
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog consultation */}
      <Dialog
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) {
            setViewDetails(null);
            setViewError(null);
          }
        }}
      >
        <DialogContent
          className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 overflow-x-hidden"
          showCloseButton={false}
        >
          <DialogHeader className="bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white px-6 pt-6 pb-4 rounded-t-lg">
            <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-white shrink-0" />
              <span className="line-clamp-2">
                {viewDetails?.titre || "Détail de la notification"}
              </span>
            </DialogTitle>
            <DialogDescription className="text-blue-50 dark:text-blue-100 text-sm mt-2">
              Consultation en lecture seule d&apos;une notification envoyée à un adhérent.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 bg-white dark:bg-gray-900 space-y-4">
            {viewLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : viewError ? (
              <p className="text-sm text-red-600 dark:text-red-400 py-4" role="alert">
                {viewError}
              </p>
            ) : viewDetails ? (
              <>
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 p-3 space-y-1">
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Destinataire
                  </p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {viewDetails.User?.name || "—"}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 break-all">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {viewDetails.User?.email || "—"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={TYPE_BADGE_CLASS[viewDetails.type] || TYPE_BADGE_CLASS.Autre}
                  >
                    {TYPE_LABELS[viewDetails.type] || viewDetails.type}
                  </Badge>
                  <Badge
                    variant={viewDetails.lue ? "outline" : "default"}
                    className={
                      viewDetails.lue
                        ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                        : "bg-blue-600 text-white"
                    }
                  >
                    {viewDetails.lue ? "Lue" : "Non lue"}
                  </Badge>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3">
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Date de création
                  </p>
                  <p className="text-sm text-slate-900 dark:text-slate-100">
                    {format(new Date(viewDetails.createdAt), "dd/MM/yyyy HH:mm", {
                      locale: fr,
                    })}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-3">
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide mb-2">
                    Message
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-900 dark:text-slate-100 leading-relaxed">
                    {viewDetails.message}
                  </p>
                </div>

                {(() => {
                  const safeLink = sanitizeNotificationLink(viewDetails.lien);
                  if (safeLink.kind === "empty") {
                    return null;
                  }

                  return (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                      <p className="text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                        <Link2 className="h-3.5 w-3.5" />
                        Lien
                      </p>
                      {safeLink.kind === "internal" ? (
                        <a
                          href={safeLink.href}
                          className="text-xs font-mono text-blue-700 dark:text-blue-300 break-all underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-200"
                        >
                          {safeLink.href}
                        </a>
                      ) : safeLink.kind === "external" ? (
                        <a
                          href={safeLink.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-blue-700 dark:text-blue-300 break-all underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-200"
                        >
                          {safeLink.href}
                        </a>
                      ) : (
                        <p
                          className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all"
                          title="Lien non autorisé — affichage texte uniquement"
                        >
                          {safeLink.raw}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewOpen(false)}
                className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
