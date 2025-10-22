"use client"

import * as React from "react"
import { Moon, MoonIcon, SunMoon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { useEffect, useState } from "react"

export function ThemeToggle({
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) {
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme } = useTheme();

    useEffect(() => {
      setMounted(true);
    }, []);
  
    if (!mounted) {
      return null;
    }
  

  return (
    <div className={className} {...props}>
         <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='focus-visible:ring-0 focus-visible:ring-offset-0'
        >
          {theme === 'system' ? (
            <SunMoon />
          ) : theme === 'dark' ? (
            <MoonIcon />
          ) : (
            <SunIcon />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Apparence</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={theme === 'system'}
          onClick={() => setTheme('system')}
        >
          Système
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={theme === 'dark'}
          onClick={() => setTheme('dark')}
        >
          Sombre
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={theme === 'light'}
          onClick={() => setTheme('light')}
        >
          Clair
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
           </DropdownMenu>
   </div> 
  )
}
