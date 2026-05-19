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

    const hashedPassword = await bcrypt.hash('Admin12345!', 12);
    const emailVerifiedDate = new Date();

    let newAdmin = existingAdmin;

    if (existingAdmin) {
      console.log('⚠️  L\'utilisateur admin existe déjà — mise à jour (sans suppression)...');
      newAdmin = await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          name: 'ADMIN',
          password: hashedPassword,
          role: UserRole.ADMIN,
          status: UserStatus.Actif,
          emailVerified: emailVerifiedDate,
        },
        include: {
          adherent: {
            include: { Adresse: true, Telephones: true },
          },
        },
      });
      console.log(`   ✅ Utilisateur admin mis à jour (ID: ${newAdmin.id})\n`);
    } else {
      console.log('👤 Création de l\'utilisateur admin...');
      newAdmin = await prisma.user.create({
        data: {
          email: 'admin@amaki.fr',
          name: 'ADMIN',
          password: hashedPassword,
          role: UserRole.ADMIN,
          status: UserStatus.Actif,
          emailVerified: emailVerifiedDate,
        },
        include: {
          adherent: {
            include: { Adresse: true, Telephones: true },
          },
        },
      });
      console.log(`   ✅ Utilisateur admin créé (ID: ${newAdmin.id})\n`);
    }

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

    let adherentId: string;

    if (newAdmin.adherent) {
      console.log('👥 Mise à jour de l\'adhérent existant...');
      const updated = await prisma.adherent.update({
        where: { id: newAdmin.adherent.id },
        data: {
          civility: Civilities.Monsieur,
          firstname: 'Hubert',
          lastname: 'Itomba',
          posteTemplateId: posteMembre.id,
          typeAdhesion: TypeAdhesion.AdhesionAnnuelle,
        },
      });
      adherentId = updated.id;
      console.log(`   ✅ Adhérent mis à jour (ID: ${adherentId})\n`);
    } else {
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
      adherentId = newAdherent.id;
      console.log(`   ✅ Adhérent créé (ID: ${adherentId})\n`);
    }

    const existingAdresse = newAdmin.adherent?.Adresse?.[0];
    console.log(existingAdresse ? '📍 Mise à jour de l\'adresse...' : '📍 Création de l\'adresse...');
    if (existingAdresse) {
      await prisma.adresse.update({
        where: { id: existingAdresse.id },
        data: {
          streetnum: '37',
          street1: "Rue de l'abbé Ruellan",
          street2: '',
          codepost: '95300',
          city: 'Argenteuil',
          country: 'France',
        },
      });
    } else {
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
    }
    console.log('   ✅ Adresse enregistrée\n');

    const existingTel = newAdmin.adherent?.Telephones?.[0];
    console.log(existingTel ? '📞 Mise à jour du téléphone...' : '📞 Création du téléphone...');
    if (existingTel) {
      await prisma.telephone.update({
        where: { id: existingTel.id },
        data: {
          numero: '+33607034364',
          type: TypeTelephone.Mobile,
          estPrincipal: true,
        },
      });
    } else {
      await prisma.telephone.create({
        data: {
          adherentId,
          numero: '+33607034364',
          type: TypeTelephone.Mobile,
          estPrincipal: true,
        },
      });
    }
    console.log('   ✅ Téléphone enregistré\n');

    console.log('=====================================');
    console.log('✅ Utilisateur admin créé avec succès !');
    console.log('=====================================');
    console.log(`📧 Email: admin@amaki.fr`);
    console.log(`🔐 Mot de passe: Admin12345!`);
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

