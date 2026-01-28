#!/bin/bash
# Script de sauvegarde et restauration de la base de données PostgreSQL amakifr
# Gère les contraintes circulaires (comme messages.replyToId)

set -e  # Arrêter en cas d'erreur

# Configuration par défaut
DB_USER="${DB_USER:-hubert}"
DB_NAME="${DB_NAME:-amakifr}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'aide
show_help() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

Commandes disponibles:
  backup          Créer une sauvegarde de la base de données
  restore         Restaurer une sauvegarde
  list            Lister les sauvegardes disponibles
  clean           Nettoyer les anciennes sauvegardes (garde les 10 plus récentes)

Options:
  -u, --user USER         Utilisateur PostgreSQL (défaut: hubert)
  -d, --database DB       Nom de la base de données (défaut: amakifr)
  -f, --file FILE         Fichier de sauvegarde à restaurer
  -t, --type TYPE         Type de dump: complete, custom, data-only (défaut: complete)
  -b, --backup-dir DIR    Répertoire de sauvegarde (défaut: ./backups)
  -h, --help              Afficher cette aide

Exemples:
  # Créer une sauvegarde complète
  $0 backup

  # Créer une sauvegarde custom (binaire, plus compacte)
  $0 backup -t custom

  # Lister les sauvegardes disponibles
  $0 list

  # Restaurer une sauvegarde complète
  $0 restore -f backups/amakifr_complete_20260128_123456.sql

  # Restaurer une sauvegarde custom
  $0 restore -f backups/amakifr_custom_20260128_123456.dump

  # Nettoyer les anciennes sauvegardes
  $0 clean

EOF
}

# Fonction pour créer une sauvegarde
backup_database() {
    local dump_type="${1:-complete}"
    
    # Créer le répertoire de sauvegarde s'il n'existe pas
    mkdir -p "$BACKUP_DIR"
    
    echo -e "${BLUE}🔄 Début de la sauvegarde de la base de données $DB_NAME...${NC}"
    
    case "$dump_type" in
        complete)
            BACKUP_FILE="$BACKUP_DIR/amakifr_complete_${TIMESTAMP}.sql"
            echo -e "${BLUE}📦 Création du dump complet (recommandé)...${NC}"
            if pg_dump -U "$DB_USER" -F p "$DB_NAME" > "$BACKUP_FILE" 2>&1; then
                echo -e "${GREEN}✅ Dump complet créé : $BACKUP_FILE${NC}"
            else
                echo -e "${RED}❌ Erreur lors de la création du dump complet${NC}"
                exit 1
            fi
            ;;
        custom)
            BACKUP_FILE="$BACKUP_DIR/amakifr_custom_${TIMESTAMP}.dump"
            echo -e "${BLUE}📦 Création du dump custom (format binaire, plus compact)...${NC}"
            if pg_dump -U "$DB_USER" -F c -f "$BACKUP_FILE" "$DB_NAME" 2>&1; then
                echo -e "${GREEN}✅ Dump custom créé : $BACKUP_FILE${NC}"
            else
                echo -e "${RED}❌ Erreur lors de la création du dump custom${NC}"
                exit 1
            fi
            ;;
        data-only)
            BACKUP_FILE="$BACKUP_DIR/amakifr_data_${TIMESTAMP}.sql"
            echo -e "${YELLOW}⚠️  Création du dump data-only (peut avoir des avertissements sur contraintes circulaires)...${NC}"
            if pg_dump -U "$DB_USER" --data-only "$DB_NAME" > "$BACKUP_FILE" 2>&1; then
                echo -e "${GREEN}✅ Dump data-only créé : $BACKUP_FILE${NC}"
                echo -e "${YELLOW}ℹ️  Pour restaurer ce dump, utilisez : psql -U $DB_USER -d $DB_NAME --set=session_replication_role=replica < $BACKUP_FILE${NC}"
            else
                echo -e "${RED}❌ Erreur lors de la création du dump data-only${NC}"
                exit 1
            fi
            ;;
        *)
            echo -e "${RED}❌ Type de dump invalide : $dump_type${NC}"
            echo "Types valides : complete, custom, data-only"
            exit 1
            ;;
    esac
    
    # Afficher la taille du fichier
    if [ -f "$BACKUP_FILE" ]; then
        FILE_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
        echo -e "${GREEN}📊 Taille de la sauvegarde : $FILE_SIZE${NC}"
    fi
    
    echo -e "${GREEN}✅ Sauvegarde terminée avec succès !${NC}"
}

# Fonction pour restaurer une sauvegarde
restore_database() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        echo -e "${RED}❌ Erreur : Fichier de sauvegarde non spécifié${NC}"
        echo "Utilisez : $0 restore -f <fichier>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}❌ Erreur : Fichier de sauvegarde introuvable : $backup_file${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}⚠️  ATTENTION : Cette opération va écraser la base de données $DB_NAME !${NC}"
    read -p "Êtes-vous sûr de vouloir continuer ? (oui/non) " -r
    if [[ ! $REPLY =~ ^[Oo][Uu][Ii]$ ]]; then
        echo "Opération annulée."
        exit 0
    fi
    
    echo -e "${BLUE}🔄 Début de la restauration depuis : $backup_file${NC}"
    
    # Détecter le type de fichier
    if [[ "$backup_file" == *.dump ]] || [[ "$backup_file" == *.custom ]]; then
        # Format custom (binaire)
        echo -e "${BLUE}📥 Restauration d'un dump custom...${NC}"
        if pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists "$backup_file" 2>&1; then
            echo -e "${GREEN}✅ Restauration terminée avec succès !${NC}"
        else
            echo -e "${RED}❌ Erreur lors de la restauration${NC}"
            exit 1
        fi
    elif [[ "$backup_file" == *data*.sql ]]; then
        # Format data-only (nécessite de désactiver les triggers)
        echo -e "${BLUE}📥 Restauration d'un dump data-only (avec gestion des contraintes circulaires)...${NC}"
        if psql -U "$DB_USER" -d "$DB_NAME" --set=session_replication_role=replica -f "$backup_file" 2>&1; then
            echo -e "${GREEN}✅ Restauration terminée avec succès !${NC}"
        else
            echo -e "${RED}❌ Erreur lors de la restauration${NC}"
            exit 1
        fi
    else
        # Format SQL complet
        echo -e "${BLUE}📥 Restauration d'un dump SQL complet...${NC}"
        if psql -U "$DB_USER" -d "$DB_NAME" -f "$backup_file" 2>&1; then
            echo -e "${GREEN}✅ Restauration terminée avec succès !${NC}"
        else
            echo -e "${RED}❌ Erreur lors de la restauration${NC}"
            exit 1
        fi
    fi
}

# Fonction pour lister les sauvegardes
list_backups() {
    echo -e "${BLUE}📋 Sauvegardes disponibles dans $BACKUP_DIR :${NC}"
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        echo -e "${YELLOW}⚠️  Aucune sauvegarde trouvée dans $BACKUP_DIR${NC}"
        return
    fi
    
    # Lister les fichiers par type
    echo -e "${GREEN}Dumps complets (SQL):${NC}"
    ls -lh "$BACKUP_DIR"/amakifr_complete_*.sql 2>/dev/null | awk '{printf "  %s %s %s\n", $6, $7, $9}' || echo "  Aucun"
    
    echo ""
    echo -e "${GREEN}Dumps custom (binaire):${NC}"
    ls -lh "$BACKUP_DIR"/amakifr_custom_*.dump 2>/dev/null | awk '{printf "  %s %s %s\n", $6, $7, $9}' || echo "  Aucun"
    
    echo ""
    echo -e "${GREEN}Dumps data-only:${NC}"
    ls -lh "$BACKUP_DIR"/amakifr_data_*.sql 2>/dev/null | awk '{printf "  %s %s %s\n", $6, $7, $9}' || echo "  Aucun"
    
    echo ""
    echo -e "${BLUE}💡 Pour restaurer une sauvegarde : $0 restore -f <fichier>${NC}"
}

# Fonction pour nettoyer les anciennes sauvegardes
clean_backups() {
    echo -e "${BLUE}🧹 Nettoyage des anciennes sauvegardes (garde les 10 plus récentes)...${NC}"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        echo -e "${YELLOW}⚠️  Répertoire de sauvegarde introuvable : $BACKUP_DIR${NC}"
        return
    fi
    
    # Garder les 10 plus récentes de chaque type
    local kept=0
    local deleted=0
    
    # Dumps complets
    local complete_count=$(ls -1 "$BACKUP_DIR"/amakifr_complete_*.sql 2>/dev/null | wc -l)
    if [ "$complete_count" -gt 10 ]; then
        local to_delete=$((complete_count - 10))
        ls -t "$BACKUP_DIR"/amakifr_complete_*.sql 2>/dev/null | tail -n "$to_delete" | while read file; do
            rm -f "$file"
            deleted=$((deleted + 1))
            echo -e "${YELLOW}  Supprimé : $(basename $file)${NC}"
        done
        kept=$((kept + 10))
    else
        kept=$((kept + complete_count))
    fi
    
    # Dumps custom
    local custom_count=$(ls -1 "$BACKUP_DIR"/amakifr_custom_*.dump 2>/dev/null | wc -l)
    if [ "$custom_count" -gt 10 ]; then
        local to_delete=$((custom_count - 10))
        ls -t "$BACKUP_DIR"/amakifr_custom_*.dump 2>/dev/null | tail -n "$to_delete" | while read file; do
            rm -f "$file"
            deleted=$((deleted + 1))
            echo -e "${YELLOW}  Supprimé : $(basename $file)${NC}"
        done
        kept=$((kept + 10))
    else
        kept=$((kept + custom_count))
    fi
    
    # Dumps data-only
    local data_count=$(ls -1 "$BACKUP_DIR"/amakifr_data_*.sql 2>/dev/null | wc -l)
    if [ "$data_count" -gt 10 ]; then
        local to_delete=$((data_count - 10))
        ls -t "$BACKUP_DIR"/amakifr_data_*.sql 2>/dev/null | tail -n "$to_delete" | while read file; do
            rm -f "$file"
            deleted=$((deleted + 1))
            echo -e "${YELLOW}  Supprimé : $(basename $file)${NC}"
        done
        kept=$((kept + 10))
    else
        kept=$((kept + data_count))
    fi
    
    echo -e "${GREEN}✅ Nettoyage terminé : $kept sauvegarde(s) conservée(s), $deleted supprimée(s)${NC}"
}

# Parser les arguments
COMMAND=""
DUMP_TYPE="complete"
BACKUP_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        backup|restore|list|clean)
            COMMAND="$1"
            shift
            ;;
        -u|--user)
            DB_USER="$2"
            shift 2
            ;;
        -d|--database)
            DB_NAME="$2"
            shift 2
            ;;
        -f|--file)
            BACKUP_FILE="$2"
            shift 2
            ;;
        -t|--type)
            DUMP_TYPE="$2"
            shift 2
            ;;
        -b|--backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Option inconnue : $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Exécuter la commande
case "$COMMAND" in
    backup)
        backup_database "$DUMP_TYPE"
        ;;
    restore)
        restore_database "$BACKUP_FILE"
        ;;
    list)
        list_backups
        ;;
    clean)
        clean_backups
        ;;
    "")
        echo -e "${RED}❌ Erreur : Commande non spécifiée${NC}"
        echo ""
        show_help
        exit 1
        ;;
    *)
        echo -e "${RED}❌ Commande inconnue : $COMMAND${NC}"
        show_help
        exit 1
        ;;
esac
