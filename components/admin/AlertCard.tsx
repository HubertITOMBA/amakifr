"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, Calendar, Vote, LucideIcon } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Alert {
  id: string;
  type: "adherent" | "evenement" | "election";
  title: string;
  description: string;
  count?: number;
  date?: Date;
  link?: string;
}

interface AlertCardProps {
  alerts: Alert[];
  title: string;
  icon: LucideIcon;
  color?: "blue" | "purple" | "green" | "red" | "amber" | "indigo";
  className?: string;
}

const colorClasses = {
  blue: {
    border: "border-blue-200 dark:border-blue-800/50",
    header: "bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20",
    icon: "text-blue-500 dark:text-blue-400",
  },
  purple: {
    border: "border-purple-200 dark:border-purple-800/50",
    header: "bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20",
    icon: "text-purple-500 dark:text-purple-400",
  },
  green: {
    border: "border-green-200 dark:border-green-800/50",
    header: "bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20",
    icon: "text-green-500 dark:text-green-400",
  },
  red: {
    border: "border-red-200 dark:border-red-800/50",
    header: "bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20",
    icon: "text-red-500 dark:text-red-400",
  },
  amber: {
    border: "border-amber-200 dark:border-amber-800/50",
    header: "bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20",
    icon: "text-amber-500 dark:text-amber-400",
  },
  indigo: {
    border: "border-indigo-200 dark:border-indigo-800/50",
    header: "bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20",
    icon: "text-indigo-500 dark:text-indigo-400",
  },
};

const getTypeIcon = (type: Alert["type"]) => {
  switch (type) {
    case "adherent":
      return Users;
    case "evenement":
      return Calendar;
    case "election":
      return Vote;
    default:
      return AlertTriangle;
  }
};

const getTypeBadge = (type: Alert["type"]) => {
  switch (type) {
    case "adherent":
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs">Adhérent</Badge>;
    case "evenement":
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 text-xs">Événement</Badge>;
    case "election":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">Élection</Badge>;
    default:
      return null;
  }
};

export function AlertCard({ alerts, title, icon: Icon, color = "red", className }: AlertCardProps) {
  const colors = colorClasses[color];

  if (alerts.length === 0) {
    return (
      <Card className={`!py-0 border-2 bg-white dark:bg-gray-900 ${colors.border} ${className || ""}`}>
        <CardHeader className={`pt-4 px-4 sm:px-6 pb-3 rounded-t-lg ${colors.header}`}>
          <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
            <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.icon}`} />
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            Aucune alerte pour le moment
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`!py-0 border-2 bg-white dark:bg-gray-900 ${colors.border} ${className || ""}`}>
      <CardHeader className={`pt-4 px-4 sm:px-6 pb-3 rounded-t-lg ${colors.header}`}>
        <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.icon}`} />
          <span>{title}</span>
          <Badge variant="secondary" className="ml-auto">
            {alerts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="space-y-3">
          {alerts.map((alert) => {
            const TypeIcon = getTypeIcon(alert.type);
            const content = (
              <div className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  <TypeIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {alert.title}
                    </h4>
                    {getTypeBadge(alert.type)}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {alert.description}
                  </p>
                  {alert.count !== undefined && (
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {alert.count} {alert.count > 1 ? "éléments" : "élément"}
                    </p>
                  )}
                  {alert.date && (
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {format(alert.date, "dd MMMM yyyy", { locale: fr })}
                    </p>
                  )}
                </div>
              </div>
            );

            return alert.link ? (
              <Link key={alert.id} href={alert.link}>
                {content}
              </Link>
            ) : (
              <div key={alert.id}>{content}</div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

