"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Vote } from "lucide-react";
import { getElectionById, updateElectionStatus } from "@/actions/elections";
import { ElectionStatus } from "@prisma/client";

export default function ElectionDetails({ electionId }: { electionId: string }) {
  const [election, setElection] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getElectionById(electionId);
      if (res.success) setElection(res.election!);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [electionId]);

  const getStatusColor = (status: ElectionStatus) => {
    switch (status) {
      case ElectionStatus.Preparation:
        return "bg-blue-100 text-blue-800";
      case ElectionStatus.Ouverte:
        return "bg-green-100 text-green-800";
      case ElectionStatus.Cloturee:
        return "bg-gray-100 text-gray-800";
      case ElectionStatus.Annulee:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const toggleStatus = async () => {
    if (!election) return;
    const target = election.status === "Ouverte" ? ElectionStatus.Cloturee : ElectionStatus.Ouverte;
    try {
      setSaving(true);
      const res = await updateElectionStatus(election.id, target);
      if (res.success) await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading || !election) {
    return (
      <div className="p-6 text-center">
        Chargement...
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{election.titre}</CardTitle>
          <Badge className={getStatusColor(election.status)}>
            {election.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-2" /> Ouverture: {new Date(election.dateOuverture).toLocaleDateString()}
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2" /> Clôture: {new Date(election.dateCloture).toLocaleDateString()}
            </div>
            <div className="flex items-center">
              <Vote className="h-4 w-4 mr-2" /> Scrutin: {new Date(election.dateScrutin).toLocaleDateString()}
            </div>
          </div>

          {election.positions?.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Postes associés</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {election.positions.map((p: any) => (
                  <li key={p.id}>{p.titre || p.type}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            {election.status === "Preparation" && (
              <Button onClick={toggleStatus} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? "Ouverture..." : "Ouvrir l'élection"}
              </Button>
            )}
            {election.status === "Ouverte" && (
              <Button onClick={toggleStatus} disabled={saving} className="bg-gray-600 hover:bg-gray-700">
                {saving ? "Clôture..." : "Clôturer l'élection"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
