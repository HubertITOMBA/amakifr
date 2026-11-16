"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SondageForm } from "@/components/sondages/SondageForm";
import { ensureSondagesMenu } from "@/actions/menus/ensure-sondages-menu";
import { useEffect } from "react";

/**
 * Page admin : création d'un sondage ou d'un quiz (brouillon uniquement).
 */
export default function AdminNouveauSondagePage() {
  const router = useRouter();

  useEffect(() => {
    ensureSondagesMenu();
  }, []);

  return (
    <div className="w-full min-w-0 bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 rounded-lg">
      <div className="w-full space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/sondages">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="bg-white border-slate-300 text-slate-800 hover:bg-slate-50 shadow-sm font-semibold"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour à la liste
            </Button>
          </Link>
        </div>

        <Card className="w-full shadow-lg border-blue-200 dark:border-slate-700 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500/90 to-blue-600/90 dark:from-blue-600/90 dark:to-blue-700/90 text-white rounded-t-lg pb-3 sm:pb-4 pt-3 sm:pt-4 px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
              <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" />
              Créer un sondage ou un quiz
            </CardTitle>
            <CardDescription className="text-blue-100 dark:text-blue-200 mt-1 sm:mt-2 text-sm sm:text-base">
              Enregistrement en brouillon — publication et notifications depuis
              la page de détail après relecture
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 px-4 sm:px-6 pb-6 min-w-0">
            {/* Aligné sur le bandeau : pleine largeur utile, pas de max-w étroit */}
            <div className="w-full min-w-0 max-w-full">
              <SondageForm
                onSuccess={(id) => router.push(`/admin/sondages/${id}`)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
