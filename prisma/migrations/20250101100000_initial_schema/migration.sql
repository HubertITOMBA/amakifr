-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Admin', 'Membre', 'Invite');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('Actif', 'Inactif');

-- CreateEnum
CREATE TYPE "Civilities" AS ENUM ('Monsieur', 'Madame', 'Mademoiselle', 'Partenaire');

-- CreateEnum
CREATE TYPE "TypeAdhesion" AS ENUM ('AdhesionAnnuelle', 'Renouvellement', 'Autre');

-- CreateEnum
CREATE TYPE "TypeEvenementFamilial" AS ENUM ('Naissance', 'MariageEnfant', 'DecesFamille', 'AnniversaireSalle', 'Autre');

-- CreateEnum
CREATE TYPE "TypeCotisation" AS ENUM ('Forfait', 'Assistance', 'Anniversaire', 'Adhesion');

-- CreateEnum
CREATE TYPE "MoyenPaiement" AS ENUM ('Especes', 'Cheque', 'Virement', 'CarteBancaire', 'Stripe', 'PayPal', 'GooglePay');

-- CreateEnum
CREATE TYPE "TypeTelephone" AS ENUM ('Mobile', 'Fixe', 'Professionnel');

-- CreateEnum
CREATE TYPE "StatutRelance" AS ENUM ('EnAttente', 'Envoyee', 'Relancee', 'Payee', 'Annulee');

-- CreateEnum
CREATE TYPE "TypeRelance" AS ENUM ('Email', 'SMS', 'Telephone', 'Courrier', 'Visite');

-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('Preparation', 'Ouverte', 'Cloturee', 'Annulee');

-- CreateEnum
CREATE TYPE "PositionType" AS ENUM ('President', 'VicePresident', 'Secretaire', 'ViceSecretaire', 'Tresorier', 'ViceTresorier', 'CommissaireComptes', 'MembreComiteDirecteur');

-- CreateEnum
CREATE TYPE "CandidacyStatus" AS ENUM ('EnAttente', 'Validee', 'Rejetee', 'Retiree');

-- CreateEnum
CREATE TYPE "VoteStatus" AS ENUM ('Valide', 'Invalide', 'Blanc');

-- CreateEnum
CREATE TYPE "StatutIdee" AS ENUM ('EnAttente', 'Validee', 'Rejetee', 'Bloquee', 'DevenueProjet');

-- CreateEnum
CREATE TYPE "TypeNotification" AS ENUM ('Systeme', 'Email', 'Action', 'Cotisation', 'Idee', 'Election', 'Evenement', 'Autre');

-- CreateEnum
CREATE TYPE "TypeDocument" AS ENUM ('PDF', 'Image', 'Video', 'Excel', 'Word', 'Autre');

-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('Automatique', 'Manuel');

-- CreateEnum
CREATE TYPE "TypeRessource" AS ENUM ('Salle', 'Materiel', 'Vehicule', 'Autre');

-- CreateEnum
CREATE TYPE "StatutReservation" AS ENUM ('EnAttente', 'Confirmee', 'Annulee', 'Terminee');

-- CreateTable
CREATE TABLE "postes_templates" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "libelle" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "nombreMandatsDefaut" INTEGER NOT NULL DEFAULT 1,
    "dureeMandatDefaut" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "postes_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "password" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'Membre',
    "status" "UserStatus" NOT NULL DEFAULT 'Inactif',
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "remember_token" VARCHAR(100),
    "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factor_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_confirmations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "two_factor_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adherent" (
    "id" TEXT NOT NULL,
    "civility" "Civilities" DEFAULT 'Monsieur',
    "firstname" VARCHAR(255) NOT NULL,
    "lastname" VARCHAR(255) NOT NULL,
    "dateNaissance" TIMESTAMP(3),
    "typeAdhesion" "TypeAdhesion",
    "profession" VARCHAR(255),
    "anneePromotion" VARCHAR(10),
    "centresInteret" TEXT,
    "autorisationImage" BOOLEAN NOT NULL DEFAULT false,
    "accepteCommunications" BOOLEAN NOT NULL DEFAULT true,
    "nombreEnfants" INTEGER NOT NULL DEFAULT 0,
    "evenementsFamiliaux" TEXT,
    "datePremiereAdhesion" TIMESTAMP(3),
    "fraisAdhesionPaye" BOOLEAN NOT NULL DEFAULT false,
    "datePaiementFraisAdhesion" TIMESTAMP(3),
    "estAncienAdherent" BOOLEAN NOT NULL DEFAULT false,
    "numeroPasseport" VARCHAR(50),
    "dateGenerationPasseport" TIMESTAMP(3),
    "posteTemplateId" TEXT,
    "created_at" TIMESTAMP(0),
    "updated_at" TIMESTAMP(0),
    "userId" TEXT NOT NULL,

    CONSTRAINT "adherent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_frais_adhesion" (
    "id" TEXT NOT NULL,
    "montantFraisAdhesion" DECIMAL(10,2) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "configuration_frais_adhesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adresse" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "streetnum" TEXT,
    "street1" TEXT,
    "street2" TEXT,
    "codepost" TEXT,
    "city" TEXT,
    "country" TEXT,
    "banId" VARCHAR(100),
    "label" VARCHAR(500),
    "housenumber" VARCHAR(20),
    "street" VARCHAR(200),
    "postcode" VARCHAR(10),
    "citycode" VARCHAR(10),
    "department" VARCHAR(10),
    "region" VARCHAR(100),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "score" DOUBLE PRECISION,
    "type" VARCHAR(50),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adresse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ban_address" (
    "id" TEXT NOT NULL,
    "banId" VARCHAR(100) NOT NULL,
    "label" VARCHAR(500) NOT NULL,
    "housenumber" VARCHAR(20),
    "street" VARCHAR(200),
    "postcode" VARCHAR(10) NOT NULL,
    "city" VARCHAR(200) NOT NULL,
    "citycode" VARCHAR(10) NOT NULL,
    "department" VARCHAR(10),
    "region" VARCHAR(100),
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION,
    "type" VARCHAR(50) NOT NULL,
    "metadata" JSONB,
    "searchText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ban_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotisations" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "type" "TypeCotisation" NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "dateCotisation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moyenPaiement" "MoyenPaiement" NOT NULL,
    "description" TEXT,
    "reference" VARCHAR(100),
    "statut" TEXT NOT NULL DEFAULT 'Valide',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telephones" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "numero" VARCHAR(20) NOT NULL,
    "type" "TypeTelephone" NOT NULL,
    "estPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telephones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enfants" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "prenom" VARCHAR(255) NOT NULL,
    "dateNaissance" TIMESTAMP(3),
    "age" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enfants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligations_cotisation" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "type" "TypeCotisation" NOT NULL,
    "montantAttendu" DECIMAL(10,2) NOT NULL,
    "montantPaye" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montantRestant" DECIMAL(10,2) NOT NULL,
    "dateEcheance" TIMESTAMP(3) NOT NULL,
    "periode" VARCHAR(50) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EnAttente',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "obligations_cotisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relances" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "obligationCotisationId" TEXT NOT NULL,
    "type" "TypeRelance" NOT NULL,
    "statut" "StatutRelance" NOT NULL DEFAULT 'EnAttente',
    "dateEnvoi" TIMESTAMP(3),
    "dateRelance" TIMESTAMP(3),
    "contenu" TEXT,
    "reponse" TEXT,
    "montantRappele" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elections" (
    "id" TEXT NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "ElectionStatus" NOT NULL DEFAULT 'Preparation',
    "dateOuverture" TIMESTAMP(3) NOT NULL,
    "dateCloture" TIMESTAMP(3) NOT NULL,
    "dateClotureCandidature" TIMESTAMP(3) NOT NULL,
    "dateScrutin" TIMESTAMP(3) NOT NULL,
    "nombreMandats" INTEGER NOT NULL DEFAULT 1,
    "quorumRequis" INTEGER,
    "majoriteRequis" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "elections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "type" "PositionType" NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "posteTemplateId" TEXT,
    "nombreMandats" INTEGER NOT NULL DEFAULT 1,
    "dureeMandat" INTEGER,
    "conditions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidacies" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "status" "CandidacyStatus" NOT NULL DEFAULT 'EnAttente',
    "motivation" TEXT,
    "programme" TEXT,
    "documents" TEXT,
    "valideePar" TEXT,
    "dateValidation" TIMESTAMP(3),
    "commentaires" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidacies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "candidacyId" TEXT,
    "status" "VoteStatus" NOT NULL DEFAULT 'Valide',
    "dateVote" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "types_depense" (
    "id" TEXT NOT NULL,
    "titre" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "types_depense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depenses" (
    "id" TEXT NOT NULL,
    "libelle" VARCHAR(200) NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "dateDepense" TIMESTAMP(3) NOT NULL,
    "typeDepenseId" TEXT,
    "categorie" VARCHAR(100),
    "description" TEXT,
    "justificatif" VARCHAR(500),
    "statut" TEXT NOT NULL DEFAULT 'EnAttente',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "depenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "justificatifs_depense" (
    "id" TEXT NOT NULL,
    "depenseId" TEXT NOT NULL,
    "nomFichier" VARCHAR(255) NOT NULL,
    "chemin" VARCHAR(500) NOT NULL,
    "typeMime" VARCHAR(100) NOT NULL,
    "taille" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "justificatifs_depense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "types_cotisation_mensuelle" (
    "id" TEXT NOT NULL,
    "nom" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "montant" DECIMAL(10,2) NOT NULL,
    "obligatoire" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "aBeneficiaire" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "types_cotisation_mensuelle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotisations_du_mois" (
    "id" TEXT NOT NULL,
    "periode" VARCHAR(50) NOT NULL,
    "annee" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "typeCotisationId" TEXT NOT NULL,
    "montantBase" DECIMAL(10,2) NOT NULL,
    "dateEcheance" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'Planifie',
    "adherentBeneficiaireId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotisations_du_mois_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cotisations_mensuelles" (
    "id" TEXT NOT NULL,
    "periode" VARCHAR(50) NOT NULL,
    "annee" INTEGER NOT NULL,
    "mois" INTEGER NOT NULL,
    "typeCotisationId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "montantAttendu" DECIMAL(10,2) NOT NULL,
    "montantPaye" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montantRestant" DECIMAL(10,2) NOT NULL,
    "dateEcheance" TIMESTAMP(3) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EnAttente',
    "description" TEXT,
    "cotisationDuMoisId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cotisations_mensuelles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relances_cotisation_mensuelle" (
    "id" TEXT NOT NULL,
    "cotisationMensuelleId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Email',
    "statut" TEXT NOT NULL DEFAULT 'EnAttente',
    "dateEnvoi" TIMESTAMP(3),
    "dateRelance" TIMESTAMP(3),
    "contenu" TEXT,
    "reponse" TEXT,
    "montantRappele" DECIMAL(10,2),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relances_cotisation_mensuelle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dettes_initiales" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "montantPaye" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montantRestant" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "dettes_initiales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paiements_cotisation" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moyenPaiement" "MoyenPaiement" NOT NULL,
    "reference" VARCHAR(100),
    "description" TEXT,
    "obligationCotisationId" TEXT,
    "cotisationMensuelleId" TEXT,
    "detteInitialeId" TEXT,
    "assistanceId" TEXT,
    "stripePaymentIntentId" VARCHAR(255),
    "stripeSessionId" VARCHAR(255),
    "paypalOrderId" VARCHAR(255),
    "transactionId" VARCHAR(255),
    "receiptUrl" VARCHAR(500),
    "receiptGenerated" BOOLEAN NOT NULL DEFAULT false,
    "statut" TEXT NOT NULL DEFAULT 'Valide',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paiements_cotisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avoirs" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "montantUtilise" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montantRestant" DECIMAL(10,2) NOT NULL,
    "paiementId" TEXT,
    "description" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'Disponible',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dateExpiration" TIMESTAMP(3),

    CONSTRAINT "avoirs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utilisations_avoir" (
    "id" TEXT NOT NULL,
    "avoirId" TEXT NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "cotisationMensuelleId" TEXT,
    "obligationCotisationId" TEXT,
    "detteInitialeId" TEXT,
    "assistanceId" TEXT,
    "description" TEXT,
    "dateUtilisation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisations_avoir_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistances" (
    "id" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "type" "TypeEvenementFamilial" NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    "dateEvenement" TIMESTAMP(3) NOT NULL,
    "montantPaye" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "montantRestant" DECIMAL(10,2) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EnAttente',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "assistances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evenements" (
    "id" TEXT NOT NULL,
    "titre" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "contenu" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "dateAffichage" TIMESTAMP(3) NOT NULL,
    "dateFinAffichage" TIMESTAMP(3) NOT NULL,
    "lieu" VARCHAR(200),
    "adresse" TEXT,
    "categorie" VARCHAR(50) NOT NULL DEFAULT 'General',
    "statut" TEXT NOT NULL DEFAULT 'Brouillon',
    "estPublic" BOOLEAN NOT NULL DEFAULT true,
    "imagePrincipale" VARCHAR(500),
    "images" TEXT,
    "prix" DECIMAL(10,2),
    "placesDisponibles" INTEGER,
    "placesReservees" INTEGER NOT NULL DEFAULT 0,
    "inscriptionRequis" BOOLEAN NOT NULL DEFAULT false,
    "dateLimiteInscription" TIMESTAMP(3),
    "contactEmail" VARCHAR(100),
    "contactTelephone" VARCHAR(20),
    "tags" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evenements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscriptions_evenements" (
    "id" TEXT NOT NULL,
    "evenementId" TEXT NOT NULL,
    "adherentId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EnAttente',
    "dateInscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentaires" TEXT,
    "nombrePersonnes" INTEGER NOT NULL DEFAULT 1,
    "visiteurNom" VARCHAR(255),
    "visiteurEmail" VARCHAR(255),
    "visiteurTelephone" VARCHAR(20),
    "visiteurAdresse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inscriptions_evenements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "titre" VARCHAR(200),
    "type" TEXT NOT NULL DEFAULT 'Privee',
    "evenementId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Participant',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Texte',
    "fileUrl" VARCHAR(500),
    "fileName" VARCHAR(255),
    "replyToId" TEXT,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reaction" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idees" (
    "id" TEXT NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "statut" "StatutIdee" NOT NULL DEFAULT 'EnAttente',
    "nombreCommentaires" INTEGER NOT NULL DEFAULT 0,
    "nombreApprobations" INTEGER NOT NULL DEFAULT 0,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateValidation" TIMESTAMP(3),
    "dateRejet" TIMESTAMP(3),
    "dateBlocage" TIMESTAMP(3),
    "raisonRejet" TEXT,
    "valideePar" TEXT,
    "rejeteePar" TEXT,
    "bloqueePar" TEXT,
    "estLue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "icone" VARCHAR(100) NOT NULL,
    "couleur" VARCHAR(50) NOT NULL,
    "type" "BadgeType" NOT NULL DEFAULT 'Manuel',
    "condition" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge_attributions" (
    "id" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attribuePar" TEXT,
    "raison" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commentaires_idee" (
    "id" TEXT NOT NULL,
    "ideeId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "supprime" BOOLEAN NOT NULL DEFAULT false,
    "raisonSuppression" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commentaires_idee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approbations_idee" (
    "id" TEXT NOT NULL,
    "ideeId" TEXT NOT NULL,
    "adherentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approbations_idee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TypeNotification" NOT NULL DEFAULT 'Systeme',
    "titre" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "lien" VARCHAR(500),
    "lue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adherentId" TEXT,
    "nom" VARCHAR(255) NOT NULL,
    "nomOriginal" VARCHAR(255) NOT NULL,
    "type" "TypeDocument" NOT NULL,
    "categorie" VARCHAR(100),
    "chemin" VARCHAR(500) NOT NULL,
    "taille" INTEGER NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "estPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ressources" (
    "id" TEXT NOT NULL,
    "nom" VARCHAR(255) NOT NULL,
    "type" "TypeRessource" NOT NULL,
    "description" TEXT,
    "capacite" INTEGER,
    "localisation" VARCHAR(255),
    "image" VARCHAR(500),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "reservable" BOOLEAN NOT NULL DEFAULT true,
    "horairesOuverture" TEXT,
    "tarifHoraire" DECIMAL(10,2),
    "tarifJournalier" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ressources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "ressourceId" TEXT NOT NULL,
    "adherentId" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "dureeHeures" DECIMAL(10,2),
    "statut" "StatutReservation" NOT NULL DEFAULT 'EnAttente',
    "motif" TEXT,
    "nombrePersonnes" INTEGER,
    "commentaires" TEXT,
    "visiteurNom" VARCHAR(255),
    "visiteurEmail" VARCHAR(255),
    "visiteurTelephone" VARCHAR(20),
    "confirmeePar" TEXT,
    "dateConfirmation" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_galerie" (
    "id" TEXT NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "chemin" VARCHAR(500) NOT NULL,
    "nomFichier" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "taille" INTEGER NOT NULL,
    "categorie" VARCHAR(100) NOT NULL,
    "couleur" VARCHAR(50) NOT NULL DEFAULT 'blue',
    "date" TIMESTAMP(3) NOT NULL,
    "lieu" VARCHAR(200),
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_galerie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geonames_city" (
    "id" SERIAL NOT NULL,
    "geonameId" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "asciiName" VARCHAR(200),
    "alternateNames" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "countryCode" VARCHAR(2) NOT NULL,
    "admin1Code" VARCHAR(20),
    "admin2Code" VARCHAR(80),
    "admin3Code" VARCHAR(20),
    "admin4Code" VARCHAR(20),
    "population" BIGINT,
    "elevation" INTEGER,
    "timezone" VARCHAR(40),
    "featureClass" VARCHAR(1),
    "featureCode" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geonames_city_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geonames_country" (
    "id" SERIAL NOT NULL,
    "geonameId" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "asciiName" VARCHAR(200),
    "alternateNames" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "countryCode" VARCHAR(2) NOT NULL,
    "cc2" VARCHAR(60),
    "admin1Code" VARCHAR(20),
    "admin2Code" VARCHAR(80),
    "admin3Code" VARCHAR(20),
    "admin4Code" VARCHAR(20),
    "population" BIGINT,
    "elevation" INTEGER,
    "timezone" VARCHAR(40),
    "featureClass" VARCHAR(1) NOT NULL,
    "featureCode" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geonames_country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "nameEn" VARCHAR(200),
    "nameFr" VARCHAR(200),
    "code" VARCHAR(2) NOT NULL,
    "code3" VARCHAR(3),
    "capital" VARCHAR(200),
    "region" VARCHAR(100),
    "subregion" VARCHAR(100),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "population" BIGINT,
    "area" DOUBLE PRECISION,
    "currency" VARCHAR(10),
    "currencyName" VARCHAR(100),
    "languages" TEXT,
    "timezones" TEXT,
    "flag" VARCHAR(500),
    "source" VARCHAR(50) NOT NULL DEFAULT 'carto',
    "externalId" VARCHAR(100),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "city" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "nameEn" VARCHAR(200),
    "nameFr" VARCHAR(200),
    "countryCode" VARCHAR(2) NOT NULL,
    "region" VARCHAR(100),
    "department" VARCHAR(100),
    "postalCode" VARCHAR(20),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "population" BIGINT,
    "elevation" INTEGER,
    "timezone" VARCHAR(50),
    "isCapital" BOOLEAN NOT NULL DEFAULT false,
    "isMajor" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(50) NOT NULL DEFAULT 'carto',
    "externalId" VARCHAR(100),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "city_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" VARCHAR(500),
    "category" VARCHAR(50) NOT NULL DEFAULT 'general',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "postes_templates_code_key" ON "postes_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_name_key" ON "users"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_email_token_key" ON "verification_tokens"("email", "token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_email_token_key" ON "password_reset_tokens"("email", "token");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_tokens_token_key" ON "two_factor_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_tokens_email_token_key" ON "two_factor_tokens"("email", "token");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_confirmations_userId_key" ON "two_factor_confirmations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "adherent_userId_key" ON "adherent"("userId");

-- CreateIndex
CREATE INDEX "adresse_banId_idx" ON "adresse"("banId");

-- CreateIndex
CREATE INDEX "adresse_postcode_idx" ON "adresse"("postcode");

-- CreateIndex
CREATE INDEX "adresse_citycode_idx" ON "adresse"("citycode");

-- CreateIndex
CREATE INDEX "adresse_department_idx" ON "adresse"("department");

-- CreateIndex
CREATE UNIQUE INDEX "ban_address_banId_key" ON "ban_address"("banId");

-- CreateIndex
CREATE INDEX "ban_address_postcode_idx" ON "ban_address"("postcode");

-- CreateIndex
CREATE INDEX "ban_address_citycode_idx" ON "ban_address"("citycode");

-- CreateIndex
CREATE INDEX "ban_address_department_idx" ON "ban_address"("department");

-- CreateIndex
CREATE INDEX "ban_address_city_idx" ON "ban_address"("city");

-- CreateIndex
CREATE INDEX "ban_address_street_idx" ON "ban_address"("street");

-- CreateIndex
CREATE INDEX "ban_address_searchText_idx" ON "ban_address"("searchText");

-- CreateIndex
CREATE INDEX "positions_posteTemplateId_idx" ON "positions"("posteTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "positions_electionId_type_key" ON "positions"("electionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "candidacies_electionId_positionId_adherentId_key" ON "candidacies"("electionId", "positionId", "adherentId");

-- CreateIndex
CREATE UNIQUE INDEX "votes_electionId_positionId_adherentId_key" ON "votes"("electionId", "positionId", "adherentId");

-- CreateIndex
CREATE INDEX "cotisations_du_mois_annee_idx" ON "cotisations_du_mois"("annee");

-- CreateIndex
CREATE INDEX "cotisations_du_mois_mois_idx" ON "cotisations_du_mois"("mois");

-- CreateIndex
CREATE INDEX "cotisations_du_mois_statut_idx" ON "cotisations_du_mois"("statut");

-- CreateIndex
CREATE INDEX "cotisations_du_mois_adherentBeneficiaireId_idx" ON "cotisations_du_mois"("adherentBeneficiaireId");

-- CreateIndex
CREATE INDEX "cotisations_du_mois_periode_typeCotisationId_idx" ON "cotisations_du_mois"("periode", "typeCotisationId");

-- CreateIndex
CREATE UNIQUE INDEX "cotisations_du_mois_periode_adherentBeneficiaireId_key" ON "cotisations_du_mois"("periode", "adherentBeneficiaireId");

-- CreateIndex
CREATE UNIQUE INDEX "cotisations_mensuelles_periode_typeCotisationId_adherentId_key" ON "cotisations_mensuelles"("periode", "typeCotisationId", "adherentId");

-- CreateIndex
CREATE UNIQUE INDEX "dettes_initiales_adherentId_annee_key" ON "dettes_initiales"("adherentId", "annee");

-- CreateIndex
CREATE UNIQUE INDEX "paiements_cotisation_stripePaymentIntentId_key" ON "paiements_cotisation"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "paiements_cotisation_stripeSessionId_key" ON "paiements_cotisation"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "paiements_cotisation_paypalOrderId_key" ON "paiements_cotisation"("paypalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "paiements_cotisation_transactionId_key" ON "paiements_cotisation"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "avoirs_paiementId_key" ON "avoirs"("paiementId");

-- CreateIndex
CREATE INDEX "avoirs_adherentId_idx" ON "avoirs"("adherentId");

-- CreateIndex
CREATE INDEX "avoirs_statut_idx" ON "avoirs"("statut");

-- CreateIndex
CREATE INDEX "utilisations_avoir_avoirId_idx" ON "utilisations_avoir"("avoirId");

-- CreateIndex
CREATE INDEX "inscriptions_evenements_evenementId_adherentId_idx" ON "inscriptions_evenements"("evenementId", "adherentId");

-- CreateIndex
CREATE INDEX "inscriptions_evenements_evenementId_visiteurEmail_idx" ON "inscriptions_evenements"("evenementId", "visiteurEmail");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversationId_userId_key" ON "conversation_participants"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_userId_idx" ON "messages"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_messageId_userId_reaction_key" ON "message_reactions"("messageId", "userId", "reaction");

-- CreateIndex
CREATE INDEX "idees_adherentId_idx" ON "idees"("adherentId");

-- CreateIndex
CREATE INDEX "idees_statut_idx" ON "idees"("statut");

-- CreateIndex
CREATE INDEX "idees_dateCreation_idx" ON "idees"("dateCreation");

-- CreateIndex
CREATE INDEX "badges_type_idx" ON "badges"("type");

-- CreateIndex
CREATE INDEX "badges_actif_idx" ON "badges"("actif");

-- CreateIndex
CREATE INDEX "badge_attributions_userId_idx" ON "badge_attributions"("userId");

-- CreateIndex
CREATE INDEX "badge_attributions_badgeId_idx" ON "badge_attributions"("badgeId");

-- CreateIndex
CREATE INDEX "badge_attributions_createdAt_idx" ON "badge_attributions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "badge_attributions_badgeId_userId_key" ON "badge_attributions"("badgeId", "userId");

-- CreateIndex
CREATE INDEX "commentaires_idee_ideeId_idx" ON "commentaires_idee"("ideeId");

-- CreateIndex
CREATE INDEX "commentaires_idee_adherentId_idx" ON "commentaires_idee"("adherentId");

-- CreateIndex
CREATE INDEX "approbations_idee_ideeId_idx" ON "approbations_idee"("ideeId");

-- CreateIndex
CREATE INDEX "approbations_idee_adherentId_idx" ON "approbations_idee"("adherentId");

-- CreateIndex
CREATE UNIQUE INDEX "approbations_idee_ideeId_adherentId_key" ON "approbations_idee"("ideeId", "adherentId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_lue_idx" ON "notifications"("lue");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "documents_userId_idx" ON "documents"("userId");

-- CreateIndex
CREATE INDEX "documents_adherentId_idx" ON "documents"("adherentId");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "documents_createdAt_idx" ON "documents"("createdAt");

-- CreateIndex
CREATE INDEX "reservations_ressourceId_dateDebut_dateFin_idx" ON "reservations"("ressourceId", "dateDebut", "dateFin");

-- CreateIndex
CREATE INDEX "reservations_adherentId_idx" ON "reservations"("adherentId");

-- CreateIndex
CREATE INDEX "reservations_statut_idx" ON "reservations"("statut");

-- CreateIndex
CREATE INDEX "media_galerie_categorie_idx" ON "media_galerie"("categorie");

-- CreateIndex
CREATE INDEX "media_galerie_type_idx" ON "media_galerie"("type");

-- CreateIndex
CREATE INDEX "media_galerie_actif_idx" ON "media_galerie"("actif");

-- CreateIndex
CREATE INDEX "media_galerie_ordre_idx" ON "media_galerie"("ordre");

-- CreateIndex
CREATE INDEX "media_galerie_date_idx" ON "media_galerie"("date");

-- CreateIndex
CREATE UNIQUE INDEX "geonames_city_geonameId_key" ON "geonames_city"("geonameId");

-- CreateIndex
CREATE INDEX "geonames_city_countryCode_idx" ON "geonames_city"("countryCode");

-- CreateIndex
CREATE INDEX "geonames_city_name_idx" ON "geonames_city"("name");

-- CreateIndex
CREATE INDEX "geonames_city_asciiName_idx" ON "geonames_city"("asciiName");

-- CreateIndex
CREATE INDEX "geonames_city_countryCode_name_idx" ON "geonames_city"("countryCode", "name");

-- CreateIndex
CREATE UNIQUE INDEX "geonames_country_geonameId_key" ON "geonames_country"("geonameId");

-- CreateIndex
CREATE UNIQUE INDEX "geonames_country_countryCode_key" ON "geonames_country"("countryCode");

-- CreateIndex
CREATE INDEX "geonames_country_countryCode_idx" ON "geonames_country"("countryCode");

-- CreateIndex
CREATE INDEX "geonames_country_name_idx" ON "geonames_country"("name");

-- CreateIndex
CREATE INDEX "geonames_country_asciiName_idx" ON "geonames_country"("asciiName");

-- CreateIndex
CREATE INDEX "geonames_country_featureClass_featureCode_idx" ON "geonames_country"("featureClass", "featureCode");

-- CreateIndex
CREATE UNIQUE INDEX "country_code_key" ON "country"("code");

-- CreateIndex
CREATE INDEX "country_code_idx" ON "country"("code");

-- CreateIndex
CREATE INDEX "country_name_idx" ON "country"("name");

-- CreateIndex
CREATE INDEX "country_nameFr_idx" ON "country"("nameFr");

-- CreateIndex
CREATE INDEX "country_region_idx" ON "country"("region");

-- CreateIndex
CREATE INDEX "country_source_idx" ON "country"("source");

-- CreateIndex
CREATE INDEX "city_countryCode_idx" ON "city"("countryCode");

-- CreateIndex
CREATE INDEX "city_name_idx" ON "city"("name");

-- CreateIndex
CREATE INDEX "city_nameFr_idx" ON "city"("nameFr");

-- CreateIndex
CREATE INDEX "city_countryCode_name_idx" ON "city"("countryCode", "name");

-- CreateIndex
CREATE INDEX "city_postalCode_idx" ON "city"("postalCode");

-- CreateIndex
CREATE INDEX "city_region_idx" ON "city"("region");

-- CreateIndex
CREATE INDEX "city_source_idx" ON "city"("source");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- CreateIndex
CREATE INDEX "app_settings_key_idx" ON "app_settings"("key");

-- CreateIndex
CREATE INDEX "app_settings_category_idx" ON "app_settings"("category");

-- AddForeignKey
ALTER TABLE "postes_templates" ADD CONSTRAINT "postes_templates_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_confirmations" ADD CONSTRAINT "two_factor_confirmations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adherent" ADD CONSTRAINT "adherent_posteTemplateId_fkey" FOREIGN KEY ("posteTemplateId") REFERENCES "postes_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adherent" ADD CONSTRAINT "adherent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_frais_adhesion" ADD CONSTRAINT "configuration_frais_adhesion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adresse" ADD CONSTRAINT "adresse_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotisations" ADD CONSTRAINT "cotisations_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telephones" ADD CONSTRAINT "telephones_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enfants" ADD CONSTRAINT "enfants_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligations_cotisation" ADD CONSTRAINT "obligations_cotisation_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances" ADD CONSTRAINT "relances_obligationCotisationId_fkey" FOREIGN KEY ("obligationCotisationId") REFERENCES "obligations_cotisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_posteTemplateId_fkey" FOREIGN KEY ("posteTemplateId") REFERENCES "postes_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidacies" ADD CONSTRAINT "candidacies_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidacies" ADD CONSTRAINT "candidacies_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidacies" ADD CONSTRAINT "candidacies_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "elections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_candidacyId_fkey" FOREIGN KEY ("candidacyId") REFERENCES "candidacies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "types_depense" ADD CONSTRAINT "types_depense_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_typeDepenseId_fkey" FOREIGN KEY ("typeDepenseId") REFERENCES "types_depense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificatifs_depense" ADD CONSTRAINT "justificatifs_depense_depenseId_fkey" FOREIGN KEY ("depenseId") REFERENCES "depenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "justificatifs_depense" ADD CONSTRAINT "justificatifs_depense_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "types_cotisation_mensuelle" ADD CONSTRAINT "types_cotisation_mensuelle_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotisations_du_mois" ADD CONSTRAINT "cotisations_du_mois_typeCotisationId_fkey" FOREIGN KEY ("typeCotisationId") REFERENCES "types_cotisation_mensuelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotisations_du_mois" ADD CONSTRAINT "cotisations_du_mois_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotisations_du_mois" ADD CONSTRAINT "cotisations_du_mois_adherentBeneficiaireId_fkey" FOREIGN KEY ("adherentBeneficiaireId") REFERENCES "adherent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotisations_mensuelles" ADD CONSTRAINT "cotisations_mensuelles_typeCotisationId_fkey" FOREIGN KEY ("typeCotisationId") REFERENCES "types_cotisation_mensuelle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotisations_mensuelles" ADD CONSTRAINT "cotisations_mensuelles_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotisations_mensuelles" ADD CONSTRAINT "cotisations_mensuelles_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotisations_mensuelles" ADD CONSTRAINT "cotisations_mensuelles_cotisationDuMoisId_fkey" FOREIGN KEY ("cotisationDuMoisId") REFERENCES "cotisations_du_mois"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances_cotisation_mensuelle" ADD CONSTRAINT "relances_cotisation_mensuelle_cotisationMensuelleId_fkey" FOREIGN KEY ("cotisationMensuelleId") REFERENCES "cotisations_mensuelles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances_cotisation_mensuelle" ADD CONSTRAINT "relances_cotisation_mensuelle_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relances_cotisation_mensuelle" ADD CONSTRAINT "relances_cotisation_mensuelle_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dettes_initiales" ADD CONSTRAINT "dettes_initiales_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dettes_initiales" ADD CONSTRAINT "dettes_initiales_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_cotisation" ADD CONSTRAINT "paiements_cotisation_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_cotisation" ADD CONSTRAINT "paiements_cotisation_obligationCotisationId_fkey" FOREIGN KEY ("obligationCotisationId") REFERENCES "obligations_cotisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_cotisation" ADD CONSTRAINT "paiements_cotisation_cotisationMensuelleId_fkey" FOREIGN KEY ("cotisationMensuelleId") REFERENCES "cotisations_mensuelles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_cotisation" ADD CONSTRAINT "paiements_cotisation_detteInitialeId_fkey" FOREIGN KEY ("detteInitialeId") REFERENCES "dettes_initiales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_cotisation" ADD CONSTRAINT "paiements_cotisation_assistanceId_fkey" FOREIGN KEY ("assistanceId") REFERENCES "assistances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements_cotisation" ADD CONSTRAINT "paiements_cotisation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avoirs" ADD CONSTRAINT "avoirs_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avoirs" ADD CONSTRAINT "avoirs_paiementId_fkey" FOREIGN KEY ("paiementId") REFERENCES "paiements_cotisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisations_avoir" ADD CONSTRAINT "utilisations_avoir_avoirId_fkey" FOREIGN KEY ("avoirId") REFERENCES "avoirs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisations_avoir" ADD CONSTRAINT "utilisations_avoir_cotisationMensuelleId_fkey" FOREIGN KEY ("cotisationMensuelleId") REFERENCES "cotisations_mensuelles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisations_avoir" ADD CONSTRAINT "utilisations_avoir_obligationCotisationId_fkey" FOREIGN KEY ("obligationCotisationId") REFERENCES "obligations_cotisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisations_avoir" ADD CONSTRAINT "utilisations_avoir_detteInitialeId_fkey" FOREIGN KEY ("detteInitialeId") REFERENCES "dettes_initiales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utilisations_avoir" ADD CONSTRAINT "utilisations_avoir_assistanceId_fkey" FOREIGN KEY ("assistanceId") REFERENCES "assistances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistances" ADD CONSTRAINT "assistances_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistances" ADD CONSTRAINT "assistances_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions_evenements" ADD CONSTRAINT "inscriptions_evenements_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "evenements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscriptions_evenements" ADD CONSTRAINT "inscriptions_evenements_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_evenementId_fkey" FOREIGN KEY ("evenementId") REFERENCES "evenements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idees" ADD CONSTRAINT "idees_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_attributions" ADD CONSTRAINT "badge_attributions_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge_attributions" ADD CONSTRAINT "badge_attributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaires_idee" ADD CONSTRAINT "commentaires_idee_ideeId_fkey" FOREIGN KEY ("ideeId") REFERENCES "idees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentaires_idee" ADD CONSTRAINT "commentaires_idee_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approbations_idee" ADD CONSTRAINT "approbations_idee_ideeId_fkey" FOREIGN KEY ("ideeId") REFERENCES "idees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approbations_idee" ADD CONSTRAINT "approbations_idee_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ressources" ADD CONSTRAINT "ressources_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_ressourceId_fkey" FOREIGN KEY ("ressourceId") REFERENCES "ressources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_adherentId_fkey" FOREIGN KEY ("adherentId") REFERENCES "adherent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_confirmeePar_fkey" FOREIGN KEY ("confirmeePar") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_galerie" ADD CONSTRAINT "media_galerie_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
