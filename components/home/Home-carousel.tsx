"use client";

import React, { useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Button } from "@/components/ui/button";
import { ArrowBigLeft, ArrowBigRight, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function Emblacarousel() {
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000})])

    const scrollPrev = useCallback(() => {
        if (emblaApi) emblaApi.scrollPrev()
      }, [emblaApi])
    
      const scrollNext = useCallback(() => {
        if (emblaApi) emblaApi.scrollNext()
      },[emblaApi]) 

  return (
    <main className="embla">
        <div className="flex flex-col items-center justify-center">
          {/* Decorative header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100/80 via-indigo-100/80 to-purple-100/80 dark:from-blue-900/40 dark:via-indigo-900/40 dark:to-purple-900/40 rounded-full backdrop-blur-sm border border-blue-200/50 dark:border-blue-800/30">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Actualités & Annonces</span>
            </div>
          </motion.div>
          
          {/* Carousel with decorative frame */}
          <div className="relative">
            {/* Decorative corner elements - opacité réduite */}
            <div className="absolute -top-3 -left-3 w-12 h-12 border-t-4 border-l-4 border-blue-400/40 dark:border-blue-600/25 rounded-tl-2xl opacity-60 animate-pulse" />
            <div className="absolute -top-3 -right-3 w-12 h-12 border-t-4 border-r-4 border-indigo-400/40 dark:border-indigo-600/25 rounded-tr-2xl opacity-60 animate-pulse delay-300" />
            <div className="absolute -bottom-3 -left-3 w-12 h-12 border-b-4 border-l-4 border-purple-400/40 dark:border-purple-600/25 rounded-bl-2xl opacity-60 animate-pulse delay-500" />
            <div className="absolute -bottom-3 -right-3 w-12 h-12 border-b-4 border-r-4 border-indigo-400/40 dark:border-indigo-600/25 rounded-br-2xl opacity-60 animate-pulse delay-700" />
            
            {/* Gradient border wrapper - plus subtil */}
            <div className="p-2 bg-gradient-to-br from-blue-400/60 via-indigo-500/60 to-purple-500/60 dark:from-blue-900/40 dark:via-indigo-900/40 dark:to-purple-900/40 rounded-3xl shadow-2xl">
              <div className="embla__viewport mx-auto h-96 max-w-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-inner" ref={emblaRef}>
                <div className="embla__container h-full">
                    <div className="embla__slide flex items-center justify-center bg-blue-700 text-3xl font-bold text-white">Amaki France</div>
                    <div className="embla__slide flex items-center justify-center bg-amber-500 text-3xl font-bold text-white ">Amicale des anciens </div>
                    <div className="embla__slide flex items-center justify-center bg-blue-700  text-3xl font-bold text-white">de Kipaku en France</div>
                     <div className="embla__slide flex items-center justify-center bg-cyan-500 text-3xl font-bold text-white "> Site en construction</div>
                     <div className="embla__slide flex items-center justify-center bg-red-500 text-3xl font-bold text-white ">Prochaine réunion</div>
                     <div className="embla__slide flex items-center justify-center bg-red-500 text-3xl font-bold text-white ">Le 29 Septembre 2025</div>
                       <div className="embla__slide flex items-center justify-center bg-amber-500 text-3xl font-bold text-white ">à VILLENOY</div>
                        <div className="embla__slide flex items-center justify-center bg-green-500 text-3xl font-bold text-white ">chez BEBE Mastor</div>
                         <div className="embla__slide flex items-center justify-center bg-amber-500 text-2xl font-bold text-white ">Novembre : Amaki en fête</div>
                         <div className="embla__slide flex items-center justify-center bg-teal-500 text-2xl font-bold text-white ">à VILLIERS-LE-BEL</div>
                    <div className="embla__slide flex items-center justify-center bg-gradient-to-l from-blue-500 via-teal-500 to-green-500 text-3xl font-bold text-white">Site en construction</div>
                    
                </div>
              </div>
            </div>
            
            {/* Navigation buttons with enhanced style */}
            <div className="flex mx-auto mt-6 gap-6"> 
              <Button 
                variant="outline" 
                className="embla__prev bg-gradient-to-r from-blue-500/90 to-indigo-600/90 dark:from-blue-700 dark:to-indigo-700 text-white border-0 hover:from-blue-600 hover:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 shadow-lg hover:shadow-xl transition-all duration-300" 
                onClick={scrollPrev}
              >
                <ArrowBigLeft className="size-6"/>
              </Button>
              <Button 
                variant="outline" 
                className="embla__next bg-gradient-to-r from-indigo-500/90 to-purple-600/90 dark:from-indigo-700 dark:to-purple-700 text-white border-0 hover:from-indigo-600 hover:to-purple-700 dark:hover:from-indigo-600 dark:hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-300" 
                onClick={scrollNext}
              >
                <ArrowBigRight className="size-6"/>
              </Button>
            </div>
          </div>
        </div> 
   </main>
  )
}


//  La prochaine réunion est prévue chez le Président BEBE Mastor Cotisation diverse
// 21 Place Picard 77124 VILLENOY  sdfssd