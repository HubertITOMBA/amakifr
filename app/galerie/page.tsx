"use client";

import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Users, 
  Camera, 
  Video, 
  Heart, 
  Award, 
  MapPin, 
  Clock,
  Play,
  Eye,
  Download,
  Loader2,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";
import { getMediaGalerieByCategory } from "@/actions/galerie";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Descriptions par défaut pour les catégories
const categoryDescriptions: Record<string, string> = {
  "Événements Officiels": "Cérémonies, assemblées générales et moments importants de notre association",
  "Événements Sociaux": "Fêtes, anniversaires, rencontres conviviales et moments de partage",
  "Actions Caritatives": "Nos initiatives solidaires et actions d'entraide",
  "Formations et Conférences": "Sessions de formation, conférences et développement professionnel",
};

// Données d'exemple pour la galerie (fallback si pas de données)
const galleryDataFallback = {
  "Événements Officiels": {
    description: "Cérémonies, assemblées générales et moments importants de notre association",
    color: "blue",
    items: [
      {
        id: 1,
        type: "image",
        title: "Assemblée Générale 2023",
        date: "15 Mars 2023",
        location: "Paris, France",
        src: "/images/hero.png",
        alt: "Assemblée Générale AMAKI 2023",
        description: "Réunion annuelle des membres avec élection du nouveau bureau"
      },
      {
        id: 2,
        type: "video",
        title: "Cérémonie d'ouverture",
        date: "10 Janvier 2023",
        location: "Lyon, France",
        src: "/images/logoAmakiOld.jpeg",
        alt: "Cérémonie d'ouverture",
        description: "Discours d'ouverture du président de l'association"
      },
      {
        id: 3,
        type: "image",
        title: "Remise de diplômes",
        date: "20 Juin 2023",
        location: "Marseille, France",
        src: "/images/hero.png",
        alt: "Remise de diplômes",
        description: "Célébration des réussites académiques de nos membres"
      }
    ]
  },
  "Événements Sociaux": {
    description: "Fêtes, anniversaires, rencontres conviviales et moments de partage",
    color: "green",
    items: [
      {
        id: 4,
        type: "image",
        title: "Anniversaire de l'association",
        date: "5 Mai 2023",
        location: "Toulouse, France",
        src: "/images/logoAmakiOld.jpeg",
        alt: "Anniversaire AMAKI",
        description: "Célébration des 15 ans de l'association avec tous les membres"
      },
      {
        id: 5,
        type: "video",
        title: "Soirée dansante",
        date: "12 Août 2023",
        location: "Nice, France",
        src: "/images/hero.png",
        alt: "Soirée dansante",
        description: "Moment de détente et de convivialité entre membres"
      },
      {
        id: 6,
        type: "image",
        title: "Barbecue d'été",
        date: "15 Juillet 2023",
        location: "Bordeaux, France",
        src: "/images/logoAmakiOld.jpeg",
        alt: "Barbecue d'été",
        description: "Rencontre décontractée dans un parc de Bordeaux"
      }
    ]
  },
  "Actions Caritatives": {
    description: "Nos initiatives solidaires et actions d'entraide",
    color: "purple",
    items: [
      {
        id: 7,
        type: "image",
        title: "Collecte de vêtements",
        date: "3 Décembre 2023",
        location: "Strasbourg, France",
        src: "/images/hero.png",
        alt: "Collecte de vêtements",
        description: "Organisation d'une collecte pour les familles dans le besoin"
      },
      {
        id: 8,
        type: "video",
        title: "Mission humanitaire",
        date: "8 Novembre 2023",
        location: "Kipaku, Congo",
        src: "/images/logoAmakiOld.jpeg",
        alt: "Mission humanitaire",
        description: "Retour au pays pour des actions de solidarité"
      },
      {
        id: 9,
        type: "image",
        title: "Soutien scolaire",
        date: "25 Octobre 2023",
        location: "Lille, France",
        src: "/images/hero.png",
        alt: "Soutien scolaire",
        description: "Aide aux devoirs pour les enfants de la communauté"
      }
    ]
  },
  "Formations et Conférences": {
    description: "Sessions de formation, conférences et développement professionnel",
    color: "orange",
    items: [
      {
        id: 10,
        type: "video",
        title: "Conférence sur l'entrepreneuriat",
        date: "18 Septembre 2023",
        location: "Paris, France",
        src: "/images/logoAmakiOld.jpeg",
        alt: "Conférence entrepreneuriat",
        description: "Formation sur la création d'entreprise en France"
      },
      {
        id: 11,
        type: "image",
        title: "Atelier CV et entretiens",
        date: "22 Février 2023",
        location: "Lyon, France",
        src: "/images/hero.png",
        alt: "Atelier CV",
        description: "Formation aux techniques de recherche d'emploi"
      },
      {
        id: 12,
        type: "video",
        title: "Séminaire leadership",
        date: "30 Avril 2023",
        location: "Marseille, France",
        src: "/images/logoAmakiOld.jpeg",
        alt: "Séminaire leadership",
        description: "Développement des compétences managériales"
      }
    ]
  }
};

const colorClasses = {
  blue: {
    bg: "from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-200",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  },
  green: {
    bg: "from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-800 dark:text-green-200",
    badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  },
  purple: {
    bg: "from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20",
    border: "border-purple-200 dark:border-purple-800",
    text: "text-purple-800 dark:text-purple-200",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
  },
  orange: {
    bg: "from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-800 dark:text-orange-200",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
  }
};

export default function GaleriePage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [galleryData, setGalleryData] = useState<Record<string, { description: string; color: string; items: any[] }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGalleryData = async () => {
      try {
        setLoading(true);
        const result = await getMediaGalerieByCategory(true); // Seulement les médias actifs
        
        if (result.success && result.data) {
          // Transformer les données de la base en format attendu
          const transformed: Record<string, { description: string; color: string; items: any[] }> = {};
          
          Object.keys(result.data).forEach((categorie) => {
            const medias = result.data[categorie];
            if (medias && medias.length > 0) {
              const firstMedia = medias[0];
              transformed[categorie] = {
                description: categoryDescriptions[categorie] || "",
                color: firstMedia.couleur || "blue",
                items: medias.map((media: any) => ({
                  id: media.id,
                  type: media.type,
                  title: media.titre,
                  date: format(new Date(media.date), "dd MMMM yyyy", { locale: fr }),
                  location: media.lieu || "",
                  src: media.chemin,
                  alt: media.titre,
                  description: media.description || "",
                })),
              };
            }
          });
          
          setGalleryData(transformed);
        } else {
          // Utiliser les données de fallback si erreur
          setGalleryData(galleryDataFallback);
        }
      } catch (error) {
        console.error("Erreur lors du chargement de la galerie:", error);
        setGalleryData(galleryDataFallback);
      } finally {
        setLoading(false);
      }
    };

    loadGalleryData();
  }, []);

  const categories = Object.keys(galleryData);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      
      {/* Hero Section */}
      <section className="relative py-8 sm:py-12 md:py-16 lg:py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-4 sm:mb-6 md:mb-8">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-4 sm:p-5 md:p-6 shadow-2xl">
              <Camera className="h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16 text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-3 sm:mb-4 md:mb-6 text-white drop-shadow-lg">
            Galerie Photos & Vidéos
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl mb-4 sm:mb-6 md:mb-8 text-purple-100 px-4">
            Découvrez nos moments forts à travers les souvenirs de nos événements
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 justify-center px-4">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs sm:text-sm md:text-base lg:text-lg px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3">
              <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 mr-1.5 sm:mr-2" />
              Photos & Vidéos
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs sm:text-sm md:text-base lg:text-lg px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 mr-1.5 sm:mr-2" />
              Moments partagés
            </Badge>
          </div>
        </div>
      </section>

      {/* Filtres par catégorie */}
      <section className="py-4 sm:py-6 md:py-8 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
              className="px-3 sm:px-4 md:px-6 py-2 text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Tous les événements</span>
              <span className="sm:hidden">Tous</span>
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className="px-3 sm:px-4 md:px-6 py-2 text-xs sm:text-sm"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Contenu de la galerie */}
      <section className="py-8 sm:py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-600" />
                <p className="text-gray-600 dark:text-gray-400">Chargement de la galerie...</p>
              </div>
            </div>
          ) : selectedCategory ? (
            // Affichage d'une catégorie spécifique
            <div className="space-y-4 sm:space-y-6 md:space-y-8">
              <div className="text-center mb-6 sm:mb-8 md:mb-12">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
                  {selectedCategory}
                </h2>
                <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
                  {galleryData[selectedCategory as keyof typeof galleryData].description}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {galleryData[selectedCategory as keyof typeof galleryData].items.map((item) => {
                  const categoryData = galleryData[selectedCategory as keyof typeof galleryData];
                  const colorClass = colorClasses[categoryData.color as keyof typeof colorClasses];
                  
                  return (
                  <Card 
                    key={item.id} 
                    className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className={`relative h-48 sm:h-56 md:h-64 overflow-hidden bg-gradient-to-br ${colorClass.bg}`}>
                      {item.type === "video" ? (
                        <video
                          src={item.src}
                          className="w-full h-full object-contain"
                          preload="metadata"
                          muted
                          onError={(e) => {
                            console.error("Erreur de chargement vidéo:", item.src);
                          }}
                        />
                      ) : (
                        <Image
                          src={item.src}
                          alt={item.alt}
                          fill
                          className="object-contain group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 100vw, 33vw"
                          unoptimized={item.src?.startsWith('/')}
                          onError={(e) => {
                            console.error("Erreur de chargement image:", item.src);
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4">
                        {item.type === "video" ? (
                          <Badge className="bg-red-500 text-white text-xs">
                            <Video className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                            <span className="hidden sm:inline">Vidéo</span>
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500 text-white text-xs">
                            <Camera className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                            <span className="hidden sm:inline">Photo</span>
                          </Badge>
                        )}
                      </div>
                      {item.type === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-white/90 rounded-full p-3 sm:p-4 group-hover:bg-white transition-colors">
                            <Play className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-gray-800" />
                          </div>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4 sm:p-5 md:p-6">
                      <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {item.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-3 sm:mb-4">
                        {item.description}
                      </p>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">{item.date}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-16">
              <Camera className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Aucun média disponible
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                La galerie sera bientôt remplie de nos meilleurs moments.
              </p>
            </div>
          ) : (
            // Affichage de toutes les catégories
            <div className="space-y-8 sm:space-y-12 md:space-y-16">
              {categories.map((category) => {
                const categoryData = galleryData[category as keyof typeof galleryData];
                const colorClass = colorClasses[categoryData.color as keyof typeof colorClasses];
                
                return (
                  <div key={category} className="space-y-4 sm:space-y-6 md:space-y-8">
                    <div className="text-center">
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
                        {category}
                      </h2>
                      <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto px-4">
                        {categoryData.description}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
                      {categoryData.items.slice(0, 3).map((item) => (
                        <Card 
                          key={item.id} 
                          className={`overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group bg-gradient-to-br ${colorClass.bg} border ${colorClass.border}`}
                          onClick={() => setSelectedItem(item)}
                        >
                          <div className={`relative h-40 sm:h-44 md:h-48 overflow-hidden bg-gradient-to-br ${colorClass.bg}`}>
                            {item.type === "video" ? (
                              <video
                                src={item.src}
                                className="w-full h-full object-contain"
                                preload="metadata"
                                muted
                                onError={(e) => {
                                  console.error("Erreur de chargement vidéo:", item.src);
                                }}
                              />
                            ) : (
                              <Image
                                src={item.src}
                                alt={item.alt}
                                fill
                                className="object-contain group-hover:scale-105 transition-transform duration-300"
                                sizes="(max-width: 768px) 100vw, 33vw"
                                unoptimized={item.src?.startsWith('/')}
                                onError={(e) => {
                                  console.error("Erreur de chargement image:", item.src);
                                }}
                              />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                            <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                              {item.type === "video" ? (
                                <Badge className="bg-red-500 text-white text-xs">
                                  <Video className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                  <span className="hidden sm:inline">Vidéo</span>
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-500 text-white text-xs">
                                  <Camera className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                  <span className="hidden sm:inline">Photo</span>
                                </Badge>
                              )}
                            </div>
                            {item.type === "video" && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-white/90 rounded-full p-2.5 sm:p-3 group-hover:bg-white transition-colors">
                                  <Play className="h-5 w-5 sm:h-6 sm:w-6 text-gray-800" />
                                </div>
                              </div>
                            )}
                          </div>
                          <CardContent className="p-3 sm:p-4">
                            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-2">
                              {item.title}
                            </h3>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                <span className="truncate">{item.date}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 sm:h-3 sm:w-3 flex-shrink-0" />
                                <span className="truncate">{item.location}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    
                    <div className="text-center">
                      <Button 
                        variant="outline"
                        onClick={() => setSelectedCategory(category)}
                        className="px-4 sm:px-6 md:px-8 py-2 text-xs sm:text-sm"
                      >
                        <span className="hidden sm:inline">Voir tous les {category.toLowerCase()}</span>
                        <span className="sm:hidden">Voir tout</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Modal pour afficher les détails */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="relative h-48 sm:h-64 md:h-80 lg:h-96 flex-shrink-0 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
              {selectedItem.type === "video" ? (
                <video
                  src={selectedItem.src}
                  controls
                  className="w-full h-full object-contain"
                  autoPlay
                  onError={(e) => {
                    console.error("Erreur de chargement vidéo dans le modal:", selectedItem.src);
                  }}
                />
              ) : (
                <Image
                  src={selectedItem.src}
                  alt={selectedItem.alt}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 66vw"
                  unoptimized={selectedItem.src?.startsWith('/')}
                  onError={(e) => {
                    console.error("Erreur de chargement image dans le modal:", selectedItem.src);
                  }}
                />
              )}
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4 bg-white/90 hover:bg-white rounded-full p-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center z-10"
              >
                <X className="h-5 w-5 sm:h-6 sm:w-6 text-gray-800" />
              </button>
            </div>
            <div className="p-4 sm:p-6 md:p-8 flex-1 overflow-y-auto">
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                {selectedItem.type === "video" ? (
                  <Badge className="bg-red-500 text-white text-xs sm:text-sm">
                    <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                    Vidéo
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500 text-white text-xs sm:text-sm">
                    <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                    Photo
                  </Badge>
                )}
              </div>
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                {selectedItem.title}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-4 sm:mb-6">
                {selectedItem.description}
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{selectedItem.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{selectedItem.location}</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4">
                <Button className="flex items-center justify-center gap-2 w-full sm:w-auto text-xs sm:text-sm">
                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Voir en plein écran</span>
                  <span className="sm:hidden">Plein écran</span>
                </Button>
                <Button variant="outline" className="flex items-center justify-center gap-2 w-full sm:w-auto text-xs sm:text-sm">
                  <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Télécharger
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

