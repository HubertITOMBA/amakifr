"use client"
import { useEffect, useState } from "react";
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
import { LoginButton } from "./login-button";
import { ChangePasswordDialog } from "@/components/user/ChangePasswordDialog";
import { Download, FileText, Lock, LogIn, LogOut, Receipt, Shield, User } from "lucide-react";
import { usePwaInstallPrompt } from "@/components/pwa/usePwaInstallPrompt";
import { isNotesFraisEnabledClientHint } from "@/lib/frais-avances/feature-flag-client";


/**
 * Bouton avatar : menu utilisateur + Dialogs (connexion / mot de passe)
 * rendues en sœurs du DropdownMenu pour éviter le conflit de focus Radix.
 */
export const UserButton = () => {
    const { data: session, status, update } = useSession();
    const { forceUpdate } = useSessionUpdate();
    const { userProfile } = useUserProfile();
    const user = session?.user;
    const { canInstall, isInstalled, isIOS, install } = usePwaInstallPrompt();

    const [menuOpen, setMenuOpen] = useState(false);
    const [loginOpen, setLoginOpen] = useState(false);
    const [pendingLoginOpen, setPendingLoginOpen] = useState(false);
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);
    const [pendingChangePasswordOpen, setPendingChangePasswordOpen] = useState(false);

    const normalizedRole = user?.role?.toString().trim().toUpperCase();
    const canSeeAdministration =
        normalizedRole === "ADMIN" ||
        normalizedRole === "PRESID" ||
        normalizedRole === "VICEPR" ||
        normalizedRole === "SECRET";
    /** Hint UI uniquement — l'authz réelle est serveur. */
    const canSeeMesFraisAvances = isNotesFraisEnabledClientHint();

    const userImage = userProfile?.image || user?.image;
    const firstInitial = user?.name?.charAt(0).toUpperCase() ?? 'U';

    if (process.env.NODE_ENV === 'development') {
        console.log("UserButton - Status:", status);
        console.log("UserButton - Session:", session);
        console.log("UserButton - User:", user);
        console.log("UserButton - UserProfile:", userProfile);
        console.log("UserButton - UserImage:", userImage);
    }

    /**
     * Ferme le menu, puis ouvre la Dialog demandée seulement après
     * onOpenChange(false) du Dropdown — jamais les deux actifs ensemble.
     */
    const handleMenuOpenChange = (open: boolean) => {
        setMenuOpen(open);
        if (!open) {
            if (pendingLoginOpen) {
                setPendingLoginOpen(false);
                setLoginOpen(true);
            }
            if (pendingChangePasswordOpen) {
                setPendingChangePasswordOpen(false);
                setChangePasswordOpen(true);
            }
        }
    };
    
    useEffect(() => {
        if (status === "loading" && typeof window !== "undefined") {
            const timer = setTimeout(async () => {
                if (status === "loading") {
                    await update();
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [status, update]);

    if (status === "loading") {
        return (
            <div className="flex gap-2 items-center">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
            </div>
        );
    }

    const isAuthenticated = status === "authenticated" && user;

    return (
       <div className="flex gap-2 items-center">
        <DropdownMenu open={menuOpen} onOpenChange={handleMenuOpenChange}>
            <DropdownMenuTrigger asChild>
            <div className='flex items-center cursor-pointer' aria-label="Menu utilisateur">
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
          {isAuthenticated ? (
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
                <Link href='/user/profile' className='w-full flex items-center hover:bg-orange-300'>
                  <User className="h-4 w-4 mr-2" />
                  Mon espace adhérent
                </Link>
              </DropdownMenuItem>

              {canSeeAdministration && (
                <DropdownMenuItem>
                  <Link href='/admin' className='w-full flex items-center hover:bg-orange-300'>
                    <Shield className="h-4 w-4 mr-2" />
                    Administration
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem>
                <Link href='/user/documents' className='w-full flex items-center hover:bg-orange-300'>
                  <FileText className="h-4 w-4 mr-2" />
                  Mes Documents
                </Link>
              </DropdownMenuItem>

              {canSeeMesFraisAvances && (
                <DropdownMenuItem>
                  <Link href='/user/frais-avances' className='w-full flex items-center hover:bg-orange-300'>
                    <Receipt className="h-4 w-4 mr-2" />
                    Mes frais avancés
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                className="hover:bg-orange-300"
                onSelect={() => {
                  setPendingChangePasswordOpen(true);
                }}
              >
                <span className="flex items-center w-full">
                  <Lock className="h-4 w-4 mr-2" />
                  Changer le mot de passe
                </span>
              </DropdownMenuItem>

              {!isInstalled && (
                <DropdownMenuItem
                  onSelect={async () => {
                    await install();
                  }}
                  className="hover:bg-orange-300"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Installer l'application
                </DropdownMenuItem>
              )}

              <DropdownMenuItem className="hover:bg-orange-300">
                <LogoutButton>
                  <span className="flex items-center">
                    <LogOut className="h-4 w-4 mr-2" />
                    Déconnexion
                  </span>
                </LogoutButton>    
              </DropdownMenuItem>
            </>
          ) : (
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

              <DropdownMenuItem
                className="hover:bg-orange-300"
                onSelect={() => {
                  setPendingLoginOpen(true);
                }}
              >
                <span className="flex items-center w-full">
                  <LogIn className="h-4 w-4 mr-2" />
                  Connexion
                </span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs en sœurs du menu : jamais imbriquées dans DropdownMenuContent */}
      {!isAuthenticated ? (
        <LoginButton
          mode="modal"
          open={loginOpen}
          onOpenChange={setLoginOpen}
        />
      ) : (
        <ChangePasswordDialog
          open={changePasswordOpen}
          onOpenChange={setChangePasswordOpen}
        />
      )}
    </div>  
    )

}
