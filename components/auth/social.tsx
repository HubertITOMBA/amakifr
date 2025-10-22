"use client"

import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOGIN_REDIRECT } from "@/routes"

export const Social = () => {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl");

    const onClick = (provider: "google" | "github" | "facebook") => {
        signIn(provider, {
              callbackUrl: callbackUrl || DEFAULT_LOGIN_REDIRECT,
        });
    }

    return (
        // <div className="flex items-center justify-between w-auto gap-x-2">
        <div className="items-center justify-between w-auto">
            <Button
                size="sm"
                className="w-full"
                variant="outline"
                onClick={() => onClick("google")}
             >
                 <FcGoogle className="h-5 w-auto"/> Google
            </Button>
            {/* Connexion par GItHub
            <Button
                size="sm"
                className="w-full"
                variant="outline"
                onClick={() => onClick("github")}
            >
                 <FaGithub className="h-5 w-auto"/> Github
            </Button> */}
        </div>
    )
}