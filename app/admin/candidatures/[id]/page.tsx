"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft,
  User, 
  Calendar, 
  Clock, 
  FileText, 
  Award, 
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye
} from "lucide-react";
import { getCandidacyById, updateCandidacyStatus } from "@/actions/elections";
import { CandidacyStatus } from "@prisma/client";
import Link from "next/link";
import { toast } from "sonner";

interface CandidacyDetails {
  id: string;
  status: CandidacyStatus;
  motivation?: string;
  programme?: string;
  documents?: string[];
  createdAt: string;
  adherent: {
    id: string;
    firstname: string;
    lastname: string;
    civility: string;
    telephone?: string;
    adresse?: {
      rue?: string;
      ville?: string;
      codePostal?: string;
      pays?: string;
    };
    User: {
      id: string;
      name: string;
      email: string;
      image?: string;
    };
  };
  position: {
    id: string;
    titre: string;
    description?: string;
    election: {
      id: string;
      titre: string;
      description?: string;
      dateOuverture: string;
      dateCloture: string;
      dateScrutin: string;
    };
  };
}

export default function CandidacyDetailPage() {
  const params = useParams();
  const candidacyId = params.id as string;
  
  const [candidacy, setCandidacy] = useState<CandidacyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (candidacyId) {
      loadCandidacy();
    }
  }, [candidacyId]);

  const loadCandidacy = async () => {
    try {
      setLoading(true);
      const result = await getCandidacyById(candidacyId);
      if (result.success && result.data) {
        setCandidacy(result.data as CandidacyDetails);
      } else {
        toast.error("Erreur lors du chargement de la candidature");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement de la candidature");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (status: CandidacyStatus) => {
    if (!candidacy) return;
    
    try {
      setUpdating(true);
      const result = await updateCandidacyStatus(candidacy.id, status);
      if (result.success) {
        setCandidacy(prev => prev ? { ...prev, status } : null);
        toast.success(`Candidature ${status === CandidacyStatus.Approuvee ? 'approuvée' : 'rejetée'}`);
      } else {
        toast.error(result.error || "Erreur lors de la mise à jour");
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusConfig = (status: CandidacyStatus) => {
    switch (status) {
      case CandidacyStatus.EnAttente:
        return { label: "En attente", color: "bg-yellow-100 text-yellow-800", icon: Clock };
      case CandidacyStatus.Approuvee:
        return { label: "Approuvée", color: "bg-green-100 text-green-800", icon: CheckCircle2 };
      case CandidacyStatus.Rejetee:
        return { label: "Rejetée", color: "bg-red-100 text-red-800", icon: XCircle };
      default:
        return { label: "Inconnu", color: "bg-gray-100 text-gray-800", icon: AlertCircle };
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Clock className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Chargement de la candidature...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!candidacy) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold mb-2">Candidature non trouvée</h1>
          <p className="text-gray-600 mb-4">La candidature demandée n'existe pas ou a été supprimée.</p>
          <Button asChild>
            <Link href="/admin/elections">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à l'administration
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(candidacy.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/admin/elections">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'administration
          </Link>
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Détails de la candidature</h1>
            <p className="text-gray-600">
              {candidacy.position.election.titre} - {candidacy.position.titre}
            </p>
          </div>
          <Badge className={`${statusConfig.color} flex items-center gap-2`}>
            <StatusIcon className="h-4 w-4" />
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations du candidat */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informations du candidat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={candidacy.adherent.User.image || undefined} />
                  <AvatarFallback>
                    {candidacy.adherent.firstname[0]}{candidacy.adherent.lastname[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">
                    {candidacy.adherent.civility} {candidacy.adherent.firstname} {candidacy.adherent.lastname}
                  </h3>
                  <p className="text-gray-600">{candidacy.adherent.User.email}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">{candidacy.adherent.User.email}</span>
                </div>
                
                {candidacy.adherent.telephone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{candidacy.adherent.telephone}</span>
                  </div>
                )}

                {candidacy.adherent.adresse && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                    <div className="text-sm">
                      {candidacy.adherent.adresse.rue && (
                        <p>{candidacy.adherent.adresse.rue}</p>
                      )}
                      {(candidacy.adherent.adresse.ville || candidacy.adherent.adresse.codePostal) && (
                        <p>
                          {candidacy.adherent.adresse.codePostal} {candidacy.adherent.adresse.ville}
                        </p>
                      )}
                      {candidacy.adherent.adresse.pays && (
                        <p>{candidacy.adherent.adresse.pays}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Détails de la candidature */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informations de l'élection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Poste et élection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{candidacy.position.titre}</h3>
                {candidacy.position.description && (
                  <p className="text-gray-600 mt-1">{candidacy.position.description}</p>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Ouverture</p>
                    <p className="text-sm text-gray-600">
                      {new Date(candidacy.position.election.dateOuverture).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Clôture</p>
                    <p className="text-sm text-gray-600">
                      {new Date(candidacy.position.election.dateCloture).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium">Scrutin</p>
                    <p className="text-sm text-gray-600">
                      {new Date(candidacy.position.election.dateScrutin).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Motivation */}
          {candidacy.motivation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Motivation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-wrap">{candidacy.motivation}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Programme */}
          {candidacy.programme && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Programme
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-wrap">{candidacy.programme}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          {candidacy.documents && candidacy.documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents joints
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {candidacy.documents.map((doc, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{doc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          {candidacy.status === CandidacyStatus.EnAttente && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>
                  Validez ou rejetez cette candidature
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleStatusUpdate(CandidacyStatus.Approuvee)}
                    disabled={updating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approuver
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate(CandidacyStatus.Rejetee)}
                    disabled={updating}
                    variant="destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Rejeter
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Informations de la candidature */}
          <Card>
            <CardHeader>
              <CardTitle>Informations de la candidature</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Date de candidature</p>
                  <p className="text-gray-600">
                    {new Date(candidacy.createdAt).toLocaleDateString("fr-FR", {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <p className="font-medium">Statut actuel</p>
                  <Badge className={`${statusConfig.color} inline-flex items-center gap-1`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
