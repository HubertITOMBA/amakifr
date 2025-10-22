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
      from: 'contact@amaki.fr',
      to: "contact@amaki.fr",
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