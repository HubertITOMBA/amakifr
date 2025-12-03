"use client";

import Image from "next/image";

interface HeaderProps {
    labelBox: string;
    label: string;
}

export const Header = ({ labelBox, label }: HeaderProps) => {
    return (
        <div className="w-full flex flex-col gap-y-2 items-center justify-center">
            {/* Logo */}
            <div className="flex items-center justify-center mb-2">
                <Image 
                    src="/amakifav.jpeg" 
                    alt="Logo AMAKI France" 
                    width={50} 
                    height={50}
                    className="object-contain"
                    priority
                />
            </div>
            
            {/* Titre principal */}
            <h1 className="text-xl sm:text-2xl font-bold text-center text-gray-900 dark:text-gray-50">
                {labelBox}
            </h1>
            
            {/* Sous-titre */}
            <p className="text-gray-700 dark:text-gray-300 text-xs text-center px-4 font-normal">
                {label}
            </p>
        </div>
    );
}