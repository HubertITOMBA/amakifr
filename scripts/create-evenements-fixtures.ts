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
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
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
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
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
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
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
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
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
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
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
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
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
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
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
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
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
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
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
      },
      {
        titre: "Séminaire : Leadership et Gestion d'Équipe",
        description: "Formation approfondie sur le leadership et la gestion d'équipe dans le contexte associatif et professionnel.",
        contenu: `Séminaire intensif de deux jours sur le leadership et la gestion d'équipe.

**Jour 1 :**
- Les bases du leadership
- Styles de management
- Communication efficace
- Motivation des équipes

**Jour 2 :**
- Gestion des conflits
- Prise de décision collective
- Animation de réunions
- Ateliers pratiques`,
        dateDebut: new Date('2024-05-10T09:00:00'),
        dateFin: new Date('2024-05-11T17:00:00'),
        dateAffichage: new Date('2024-01-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Centre de formation Paris",
        adresse: "45 avenue des Leaders, 75008 Paris",
        categorie: "Formation",
        statut: "Publie",
        imagePrincipale: "/ressources/atelier/Atelier_Afri1.png",
        prix: 75,
        placesDisponibles: 30,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-05-05T23:59:59'),
        contactEmail: "formation@amaki.fr",
        contactTelephone: "01 23 45 67 98",
        tags: JSON.stringify(["leadership", "management", "séminaire", "formation"]),
        createdBy: admin.id,
      },
      {
        titre: "Festival Culturel : Nuit Africaine",
        description: "Grande soirée culturelle africaine avec spectacles, danse, musique et cuisine traditionnelle.",
        contenu: `Une nuit magique dédiée à la culture africaine !

**Programme :**
- 18h00 : Accueil et marché artisanal
- 19h00 : Spectacle de danse traditionnelle
- 20h00 : Concert de musique live
- 21h30 : Buffet de spécialités africaines
- 22h30 : Soirée dansante
- 00h00 : Fin de la soirée

**Artistes :**
- Troupe de danseurs professionnels
- Groupe de musique percussion
- Chanteurs traditionnels`,
        dateDebut: new Date('2024-07-28T18:00:00'),
        dateFin: new Date('2024-07-29T00:00:00'),
        dateAffichage: new Date('2024-02-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Parc des Expositions",
        adresse: "Porte de Versailles, 75015 Paris",
        categorie: "Culturel",
        statut: "Publie",
        imagePrincipale: "/ressources/atelier/Atelier_Afri2.jpeg",
        prix: 20,
        placesDisponibles: 300,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-07-25T23:59:59'),
        contactEmail: "culture@amaki.fr",
        contactTelephone: "01 23 45 67 99",
        tags: JSON.stringify(["festival", "afrique", "culture", "soirée"]),
        createdBy: admin.id,
      },
      {
        titre: "Marathon Solidaire AMAKI",
        description: "Marathon caritatif pour soutenir nos actions. Plusieurs distances proposées : 5km, 10km, semi-marathon et marathon.",
        contenu: `Marathon solidaire pour récolter des fonds pour les actions de l'association.

**Distances :**
- 5km : Débutants et familles
- 10km : Confirmés
- Semi-marathon (21km) : Sportifs
- Marathon (42km) : Experts

**Programme :**
- 7h00 : Ouverture des inscriptions
- 8h00 : Départ 5km et 10km
- 9h00 : Départ semi-marathon
- 10h00 : Départ marathon
- 14h00 : Remise des médailles
- 15h00 : Buffet de récupération

**Inclus :**
- Médaille pour tous les finishers
- T-shirt technique
- Ravitaillements
- Massages de récupération`,
        dateDebut: new Date('2024-09-22T07:00:00'),
        dateFin: new Date('2024-09-22T16:00:00'),
        dateAffichage: new Date('2024-04-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Bois de Vincennes",
        adresse: "Route de la Pyramide, 75012 Paris",
        categorie: "Sportif",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&h=600&fit=crop",
        prix: 25,
        placesDisponibles: 500,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-09-18T23:59:59'),
        contactEmail: "sport@amaki.fr",
        contactTelephone: "01 23 45 68 00",
        tags: JSON.stringify(["marathon", "course", "sport", "solidarité"]),
        createdBy: admin.id,
      },
      {
        titre: "Atelier Photo : Portrait et Lightroom",
        description: "Apprenez les techniques de portrait et le traitement d'images avec Lightroom. Matériel fourni.",
        contenu: `Atelier photo pour apprendre les techniques de portrait et le post-traitement.

**Programme :**
- 9h00 : Introduction à la photo de portrait
- 10h00 : Techniques de composition
- 11h00 : Gestion de la lumière naturelle
- 12h00 : Pause déjeuner
- 13h30 : Introduction à Lightroom
- 15h00 : Post-traitement de vos photos
- 16h30 : Critique et conseils

**Matériel fourni :**
- Appareils photo reflex (si besoin)
- Ordinateurs avec Lightroom
- Modèles pour la pratique`,
        dateDebut: new Date('2024-08-17T09:00:00'),
        dateFin: new Date('2024-08-17T17:00:00'),
        dateAffichage: new Date('2024-03-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Studio Photo AMAKI",
        adresse: "18 rue de la Photo, 75019 Paris",
        categorie: "Formation",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1516035069371-29a1b244b32a?w=800&h=600&fit=crop",
        prix: 40,
        placesDisponibles: 8,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-08-12T23:59:59'),
        contactEmail: "formation@amaki.fr",
        contactTelephone: "01 23 45 68 01",
        tags: JSON.stringify(["photo", "portrait", "lightroom", "atelier"]),
        createdBy: admin.id,
      },
      {
        titre: "Pique-nique Familial au Parc",
        description: "Grand pique-nique convivial pour tous les membres et leurs familles. Jeux pour enfants et animations.",
        contenu: `Grand pique-nique familial au parc pour se retrouver dans une ambiance conviviale.

**Activités :**
- Jeux pour enfants (course en sac, jeux de ballon)
- Concours de pétanque
- Ateliers créatifs
- Promenades à pied ou à vélo
- Animations musicales

**Repas :**
Chacun apporte un plat à partager (prévoir liste pour éviter les doublons)

**Inclus :**
- Tables et bancs mis à disposition
- Espace jeux sécurisé pour enfants
- Organisation et coordination`,
        dateDebut: new Date('2024-06-30T12:00:00'),
        dateFin: new Date('2024-06-30T18:00:00'),
        dateAffichage: new Date('2024-01-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Parc de la Villette",
        adresse: "211 avenue Jean Jaurès, 75019 Paris",
        categorie: "Social",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop",
        prix: 0,
        placesDisponibles: 100,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-06-25T23:59:59'),
        contactEmail: "social@amaki.fr",
        contactTelephone: "01 23 45 68 02",
        tags: JSON.stringify(["pique-nique", "famille", "convivialité", "parc"]),
        createdBy: admin.id,
      },
      {
        titre: "Exposition : Art Contemporain Africain",
        description: "Exposition temporaire d'art contemporain africain avec visites guidées et rencontres avec les artistes.",
        contenu: `Exposition exceptionnelle d'art contemporain africain.

**Artistes exposés :**
- Amara Diouf (Sénégal) - Peinture
- Kofi Mensah (Ghana) - Sculpture
- Awa Diallo (Mali) - Installation
- Youssef Benslimane (Maroc) - Photographie

**Programme :**
- Exposition permanente du 1er au 30 juillet
- Visites guidées tous les samedis à 15h
- Rencontres avec artistes le 15 juillet à 18h
- Conférence sur l'art africain le 22 juillet à 19h

**Tarifs :**
- Entrée libre pour les membres
- 5€ pour les non-membres`,
        dateDebut: new Date('2024-07-01T10:00:00'),
        dateFin: new Date('2024-07-30T18:00:00'),
        dateAffichage: new Date('2024-02-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Galerie AMAKI",
        adresse: "5 rue des Arts, 75003 Paris",
        categorie: "Culturel",
        statut: "Publie",
        imagePrincipale: "/ressources/atelier/Atelier_Afri3.jpeg",
        prix: 5,
        placesDisponibles: 50,
        inscriptionRequis: false,
        contactEmail: "culture@amaki.fr",
        contactTelephone: "01 23 45 68 03",
        tags: JSON.stringify(["exposition", "art", "contemporain", "afrique"]),
        createdBy: admin.id,
      },
      {
        titre: "Cours de Salsa et Bachata",
        description: "Cours de danse latino-américaine pour débutants et intermédiaires. Session de 8 semaines.",
        contenu: `Cours de danse latino-américaine sur 8 semaines.

**Programme :**
- Semaines 1-2 : Bases de la salsa
- Semaines 3-4 : Bases de la bachata
- Semaines 5-6 : Figures et enchaînements
- Semaines 7-8 : Chorégraphie finale

**Horaires :**
- Mardi 19h-20h : Niveau débutant
- Jeudi 19h-20h : Niveau intermédiaire

**Inclus :**
- 16 heures de cours
- Soirée dansante de clôture
- Certificat de participation`,
        dateDebut: new Date('2024-09-03T19:00:00'),
        dateFin: new Date('2024-10-24T20:00:00'),
        dateAffichage: new Date('2024-04-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Salle de danse AMAKI",
        adresse: "22 rue de la Danse, 75020 Paris",
        categorie: "Culturel",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&h=600&fit=crop",
        prix: 60,
        placesDisponibles: 20,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-08-28T23:59:59'),
        contactEmail: "culture@amaki.fr",
        contactTelephone: "01 23 45 68 04",
        tags: JSON.stringify(["danse", "salsa", "bachata", "latin"]),
        createdBy: admin.id,
      },
      {
        titre: "Salon de l'Emploi et de l'Entrepreneuriat",
        description: "Salon dédié à l'emploi et à l'entrepreneuriat avec stands d'entreprises, conférences et ateliers CV.",
        contenu: `Salon professionnel pour l'emploi et l'entrepreneuriat.

**Programme :**
- 9h00 : Ouverture du salon
- 10h00 : Conférence "Créer son entreprise en 2024"
- 11h00 : Atelier "Optimiser son CV"
- 14h00 : Table ronde "L'entrepreneuriat en Afrique"
- 15h30 : Atelier "Entretien d'embauche"
- 16h30 : Networking

**Stands :**
- 20 entreprises recrutent
- 10 incubateurs présents
- Services de coaching
- Espace CV et conseils`,
        dateDebut: new Date('2024-10-12T09:00:00'),
        dateFin: new Date('2024-10-12T18:00:00'),
        dateAffichage: new Date('2024-05-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Palais des Congrès",
        adresse: "Place de la Porte Maillot, 75017 Paris",
        categorie: "Formation",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop",
        prix: 0,
        placesDisponibles: 500,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-10-08T23:59:59'),
        contactEmail: "emploi@amaki.fr",
        contactTelephone: "01 23 45 68 05",
        tags: JSON.stringify(["emploi", "entrepreneuriat", "salon", "carrière"]),
        createdBy: admin.id,
      },
      {
        titre: "Tournoi de Basket 3x3",
        description: "Tournoi de basket 3 contre 3 pour tous les niveaux. Équipes mixtes encouragées.",
        contenu: `Tournoi de basket-ball 3x3 mixte.

**Règles :**
- Format 3 contre 3
- Matchs de 10 minutes
- Équipes de 4 joueurs max (1 remplaçant)
- Mixte recommandé (min 1 fille/garçon)

**Programme :**
- 9h00 : Accueil et inscriptions
- 9h30 : Début des matchs de poules
- 12h00 : Pause déjeuner
- 13h30 : Phase finale
- 15h30 : Finale
- 16h00 : Remise des prix

**Prix :**
- 1er : Coupe + 150€
- 2ème : Médaille + 75€
- 3ème : Médaille + 50€`,
        dateDebut: new Date('2024-08-24T09:00:00'),
        dateFin: new Date('2024-08-24T17:00:00'),
        dateAffichage: new Date('2024-03-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Gymnase municipal",
        adresse: "15 rue du Sport, 75013 Paris",
        categorie: "Sportif",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=600&fit=crop",
        prix: 12,
        placesDisponibles: 32,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-08-20T23:59:59'),
        contactEmail: "sport@amaki.fr",
        contactTelephone: "01 23 45 68 06",
        tags: JSON.stringify(["basket", "tournoi", "sport", "3x3"]),
        createdBy: admin.id,
      },
      {
        titre: "Atelier Bien-être : Yoga et Méditation",
        description: "Atelier de yoga et méditation pour se détendre et retrouver l'équilibre. Tous niveaux.",
        contenu: `Atelier de bien-être autour du yoga et de la méditation.

**Programme :**
- 10h00 : Accueil et introduction
- 10h30 : Session de yoga (1h)
- 11h30 : Pause
- 12h00 : Session de méditation (30min)
- 12h30 : Échanges et questions
- 13h00 : Fin de l'atelier

**Matériel fourni :**
- Tapis de yoga
- Coussins de méditation
- Couvertures

**Prévoir :**
- Tenue confortable
- Bouteille d'eau`,
        dateDebut: new Date('2024-11-10T10:00:00'),
        dateFin: new Date('2024-11-10T13:00:00'),
        dateAffichage: new Date('2024-06-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Espace Bien-être AMAKI",
        adresse: "28 rue de la Sérénité, 75010 Paris",
        categorie: "Social",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=600&fit=crop",
        prix: 18,
        placesDisponibles: 15,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-11-05T23:59:59'),
        contactEmail: "bienetre@amaki.fr",
        contactTelephone: "01 23 45 68 07",
        tags: JSON.stringify(["yoga", "méditation", "bien-être", "détente"]),
        createdBy: admin.id,
      },
      {
        titre: "Conférence : Histoire et Culture de l'Afrique",
        description: "Cycle de conférences sur l'histoire et la culture de l'Afrique. Quatre séances mensuelles.",
        contenu: `Cycle de conférences sur l'histoire et la culture de l'Afrique.

**Séances :**
1. Histoire précoloniale (5 septembre)
2. Période coloniale (3 octobre)
3. Indépendances et post-colonisation (7 novembre)
4. Afrique contemporaine (5 décembre)

**Intervenants :**
- Pr. Amadou Diallo, historien
- Dr. Fatou Diop, anthropologue
- M. Koffi Mensah, politologue

**Format :**
- Conférence : 1h30
- Débat : 30min
- Questions du public : 30min`,
        dateDebut: new Date('2024-09-05T18:00:00'),
        dateFin: new Date('2024-12-05T20:00:00'),
        dateAffichage: new Date('2024-04-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Amphithéâtre de l'Université",
        adresse: "Campus universitaire, 75005 Paris",
        categorie: "Formation",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop",
        prix: 0,
        placesDisponibles: 150,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-09-01T23:59:59'),
        contactEmail: "conferences@amaki.fr",
        contactTelephone: "01 23 45 68 08",
        tags: JSON.stringify(["conférence", "histoire", "afrique", "culture"]),
        createdBy: admin.id,
      },
      {
        titre: "Soirée Cinéma : Projection de Films Africains",
        description: "Projection de films africains suivie d'un débat avec les réalisateurs. Sélection de films primés.",
        contenu: `Soirée cinéma dédiée au cinéma africain.

**Programme :**
- 19h00 : Accueil et apéritif
- 19h30 : Projection du premier film (90min)
- 21h00 : Pause et échange
- 21h30 : Projection du deuxième film (90min)
- 23h00 : Débat avec les réalisateurs
- 23h30 : Fin de soirée

**Films projetés :**
- "Félicité" d'Alain Gomis
- "Atlantique" de Mati Diop
- Court-métrages de jeunes réalisateurs

**Tarifs :**
- 8€ pour les membres
- 12€ pour les non-membres`,
        dateDebut: new Date('2024-10-26T19:00:00'),
        dateFin: new Date('2024-10-26T23:30:00'),
        dateAffichage: new Date('2024-05-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Cinéma Le Reflet",
        adresse: "12 boulevard du Cinéma, 75011 Paris",
        categorie: "Culturel",
        statut: "Publie",
        imagePrincipale: "/ressources/atelier/Atelier_Afri4.jpeg",
        prix: 8,
        placesDisponibles: 120,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-10-22T23:59:59'),
        contactEmail: "culture@amaki.fr",
        contactTelephone: "01 23 45 68 09",
        tags: JSON.stringify(["cinéma", "afrique", "projection", "débat"]),
        createdBy: admin.id,
      },
      {
        titre: "Formation : Premiers Secours",
        description: "Formation aux gestes de premiers secours et à l'utilisation du défibrillateur. Certificat délivré.",
        contenu: `Formation aux premiers secours certifiée.

**Programme :**
- Les gestes qui sauvent
- Massage cardiaque et défibrillateur
- Position latérale de sécurité
- Hémorragies et plaies
- Brûlures et traumatismes
- Malaise et perte de conscience

**Certification :**
Certificat de compétence délivré (valable 2 ans)

**Durée :** 7 heures
**Effectif :** Maximum 12 personnes`,
        dateDebut: new Date('2024-08-31T09:00:00'),
        dateFin: new Date('2024-08-31T17:00:00'),
        dateAffichage: new Date('2024-03-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Centre de formation AMAKI",
        adresse: "15 rue de la Formation, 75012 Paris",
        categorie: "Formation",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=600&fit=crop",
        prix: 45,
        placesDisponibles: 12,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-08-26T23:59:59'),
        contactEmail: "formation@amaki.fr",
        contactTelephone: "01 23 45 68 10",
        tags: JSON.stringify(["premiers secours", "santé", "formation", "certificat"]),
        createdBy: admin.id,
      },
      {
        titre: "Excursion : Château de Versailles",
        description: "Visite guidée du Château de Versailles et des jardins. Transport inclus.",
        contenu: `Excursion d'une journée au Château de Versailles.

**Programme :**
- 8h00 : Départ en bus depuis Paris
- 9h30 : Arrivée à Versailles
- 10h00 : Visite guidée du Château
- 12h00 : Pause déjeuner libre
- 13h30 : Visite des jardins
- 15h00 : Temps libre
- 16h30 : Retour en bus
- 18h00 : Arrivée à Paris

**Inclus :**
- Transport aller-retour
- Entrée au Château
- Visite guidée
- Guide conférencier

**Non inclus :**
- Déjeuner`,
        dateDebut: new Date('2024-09-14T08:00:00'),
        dateFin: new Date('2024-09-14T18:00:00'),
        dateAffichage: new Date('2024-04-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Château de Versailles",
        adresse: "Place d'Armes, 78000 Versailles",
        categorie: "Culturel",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1534398079543-9ae39c3ddc41?w=800&h=600&fit=crop",
        prix: 35,
        placesDisponibles: 40,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-09-10T23:59:59'),
        contactEmail: "culture@amaki.fr",
        contactTelephone: "01 23 45 68 11",
        tags: JSON.stringify(["excursion", "versailles", "château", "culture"]),
        createdBy: admin.id,
      },
      {
        titre: "Stage de Théâtre : Expression Scénique",
        description: "Stage intensif de théâtre sur un week-end. Découverte de l'expression scénique et du jeu d'acteur.",
        contenu: `Stage de théâtre intensif sur deux jours.

**Samedi :**
- 10h00 : Échauffement corporel
- 11h00 : Exercices de voix
- 14h00 : Techniques d'improvisation
- 16h00 : Travail de scènes

**Dimanche :**
- 10h00 : Répétition générale
- 14h00 : Représentation devant public
- 16h00 : Retour et bilan

**Objectifs :**
- Développer la confiance en soi
- Apprendre l'expression scénique
- Découvrir le jeu d'acteur
- Présenter un spectacle`,
        dateDebut: new Date('2024-11-16T10:00:00'),
        dateFin: new Date('2024-11-17T17:00:00'),
        dateAffichage: new Date('2024-06-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Théâtre AMAKI",
        adresse: "8 rue de la Scène, 75018 Paris",
        categorie: "Culturel",
        statut: "Brouillon",
        imagePrincipale: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop",
        prix: 55,
        placesDisponibles: 12,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-11-11T23:59:59'),
        contactEmail: "culture@amaki.fr",
        contactTelephone: "01 23 45 68 12",
        tags: JSON.stringify(["théâtre", "stage", "expression", "scénique"]),
        createdBy: admin.id,
      },
      {
        titre: "Cours de Langues : Swahili Débutant",
        description: "Cours de swahili pour débutants. Session de 10 semaines avec professeur natif.",
        contenu: `Cours de swahili pour débutants complets.

**Programme :**
- Semaines 1-2 : Alphabet et prononciation
- Semaines 3-4 : Salutations et présentations
- Semaines 5-6 : Vocabulaire de base
- Semaines 7-8 : Grammaire simple
- Semaines 9-10 : Conversation élémentaire

**Horaires :**
Samedi 10h-12h

**Inclus :**
- 20 heures de cours
- Manuel de cours
- Supports audio
- Attestation de participation

**Professeur :** Natif swahili avec certification`,
        dateDebut: new Date('2024-10-05T10:00:00'),
        dateFin: new Date('2024-12-07T12:00:00'),
        dateAffichage: new Date('2024-05-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Salle de cours AMAKI",
        adresse: "32 rue des Langues, 75009 Paris",
        categorie: "Formation",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=600&fit=crop",
        prix: 80,
        placesDisponibles: 15,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-10-01T23:59:59'),
        contactEmail: "formation@amaki.fr",
        contactTelephone: "01 23 45 68 13",
        tags: JSON.stringify(["langue", "swahili", "cours", "apprentissage"]),
        createdBy: admin.id,
      },
      {
        titre: "Atelier Cuisine : Pâtisserie Française",
        description: "Apprenez à réaliser les classiques de la pâtisserie française : éclairs, tarte au citron, profiteroles.",
        contenu: `Atelier pâtisserie française traditionnelle.

**Recettes du jour :**
- Éclairs au chocolat
- Tarte au citron meringuée
- Profiteroles à la vanille

**Programme :**
- 14h00 : Introduction et matériel
- 14h30 : Réalisation des pâtes
- 15h30 : Création des crèmes
- 16h30 : Montage et décoration
- 17h30 : Dégustation
- 18h00 : Fin de l'atelier

**Inclus :**
- Tous les ingrédients
- Tablier et matériel
- Recettes détaillées
- Boîte pour emporter`,
        dateDebut: new Date('2024-11-02T14:00:00'),
        dateFin: new Date('2024-11-02T18:00:00'),
        dateAffichage: new Date('2024-06-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Cuisine pédagogique AMAKI",
        adresse: "12 rue de la Gastronomie, 75014 Paris",
        categorie: "Social",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&h=600&fit=crop",
        prix: 30,
        placesDisponibles: 12,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-10-28T23:59:59'),
        contactEmail: "cuisine@amaki.fr",
        contactTelephone: "01 23 45 68 14",
        tags: JSON.stringify(["cuisine", "pâtisserie", "française", "atelier"]),
        createdBy: admin.id,
      },
      {
        titre: "Tournoi d'Échecs AMAKI",
        description: "Tournoi d'échecs ouvert à tous les niveaux. Format suisse sur 5 rondes.",
        contenu: `Tournoi d'échecs pour tous les niveaux.

**Format :**
- Système suisse (5 rondes)
- Rythme : 15 min + 5 sec par coup
- Classement par catégorie

**Catégories :**
- Débutants (< 1200)
- Intermédiaires (1200-1600)
- Confirmés (> 1600)

**Programme :**
- 9h00 : Accueil et inscriptions
- 9h30 : Ronde 1
- 10h30 : Ronde 2
- 11h30 : Pause
- 12h00 : Ronde 3
- 13h00 : Pause déjeuner
- 14h30 : Ronde 4
- 15h30 : Ronde 5
- 16h30 : Remise des prix

**Prix :**
- 1er de chaque catégorie : Trophée + 100€
- 2ème : Médaille + 50€
- 3ème : Médaille + 25€`,
        dateDebut: new Date('2024-10-19T09:00:00'),
        dateFin: new Date('2024-10-19T17:00:00'),
        dateAffichage: new Date('2024-05-15T00:00:00'),
        dateFinAffichage: new Date('2025-12-15T23:59:59'),
        lieu: "Salle polyvalente",
        adresse: "7 rue du Jeu, 75016 Paris",
        categorie: "Sportif",
        statut: "Publie",
        imagePrincipale: "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&h=600&fit=crop",
        prix: 8,
        placesDisponibles: 30,
        inscriptionRequis: true,
        dateLimiteInscription: new Date('2024-10-15T23:59:59'),
        contactEmail: "sport@amaki.fr",
        contactTelephone: "01 23 45 68 15",
        tags: JSON.stringify(["échecs", "tournoi", "jeu", "stratégie"]),
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
