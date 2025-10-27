"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Calendar, 
  Mail, 
  TrendingUp,
  UserPlus,
  MessageSquare,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

// Données d'exemple pour le dashboard
const stats = [
  {
    title: "Total Membres",
    value: "124",
    change: "+12%",
    changeType: "positive" as const,
    icon: Users,
    description: "Membres actifs cette année"
  },
  {
    title: "Événements",
    value: "8",
    change: "+2",
    changeType: "positive" as const,
    icon: Calendar,
    description: "Événements ce mois"
  },
  {
    title: "Newsletter",
    value: "89",
    change: "+15%",
    changeType: "positive" as const,
    icon: Mail,
    description: "Abonnés à la newsletter"
  },
  {
    title: "Engagement",
    value: "94%",
    change: "+5%",
    changeType: "positive" as const,
    icon: TrendingUp,
    description: "Taux d'engagement moyen"
  }
];

const recentActivities = [
  {
    id: 1,
    type: "user",
    action: "Nouveau membre inscrit",
    user: "Jean Dupont",
    time: "Il y a 2 heures",
    status: "success"
  },
  {
    id: 2,
    type: "event",
    action: "Événement créé",
    user: "Marie Martin",
    time: "Il y a 4 heures",
    status: "info"
  },
  {
    id: 3,
    type: "newsletter",
    action: "Newsletter envoyée",
    user: "Système",
    time: "Il y a 1 jour",
    status: "success"
  },
  {
    id: 4,
    type: "user",
    action: "Profil mis à jour",
    user: "Pierre Durand",
    time: "Il y a 2 jours",
    status: "info"
  }
];

const upcomingEvents = [
  {
    id: 1,
    title: "Assemblée Générale",
    date: "2024-02-15",
    time: "14:00",
    attendees: 45,
    status: "confirmed"
  },
  {
    id: 2,
    title: "Formation Leadership",
    date: "2024-02-22",
    time: "09:00",
    attendees: 20,
    status: "confirmed"
  },
  {
    id: 3,
    title: "Soirée Networking",
    date: "2024-02-28",
    time: "19:00",
    attendees: 30,
    status: "pending"
  }
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Tableau de bord
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          Vue d'ensemble de l'activité de l'association
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon;
          const ChangeIcon = stat.changeType === "positive" ? ArrowUpRight : ArrowDownRight;
          
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {stat.title}
                </CardTitle>
                <IconComponent className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stat.value}
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <div className={`flex items-center space-x-1 ${
                    stat.changeType === "positive" ? "text-green-600" : "text-red-600"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activités récentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Activités récentes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const getIcon = () => {
                  switch (activity.type) {
                    case "user":
                      return <UserPlus className="h-4 w-4" />;
                    case "event":
                      return <Calendar className="h-4 w-4" />;
                    case "newsletter":
                      return <Mail className="h-4 w-4" />;
                    default:
                      return <MessageSquare className="h-4 w-4" />;
                  }
                };

                const getStatusColor = () => {
                  switch (activity.status) {
                    case "success":
                      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
                    case "info":
                      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
                    default:
                      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
                  }
                };

                return (
                  <div key={activity.id} className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${getStatusColor()}`}>
                      {getIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.action}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {activity.user} • {activity.time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Événements à venir */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Événements à venir</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.map((event) => {
                const getStatusBadge = () => {
                  switch (event.status) {
                    case "confirmed":
                      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Confirmé</Badge>;
                    case "pending":
                      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">En attente</Badge>;
                    default:
                      return <Badge variant="secondary">Inconnu</Badge>;
                  }
                };

                return (
                  <div key={event.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {event.title}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(event.date).toLocaleDateString('fr-FR')} à {event.time}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {event.attendees} participants
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
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
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button className="flex items-center space-x-2 h-auto p-4">
              <UserPlus className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Ajouter un membre</div>
                <div className="text-sm opacity-80">Créer un nouveau profil</div>
              </div>
            </Button>
            
            <Button variant="outline" className="flex items-center space-x-2 h-auto p-4">
              <Calendar className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Créer un événement</div>
                <div className="text-sm opacity-80">Planifier une activité</div>
              </div>
            </Button>
            
            <Button variant="outline" className="flex items-center space-x-2 h-auto p-4">
              <Mail className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Envoyer newsletter</div>
                <div className="text-sm opacity-80">Communiquer avec les membres</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
