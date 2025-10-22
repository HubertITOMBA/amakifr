import Image from "next/image";
import Link from "next/link";
import Logo from "@/public/logo0.png";
import HeroImage from "@/public/hero.png";
import { buttonVariants } from "@/components/ui/button";
import { UserButton } from "../auth/user-button";
import { ThemeToggle } from "../ThemeToggle";


const navigation = [
  { name: 'Accueil', href: '/' },
  { name: "L'amicale", href: '/amicale' },
  { name: 'Evénements', href: '/evenements' },
  { name: 'Agenda', href: '/agenda' },
  { name: 'Contact', href: '/contact' },
]



export function Navbar() {
  return (

    // <nav className="container flex items-center justify-between py-4 lg:px-8 px-2 mx-auto ">
    
    <div className="flex items-center justify-between py-0 backdrop-blur-lg sticky top-0 z-[999]">
       <Link href="/" className="flex items-center gap-2">
         <Image src={Logo} alt="Logo" className="size-10" />
         <h3 className="text-3xl font-semibold">
           ama<span className="text-red-500 font-semibold">K</span>i
         </h3>
       </Link>
      {/* <Link href="/" className="flex items-center gap-2">
        <Image src={HeroImage} alt="Logo" className="size-10" />
        <h3 className="text-3xl font-semibold">
          Hubert<span className="text-blue-500">Factures</span>
        </h3>
      </Link> */}
     

          <div className="hidden lg:flex lg:gap-x-12">
            {navigation.map((item) => (
              <Link key={item.name} href={item.href} className="font-title text-xl font-semibold leading-6">
                {item.name}
              </Link>
            ))}
          </div>
        <ThemeToggle />  
        <UserButton />
    </div>
  );
}
