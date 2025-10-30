import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)
const domain = process.env.NEXT_PUBLIC_APP_URL

export const sendTwoFactorTokenEmail = async(
    email: string,
    token: string
) => {
    const { error } = await resend.emails.send({
        from: "webmaster.amaki@hitomba.com",
        to: email,
        subject: "Authentification à deux facteurs",
        html: `<!DOCTYPE html>
        <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Email Template</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
              <div style="text-align: center;">
                  <h1 style="margin-bottom: 20px;">Veuillez copier votre code OTP ci-dessous.</h1>
                  <div style="display: inline-block;">
                      <h1 style="text-decoration: none;">
                          <p style="background-color: #4a90e2; color: #ffffff; padding: 10px 20px; border-radius: 5px; border: none; transition: background-color 0.3s ease-in-out;">
                            ${token}
                          </p>
                      </h1>
                  </div>
              </div>
          </body>
        </html>`
      });
  
      if (error) {
        console.log("RESEND_ERROR",error)
      }
}


export const sendPasswordResetToken = async(
  email: string,
  token: string
) => {
  const resetLink = `${domain}/auth/new-password?token=${token}`

  await resend.emails.send({
    from: "webmaster.amaki@hitomba.com",
    to: email,
    subject: "Réinitialiser votre mot de passe",
    html: `<!DOCTYPE html>
    <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Template</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
          <div style="text-align: center;">
              <h1 style="margin-bottom: 20px;">Veuillez cliquer sur le bouton ci-dessous pour réinitialiser votre mot de passe.</h1>
              <div style="display: inline-block;">
                  <a href="${resetLink}" style="text-decoration: none;">
                      <button style="background-color: #4a90e2; color: #ffffff; padding: 10px 20px; border-radius: 5px; border: none; cursor: pointer; transition: background-color 0.3s ease-in-out;">
                      Réinitialiser votre mot de passe
                      </button>
                  </a>
              </div>
          </div>
      </body>
    </html>`
  });
}


export const sendContactEmail = async(
  name: string,
  email: string,
  phone: string,
  goal: string,
  message: string,
) => {
  
  const { error } = await resend.emails.send({
      from: 'webmaster.amaki@hitomba.com',
      to: "asso.amaki@gmail.com",
      // subject: "Demande d'informations",
      subject: `${goal}`,
      html: `<!DOCTYPE html>
      <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Template</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
            <div style="text-align: center;">
                
                <div style="display: inline-block;">
                    <h1 style="text-decoration: none;">
                        <p style="background-color: #4a90e2; color: #ffffff; padding: 10px 20px; border-radius: 5px; border: none; transition: background-color 0.3s ease-in-out;">
                         ${goal} 
                        </p>
                    </h1><br />
                    <p style="text-align: left;">De : ${name}</p>
                    <p style="text-align: left;">Email : ${email}</p>
                    <p style="text-align: left;">Téléphone: ${phone}</p><br /> 
                     <p style="text-align: left;">${message}</p>
                      <br />
                    <p>Vouz pouvez également m'écrire à ${email} me contacter au ${phone}</p>
                </div>
            </div>
        </body>
      </html>`
    });

    if (error) {
      console.log("RESEND_ERROR",error)
    }
}

/**
 * Envoyer un email à l'administrateur pour notifier d'une inscription de visiteur à un événement
 */
export const sendVisiteurInscriptionEmail = async(
  evenementTitre: string,
  visiteurNom: string,
  visiteurEmail: string,
  visiteurTelephone: string,
  nombrePersonnes: number,
  commentaires?: string
) => {
  const adminEmail = process.env.ADMIN_EMAIL || "asso.amaki@gmail.com";
  
  const { error } = await resend.emails.send({
    from: 'noreply@amaki.fr',
    to: adminEmail,
    subject: `Nouvelle inscription de visiteur : ${evenementTitre}`,
    html: `<!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouvelle inscription</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #4a90e2; margin-bottom: 20px;">Nouvelle inscription de visiteur</h1>
          
          <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h2 style="color: #333; margin-top: 0;">Événement : ${evenementTitre}</h2>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">Informations du visiteur</h3>
            <p style="margin: 10px 0;"><strong>Nom :</strong> ${visiteurNom}</p>
            <p style="margin: 10px 0;"><strong>Email :</strong> <a href="mailto:${visiteurEmail}" style="color: #4a90e2;">${visiteurEmail}</a></p>
            <p style="margin: 10px 0;"><strong>Téléphone :</strong> <a href="tel:${visiteurTelephone}" style="color: #4a90e2;">${visiteurTelephone}</a></p>
            <p style="margin: 10px 0;"><strong>Nombre de personnes :</strong> ${nombrePersonnes}</p>
            ${commentaires ? `<p style="margin: 10px 0;"><strong>Commentaires :</strong><br />${commentaires}</p>` : ''}
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404;"><strong>Action requise :</strong> Veuillez confirmer cette inscription depuis l'interface d'administration.</p>
          </div>
          
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            Vous pouvez répondre directement à cet email pour contacter le visiteur.
          </p>
        </div>
      </body>
    </html>`
  });

  if (error) {
    console.log("RESEND_ERROR", error);
    throw error;
  }
}