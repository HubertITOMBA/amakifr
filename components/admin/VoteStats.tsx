"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Vote, 
  Users, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Award,
  Calendar
} from "lucide-react";

interface VoteStatsProps {
  elections: Array<{
    id: string;
    titre: string;
    status: string;
    _count: {
      votes: number;
    };
    positions: Array<{
      id: string;
      titre: string;
      candidacies: Array<{
        id: string;
        status: string;
        adherent: {
          firstname: string;
          lastname: string;
        };
      }>;
    }>;
  }>;
}

export function VoteStats({ elections }: VoteStatsProps) {
  // Calculer les statistiques
  const totalElections = elections.length;
  const activeElections = elections.filter(e => e.status === "Ouverte").length;
  const closedElections = elections.filter(e => e.status === "Cloturee").length;
  const totalVotes = elections.reduce((sum, e) => sum + (e._count?.votes ?? 0), 0);
  
  // Élections avec le plus de votes
  const topElections = elections
    .sort((a, b) => (b._count?.votes ?? 0) - (a._count?.votes ?? 0))
    .slice(0, 3);

  // Postes les plus populaires (par nombre de candidatures)
  const posteStats = elections
    .flatMap(e => e.positions)
    .reduce((acc, position) => {
      const key = position.titre;
      if (!acc[key]) {
        acc[key] = { titre: key, candidacies: 0, votes: 0 };
      }
      acc[key].candidacies += position.candidacies.length;
      return acc;
    }, {} as Record<string, { titre: string; candidacies: number; votes: number }>);

  const topPostes = Object.values(posteStats)
    .sort((a, b) => b.candidacies - a.candidacies)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Statistiques générales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Élections</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalElections}</div>
            <p className="text-xs text-muted-foreground">
              {activeElections} actives, {closedElections} clôturées
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
            <Vote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVotes}</div>
            <p className="text-xs text-muted-foreground">
              Toutes élections confondues
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Élections Actives</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeElections}</div>
            <p className="text-xs text-muted-foreground">
              En cours de vote
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Élections Clôturées</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{closedElections}</div>
            <p className="text-xs text-muted-foreground">
              Résultats disponibles
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Élections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Élections les plus actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topElections.length > 0 ? (
                topElections.map((election, index) => (
                  <div key={election.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{election.titre}</p>
                        <Badge variant="outline" className="text-xs">
                          {election.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{election._count?.votes ?? 0}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">votes</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">Aucune donnée disponible</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Postes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Postes les plus populaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topPostes.length > 0 ? (
                topPostes.map((poste, index) => (
                  <div key={poste.titre} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{poste.titre}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{poste.candidacies} candidature(s)</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{poste.candidacies}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">candidats</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">Aucune donnée disponible</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Détails des élections actives */}
      {activeElections > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Élections en cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {elections
                .filter(e => e.status === "Ouverte")
                .map(election => (
                  <div key={election.id} className="border rounded-lg p-4 border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{election.titre}</h4>
                      <Badge className="bg-green-100 text-green-800">
                        {(election._count?.votes ?? 0)} votes
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {election.positions.map(position => (
                        <div key={position.id} className="text-sm">
                          <p className="font-medium">{position.titre}</p>
                          <p className="text-gray-500 dark:text-gray-400">
                            {position.candidacies.length} candidat(s)
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
