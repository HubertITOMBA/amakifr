import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createEvenementsFixtures() {
  console.log('🎉 Création des fixtures d\'événements...');

  try {
    // Nettoyer les données existantes
    console.log('🧹 Nettoyage des données d\'événements existantes...');
    await prisma.inscriptionEvenement.deleteMany({});
    await prisma.evenement.deleteMany({});

    // Récupérer l'admin pour createdBy
    const admin = await prisma.user.findFirst({
      where: { role: 'Admin' }
    });

    if (!admin) {
      throw new Error('Aucun administrateur trouvé. Veuillez d\'abord exécuter npm run db:seed');
    }

    console.log(`👤 Admin trouvé: ${admin.name || admin.email}`);

    // Créer les événements de test
    const evenements = [
      {
        titre: "Assemblée Générale Annuelle 2024",
        description: "Assemblée générale annuelle de l'association AMAKI pour l'année 2024. Présentation du bilan, élection du nouveau bureau et perspectives d'avenir.",
        contenu: `L'Assemblée Générale Annuelle 2024 de l'association AMAKI se tiendra le samedi 15 juin 2024 à partir de 14h00.

**Ordre du jour :**
- Accueil des participants
- Présentation du bilan de l'année 2023
- Rapport financier
- Élection du nouveau bureau
- Perspectives et projets pour 2024
- Questions diverses

**Informations pratiques :**
- Lieu : Salle des fêtes de la mairie
- Durée : environ 3 heures
- Collation offerte à la fin de la réunion
- Inscription obligatoire pour l'organisation`,
        dateDebut: new Date('2024-06-15T14:00:00'),
        dateFin: new Date('2024-06-15T17:00:00'),
        dateAffichage: new Date('2024-01-01T00:00:00'),
        dateFinAffichage: new Date('2024-06-20T23:59:59'),
        lieu: "Salle des fêtes de la mairie",
        adresse: "Place de la République, 75001 Paris",
        categorie: "General",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&h=600&fit=crop",
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&h=600&fit=crop"
        ]),
        prix: 0,
        placesDisponibles: 100,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-06-10T23:59:59'),
        contactEmail: "contact@amaki.fr",
        contactTelephone: "01 23 45 67 89",
        tags: JSON.stringify(["assemblée", "générale", "bureau", "élection"]),
        createdBy: admin.id,
      },
      {
        titre: "Formation : Gestion de Projet Associatif",
        description: "Formation pratique sur la gestion de projet dans le contexte associatif. Apprenez à planifier, organiser et suivre vos projets de A à Z.",
        contenu: `Cette formation s'adresse aux membres de l'association souhaitant développer leurs compétences en gestion de projet.

**Programme :**
- Introduction à la gestion de projet
- Outils de planification
- Gestion des ressources humaines
- Suivi et évaluation
- Cas pratiques et exercices

**Formateur :** Expert en gestion de projet avec 15 ans d'expérience
**Matériel :** Ordinateur portable recommandé
**Certificat :** Attestation de formation délivrée`,
        dateDebut: new Date('2024-07-20T09:00:00'),
        dateFin: new Date('2024-07-20T17:00:00'),
        dateAffichage: new Date('2024-02-01T00:00:00'),
        dateFinAffichage: new Date('2024-07-25T23:59:59'),
        lieu: "Centre de formation AMAKI",
        adresse: "15 rue de la Formation, 75012 Paris",
        categorie: "Formation",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop",
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=600&fit=crop"
        ]),
        prix: 50,
        placesDisponibles: 20,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-07-15T23:59:59'),
        contactEmail: "formation@amaki.fr",
        contactTelephone: "01 23 45 67 90",
        tags: JSON.stringify(["formation", "gestion", "projet", "compétences"]),
        createdBy: admin.id,
      },
      {
        titre: "Soirée Culturelle : Musique du Monde",
        description: "Découvrez les musiques traditionnelles du monde lors de cette soirée culturelle exceptionnelle. Concert, dégustation et échanges interculturels.",
        contenu: `Une soirée magique pour découvrir la richesse musicale de différentes cultures du monde.

**Programme :**
- 19h00 : Accueil et apéritif
- 19h30 : Concert de musique traditionnelle
- 21h00 : Dégustation de spécialités culinaires
- 22h00 : Échanges et discussions
- 23h00 : Fin de soirée

**Artistes invités :**
- Ensemble de musique africaine
- Groupe de musique latino-américaine
- Soliste de musique orientale

**Participation :** Ouverte à tous, membres et non-membres`,
        dateDebut: new Date('2024-08-10T19:00:00'),
        dateFin: new Date('2024-08-10T23:00:00'),
        dateAffichage: new Date('2024-03-01T00:00:00'),
        dateFinAffichage: new Date('2024-08-15T23:59:59'),
        lieu: "Espace culturel AMAKI",
        adresse: "8 avenue des Arts, 75011 Paris",
        categorie: "Culturel",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop",
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=600&fit=crop"
        ]),
        prix: 15,
        placesDisponibles: 80,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-08-05T23:59:59'),
        contactEmail: "culture@amaki.fr",
        contactTelephone: "01 23 45 67 91",
        tags: JSON.stringify(["culture", "musique", "monde", "soirée"]),
        createdBy: admin.id,
      },
      {
        titre: "Tournoi de Football Amical",
        description: "Tournoi de football amical entre les équipes de l'association. Compétition conviviale avec remise de prix et barbecue.",
        contenu: `Tournoi de football amical organisé par l'association AMAKI.

**Informations :**
- Format : 7 contre 7
- Durée : 2 x 20 minutes par match
- Équipes : Maximum 12 joueurs par équipe
- Âge : 16 ans et plus

**Programme :**
- 9h00 : Accueil et inscriptions
- 9h30 : Début des matchs
- 12h00 : Pause déjeuner (barbecue offert)
- 13h30 : Reprise des matchs
- 16h00 : Finale et remise des prix
- 17h00 : Fin de journée

**Prix :**
- 1er : Coupe + 100€
- 2ème : Médaille + 50€
- 3ème : Médaille + 25€`,
        dateDebut: new Date('2024-09-15T09:00:00'),
        dateFin: new Date('2024-09-15T17:00:00'),
        dateAffichage: new Date('2024-04-01T00:00:00'),
        dateFinAffichage: new Date('2024-09-20T23:59:59'),
        lieu: "Stade municipal",
        adresse: "Chemin des Sports, 75013 Paris",
        categorie: "Sportif",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop",
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop"
        ]),
        prix: 10,
        placesDisponibles: 60,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-09-10T23:59:59'),
        contactEmail: "sport@amaki.fr",
        contactTelephone: "01 23 45 67 92",
        tags: JSON.stringify(["football", "tournoi", "sport", "amical"]),
        createdBy: admin.id,
      },
      {
        titre: "Atelier Cuisine : Spécialités Africaines",
        description: "Apprenez à préparer des plats traditionnels africains lors de cet atelier culinaire convivial. Dégustation et recettes à emporter.",
        contenu: `Atelier culinaire pour découvrir et apprendre à préparer des spécialités africaines.

**Menu du jour :**
- Entrée : Accras de morue
- Plat principal : Poulet yassa
- Dessert : Beignets de banane

**Déroulement :**
- 10h00 : Accueil et présentation des ingrédients
- 10h30 : Préparation des entrées
- 12h00 : Préparation du plat principal
- 13h30 : Dégustation commune
- 14h30 : Préparation du dessert
- 15h30 : Fin de l'atelier

**Inclus :**
- Tous les ingrédients
- Recettes détaillées
- Dégustation
- Tablier de cuisine`,
        dateDebut: new Date('2024-10-05T10:00:00'),
        dateFin: new Date('2024-10-05T15:30:00'),
        dateAffichage: new Date('2024-05-01T00:00:00'),
        dateFinAffichage: new Date('2024-10-10T23:59:59'),
        lieu: "Cuisine pédagogique AMAKI",
        adresse: "12 rue de la Gastronomie, 75014 Paris",
        categorie: "Social",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop",
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=800&h=600&fit=crop"
        ]),
        prix: 25,
        placesDisponibles: 15,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-10-01T23:59:59'),
        contactEmail: "cuisine@amaki.fr",
        contactTelephone: "01 23 45 67 93",
        tags: JSON.stringify(["cuisine", "africain", "atelier", "culinaire"]),
        createdBy: admin.id,
      },
      {
        titre: "Conférence : L'Entrepreneuriat Social",
        description: "Conférence sur l'entrepreneuriat social et son impact sur la société. Témoignages d'entrepreneurs et échanges avec le public.",
        contenu: `Conférence-débat sur l'entrepreneuriat social et son rôle dans la transformation de la société.

**Intervenants :**
- Dr. Marie Dubois, experte en économie sociale
- Jean-Pierre Martin, fondateur d'une entreprise sociale
- Sarah Johnson, directrice d'un incubateur social

**Thèmes abordés :**
- Définition et enjeux de l'entrepreneuriat social
- Modèles économiques innovants
- Impact social et environnemental
- Financement et développement
- Témoignages et retours d'expérience

**Format :**
- 18h00 : Accueil
- 18h30 : Conférence (45 min)
- 19h15 : Débat avec le public (30 min)
- 19h45 : Cocktail de networking`,
        dateDebut: new Date('2024-11-20T18:00:00'),
        dateFin: new Date('2024-11-20T20:00:00'),
        dateAffichage: new Date('2024-06-01T00:00:00'),
        dateFinAffichage: new Date('2024-11-25T23:59:59'),
        lieu: "Amphithéâtre de l'Université",
        adresse: "Campus universitaire, 75015 Paris",
        categorie: "Formation",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=600&fit=crop",
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&h=600&fit=crop"
        ]),
        prix: 0,
        placesDisponibles: 200,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-11-15T23:59:59'),
        contactEmail: "conferences@amaki.fr",
        contactTelephone: "01 23 45 67 94",
        tags: JSON.stringify(["conférence", "entrepreneuriat", "social", "débat"]),
        createdBy: admin.id,
      },
      {
        titre: "Fête de Noël AMAKI",
        description: "Fête de fin d'année de l'association AMAKI. Repas de Noël, échanges de cadeaux et moment de convivialité entre membres.",
        contenu: `Fête de fin d'année conviviale pour tous les membres de l'association AMAKI.

**Programme :**
- 19h00 : Accueil et apéritif
- 19h30 : Repas de Noël (menu traditionnel)
- 21h00 : Échanges de cadeaux (Secret Santa)
- 21h30 : Animation musicale
- 22h30 : Gâteau de Noël
- 23h00 : Fin de soirée

**Menu :**
- Apéritif : Chips, olives, amuse-bouches
- Entrée : Terrine de foie gras
- Plat : Dinde aux marrons
- Dessert : Bûche de Noël
- Boissons : Vin, champagne, boissons non alcoolisées

**Participation :** Réservée aux membres de l'association`,
        dateDebut: new Date('2024-12-20T19:00:00'),
        dateFin: new Date('2024-12-20T23:00:00'),
        dateAffichage: new Date('2024-07-01T00:00:00'),
        dateFinAffichage: new Date('2024-12-25T23:59:59'),
        lieu: "Salle des fêtes AMAKI",
        adresse: "25 boulevard de la Convivialité, 75016 Paris",
        categorie: "Social",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1512389142860-9c449e58a543?w=800&h=600&fit=crop",
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1512389142860-9c449e58a543?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=800&h=600&fit=crop"
        ]),
        prix: 35,
        placesDisponibles: 50,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-12-15T23:59:59'),
        contactEmail: "fete@amaki.fr",
        contactTelephone: "01 23 45 67 95",
        tags: JSON.stringify(["noël", "fête", "convivialité", "fin d'année"]),
        createdBy: admin.id,
      },
      {
        titre: "Atelier Numérique : Initiation au Code",
        description: "Atelier d'initiation à la programmation pour débutants. Découvrez les bases du développement web et créez votre première page.",
        contenu: `Atelier d'initiation à la programmation pour les débutants complets.

**Programme :**
- Introduction à la programmation
- Les langages web (HTML, CSS, JavaScript)
- Création d'une page web simple
- Notions de responsive design
- Ressources pour continuer l'apprentissage

**Prérequis :**
- Aucun ! Cet atelier s'adresse aux débutants
- Ordinateur portable recommandé (quelques ordinateurs disponibles)

**Objectifs :**
- Comprendre les bases de la programmation web
- Créer sa première page web
- Découvrir les outils de développement
- Acquérir des bases solides pour continuer

**Matériel fourni :**
- Ordinateurs de prêt (nombre limité)
- Documentation et ressources
- Certificat de participation`,
        dateDebut: new Date('2025-01-25T14:00:00'),
        dateFin: new Date('2025-01-25T18:00:00'),
        dateAffichage: new Date('2024-08-01T00:00:00'),
        dateFinAffichage: new Date('2025-01-30T23:59:59'),
        lieu: "Salle informatique AMAKI",
        adresse: "30 rue du Numérique, 75017 Paris",
        categorie: "Formation",
        statut: "Brouillon",
        imagePrincipale: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop",
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop"
        ]),
        prix: 20,
        placesDisponibles: 12,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2025-01-20T23:59:59'),
        contactEmail: "numerique@amaki.fr",
        contactTelephone: "01 23 45 67 96",
        tags: JSON.stringify(["programmation", "web", "débutant", "numérique"]),
        createdBy: admin.id,
      },
      {
        titre: "Randonnée Nature : Forêt de Fontainebleau",
        description: "Randonnée pédestre dans la forêt de Fontainebleau. Découverte de la faune et de la flore, pique-nique en pleine nature.",
        contenu: `Randonnée pédestre dans la magnifique forêt de Fontainebleau.

**Itinéraire :**
- Départ : Gare de Fontainebleau-Avon
- Distance : 12 km
- Durée : 4 heures (avec pauses)
- Difficulté : Moyenne
- Dénivelé : 200m

**Programme :**
- 8h00 : Rendez-vous à la gare
- 8h30 : Départ de la randonnée
- 10h30 : Pause et observation de la nature
- 12h00 : Pique-nique au bord de l'étang
- 13h30 : Reprise de la randonnée
- 15h30 : Arrivée et retour en train

**Équipement nécessaire :**
- Chaussures de randonnée
- Vêtements adaptés à la météo
- Sac à dos avec eau et collations
- Appareil photo (optionnel)

**Inclus :**
- Guide nature expérimenté
- Assurance responsabilité civile
- Documentation sur la faune et flore`,
        dateDebut: new Date('2025-03-15T08:00:00'),
        dateFin: new Date('2025-03-15T16:00:00'),
        dateAffichage: new Date('2024-09-01T00:00:00'),
        dateFinAffichage: new Date('2025-03-20T23:59:59'),
        lieu: "Forêt de Fontainebleau",
        adresse: "Gare de Fontainebleau-Avon, 77300 Fontainebleau",
        categorie: "Sportif",
        statut: "Brouillon",
        imagePrincipale: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop",
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop",
          "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop"
        ]),
        prix: 15,
        placesDisponibles: 25,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2025-03-10T23:59:59'),
        contactEmail: "nature@amaki.fr",
        contactTelephone: "01 23 45 67 97",
        tags: JSON.stringify(["randonnée", "nature", "fontainebleau", "plein air"]),
        createdBy: admin.id,
      }
    ];

    // Créer les événements
    for (const evenementData of evenements) {
      const evenement = await prisma.evenement.create({
        data: evenementData,
      });
      console.log(`✅ Événement créé: ${evenement.titre}`);
    }

    console.log('🎉 Tous les événements ont été créés avec succès!');
    
    // Statistiques
    const totalEvenements = await prisma.evenement.count();
    const evenementsPublies = await prisma.evenement.count({ where: { statut: 'Publie' } });
    const evenementsBrouillons = await prisma.evenement.count({ where: { statut: 'Brouillon' } });
    
    console.log(`\n📊 Statistiques:\n================`);
    console.log(`🎉 Total événements créés: ${totalEvenements}`);
    console.log(`✅ Événements publiés: ${evenementsPublies}`);
    console.log(`📝 Événements brouillons: ${evenementsBrouillons}`);
    
    console.log('\n📅 Événements par catégorie:\n============================');
    const categoriesStats = await prisma.evenement.groupBy({
      by: ['categorie'],
      _count: { id: true },
    });
    categoriesStats.forEach(cat => console.log(`• ${cat.categorie}: ${cat._count.id} événement(s)`));
    
    console.log('\n💰 Événements par prix:\n========================');
    const prixStats = await prisma.evenement.groupBy({
      by: ['prix'],
      _count: { id: true },
    });
    prixStats.forEach(prix => console.log(`• ${prix.prix}€: ${prix._count.id} événement(s)`));
    
    console.log('\n🔍 Vous pouvez maintenant tester la gestion des événements dans l\'interface admin et la page publique.');

  } catch (error) {
    console.error('💥 Erreur fatale lors de la création des événements:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createEvenementsFixtures();
