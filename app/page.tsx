import { Hero } from "@/components/home/Hero";
import Emblacarousel from "@/components/home/Home-carousel";
import { Navbar } from "@/components/home/Navbar";
import ShadCarousel from "@/components/home/shad-carousel";
import Image from "next/image";

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto sm:px--6 lg:px-8">
   {/* </main> <main className="mx-auto m-5 font-title text-xl"> */}
      <Navbar/>
      <Emblacarousel />
     {/* <ShadCarousel /> */}
       <Hero />
   
    {/* <div className="py-10 md:grid flex flex-col grid-cols-2 mb-2 3xl:flex"> 
     <div>
          
      </div>
      <div  className="mt-5 ">
          MAP ETAIT LA
      </div>
    </div>

    <div className="space-y-6 text-center">
          <h1 className={cn(
            "text-6xl font-semibold text-white drop-shadow-md", 
            font.className,
            )}
          >
               🔐   Connexion
          </h1>
      
          <p className="text-white text-lgexit">Amicale des anciens élèves de Kipako depuis (home)</p>
          <div>
           
          </div>
      </div>       */}
  </main>
  );
}
