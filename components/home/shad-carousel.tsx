"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
    Carousel,
    CarouselApi,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
  } from "@/components/ui/carousel"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { projects } from "@/lib"
import Image from "next/image"
import { ArrowBigLeft, ArrowRight } from "lucide-react"


export default function ShadCarousel() {
   
    const [api, setApi] = useState<CarouselApi>()
    const [current, setCurrent] = useState(0)
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!api) {
          return;
        }

       // setCount(api.scrollSnapList().length)
        setCurrent(api.selectedScrollSnap());
     
        api.on("select", () => {
          setCurrent(api.selectedScrollSnap());
        });
      }, [api]
    );
    


  return (
    <main className="flex flex-col items-center justify-between p-24 h-screen">
        <div className="flex flex-col items-center justify-center gap-5">
            <Carousel  setApi={setApi} opts= {{ loop: true }}
                className="w-full max-w-sm"
            >
            <CarouselContent>
                {projects.map((project) => (
                    <CarouselItem key={project} className="flex w-full items-center justify-center">
                        <Image src={`/projects/${project}`} width={300} height={300} alt={project}/>
                    </CarouselItem>

                ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
            
            </Carousel>
            <div className="flex gap-3"> 
                <Button variant="outline" className="embla__prev" onClick={() => api?.scrollTo(current - 1)}><ArrowBigLeft className="size-7"/></Button>
                <Button variant="outline"  className="embla__next" onClick={() => api?.scrollTo(current + 1)}><ArrowRight  className="size-7"/></Button>
            </div>
        </div>
    </main>
)
   

}
