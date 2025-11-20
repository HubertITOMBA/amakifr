"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  description?: string;
  color?: "blue" | "purple" | "green" | "red" | "amber" | "indigo";
  className?: string;
}

const colorClasses = {
  blue: {
    border: "border-blue-200 dark:border-blue-800/50",
    header: "bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20",
    icon: "text-blue-500 dark:text-blue-400",
    accent: "text-blue-600 dark:text-blue-400",
  },
  purple: {
    border: "border-purple-200 dark:border-purple-800/50",
    header: "bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/30 dark:to-purple-800/20",
    icon: "text-purple-500 dark:text-purple-400",
    accent: "text-purple-600 dark:text-purple-400",
  },
  green: {
    border: "border-green-200 dark:border-green-800/50",
    header: "bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/30 dark:to-green-800/20",
    icon: "text-green-500 dark:text-green-400",
    accent: "text-green-600 dark:text-green-400",
  },
  red: {
    border: "border-red-200 dark:border-red-800/50",
    header: "bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-800/20",
    icon: "text-red-500 dark:text-red-400",
    accent: "text-red-600 dark:text-red-400",
  },
  amber: {
    border: "border-amber-200 dark:border-amber-800/50",
    header: "bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20",
    icon: "text-amber-500 dark:text-amber-400",
    accent: "text-amber-600 dark:text-amber-400",
  },
  indigo: {
    border: "border-indigo-200 dark:border-indigo-800/50",
    header: "bg-gradient-to-r from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20",
    icon: "text-indigo-500 dark:text-indigo-400",
    accent: "text-indigo-600 dark:text-indigo-400",
  },
};

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  description,
  color = "blue",
  className,
}: MetricCardProps) {
  const colors = colorClasses[color];
  const isPositive = change !== undefined && change >= 0;
  const ChangeIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className={cn("hover:shadow-lg transition-shadow !py-0 border-2 bg-white dark:bg-gray-900", colors.border, className)}>
      <CardHeader className={cn("flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 sm:px-6 rounded-t-lg", colors.header)}>
        <CardTitle className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">
          {title}
        </CardTitle>
        <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", colors.icon)} />
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div className={cn("text-xl sm:text-2xl font-bold", colors.accent)}>
          {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
        </div>
        {change !== undefined && (
          <div className="flex items-center space-x-2 mt-2">
            <div
              className={cn(
                "flex items-center space-x-1",
                isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              )}
            >
              <ChangeIcon className="h-3 w-3" />
              <span className="text-xs font-medium">
                {isPositive ? "+" : ""}
                {change.toFixed(1)}%
              </span>
            </div>
            {changeLabel && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {changeLabel}
              </span>
            )}
          </div>
        )}
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

