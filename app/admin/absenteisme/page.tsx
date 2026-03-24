"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { getAbsenteismeStats, relancerAbsenteismeAdherent } from "@/actions/absenteisme";

type MembreAbsenteisme = {
  adherentId: string;
  nom: string;
  email: string | null;
  totalAbsences: number;
  totalAbsencesReunions: number;
  totalAbsencesEvenements: number;
  absencesConsecutivesSansJustificatif: number;
  totalExcuses: number;
  doitEtreRelance: boolean;
  motifRelance: string | null;
};

export default function AdminAbsenteismePage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ totalMembres: number; membresARelancer: number; totalRelances30j: number } | null>(null);
  const [membres, setMembres] = useState<MembreAbsenteisme[]>([]);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getAbsenteismeStats();
      if (!result.success || !result.data) {
        toast.error(result.error || "Impossible de charger l'absentéisme");
        return;
      }
      setStats(result.data.resume);
      setMembres(result.data.membres);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRelance = async (adherentId: string) => {
    setSendingTo(adherentId);
    try {
      const result = await relancerAbsenteismeAdherent(adherentId);
      if (result.success) {
        toast.success(result.message || "Relance envoyée");
        await loadData();
      } else {
        toast.error(result.error || "Relance impossible");
      }
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">Absentéisme des membres</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Suivi des absences, détection des cas à recadrer et relances.
            </p>
          </div>
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Membres suivis</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{stats?.totalMembres ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">À relancer</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold text-red-600">{stats?.membresARelancer ?? 0}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Relances (30j)</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-semibold">{stats?.totalRelances30j ?? 0}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Membres à recadrer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Membre</th>
                    <th className="text-left py-2 px-2">Absences</th>
                    <th className="text-left py-2 px-2">Réunions</th>
                    <th className="text-left py-2 px-2">Événements</th>
                    <th className="text-left py-2 px-2">3 successives sans justif.</th>
                    <th className="text-left py-2 px-2">Motif</th>
                    <th className="text-left py-2 px-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {membres
                    .filter((m) => m.doitEtreRelance)
                    .map((m) => (
                      <tr key={m.adherentId} className="border-b">
                        <td className="py-2 px-2">{m.nom}</td>
                        <td className="py-2 px-2">{m.totalAbsences}</td>
                        <td className="py-2 px-2">{m.totalAbsencesReunions}</td>
                        <td className="py-2 px-2">{m.totalAbsencesEvenements}</td>
                        <td className="py-2 px-2">{m.absencesConsecutivesSansJustificatif}</td>
                        <td className="py-2 px-2">
                          <Badge variant="secondary">{m.motifRelance ?? "-"}</Badge>
                        </td>
                        <td className="py-2 px-2">
                          <Button
                            size="sm"
                            onClick={() => handleRelance(m.adherentId)}
                            disabled={sendingTo === m.adherentId}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            Relancer
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
