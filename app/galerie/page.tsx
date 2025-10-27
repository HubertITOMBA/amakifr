"use client";

import { Navbar } from "@/components/home/Navbar";
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
  Download
} from "lucide-react";
import { useState } from "react";
import Image from "next/image";

// Données d'exemple pour la galerie
const galleryData = {
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
        src: "/images/logoAmaki.jpeg",
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
        src: "/images/logoAmaki.jpeg",
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
        src: "/images/logoAmaki.jpeg",
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
        location: "Kipako, Congo",
        src: "/images/logoAmaki.jpeg",
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
        src: "/images/logoAmaki.jpeg",
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
        src: "/images/logoAmaki.jpeg",
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

  const categories = Object.keys(galleryData);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-8">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-6 shadow-2xl">
              <Camera className="h-16 w-16 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white drop-shadow-lg">
            Galerie Photos & Vidéos
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-purple-100">
            Découvrez nos moments forts à travers les souvenirs de nos événements
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Camera className="h-5 w-5 mr-2" />
              Photos & Vidéos
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-lg px-6 py-3">
              <Users className="h-5 w-5 mr-2" />
              Moments partagés
            </Badge>
          </div>
        </div>
      </section>

      {/* Filtres par catégorie */}
      <section className="py-8 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
              className="px-6 py-3"
            >
              Tous les événements
            </Button>
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className="px-6 py-3"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Contenu de la galerie */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {selectedCategory ? (
            // Affichage d'une catégorie spécifique
            <div className="space-y-8">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  {selectedCategory}
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                  {galleryData[selectedCategory as keyof typeof galleryData].description}
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {galleryData[selectedCategory as keyof typeof galleryData].items.map((item) => (
                  <Card 
                    key={item.id} 
                    className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="relative h-64 overflow-hidden">
                      <Image
                        src={item.src}
                        alt={item.alt}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                      <div className="absolute top-4 right-4">
                        {item.type === "video" ? (
                          <Badge className="bg-red-500 text-white">
                            <Video className="h-3 w-3 mr-1" />
                            Vidéo
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500 text-white">
                            <Camera className="h-3 w-3 mr-1" />
                            Photo
                          </Badge>
                        )}
                      </div>
                      {item.type === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-white/90 rounded-full p-4 group-hover:bg-white transition-colors">
                            <Play className="h-8 w-8 text-gray-800" />
                          </div>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-6">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {item.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {item.date}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {item.location}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            // Affichage de toutes les catégories
            <div className="space-y-16">
              {categories.map((category) => {
                const categoryData = galleryData[category as keyof typeof galleryData];
                const colorClass = colorClasses[categoryData.color as keyof typeof colorClasses];
                
                return (
                  <div key={category} className="space-y-8">
                    <div className="text-center">
                      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                        {category}
                      </h2>
                      <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                        {categoryData.description}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categoryData.items.slice(0, 3).map((item) => (
                        <Card 
                          key={item.id} 
                          className={`overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group bg-gradient-to-br ${colorClass.bg} border ${colorClass.border}`}
                          onClick={() => setSelectedItem(item)}
                        >
                          <div className="relative h-48 overflow-hidden">
                            <Image
                              src={item.src}
                              alt={item.alt}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                            <div className="absolute top-3 right-3">
                              {item.type === "video" ? (
                                <Badge className="bg-red-500 text-white">
                                  <Video className="h-3 w-3 mr-1" />
                                  Vidéo
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-500 text-white">
                                  <Camera className="h-3 w-3 mr-1" />
                                  Photo
                                </Badge>
                              )}
                            </div>
                            {item.type === "video" && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-white/90 rounded-full p-3 group-hover:bg-white transition-colors">
                                  <Play className="h-6 w-6 text-gray-800" />
                                </div>
                              </div>
                            )}
                          </div>
                          <CardContent className="p-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                              {item.title}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {item.date}
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {item.location}
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
                        className="px-8 py-3"
                      >
                        Voir tous les {category.toLowerCase()}
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="relative h-96">
              <Image
                src={selectedItem.src}
                alt={selectedItem.alt}
                fill
                className="object-cover"
              />
              <button
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full p-2 transition-colors"
              >
                <X className="h-6 w-6 text-gray-800" />
              </button>
              {selectedItem.type === "video" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white/90 rounded-full p-6">
                    <Play className="h-12 w-12 text-gray-800" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-8">
              <div className="flex items-center gap-4 mb-4">
                {selectedItem.type === "video" ? (
                  <Badge className="bg-red-500 text-white">
                    <Video className="h-4 w-4 mr-1" />
                    Vidéo
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500 text-white">
                    <Camera className="h-4 w-4 mr-1" />
                    Photo
                  </Badge>
                )}
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {selectedItem.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {selectedItem.description}
              </p>
              <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 mb-6">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {selectedItem.date}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {selectedItem.location}
                </div>
              </div>
              <div className="flex gap-4">
                <Button className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Voir en plein écran
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
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

