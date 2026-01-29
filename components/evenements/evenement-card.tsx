"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  MapPin, 
  Users, 
  Euro, 
  Clock,
  Tag,
  Mail,
  Phone,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Search
} from "lucide-react";
import { type EvenementData } from "@/actions/evenements";

interface EvenementCardProps {
  evenement: EvenementData;
  onInscription?: (evenement: EvenementData) => void;
  onVoirDetails?: (evenement: EvenementData) => void;
  showAdminActions?: boolean;
  onEdit?: (evenement: EvenementData) => void;
  onDelete?: (id: string) => void;
}

export function EvenementCard({ 
  evenement, 
  onInscription, 
  onVoirDetails, 
  showAdminActions = false,
  onEdit,
  onDelete 
}: EvenementCardProps) {
  const categories = [
    { value: "General", label: "Général" },
    { value: "Formation", label: "Formation" },
    { value: "Social", label: "Social" },
    { value: "Sportif", label: "Sportif" },
    { value: "Culturel", label: "Culturel" },
  ];

  const statuts = [
    { value: "Brouillon", label: "Brouillon", color: "bg-gray-100 text-gray-800" },
    { value: "Publie", label: "Publié", color: "bg-green-100 text-green-800" },
    { value: "Archive", label: "Archivé", color: "bg-blue-100 text-blue-800" },
  ];

  const getCategorieBadge = (categorie: string) => {
    const categorieInfo = categories.find(c => c.value === categorie);
    const colors = {
      General: "bg-gray-100 text-gray-800",
      Formation: "bg-blue-100 text-blue-800",
      Social: "bg-green-100 text-green-800",
      Sportif: "bg-orange-100 text-orange-800",
      Culturel: "bg-purple-100 text-purple-800",
    };
    
    return (
      <Badge className={colors[categorie as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {categorieInfo?.label || categorie}
      </Badge>
    );
  };

  const getStatutBadge = (statut: string) => {
    const statutInfo = statuts.find(s => s.value === statut);
    return (
      <Badge className={statutInfo?.color || "bg-gray-100 text-gray-800"}>
        {statutInfo?.label || statut}
      </Badge>
    );
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isInscriptionOuverte = (evenement: EvenementData) => {
    if (!evenement.inscriptionRequis) return false;
    if (evenement.dateLimiteInscription && evenement.dateLimiteInscription < new Date()) return false;
    if (evenement.placesDisponibles && evenement.placesReservees >= evenement.placesDisponibles) return false;
    return true;
  };

  return (
    <Card className="hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="relative">
        {evenement.imagePrincipale && (
          <div className="relative h-48 bg-gray-200 dark:bg-gray-700 rounded-t-lg overflow-hidden">
            <Image
              src={evenement.imagePrincipale}
              alt={evenement.titre}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 33vw"
              unoptimized={evenement.imagePrincipale.startsWith('/')}
              onError={(e) => {
                console.error('Erreur de chargement d\'image:', evenement.imagePrincipale);
              }}
            />
          </div>
        )}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {getCategorieBadge(evenement.categorie)}
          {showAdminActions && getStatutBadge(evenement.statut)}
        </div>
      </div>

      <CardHeader>
        <CardTitle className="text-xl line-clamp-2">{evenement.titre}</CardTitle>
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(evenement.dateDebut)}</span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300 line-clamp-3">
            {evenement.description}
          </p>

          <div className="space-y-2 text-sm">
            {evenement.lieu && (
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span>{evenement.lieu}</span>
              </div>
            )}

            {evenement.prix && evenement.prix > 0 && (
              <div className="flex items-center space-x-2">
                <Euro className="h-4 w-4 text-gray-400" />
                <span className="font-semibold">{evenement.prix.toFixed(2).replace('.', ',')} €</span>
              </div>
            )}

            {evenement.inscriptionRequis && (
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-400" />
                <span>
                  {evenement.placesReservees}/{evenement.placesDisponibles || '∞'} places réservées
                </span>
              </div>
            )}

            {evenement.tags && evenement.tags.length > 0 && (
              <div className="flex items-center space-x-2">
                <Tag className="h-4 w-4 text-gray-400" />
                <div className="flex flex-wrap gap-1">
                  {evenement.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4">
            {showAdminActions ? (
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit?.(evenement)}
                >
                  Modifier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete?.(evenement.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  Supprimer
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  if (evenement.inscriptionRequis && isInscriptionOuverte(evenement)) {
                    onInscription?.(evenement);
                  } else {
                    onVoirDetails?.(evenement);
                  }
                }}
                className="flex-1 mr-2"
              >
                {evenement.inscriptionRequis ? (
                  isInscriptionOuverte(evenement) ? (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      S'inscrire
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Inscription fermée
                    </>
                  )
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4 mr-2" />
                    Voir détails
                  </>
                )}
              </Button>
            )}

            {evenement.contactEmail && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`mailto:${evenement.contactEmail}`)}
              >
                <Mail className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface EvenementStatsProps {
  stats: {
    totalEvenements: number;
    evenementsPublies: number;
    evenementsBrouillons: number;
    evenementsArchives: number;
    totalInscriptions: number;
    evenementsAvecInscriptions: number;
    tauxPublication: number;
    moyenneInscriptions: number;
  };
}

export function EvenementStats({ stats }: EvenementStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Total Événements
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalEvenements}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Publiés
              </p>
              <p className="text-2xl font-bold text-green-600">
                {stats.evenementsPublies}
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Brouillons
              </p>
              <p className="text-2xl font-bold text-gray-600">
                {stats.evenementsBrouillons}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-gray-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Inscriptions
              </p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.totalInscriptions}
              </p>
            </div>
            <Users className="h-8 w-8 text-purple-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface EvenementFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategorie: string;
  onCategorieChange: (value: string) => void;
  selectedStatut?: string;
  onStatutChange?: (value: string) => void;
  showStatutFilter?: boolean;
}

export function EvenementFilters({ 
  searchTerm, 
  onSearchChange, 
  selectedCategorie, 
  onCategorieChange,
  selectedStatut,
  onStatutChange,
  showStatutFilter = false
}: EvenementFiltersProps) {
  const categories = [
    { value: "General", label: "Général" },
    { value: "Formation", label: "Formation" },
    { value: "Social", label: "Social" },
    { value: "Sportif", label: "Sportif" },
    { value: "Culturel", label: "Culturel" },
  ];

  const statuts = [
    { value: "Brouillon", label: "Brouillon" },
    { value: "Publie", label: "Publié" },
    { value: "Archive", label: "Archivé" },
  ];

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rechercher un événement
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                id="search"
                type="text"
                placeholder="Rechercher par titre ou description..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-28 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label htmlFor="categorieFilter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Catégorie
            </label>
            <select
              id="categorieFilter"
              value={selectedCategorie}
              onChange={(e) => onCategorieChange(e.target.value)}
              className="w-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="Tous">Toutes les catégories</option>
              {categories.map((categorie) => (
                <option key={categorie.value} value={categorie.value}>
                  {categorie.label}
                </option>
              ))}
            </select>
          </div>
          {showStatutFilter && onStatutChange && (
            <div>
              <label htmlFor="statutFilter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Statut
              </label>
              <select
                id="statutFilter"
                value={selectedStatut}
                onChange={(e) => onStatutChange(e.target.value)}
                className="w-40 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="Tous">Tous</option>
                {statuts.map((statut) => (
                  <option key={statut.value} value={statut.value}>
                    {statut.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
