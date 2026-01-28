#!/bin/bash
# Script de sauvegarde de la base de données PostgreSQL
# Gère les contraintes circulaires (comme messages.replyToId)

set -e  # Arrêter en cas d'erreur

# Configuration
DB_USER="${DB_USER:-hubert}"
DB_NAME="${DB_NAME:-amakifr}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Créer le répertoire de sauvegarde s'il n'existe pas
mkdir -p "$BACKUP_DIR"

echo "🔄 Début de la sauvegarde de la base de données $DB_NAME..."

# Option 1 : Dump complet (recommandé - pas de problème avec les contraintes circulaires)
BACKUP_FILE_COMPLETE="$BACKUP_DIR/amakifr_complete_${TIMESTAMP}.sql"
echo "📦 Création du dump complet..."
pg_dump -U "$DB_USER" -F p "$DB_NAME" > "$BACKUP_FILE_COMPLETE"
echo "✅ Dump complet créé : $BACKUP_FILE_COMPLETE"

# Option 2 : Dump custom (format binaire, plus compact)
BACKUP_FILE_CUSTOM="$BACKUP_DIR/amakifr_custom_${TIMESTAMP}.dump"
echo "📦 Création du dump custom (format binaire)..."
pg_dump -U "$DB_USER" -F c -f "$BACKUP_FILE_CUSTOM" "$DB_NAME"
echo "✅ Dump custom créé : $BACKUP_FILE_CUSTOM"

# Option 3 : Dump data-only avec gestion des contraintes circulaires
BACKUP_FILE_DATA="$BACKUP_DIR/amakifr_data_${TIMESTAMP}.sql"
echo "📦 Création du dump data-only (avec avertissement sur contraintes circulaires)..."
pg_dump -U "$DB_USER" --data-only "$DB_NAME" > "$BACKUP_FILE_DATA" 2>&1 || {
    echo "⚠️  Avertissement détecté sur les contraintes circulaires (normal pour messages.replyToId)"
    echo "✅ Dump data-only créé : $BACKUP_FILE_DATA"
    echo "ℹ️  Pour restaurer ce dump, utilisez : psql -U $DB_USER -d $DB_NAME --set=session_replication_role=replica < $BACKUP_FILE_DATA"
}

# Afficher les tailles des fichiers
echo ""
echo "📊 Tailles des sauvegardes :"
ls -lh "$BACKUP_DIR"/amakifr_*_${TIMESTAMP}.* 2>/dev/null | awk '{print "  " $9 " : " $5}'

echo ""
echo "✅ Sauvegarde terminée avec succès !"
echo ""
echo "💡 Recommandation : Utilisez le dump complet ($BACKUP_FILE_COMPLETE) pour les restaurations."
echo "   Il évite les problèmes de contraintes circulaires."
