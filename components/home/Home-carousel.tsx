"use client";

import React, { useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Button } from "@/components/ui/button";
import { ArrowBigLeft, ArrowBigRight, ArrowRight } from "lucide-react";

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
            <div className="embla__viewport mx-auto mt-12 h-96 max-w-sm border rounded-lg shadow-2xl" ref={emblaRef}>
                <div className="embla__container h-full">
                    <div className="embla__slide flex items-center justify-center bg-blue-700 text-3xl font-bold text-white">Amaki France</div>
                    <div className="embla__slide flex items-center justify-center bg-amber-500 text-3xl font-bold text-white ">Amicale des anciens </div>
                    <div className="embla__slide flex items-center justify-center bg-blue-700  text-3xl font-bold text-white">de Kipako en France</div>
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
            <div className="flex mx-auto mt-5 gap-10"> 
                <Button  variant="outline" className="embla__prev" onClick={scrollPrev}><ArrowBigLeft className="size-7"/></Button>
                <Button  variant="outline" className="embla__next" onClick={scrollNext}><ArrowBigRight  className="size-7"/></Button>
            </div>
        </div> 
   </main>
  )
}


//  La prochaine réunion est prévue chez le Président BEBE Mastor Cotisation diverse
// 21 Place Picard 77124 VILLENOY  sdfssd