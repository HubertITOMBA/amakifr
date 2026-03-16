#!/bin/bash
# Script de sauvegarde et restauration de la base de données PostgreSQL amakifr
# - Sauvegarde complète ou tables au choix ; restauration globale ou par tables.
# - Fichiers horodatés ; en production le répertoire par défaut est /sites/backup.
# Gère les contraintes circulaires (comme messages.replyToId)

set -e  # Arrêter en cas d'erreur

# Configuration par défaut
# En production : utiliser /sites/backup si le répertoire existe, sinon ./backups
DB_USER="${DB_USER:-hubert}"
DB_NAME="${DB_NAME:-amakifr}"
if [ -z "$BACKUP_DIR" ]; then
    if [ -d /sites/backup ] && [ -w /sites/backup ] 2>/dev/null; then
        BACKUP_DIR="/sites/backup"
    else
        BACKUP_DIR="./backups"
    fi
fi
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Connexion : utiliser DATABASE_URL si défini, sinon -U et -d
psql_conn() {
    if [ -n "$DATABASE_URL" ]; then
        psql "$DATABASE_URL" "$@"
    else
        psql -U "$DB_USER" -d "$DB_NAME" "$@"
    fi
}
pg_dump_conn() {
    if [ -n "$DATABASE_URL" ]; then
        pg_dump "$DATABASE_URL" "$@"
    else
        pg_dump -U "$DB_USER" -d "$DB_NAME" "$@"
    fi
}
pg_restore_conn() {
    if [ -n "$DATABASE_URL" ]; then
        pg_restore "$DATABASE_URL" "$@"
    else
        pg_restore -U "$DB_USER" -d "$DB_NAME" "$@"
    fi
}

# Fonction d'aide
show_help() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

Commandes disponibles:
  backup          Créer une sauvegarde de la base de données
  restore         Restaurer une sauvegarde (globale ou tables choisies)
  list            Lister les sauvegardes disponibles
  list-tables     Lister les tables contenues dans un fichier de sauvegarde (format custom)
  clean           Nettoyer les anciennes sauvegardes (garde les 10 plus récentes)

Options:
  -u, --user USER         Utilisateur PostgreSQL (défaut: hubert)
  -d, --database DB       Nom de la base de données (défaut: amakifr)
  -f, --file FILE         Fichier de sauvegarde à restaurer
  -t, --type TYPE         Type de dump: complete, custom, data-only, non-empty, tables (défaut: complete)
  -T, --tables T1,T2,...   Sauvegarder ou restaurer uniquement ces tables (backup -t tables ou restore)
  -b, --backup-dir DIR    Répertoire de sauvegarde (défaut: ./backups ou /sites/backup en prod)
  -h, --help              Afficher cette aide

  Connexion: définir DATABASE_URL pour utiliser une URL (ex. production), sinon -u et -d.

Types de dump:
  complete    Dump complet (schéma + données), format SQL. Fichiers horodatés.
  custom      Dump complet, format binaire (permet restauration par table).
  data-only   Données uniquement, format SQL.
  non-empty   Uniquement les tables non vides (schéma + données), format custom.
  tables      Uniquement les tables listées avec -T (schéma + données), format custom.

Exemples:
  # Créer une sauvegarde complète (toutes les tables, fichier horodaté)
  $0 backup

  # Sauvegarder uniquement certaines tables
  $0 backup -t tables -T "adherent,users,paiements_cotisation"

  # Sauvegarder uniquement les tables non vides
  $0 backup -t non-empty

  # Lister les sauvegardes disponibles
  $0 list

  # Restaurer une sauvegarde complète (global)
  $0 restore -f backups/amakifr_complete_20260128_123456.sql

  # Restaurer uniquement certaines tables (fichier custom ou non-empty)
  $0 restore -f backups/amakifr_nonempty_20260128_123456.dump -T "User,adherent,cotisation"

  # Lister les tables d'un fichier de sauvegarde
  $0 list-tables -f backups/amakifr_nonempty_20260128_123456.dump

  # Nettoyer les anciennes sauvegardes
  $0 clean

EOF
}

# Fonction pour créer une sauvegarde
backup_database() {
    local dump_type="${1:-complete}"
    local tables_list="$2"
    
    # Créer le répertoire de sauvegarde s'il n'existe pas
    mkdir -p "$BACKUP_DIR"
    
    local db_label="${DB_NAME:-base (DATABASE_URL)}"
    echo -e "${BLUE}🔄 Début de la sauvegarde de la base de données ${db_label}...${NC}"
    
    case "$dump_type" in
        complete)
            BACKUP_FILE="$BACKUP_DIR/amakifr_complete_${TIMESTAMP}.sql"
            echo -e "${BLUE}📦 Création du dump complet (recommandé)...${NC}"
            if pg_dump_conn -F p > "$BACKUP_FILE" 2>&1; then
                echo -e "${GREEN}✅ Dump complet créé : $BACKUP_FILE${NC}"
            else
                echo -e "${RED}❌ Erreur lors de la création du dump complet${NC}"
                exit 1
            fi
            ;;
        custom)
            BACKUP_FILE="$BACKUP_DIR/amakifr_custom_${TIMESTAMP}.dump"
            echo -e "${BLUE}📦 Création du dump custom (format binaire, plus compact)...${NC}"
            if pg_dump_conn -F c -f "$BACKUP_FILE" 2>&1; then
                echo -e "${GREEN}✅ Dump custom créé : $BACKUP_FILE${NC}"
            else
                echo -e "${RED}❌ Erreur lors de la création du dump custom${NC}"
                exit 1
            fi
            ;;
        data-only)
            BACKUP_FILE="$BACKUP_DIR/amakifr_data_${TIMESTAMP}.sql"
            echo -e "${YELLOW}⚠️  Création du dump data-only (peut avoir des avertissements sur contraintes circulaires)...${NC}"
            if pg_dump_conn --data-only > "$BACKUP_FILE" 2>&1; then
                echo -e "${GREEN}✅ Dump data-only créé : $BACKUP_FILE${NC}"
                echo -e "${YELLOW}ℹ️  Pour restaurer : psql ... --set=session_replication_role=replica < $BACKUP_FILE${NC}"
            else
                echo -e "${RED}❌ Erreur lors de la création du dump data-only${NC}"
                exit 1
            fi
            ;;
        non-empty)
            BACKUP_FILE="$BACKUP_DIR/amakifr_nonempty_${TIMESTAMP}.dump"
            echo -e "${BLUE}📦 Sauvegarde des tables non vides uniquement...${NC}"
            local dump_tables=()
            while IFS= read -r tab; do
                [ -z "$tab" ] && continue
                local cnt
                cnt=$(psql_conn -t -A -c "SELECT count(*) FROM public.\"$tab\"" 2>/dev/null) || \
                cnt=$(psql_conn -t -A -c "SELECT count(*) FROM public.$tab" 2>/dev/null) || cnt=0
                if [ -n "$cnt" ] && [ "${cnt:-0}" -gt 0 ]; then
                    dump_tables+=(-t "public.\"$tab\"")
                fi
            done < <(psql_conn -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
            if [ ${#dump_tables[@]} -eq 0 ]; then
                echo -e "${YELLOW}⚠️  Aucune table non vide trouvée.${NC}"
                exit 0
            fi
            echo -e "${BLUE}   ${#dump_tables[@]} table(s) non vide(s) à sauvegarder.${NC}"
            if pg_dump_conn -F c "${dump_tables[@]}" -f "$BACKUP_FILE" 2>&1; then
                echo -e "${GREEN}✅ Dump tables non vides créé : $BACKUP_FILE${NC}"
            else
                echo -e "${RED}❌ Erreur lors de la création du dump non-empty${NC}"
                exit 1
            fi
            ;;
        tables)
            if [ -z "$tables_list" ]; then
                echo -e "${RED}❌ Type 'tables' nécessite l'option -T table1,table2,...${NC}"
                echo "Exemple : $0 backup -t tables -T \"adherent,users,paiements_cotisation\""
                exit 1
            fi
            BACKUP_FILE="$BACKUP_DIR/amakifr_tables_${TIMESTAMP}.dump"
            echo -e "${BLUE}📦 Sauvegarde des tables : $tables_list${NC}"
            local dump_tables=()
            IFS=',' read -ra TABARR <<< "$tables_list"
            for t in "${TABARR[@]}"; do
                t=$(echo "$t" | xargs)
                [ -z "$t" ] && continue
                dump_tables+=(-t "public.$t")
            done
            if [ ${#dump_tables[@]} -eq 0 ]; then
                echo -e "${RED}❌ Aucune table valide dans -T${NC}"
                exit 1
            fi
            if pg_dump_conn -F c "${dump_tables[@]}" -f "$BACKUP_FILE" 2>&1; then
                echo -e "${GREEN}✅ Dump tables créé : $BACKUP_FILE${NC}"
            else
                echo -e "${RED}❌ Erreur lors du dump tables${NC}"
                exit 1
            fi
            ;;
        *)
            echo -e "${RED}❌ Type de dump invalide : $dump_type${NC}"
            echo "Types valides : complete, custom, data-only, non-empty, tables"
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
    local tables_opt="$2"
    
    if [ -z "$backup_file" ]; then
        echo -e "${RED}❌ Erreur : Fichier de sauvegarde non spécifié${NC}"
        echo "Utilisez : $0 restore -f <fichier>"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}❌ Erreur : Fichier de sauvegarde introuvable : $backup_file${NC}"
        exit 1
    fi
    
    local db_label="${DB_NAME:-base (DATABASE_URL)}"
    echo -e "${YELLOW}⚠️  ATTENTION : Cette opération va modifier la base de données ${db_label} !${NC}"
    if [ -n "$tables_opt" ]; then
        echo -e "${YELLOW}   Tables à restaurer : $tables_opt${NC}"
    fi
    read -p "Êtes-vous sûr de vouloir continuer ? (oui/non) " -r
    if [[ ! $REPLY =~ ^[Oo][Uu][Ii]$ ]]; then
        echo "Opération annulée."
        exit 0
    fi
    
    echo -e "${BLUE}🔄 Début de la restauration depuis : $backup_file${NC}"
    
    # Détecter le type de fichier
    if [[ "$backup_file" == *.dump ]] || [[ "$backup_file" == *.custom ]]; then
        # Format custom (binaire) : restauration globale ou par table(s)
        local restore_opts=(--clean --if-exists)
        if [ -n "$tables_opt" ]; then
            local t
            while IFS=',' read -ra TABLIST; do
                for t in "${TABLIST[@]}"; do
                    t=$(echo "$t" | xargs)
                    [ -z "$t" ] && continue
                    restore_opts+=(-t "$t")
                done
            done <<< "$tables_opt"
        fi
        restore_opts+=("$backup_file")
        echo -e "${BLUE}📥 Restauration d'un dump custom...${NC}"
        if pg_restore_conn "${restore_opts[@]}" 2>&1; then
            echo -e "${GREEN}✅ Restauration terminée avec succès !${NC}"
        else
            echo -e "${RED}❌ Erreur lors de la restauration${NC}"
            exit 1
        fi
    elif [[ "$backup_file" == *data*.sql ]]; then
        # Format data-only (nécessite de désactiver les triggers)
        if [ -n "$tables_opt" ]; then
            echo -e "${YELLOW}ℹ️  Option -T/--tables ignorée pour un dump SQL data-only (restauration globale).${NC}"
        fi
        echo -e "${BLUE}📥 Restauration d'un dump data-only (avec gestion des contraintes circulaires)...${NC}"
        if psql_conn --set=session_replication_role=replica -f "$backup_file" 2>&1; then
            echo -e "${GREEN}✅ Restauration terminée avec succès !${NC}"
        else
            echo -e "${RED}❌ Erreur lors de la restauration${NC}"
            exit 1
        fi
    else
        # Format SQL complet
        if [ -n "$tables_opt" ]; then
            echo -e "${YELLOW}ℹ️  Option -T/--tables ignorée pour un dump SQL complet (restauration globale).${NC}"
        fi
        echo -e "${BLUE}📥 Restauration d'un dump SQL complet...${NC}"
        if psql_conn -f "$backup_file" 2>&1; then
            echo -e "${GREEN}✅ Restauration terminée avec succès !${NC}"
        else
            echo -e "${RED}❌ Erreur lors de la restauration${NC}"
            exit 1
        fi
    fi
}

# Lister les tables contenues dans un fichier de sauvegarde (format custom)
list_tables_backup() {
    local backup_file="$1"
    if [ -z "$backup_file" ]; then
        echo -e "${RED}❌ Erreur : Fichier de sauvegarde non spécifié (-f <fichier>)${NC}"
        exit 1
    fi
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}❌ Fichier introuvable : $backup_file${NC}"
        exit 1
    fi
    if [[ "$backup_file" != *.dump ]] && [[ "$backup_file" != *.custom ]]; then
        echo -e "${YELLOW}⚠️  Seuls les fichiers .dump/.custom (format custom) supportent la liste des tables.${NC}"
        exit 1
    fi
    echo -e "${BLUE}📋 Tables dans la sauvegarde : $backup_file${NC}"
    echo ""
    pg_restore -l "$backup_file" 2>/dev/null | grep "TABLE DATA" | sed 's/.*TABLE DATA public /  - /' | sed 's/ .*//' || echo "  (impossible de lire la liste)"
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
    echo -e "${GREEN}Dumps tables non vides (custom):${NC}"
    ls -lh "$BACKUP_DIR"/amakifr_nonempty_*.dump 2>/dev/null | awk '{printf "  %s %s %s\n", $6, $7, $9}' || echo "  Aucun"
    
    echo ""
    echo -e "${GREEN}Dumps tables au choix (custom):${NC}"
    ls -lh "$BACKUP_DIR"/amakifr_tables_*.dump 2>/dev/null | awk '{printf "  %s %s %s\n", $6, $7, $9}' || echo "  Aucun"
    
    echo ""
    echo -e "${BLUE}💡 Restaurer : $0 restore -f <fichier>${NC}"
    echo -e "${BLUE}💡 Restaurer des tables choisies : $0 restore -f <fichier.dump> -T \"table1,table2\"${NC}"
    echo -e "${BLUE}💡 Lister les tables d'un dump : $0 list-tables -f <fichier.dump>${NC}"
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
    
    # Dumps non-empty
    local nonempty_count=$(ls -1 "$BACKUP_DIR"/amakifr_nonempty_*.dump 2>/dev/null | wc -l)
    if [ "$nonempty_count" -gt 10 ]; then
        local to_delete=$((nonempty_count - 10))
        ls -t "$BACKUP_DIR"/amakifr_nonempty_*.dump 2>/dev/null | tail -n "$to_delete" | while read file; do
            rm -f "$file"
            deleted=$((deleted + 1))
            echo -e "${YELLOW}  Supprimé : $(basename $file)${NC}"
        done
        kept=$((kept + 10))
    else
        kept=$((kept + nonempty_count))
    fi
    
    # Dumps tables au choix
    local tables_count=$(ls -1 "$BACKUP_DIR"/amakifr_tables_*.dump 2>/dev/null | wc -l)
    if [ "$tables_count" -gt 10 ]; then
        local to_delete=$((tables_count - 10))
        ls -t "$BACKUP_DIR"/amakifr_tables_*.dump 2>/dev/null | tail -n "$to_delete" | while read file; do
            rm -f "$file"
            deleted=$((deleted + 1))
            echo -e "${YELLOW}  Supprimé : $(basename $file)${NC}"
        done
        kept=$((kept + 10))
    else
        kept=$((kept + tables_count))
    fi
    
    echo -e "${GREEN}✅ Nettoyage terminé : $kept sauvegarde(s) conservée(s), $deleted supprimée(s)${NC}"
}

# Parser les arguments
COMMAND=""
DUMP_TYPE="complete"
BACKUP_FILE=""
RESTORE_TABLES=""

while [[ $# -gt 0 ]]; do
    case $1 in
        backup|restore|list|clean|list-tables)
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
        -T|--tables)
            RESTORE_TABLES="$2"
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
        backup_database "$DUMP_TYPE" "$RESTORE_TABLES"
        ;;
    restore)
        restore_database "$BACKUP_FILE" "$RESTORE_TABLES"
        ;;
    list)
        list_backups
        ;;
    list-tables)
        list_tables_backup "$BACKUP_FILE"
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
