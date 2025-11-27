"use client"

import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Header } from "@/components/auth/header";
import { Social } from "@/components/auth/social";
import { BackButton } from "@/components/auth/back-button";


interface CardWrapperProps {
    children: React.ReactNode;
    headerLabel: string;
    labelBox: string;
    backButtonLabel: string;
    backButtonHref: string;
    showSocial?: boolean;
};


export const CardWrapper = ({ 
    children,
    headerLabel,
    labelBox,
    backButtonLabel,
    backButtonHref,
    showSocial
    }: CardWrapperProps ) => {

return (
    <Card className="w-full max-w-[400px] shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-xl animate-in fade-in-0 zoom-in-95 duration-300">
        <CardHeader className="pb-6">
            <Header  label={headerLabel} labelBox={labelBox}/>
        </CardHeader>
        <CardContent className="space-y-4 [&_label]:text-gray-900 [&_label]:dark:text-gray-100 [&_label]:font-semibold [&_label]:text-sm [&_input]:bg-white [&_input]:dark:bg-gray-800 [&_input]:border-gray-300 [&_input]:dark:border-gray-700 [&_input]:text-gray-900 [&_input]:dark:text-gray-100 [&_input]:placeholder:text-gray-400 [&_input]:dark:placeholder:text-gray-500 [&_input]:focus:border-gray-400 [&_input]:dark:focus:border-gray-600 [&_p]:text-gray-700 [&_p]:dark:text-gray-300">
            { children}
        </CardContent>
            {showSocial && (
                <CardFooter className="pt-4 border-t border-gray-200 dark:border-gray-800">
                    <Social />
                </CardFooter>
            )}
            <CardFooter className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <BackButton 
                    label={backButtonLabel}
                    href={backButtonHref}
                />
            </CardFooter>
    </Card>
)
}