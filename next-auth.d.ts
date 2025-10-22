import { UserRole } from "@prisma/client"
import { DefaultSession } from "next-auth"

export type ExtendUser = DefaultSession["user"] & {
    role: UserRole;
    status: STATUS;
    isOAuth: boolean;
}

export type ExtendAdherent = DefaultSession["user"] & {
    civility: Civilities;
    statuAdherent: MembreStatus;
    statuMarital:  MaritalStatus;
}   



declare module "next-auth" {
    interface Session {
        user: ExtendUser
    }
}