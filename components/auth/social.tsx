"use client"

import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook } from "react-icons/fa";
import { SiApple } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOGIN_REDIRECT } from "@/routes"

export const Social = () => {
    const onClick = (provider: "google" | "facebook" | "apple") => {
        signIn(provider, {
              callbackUrl: DEFAULT_LOGIN_REDIRECT, // Toujours rediriger vers la page d'accueil
        });
    }

    return (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-2 w-full max-w-full">
            <Button
                size="sm"
                className="flex-1 sm:flex-[1_1_0] min-w-0 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                variant="outline"
                onClick={() => onClick("google")}
            >
                <FcGoogle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mr-1.5 sm:mr-2" />
                <span className="truncate text-xs sm:text-sm">Google</span>
            </Button>
            <Button
                size="sm"
                className="flex-1 sm:flex-[1_1_0] min-w-0 border-gray-300 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 transition-colors"
                variant="outline"
                onClick={() => onClick("facebook")}
            >
                <FaFacebook className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mr-1.5 sm:mr-2 text-blue-600 dark:text-blue-400" />
                <span className="truncate text-xs sm:text-sm">Facebook</span>
            </Button>
            <Button
                size="sm"
                className="flex-1 sm:flex-[1_1_0] min-w-0 border-gray-300 dark:border-gray-700 hover:bg-gray-900 dark:hover:bg-gray-100 text-gray-700 dark:text-gray-300 hover:text-white dark:hover:text-gray-900 transition-colors"
                variant="outline"
                onClick={() => onClick("apple")}
            >
                <SiApple className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mr-1.5 sm:mr-2" />
                <span className="truncate text-xs sm:text-sm">Apple</span>
            </Button>
        </div>
    )
}