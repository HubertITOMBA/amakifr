"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link"

interface BackButtonProps {
    href: string;
    label: string;
}

export const BackButton = ({href, label}: BackButtonProps) => {

    return (
        <Button
            variant="link"
            className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 font-normal"
            size="sm"
            asChild
        >
            <Link href={href}>
                {label}
            </Link>
        </Button>    
    )
}