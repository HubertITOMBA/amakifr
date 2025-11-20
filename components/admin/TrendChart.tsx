"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { LucideIcon } from "lucide-react";

interface TrendChartProps {
  title: string;
  data: Array<{ [key: string]: string | number | Date }>;
  type?: "line" | "bar";
  dataKeys: Array<{ key: string; name: string; color: string }>;
  icon?: LucideIcon;
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

export function TrendChart({
  title,
  data,
  type = "line",
  dataKeys,
  icon: Icon,
  color = "blue",
  className,
}: TrendChartProps) {
  const colors = colorClasses[color];

  const ChartComponent = type === "line" ? LineChart : BarChart;

  return (
    <Card className={`!py-0 border-2 bg-white dark:bg-gray-900 ${colors.border} ${className || ""}`}>
      <CardHeader className={`pt-4 px-4 sm:px-6 pb-3 rounded-t-lg ${colors.header}`}>
        <CardTitle className="flex items-center space-x-2 text-base sm:text-lg text-gray-700 dark:text-gray-200">
          {Icon && <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.icon}`} />}
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <ResponsiveContainer width="100%" height={300}>
          <ChartComponent data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
            <XAxis
              dataKey="mois"
              className="text-xs"
              tick={{ fill: "currentColor" }}
            />
            <YAxis className="text-xs" tick={{ fill: "currentColor" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
            />
            <Legend />
            {dataKeys.map(({ key, name, color: lineColor }) =>
              type === "line" ? (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={name}
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ) : (
                <Bar key={key} dataKey={key} name={name} fill={lineColor} />
              )
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

