import { PrismaClient, TypeAdhesion, Civilities, UserRole, UserStatus, TypeTelephone } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

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

// Fonction principale pour réinitialiser et importer les adhérents
async function resetAndImportAdherents() {
  console.log('🚀 Démarrage de la réinitialisation et de l\'import des adhérents...\n');

  try {
    // Étape 1: Trouver l'admin pour le préserver
    console.log('🔍 Recherche de l\'utilisateur admin...');
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@amaki.fr' },
      include: { adherent: true }
    });

    if (!adminUser) {
      throw new Error('L\'utilisateur admin@amaki.fr n\'existe pas. Veuillez d\'abord créer cet utilisateur.');
    }

    console.log(`✅ Admin trouvé: ${adminUser.email} (ID: ${adminUser.id})\n`);

    // Étape 2: Supprimer tous les utilisateurs sauf admin
    console.log('🧹 Suppression de tous les utilisateurs sauf admin...');
    
    // Supprimer tous les utilisateurs sauf admin (les adhérents seront supprimés en cascade)
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        id: {
          not: adminUser.id
        }
      }
    });
    console.log(`   ✅ ${deletedUsers.count} utilisateur(s) supprimé(s) (sauf admin)`);
    console.log('   ✅ Les adhérents associés ont été supprimés automatiquement (cascade)\n');

    // Étape 3: Lire le fichier lesadherents.md
    console.log('📖 Lecture du fichier lesadherents.md...');
    const filePath = join(process.cwd(), 'save', 'lesadherents.md');
    const fileContent = readFileSync(filePath, 'utf-8');

    // Parser le fichier (format JavaScript/TypeScript)
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
    const content = usersMatch[1];
    
    // Extraire chaque bloc utilisateur
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
    const telephoneTypePattern = /type:\s*['"]([^'"]*)['"]/g;
    const estPrincipalPattern = /estPrincipal:\s*(true|false)/g;

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
    while ((match = emailPattern.exec(content)) !== null) emails.push(match[1]);
    while ((match = namePattern.exec(content)) !== null) names.push(match[1]);
    while ((match = civilityPattern.exec(content)) !== null) civilities.push(match[1]);
    while ((match = firstnamePattern.exec(content)) !== null) firstnames.push(match[1]);
    while ((match = lastnamePattern.exec(content)) !== null) lastnames.push(match[1]);
    while ((match = streetnumPattern.exec(content)) !== null) streetnums.push(match[1]);
    while ((match = street1Pattern.exec(content)) !== null) street1s.push(match[1]);
    while ((match = street2Pattern.exec(content)) !== null) street2s.push(match[1]);
    while ((match = codepostPattern.exec(content)) !== null) codeposts.push(match[1]);
    while ((match = cityPattern.exec(content)) !== null) cities.push(match[1]);
    while ((match = countryPattern.exec(content)) !== null) countries.push(match[1]);
    while ((match = telephoneNumeroPattern.exec(content)) !== null) telephoneNumeros.push(match[1]);
    while ((match = telephoneTypePattern.exec(content)) !== null) telephoneTypes.push(match[1]);
    while ((match = estPrincipalPattern.exec(content)) !== null) estPrincipals.push(match[1] === 'true');

    const maxLength = Math.max(
      emails.length,
      names.length,
      civilities.length,
      firstnames.length,
      lastnames.length
    );

    if (maxLength === 0) {
      throw new Error('Aucun utilisateur trouvé dans le fichier');
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

    // Étape 4: Récupérer le poste par défaut "Membre de l'association"
    const posteMembre = await prisma.posteTemplate.findUnique({
      where: { code: 'MEMBRE' },
    });

    if (!posteMembre) {
      throw new Error('Le poste "MEMBRE" n\'existe pas. Veuillez d\'abord créer ce poste.');
    }

    // Étape 5: Créer les utilisateurs et adhérents (SANS ENVOYER DE MAILS)
    console.log('👥 Création des utilisateurs et adhérents...\n');
    let created = 0;
    let errors = 0;

    for (const userData of usersData) {
      try {
        // Vérifier si l'utilisateur existe déjà (ne devrait pas arriver après suppression)
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email }
        });

        if (existingUser) {
          console.log(`   ⚠️  Utilisateur ${userData.email} existe déjà, ignoré`);
          continue;
        }

        // Hasher le mot de passe (utiliser "password" par défaut)
        const hashedPassword = await bcrypt.hash('password', 12);

        // Date de vérification email (maintenant)
        const emailVerifiedDate = new Date();

        // Créer l'utilisateur avec l'adhérent
        const newUser = await prisma.user.create({
          data: {
            email: userData.email,
            name: userData.name,
            password: hashedPassword,
            role: userData.role,
            status: userData.status,
            emailVerified: emailVerifiedDate,
            adherent: {
              create: {
                civility: userData.adherent.civility,
                firstname: userData.adherent.firstname,
                lastname: userData.adherent.lastname,
                typeAdhesion: TypeAdhesion.AdhesionAnnuelle,
                posteTemplateId: posteMembre.id,
              },
            },
          },
          include: {
            adherent: true,
          },
        });

        const adherentId = newUser.adherent!.id;
        created++;
        console.log(`   ✅ ${userData.email} - ${userData.adherent.firstname} ${userData.adherent.lastname}`);

        // Créer l'adresse si fournie
        if (userData.adherent.adresse && (
          userData.adherent.adresse.street1 || 
          userData.adherent.adresse.city || 
          userData.adherent.adresse.codepost
        )) {
          await prisma.adresse.create({
            data: {
              adherentId,
              streetnum: userData.adherent.adresse.streetnum || null,
              street1: userData.adherent.adresse.street1 || null,
              street2: userData.adherent.adresse.street2 || null,
              codepost: userData.adherent.adresse.codepost || null,
              city: userData.adherent.adresse.city || null,
              country: userData.adherent.adresse.country || 'France',
            },
          });
        }

        // Créer le téléphone si fourni
        if (userData.adherent.telephone?.numero) {
          await prisma.telephone.create({
            data: {
              adherentId,
              numero: userData.adherent.telephone.numero,
              type: userData.adherent.telephone.type,
              estPrincipal: userData.adherent.telephone.estPrincipal ?? true,
            },
          });
        }

      } catch (error: any) {
        errors++;
        console.error(`   ❌ Erreur pour ${userData.email}:`, error.message);
      }
    }

    console.log(`\n✅ Import terminé: ${created} créé(s), ${errors} erreur(s)`);
    console.log('\n📋 Résumé:');
    console.log('=====================================');
    console.log(`✅ ${created} utilisateur(s) créé(s) avec succès`);
    console.log(`❌ ${errors} erreur(s)`);
    console.log(`🔐 Mot de passe par défaut pour tous: "password"`);
    console.log(`📧 Aucun email envoyé (comme demandé)`);

  } catch (error: any) {
    console.error('\n❌ Erreur lors de la réinitialisation et de l\'import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
resetAndImportAdherents()
  .then(() => {
    console.log('\n🎉 Script terminé avec succès!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur fatale:', error);
    process.exit(1);
  });

