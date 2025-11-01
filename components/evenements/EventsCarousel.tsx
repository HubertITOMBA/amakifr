"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

interface EventSlide {
  id: string;
  titre: string;
  description: string;
  imagePrincipale: string | null;
  dateDebut: Date;
  lieu: string | null;
  categorie: string;
  placesDisponibles: number | null;
  placesReservees: number;
}

interface EventsCarouselProps {
  events: EventSlide[];
  autoPlayInterval?: number; // en millisecondes, défaut 5000ms (5 secondes)
}

// Images d'atelier de cuisine africaine disponibles
const ATELIER_IMAGES = [
  "/ressources/atelier/Atelier_Afri1.png",
  "/ressources/atelier/Atelier_Afri2.jpeg",
  "/ressources/atelier/Atelier_Afri3.jpeg",
  "/ressources/atelier/Atelier_Afri4.jpeg",
];

export function EventsCarousel({ events, autoPlayInterval = 5000 }: EventsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Calculer l'index normalisé pour le défilement infini
  const normalizedIndex = events.length > 0 
    ? ((currentIndex % events.length) + events.length) % events.length
    : 0;
  const currentEvent = events[normalizedIndex];

  // Défilement automatique
  useEffect(() => {
    if (events.length === 0 || isTransitioning) return;

    if (isAutoPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => prev + 1);
      }, autoPlayInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoPlaying, autoPlayInterval, events.length, isTransitioning]);

  // Navigation manuelle
  const goToSlide = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setIsAutoPlaying(false); // Pause automatique lors d'une navigation manuelle
    setTimeout(() => {
      setIsTransitioning(false);
      setIsAutoPlaying(true);
    }, 700); // Durée de la transition
  }, [isTransitioning]);

  const goToPrevious = useCallback(() => {
    goToSlide(currentIndex - 1);
  }, [currentIndex, goToSlide]);

  const goToNext = useCallback(() => {
    goToSlide(currentIndex + 1);
  }, [currentIndex, goToSlide]);

  // Gestion du swipe tactile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        // Swipe vers la gauche = slide suivant
        goToNext();
      } else {
        // Swipe vers la droite = slide précédent
        goToPrevious();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (events.length === 0 || !currentEvent) {
    return null;
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div 
      className="relative w-full h-[600px] overflow-hidden rounded-2xl shadow-2xl group"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Image de fond avec overlay */}
      <div className="absolute inset-0">
        {(currentEvent.imagePrincipale || ATELIER_IMAGES.length > 0) ? (
          <Image
            src={currentEvent.imagePrincipale || ATELIER_IMAGES[normalizedIndex % ATELIER_IMAGES.length]}
            alt={currentEvent.titre}
            fill
            className={`object-cover transition-opacity duration-700 ease-in-out ${
              isTransitioning ? 'opacity-0' : 'opacity-100'
            }`}
            priority
            unoptimized={(currentEvent.imagePrincipale || ATELIER_IMAGES[normalizedIndex % ATELIER_IMAGES.length])?.startsWith('/')}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : null}
        {/* Fallback gradient si pas d'image et pas d'images d'atelier */}
        {!currentEvent.imagePrincipale && ATELIER_IMAGES.length === 0 && (
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600" />
        )}
        {/* Overlay gradient pour améliorer la lisibilité du texte */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
      </div>

      {/* Contenu du slide */}
      <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-12 text-white">
        <div className="max-w-4xl">
          {/* Badge catégorie */}
          <div className="mb-4">
            <span className="inline-block px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-sm font-semibold border border-white/30">
              {currentEvent.categorie}
            </span>
          </div>

          {/* Titre */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 drop-shadow-2xl">
            {currentEvent.titre}
          </h2>

          {/* Description */}
          <p className="text-lg md:text-xl mb-8 text-gray-100 line-clamp-3 drop-shadow-lg">
            {currentEvent.description}
          </p>

          {/* Informations */}
          <div className="flex flex-wrap gap-6 mb-8">
            {currentEvent.dateDebut && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">{formatDate(currentEvent.dateDebut)}</span>
              </div>
            )}
            {currentEvent.lieu && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20">
                <MapPin className="h-5 w-5" />
                <span className="font-medium">{currentEvent.lieu}</span>
              </div>
            )}
            {currentEvent.placesDisponibles !== null && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-lg border border-white/20">
                <Users className="h-5 w-5" />
                <span className="font-medium">
                  {currentEvent.placesReservees}/{currentEvent.placesDisponibles} places
                </span>
              </div>
            )}
          </div>

          {/* Bouton d'action */}
          <Link href={`/evenements/${currentEvent.id}`}>
            <Button
              size="lg"
              className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-8 py-6 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 text-lg"
            >
              En savoir plus
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Boutons de navigation */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 rounded-full w-12 h-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        onClick={goToPrevious}
      >
        <ChevronLeft className="h-6 w-6" />
        <span className="sr-only">Slide précédent</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 rounded-full w-12 h-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        onClick={goToNext}
      >
        <ChevronRight className="h-6 w-6" />
        <span className="sr-only">Slide suivant</span>
      </Button>

      {/* Indicateurs de slides (dots) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {events.map((_, index) => {
          const slideIndex = ((index - currentIndex) % events.length + events.length) % events.length;
          const isActive = normalizedIndex === index;
          
          return (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`transition-all duration-300 rounded-full ${
                isActive
                  ? 'w-12 h-2 bg-white shadow-lg'
                  : 'w-2 h-2 bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Aller au slide ${index + 1}`}
            />
          );
        })}
      </div>

      {/* Barre de progression pour le slide actuel */}
      {isAutoPlaying && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 z-20">
          <div
            className="h-full bg-white animate-[progress_6s_linear]"
            style={{
              animationDuration: `${autoPlayInterval}ms`,
            }}
            key={currentIndex}
          />
        </div>
      )}

      <style>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}

