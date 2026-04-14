import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { getEmailProvider } from "./email/providers"
import type { EmailOptions } from "./email/providers/types"

const domain = process.env.NEXT_PUBLIC_APP_URL

/**
 * Nettoie une URL en retirant les ports non standard et en s'assurant du bon protocole
 * @param url - L'URL à nettoyer
 * @returns L'URL nettoyée
 */
function cleanUrl(url: string | undefined | null): string | undefined {
  if (!url) return url;
  
  // Retirer le port 9050 si présent (non standard pour HTTPS)
  let cleaned = url.replace(':9050', '');
  
  // S'assurer que c'est HTTPS en production si l'URL commence par http://
  if (cleaned.startsWith('http://') && process.env.NODE_ENV === 'production') {
    cleaned = cleaned.replace('http://', 'https://');
  }
  
  // Retirer les ports standards (80 pour HTTP, 443 pour HTTPS)
  cleaned = cleaned.replace(':80', '');
  cleaned = cleaned.replace(':443', '');
  
  return cleaned;
}

/**
 * Fonction helper pour envoyer un email via le provider configuré
 * 
 * @param options - Les options d'envoi d'email (destinataire, sujet, contenu, etc.)
 * @param throwOnError - Si true, lance une exception en cas d'erreur. Si false, log seulement l'erreur (défaut: true)
 * @returns true si l'email a été envoyé avec succès, false sinon
 */
export async function sendEmail(options: EmailOptions, throwOnError: boolean = true): Promise<boolean> {
  try {
    console.log("[sendEmail] Début de l'envoi d'email à:", options.to);
    console.log("[sendEmail] Sujet:", options.subject);
    
    const provider = await getEmailProvider();
    console.log("[sendEmail] Provider obtenu avec succès");
    
    const result = await provider.send(options);
    console.log("[sendEmail] Résultat de l'envoi:", { success: result.success, error: result.error });
    
    if (!result.success) {
      const errorMessage = result.error?.message || result.error || "Erreur inconnue lors de l'envoi de l'email";
      const errorCode = result.error && typeof result.error === 'object' && 'code' in result.error ? result.error.code : null;
      const responseCode = result.error && typeof result.error === 'object' && 'responseCode' in result.error ? result.error.responseCode : null;
      
      console.error("[sendEmail] Erreur lors de l'envoi:", {
        error: result.error,
        errorMessage,
        errorCode,
        responseCode,
        to: options.to,
        subject: options.subject,
      });
      
      // Détecter les erreurs d'authentification SMTP (EAUTH, 401, 535)
      const isAuthError = 
        errorCode === 'EAUTH' || 
        errorCode === 401 || 
        responseCode === 401 || 
        responseCode === 535 ||
        (typeof errorMessage === 'string' && (
          errorMessage.includes('Invalid login') ||
          errorMessage.includes('Username and Password not accepted') ||
          errorMessage.includes('BadCredentials')
        ));
      
      if (isAuthError) {
        console.error("[sendEmail] EMAIL_AUTH_ERROR: Les credentials du provider email sont invalides. Vérifiez les variables d'environnement SMTP_EMAIL, SMTP_PASSWORD, etc.");
      }
      
      if (throwOnError) {
        throw new Error(errorMessage);
      } else {
        console.warn("[sendEmail] Erreur non bloquante - l'application continue malgré l'échec de l'envoi d'email");
        return false;
      }
    }
    
    console.log("[sendEmail] Email envoyé avec succès à:", options.to);
    return true;
  } catch (error: any) {
    // Logger l'erreur complète pour le débogage
    console.error("[sendEmail] Exception lors de l'envoi d'email:", {
      message: error?.message,
      error: error,
      stack: error?.stack,
      to: options.to,
      subject: options.subject,
    });
    
    if (throwOnError) {
      throw error;
    } else {
      console.warn("[sendEmail] Erreur non bloquante - l'application continue malgré l'échec de l'envoi d'email");
      return false;
    }
  }
}

// Fonction pour obtenir le data URL du logo en base64
// Utilise base64 intégré plutôt qu'une URL externe pour garantir l'affichage dans tous les clients email
function getLogoBase64(): string {
  // Obtenir le répertoire de travail actuel
  const cwd = process.cwd();
  
  // Liste des chemins possibles pour le logo (ordre de priorité)
  const possiblePaths = [
    // Chemins standards
    join(cwd, 'public', 'amakifav.jpeg'),
    join(cwd, 'public', 'images', 'amakifav.jpeg'),
    // Chemins relatifs depuis lib/mail.ts
    join(__dirname, '..', '..', 'public', 'amakifav.jpeg'),
    join(__dirname, '..', '..', 'public', 'images', 'amakifav.jpeg'),
    // Chemins pour Next.js standalone en production
    join(cwd, '.next', 'standalone', 'public', 'amakifav.jpeg'),
    join(cwd, '.next', 'standalone', 'public', 'images', 'amakifav.jpeg'),
    // Chemin absolu si cwd est différent
    '/sites/amakifr/public/amakifav.jpeg',
    '/sites/amakifr/public/images/amakifav.jpeg',
  ];

  console.log(`[Email] Recherche du logo dans: ${cwd}`);
  console.log(`[Email] __dirname: ${__dirname}`);

  // Essayer chaque chemin jusqu'à trouver le fichier
  for (const logoPath of possiblePaths) {
    try {
      if (existsSync(logoPath)) {
        const logoBuffer = readFileSync(logoPath);
        const base64String = logoBuffer.toString('base64');
        console.log(`[Email] ✅ Logo chargé en base64 depuis: ${logoPath}`);
        console.log(`[Email] Taille du logo: ${logoBuffer.length} bytes, base64: ${base64String.length} caractères`);
        return `data:image/jpeg;base64,${base64String}`;
      } else {
        console.log(`[Email] ⚠️  Logo non trouvé à: ${logoPath}`);
      }
    } catch (error: any) {
      console.warn(`[Email] ❌ Erreur lors du chargement depuis ${logoPath}:`, error.message);
      continue;
    }
  }

  // Si aucun fichier n'a été trouvé, essayer d'utiliser une URL publique en dernier recours
  const appUrl = cleanUrl(domain) || domain;
  if (appUrl) {
    const publicLogoUrl = `${appUrl}/amakifav.jpeg`;
    console.warn(`[Email] ⚠️  Logo non trouvé localement, utilisation de l'URL publique: ${publicLogoUrl}`);
    console.warn(`[Email] ⚠️  Note: Certains clients email peuvent bloquer les images externes`);
    return publicLogoUrl;
  }

  // En dernier recours, utiliser une image de fallback
  console.error("[Email] ❌ Aucun logo trouvé, utilisation d'une image de fallback");
  // Image de fallback transparente 1x1 pixel
  return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
}

// Fonction helper pour générer l'en-tête avec logo
function getEmailHeader(): string {
  const logoDataUrl = getLogoBase64();
  return `
    <!-- En-tête avec logo et fond bleu -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #093DB5; margin: 0;">
      <tr>
        <td align="left" style="padding: 15px 20px; vertical-align: middle;">
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
                  AMA<span style="color: #FF6B6B;">K</span>I France
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
        <td style="padding: 8px 20px; text-align: center;">
          <p style="margin: 0; color: #ffffff; font-size: 11px; font-family: Arial, sans-serif;">© ${new Date().getFullYear()} AMAKI France - Tous droits réservés</p>
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
          <div style="padding: 20px;">
            ${content}
          </div>
          
          ${getEmailFooter()}
        </div>
      </body>
    </html>`;
}

/**
 * Envoie un email à un adhérent lors de l'affectation à une tâche.
 *
 * @param params - Données de l'email
 * @returns true si l'email a été envoyé avec succès, false sinon
 */
export async function sendTacheAffecteeEmail(params: {
  to: string;
  adherentNom: string;
  projetTitre: string;
  tacheTitre: string;
}): Promise<boolean> {
  const appUrl = cleanUrl(domain) || domain || "https://amakifr.fr";
  const link = `${appUrl}/user/taches`;

  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Nouvelle tâche affectée</h1>
    <p style="margin: 10px 0; color: #666;">Bonjour ${params.adherentNom},</p>
    <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
      <p style="margin: 0; color: #166534;">
        Vous avez été affecté à la tâche <strong>"${params.tacheTitre}"</strong> du projet <strong>"${params.projetTitre}"</strong>.
      </p>
    </div>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${link}" target="_blank" rel="noopener noreferrer"
        style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 15px;">
        Voir mes tâches
      </a>
    </div>
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  return await sendEmail(
    {
      from: "noreply@amaki.fr",
      to: params.to,
      subject: `Nouvelle tâche : ${params.tacheTitre}`,
      html: wrapEmailContent(content),
    },
    false
  );
}

/**
 * Envoie un email à un adhérent lors du retrait d'affectation à une tâche.
 *
 * @param params - Données de l'email
 * @returns true si l'email a été envoyé avec succès, false sinon
 */
export async function sendTacheRetireeEmail(params: {
  to: string;
  adherentNom: string;
  projetTitre: string;
  tacheTitre: string;
}): Promise<boolean> {
  const appUrl = cleanUrl(domain) || domain || "https://amakifr.fr";
  const link = `${appUrl}/user/taches`;

  const content = `
    <h1 style="color: #dc3545; margin-bottom: 20px; margin-top: 0;">Affectation retirée</h1>
    <p style="margin: 10px 0; color: #666;">Bonjour ${params.adherentNom},</p>
    <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
      <p style="margin: 0; color: #991b1b;">
        Vous avez été retiré de la tâche <strong>"${params.tacheTitre}"</strong> du projet <strong>"${params.projetTitre}"</strong>.
      </p>
    </div>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${link}" target="_blank" rel="noopener noreferrer"
        style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 15px;">
        Accéder à mes tâches
      </a>
    </div>
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  return await sendEmail(
    {
      from: "noreply@amaki.fr",
      to: params.to,
      subject: `Retrait de la tâche : ${params.tacheTitre}`,
      html: wrapEmailContent(content),
    },
    false
  );
}

/**
 * Envoie un email à un adhérent lors d'un changement de responsable d'une tâche.
 *
 * @param params - Données de l'email
 * @returns true si l'email a été envoyé avec succès, false sinon
 */
export async function sendChangementResponsableTacheEmail(params: {
  to: string;
  adherentNom: string;
  projetTitre: string;
  tacheTitre: string;
  becameResponsible: boolean;
}): Promise<boolean> {
  const appUrl = cleanUrl(domain) || domain || "https://amakifr.fr";
  const link = `${appUrl}/user/taches`;

  const title = params.becameResponsible ? "Vous êtes maintenant responsable" : "Vous n'êtes plus responsable";
  const accent = params.becameResponsible ? "#22c55e" : "#f59e0b";
  const bg = params.becameResponsible ? "#dcfce7" : "#fef3c7";

  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Changement de responsable</h1>
    <p style="margin: 10px 0; color: #666;">Bonjour ${params.adherentNom},</p>
    <div style="background-color: ${bg}; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid ${accent};">
      <p style="margin: 0; color: #333;">
        <strong>${title}</strong> de la tâche <strong>"${params.tacheTitre}"</strong> (projet <strong>"${params.projetTitre}"</strong>).
      </p>
    </div>
    <div style="text-align: center; margin: 24px 0;">
      <a href="${link}" target="_blank" rel="noopener noreferrer"
        style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 15px;">
        Voir la tâche
      </a>
    </div>
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  const subjectPrefix = params.becameResponsible ? "Responsable de tâche" : "Responsable retiré";
  return await sendEmail(
    {
      from: "noreply@amaki.fr",
      to: params.to,
      subject: `${subjectPrefix} : ${params.tacheTitre}`,
      html: wrapEmailContent(content),
    },
    false
  );
}

export const sendTwoFactorTokenEmail = async(
    email: string,
    token: string
): Promise<boolean> => {
    const content = `
      <div style="text-align: center;">
        <h1 style="color: #4a90e2; margin-bottom: 12px; margin-top: 0; font-size: 20px;">Authentification à deux facteurs</h1>
        <p style="color: #666; margin-bottom: 12px; font-size: 14px;">Veuillez copier votre code OTP ci-dessous :</p>
        <div style="display: inline-block; margin: 12px 0;">
          <div style="background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; font-size: 22px; font-weight: bold; letter-spacing: 3px;">
            ${token}
          </div>
        </div>
        <p style="color: #999; font-size: 11px; margin-top: 12px;">
          Ce code est valide pendant 5 minutes. Ne le partagez avec personne.
        </p>
      </div>
    `;

    // Ne pas bloquer l'application si l'envoi d'email échoue (erreurs SMTP, etc.)
    return await sendEmail({
        from: "webmaster@amaki.fr",
        to: email,
        subject: "Authentification à deux facteurs",
        html: wrapEmailContent(content)
      }, false); // throwOnError = false pour ne pas bloquer
}


export const sendPasswordResetToken = async(
  email: string,
  token: string,
  baseUrl?: string
) => {
  // Prioriser baseUrl, puis domain (NEXT_PUBLIC_APP_URL), puis localhost en dernier recours
  let appUrl = baseUrl || domain || 'http://localhost:9050';
  
  // Nettoyer l'URL
  appUrl = cleanUrl(appUrl) || appUrl;
  
  const resetLink = `${appUrl}/auth/new-password?token=${token}`

  const content = `
    <div style="text-align: center;">
      <h1 style="color: #4a90e2; margin-bottom: 12px; margin-top: 0; font-size: 20px;">Réinitialisation de votre mot de passe</h1>
      <p style="color: #666; margin-bottom: 16px; font-size: 14px;">Veuillez cliquer sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
      <div style="margin: 16px 0;">
        <a href="${resetLink}" style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 10px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 14px;">
          Réinitialiser votre mot de passe
        </a>
      </div>
      <p style="color: #999; font-size: 11px; margin-top: 16px;">
        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.<br />
        Ce lien est valide pendant 1 heure.
      </p>
      <p style="color: #666; font-size: 11px; margin-top: 12px; word-break: break-all;">
        Ou copiez ce lien dans votre navigateur :<br />
        <a href="${resetLink}" style="color: #4a90e2; text-decoration: underline;">${resetLink}</a>
      </p>
    </div>
  `;

  await sendEmail({
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
      <h1 style="color: #4a90e2; margin-bottom: 12px; margin-top: 0; font-size: 20px;">Nouveau message de contact</h1>
      
      <div style="background-color: #f0f7ff; padding: 12px; border-radius: 5px; margin-bottom: 12px; border-left: 4px solid #4a90e2;">
        <h2 style="color: #333; margin-top: 0; font-size: 16px;">${goal}</h2>
      </div>
      
      <div style="margin-bottom: 12px;">
        <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 8px; font-size: 15px; margin-bottom: 8px;">Informations du contact</h3>
        <p style="margin: 6px 0; font-size: 14px;"><strong>Nom :</strong> ${name}</p>
        <p style="margin: 6px 0; font-size: 14px;"><strong>Email :</strong> <a href="mailto:${email}" style="color: #4a90e2;">${email}</a></p>
        <p style="margin: 6px 0; font-size: 14px;"><strong>Téléphone :</strong> <a href="tel:${phone}" style="color: #4a90e2;">${phone}</a></p>
      </div>
      
      <div style="margin-bottom: 12px;">
        <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 8px; font-size: 15px; margin-bottom: 8px;">Message</h3>
        <div style="background-color: #f9f9f9; padding: 12px; border-radius: 5px; white-space: pre-wrap; color: #666; font-size: 14px;">
${message}
        </div>
      </div>
      
      <p style="color: #666; font-size: 13px; margin-top: 12px;">
        Vous pouvez répondre directement à cet email ou contacter ${name} à <a href="mailto:${email}" style="color: #4a90e2;">${email}</a> ou au <a href="tel:${phone}" style="color: #4a90e2;">${phone}</a>.
      </p>
    </div>
  `;
  
  await sendEmail({
      from: 'webmaster@amaki.fr',
      to: "asso.amaki@gmail.com",
      subject: `${goal}`,
      html: wrapEmailContent(content)
    });
}

/**
 * Envoyer un email à l'administrateur pour notifier d'une inscription de visiteur à un événement
 */
export const sendVisiteurInscriptionEmail = async(
  evenementTitre: string,
  visiteurNom: string,
  visiteurEmail: string,
  visiteurTelephone: string,
  visiteurAdresse: string,
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
      <p style="margin: 10px 0;"><strong>Adresse :</strong> ${visiteurAdresse}</p>
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

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: adminEmail,
    subject: `Nouvelle inscription de visiteur : ${evenementTitre}`,
    html: wrapEmailContent(content)
  });
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

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `Statut de votre candidature : ${electionTitre}`,
    html: wrapEmailContent(content)
  });
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
    <h1 style="color: #4a90e2; margin-bottom: 12px; margin-top: 0; font-size: 20px;">Mise à jour de votre compte</h1>
  
    <div style="background-color: ${config.bgColor}; padding: 12px; border-radius: 5px; margin-bottom: 12px; border-left: 4px solid ${config.color};">
      <h2 style="color: #333; margin-top: 0; font-size: 16px;">${config.message}</h2>
      <p style="color: #666; margin: 8px 0; font-size: 14px;">${config.details}</p>
    </div>
    
    <div style="margin-bottom: 12px;">
      <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 8px; font-size: 15px; margin-bottom: 8px;">Informations de votre compte</h3>
      <p style="margin: 6px 0; font-size: 14px;"><strong>Utilisateur :</strong> ${userName}</p>
      <p style="margin: 6px 0; font-size: 14px;"><strong>Statut :</strong> <span style="color: ${config.color}; font-weight: bold;">${status}</span></p>
    </div>
    
    <p style="margin-top: 16px; color: #666; font-size: 13px;">
      Pour toute question, n'hésitez pas à nous contacter.
    </p>
    
    <p style="margin-top: 12px; color: #999; font-size: 11px; border-top: 1px solid #eee; padding-top: 12px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `Statut de votre compte AMAKI France`,
    html: wrapEmailContent(content)
  });
}

/**
 * Envoyer un email de confirmation d'inscription à un événement pour un adhérent
 */
export const sendAdherentInscriptionConfirmationEmail = async(
  email: string,
  adherentNom: string,
  evenementTitre: string,
  evenementDateDebut: Date,
  evenementLieu?: string | null,
  nombrePersonnes: number = 1
) => {
  const dateDebut = new Date(evenementDateDebut).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Confirmation d'inscription</h1>
    
    <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
      <h2 style="color: #333; margin-top: 0;">Votre inscription a été confirmée !</h2>
      <p style="color: #666; margin: 10px 0;">Nous avons bien reçu votre demande d'inscription à l'événement.</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">Détails de votre inscription</h3>
      <p style="margin: 10px 0;"><strong>Adhérent :</strong> ${adherentNom}</p>
      <p style="margin: 10px 0;"><strong>Événement :</strong> ${evenementTitre}</p>
      <p style="margin: 10px 0;"><strong>Date :</strong> ${dateDebut}</p>
      ${evenementLieu ? `<p style="margin: 10px 0;"><strong>Lieu :</strong> ${evenementLieu}</p>` : ''}
      <p style="margin: 10px 0;"><strong>Nombre de personnes :</strong> ${nombrePersonnes}</p>
    </div>
    
    <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
      <p style="margin: 0; color: #666;"><strong>Rappel :</strong> Nous vous rappelons la date et l'heure de l'événement. N'hésitez pas à nous contacter si vous avez des questions.</p>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Pour toute question, n'hésitez pas à nous contacter.
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `Confirmation d'inscription : ${evenementTitre}`,
    html: wrapEmailContent(content)
  });
}

/**
 * Envoyer un email de confirmation d'inscription à un événement pour un visiteur
 */
export const sendVisiteurInscriptionConfirmationEmail = async(
  email: string,
  visiteurNom: string,
  evenementTitre: string,
  evenementDateDebut: Date,
  evenementLieu?: string | null,
  nombrePersonnes: number = 1
) => {
  const dateDebut = new Date(evenementDateDebut).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Confirmation d'inscription</h1>
    
    <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
      <h2 style="color: #333; margin-top: 0;">Votre inscription a été enregistrée !</h2>
      <p style="color: #666; margin: 10px 0;">Nous avons bien reçu votre demande d'inscription à l'événement.</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">Détails de votre inscription</h3>
      <p style="margin: 10px 0;"><strong>Nom :</strong> ${visiteurNom}</p>
      <p style="margin: 10px 0;"><strong>Événement :</strong> ${evenementTitre}</p>
      <p style="margin: 10px 0;"><strong>Date :</strong> ${dateDebut}</p>
      ${evenementLieu ? `<p style="margin: 10px 0;"><strong>Lieu :</strong> ${evenementLieu}</p>` : ''}
      <p style="margin: 10px 0;"><strong>Nombre de personnes :</strong> ${nombrePersonnes}</p>
    </div>
    
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
      <p style="margin: 0; color: #856404;"><strong>Note importante :</strong> Votre inscription est en attente de confirmation par notre équipe. Vous recevrez un email de confirmation une fois votre inscription validée.</p>
    </div>
    
    <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
      <p style="margin: 0; color: #666;"><strong>Rappel :</strong> Nous vous rappelons la date et l'heure de l'événement. N'hésitez pas à nous contacter si vous avez des questions.</p>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Pour toute question, n'hésitez pas à nous contacter.
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `Confirmation d'inscription : ${evenementTitre}`,
    html: wrapEmailContent(content)
  });
}

/**
 * Envoyer un email personnalisé à un utilisateur
 */
export const sendCustomEmailToUsers = async(
  email: string,
  userName: string,
  subject: string,
  body: string
) => {
  // Convertir les retours à la ligne en HTML
  const bodyHtml = body
    .split('\n')
    .map(line => line.trim() === '' ? '<br/>' : `<p style="margin: 10px 0; color: #333;">${line}</p>`)
    .join('');

  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Message de l'association AMAKI France</h1>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 10px 0; color: #666;">Bonjour ${userName},</p>
    </div>
    
    <div style="margin-bottom: 20px; background-color: #f9f9f9; padding: 20px; border-radius: 5px; border-left: 4px solid #4a90e2;">
      ${bodyHtml}
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Pour toute question, n'hésitez pas à nous contacter.
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email vous a été envoyé par l'administration de l'association AMAKI France.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: subject,
    html: wrapEmailContent(content)
  });
}

/** Données pour le mail de rappel détaillé */
export type RappelDetailleData = {
  dettesInitiales: { annee: number; montantRestant: number; description?: string | null }[];
  forfaitsNonPayes: { periode: string; montantRestant: number; dateEcheance: Date }[];
  assistancesNonPayees: { periode: string; montantRestant: number; dateEcheance: Date; description?: string | null }[];
  total: number;
  prochaineEcheance?: Date | null;
  joursRestants?: number | null;
};

/** Extrait du règlement d'ordre intérieur – cotisations en retard et sanctions (pour mails de rappel) */
export const REGLEMENT_COTISATIONS_EXCERPT_TEXT = `Rappel (Règlement d'ordre intérieur) :
• Article 2 – Cotisation : Tout retard de cotisation supérieur ou égal à trois (3) mois entraîne la perte du droit d'assistance financière de l'association et la suspension du droit de vote jusqu'à régularisation.
• Article 3 – Perte de la qualité de membre : La qualité de membre se perd automatiquement en cas de retard de cotisation de trois (3) mois ou plus non régularisé malgré relance.
• Article 5 – Sanctions applicables : Avertissement ; suspension temporaire ; exclusion définitive (radiation).`;

/**
 * Envoyer un email de rappel détaillé (dettes initiales, forfaits, assistances, total)
 */
export const sendRappelDetailleCotisationEmail = async(
  email: string,
  userName: string,
  subject: string,
  data: RappelDetailleData
) => {
  const fmt = (n: number) => n.toFixed(2).replace('.', ',');
  const fmtDate = (d: Date) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  let sectionsHtml = '';

  if (data.dettesInitiales.length > 0) {
    sectionsHtml += `
      <h3 style="color: #333; font-size: 14px; margin: 16px 0 8px;">Dettes initiales</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px;">
        <thead><tr style="background: #f0f0f0;"><th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Année</th><th style="text-align: right; padding: 8px; border: 1px solid #ddd;">Restant dû</th></tr></thead>
        <tbody>
          ${data.dettesInitiales.map(d => `<tr><td style="padding: 8px; border: 1px solid #ddd;">${d.annee}</td><td style="text-align: right; padding: 8px; border: 1px solid #ddd;">${fmt(d.montantRestant)} €</td></tr>`).join('')}
        </tbody>
      </table>`;
  }

  if (data.forfaitsNonPayes.length > 0) {
    sectionsHtml += `
      <h3 style="color: #333; font-size: 14px; margin: 16px 0 8px;">Forfaits non payés</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px;">
        <thead><tr style="background: #f0f0f0;"><th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Période</th><th style="text-align: right; padding: 8px; border: 1px solid #ddd;">Échéance</th><th style="text-align: right; padding: 8px; border: 1px solid #ddd;">Restant dû</th></tr></thead>
        <tbody>
          ${data.forfaitsNonPayes.map(f => `<tr><td style="padding: 8px; border: 1px solid #ddd;">${f.periode}</td><td style="text-align: right; padding: 8px; border: 1px solid #ddd;">${fmtDate(f.dateEcheance)}</td><td style="text-align: right; padding: 8px; border: 1px solid #ddd;">${fmt(f.montantRestant)} €</td></tr>`).join('')}
        </tbody>
      </table>`;
  }

  if (data.assistancesNonPayees.length > 0) {
    sectionsHtml += `
      <h3 style="color: #333; font-size: 14px; margin: 16px 0 8px;">Assistances non payées</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px;">
        <thead><tr style="background: #f0f0f0;"><th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Période / Libellé</th><th style="text-align: right; padding: 8px; border: 1px solid #ddd;">Échéance</th><th style="text-align: right; padding: 8px; border: 1px solid #ddd;">Restant dû</th></tr></thead>
        <tbody>
          ${data.assistancesNonPayees.map(a => `<tr><td style="padding: 8px; border: 1px solid #ddd;">${a.description || a.periode}</td><td style="text-align: right; padding: 8px; border: 1px solid #ddd;">${fmtDate(a.dateEcheance)}</td><td style="text-align: right; padding: 8px; border: 1px solid #ddd;">${fmt(a.montantRestant)} €</td></tr>`).join('')}
        </tbody>
      </table>`;
  }

  let alerteHtml = '';
  if (data.prochaineEcheance != null && data.joursRestants != null) {
    if (data.joursRestants === 0) {
      alerteHtml = `<p style="margin: 12px 0; padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107;">⚠️ Une échéance arrive aujourd'hui (${fmtDate(data.prochaineEcheance)}).</p>`;
    } else if (data.joursRestants < 0) {
      alerteHtml = `<p style="margin: 12px 0; padding: 10px; background: #f8d7da; border-left: 4px solid #dc3545;">⚠️ Une échéance est en retard depuis ${Math.abs(data.joursRestants)} jour(s) (${fmtDate(data.prochaineEcheance)}).</p>`;
    } else {
      alerteHtml = `<p style="margin: 12px 0; padding: 10px; background: #e7f3ff; border-left: 4px solid #0d6efd;">Une échéance est prévue le ${fmtDate(data.prochaineEcheance)} (dans ${data.joursRestants} jour(s)).</p>`;
    }
  }

  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Rappel de cotisation – AMAKI France</h1>
    <p style="margin: 10px 0; color: #666;">Bonjour ${userName},</p>
    <p style="margin: 10px 0; color: #333;">Vous trouverez ci-dessous le détail de votre situation au regard des cotisations.</p>
    ${alerteHtml}
    ${sectionsHtml}
    <p style="margin: 16px 0; font-size: 16px; font-weight: bold; color: #0d6efd;">Montant total à régler : ${fmt(data.total)} €</p>
    <p style="margin: 16px 0; color: #333;">Merci de régulariser votre situation au plus vite.</p>
    <p style="margin: 10px 0;"><a href="https://amakifr.fr/user/profile" style="color: #4a90e2;">Consulter mes cotisations et payer</a></p>
    <div style="margin-top: 24px; padding: 14px; background: #f8f9fa; border-left: 4px solid #6c757d; font-size: 12px; color: #495057;">
      <p style="margin: 0 0 8px; font-weight: bold; color: #333;">Règlement d'ordre intérieur – Cotisations et sanctions</p>
      <p style="margin: 4px 0;"><strong>Article 2 – Cotisation :</strong> Tout retard de cotisation supérieur ou égal à trois (3) mois entraîne la perte du droit d'assistance financière de l'association et la suspension du droit de vote jusqu'à régularisation.</p>
      <p style="margin: 4px 0;"><strong>Article 3 – Perte de la qualité de membre :</strong> La qualité de membre se perd automatiquement en cas de retard de cotisation de trois (3) mois ou plus non régularisé malgré relance.</p>
      <p style="margin: 4px 0;"><strong>Article 5 – Sanctions applicables :</strong> Avertissement ; suspension temporaire ; exclusion définitive (radiation).</p>
    </div>
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">Cet email vous a été envoyé par l'administration de l'association AMAKI France.</p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject,
    html: wrapEmailContent(content),
  });
};

/**
 * Envoyer un email d'invitation à un événement
 */
export const sendEventInvitationEmail = async(
  email: string,
  userName: string,
  evenementTitre: string,
  evenementDescription: string,
  dateDebut: Date,
  dateFin: Date | null,
  lieu: string | null,
  adresse: string | null
) => {
  const dateDebutFormatted = new Date(dateDebut).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const dateFinFormatted = dateFin 
    ? new Date(dateFin).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  // Créer le lien Google Maps
  let googleMapsLink = "";
  if (adresse || lieu) {
    const addressForMaps = adresse || lieu || "";
    // Encoder l'adresse pour l'URL
    const encodedAddress = encodeURIComponent(addressForMaps);
    googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  }

  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Invitation à un événement</h1>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 10px 0; color: #666;">Bonjour ${userName},</p>
      <p style="margin: 10px 0; color: #666;">Nous avons le plaisir de vous inviter à notre événement.</p>
    </div>
    
    <div style="background-color: #f0f7ff; padding: 20px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
      <h2 style="color: #333; margin-top: 0; font-size: 20px;">${evenementTitre}</h2>
      <div style="margin-top: 15px; color: #666;">
        ${evenementDescription ? `<p style="margin: 10px 0;">${evenementDescription}</p>` : ''}
        
        <div style="margin-top: 15px;">
          <p style="margin: 8px 0;"><strong>📅 Date de début :</strong> ${dateDebutFormatted}</p>
          ${dateFinFormatted ? `<p style="margin: 8px 0;"><strong>📅 Date de fin :</strong> ${dateFinFormatted}</p>` : ''}
          ${lieu ? `<p style="margin: 8px 0;"><strong>📍 Lieu :</strong> ${lieu}</p>` : ''}
          ${adresse ? `<p style="margin: 8px 0;"><strong>📍 Adresse :</strong> ${adresse}</p>` : ''}
        </div>
      </div>
    </div>
    
    ${googleMapsLink ? `
    <div style="margin-bottom: 20px; text-align: center;">
      <a href="${googleMapsLink}" 
         target="_blank" 
         rel="noopener noreferrer"
         style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 16px;">
        🗺️ Obtenir l'itinéraire : cliquez ici
      </a>
    </div>
    ` : ''}
    
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
      <p style="margin: 0; color: #856404;"><strong>💡 Note :</strong> Vous pouvez vous inscrire à cet événement en vous connectant à votre espace membre sur le site de l'association.</p>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Nous espérons vous voir nombreux à cet événement !
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email vous a été envoyé par l'administration de l'association AMAKI France.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `Invitation : ${evenementTitre}`,
    html: wrapEmailContent(content)
  });
}

/**
 * Envoyer un email de validation d'idée à un adhérent
 */
export const sendIdeeValidationEmail = async(
  email: string,
  userName: string,
  ideeTitre: string
) => {
  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Votre idée a été validée !</h1>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 10px 0; color: #666;">Bonjour ${userName},</p>
      <p style="margin: 10px 0; color: #666;">
        Nous avons le plaisir de vous informer que votre idée <strong>"${ideeTitre}"</strong> a été validée par l'administration.
      </p>
    </div>
    
    <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #28a745;">
      <p style="margin: 0; color: #155724;">
        <strong>✅ Votre idée est maintenant visible par tous les adhérents.</strong>
      </p>
      <p style="margin: 10px 0 0 0; color: #155724;">
        Les autres membres peuvent maintenant la consulter, la commenter et l'approuver. Si elle reçoit suffisamment d'approbations, elle pourra être soumise au vote pour devenir un projet.
      </p>
    </div>
    
    <div style="margin-top: 30px;">
      <a href="${domain}/idees" 
         target="_blank" 
         rel="noopener noreferrer"
         style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 16px;">
        Voir ma boîte à idées
      </a>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Pour toute question, n'hésitez pas à nous contacter.
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `Votre idée "${ideeTitre}" a été validée`,
    html: wrapEmailContent(content)
  });
}

/**
 * Envoyer un email de rejet d'idée à un adhérent
 */
export const sendIdeeRejetEmail = async(
  email: string,
  userName: string,
  ideeTitre: string,
  raisonRejet: string
) => {
  const content = `
    <h1 style="color: #dc3545; margin-bottom: 20px; margin-top: 0;">Votre idée a été rejetée</h1>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 10px 0; color: #666;">Bonjour ${userName},</p>
      <p style="margin: 10px 0; color: #666;">
        Nous vous informons que votre idée <strong>"${ideeTitre}"</strong> a été rejetée par l'administration.
      </p>
    </div>
    
    <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #dc3545;">
      <p style="margin: 0; color: #721c24;">
        <strong>❌ Raison du rejet :</strong>
      </p>
      <p style="margin: 10px 0 0 0; color: #721c24;">
        ${raisonRejet}
      </p>
    </div>
    
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
      <p style="margin: 0; color: #856404;">
        <strong>💡 Note importante :</strong>
      </p>
      <p style="margin: 10px 0 0 0; color: #856404;">
        Votre idée a été rejetée car elle viole l'éthique de l'association, contient des propos diffamatoires ou irrespectueux. Nous vous invitons à soumettre une nouvelle idée qui respecte les valeurs et les règles de notre association.
      </p>
    </div>
    
    <div style="margin-top: 30px;">
      <a href="${domain}/user/profile" 
         target="_blank" 
         rel="noopener noreferrer"
         style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 16px;">
        Soumettre une nouvelle idée
      </a>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Pour toute question, n'hésitez pas à nous contacter.
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `Votre idée "${ideeTitre}" a été rejetée`,
    html: wrapEmailContent(content)
  });
}

/**
 * Envoyer un email de notification de suppression de commentaire à un adhérent
 */
export const sendCommentaireSupprimeEmail = async(
  email: string,
  userName: string,
  ideeTitre: string,
  raisonSuppression: string
) => {
  const content = `
    <h1 style="color: #dc3545; margin-bottom: 20px; margin-top: 0;">Votre commentaire a été supprimé</h1>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 10px 0; color: #666;">Bonjour ${userName},</p>
      <p style="margin: 10px 0; color: #666;">
        Nous vous informons que votre commentaire sur l'idée <strong>"${ideeTitre}"</strong> a été supprimé par l'administration.
      </p>
    </div>
    
    <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #dc3545;">
      <p style="margin: 0; color: #721c24;">
        <strong>❌ Raison de la suppression :</strong>
      </p>
      <p style="margin: 10px 0 0 0; color: #721c24;">
        ${raisonSuppression}
      </p>
    </div>
    
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
      <p style="margin: 0; color: #856404;">
        <strong>💡 Note importante :</strong>
      </p>
      <p style="margin: 10px 0 0 0; color: #856404;">
        Votre commentaire a été supprimé car il viole l'éthique de l'association, contient des propos diffamatoires ou irrespectueux. Nous vous invitons à respecter les valeurs et les règles de notre association dans vos futurs commentaires.
      </p>
    </div>
    
    <div style="margin-top: 30px;">
      <a href="${domain}/idees" 
         target="_blank" 
         rel="noopener noreferrer"
         style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 16px;">
        Voir les idées
      </a>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Pour toute question, n'hésitez pas à nous contacter.
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `Votre commentaire sur "${ideeTitre}" a été supprimé`,
    html: wrapEmailContent(content)
  });
}

/**
 * Envoyer un email aux administrateurs pour notifier d'une nouvelle inscription
 * 
 * @param userEmail - L'email de l'utilisateur qui vient de s'inscrire
 * @param userName - Le nom de l'utilisateur qui vient de s'inscrire
 */
export const sendNewUserNotificationEmail = async(
  userEmail: string,
  userName: string
) => {
  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Nouvelle inscription sur le portail AMAKI</h1>
    
    <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
      <h2 style="color: #333; margin-top: 0;">Un nouvel utilisateur vient de s'inscrire</h2>
      <p style="color: #666; margin: 10px 0;">Un nouveau compte a été créé sur le portail AMAKI France.</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">Informations du nouvel utilisateur</h3>
      <p style="margin: 10px 0;"><strong>Nom :</strong> ${userName}</p>
      <p style="margin: 10px 0;"><strong>Email :</strong> <a href="mailto:${userEmail}" style="color: #4a90e2;">${userEmail}</a></p>
      <p style="margin: 10px 0;"><strong>Date d'inscription :</strong> ${new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</p>
    </div>
    
    <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
      <p style="margin: 0; color: #666;"><strong>Note :</strong> L'utilisateur a reçu un email de remerciement l'invitant à compléter ses informations d'adhérent pour devenir membre effectif.</p>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Vous pouvez consulter le profil de cet utilisateur depuis l'interface d'administration.
    </p>
  `;

  // Envoyer à plusieurs destinataires
  const recipients = ["asso.amaki@gmail.com", "hubert.itomba@orange.fr","f3sbtevry@gmail.com"];
  
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    try {
      await sendEmail({
        from: 'noreply@amaki.fr',
        to: recipient,
        subject: `Nouvelle inscription : ${userName}`,
        html: wrapEmailContent(content)
      });
      
      // Attendre 5 secondes avant d'envoyer le prochain email (sauf pour le dernier)
      // Pour éviter l'erreur 429 (rate limit: 2 requêtes par seconde)
      // 5 secondes = 0.2 requête/seconde, bien en dessous de la limite
      if (i < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.log("EMAIL_ERROR pour", recipient, error);
      // Ne pas throw pour ne pas bloquer l'inscription si l'email échoue
      
      // Attendre quand même 5 secondes même en cas d'erreur pour éviter le rate limit
      if (i < recipients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

/**
 * Envoyer un email de remerciement à un nouvel utilisateur qui vient de s'inscrire
 * 
 * @param email - L'email de l'utilisateur
 * @param userName - Le nom de l'utilisateur
 */
export const sendUserRegistrationThankYouEmail = async(
  email: string,
  userName: string
) => {
  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Bienvenue sur le portail AMAKI France !</h1>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 10px 0; color: #666;">Bonjour ${userName},</p>
      <p style="margin: 10px 0; color: #666;">Nous vous remercions de votre inscription sur le portail AMAKI France !</p>
    </div>
    
    <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
      <h2 style="color: #333; margin-top: 0;">Votre compte a été créé avec succès</h2>
      <p style="color: #666; margin: 10px 0;">Vous pouvez maintenant accéder à votre espace membre et découvrir toutes les fonctionnalités du portail.</p>
    </div>
    
    <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
      <h3 style="color: #333; margin-top: 0; font-size: 18px;">💡 Devenir membre effectif ou adhérent</h3>
      <p style="color: #666; margin: 10px 0;">Si vous souhaitez devenir <strong>membre effectif</strong> ou <strong>adhérent</strong> de l'association AMAKI France, nous vous invitons à compléter vos informations d'adhérent dans votre profil.</p>
      <p style="color: #666; margin: 10px 0;">Une fois votre compte validé par l'administration, vous recevrez par la suite votre <strong>passeport AMAKI</strong>.</p>
    </div>
    
    <div style="margin-bottom: 20px; text-align: center;">
      <a 
        href="${domain}/user/profile" 
        target="_blank" 
        rel="noopener noreferrer"
        style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 10px;">
        Accéder à mon profil
      </a>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">Prochaines étapes</h3>
      <ol style="color: #666; padding-left: 20px;">
        <li style="margin: 10px 0;">Connectez-vous à votre espace membre</li>
        <li style="margin: 10px 0;">Complétez vos informations d'adhérent dans votre profil</li>
        <li style="margin: 10px 0;">Attendez la validation de votre compte par l'administration</li>
        <li style="margin: 10px 0;">Recevez votre passeport AMAKI une fois votre compte validé</li>
      </ol>
    </div>
    
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
      <p style="margin: 0; color: #856404;"><strong>📋 Important :</strong> Pour bénéficier de tous les avantages en tant que membre effectif ou adhérent, n'oubliez pas de compléter vos informations d'adhérent dans votre profil.</p>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Pour toute question, n'hésitez pas à nous contacter à <a href="mailto:asso.amaki@gmail.com" style="color: #4a90e2;">asso.amaki@gmail.com</a>.
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: 'Bienvenue sur le portail AMAKI France !',
    html: wrapEmailContent(content)
  });
}

/**
 * Envoie un email à un adhérent dont le compte a été créé par un administrateur
 * 
 * @param email - L'adresse email de l'adhérent
 * @param firstname - Le prénom de l'adhérent
 * @param lastname - Le nom de l'adhérent
 * @param hasPassword - Indique si un mot de passe temporaire a été défini
 * @param username - Le nom d'utilisateur (si défini)
 */
export const sendAdminCreatedAccountEmail = async(
  email: string,
  firstname: string,
  lastname: string,
  hasPassword: boolean = false,
  username?: string | null
) => {
  const fullName = `${firstname} ${lastname}`;
  
  const passwordInstructions = hasPassword
    ? `
      <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h3 style="color: #856404; margin-top: 0; font-size: 18px;">🔐 Mot de passe temporaire</h3>
        <p style="color: #856404; margin: 10px 0;">Un mot de passe temporaire a été défini pour votre compte.</p>
        <p style="color: #856404; margin: 10px 0;"><strong>Important :</strong> Pour des raisons de sécurité, nous vous recommandons vivement de <strong>changer votre mot de passe</strong> dès votre première connexion.</p>
      </div>
    `
    : `
      <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
        <h3 style="color: #166534; margin-top: 0; font-size: 18px;">🔑 Définir votre mot de passe</h3>
        <p style="color: #166534; margin: 10px 0;">Aucun mot de passe n'a été défini pour votre compte.</p>
        <p style="color: #166534; margin: 10px 0;">Pour vous connecter, veuillez cliquer sur <strong>"Mot de passe oublié"</strong> sur la page de connexion et suivre les instructions pour créer votre mot de passe.</p>
      </div>
    `;

  const usernameInfo = username
    ? `<p style="margin: 10px 0;"><strong>Nom d'utilisateur :</strong> ${username}</p>`
    : `<p style="margin: 10px 0; color: #666;">Vous pourrez définir votre nom d'utilisateur lors de votre première connexion.</p>`;

  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Votre compte AMAKI France a été créé</h1>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 10px 0; color: #666;">Bonjour ${fullName},</p>
      <p style="margin: 10px 0; color: #666;">Nous avons le plaisir de vous informer qu'un compte a été créé pour vous sur le portail AMAKI France par un administrateur.</p>
    </div>
    
    <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
      <h2 style="color: #333; margin-top: 0;">✅ Votre compte est actif</h2>
      <p style="color: #666; margin: 10px 0;">Vous pouvez dès maintenant accéder à votre espace membre et découvrir toutes les fonctionnalités du portail.</p>
    </div>
    
    <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
      <h3 style="color: #333; margin-top: 0; font-size: 18px;">👤 Vos informations de connexion</h3>
      <p style="margin: 10px 0;"><strong>Email :</strong> ${email}</p>
      ${usernameInfo}
    </div>
    
    ${passwordInstructions}
    
    <div style="margin-bottom: 20px; text-align: center;">
      <a 
        href="${domain}/auth/sign-in" 
        target="_blank" 
        rel="noopener noreferrer"
        style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 10px;">
        Se connecter au portail
      </a>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">🚀 Prochaines étapes</h3>
      <ol style="color: #666; padding-left: 20px;">
        <li style="margin: 10px 0;">Connectez-vous à votre espace membre avec votre email</li>
        ${hasPassword 
          ? '<li style="margin: 10px 0;">Changez votre mot de passe temporaire (recommandé)</li>'
          : '<li style="margin: 10px 0;">Utilisez "Mot de passe oublié" pour définir votre mot de passe</li>'
        }
        <li style="margin: 10px 0;">Complétez votre profil et vos informations personnelles</li>
        <li style="margin: 10px 0;">Découvrez les fonctionnalités du portail (événements, galerie, idées...)</li>
        <li style="margin: 10px 0;">Participez à la vie de l'association</li>
      </ol>
    </div>
    
    <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
      <h3 style="color: #333; margin-top: 0; font-size: 18px;">💡 Besoin d'aide ?</h3>
      <p style="color: #666; margin: 10px 0;">Si vous rencontrez des difficultés pour vous connecter ou si vous avez des questions, n'hésitez pas à contacter l'administration :</p>
      <p style="margin: 10px 0;">
        📧 Email : <a href="mailto:asso.amaki@gmail.com" style="color: #4a90e2;">asso.amaki@gmail.com</a>
      </p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">📋 Qu'est-ce que le portail AMAKI France ?</h3>
      <p style="color: #666; margin: 10px 0;">Le portail AMAKI France est votre espace membre qui vous permet de :</p>
      <ul style="color: #666; padding-left: 20px;">
        <li style="margin: 5px 0;">Consulter et participer aux événements de l'association</li>
        <li style="margin: 5px 0;">Accéder à la galerie photos et vidéos</li>
        <li style="margin: 5px 0;">Proposer des idées pour améliorer la vie associative</li>
        <li style="margin: 5px 0;">Gérer vos cotisations et paiements</li>
        <li style="margin: 5px 0;">Rester informé via les notifications</li>
        <li style="margin: 5px 0;">Échanger avec les autres membres</li>
      </ul>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Nous sommes ravis de vous compter parmi les membres d'AMAKI France !
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement suite à la création de votre compte par un administrateur. Merci de ne pas y répondre directement.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `🎉 Votre compte AMAKI France a été créé - Bienvenue ${firstname} !`,
    html: wrapEmailContent(content),
  });
};

/**
 * Envoie un email à un adhérent dont le compte va être supprimé
 * 
 * @param email - L'adresse email de l'adhérent
 * @param fullName - Le nom complet de l'adhérent
 * @param reason - La raison de la suppression
 */
export const sendAccountDeletionEmail = async(
  email: string,
  fullName: string,
  reason: string
) => {
  const content = `
    <h1 style="color: #dc2626; margin-bottom: 20px; margin-top: 0;">Suppression de votre compte AMAKI</h1>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 10px 0; color: #666;">Bonjour ${fullName},</p>
      <p style="margin: 10px 0; color: #666;">Nous vous informons que votre compte sur le portail AMAKI France a été supprimé par un administrateur.</p>
    </div>
    
    <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
      <h2 style="color: #991b1b; margin-top: 0;">🗑️ Suppression de compte</h2>
      <p style="color: #991b1b; margin: 10px 0;"><strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
      <p style="color: #991b1b; margin: 10px 0;"><strong>Raison :</strong> ${reason}</p>
    </div>
    
    <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
      <h3 style="color: #92400e; margin-top: 0; font-size: 18px;">⚠️ Informations importantes</h3>
      <p style="color: #92400e; margin: 10px 0;">Cette suppression est <strong>définitive et irréversible</strong>.</p>
      <p style="color: #92400e; margin: 10px 0;">Toutes vos données personnelles ont été supprimées de nos systèmes :</p>
      <ul style="color: #92400e; padding-left: 20px;">
        <li style="margin: 5px 0;">Informations de compte</li>
        <li style="margin: 5px 0;">Données d'adhérent</li>
        <li style="margin: 5px 0;">Historique de cotisations</li>
        <li style="margin: 5px 0;">Messages et conversations</li>
        <li style="margin: 5px 0;">Documents et réservations</li>
        <li style="margin: 5px 0;">Tout autre historique lié à votre compte</li>
      </ul>
    </div>
    
    <div style="background-color: #dbeafe; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
      <h3 style="color: #1e40af; margin-top: 0; font-size: 18px;">🔒 Conformité RGPD</h3>
      <p style="color: #1e40af; margin: 10px 0;">Conformément au Règlement Général sur la Protection des Données (RGPD), toutes vos données personnelles ont été définitivement supprimées de nos bases de données.</p>
      <p style="color: #1e40af; margin: 10px 0;">Vous ne pourrez plus accéder au portail AMAKI avec vos anciens identifiants.</p>
    </div>
    
    ${reason.toLowerCase().includes('rgpd') || reason.toLowerCase().includes('droit à l\'oubli') ? `
    <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
      <h3 style="color: #166534; margin-top: 0; font-size: 18px;">✅ Demande de suppression traitée</h3>
      <p style="color: #166534; margin: 10px 0;">Votre demande de suppression de données (droit à l'oubli) a été traitée avec succès.</p>
      <p style="color: #166534; margin: 10px 0;">Toutes vos données personnelles ont été effacées de nos systèmes conformément à votre demande.</p>
    </div>
    ` : ''}
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; margin-top: 20px; font-size: 18px;">💬 Questions ou réclamations ?</h3>
      <p style="color: #666; margin: 10px 0;">Si vous pensez que cette suppression est une erreur ou si vous avez des questions, veuillez contacter l'administration :</p>
      <p style="color: #666; margin: 10px 0;">
        <a href="mailto:asso.amaki@gmail.com" style="color: #4a90e2; text-decoration: none; font-weight: 500;">asso.amaki@gmail.com</a>
      </p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <h3 style="color: #333; margin-top: 20px; font-size: 18px;">🔄 Réadhésion</h3>
      <p style="color: #666; margin: 10px 0;">Si vous souhaitez rejoindre à nouveau l'association AMAKI France, vous devrez créer un nouveau compte et effectuer une nouvelle adhésion.</p>
      <p style="color: #666; margin: 10px 0;">Contactez-nous pour plus d'informations sur les modalités de réadhésion.</p>
    </div>
    
    <p style="margin-top: 30px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement suite à la suppression de votre compte par un administrateur de l'association AMAKI France. Si vous n'êtes pas à l'origine de cette action, veuillez contacter immédiatement l'administration.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `🗑️ Suppression de votre compte AMAKI - ${fullName}`,
    html: wrapEmailContent(content),
  });
};

/**
 * Envoie un email à un adhérent dont le mot de passe a été réinitialisé par un administrateur
 * 
 * @param email - L'adresse email de l'adhérent
 * @param fullName - Le nom complet de l'adhérent
 * @param temporaryPassword - Le mot de passe temporaire généré
 */
export const sendPasswordResetByAdminEmail = async(
  email: string,
  fullName: string,
  temporaryPassword: string
) => {
  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Réinitialisation de votre mot de passe AMAKI</h1>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 10px 0; color: #666;">Bonjour ${fullName},</p>
      <p style="margin: 10px 0; color: #666;">Un administrateur a réinitialisé votre mot de passe sur le portail AMAKI France.</p>
    </div>
    
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
      <h2 style="color: #856404; margin-top: 0;">🔐 Votre nouveau mot de passe temporaire</h2>
      <p style="color: #856404; margin: 10px 0;">Utilisez ce mot de passe pour vous connecter :</p>
      <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center;">
        <code style="font-size: 24px; font-weight: bold; color: #2563eb; letter-spacing: 2px; font-family: 'Courier New', monospace;">${temporaryPassword}</code>
      </div>
      <p style="color: #856404; margin: 10px 0;"><strong>⚠️ Important :</strong> Pour des raisons de sécurité, nous vous recommandons vivement de <strong>changer ce mot de passe</strong> dès votre première connexion.</p>
    </div>
    
    <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
      <h3 style="color: #166534; margin-top: 0; font-size: 18px;">✅ Comment vous connecter ?</h3>
      <ol style="color: #166534; padding-left: 20px;">
        <li style="margin: 10px 0;">Allez sur la page de connexion</li>
        <li style="margin: 10px 0;">Entrez votre email : <strong>${email}</strong></li>
        <li style="margin: 10px 0;">Entrez le mot de passe temporaire ci-dessus</li>
        <li style="margin: 10px 0;">Une fois connecté, changez immédiatement votre mot de passe</li>
      </ol>
    </div>
    
    <div style="margin-bottom: 20px; text-align: center;">
      <a 
        href="${domain}/auth/sign-in" 
        target="_blank" 
        rel="noopener noreferrer"
        style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 10px;">
        Se connecter au portail
      </a>
    </div>
    
    <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
      <h3 style="color: #333; margin-top: 0; font-size: 18px;">🔒 Comment changer votre mot de passe ?</h3>
      <ol style="color: #666; padding-left: 20px;">
        <li style="margin: 10px 0;">Connectez-vous avec le mot de passe temporaire</li>
        <li style="margin: 10px 0;">Allez dans <strong>Mon Profil</strong> → <strong>Paramètres</strong></li>
        <li style="margin: 10px 0;">Cliquez sur <strong>"Changer mon mot de passe"</strong></li>
        <li style="margin: 10px 0;">Entrez l'ancien mot de passe (le temporaire)</li>
        <li style="margin: 10px 0;">Définissez votre nouveau mot de passe sécurisé</li>
      </ol>
    </div>
    
    <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
      <h3 style="color: #991b1b; margin-top: 0; font-size: 18px;">⚠️ Sécurité</h3>
      <ul style="color: #991b1b; padding-left: 20px; margin: 0;">
        <li style="margin: 5px 0;">Ne partagez jamais votre mot de passe avec personne</li>
        <li style="margin: 5px 0;">Choisissez un mot de passe fort et unique</li>
        <li style="margin: 5px 0;">Si vous n'êtes pas à l'origine de cette demande, contactez immédiatement l'administration</li>
      </ul>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Si vous rencontrez des difficultés, n'hésitez pas à nous contacter à <a href="mailto:asso.amaki@gmail.com" style="color: #4a90e2;">asso.amaki@gmail.com</a>.
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement suite à une réinitialisation de mot de passe par un administrateur. Si vous n'êtes pas à l'origine de cette demande, veuillez contacter l'administration immédiatement.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `🔐 Réinitialisation de votre mot de passe AMAKI`,
    html: wrapEmailContent(content),
  });
};

/**
 * Envoyer le passeport adhérent par email avec le PDF en pièce jointe
 * 
 * @param email - L'email de l'adhérent
 * @param userName - Le nom de l'adhérent
 * @param pdfBuffer - Le buffer du PDF du passeport
 * @param numeroPasseport - Le numéro du passeport
 */
export const sendPasseportEmail = async(
  email: string,
  userName: string,
  pdfBuffer: Buffer,
  numeroPasseport: string
) => {
  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Votre passeport AMAKI est prêt !</h1>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 10px 0; color: #666;">Bonjour ${userName},</p>
      <p style="margin: 10px 0; color: #666;">Votre compte a été validé par l'administration. Votre passeport AMAKI est maintenant disponible !</p>
    </div>
    
    <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
      <h2 style="color: #333; margin-top: 0;">🎉 Félicitations !</h2>
      <p style="color: #666; margin: 10px 0;">Votre passeport AMAKI a été généré avec succès.</p>
      <p style="color: #666; margin: 10px 0;"><strong>Numéro de passeport :</strong> ${numeroPasseport}</p>
    </div>
    
    <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
      <h3 style="color: #333; margin-top: 0; font-size: 18px;">📄 Votre passeport</h3>
      <p style="color: #666; margin: 10px 0;">Votre passeport AMAKI est disponible en pièce jointe de cet email. Vous pouvez également le télécharger depuis votre profil à tout moment.</p>
    </div>
    
    <div style="margin-bottom: 20px; text-align: center;">
      <a 
        href="${domain}/user/profile" 
        target="_blank" 
        rel="noopener noreferrer"
        style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 10px;">
        Accéder à mon profil
      </a>
    </div>
    
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
      <p style="margin: 0; color: #856404;"><strong>💡 Astuce :</strong> Conservez ce passeport précieusement. Il atteste de votre adhésion à l'association AMAKI France.</p>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Pour toute question, n'hésitez pas à nous contacter à <a href="mailto:asso.amaki@gmail.com" style="color: #4a90e2;">asso.amaki@gmail.com</a>.
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  await sendEmail({
    from: 'noreply@amaki.fr',
    to: email,
    subject: `Votre passeport AMAKI - ${numeroPasseport}`,
    html: wrapEmailContent(content),
    attachments: [
      {
        filename: `Passeport-AMAKI-${numeroPasseport}.pdf`,
        content: pdfBuffer.toString('base64'),
      },
    ],
  });
}

/**
 * Envoie un email à un utilisateur avec son nouveau mot de passe réinitialisé par un administrateur
 * 
 * @param email - L'email de l'utilisateur
 * @param userName - Le nom de l'utilisateur
 * @param newPassword - Le nouveau mot de passe en clair à envoyer
 */
export const sendAdminPasswordResetEmail = async(
  email: string,
  userName: string,
  newPassword: string
) => {
  console.log(`[sendAdminPasswordResetEmail] Préparation de l'email pour ${email}`);
  
  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Réinitialisation de votre mot de passe</h1>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 10px 0; color: #666;">Bonjour ${userName},</p>
      <p style="margin: 10px 0; color: #666;">Un administrateur a réinitialisé votre mot de passe sur le portail AMAKI France.</p>
    </div>
    
    <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
      <h2 style="color: #333; margin-top: 0;">Votre nouveau mot de passe</h2>
      <p style="color: #666; margin: 10px 0;"><strong>Email :</strong> ${email}</p>
      <p style="color: #666; margin: 10px 0;"><strong>Nouveau mot de passe :</strong> <code style="background-color: #fff; padding: 4px 8px; border-radius: 3px; font-family: monospace; font-size: 14px; color: #d63384; font-weight: bold;">${newPassword}</code></p>
      <p style="color: #856404; margin: 10px 0; font-size: 14px;"><strong>⚠️ Important :</strong> Pour des raisons de sécurité, nous vous recommandons fortement de changer ce mot de passe après votre première connexion.</p>
    </div>
    
    <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
      <h3 style="color: #333; margin-top: 0; font-size: 18px;">📋 Prochaines étapes</h3>
      <ol style="color: #666; padding-left: 20px;">
        <li style="margin: 10px 0;">Connectez-vous à votre espace membre avec vos identifiants</li>
        <li style="margin: 10px 0;">Changez votre mot de passe dans les paramètres de votre profil</li>
        <li style="margin: 10px 0;">Assurez-vous que vos informations sont à jour</li>
      </ol>
    </div>
    
    <div style="margin-bottom: 20px; text-align: center;">
      <a 
        href="${cleanUrl(domain) || domain || 'https://amaki.fr'}/?openLogin=true" 
        target="_blank" 
        rel="noopener noreferrer"
        style="display: inline-block; background-color: #4a90e2; color: #ffffff; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 10px;">
        Se connecter maintenant
      </a>
    </div>
    
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
      <p style="margin: 0; color: #856404;"><strong>🔒 Sécurité :</strong> Ne partagez jamais votre mot de passe avec qui que ce soit. L'équipe AMAKI France ne vous demandera jamais votre mot de passe par email ou téléphone.</p>
    </div>
    
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Pour toute question, n'hésitez pas à nous contacter à <a href="mailto:asso.amaki@gmail.com" style="color: #4a90e2;">asso.amaki@gmail.com</a>.
    </p>
    
    <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">
      Cet email a été envoyé automatiquement. Merci de ne pas y répondre directement.
    </p>
  `;

  try {
    console.log(`[sendAdminPasswordResetEmail] Envoi de l'email à ${email}`);
    await sendEmail({
      from: 'noreply@amaki.fr',
      to: email,
      subject: 'Réinitialisation de votre mot de passe - Portail AMAKI France',
      html: wrapEmailContent(content)
    });
    console.log(`[sendAdminPasswordResetEmail] Email envoyé avec succès à ${email}`);
  } catch (error: any) {
    console.error(`[sendAdminPasswordResetEmail] Erreur lors de l'envoi de l'email à ${email}:`, {
      error,
      message: error?.message,
      stack: error?.stack,
    });
    throw error; // Re-lancer l'erreur pour qu'elle soit catchée dans la Server Action
  }
}
