"use client";

import Image from "next/image";

interface HeaderProps {
    labelBox: string;
    label: string;
}

export const Header = ({ labelBox, label }: HeaderProps) => {
    return (
        <div className="w-full flex flex-col gap-y-4 items-center justify-center">
            {/* Logo */}
            <div className="flex items-center justify-center mb-4">
                <Image 
                    src="/amakifav.jpeg" 
                    alt="Logo AMAKI France" 
                    width={70} 
                    height={70}
                    className="object-contain"
                    priority
                />
            </div>
            
            {/* Titre principal */}
            <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-gray-100">
                {labelBox}
            </h1>
            
            {/* Sous-titre */}
            <p className="text-gray-600 dark:text-gray-400 text-sm text-center px-4 font-normal">
                {label}
            </p>
        </div>
    );
}