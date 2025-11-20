"use client";

import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "@/actions/notifications";
import { toast } from "sonner";
import { TypeNotification } from "@prisma/client";

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

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const [notificationsResult, countResult] = await Promise.all([
        getNotifications({ limit: 10 }),
        getUnreadNotificationCount(),
      ]);

      if (notificationsResult.success && notificationsResult.notifications) {
        setNotifications(notificationsResult.notifications);
      }

      if (countResult.success && countResult.count !== undefined) {
        setUnreadCount(countResult.count);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // Recharger toutes les 30 secondes
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (notificationId: string) => {
    const result = await markNotificationAsRead(notificationId);
    if (result.success) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, lue: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } else {
      toast.error(result.error || "Erreur");
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await markAllNotificationsAsRead();
    if (result.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, lue: true })));
      setUnreadCount(0);
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 p-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[90vw] sm:w-[400px] p-0"
        align="end"
        sideOffset={5}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm sm:text-base">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="h-7 px-2 text-xs"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Tout lire
              </Button>
            )}
            <Link href="/notifications">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-7 px-2 text-xs"
              >
                Voir tout
              </Button>
            </Link>
          </div>
        </div>
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Bell className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Aucune notification
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    !notification.lue
                      ? "bg-blue-50/50 dark:bg-blue-900/10"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="text-lg flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p
                              className={`text-xs sm:text-sm font-semibold ${
                                !notification.lue
                                  ? "text-gray-900 dark:text-white"
                                  : "text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {notification.titre}
                            </p>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getNotificationColor(
                                notification.type
                              )}`}
                            >
                              {notification.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {formatDistanceToNow(
                              new Date(notification.createdAt),
                              {
                                addSuffix: true,
                                locale: fr,
                              }
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notification.lue && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="h-7 w-7 p-0"
                              title="Marquer comme lue"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(notification.id)}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
                            setOpen(false);
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
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
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

