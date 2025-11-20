"use client";

import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, CheckCheck, Trash2, Filter, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "@/actions/notifications";
import { toast } from "sonner";
import { TypeNotification } from "@prisma/client";
import Link from "next/link";

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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const options: any = {
        limit: 100,
      };

      if (filterType !== "all") {
        options.type = filterType as TypeNotification;
      }

      if (filterStatus !== "all") {
        options.lue = filterStatus === "read";
      }

      const result = await getNotifications(options);
      if (result.success && result.notifications) {
        setNotifications(result.notifications);
      } else {
        toast.error(result.error || "Erreur lors du chargement");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des notifications");
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    const result = await markNotificationAsRead(notificationId);
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, lue: true } : n
        )
      );
      toast.success("Notification marquée comme lue");
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await markAllNotificationsAsRead();
    if (result.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, lue: true })));
      toast.success("Toutes les notifications ont été marquées comme lues");
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const handleDelete = async (notificationId: string) => {
    const result = await deleteNotification(notificationId);
    if (result.success) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      toast.success("Notification supprimée");
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (filterType !== "all" && notification.type !== filterType) {
      return false;
    }
    if (filterStatus !== "all") {
      if (filterStatus === "read" && !notification.lue) return false;
      if (filterStatus === "unread" && notification.lue) return false;
    }
    return true;
  });

  const unreadCount = filteredNotifications.filter((n) => !n.lue).length;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      
      <main className="flex-1 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* En-tête */}
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2 sm:gap-3">
                  <Bell className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400" />
                  Mes Notifications
                </h1>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
                  Gérez toutes vos notifications en un seul endroit
                </p>
              </div>
              {unreadCount > 0 && (
                <Button
                  onClick={handleMarkAllAsRead}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 sm:h-10"
                >
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Tout marquer comme lu ({unreadCount})
                </Button>
              )}
            </div>
          </div>

          {/* Filtres */}
          <Card className="mb-6 shadow-md border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                Filtres
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="flex-1">
                  <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2 block">
                    Type
                  </label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-full text-sm h-9 sm:h-10">
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
                </div>
                <div className="flex-1">
                  <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2 block">
                    Statut
                  </label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full text-sm h-9 sm:h-10">
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="unread">Non lues</SelectItem>
                      <SelectItem value="read">Lues</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(filterType !== "all" || filterStatus !== "all") && (
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFilterType("all");
                        setFilterStatus("all");
                      }}
                      className="w-full sm:w-auto text-sm h-9 sm:h-10"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Réinitialiser
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Liste des notifications */}
          <Card className="shadow-md border-gray-200 dark:border-gray-700">
            <CardHeader className="pb-3 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">
                Notifications ({filteredNotifications.length})
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
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                        !notification.lue
                          ? "bg-blue-50/50 dark:bg-blue-900/10"
                          : ""
                      }`}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="text-xl sm:text-2xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 sm:gap-4 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 sm:mb-2 flex-wrap">
                                <h3
                                  className={`text-sm sm:text-base font-semibold ${
                                    !notification.lue
                                      ? "text-gray-900 dark:text-white"
                                      : "text-gray-700 dark:text-gray-300"
                                  }`}
                                >
                                  {notification.titre}
                                </h3>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${getNotificationColor(
                                    notification.type
                                  )}`}
                                >
                                  {notification.type}
                                </Badge>
                                {!notification.lue && (
                                  <Badge
                                    variant="default"
                                    className="bg-blue-600 text-white text-xs"
                                  >
                                    Nouveau
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {formatDistanceToNow(
                                  new Date(notification.createdAt),
                                  {
                                    addSuffix: true,
                                    locale: fr,
                                  }
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                              {!notification.lue && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleMarkAsRead(notification.id)
                                  }
                                  className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                                  title="Marquer comme lue"
                                >
                                  <CheckCheck className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(notification.id)}
                                className="h-8 w-8 sm:h-9 sm:w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {notification.lien && (
                            <Link
                              href={notification.lien}
                              onClick={() => {
                                if (!notification.lue) {
                                  handleMarkAsRead(notification.id);
                                }
                              }}
                              className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 mt-2"
                            >
                              Voir plus →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}

