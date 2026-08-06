"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SondageForm } from "@/components/sondages/SondageForm";
import { ensureSondagesMenu } from "@/actions/menus/ensure-sondages-menu";
import { useEffect } from "react";

/**
 * Page admin : création d'un sondage
 */
export default function AdminNouveauSondagePage() {
  const router = useRouter();

  useEffect(() => {
    ensureSondagesMenu();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link href="/admin/sondages">
          <Button variant="outline" size="sm" className="border-slate-300">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour à la liste
          </Button>
        </Link>

        <Card className="shadow-lg border-blue-200 dark:border-slate-700">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Nouveau sondage
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <SondageForm onSuccess={(id) => router.push(`/admin/sondages/${id}`)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
