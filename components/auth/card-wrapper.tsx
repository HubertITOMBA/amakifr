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
    backButtonHref?: string;
    backButtonComponent?: React.ReactNode;
    showSocial?: boolean;
};


export const CardWrapper = ({ 
    children,
    headerLabel,
    labelBox,
    backButtonLabel,
    backButtonHref,
    backButtonComponent,
    showSocial
    }: CardWrapperProps ) => {

return (
    <Card className="w-full max-w-[400px] shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-2 border-gray-200 dark:border-gray-700 rounded-xl animate-in fade-in-0 zoom-in-95 duration-300">
        <CardHeader className="pb-3">
            <Header  label={headerLabel} labelBox={labelBox}/>
        </CardHeader>
        <CardContent className="space-y-3 [&_label]:text-gray-900 [&_label]:dark:text-gray-100 [&_label]:font-semibold [&_label]:text-sm [&_input]:bg-white dark:[&_input]:bg-gray-800 [&_input]:backdrop-blur-sm [&_input]:border-2 [&_input]:border-gray-300 dark:[&_input]:border-gray-600 [&_input]:text-gray-900 [&_input]:dark:text-gray-100 [&_input]:placeholder:text-gray-500 dark:[&_input]:placeholder:text-gray-400 [&_input]:focus:border-blue-500 dark:[&_input]:focus:border-blue-400 [&_p]:text-gray-800 dark:[&_p]:text-gray-200">
            { children}
        </CardContent>
            {showSocial && (
                <CardFooter className="pt-2 border-t-2 border-gray-200 dark:border-gray-700">
                    <Social />
                </CardFooter>
            )}
            <CardFooter className="pt-2 border-t-2 border-gray-200 dark:border-gray-700">
                {backButtonComponent ? (
                    backButtonComponent
                ) : backButtonHref ? (
                    <BackButton 
                        label={backButtonLabel}
                        href={backButtonHref}
                    />
                ) : null}
            </CardFooter>
    </Card>
)
}