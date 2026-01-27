import { PrismaClient, TypeAdhesion, Civilities, UserRole, UserStatus, TypeTelephone } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Script pour recréer l'utilisateur admin avec les informations spécifiées
 * ⚠️ IMPORTANT : Aucun email n'est envoyé lors de la création
 */
async function createAdminUser() {
  console.log('🚀 Création de l\'utilisateur admin...\n');

  try {
    // Vérifier si l'utilisateur admin existe déjà
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@amaki.fr' },
      include: {
        adherent: {
          include: {
            Adresse: true,
            Telephones: true,
          },
        },
      },
    });

    if (existingAdmin) {
      console.log('⚠️  L\'utilisateur admin existe déjà. Suppression de l\'ancien utilisateur...');
      
      // Supprimer l'ancien utilisateur (les adhérents, adresses et téléphones seront supprimés en cascade)
      await prisma.user.delete({
        where: { id: existingAdmin.id },
      });
      
      console.log('   ✅ Ancien utilisateur admin supprimé\n');
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash('password', 12);

    // Date de vérification email (maintenant)
    const emailVerifiedDate = new Date();

    // Créer l'utilisateur admin d'abord (sans adhérent pour pouvoir l'utiliser comme createdBy)
    console.log('👤 Création de l\'utilisateur admin...');
    const newAdmin = await prisma.user.create({
      data: {
        email: 'admin@amaki.fr',
        name: 'ADMIN',
        password: hashedPassword,
        role: UserRole.ADMIN,
        status: UserStatus.Actif,
        emailVerified: emailVerifiedDate,
      },
    });

    console.log(`   ✅ Utilisateur admin créé (ID: ${newAdmin.id})\n`);

    // Récupérer ou créer le poste "MEMBRE" par défaut
    let posteMembre = await prisma.posteTemplate.findUnique({
      where: { code: 'MEMBRE' },
    });

    if (!posteMembre) {
      console.log('📋 Le poste "MEMBRE" n\'existe pas. Création du poste...');
      posteMembre = await prisma.posteTemplate.create({
        data: {
          code: 'MEMBRE',
          libelle: 'Membre de l\'association',
          description: 'Poste pour les membres de l\'association sans responsabilité particulière.',
          ordre: 9,
          nombreMandatsDefaut: 1,
          dureeMandatDefaut: null,
          actif: true,
          createdBy: newAdmin.id, // Utiliser l'admin qu'on vient de créer
        },
      });
      console.log(`   ✅ Poste "MEMBRE" créé (ID: ${posteMembre.id})\n`);
    }

    // Créer l'adhérent avec le poste
    console.log('👥 Création de l\'adhérent...');
    const newAdherent = await prisma.adherent.create({
      data: {
        userId: newAdmin.id,
        civility: Civilities.Monsieur,
        firstname: 'Hubert',
        lastname: 'Itomba',
        posteTemplateId: posteMembre.id,
        typeAdhesion: TypeAdhesion.AdhesionAnnuelle,
      },
    });

    const adherentId = newAdherent.id;
    console.log(`   ✅ Adhérent créé (ID: ${adherentId})\n`);

    // Créer l'adresse
    console.log('📍 Création de l\'adresse...');
    await prisma.adresse.create({
      data: {
        adherentId,
        streetnum: '37',
        street1: "Rue de l'abbé Ruellan",
        street2: '',
        codepost: '95300',
        city: 'Argenteuil',
        country: 'France',
      },
    });
    console.log('   ✅ Adresse créée\n');

    // Créer le téléphone
    console.log('📞 Création du téléphone...');
    await prisma.telephone.create({
      data: {
        adherentId,
        numero: '+33607034364',
        type: TypeTelephone.Mobile,
        estPrincipal: true,
      },
    });
    console.log('   ✅ Téléphone créé\n');

    console.log('=====================================');
    console.log('✅ Utilisateur admin créé avec succès !');
    console.log('=====================================');
    console.log(`📧 Email: admin@amaki.fr`);
    console.log(`🔐 Mot de passe: password`);
    console.log(`👑 Rôle: Admin`);
    console.log(`👤 Nom: Hubert Itomba`);
    console.log(`📍 Adresse: 37 Rue de l'abbé Ruellan, 95300 Argenteuil, France`);
    console.log(`📞 Téléphone: +33607034364`);
    console.log(`📧 Aucun email envoyé (comme demandé)`);
    console.log('=====================================\n');

  } catch (error: any) {
    console.error('\n❌ Erreur lors de la création de l\'utilisateur admin:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
createAdminUser()
  .then(() => {
    console.log('✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur lors de l\'exécution du script:', error);
    process.exit(1);
  });

