"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { 
  Users, 
  Calendar, 
  Mail, 
  TrendingUp,
  UserPlus,
  MessageSquare,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Euro,
  AlertTriangle,
  Shield,
  FileText,
  DollarSign,
  HandHeart,
  Receipt,
  BarChart3,
  Settings,
  Database,
  Edit,
  Download,
  Eye,
  Trash2,
  CheckCircle2
} from "lucide-react";
import { getDashboardStats, getRecentActivities, getUpcomingEvents, getDashboardAlerts, getDashboardFinancialStats } from "@/actions/admin/dashboard";
import { getRecentActivitiesForDashboard } from "@/actions/admin/activities";
import { toast } from "react-toastify";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { isAuthorizationError } from "@/lib/utils";

// Couleurs pastel pour les cards
const cardColors = {
  blue: {
    border: "border-blue-200 dark:border-blue-800/50",
    header: "bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20",
    icon: "text-blue-500 dark:text-blue-400",
    accent: "text-blue-600 dark:text-blue-400"
  },
  purple: {
    border: "border-purple-200 dark:border-purple-800/50",
    header: "bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20",
    icon: "text-purple-500 dark:text-purple-400",
    accent: "text-purple-600 dark:text-purple-400"
  },
  pink: {
    border: "border-pink-200 dark:border-pink-800/50",
    header: "bg-gradient-to-r from-pink-100 to-pink-50 dark:from-pink-900/30 dark:to-pink-800/20",
    icon: "text-pink-500 dark:text-pink-400",
    accent: "text-pink-600 dark:text-pink-400"
  },
  teal: {
    border: "border-teal-200 dark:border-teal-800/50",
    header: "bg-gradient-to-r from-teal-100 to-teal-50 dark:from-teal-900/30 dark:to-teal-800/20",
    icon: "text-teal-500 dark:text-teal-400",
    accent: "text-teal-600 dark:text-teal-400"
  },
  indigo: {
    border: "border-indigo-200 dark:border-indigo-800/50",
    header: "bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20",
    icon: "text-indigo-500 dark:text-indigo-400",
    accent: "text-indigo-600 dark:text-indigo-400"
  },
  amber: {
    border: "border-amber-200 dark:border-amber-800/50",
    header: "bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20",
    icon: "text-amber-500 dark:text-amber-400",
    accent: "text-amber-600 dark:text-amber-400"
  }
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Array<{
    title: string;
    value: string;
    change: string;
    changeType: "positive" | "negative";
    icon: typeof Users;
    description: string;
    color: string;
  }>>([]);
  const [recentActivities, setRecentActivities] = useState<Array<{
    id: string;
    type: "user" | "event" | "newsletter" | "profile";
    action: string;
    user: string;
    time: string;
    status: "success" | "info" | "warning";
  }>>([]);
  const [userActivities, setUserActivities] = useState<Array<{
    id: string;
    type: string;
    action: string;
    userName: string | null;
    userEmail: string | null;
    createdAt: Date;
    success: boolean;
  }>>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Array<{
    id: string;
    title: string;
    date: string;
    time: string;
    attendees: number;
    status: "confirmed" | "pending";
  }>>([]);
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    type: "warning" | "info" | "error" | "success";
    title: string;
    message: string;
    count: number;
    link?: string;
  }>>([]);
  const [financialStats, setFinancialStats] = useState<{
    totalDettes: { value: string; formatted: string };
    totalPaiementsMois: { value: string; formatted: string; change: string; changeType: "positive" | "negative" };
    totalAssistances: { value: string; formatted: string };
  } | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [statsResult, activitiesResult, eventsResult, alertsResult, financialResult, userActivitiesResult] = await Promise.all([
        getDashboardStats(),
        getRecentActivities(10),
        getUpcomingEvents(5),
        getDashboardAlerts(),
        getDashboardFinancialStats(),
        getRecentActivitiesForDashboard(10),
      ]);

      if (statsResult.success && statsResult.stats) {
        const statsData = [
          {
            title: "Total Membres",
            value: statsResult.stats.totalMembres.value,
            change: statsResult.stats.totalMembres.change,
            changeType: statsResult.stats.totalMembres.changeType as "positive" | "negative",
            icon: Users,
            description: statsResult.stats.totalMembres.description,
            color: "blue",
          },
          {
            title: "Événements",
            value: statsResult.stats.evenements.value,
            change: statsResult.stats.evenements.change,
            changeType: statsResult.stats.evenements.changeType as "positive" | "negative",
            icon: Calendar,
            description: statsResult.stats.evenements.description,
            color: "purple",
          },
          {
            title: "Newsletter",
            value: statsResult.stats.newsletter.value,
            change: statsResult.stats.newsletter.change,
            changeType: statsResult.stats.newsletter.changeType as "positive" | "negative",
            icon: Mail,
            description: statsResult.stats.newsletter.description,
            color: "pink",
          },
          {
            title: "Engagement",
            value: statsResult.stats.engagement.value,
            change: statsResult.stats.engagement.change,
            changeType: statsResult.stats.engagement.changeType as "positive" | "negative",
            icon: TrendingUp,
            description: statsResult.stats.engagement.description,
            color: "teal",
          },
        ];
        setStats(statsData);
      } else {
        // Ne pas afficher de toast pour les erreurs d'autorisation (l'utilisateur n'a simplement pas accès à cette fonctionnalité)
        if (statsResult.error && !isAuthorizationError(statsResult.error)) {
          toast.error(statsResult.error || "Erreur lors du chargement des statistiques");
        }
      }

      if (activitiesResult.success && activitiesResult.activities) {
        setRecentActivities(activitiesResult.activities);
      } else {
        // Ne pas afficher de toast pour les erreurs d'autorisation
        if (activitiesResult.error && !isAuthorizationError(activitiesResult.error)) {
          toast.error(activitiesResult.error || "Erreur lors du chargement des activités");
        }
      }

      if (eventsResult.success && eventsResult.events) {
        setUpcomingEvents(eventsResult.events.map(event => ({
          ...event,
          status: event.status as "confirmed" | "pending",
        })));
      } else {
        // Ne pas afficher de toast pour les erreurs d'autorisation
        if (eventsResult.error && !isAuthorizationError(eventsResult.error)) {
          toast.error(eventsResult.error || "Erreur lors du chargement des événements");
        }
      }

      if (alertsResult.success && alertsResult.alerts) {
        setAlerts(alertsResult.alerts);
      }

      if (financialResult.success && financialResult.financialStats) {
        setFinancialStats(financialResult.financialStats);
      }

      if (userActivitiesResult.success && userActivitiesResult.activities) {
        setUserActivities(userActivitiesResult.activities);
      }
    } catch (error) {
      console.error("Erreur lors du chargement du dashboard:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Tableau de bord Admin
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-2">
          Gestion administrative de l'association
        </p>
      </div>

      {/* Alertes */}
      {alerts.length > 0 && (
        <Card className="!py-0 border-2 border-red-200 dark:border-red-800/50 bg-white dark:bg-gray-900">
          <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20 rounded-t-lg">
            <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 dark:text-red-400" />
              <span>Alertes et notifications</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="space-y-3">
              {alerts.map((alert) => {
                const getAlertColor = () => {
                  switch (alert.type) {
                    case "error":
                      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800";
                    case "warning":
                      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800";
                    case "info":
                      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800";
                    default:
                      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
                  }
                };

                return (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${getAlertColor()} ${
                      alert.link ? "cursor-pointer hover:opacity-90 transition-opacity" : ""
                    }`}
                    onClick={() => {
                      if (alert.link) {
                        router.push(alert.link);
                      }
                    }}
                  >
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold">{alert.title}</h4>
                      <p className="text-xs mt-1">{alert.message}</p>
                    </div>
                    {alert.link && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-3"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(alert.link!);
                        }}
                      >
                        Voir
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon;
          const ChangeIcon = stat.changeType === "positive" ? ArrowUpRight : ArrowDownRight;
          const colors = cardColors[stat.color as keyof typeof cardColors] || cardColors.blue;
          
          return (
            <Card key={index} className={`hover:shadow-lg transition-shadow !py-0 border-2 ${colors.border} bg-white dark:bg-gray-900`}>
              <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 sm:px-6 ${colors.header} rounded-t-lg`}>
                <CardTitle className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
                  {stat.title}
                </CardTitle>
                <IconComponent className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.icon}`} />
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className={`text-xl sm:text-2xl font-bold ${colors.accent}`}>
                  {stat.value}
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <div className={`flex items-center space-x-1 ${
                    stat.changeType === "positive" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}>
                    <ChangeIcon className="h-3 w-3" />
                    <span className="text-xs font-medium">{stat.change}</span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {stat.description}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Statistiques financières */}
      {financialStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <Card className="!py-0 border-2 border-red-200 dark:border-red-800/50 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow">
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 sm:px-6 ${cardColors.pink.header} rounded-t-lg`}>
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
                Dettes totales
              </CardTitle>
              <DollarSign className={`h-4 w-4 sm:h-5 sm:w-5 ${cardColors.pink.icon}`} />
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className={`text-xl sm:text-2xl font-bold ${cardColors.pink.accent}`}>
                {financialStats.totalDettes.formatted}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Montant total des dettes
              </p>
            </CardContent>
          </Card>

          <Card className="!py-0 border-2 border-emerald-200 dark:border-emerald-800/50 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow">
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 sm:px-6 bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 rounded-t-lg`}>
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
                Paiements ce mois
              </CardTitle>
              <Euro className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 dark:text-emerald-400" />
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {financialStats.totalPaiementsMois.formatted}
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <div className={`flex items-center space-x-1 ${
                  financialStats.totalPaiementsMois.changeType === "positive" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}>
                  {financialStats.totalPaiementsMois.changeType === "positive" ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3" />
                  )}
                  <span className="text-xs font-medium">{financialStats.totalPaiementsMois.change}</span>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  vs mois dernier
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="!py-0 border-2 border-blue-200 dark:border-blue-800/50 bg-white dark:bg-gray-900 hover:shadow-lg transition-shadow">
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 sm:px-6 ${cardColors.blue.header} rounded-t-lg`}>
              <CardTitle className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
                Assistances en attente
              </CardTitle>
              <HandHeart className={`h-4 w-4 sm:h-5 sm:w-5 ${cardColors.blue.icon}`} />
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className={`text-xl sm:text-2xl font-bold ${cardColors.blue.accent}`}>
                {financialStats.totalAssistances.formatted}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Montant total en attente
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Activités utilisateurs récentes */}
        <Card className="!py-0 border-2 border-indigo-200 dark:border-indigo-800/50 bg-white dark:bg-gray-900">
          <CardHeader className={`pt-4 px-4 sm:px-6 pb-3 ${cardColors.indigo.header} rounded-t-lg`}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
                <Activity className={`h-4 w-4 sm:h-5 sm:w-5 ${cardColors.indigo.icon}`} />
                <span>Activités utilisateurs</span>
              </CardTitle>
              <Link href="/admin/activities">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 border-white/30 text-white hover:text-white text-xs"
                >
                  Voir tout
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="space-y-3 sm:space-y-4">
              {userActivities.length > 0 ? (
                userActivities.map((activity) => {
                  const getIcon = () => {
                    switch (activity.type) {
                      case "Creation":
                        return <FileText className="h-4 w-4 text-green-600" />;
                      case "Modification":
                        return <Edit className="h-4 w-4 text-blue-600" />;
                      case "Suppression":
                        return <Trash2 className="h-4 w-4 text-red-600" />;
                      case "Consultation":
                        return <Eye className="h-4 w-4 text-purple-600" />;
                      case "Export":
                        return <Download className="h-4 w-4 text-indigo-600" />;
                      case "Connexion":
                        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
                      default:
                        return <Activity className="h-4 w-4 text-gray-600" />;
                    }
                  };

                  const getStatusColor = () => {
                    return activity.success
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
                  };

                  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), {
                    addSuffix: true,
                    locale: fr,
                  });

                  return (
                    <div key={activity.id} className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${getStatusColor()}`}>
                        {getIcon()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                          {activity.action}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          {activity.userName || activity.userEmail || "Utilisateur"} • {timeAgo}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Aucune activité récente
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Événements à venir */}
        <Card className="!py-0 border-2 border-amber-200 dark:border-amber-800/50 bg-white dark:bg-gray-900">
          <CardHeader className={`pt-4 px-4 sm:px-6 pb-3 ${cardColors.amber.header} rounded-t-lg`}>
            <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
              <Calendar className={`h-4 w-4 sm:h-5 sm:w-5 ${cardColors.amber.icon}`} />
              <span>Événements à venir</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="space-y-3 sm:space-y-4">
              {upcomingEvents.map((event) => {
                const getStatusBadge = () => {
                  switch (event.status) {
                    case "confirmed":
                      return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-800">Confirmé</Badge>;
                    case "pending":
                      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs border border-amber-200 dark:border-amber-800">En attente</Badge>;
                    default:
                      return <Badge variant="secondary" className="text-xs">Inconnu</Badge>;
                  }
                };

                return (
                  <div key={event.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                        {event.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {event.date} à {event.time}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {event.attendees} participants
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                      {getStatusBadge()}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      <Card className="!py-0 border-2 border-slate-200 dark:border-slate-800/50 bg-white dark:bg-gray-900">
        <CardHeader className="pt-4 px-4 sm:px-6 pb-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/20 rounded-t-lg">
          <CardTitle className="text-base sm:text-lg text-gray-700 dark:text-gray-200">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Button 
              onClick={() => router.push('/admin/users/gestion')}
              className="flex items-center justify-start gap-3 h-auto px-4 py-4 sm:px-5 sm:py-5 text-xs sm:text-sm hover:shadow-md transition-shadow"
            >
              <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <div className="text-left flex-1 space-y-1">
                <div className="font-medium leading-tight">Ajouter un membre</div>
                <div className="text-xs sm:text-sm opacity-80 leading-tight">Créer un nouveau profil</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/evenements/gestion')}
              className="flex items-center justify-start gap-3 h-auto px-4 py-4 sm:px-5 sm:py-5 text-xs sm:text-sm hover:shadow-md transition-shadow"
            >
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <div className="text-left flex-1 space-y-1">
                <div className="font-medium leading-tight">Créer un événement</div>
                <div className="text-xs sm:text-sm opacity-80 leading-tight">Planifier une activité</div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/notifications')}
              className="flex items-center justify-start gap-3 h-auto px-4 py-4 sm:px-5 sm:py-5 text-xs sm:text-sm hover:shadow-md transition-shadow"
            >
              <Mail className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <div className="text-left flex-1 space-y-1">
                <div className="font-medium leading-tight">Envoyer notification</div>
                <div className="text-xs sm:text-sm opacity-80 leading-tight">Communiquer avec les membres</div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/finances')}
              className="flex items-center justify-start gap-3 h-auto px-4 py-4 sm:px-5 sm:py-5 text-xs sm:text-sm hover:shadow-md transition-shadow"
            >
              <Euro className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <div className="text-left flex-1 space-y-1">
                <div className="font-medium leading-tight">Gestion finances</div>
                <div className="text-xs sm:text-sm opacity-80 leading-tight">Dettes, paiements, assistances</div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/cotisations/gestion')}
              className="flex items-center justify-start gap-3 h-auto px-4 py-4 sm:px-5 sm:py-5 text-xs sm:text-sm hover:shadow-md transition-shadow"
            >
              <Receipt className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <div className="text-left flex-1 space-y-1">
                <div className="font-medium leading-tight">Cotisations</div>
                <div className="text-xs sm:text-sm opacity-80 leading-tight">Gérer les cotisations</div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/rgpd/demandes')}
              className="flex items-center justify-start gap-3 h-auto px-4 py-4 sm:px-5 sm:py-5 text-xs sm:text-sm hover:shadow-md transition-shadow"
            >
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <div className="text-left flex-1 space-y-1">
                <div className="font-medium leading-tight">Demandes RGPD</div>
                <div className="text-xs sm:text-sm opacity-80 leading-tight">Gérer les suppressions</div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/analytics')}
              className="flex items-center justify-start gap-3 h-auto px-4 py-4 sm:px-5 sm:py-5 text-xs sm:text-sm hover:shadow-md transition-shadow"
            >
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <div className="text-left flex-1 space-y-1">
                <div className="font-medium leading-tight">Analytics</div>
                <div className="text-xs sm:text-sm opacity-80 leading-tight">Statistiques détaillées</div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/exports')}
              className="flex items-center justify-start gap-3 h-auto px-4 py-4 sm:px-5 sm:py-5 text-xs sm:text-sm hover:shadow-md transition-shadow"
            >
              <Database className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <div className="text-left flex-1 space-y-1">
                <div className="font-medium leading-tight">Exports</div>
                <div className="text-xs sm:text-sm opacity-80 leading-tight">Exporter les données</div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              onClick={() => router.push('/admin/settings')}
              className="flex items-center justify-start gap-3 h-auto px-4 py-4 sm:px-5 sm:py-5 text-xs sm:text-sm hover:shadow-md transition-shadow"
            >
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <div className="text-left flex-1 space-y-1">
                <div className="font-medium leading-tight">Paramètres</div>
                <div className="text-xs sm:text-sm opacity-80 leading-tight">Configuration</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
