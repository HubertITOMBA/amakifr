"use client"
import { FaUser } from "react-icons/fa"
import { ExitIcon } from "@radix-ui/react-icons";
import { 
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { 
    Avatar,
    AvatarImage,
    AvatarFallback
 } from "@/components/ui/avatar";
import { useSession } from "next-auth/react";
import { useSessionUpdate } from "@/hooks/use-session-update";
import { LogoutButton } from '@/components/auth/logout-button';
import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/button";
import { LoginButton } from "./login-button";


export const UserButton = () => {
    const { data: session, status } = useSession();
    const { forceUpdate } = useSessionUpdate();
    const user = session?.user;
    const firstInitial = user?.name?.charAt(0).toUpperCase() ?? 'U';

    // Debug logs (seulement en développement)
    if (process.env.NODE_ENV === 'development') {
        console.log("UserButton - Status:", status);
        console.log("UserButton - Session:", session);
        console.log("UserButton - User:", user);
    }

    // Gestion des états de chargement
    if (status === "loading") {
        return (
            <div className="flex gap-2 items-center">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            </div>
        );
    }

    return (
       <div className="flex gap-2 items-center">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <div className='flex items-center'>
                
                {/* <Avatar>
                    <AvatarImage src={user?.image || ""} />
                    <AvatarFallback className="bg-harpOrange">
                        <FaUser className="text-white" />
                    </AvatarFallback>  
                    {firstInitial}  
                </Avatar>  */}
              {/* <Button
                variant='ghost'
                className='relativee w-8 h-8 rounded-full ml-2 flex items-center justify-center bg-harpOrange text-white'
                >
                  
                 {firstInitial}
                </Button> */}
                <Image src="/ressources/avatar.png" alt="" width={40} height={40} className="rounded-full"/>  
            </div>
            
            </DropdownMenuTrigger>
             
        <DropdownMenuContent className='w-56 ' align='end'>
          {status === "authenticated" && user ? (
            // Menu pour utilisateur connecté
            <>
              <DropdownMenuLabel className='font-normal'>
                <div className='flex flex-col space-y-1'>
                  <div className='text-sm font-medium leading-none'>
                    {user?.name || "Utilisateur"}
                  </div>
                  <div className='text-sm text-muted-foreground leading-none'>
                    {user?.email}
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuItem>
                <Link href='/user/profile' className='w-full hover:bg-orange-300'>
                  Mon Profil
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem>
                <Link href='/user/documents' className='w-full hover:bg-orange-300'>
                  Mes Documents
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem className="hover:bg-orange-300">
                <LogoutButton>
                  Déconnexion
                </LogoutButton>    
              </DropdownMenuItem>
            </>
          ) : (
            // Menu pour utilisateur non connecté
            <>
              <DropdownMenuLabel className='font-normal'>
                <div className='flex flex-col space-y-1'>
                  <div className='text-sm font-medium leading-none'>
                    Non connecté
                  </div>
                  <div className='text-sm text-muted-foreground leading-none'>
                    Connectez-vous pour accéder à votre profil
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuItem className="hover:bg-orange-300">
                <LoginButton>
                  Connexion
                </LoginButton>    
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>  
    )

}
