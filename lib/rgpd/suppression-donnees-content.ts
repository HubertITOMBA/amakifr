/**
 * Contenus publics de la page /suppression-donnees (Play Store / RGPD).
 * Les durées reprises ici sont alignées sur app/confidentialite/page.tsx.
 */

export const SUPPRESSION_DONNEES_BRAND = "AMAKI";

export const SUPPRESSION_DONNEES_APP_SCOPE =
  "Cette page concerne l'application mobile AMAKI (Android, package fr.amaki.app) ainsi que le compte associé sur le site amaki.fr.";

export const SUPPRESSION_DONNEES_PROCEDURE = [
  "Indiquez l'adresse e-mail du compte AMAKI concerné via le formulaire ci-dessous.",
  "Si un compte correspondant existe, une demande est enregistrée et un e-mail de confirmation vous est envoyé.",
  "Aucune suppression n'est effectuée automatiquement : l'équipe AMAKI vérifie votre identité (contrôle du compte / échange par e-mail / confirmation de la demande).",
  "Après vérification et validation administrative, les données éligibles sont supprimées.",
  "Vous pouvez aussi vous connecter sur le site web amaki.fr ou écrire à contact@amaki.fr pour faire traiter votre demande.",
] as const;

export const SUPPRESSION_DONNEES_CATEGORIES_SUPPRIMEES = [
  "Informations de compte (nom d'affichage, e-mail, image de profil)",
  "Données d'identité et de contact adhérent (civilité, prénom, nom, téléphones, adresses) lorsqu'elles sont liées au compte",
  "Préférences et profil utilisateur",
  "Historique de connexion lié au compte",
  "Messages et communications personnelles associés au compte",
  "Jetons de session mobile / notifications push liés au compte",
  "Inscriptions aux événements liées au compte, sauf conservation légale ou comptable requise",
] as const;

export const SUPPRESSION_DONNEES_CONSERVEES = [
  "Données financières et comptables (paiements, cotisations, justificatifs) — conservation déclarée : 10 ans (obligations comptables)",
  "Données d'élections et de scrutin — conservation déclarée : indéfinie (historique et transparence associative)",
  "Logs de sécurité — conservation déclarée : 1 an",
  "Données de compte après inactivité — conservation déclarée : jusqu'à 3 ans après la dernière activité (politique de confidentialité)",
] as const;

export const SUPPRESSION_DONNEES_DELAI =
  "Délai indicatif de traitement : vérification d'identité sous 48 heures, puis suppression des données éligibles sous 30 jours après validation, sauf obligation légale contraire.";

export const SUPPRESSION_DONNEES_NO_DIRECT_DELETE =
  "L'envoi de ce formulaire ne supprime pas immédiatement un compte. Il est impossible de supprimer le compte d'un tiers via cette page publique : toute suppression nécessite une vérification d'identité préalable.";

/** Phrases minimales attendues pour les tests / Play Store. */
export const SUPPRESSION_DONNEES_REQUIRED_PHRASES = [
  SUPPRESSION_DONNEES_BRAND,
  "application mobile AMAKI",
  "fr.amaki.app",
  "vérifie votre identité",
  "30 jours",
  "10 ans",
  SUPPRESSION_DONNEES_NO_DIRECT_DELETE,
] as const;
