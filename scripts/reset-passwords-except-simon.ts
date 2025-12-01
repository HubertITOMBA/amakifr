import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getEmailProvider } from '../lib/email/providers';

const prisma = new PrismaClient();
const domain = process.env.NEXT_PUBLIC_APP_URL || 'https://amaki.fr';

// Fonction pour générer un mot de passe aléatoire sécurisé
function generatePassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  // S'assurer qu'il y a au moins une majuscule, une minuscule, un chiffre et un caractère spécial
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
  
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Mélanger le mot de passe
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Fonction pour encoder l'image logo en base64
function getLogoBase64(): string {
  try {
    const logoPath = join(process.cwd(), 'public', 'amakifav.jpeg');
    const logoBuffer = readFileSync(logoPath);
    const base64String = logoBuffer.toString('base64');
    return `data:image/jpeg;base64,${base64String}`;
  } catch (error) {
    console.error("Erreur lors du chargement du logo:", error);
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
}

// Fonction helper pour générer l'en-tête avec logo
function getEmailHeader(): string {
  const logoDataUrl = getLogoBase64();
  return `
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

// Fonction helper pour wrapper le contenu de l'email
function wrapEmailContent(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>AMAKI France</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              ${getEmailHeader()}
              <tr>
                <td style="padding: 30px 20px;">
                  ${content}
                </td>
              </tr>
              <tr>
                <td style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                  <p style="margin: 0; color: #6c757d; font-size: 12px;">
                    © ${new Date().getFullYear()} AMAKI France. Tous droits réservés.
                  </p>
                  <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 12px;">
                    <a href="mailto:asso.amaki@gmail.com" style="color: #4a90e2; text-decoration: none;">asso.amaki@gmail.com</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Fonction pour envoyer l'email de bienvenue avec le mot de passe
 * Identique à celle utilisée dans scripts/import-anciens-adherents.ts
 */
async function sendWelcomeEmail(
  email: string,
  name: string,
  password: string,
  firstname: string,
  lastname: string
): Promise<void> {
  const content = `
    <h1 style="color: #4a90e2; margin-bottom: 20px; margin-top: 0;">Bienvenue sur le portail AMAKI France !</h1>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 10px 0; color: #666;">Bonjour ${firstname} ${lastname},</p>
      <p style="margin: 10px 0; color: #666;">Votre compte a été créé sur le portail AMAKI France. Vous pouvez maintenant accéder à votre espace membre.</p>
    </div>
    
    <div style="background-color: #dcfce7; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
      <h2 style="color: #333; margin-top: 0;">Vos identifiants de connexion</h2>
      <p style="color: #666; margin: 10px 0;"><strong>Email :</strong> ${email}</p>
      <p style="color: #666; margin: 10px 0;"><strong>Mot de passe temporaire :</strong> <code style="background-color: #fff; padding: 4px 8px; border-radius: 3px; font-family: monospace; font-size: 14px; color: #d63384;">${password}</code></p>
      <p style="color: #856404; margin: 10px 0; font-size: 14px;"><strong>⚠️ Important :</strong> Pour des raisons de sécurité, nous vous recommandons fortement de changer ce mot de passe après votre première connexion.</p>
    </div>
    
    <div style="background-color: #f0f7ff; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #4a90e2;">
      <h3 style="color: #333; margin-top: 0; font-size: 18px;">📋 Prochaines étapes</h3>
      <ol style="color: #666; padding-left: 20px;">
        <li style="margin: 10px 0;">Connectez-vous à votre espace membre avec vos identifiants</li>
        <li style="margin: 10px 0;">Changez votre mot de passe dans les paramètres de votre profil</li>
        <li style="margin: 10px 0;">Complétez vos informations d'adhérent si nécessaire</li>
        <li style="margin: 10px 0;">Explorez toutes les fonctionnalités du portail</li>
      </ol>
    </div>
    
    <div style="margin-bottom: 20px; text-align: center;">
      <a 
        href="${domain}/auth/sign-in" 
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
    const emailProvider = await getEmailProvider();
    const result = await emailProvider.send({
      from: 'noreply@amaki.fr',
      to: email,
      subject: 'Bienvenue sur le portail AMAKI France - Vos identifiants de connexion',
      html: wrapEmailContent(content)
    });

    if (!result.success) {
      console.error(`❌ Erreur lors de l'envoi de l'email à ${email}:`, result.error);
      throw result.error;
    }
    console.log(`✅ Email de bienvenue envoyé à ${email}`);
  } catch (error) {
    console.error(`❌ Erreur lors de l'envoi de l'email à ${email}:`, error);
    throw error;
  }
}

/**
 * Fonction principale pour réinitialiser les mots de passe de tous les adhérents
 * sauf ceux dont le firstname est "Simon"
 */
async function resetPasswordsExceptSimon() {
  console.log('🚀 Démarrage de la réinitialisation des mots de passe...\n');

  try {
    // Récupérer tous les utilisateurs avec leurs adhérents, sauf ceux avec firstname "Simon"
    const users = await prisma.user.findMany({
      where: {
        adherent: {
          firstname: {
            not: 'Simon',
          },
        },
      },
      include: {
        adherent: true,
      },
    });

    if (users.length === 0) {
      console.log('ℹ️  Aucun utilisateur trouvé (tous les utilisateurs ont le prénom "Simon" ou aucun utilisateur n\'existe).');
      return;
    }

    console.log(`📋 ${users.length} utilisateur(s) trouvé(s) à traiter\n`);

    let successCount = 0;
    let errorCount = 0;
    let emailSuccessCount = 0;
    let emailErrorCount = 0;

    // Traiter chaque utilisateur
    for (const user of users) {
      try {
        console.log(`\n📧 Traitement de ${user.email || user.name || user.id}...`);

        // Vérifier que l'utilisateur a un adhérent
        if (!user.adherent) {
          console.log(`   ⚠️  Utilisateur sans adhérent, ignoré`);
          continue;
        }

        // Générer un nouveau mot de passe
        const plainPassword = generatePassword(12);
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // Mettre à jour le mot de passe dans la base de données
        await prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            emailVerified: new Date(), // Mettre à jour la date de vérification email
          },
        });

        console.log(`   ✅ Mot de passe réinitialisé`);

        // Envoyer l'email de bienvenue
        try {
          await sendWelcomeEmail(
            user.email || '',
            user.name || '',
            plainPassword,
            user.adherent.firstname || '',
            user.adherent.lastname || ''
          );
          emailSuccessCount++;
        } catch (emailError: any) {
          emailErrorCount++;
          console.error(`   ⚠️  Erreur lors de l'envoi de l'email (continuation...):`, emailError.message);
        }

        successCount++;
        console.log(`   ✅ ${user.email || user.name || user.id} traité avec succès`);
      } catch (error: any) {
        errorCount++;
        console.error(`   ❌ Erreur lors du traitement de ${user.email || user.name || user.id}:`, error.message);
      }
    }

    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DE LA RÉINITIALISATION');
    console.log('='.repeat(60));
    console.log(`✅ Mots de passe réinitialisés : ${successCount}`);
    console.log(`❌ Erreurs de réinitialisation : ${errorCount}`);
    console.log(`📧 Emails envoyés avec succès : ${emailSuccessCount}`);
    console.log(`⚠️  Erreurs d'envoi d'email : ${emailErrorCount}`);
    console.log(`📋 Total traité : ${successCount + errorCount}`);
    console.log('='.repeat(60) + '\n');

  } catch (error: any) {
    console.error('❌ Erreur fatale lors de la réinitialisation:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  resetPasswordsExceptSimon()
    .then(() => {
      console.log('🎉 Réinitialisation terminée avec succès !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erreur fatale:', error);
      process.exit(1);
    });
}

export { resetPasswordsExceptSimon };

