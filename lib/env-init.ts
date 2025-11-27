/**
 * Initialisation et validation des variables d'environnement au démarrage
 * Ce fichier doit être importé au début de l'application pour valider les variables
 */

// Importer la validation des variables d'environnement
// Cela lancera une erreur si les variables sont invalides
import './env-validation';

// Exporter un message de confirmation (optionnel)
if (process.env.NODE_ENV !== 'test') {
  console.log('✅ Variables d\'environnement validées avec succès');
}

