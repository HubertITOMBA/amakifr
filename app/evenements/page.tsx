"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/home/Navbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar, 
  MapPin, 
  Users, 
  Euro, 
  Clock,
  Tag,
  Mail,
  Phone,
  Search,
  Filter,
  ChevronRight,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  X
} from "lucide-react";
import { toast } from "sonner";
import { getPublicEvenements, inscrireEvenement, inscrireVisiteurEvenement, type EvenementData } from "@/actions/evenements";
import { useSession } from "next-auth/react";
import { EventsCarousel } from "@/components/evenements/EventsCarousel";

interface InscriptionFormData {
  nombrePersonnes: number;
  commentaires: string;
}

interface InscriptionVisiteurFormData {
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  nombrePersonnes: number;
  commentaires: string;
}

export default function PublicEvenementsPage() {
  const [evenements, setEvenements] = useState<EvenementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategorie, setSelectedCategorie] = useState("Tous");
  const [selectedEvenement, setSelectedEvenement] = useState<EvenementData | null>(null);
  const [showInscriptionModal, setShowInscriptionModal] = useState(false);
  const [inscriptionLoading, setInscriptionLoading] = useState(false);
  const [inscriptionData, setInscriptionData] = useState<InscriptionFormData>({
    nombrePersonnes: 1,
    commentaires: "",
  });
  const [inscriptionVisiteurData, setInscriptionVisiteurData] = useState<InscriptionVisiteurFormData>({
    nom: "",
    email: "",
    telephone: "",
    adresse: "",
    nombrePersonnes: 1,
    commentaires: "",
  });

  const { data: session } = useSession();

  const categories = [
    { value: "General", label: "Général" },
    { value: "Formation", label: "Formation" },
    { value: "Social", label: "Social" },
    { value: "Sportif", label: "Sportif" },
    { value: "Culturel", label: "Culturel" },
  ];

  useEffect(() => {
    loadEvenements();
  }, []);

  const loadEvenements = async () => {
    try {
      setLoading(true);
      const result = await getPublicEvenements();
      if (result.success && result.data) {
        setEvenements(result.data as EvenementData[]);
      } else {
        toast.error(result.error || "Erreur lors du chargement des événements");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des événements:", error);
      toast.error("Erreur lors du chargement des événements");
    } finally {
      setLoading(false);
    }
  };

  const handleInscription = async () => {
    if (!selectedEvenement) return;

    // Si l'utilisateur est connecté, utiliser la fonction d'inscription normale
    if (session) {
      if (inscriptionData.nombrePersonnes < 1) {
        toast.error("Le nombre de personnes doit être au moins 1");
        return;
      }

      // Vérifier les places disponibles
      if (selectedEvenement.placesDisponibles) {
        const placesRestantes = selectedEvenement.placesDisponibles - (selectedEvenement.placesReservees || 0);
        if (inscriptionData.nombrePersonnes > placesRestantes) {
          toast.error(`Il ne reste que ${placesRestantes} place(s) disponible(s)`);
          return;
        }
      }

      try {
        setInscriptionLoading(true);
        const result = await inscrireEvenement({
          evenementId: selectedEvenement.id,
          nombrePersonnes: inscriptionData.nombrePersonnes,
          commentaires: inscriptionData.commentaires,
        });

        if (result.success) {
          toast.success("Inscription réussie !");
          setShowInscriptionModal(false);
          setSelectedEvenement(null);
          setInscriptionData({ nombrePersonnes: 1, commentaires: "" });
          loadEvenements(); // Recharger pour mettre à jour les places disponibles
        } else {
          toast.error(result.error || "Erreur lors de l'inscription");
        }
      } catch (error) {
        console.error("Erreur lors de l'inscription:", error);
        toast.error("Erreur lors de l'inscription");
      } finally {
        setInscriptionLoading(false);
      }
    } else {
      // Si l'utilisateur n'est pas connecté, utiliser la fonction d'inscription visiteur
      if (!inscriptionVisiteurData.nom.trim()) {
        toast.error("Le nom est requis");
        return;
      }
      if (!inscriptionVisiteurData.email.trim()) {
        toast.error("L'email est requis");
        return;
      }
      if (!inscriptionVisiteurData.telephone.trim()) {
        toast.error("Le téléphone est requis");
        return;
      }
      if (!inscriptionVisiteurData.adresse.trim()) {
        toast.error("L'adresse est requise");
        return;
      }
      if (inscriptionVisiteurData.nombrePersonnes < 1) {
        toast.error("Le nombre de personnes doit être au moins 1");
        return;
      }

      // Vérifier les places disponibles
      if (selectedEvenement.placesDisponibles) {
        const placesRestantes = selectedEvenement.placesDisponibles - (selectedEvenement.placesReservees || 0);
        if (inscriptionVisiteurData.nombrePersonnes > placesRestantes) {
          toast.error(`Il ne reste que ${placesRestantes} place(s) disponible(s)`);
          return;
        }
      }

      try {
        setInscriptionLoading(true);
        const result = await inscrireVisiteurEvenement({
          evenementId: selectedEvenement.id,
          nom: inscriptionVisiteurData.nom,
          email: inscriptionVisiteurData.email,
          telephone: inscriptionVisiteurData.telephone,
          adresse: inscriptionVisiteurData.adresse,
          nombrePersonnes: inscriptionVisiteurData.nombrePersonnes,
          commentaires: inscriptionVisiteurData.commentaires,
        });

        if (result.success) {
          toast.success(result.message || "Votre inscription a été enregistrée avec succès !");
          setShowInscriptionModal(false);
          setSelectedEvenement(null);
          setInscriptionVisiteurData({
            nom: "",
            email: "",
            telephone: "",
            adresse: "",
            nombrePersonnes: 1,
            commentaires: "",
          });
          loadEvenements(); // Recharger pour mettre à jour les places disponibles
        } else {
          toast.error(result.error || "Erreur lors de l'inscription");
        }
      } catch (error) {
        console.error("Erreur lors de l'inscription:", error);
        toast.error("Erreur lors de l'inscription");
      } finally {
        setInscriptionLoading(false);
      }
    }
  };

  const getFilteredEvenements = () => {
    return evenements.filter(evenement => {
      const matchesSearch = evenement.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           evenement.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategorie = selectedCategorie === "Tous" || evenement.categorie === selectedCategorie;
      
      return matchesSearch && matchesCategorie;
    });
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      
      {/* Hero Section avec Carousel */}
      <section className="relative py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
              Événements AMAKI
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Découvrez nos prochains événements et activités
            </p>
          </div>
          
          {/* Carousel des événements */}
          {evenements.length > 0 ? (
            <EventsCarousel 
              events={evenements.slice(0, 10).map(ev => ({
                id: ev.id,
                titre: ev.titre,
                description: ev.description,
                imagePrincipale: ev.imagePrincipale,
                dateDebut: new Date(ev.dateDebut),
                lieu: ev.lieu,
                categorie: ev.categorie,
                placesDisponibles: ev.placesDisponibles,
                placesReservees: ev.placesReservees || 0,
              }))}
              autoPlayInterval={6000}
            />
          ) : (
            <div className="relative w-full h-[600px] overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center">
              <div className="text-center text-white z-10">
                <Calendar className="h-24 w-24 mx-auto mb-6 opacity-50" />
                <h2 className="text-3xl font-bold mb-4">Aucun événement disponible</h2>
                <p className="text-xl opacity-90">Revenez bientôt pour découvrir nos prochains événements</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Barre de recherche et filtres */}
      <section className="py-8 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Barre de recherche */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un événement..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filtres par catégorie */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategorie === "Tous" ? "default" : "outline"}
                onClick={() => setSelectedCategorie("Tous")}
                className="px-4 py-2"
              >
                Tous les événements
              </Button>
              {categories.map((categorie) => (
                <Button
                  key={categorie.value}
                  variant={selectedCategorie === categorie.value ? "default" : "outline"}
                  onClick={() => setSelectedCategorie(categorie.value)}
                  className="px-4 py-2"
                >
                  {categorie.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contenu des événements */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Liste des événements */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="overflow-hidden animate-pulse">
                  <div className="h-48 bg-gray-200 dark:bg-gray-700" />
                  <CardContent className="p-6">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {getFilteredEvenements().map((evenement) => (
              <Card key={evenement.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group bg-white dark:bg-slate-800 border-0 shadow-lg">
                <div className="relative">
                  {evenement.imagePrincipale && (
                    <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 overflow-hidden">
                      <Image
                        src={evenement.imagePrincipale}
                        alt={evenement.titre}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        unoptimized={evenement.imagePrincipale.startsWith('/')}
                        onError={(e) => {
                          console.error('Erreur de chargement d\'image:', evenement.imagePrincipale);
                        }}
                      />
                    </div>
                  )}
                  <div className="absolute top-4 right-4">
                    {getCategorieBadge(evenement.categorie)}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium">{formatDate(evenement.dateDebut)}</span>
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                      {evenement.titre}
                    </h3>

                    <p className="text-gray-600 dark:text-gray-300 line-clamp-3">
                      {evenement.description}
                    </p>

                    <div className="space-y-3">
                      {evenement.lieu && (
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <MapPin className="h-4 w-4" />
                          <span>{evenement.lieu}</span>
                        </div>
                      )}

                      {evenement.prix && evenement.prix > 0 && (
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <Euro className="h-4 w-4" />
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {evenement.prix.toFixed(2).replace('.', ',')} €
                          </span>
                        </div>
                      )}

                      {evenement.inscriptionRequis && (
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <Users className="h-4 w-4" />
                          <span>
                            {evenement.placesReservees}/{evenement.placesDisponibles || '∞'} places réservées
                          </span>
                        </div>
                      )}

                      {evenement.tags && evenement.tags.length > 0 && (
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <Tag className="h-4 w-4" />
                          <div className="flex flex-wrap gap-1">
                            {evenement.tags.slice(0, 3).map((tag, index) => (
                              <Badge key={index} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        {evenement.inscriptionRequis && isInscriptionOuverte(evenement) ? (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedEvenement(evenement);
                                setShowInscriptionModal(true);
                              }}
                              className="flex-1 mr-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              S'inscrire
                            </Button>
                            <Link href={`/evenements/${evenement.id}`} className="flex-1 mr-2">
                              <Button
                                variant="outline"
                                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                              >
                                <ChevronRight className="h-4 w-4 mr-2" />
                                Voir détails
                              </Button>
                            </Link>
                          </>
                        ) : (
                          <Link href={`/evenements/${evenement.id}`} className="flex-1 mr-2">
                            <Button
                              variant="outline"
                              className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                            >
                              <ChevronRight className="h-4 w-4 mr-2" />
                              Voir détails
                            </Button>
                          </Link>
                        )}

                        {evenement.contactEmail && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`mailto:${evenement.contactEmail}`)}
                            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              ))}
            </div>
          )}

          {!loading && getFilteredEvenements().length === 0 && (
            <div className="text-center py-16">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 shadow-lg max-w-md mx-auto">
                <div className="bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <Calendar className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Aucun événement trouvé
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {searchTerm || selectedCategorie !== "Tous"
                    ? "Aucun événement ne correspond à vos critères de recherche."
                    : "Aucun événement n'est actuellement programmé."}
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategorie("Tous");
                  }}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                >
                  Réinitialiser les filtres
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modal d'inscription */}
      {showInscriptionModal && selectedEvenement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-8 flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Inscription à l'événement
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(selectedEvenement.dateDebut)}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowInscriptionModal(false);
                    setSelectedEvenement(null);
                    setInscriptionData({ nombrePersonnes: 1, commentaires: "" });
                    setInscriptionVisiteurData({
                      nom: "",
                      email: "",
                      telephone: "",
                      adresse: "",
                      nombrePersonnes: 1,
                      commentaires: "",
                    });
                  }}
                  className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                >
                  <X className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {selectedEvenement.titre}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {selectedEvenement.description}
                  </p>
                </div>

                {!session && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Vous n'êtes pas connecté. Veuillez remplir vos informations ci-dessous. Vous recevrez une confirmation par email une fois votre inscription validée.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {!session && (
                    <>
                      <div>
                        <Label htmlFor="nom" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Nom complet *
                        </Label>
                        <Input
                          id="nom"
                          type="text"
                          value={inscriptionVisiteurData.nom}
                          onChange={(e) => setInscriptionVisiteurData({ ...inscriptionVisiteurData, nom: e.target.value })}
                          placeholder="Votre nom complet"
                          className="mt-1 bg-white dark:bg-slate-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Email *
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={inscriptionVisiteurData.email}
                          onChange={(e) => setInscriptionVisiteurData({ ...inscriptionVisiteurData, email: e.target.value })}
                          placeholder="votre@email.com"
                          className="mt-1 bg-white dark:bg-slate-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="telephone" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Téléphone *
                        </Label>
                        <Input
                          id="telephone"
                          type="tel"
                          value={inscriptionVisiteurData.telephone}
                          onChange={(e) => setInscriptionVisiteurData({ ...inscriptionVisiteurData, telephone: e.target.value })}
                          placeholder="01 23 45 67 89"
                          className="mt-1 bg-white dark:bg-slate-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="adresse" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Adresse *
                        </Label>
                        <textarea
                          id="adresse"
                          className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                          value={inscriptionVisiteurData.adresse}
                          onChange={(e) => setInscriptionVisiteurData({ ...inscriptionVisiteurData, adresse: e.target.value })}
                          placeholder="Rue, Code postal, Ville, Pays"
                          required
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label htmlFor="nombrePersonnes" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nombre de personnes *
                    </Label>
                    <Input
                      id="nombrePersonnes"
                      type="number"
                      min="1"
                      max={selectedEvenement.placesDisponibles ? selectedEvenement.placesDisponibles - selectedEvenement.placesReservees : undefined}
                      value={session ? inscriptionData.nombrePersonnes : inscriptionVisiteurData.nombrePersonnes}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1;
                        if (session) {
                          setInscriptionData({ ...inscriptionData, nombrePersonnes: value });
                        } else {
                          setInscriptionVisiteurData({ ...inscriptionVisiteurData, nombrePersonnes: value });
                        }
                      }}
                      className="mt-1 bg-white dark:bg-slate-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                    />
                    {selectedEvenement.placesDisponibles && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Places disponibles : {selectedEvenement.placesDisponibles - selectedEvenement.placesReservees}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="commentaires" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Commentaires (optionnel)
                    </Label>
                    <textarea
                      id="commentaires"
                      className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      value={session ? inscriptionData.commentaires : inscriptionVisiteurData.commentaires}
                      onChange={(e) => {
                        if (session) {
                          setInscriptionData({ ...inscriptionData, commentaires: e.target.value });
                        } else {
                          setInscriptionVisiteurData({ ...inscriptionVisiteurData, commentaires: e.target.value });
                        }
                      }}
                      placeholder="Ajoutez des commentaires ou des informations supplémentaires..."
                    />
                  </div>

                  {selectedEvenement.prix && selectedEvenement.prix > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2">
                        <Euro className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                          Prix total : {(selectedEvenement.prix * (session ? inscriptionData.nombrePersonnes : inscriptionVisiteurData.nombrePersonnes)).toFixed(2).replace('.', ',')} €
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-4 px-8 pb-8 flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => {
                  setShowInscriptionModal(false);
                  setSelectedEvenement(null);
                  setInscriptionData({ nombrePersonnes: 1, commentaires: "" });
                  setInscriptionVisiteurData({
                    nom: "",
                    email: "",
                    telephone: "",
                    adresse: "",
                    nombrePersonnes: 1,
                    commentaires: "",
                  });
                }}
                className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
              >
                Annuler
              </Button>
              <Button
                onClick={handleInscription}
                disabled={inscriptionLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {inscriptionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Inscription...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Confirmer l'inscription
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}