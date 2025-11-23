import * as z from 'zod'


export const LoginSchema = z.object({
    email: z.string().email({
        message: "Un email valide est requis"
    }),
    password: z.string().min(1, {
        message: "Un mot de passe est requis"
    }),
    // code: z.optional(z.string()),
})
 
export const RegisterSchema = z.object({
    email: z.string().email({
        message: "L'adresse e-mail est requise"
    }),
    password: z.string().min(6, {
        message: "Un minimum de 6 caractères requis"
    }),
    name: z.string().min(3, {
        message: "Le nom est obligatoire" 
    }),
}) 

export const ResetSchema = z.object({
    email: z.string().email({
        message: "L'adresse email est obligatoire"
    }),
});


export const TwoFactorSchema = z.object({
    code: z.string().length(6, {
        message: "Le code doit contenir un minimum de 6 caractères"
    })
});

export const NewPasswordSchema = z.object({
    password: z.string().min(6, {
        message: "Un minimum de 6 caractères requis"
    }),
});

export const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1, {
        message: "Le mot de passe actuel est requis"
    }),
    newPassword: z.string().min(6, {
        message: "Le nouveau mot de passe doit contenir au moins 6 caractères"
    }),
    confirmPassword: z.string().min(1, {
        message: "La confirmation du mot de passe est requise"
    }),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
});


export const profilSchema = z.object({
    name: z.string(),
    email: z.string(), 
    image: z.string(),
    role : z.string(),
    lastLogin: z.date(),
    createdAt: z.date(),
    updatedAt: z.date(),
}) 

export const AdherentSchema = z.object({
    // adherentId : z.string(),
    userId: z.string(),
    email: z.string(),
    lastname: z.string(),
    firstname: z.string(),
    // civility: z.string(), 
    // maritalStatus: z.string(),    
    sex: z.string(),
    amount: z.string(),
    // bornedAt: z.date() ,   
    // status: z.string(),
    phone: z.string(),
}) 

export const FamilleAdherentSchema = z.object({
    lastname: z.string(),
    firstname: z.string(),
    civility: z.string(), 
    sex: z.string(),
    bornedAt: z.date(),   
    status: z.string(),
}) 


  

export const AdresseAdherentSchema = z.object({
    streetnum: z.string(),
    street1: z.string(),
    street2: z.string(),
    codepost: z.string(),
    city: z.string(),   
    country: z.string(),
    phone: z.string(),
}) 

export const CotisationSchema = z.object({
    description: z.string(),
    amount: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
}) 


export const ContactSchema = z.object({
    name: z.string().min(3,{message: "Votre nom est requis"}),
    email: z.string().email({message: "L'adresse e-mail est requise"}),
    phone: z.string(), goal: z.string().min(3,{message: "Vous devez choisir un sujet",}),
    message: z.string().min(3, {message: "Votre message est obligatoire" }),
}) 