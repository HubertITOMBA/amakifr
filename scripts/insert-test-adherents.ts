import { PrismaClient, Civilities, TypeAdhesion, TypeTelephone, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Données de test des adhérents
const testAdherents = [
  {
    email: 'f3sbtevry@gmail.com',
    name: 'Simon',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Simon',
      lastname: 'Bavueza Tongi',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '',
        street1: '',
        street2: '',
        codepost: '',
        city: 'Courcouronnes',
        country: 'France',
      },
      telephone: {
        numero: '+33661197784',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'hubert.itomba@orange.fr',
    name: 'Hubert',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Hubert',
      lastname: 'Itomba',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '37',
        street1: "Rue de l'abbé Ruellan",
        street2: '',
        codepost: '95300',
        city: 'Argenteuil',
        country: 'France',
      },
      telephone: {
        numero: '+33607034364',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'sainthoservices@outlook.fr',
    name: 'Saintho',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Thomas',
      lastname: 'Mankenda',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '25',
        street1: 'Boulevard Maurice ravel',
        street2: '',
        codepost: '95200',
        city: 'Sarcelles',
        country: 'France',
      },
      telephone: {
        numero: '+33769504591',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'seraphinkisadibeba@gmail.com',
    name: 'Seraphin',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Seraphin',
      lastname: 'Kisadi Beba',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '8',
        street1: 'Rue Claude Debussy',
        street2: '',
        codepost: '72700',
        city: 'Allones',
        country: 'France',
      },
      telephone: {
        numero: '+33765687082',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'jostshik@yahoo.fr',
    name: 'José',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'José',
      lastname: 'Tshikuna',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '',
        street1: '',
        street2: '',
        codepost: '',
        city: 'Courcouronnes',
        country: 'France',
      },
      telephone: {
        numero: '+33695365359',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'sabibine.nkashama@gmail.com',
    name: 'Miss Kinuimba',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Madame' as const,
      firstname: 'Sabine',
      lastname: 'Nashama',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '2',
        street1: 'place des alizés',
        street2: '',
        codepost: '94000',
        city: 'Créteil',
        country: 'France',
      },
      telephone: {
        numero: '+33668046770',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'mbumba.toussaint01@gmail.com',
    name: 'Toussaint',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Toussaint',
      lastname: 'Mbumba',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '2',
        street1: 'Square de la beauce',
        street2: '',
        codepost: '77000',
        city: 'Meaux',
        country: 'France',
      },
      telephone: {
        numero: '+33763329090',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'alexisnsokimondengele@gmail.com',
    name: 'Alexis',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Alexis',
      lastname: 'Mondengele Nsoki',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '40',
        street1: 'rue Ermont',
        street2: '',
        codepost: '95210',
        city: 'Saint Gratien',
        country: 'France',
      },
      telephone: {
        numero: '+33746411628',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'sylvainkanza@yahoo.fr',
    name: 'Sylvain',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Sylvain',
      lastname: 'Kanza',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '',
        street1: '',
        street2: '',
        codepost: '',
        city: '',
        country: 'France',
      },
      telephone: {
        numero: '+33627260995',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'bruno.mambulu@gmail.com',
    name: 'Bruno',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Bruno',
      lastname: 'Mambulu',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '16',
        street1: 'rue Jean-Louis Campredon',
        street2: '',
        codepost: '91250',
        city: 'Saintry-sur-seine',
        country: 'France',
      },
      telephone: {
        numero: '+33656742546',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'Jcmvuama@yahoo.fr',
    name: 'Azalya',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'JC',
      lastname: 'Mvuama',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '',
        street1: '',
        street2: '',
        codepost: '',
        city: '',
        country: 'France',
      },
      telephone: {
        numero: '+33784846102',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'dimonekene2017@hotmail.com',
    name: 'Jimmy',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Jimmy',
      lastname: 'Dimonekene',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '',
        street1: '',
        street2: '',
        codepost: '91000',
        city: 'Lieusaint',
        country: 'France',
      },
      telephone: {
        numero: '+33783919977',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'bebe.a77@hothmail.fr',
    name: 'Bébé',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Albert',
      lastname: 'Bebe Lukombo',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '21',
        street1: 'place Picard',
        street2: '',
        codepost: '77124',
        city: 'Villenoy',
        country: 'France',
      },
      telephone: {
        numero: '+33614032985',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'mariemuilu243@gmail.com',
    name: 'Marie',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Madame' as const,
      firstname: 'Marie',
      lastname: 'Muilu',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '292',
        street1: 'rue des pièces de Lugny',
        street2: '',
        codepost: '77550',
        city: 'Moissy Cramayel',
        country: 'France',
      },
      telephone: {
        numero: '+33634310747',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'bibichemampuya@yahoo.fr',
    name: 'Bibiche',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Madame' as const,
      firstname: 'Bibiche',
      lastname: 'Mampuya',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '2A',
        street1: 'rue Jacques cartier',
        street2: '',
        codepost: '93330',
        city: 'Neuilly sur Marne',
        country: 'France',
      },
      telephone: {
        numero: '+33610465697',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'gabrielbenga@yahoo.com',
    name: 'Dominique',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Dominique',
      lastname: 'Benga',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '9',
        street1: 'avenue pierre koenig',
        street2: '',
        codepost: '95250',
        city: 'Sarcelles',
        country: 'France',
      },
      telephone: {
        numero: '+33663160865',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'malela@free.fr',
    name: 'Papy',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Papy',
      lastname: 'Mbambi',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '',
        street1: '',
        street2: '',
        codepost: '',
        city: 'Lieusaint',
        country: 'France',
      },
      telephone: {
        numero: '+33695461114',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'yvonmatona@outlook.fr',
    name: 'Pitchou',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Yvon',
      lastname: 'Matona',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '1',
        street1: 'Square Jean Morlet',
        street2: '',
        codepost: '91390',
        city: 'Morsang Sur Orge',
        country: 'France',
      },
      telephone: {
        numero: '+33651235308',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'bisubula.sidonie@gmail.com',
    name: 'Thaty',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Madame' as const,
      firstname: 'Sidonie',
      lastname: 'Bisubula',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '11',
        street1: 'rue du Rouergue',
        street2: '',
        codepost: '94550',
        city: 'Chevilly Larue',
        country: 'France',
      },
      telephone: {
        numero: '+33628730747',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'maya.thethe@gmail.com',
    name: 'Thethe',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Madame' as const,
      firstname: 'Thérèse',
      lastname: 'Mayakampongo',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '',
        street1: '',
        street2: '',
        codepost: '92390',
        city: 'Villeneuve La Garenne',
        country: 'France',
      },
      telephone: {
        numero: '+33680595471',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'francoisenzumba43@gmail.com',
    name: 'Françoise',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Madame' as const,
      firstname: 'Françoise',
      lastname: 'Nzumba',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '1',
        street1: 'Résidence de la Heronniere',
        street2: '',
        codepost: '91700',
        city: 'Sainte Geneviève des bois',
        country: 'France',
      },
      telephone: {
        numero: '+33680595471',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'mayangiaugustin@gmail.com',
    name: 'Chata',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Augustin',
      lastname: 'Mafunini Mayangi',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '83',
        street1: 'Rue françois foreau',
        street2: '',
        codepost: '28110',
        city: 'Lucé',
        country: 'France',
      },
      telephone: {
        numero: '+33625506069',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'eugenembongopasy@gmail.com',
    name: 'Eugène',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Monsieur' as const,
      firstname: 'Eugène',
      lastname: 'Mbongo',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '7',
        street1: 'Rue de la libération',
        street2: '',
        codepost: '91070',
        city: 'Bondoufle',
        country: 'France',
      },
      telephone: {
        numero: '+33625506069',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'darlettenkula@yahoo.com',
    name: 'Dada',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Madame' as const,
      firstname: 'Darlette',
      lastname: 'Nkula Lukiatu',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '6',
        street1: 'avenue de tournelles',
        street2: '',
        codepost: '91800',
        city: 'Boussy Saint Antoine',
        country: 'France',
      },
      telephone: {
        numero: '+33753791831',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
  {
    email: 'ekotehenriette10@gmail.com',
    name: 'Henriette',
    password: 'password',
    role: 'MEMBRE' as const,
    status: 'Actif' as const,
    adherent: {
      civility: 'Madame' as const,
      firstname: 'Henriette',
      lastname: 'Ekote Modi',
      posteTemplateId: null as string | null,
      datePremiereAdhesion: null as Date | null,
      typeAdhesion: null as TypeAdhesion | null,
      adresse: {
        streetnum: '1',
        street1: 'Villa tony moilin',
        street2: '',
        codepost: '91000',
        city: 'Evry courcouronnes',
        country: 'France',
      },
      telephone: {
        numero: '+33656817906',
        type: 'Mobile' as const,
        estPrincipal: true,
      },
    }
  },
];

/**
 * Script pour insérer les adhérents de test dans la base de données
 * 
 * Ce script :
 * - Peut être exécuté et réexécuté plusieurs fois (gère les doublons)
 * - Ne doit pas envoyer d'emails
 * - Initialise tous les champs selon les spécifications
 */
async function insertTestAdherents() {
  console.log('🚀 Insertion des adhérents de test...\n');

  try {
    // Vérifier la connexion à la base de données
    await prisma.$connect();
    console.log('✅ Connexion à la base de données réussie\n');

    // Récupérer ou créer le posteTemplate avec id = 1 (ou le premier disponible)
    let posteTemplate;
    try {
      // Essayer de récupérer le posteTemplate avec id = 1
      posteTemplate = await prisma.posteTemplate.findFirst({
        where: { id: '1' },
      });

      // Si pas trouvé, récupérer le premier posteTemplate disponible
      if (!posteTemplate) {
        posteTemplate = await prisma.posteTemplate.findFirst({
          orderBy: { ordre: 'asc' },
        });
      }

      // Si toujours pas trouvé, créer un posteTemplate par défaut
      if (!posteTemplate) {
        // Récupérer un admin pour createdBy
        const admin = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
        });

        if (!admin) {
          throw new Error('Aucun utilisateur admin trouvé. Veuillez créer un admin d\'abord.');
        }

        posteTemplate = await prisma.posteTemplate.create({
          data: {
            code: 'MEMBRE',
            libelle: 'Membre de l\'association',
            description: 'Poste pour les membres de l\'association sans responsabilité particulière.',
            ordre: 9,
            nombreMandatsDefaut: 1,
            dureeMandatDefaut: null,
            actif: true,
            createdBy: admin.id,
          },
        });
        console.log('✅ PosteTemplate créé (ID: ' + posteTemplate.id + ')\n');
      } else {
        console.log('✅ PosteTemplate trouvé (ID: ' + posteTemplate.id + ')\n');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la récupération/création du posteTemplate:', error);
      throw error;
    }

    const posteTemplateId = posteTemplate.id;
    const today = new Date();
    const hashedPassword = await bcrypt.hash('password', 12);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Traiter chaque adhérent
    for (const userData of testAdherents) {
      try {
        // Vérifier si l'utilisateur existe déjà
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email },
          include: { adherent: true },
        });

        if (existingUser) {
          console.log(`⏭️  Utilisateur existant: ${userData.email} - Mise à jour...`);
          
          // Mettre à jour l'utilisateur
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              password: hashedPassword,
              emailVerified: today,
              status: userData.status,
              role: userData.role,
            },
          });

          // Mettre à jour ou créer l'adhérent
          if (existingUser.adherent) {
            await prisma.adherent.update({
              where: { id: existingUser.adherent.id },
              data: {
                civility: userData.adherent.civility,
                firstname: userData.adherent.firstname,
                lastname: userData.adherent.lastname,
                posteTemplateId: posteTemplateId,
                datePremiereAdhesion: today,
                typeAdhesion: TypeAdhesion.AdhesionAnnuelle,
              },
            });

            const adherentId = existingUser.adherent.id;

            // Supprimer les anciennes adresses et téléphones
            await prisma.adresse.deleteMany({ where: { adherentId } });
            await prisma.telephone.deleteMany({ where: { adherentId } });

            // Créer la nouvelle adresse
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

            // Créer le nouveau téléphone
            await prisma.telephone.create({
              data: {
                adherentId,
                numero: userData.adherent.telephone.numero,
                type: userData.adherent.telephone.type,
                estPrincipal: userData.adherent.telephone.estPrincipal,
              },
            });

          } else {
            // Créer l'adhérent s'il n'existe pas
            const newAdherent = await prisma.adherent.create({
              data: {
                userId: existingUser.id,
                civility: userData.adherent.civility,
                firstname: userData.adherent.firstname,
                lastname: userData.adherent.lastname,
                posteTemplateId: posteTemplateId,
                datePremiereAdhesion: today,
                typeAdhesion: TypeAdhesion.AdhesionAnnuelle,
              },
            });

            const adherentId = newAdherent.id;

            // Créer l'adresse
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

            // Créer le téléphone
            await prisma.telephone.create({
              data: {
                adherentId,
                numero: userData.adherent.telephone.numero,
                type: userData.adherent.telephone.type,
                estPrincipal: userData.adherent.telephone.estPrincipal,
              },
            });
          }

          updated++;
          console.log(`   ✅ Utilisateur mis à jour: ${userData.email}\n`);
        } else {
          // Créer un nom unique si nécessaire
          let uniqueName = userData.name;
          let nameCounter = 1;
          while (await prisma.user.findUnique({ where: { name: uniqueName } })) {
            uniqueName = `${userData.name}${nameCounter}`;
            nameCounter++;
          }

          // Créer l'utilisateur
          const newUser = await prisma.user.create({
            data: {
              email: userData.email,
              name: uniqueName,
              password: hashedPassword,
              emailVerified: today,
              status: userData.status,
              role: userData.role,
              adherent: {
                create: {
                  civility: userData.adherent.civility,
                  firstname: userData.adherent.firstname,
                  lastname: userData.adherent.lastname,
                  posteTemplateId: posteTemplateId,
                  datePremiereAdhesion: today,
                  typeAdhesion: TypeAdhesion.AdhesionAnnuelle,
                },
              },
            },
            include: {
              adherent: true,
            },
          });

          const adherentId = newUser.adherent!.id;

          // Créer l'adresse
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

          // Créer le téléphone
          await prisma.telephone.create({
            data: {
              adherentId,
              numero: userData.adherent.telephone.numero,
              type: userData.adherent.telephone.type,
              estPrincipal: userData.adherent.telephone.estPrincipal,
            },
          });

          created++;
          console.log(`✅ Utilisateur créé: ${userData.email} (${userData.adherent.firstname} ${userData.adherent.lastname})\n`);
        }
      } catch (error: any) {
        console.error(`❌ Erreur pour ${userData.email}:`, error.message || error);
        skipped++;
      }
    }

    console.log('\n=====================================');
    console.log('📊 Résumé de l\'insertion:');
    console.log('=====================================');
    console.log(`✅ Créés: ${created}`);
    console.log(`🔄 Mis à jour: ${updated}`);
    console.log(`⏭️  Ignorés (erreurs): ${skipped}`);
    console.log(`📦 Total: ${testAdherents.length}`);
    console.log('\n🔐 Tous les comptes utilisent le mot de passe: password');
    console.log('💡 Ce script peut être réexécuté sans problème (gestion des doublons)');
    console.log('📧 Aucun email n\'a été envoyé (script de test uniquement)');

  } catch (error) {
    console.error('❌ Erreur lors de l\'insertion des adhérents:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  insertTestAdherents()
    .then(() => {
      console.log('\n🎉 Script terminé avec succès!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erreur fatale:', error);
      process.exit(1);
    });
}

export { insertTestAdherents, testAdherents };
