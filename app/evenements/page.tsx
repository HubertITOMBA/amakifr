"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { toast } from "react-hot-toast";
import { getPublicEvenements, inscrireEvenement, type EvenementData } from "@/actions/evenements";
import { useSession } from "next-auth/react";

interface InscriptionFormData {
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

    if (!session) {
      toast.error("Vous devez être connecté pour vous inscrire");
      return;
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-8">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 shadow-2xl">
              <Calendar className="h-16 w-16 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white drop-shadow-lg">
            Événements AMAKI
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-purple-100">
            Découvrez nos prochains événements et activités. Rejoignez-nous pour des moments de partage et de découverte.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Calendar className="h-5 w-5 mr-2" />
              Événements
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Users className="h-5 w-5 mr-2" />
              Communauté
            </Badge>
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {getFilteredEvenements().map((evenement) => (
              <Card key={evenement.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group bg-white dark:bg-slate-800 border-0 shadow-lg">
                <div className="relative">
                  {evenement.imagePrincipale && (
                    <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 overflow-hidden">
                      <img
                        src={evenement.imagePrincipale}
                        alt={evenement.titre}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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

          {getFilteredEvenements().length === 0 && (
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
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
                  }}
                  className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-2 transition-colors"
                >
                  <X className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    {selectedEvenement.titre}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {selectedEvenement.description}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="nombrePersonnes" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nombre de personnes
                    </Label>
                    <Input
                      id="nombrePersonnes"
                      type="number"
                      min="1"
                      max={selectedEvenement.placesDisponibles ? selectedEvenement.placesDisponibles - selectedEvenement.placesReservees : undefined}
                      value={inscriptionData.nombrePersonnes}
                      onChange={(e) => setInscriptionData({ ...inscriptionData, nombrePersonnes: parseInt(e.target.value) || 1 })}
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
                      value={inscriptionData.commentaires}
                      onChange={(e) => setInscriptionData({ ...inscriptionData, commentaires: e.target.value })}
                      placeholder="Ajoutez des commentaires ou des informations supplémentaires..."
                    />
                  </div>

                  {selectedEvenement.prix && selectedEvenement.prix > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2">
                        <Euro className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                          Prix total : {(selectedEvenement.prix * inscriptionData.nombrePersonnes).toFixed(2).replace('.', ',')} €
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowInscriptionModal(false);
                      setSelectedEvenement(null);
                      setInscriptionData({ nombrePersonnes: 1, commentaires: "" });
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
          </div>
        </div>
      )}
      
      <Footer />
    </div>
  );
}