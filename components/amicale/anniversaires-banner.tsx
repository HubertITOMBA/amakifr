"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Gift, Cake, ArrowRight } from "lucide-react";

type SpotlightMember = {
  id: string;
  firstname: string;
  lastname: string;
  daysFromBirthday: number;
};

export function AnniversairesBanner() {
  const [members, setMembers] = useState<SpotlightMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/anniversaires", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.success && Array.isArray(data.spotlight)) {
          setMembers(data.spotlight);
        }
      } catch (error) {
        console.error("Erreur chargement bannière anniversaires:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading || members.length === 0) {
    return null;
  }

  return (
    <section className="py-6 bg-gradient-to-r from-pink-50 via-rose-50 to-orange-50 dark:from-slate-800 dark:to-slate-700 border-y border-pink-100 dark:border-slate-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Alert className="border-pink-200 bg-white/90 dark:bg-slate-900/80">
          <Gift className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2 text-pink-700 dark:text-pink-300">
            Joyeux anniversaire
            <Cake className="h-4 w-4" />
          </AlertTitle>
          <AlertDescription className="mt-2">
            <div className="flex flex-wrap gap-2 mb-3">
              {members.map((m) => (
                <Badge key={m.id} variant="secondary" className="bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100">
                  {m.firstname} {m.lastname}
                </Badge>
              ))}
            </div>
            <Link href="/anniversaires" className="inline-flex items-center gap-1 text-sm font-medium text-pink-700 hover:text-pink-900 dark:text-pink-300 dark:hover:text-pink-100">
              Voir la page des anniversaires
              <ArrowRight className="h-4 w-4" />
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    </section>
  );
}
