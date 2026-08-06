"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getActiveSondagesForAdherent } from "@/actions/sondages";

type ActiveSondage = {
  id: string;
  sujet: string;
  dateDebut: string;
  dateFin: string;
  aRepondu: boolean;
  modifieLe: string | null;
};

/**
 * Bandeau sur le profil adhérent invitant à répondre aux sondages ouverts.
 */
export function SondageProfileBanner() {
  const [sondages, setSondages] = useState<ActiveSondage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getActiveSondagesForAdherent();
        if (res.success && res.data) {
          setSondages(res.data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || sondages.length === 0) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2 mb-4 space-y-3">
      {sondages.map((s) => {
        const dateFin = new Date(s.dateFin).toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        return (
          <Card
            key={s.id}
            className="border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 shadow-md"
          >
            <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <div className="rounded-full bg-blue-600 p-2 text-white shrink-0">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    Sondage en cours
                  </p>
                  <p className="font-semibold text-slate-900 dark:text-white truncate">{s.sujet}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Clôture le {dateFin}
                    {s.aRepondu && (
                      <span className="inline-flex items-center gap-1 ml-2 text-green-700 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Réponse enregistrée — modifiable jusqu&apos;à la clôture
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Link href={`/sondages/${s.id}`} className="shrink-0">
                <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                  {s.aRepondu ? "Modifier ma réponse" : "Répondre au sondage"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
