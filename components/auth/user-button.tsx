"use client"
import { useEffect } from "react";
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
import { useUserProfile } from "@/hooks/use-user-profile";
import { LogoutButton } from '@/components/auth/logout-button';
import Link from "next/link";
import { Button } from "../ui/button";
import { LoginButton } from "./login-button";
import { ChangePasswordDialog } from "@/components/user/ChangePasswordDialog";
import { Lock } from "lucide-react";


export const UserButton = () => {
    const { data: session, status, update } = useSession();
    const { forceUpdate } = useSessionUpdate();
    const { userProfile } = useUserProfile();
    const user = session?.user;
    
    // Récupérer l'image de l'utilisateur (priorité à userProfile, puis session)
    const userImage = userProfile?.image || user?.image;
    
    // Déterminer les initiales pour l'avatar
    const firstInitial = user?.name?.charAt(0).toUpperCase() ?? 'U';

    // Debug logs (seulement en développement)
    if (process.env.NODE_ENV === 'development') {
        console.log("UserButton - Status:", status);
        console.log("UserButton - Session:", session);
        console.log("UserButton - User:", user);
        console.log("UserButton - UserProfile:", userProfile);
        console.log("UserButton - UserImage:", userImage);
    }
    
    // Forcer la mise à jour de la session si on est sur une page après connexion
    // et que la session n'est pas encore chargée
    useEffect(() => {
        if (status === "loading" && typeof window !== "undefined") {
            // Attendre un peu puis forcer la mise à jour si nécessaire
            const timer = setTimeout(async () => {
                if (status === "loading") {
                    await update();
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [status, update]);

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
            <div className='flex items-center cursor-pointer'>
                <Avatar className="w-10 h-10 border-2 border-slate-600 dark:border-slate-400 shadow-md">
                    <AvatarImage 
                        src={userImage || undefined} 
                        alt={user?.name || "Utilisateur"}
                        className="object-cover"
                    />
                    <AvatarFallback className="bg-slate-600 dark:bg-slate-400 text-white font-semibold shadow-sm">
                        {firstInitial}
                    </AvatarFallback>  
                </Avatar>
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

              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="p-0">
                <ChangePasswordDialog
                  trigger={
                    <button type="button" className='w-full flex items-center hover:bg-orange-300 py-2 px-2 text-left'>
                      <Lock className="h-4 w-4 mr-2" />
                      Changer le mot de passe
                    </button>
                  }
                />
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

              <DropdownMenuItem className="hover:bg-orange-300" onSelect={(e) => e.preventDefault()}>
                <LoginButton mode="modal">
                  <button type="button" className="w-full text-left">
                    Connexion
                  </button>
                </LoginButton>    
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>  
    )

}
