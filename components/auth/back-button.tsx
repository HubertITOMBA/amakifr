"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link"
import { ArrowRight } from "lucide-react";

interface BackButtonProps {
    href: string;
    label: string;
}

export const BackButton = ({href, label}: BackButtonProps) => {
    // Si le label contient "inscription" ou "inscrire", rendre le bouton plus visible
    const isInscriptionLink = label.toLowerCase().includes("inscription") || label.toLowerCase().includes("inscrire");
    
    // Vérifier si le texte est long et doit être sur plusieurs lignes
    const isLongText = label.length > 40;
    
    // Diviser le texte en deux lignes si c'est un texte long
    const splitLabel = (): { line1: string; line2: string } => {
        if (!isLongText) {
            return { line1: label, line2: '' };
        }
        
        // Chercher un point de coupure naturel (après "?" ou "compte ?")
        const questionMarkIndex = label.indexOf('?');
        if (questionMarkIndex > 0 && questionMarkIndex < label.length - 10) {
            return {
                line1: label.substring(0, questionMarkIndex + 1),
                line2: label.substring(questionMarkIndex + 1).trim()
            };
        }
        
        // Sinon, diviser au milieu
        const midPoint = Math.floor(label.length / 2);
        const spaceIndex = label.lastIndexOf(' ', midPoint);
        if (spaceIndex > 0) {
            return {
                line1: label.substring(0, spaceIndex),
                line2: label.substring(spaceIndex + 1)
            };
        }
        
        return { line1: label, line2: '' };
    };
    
    const { line1, line2 } = splitLabel();

    return (
        <Button
            variant={isInscriptionLink ? "default" : "link"}
            className={isInscriptionLink 
                ? "w-full bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm py-12" 
                : `w-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-normal ${isLongText ? 'py-12' : 'py-2'}`
            }
            size={isInscriptionLink ? "default" : "sm"}
            asChild
        >
            <Link href={href} className={`flex items-center justify-center gap-2 ${isLongText ? 'flex-col text-center leading-tight pt-1 pb-1 gap-2' : ''}`}>
                {isLongText ? (
                    <>
                        <span className="block pt-4">{line1}</span>
                        <span className="flex items-center justify-center gap-1 pb-1">
                            {line2}
                            {isInscriptionLink && <ArrowRight className="h-4 w-4" />}
                        </span>
                    </>
                ) : (
                    <>
                        <span>{label}</span>
                        {isInscriptionLink && <ArrowRight className="h-4 w-4" />}
                    </>
                )}
            </Link>
        </Button>    
    )
}