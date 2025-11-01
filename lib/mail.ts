import { Resend } from "resend"
import { readFileSync } from "fs"
import { join } from "path"

const resend = new Resend(process.env.RESEND_API_KEY)
const domain = process.env.NEXT_PUBLIC_APP_URL

// Fonction pour encoder l'image logo en base64
function getLogoBase64(): string {
  try {
    const logoPath = join(process.cwd(), 'public', 'amakifav.jpeg');
    const logoBuffer = readFileSync(logoPath);
    const base64String = logoBuffer.toString('base64');
    return `data:image/jpeg;base64,${base64String}`;
  } catch (error) {
    console.error("Erreur lors du chargement du logo:", error);
    // Image de fallback transparente 1x1 pixel
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
}

// Fonction helper pour générer l'en-tête avec logo
function getEmailHeader(): string {
  const logoDataUrl = getLogoBase64();
  return `
    <!-- En-tête avec logo et fond bleu -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #093DB5; margin: 0;">
      <tr>
        <td align="left" style="padding: 20px 30px; vertical-align: middle;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left" style="vertical-align: middle; padding-right: 12px;">
                <img 
                  src="${logoDataUrl}" 
                  alt="AMAKI France" 
                  width="50" 
                  height="50" 
                  style="height: 50px; width: auto; max-width: 180px; display: block; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; max-width: 180px !important; width: auto !important; height: 50px !important;" 
                  border="0"
                />
              </td>
              <td align="left" style="vertical-align: middle;">
                <span style="color: #ffffff; font-size: 22px; font-weight: bold; text-shadow: 1px 1px 3px rgba(0,0,0,0.3); font-family: Arial, sans-serif; line-height: 50px;">
                  <span style="color: #FF6B6B;">A</span>MAKI France
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

// Fonction helper pour générer le pied de page
function getEmailFooter(): string {
  return `
    <!-- Pied de page avec couleur de l'en-tête -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #093DB5; margin: 0;">
      <tr>
        <td style="padding: 10px 30px; text-align: center;">
          <p style="margin: 0; color: #ffffff; font-size: 12px; font-family: Arial, sans-serif;">© ${new Date().getFullYear()} AMAKI France - Tous droits réservés</p>
        </td>
      </tr>
    </table>
  `;
}

// Fonction helper pour wrapper le contenu dans le template email complet
function wrapEmailContent(content: string): string {
  return `<!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email AMAKI France</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
          ${getEmailHeader()}
          
          <!-- Contenu principal -->
          <div style="padding: 30px;">
            ${content}
          </div>
          
          ${getEmailFooter()}
        </div>
      </body>
    </html>`;
}

export const sendTwoFactorTokenEmail = async(
    email: string,
    token: string
) => {
    const content = `
      <div style="text-align: center;">
        <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Authentification à deux facteurs</h1>
        <p style="color: #666; margin-bottom: 20px;">Veuillez copier votre code OTP ci-dessous :</p>
        <div style="display: inline-block; margin: 20px 0;">
          <div style="background-color: #4a90e2; color: #ffffff; padding: 15px 30px; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
            ${token}
          </div>
        </div>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">
          Ce code est valide pendant 5 minutes. Ne le partagez avec personne.
        </p>
      </div>
    `;

    const { error } = await resend.emails.send({
        from: "webmaster@amaki.fr",
        to: email,
        subject: "Authentification à deux facteurs",
        html: wrapEmailContent(content)
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

  const content = `
    <div style="text-align: center;">
      <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Réinitialisation de votre mot de passe</h1>
      <p style="color: #666; margin-bottom: 30px;">Veuillez cliquer sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
      <div style="margin: 30px 0;">
        <a href="${resetLink}" style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 16px;">
          Réinitialiser votre mot de passe
        </a>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">
        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.<br />
        Ce lien est valide pendant 1 heure.
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 15px; word-break: break-all;">
        Ou copiez ce lien dans votre navigateur :<br />
        <a href="${resetLink}" style="color: #4a90e2; text-decoration: underline;">${resetLink}</a>
      </p>
    </div>
  `;

  await resend.emails.send({
    from: "webmaster@amaki.fr",
    to: email,
    subject: "Réinitialiser votre mot de passe",
    html: wrapEmailContent(content)
  });
}


export const sendContactEmail = async(
  name: string,
  email: string,
  phone: string,
  goal: string,
  message: string,
) => {
  const content = `
    <div>
      <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Nouveau message de contact</h1>
      
      <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
        <h2 style="color: #333; margin-top: 0; font-size: 18px;">${goal}</h2>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">Informations du contact</h3>
        <p style="margin: 10px 0;"><strong>Nom :</strong> ${name}</p>
        <p style="margin: 10px 0;"><strong>Email :</strong> <a href="mailto:${email}" style="color: #4a90e2;">${email}</a></p>
        <p style="margin: 10px 0;"><strong>Téléphone :</strong> <a href="tel:${phone}" style="color: #4a90e2;">${phone}</a></p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">Message</h3>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; white-space: pre-wrap; color: #666;">
${message}
        </div>
      </div>
      
      <p style="color: #666; font-size: 14px; margin-top: 20px;">
        Vous pouvez répondre directement à cet email ou contacter ${name} à <a href="mailto:${email}" style="color: #4a90e2;">${email}</a> ou au <a href="tel:${phone}" style="color: #4a90e2;">${phone}</a>.
      </p>
    </div>
  `;
  
  const { error } = await resend.emails.send({
      from: 'webmaster@amaki.fr',
      to: "asso.amaki@gmail.com",
      subject: `${goal}`,
      html: wrapEmailContent(content)
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
  const adminEmail = process.env.ADMIN_EMAIL || "webmaster@amaki.fr";
  
  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Nouvelle inscription de visiteur</h1>
    
    <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
      <h2 style="color: #333; margin-top: 0;">Événement : ${evenementTitre}</h2>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">Informations du visiteur</h3>
      <p style="margin: 10px 0;"><strong>Nom :</strong> ${visiteurNom}</p>
      <p style="margin: 10px 0;"><strong>Email :</strong> <a href="mailto:${visiteurEmail}" style="color: #4a90e2;">${visiteurEmail}</a></p>
      <p style="margin: 10px 0;"><strong>Téléphone :</strong> <a href="tel:${visiteurTelephone}" style="color: #4a90e2;">${visiteurTelephone}</a></p>
      <p style="margin: 10px 0;"><strong>Nombre de personnes :</strong> ${nombrePersonnes}</p>
      ${commentaires ? `<p style="margin: 10px 0;"><strong>Commentaires :</strong><br /><div style="background-color: #f9f9f9; padding: 10px; border-radius: 5px; margin-top: 5px; white-space: pre-wrap; color: #666;">${commentaires}</div></p>` : ''}
    </div>
    
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
      <p style="margin: 0; color: #856404;"><strong>Action requise :</strong> Veuillez confirmer cette inscription depuis l'interface d'administration.</p>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 20px;">
      Vous pouvez répondre directement à cet email pour contacter le visiteur.
    </p>
  `;

  const { error } = await resend.emails.send({
    from: 'noreply@amaki.fr',
    to: adminEmail,
    subject: `Nouvelle inscription de visiteur : ${evenementTitre}`,
    html: wrapEmailContent(content)
  });

  if (error) {
    console.log("RESEND_ERROR", error);
    throw error;
  }
}

/**
 * Envoyer un email au candidat pour notifier d'un changement de statut de candidature
 */
export const sendCandidacyStatusEmail = async(
  email: string,
  candidatNom: string,
  electionTitre: string,
  posteTitre: string,
  status: "Validée" | "Rejetée" | "En attente"
) => {
  const statusConfig = {
    "Validée": {
      color: "#22c55e",
      bgColor: "#dcfce7",
      message: "Félicitations ! Votre candidature a été validée.",
      details: "Vous pouvez maintenant participer à l'élection."
    },
    "Rejetée": {
      color: "#ef4444",
      bgColor: "#fee2e2",
      message: "Votre candidature n'a pas été retenue.",
      details: "Merci pour votre intérêt et votre engagement."
    },
    "En attente": {
      color: "#f59e0b",
      bgColor: "#fef3c7",
      message: "Votre candidature est en cours d'examen.",
      details: "Vous serez informé dès qu'une décision sera prise."
    }
  };

  const config = statusConfig[status] || statusConfig["En attente"];

  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Mise à jour de votre candidature</h1>
    
    <div style="background-color: ${config.bgColor}; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid ${config.color};">
      <h2 style="color: #333; margin-top: 0;">${config.message}</h2>
      <p style="color: #666; margin: 10px 0;">${config.details}</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">Détails de votre candidature</h3>
      <p style="margin: 10px 0;"><strong>Candidat :</strong> ${candidatNom}</p>
      <p style="margin: 10px 0;"><strong>Élection :</strong> ${electionTitre}</p>
      <p style="margin: 10px 0;"><strong>Poste :</strong> ${posteTitre}</p>
      <p style="margin: 10px 0;"><strong>Statut :</strong> <span style="color: ${config.color}; font-weight: bold;">${status}</span></p>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Pour toute question, n'hésitez pas à nous contacter.
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  const { error } = await resend.emails.send({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `Statut de votre candidature : ${electionTitre}`,
    html: wrapEmailContent(content)
  });

  if (error) {
    console.log("RESEND_ERROR", error);
    throw error;
  }
}

/**
 * Envoyer un email à l'utilisateur pour notifier d'un changement de statut de compte
 */
export const sendUserStatusEmail = async(
  email: string,
  userName: string,
  status: "Actif" | "Inactif"
) => {
  const statusConfig = {
    "Actif": {
      color: "#22c55e",
      bgColor: "#dcfce7",
      message: "Votre compte a été activé.",
      details: "Vous pouvez maintenant accéder à toutes les fonctionnalités de votre compte."
    },
    "Inactif": {
      color: "#ef4444",
      bgColor: "#fee2e2",
      message: "Votre compte a été désactivé.",
      details: "Votre accès à la plateforme est temporairement suspendu. Contactez l'administration pour plus d'informations."
    }
  };

  const config = statusConfig[status] || statusConfig["Inactif"];

  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Mise à jour de votre compte</h1>
  
    <div style="background-color: ${config.bgColor}; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid ${config.color};">
      <h2 style="color: #333; margin-top: 0;">${config.message}</h2>
      <p style="color: #666; margin: 10px 0;">${config.details}</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">Informations de votre compte</h3>
      <p style="margin: 10px 0;"><strong>Utilisateur :</strong> ${userName}</p>
      <p style="margin: 10px 0;"><strong>Statut :</strong> <span style="color: ${config.color}; font-weight: bold;">${status}</span></p>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Pour toute question, n'hésitez pas à nous contacter.
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  const { error } = await resend.emails.send({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `Statut de votre compte AMAKI France`,
    html: wrapEmailContent(content)
  });

  if (error) {
    console.log("RESEND_ERROR", error);
    throw error;
  }
}