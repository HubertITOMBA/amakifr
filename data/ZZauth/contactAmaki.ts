"use server"

import { ContactSchema } from "@/schemas"
import * as z from 'zod'
import { sendContactEmail } from "@/lib/mail"

export const ContactAmaki = async ( values: z.infer<typeof ContactSchema>) => {
  
   const name = values.name;
   const email = values.email;
   const phone = values.phone;
   const goal = values.goal;
   const message = values.message;
 
  await  sendContactEmail(
        name,
        email,
        phone,
        goal,
        message
    )

    return { 
        success: "Votre message est enregistré. La cellule FMK Paris vous contactera sous peu."
     }
} 