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
import { useCurrentUser } from "@/hooks/use-current-user";
import { LogoutButton } from '@/components/auth/logout-button';
import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/button";
import { LoginButton } from "./login-button";


export const UserButton = () => {

    // const user = useCurrentUser();
    // const firstInitial = user?.name?.charAt(0).toUpperCase() ?? 'U';

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
             
        <DropdownMenuContent className='w-56 ' align='end' forceMount>
           <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col space-y-1'>
              <div className='text-sm font-medium leading-none'>
                {/* {user?.name} */}
              </div>
              <div className='text-sm text-muted-foreground leading-none'>
                {/* {user?.email} */}
              </div>
            </div>
           </DropdownMenuLabel>

          <DropdownMenuItem>
            <Link href='/user/profile' className='w-full hover:bg-orange-300'>
               Mon Profil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="hover:bg-orange-300">Compte Unix :</DropdownMenuItem>
          <DropdownMenuItem>Dernière connexion :</DropdownMenuItem>
          <DropdownMenuItem>
                <Link href='/user/orders' className='w-full hover:bg-orange-300 '>
                Order History
                </Link>
          </DropdownMenuItem>

          {/* {user?.role === 'PORTAL_ADMIN' && (
                <DropdownMenuItem>
                <Link href='/admin' className='w-full'>
                    Administration
                </Link>
                </DropdownMenuItem>
            )} */}

            <DropdownMenuItem className="hover:bg-orange-300">
               <LogoutButton>
                 Deconnexion
                 </LogoutButton>    
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-orange-300">
               <LoginButton>
                 Connexion
                 </LoginButton>    
            </DropdownMenuItem>
        
        </DropdownMenuContent>
      </DropdownMenu>
    </div>  
    )

}
