"use client"

import { logOut } from "@/actions/auth/logout";
// import { signOut } from "next-auth/react";


interface LogoutButtonProps {
    children?: React.ReactNode;
};

export const LogoutButton = ({ children }: LogoutButtonProps ) => {
    const onClick = () => {
        // signOut();
        logOut();
    };

    return (
        <span onClick={onClick} className="cursor-pointer">
            {children}
        </span>
    )
}