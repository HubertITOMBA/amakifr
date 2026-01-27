import { PrismaClient, TypeAdhesion, Civilities, UserRole, UserStatus, TypeNotification, TypeTelephone } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getEmailProvider } from '../lib/email/providers';
import type { EmailOptions } from '../lib/email/providers/types';

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

// Fonction pour envoyer l'email de bienvenue avec le mot de passe
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
      // Vérifier si c'est une erreur d'authentification (401)
      const isAuthError = result.error && 
        typeof result.error === 'object' && 
        'code' in result.error && 
        result.error.code === 401;
      
      if (isAuthError) {
        // Erreur d'authentification : logger une seule fois au début, puis être silencieux
        if (!(global as any).emailAuthErrorLogged) {
          console.error(`⚠️  EMAIL_AUTH_ERROR: La configuration du provider email est invalide ou manquante. Vérifiez les variables d'environnement (RESEND_API_KEY, SMTP_*, etc.).`);
          console.error(`   Les emails ne seront pas envoyés pour les utilisateurs suivants.`);
          (global as any).emailAuthErrorLogged = true;
        }
        // Ne pas throw pour continuer l'import même si l'email échoue
        return;
      }
      
      // Pour les autres erreurs, logger et continuer
      console.error(`   ⚠️  Erreur lors de l'envoi de l'email à ${email}: ${result.error?.message || 'Erreur inconnue'}`);
      return;
    }
    console.log(`   ✅ Email de bienvenue envoyé à ${email}`);
  } catch (error: any) {
    // Vérifier si c'est une erreur d'authentification (401)
    const isAuthError = error?.code === 401 || 
      (error?.response?.body?.errors?.[0]?.message === 'Could not authenticate');
    
    if (isAuthError) {
      // Erreur d'authentification : logger une seule fois au début, puis être silencieux
      if (!(global as any).emailAuthErrorLogged) {
        console.error(`⚠️  EMAIL_AUTH_ERROR: La configuration du provider email est invalide ou manquante. Vérifiez les variables d'environnement (RESEND_API_KEY, SMTP_*, etc.).`);
        console.error(`   Les emails ne seront pas envoyés pour les utilisateurs suivants.`);
        (global as any).emailAuthErrorLogged = true;
      }
      // Ne pas throw pour continuer l'import même si l'email échoue
      return;
    }
    
    // Pour les autres erreurs, logger et continuer
    console.error(`   ⚠️  Erreur lors de l'envoi de l'email à ${email}: ${error?.message || 'Erreur inconnue'}`);
  }
}

// Fonction pour créer une notification
async function createNotification(
  userId: string,
  titre: string,
  message: string,
  lien?: string
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: TypeNotification.Systeme,
        titre,
        message,
        lien: lien || null,
        lue: false,
      },
    });
    console.log(`✅ Notification créée pour l'utilisateur ${userId}`);
  } catch (error) {
    console.error(`❌ Erreur lors de la création de la notification pour ${userId}:`, error);
    // Ne pas bloquer le processus si la notification échoue
  }
}

// Fonction principale pour importer les anciens adhérents
async function importAnciensAdherents() {
  console.log('🚀 Démarrage de l\'import des anciens adhérents...\n');

  try {
    // Lire le fichier des anciens adhérents
    const filePath = join(process.cwd(), 'save', 'ancien_adherents.md');
    const fileContent = readFileSync(filePath, 'utf-8');

    // Parser le fichier (format JavaScript/TypeScript)
    // Extraire le contenu du tableau testUsers
    const usersMatch = fileContent.match(/const testUsers = \[([\s\S]*?)\];/);
    if (!usersMatch) {
      throw new Error('Impossible de trouver le tableau testUsers dans le fichier');
    }

    const usersData: Array<{
      email: string;
      name: string;
      role: UserRole;
      status: UserStatus;
      adherent: {
        civility: Civilities;
        firstname: string;
        lastname: string;
        adresse?: {
          streetnum?: string;
          street1?: string;
          street2?: string;
          codepost?: string;
          city?: string;
          country?: string;
        };
        telephone?: {
          numero?: string;
          type?: TypeTelephone;
          estPrincipal?: boolean;
        };
      };
    }> = [];

    // Parser simplifié : extraire chaque objet utilisateur
    // Diviser par les objets utilisateur (pattern: }, { ou },{)
    const content = usersMatch[1];
    
    // Extraire chaque bloc utilisateur en cherchant les patterns email, name, civility, firstname, lastname
    // Utiliser une regex globale pour trouver tous les blocs
    const emailPattern = /email:\s*['"]([^'"]+)['"]/g;
    const namePattern = /name:\s*['"]([^'"]+)['"]/g;
    const civilityPattern = /civility:\s*['"]([^'"]+)['"]/g;
    const firstnamePattern = /firstname:\s*['"]([^'"]+)['"]/g;
    const lastnamePattern = /lastname:\s*['"]([^'"]+)['"]/g;
    
    // Patterns pour l'adresse
    const streetnumPattern = /streetnum:\s*['"]([^'"]*)['"]/g;
    const street1Pattern = /street1:\s*['"]([^'"]*)['"]/g;
    const street2Pattern = /street2:\s*['"]([^'"]*)['"]/g;
    const codepostPattern = /codepost:\s*['"]([^'"]*)['"]/g;
    const cityPattern = /city:\s*['"]([^'"]*)['"]/g;
    const countryPattern = /country:\s*['"]([^'"]*)['"]/g;
    
    // Patterns pour le téléphone
    const telephoneNumeroPattern = /numero:\s*['"]([^'"]*)['"]/g;
    const telephoneTypePattern = /type:\s*['"]([^'"]+)['"]/g;
    const estPrincipalPattern = /estPrincipal:\s*(true|false)/g;

    // Extraire toutes les valeurs
    const emails: string[] = [];
    const names: string[] = [];
    const civilities: string[] = [];
    const firstnames: string[] = [];
    const lastnames: string[] = [];
    const streetnums: string[] = [];
    const street1s: string[] = [];
    const street2s: string[] = [];
    const codeposts: string[] = [];
    const cities: string[] = [];
    const countries: string[] = [];
    const telephoneNumeros: string[] = [];
    const telephoneTypes: string[] = [];
    const estPrincipals: boolean[] = [];

    let match;
    while ((match = emailPattern.exec(content)) !== null) {
      emails.push(match[1].trim());
    }
    while ((match = namePattern.exec(content)) !== null) {
      names.push(match[1].trim());
    }
    while ((match = civilityPattern.exec(content)) !== null) {
      civilities.push(match[1].trim());
    }
    while ((match = firstnamePattern.exec(content)) !== null) {
      firstnames.push(match[1].trim());
    }
    while ((match = lastnamePattern.exec(content)) !== null) {
      lastnames.push(match[1].trim());
    }
    
    // Extraire les adresses
    while ((match = streetnumPattern.exec(content)) !== null) {
      streetnums.push(match[1].trim());
    }
    while ((match = street1Pattern.exec(content)) !== null) {
      street1s.push(match[1].trim());
    }
    while ((match = street2Pattern.exec(content)) !== null) {
      street2s.push(match[1].trim());
    }
    while ((match = codepostPattern.exec(content)) !== null) {
      codeposts.push(match[1].trim());
    }
    while ((match = cityPattern.exec(content)) !== null) {
      cities.push(match[1].trim());
    }
    while ((match = countryPattern.exec(content)) !== null) {
      countries.push(match[1].trim());
    }
    
    // Extraire les téléphones
    while ((match = telephoneNumeroPattern.exec(content)) !== null) {
      telephoneNumeros.push(match[1].trim());
    }
    while ((match = telephoneTypePattern.exec(content)) !== null) {
      telephoneTypes.push(match[1].trim());
    }
    while ((match = estPrincipalPattern.exec(content)) !== null) {
      estPrincipals.push(match[1] === 'true');
    }

    // Vérifier que tous les tableaux ont la même longueur
    const maxLength = Math.max(
      emails.length, names.length, civilities.length, firstnames.length, lastnames.length,
      streetnums.length, street1s.length, street2s.length, codeposts.length, cities.length, countries.length,
      telephoneNumeros.length, telephoneTypes.length, estPrincipals.length
    );
    
    if (emails.length !== maxLength || names.length !== maxLength || civilities.length !== maxLength || 
        firstnames.length !== maxLength || lastnames.length !== maxLength) {
      console.warn('⚠️  Attention: certaines données sont manquantes. Vérifiez le fichier source.');
    }

    // Créer les objets utilisateur
    for (let i = 0; i < maxLength; i++) {
      if (emails[i] && names[i] && civilities[i] && firstnames[i] && lastnames[i]) {
        const civility = civilities[i] as Civilities;
        const validCivility = ['Monsieur', 'Madame', 'Mademoiselle'].includes(civility) 
          ? civility 
          : 'Monsieur';

        // Parser le type de téléphone
        const telType = telephoneTypes[i] || 'Mobile';
        const validTelType = ['Mobile', 'Fixe', 'Professionnel'].includes(telType)
          ? (telType as TypeTelephone)
          : TypeTelephone.Mobile;

        usersData.push({
          email: emails[i],
          name: names[i],
          role: 'MEMBRE' as UserRole,
          status: 'Actif' as UserStatus,
          adherent: {
            civility: validCivility as Civilities,
            firstname: firstnames[i],
            lastname: lastnames[i],
            adresse: {
              streetnum: streetnums[i] || undefined,
              street1: street1s[i] || undefined,
              street2: street2s[i] || undefined,
              codepost: codeposts[i] || undefined,
              city: cities[i] || undefined,
              country: countries[i] || 'France',
            },
            telephone: {
              numero: telephoneNumeros[i] || undefined,
              type: validTelType,
              estPrincipal: estPrincipals[i] !== undefined ? estPrincipals[i] : true,
            },
          },
        });
      }
    }

    if (usersData.length === 0) {
      throw new Error('Aucun utilisateur trouvé dans le fichier');
    }

    console.log(`📋 ${usersData.length} utilisateur(s) trouvé(s) dans le fichier\n`);

    // Récupérer le poste par défaut "Membre de l'association"
    const posteMembre = await prisma.posteTemplate.findUnique({
      where: { code: 'MEMBRE' },
    });

    if (!posteMembre) {
      throw new Error('Le poste "MEMBRE" n\'existe pas dans la base de données. Veuillez d\'abord créer les postes.');
    }

    // Date de première adhésion : 31/12/2023
    const datePremiereAdhesion = new Date('2023-12-31');

    let created = 0;
    let updated = 0;
    let errors = 0;

    // Traiter chaque utilisateur
    for (const userData of usersData) {
      try {
        console.log(`\n📧 Traitement de ${userData.email}...`);

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email },
          include: { adherent: true },
        });

        // Générer un mot de passe aléatoire
        const plainPassword = generatePassword(12);
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // Date/heure actuelle pour emailVerified
        const emailVerifiedDate = new Date();

        let userId: string;
        let isNewUser = false;

        if (existingUser) {
          // Mettre à jour l'utilisateur existant
          console.log(`   ↻ Mise à jour de l'utilisateur existant...`);
          
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: userData.name,
              password: hashedPassword, // Mettre à jour le mot de passe
              role: userData.role,
              status: userData.status,
              emailVerified: emailVerifiedDate, // Mettre à jour la date de vérification email
            },
          });

          userId = existingUser.id;

          // Mettre à jour ou créer l'adhérent
          let adherentId: string;
          if (existingUser.adherent) {
            const updatedAdherent = await prisma.adherent.update({
              where: { id: existingUser.adherent.id },
              data: {
                civility: userData.adherent.civility,
                firstname: userData.adherent.firstname,
                lastname: userData.adherent.lastname,
                datePremiereAdhesion,
                typeAdhesion: TypeAdhesion.AdhesionAnnuelle,
                posteTemplateId: posteMembre.id,
              },
            });
            adherentId = updatedAdherent.id;
            console.log(`   ✅ Adhérent mis à jour`);
          } else {
            const newAdherent = await prisma.adherent.create({
              data: {
                userId: existingUser.id,
                civility: userData.adherent.civility,
                firstname: userData.adherent.firstname,
                lastname: userData.adherent.lastname,
                datePremiereAdhesion,
                typeAdhesion: TypeAdhesion.AdhesionAnnuelle,
                posteTemplateId: posteMembre.id,
              },
            });
            adherentId = newAdherent.id;
            console.log(`   ✅ Adhérent créé`);
          }

          // Gérer l'adresse (upsert)
          if (userData.adherent.adresse) {
            const existingAdresse = await prisma.adresse.findFirst({
              where: { adherentId },
            });

            if (existingAdresse) {
              await prisma.adresse.update({
                where: { id: existingAdresse.id },
                data: {
                  streetnum: userData.adherent.adresse.streetnum || null,
                  street1: userData.adherent.adresse.street1 || null,
                  street2: userData.adherent.adresse.street2 || null,
                  codepost: userData.adherent.adresse.codepost || null,
                  city: userData.adherent.adresse.city || null,
                  country: userData.adherent.adresse.country || null,
                },
              });
              console.log(`   ✅ Adresse mise à jour`);
            } else {
              await prisma.adresse.create({
                data: {
                  adherentId,
                  streetnum: userData.adherent.adresse.streetnum || null,
                  street1: userData.adherent.adresse.street1 || null,
                  street2: userData.adherent.adresse.street2 || null,
                  codepost: userData.adherent.adresse.codepost || null,
                  city: userData.adherent.adresse.city || null,
                  country: userData.adherent.adresse.country || null,
                },
              });
              console.log(`   ✅ Adresse créée`);
            }
          }

          // Gérer le téléphone principal (upsert)
          if (userData.adherent.telephone && userData.adherent.telephone.numero) {
            // D'abord, désactiver tous les autres téléphones principaux si celui-ci est principal
            if (userData.adherent.telephone.estPrincipal) {
              await prisma.telephone.updateMany({
                where: { 
                  adherentId,
                  estPrincipal: true,
                },
                data: { estPrincipal: false },
              });
            }

            // Chercher un téléphone existant avec le même numéro
            const existingTelephone = await prisma.telephone.findFirst({
              where: { 
                adherentId,
                numero: userData.adherent.telephone.numero,
              },
            });

            if (existingTelephone) {
              await prisma.telephone.update({
                where: { id: existingTelephone.id },
                data: {
                  type: userData.adherent.telephone.type || TypeTelephone.Mobile,
                  estPrincipal: userData.adherent.telephone.estPrincipal !== undefined 
                    ? userData.adherent.telephone.estPrincipal 
                    : true,
                },
              });
              console.log(`   ✅ Téléphone mis à jour`);
            } else {
              await prisma.telephone.create({
                data: {
                  adherentId,
                  numero: userData.adherent.telephone.numero,
                  type: userData.adherent.telephone.type || TypeTelephone.Mobile,
                  estPrincipal: userData.adherent.telephone.estPrincipal !== undefined 
                    ? userData.adherent.telephone.estPrincipal 
                    : true,
                },
              });
              console.log(`   ✅ Téléphone créé`);
            }
          }

          updated++;
        } else {
          // Créer un nouvel utilisateur
          console.log(`   ➕ Création d'un nouvel utilisateur...`);
          
          // Gérer la contrainte unique sur le champ `name`
          // Si un utilisateur avec ce nom existe déjà, rendre le nom unique
          let uniqueName = userData.name;
          if (uniqueName) {
            let nameCounter = 1;
            let existingUserWithName = await prisma.user.findUnique({
              where: { name: uniqueName },
            });
            
            // Si le nom existe déjà, ajouter un suffixe pour le rendre unique
            while (existingUserWithName) {
              uniqueName = `${userData.name} (${nameCounter})`;
              existingUserWithName = await prisma.user.findUnique({
                where: { name: uniqueName },
              });
              nameCounter++;
              
              // Limite de sécurité pour éviter une boucle infinie
              if (nameCounter > 1000) {
                // Utiliser l'email comme fallback si trop de collisions
                uniqueName = userData.email || `User-${Date.now()}`;
                break;
              }
            }
            
            if (uniqueName !== userData.name) {
              console.log(`   ⚠️  Nom "${userData.name}" déjà utilisé, utilisation de "${uniqueName}"`);
            }
          }
          
          const newUser = await prisma.user.create({
            data: {
              email: userData.email,
              name: uniqueName,
              password: hashedPassword,
              role: userData.role,
              status: userData.status,
              emailVerified: emailVerifiedDate, // Définir la date de vérification email
              adherent: {
                create: {
                  civility: userData.adherent.civility,
                  firstname: userData.adherent.firstname,
                  lastname: userData.adherent.lastname,
                  datePremiereAdhesion,
                  typeAdhesion: TypeAdhesion.AdhesionAnnuelle,
                  posteTemplateId: posteMembre.id,
                },
              },
            },
            include: {
              adherent: true,
            },
          });

          userId = newUser.id;
          const adherentId = newUser.adherent!.id;
          isNewUser = true;
          created++;
          console.log(`   ✅ Utilisateur et adhérent créés`);

          // Créer l'adresse si fournie
          if (userData.adherent.adresse) {
            await prisma.adresse.create({
              data: {
                adherentId,
                streetnum: userData.adherent.adresse.streetnum || null,
                street1: userData.adherent.adresse.street1 || null,
                street2: userData.adherent.adresse.street2 || null,
                codepost: userData.adherent.adresse.codepost || null,
                city: userData.adherent.adresse.city || null,
                country: userData.adherent.adresse.country || null,
              },
            });
            console.log(`   ✅ Adresse créée`);
          }

          // Créer le téléphone si fourni
          if (userData.adherent.telephone && userData.adherent.telephone.numero) {
            await prisma.telephone.create({
              data: {
                adherentId,
                numero: userData.adherent.telephone.numero,
                type: userData.adherent.telephone.type || TypeTelephone.Mobile,
                estPrincipal: userData.adherent.telephone.estPrincipal !== undefined 
                  ? userData.adherent.telephone.estPrincipal 
                  : true,
              },
            });
            console.log(`   ✅ Téléphone créé`);
          }
        }

        // Envoyer l'email de bienvenue UNIQUEMENT pour les nouveaux utilisateurs
        // Ne pas envoyer lors de la modification d'un utilisateur existant
        if (isNewUser) {
          try {
            await sendWelcomeEmail(
              userData.email,
              userData.name,
              plainPassword,
              userData.adherent.firstname,
              userData.adherent.lastname
            );
          } catch (emailError) {
            console.error(`   ⚠️  Erreur lors de l'envoi de l'email (continuation...)`);
          }
        } else {
          console.log(`   ℹ️  Email non envoyé (utilisateur existant - modification uniquement)`);
        }

        // Créer une notification
        await createNotification(
          userId,
          'Bienvenue sur le portail AMAKI France',
          `Bonjour ${userData.adherent.firstname} ${userData.adherent.lastname}, votre compte a été ${isNewUser ? 'créé' : 'mis à jour'} sur le portail AMAKI France. Vous pouvez maintenant accéder à votre espace membre.`,
          '/user/profile'
        );

        console.log(`   ✅ ${userData.email} traité avec succès`);
      } catch (error: any) {
        errors++;
        console.error(`   ❌ Erreur lors du traitement de ${userData.email}:`, error.message);
      }
    }

    // Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DE L\'IMPORT');
    console.log('='.repeat(60));
    console.log(`✅ Utilisateurs créés : ${created}`);
    console.log(`↻ Utilisateurs mis à jour : ${updated}`);
    console.log(`❌ Erreurs : ${errors}`);
    console.log(`📧 Total traité : ${created + updated}`);
    console.log('='.repeat(60) + '\n');

  } catch (error: any) {
    console.error('❌ Erreur fatale lors de l\'import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  importAnciensAdherents()
    .then(() => {
      console.log('🎉 Import terminé avec succès !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Erreur fatale:', error);
      process.exit(1);
    });
}

export { importAnciensAdherents };

