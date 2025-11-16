#!/bin/bash

# Script de déploiement en production pour AMAKI France
# Usage: ./scripts/deploy-production.sh

set -e  # Arrête le script en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérification que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    error "Ce script doit être exécuté depuis la racine du projet"
    exit 1
fi

info "🚀 Début du déploiement en production..."

# 1. Vérification de l'environnement
info "🔍 Vérification de l'environnement..."
if [ -z "$DATABASE_URL" ]; then
    error "La variable DATABASE_URL n'est pas définie"
    exit 1
fi

# 2. Sauvegarde de la base de données
info "📦 Création de la sauvegarde de la base de données..."
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"

# Extraction des informations de connexion depuis DATABASE_URL
# Format: postgresql://user:password@host:port/database
DB_URL=$DATABASE_URL

# Création de la sauvegarde
if command -v pg_dump &> /dev/null; then
    pg_dump "$DB_URL" > "$BACKUP_FILE" 2>/dev/null || {
        warning "Impossible de créer la sauvegarde avec pg_dump"
        warning "Assurez-vous que pg_dump est installé et que DATABASE_URL est correct"
        read -p "Continuer sans sauvegarde? (non recommandé) [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Déploiement annulé"
            exit 1
        fi
    }
    success "Sauvegarde créée: $BACKUP_FILE"
else
    warning "pg_dump n'est pas installé. Impossible de créer une sauvegarde automatique."
    warning "Veuillez créer une sauvegarde manuellement avant de continuer."
    read -p "Avez-vous créé une sauvegarde manuelle? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Déploiement annulé. Créez d'abord une sauvegarde."
        exit 1
    fi
fi

# 3. Vérification de l'état des migrations
info "🔍 Vérification de l'état des migrations..."
npx prisma migrate status || {
    error "Erreur lors de la vérification des migrations"
    exit 1
}

# 4. Installation des dépendances
info "📦 Installation des dépendances..."
npm install || {
    error "Erreur lors de l'installation des dépendances"
    exit 1
}
success "Dépendances installées"

# 5. Application des migrations Prisma
info "🔄 Application des migrations Prisma..."
warning "Cette étape va modifier la structure de la base de données"
read -p "Continuer? [y/N]: " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "Déploiement annulé"
    exit 1
fi

npx prisma migrate deploy || {
    error "Erreur lors de l'application des migrations"
    error "La base de données peut être dans un état incohérent"
    error "Restaurez la sauvegarde: psql \$DATABASE_URL < $BACKUP_FILE"
    exit 1
}
success "Migrations appliquées"

# 6. Génération du Prisma Client
info "⚙️ Génération du Prisma Client..."
npx prisma generate || {
    error "Erreur lors de la génération du Prisma Client"
    exit 1
}
success "Prisma Client généré"

# 7. Build de l'application
info "🏗️ Build de l'application Next.js..."
npm run build || {
    error "Erreur lors du build de l'application"
    exit 1
}
success "Application buildée"

# 8. Vérification finale
info "🔍 Vérification finale..."
npx prisma migrate status || {
    warning "Vérification des migrations échouée, mais le déploiement est terminé"
}

# 9. Instructions pour le redémarrage
success "✅ Déploiement terminé avec succès!"
echo ""
info "📝 Prochaines étapes:"
echo "   1. Redémarrez votre application:"
echo "      - PM2: pm2 restart amakifr"
echo "      - systemd: systemctl restart amakifr"
echo "      - Docker: docker-compose restart"
echo ""
echo "   2. Vérifiez que l'application fonctionne correctement"
echo ""
echo "   3. En cas de problème, restaurez la sauvegarde:"
echo "      psql \$DATABASE_URL < $BACKUP_FILE"
echo ""

