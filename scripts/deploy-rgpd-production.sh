#!/bin/bash

# Script de déploiement spécifique pour les fonctionnalités RGPD
# Usage: ./scripts/deploy-rgpd-production.sh
# 
# Ce script déploie les migrations Prisma liées au système RGPD :
# - Table suppressions_adherent (historisation)
# - Table data_deletion_requests (suivi des demandes)
# - Enum StatutDemandeSuppression

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔒 Déploiement des fonctionnalités RGPD${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Vérifications préalables
echo -e "${BLUE}📋 Vérifications préalables...${NC}"

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet${NC}"
    exit 1
fi

# Vérifier le fichier .env
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Le fichier .env n'existe pas${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Fichier .env trouvé${NC}"

# Charger les variables d'environnement
source .env

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL n'est pas défini dans .env${NC}"
    exit 1
fi
echo -e "${GREEN}✅ DATABASE_URL défini${NC}"

# Vérifier Prisma
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx n'est pas disponible${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npx disponible${NC}"

# Sauvegarde de la base de données
echo ""
echo -e "${BLUE}💾 Sauvegarde de la base de données...${NC}"
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_rgpd_$(date +%Y%m%d_%H%M%S).sql"

if command -v pg_dump &> /dev/null; then
    echo -e "${BLUE}📦 Création de la sauvegarde...${NC}"
    pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Impossible de créer la sauvegarde avec pg_dump${NC}"
        echo -e "${YELLOW}💡 Assurez-vous que PostgreSQL est accessible${NC}"
        read -p "Continuer quand même? (o/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Oo]$ ]]; then
            exit 1
        fi
    }
    if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
        echo -e "${GREEN}✅ Sauvegarde créée: $BACKUP_FILE${NC}"
    else
        echo -e "${YELLOW}⚠️  La sauvegarde semble vide${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  pg_dump n'est pas disponible, sauvegarde ignorée${NC}"
    read -p "Continuer quand même? (o/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        exit 1
    fi
fi

# Vérifier l'état actuel des migrations
echo ""
echo -e "${BLUE}🔍 Vérification de l'état des migrations...${NC}"
npx prisma migrate status || {
    echo -e "${YELLOW}⚠️  Erreur lors de la vérification du statut${NC}"
    echo -e "${YELLOW}💡 Vérifiez la connexion à la base de données${NC}"
    exit 1
}

# Récupération du code (si dans un dépôt Git)
if [ -d ".git" ]; then
    echo ""
    echo -e "${BLUE}📥 Récupération des dernières modifications...${NC}"
    git pull origin main || {
        echo -e "${YELLOW}⚠️  Erreur lors du git pull${NC}"
        git status
        read -p "Continuer quand même? (o/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Oo]$ ]]; then
            exit 1
        fi
    }
    echo -e "${GREEN}✅ Code à jour${NC}"
fi

# Installation des dépendances
echo ""
echo -e "${BLUE}📦 Installation des dépendances...${NC}"
npm ci --production=false || {
    echo -e "${RED}❌ Erreur lors de l'installation des dépendances${NC}"
    exit 1
}
echo -e "${GREEN}✅ Dépendances installées${NC}"

# Génération du client Prisma
echo ""
echo -e "${BLUE}🔧 Génération du client Prisma...${NC}"
npx prisma generate || {
    echo -e "${RED}❌ Erreur lors de la génération du client Prisma${NC}"
    exit 1
}
echo -e "${GREEN}✅ Client Prisma généré${NC}"

# Application des migrations
echo ""
echo -e "${BLUE}🗄️  Application des migrations Prisma...${NC}"
echo -e "${YELLOW}⚠️  Cette opération va modifier la structure de la base de données${NC}"
read -p "Continuer? (o/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo -e "${YELLOW}❌ Opération annulée${NC}"
    exit 0
fi

npx prisma migrate deploy || {
    echo -e "${RED}❌ Erreur lors de l'application des migrations${NC}"
    echo -e "${YELLOW}💡 Vérifiez les logs ci-dessus${NC}"
    echo -e "${YELLOW}💡 Si nécessaire, restaurez la sauvegarde: psql \$DATABASE_URL < $BACKUP_FILE${NC}"
    exit 1
}
echo -e "${GREEN}✅ Migrations appliquées avec succès${NC}"

# Vérification des tables créées
echo ""
echo -e "${BLUE}🔍 Vérification des tables créées...${NC}"
npx prisma db execute --stdin <<< "
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppressions_adherent') 
         THEN '✅ Table suppressions_adherent existe'
         ELSE '❌ Table suppressions_adherent manquante'
    END as check_suppressions,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'data_deletion_requests') 
         THEN '✅ Table data_deletion_requests existe'
         ELSE '❌ Table data_deletion_requests manquante'
    END as check_requests;
" || echo -e "${YELLOW}⚠️  Impossible de vérifier les tables (normal si la commande n'est pas supportée)${NC}"

# Ajout du menu RGPD
echo ""
echo -e "${BLUE}📝 Ajout du menu RGPD dans la sidebar...${NC}"
npx tsx scripts/add-rgpd-menu.ts || {
    echo -e "${YELLOW}⚠️  Erreur lors de l'ajout du menu (peut-être déjà existant)${NC}"
}

# Build de production
echo ""
echo -e "${BLUE}🔨 Build de production...${NC}"
npm run build || {
    echo -e "${RED}❌ Erreur lors du build${NC}"
    exit 1
}
echo -e "${GREEN}✅ Build terminé${NC}"

# Redémarrage de l'application (si PM2 est disponible)
if command -v pm2 &> /dev/null; then
    echo ""
    echo -e "${BLUE}🔄 Redémarrage de l'application...${NC}"
    if pm2 list | grep -q "amakifr"; then
        pm2 restart amakifr
        echo -e "${GREEN}✅ Application redémarrée${NC}"
    else
        echo -e "${YELLOW}⚠️  L'application n'est pas gérée par PM2${NC}"
        echo -e "${YELLOW}💡 Redémarrez manuellement l'application${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  PM2 n'est pas disponible${NC}"
    echo -e "${YELLOW}💡 Redémarrez manuellement l'application${NC}"
fi

# Résumé
echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}✅ Déploiement RGPD terminé avec succès!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo -e "${BLUE}📋 Résumé:${NC}"
echo -e "  ✅ Migrations Prisma appliquées"
echo -e "  ✅ Client Prisma régénéré"
echo -e "  ✅ Menu RGPD ajouté"
echo -e "  ✅ Build de production créé"
echo ""
echo -e "${BLUE}🔍 Vérifications à effectuer:${NC}"
echo -e "  1. Accéder à /admin/rgpd/demandes (admin uniquement)"
echo -e "  2. Vérifier que le menu 'Demandes RGPD' est visible"
echo -e "  3. Tester la création d'une demande sur /suppression-donnees"
echo ""
echo -e "${BLUE}💡 Commandes utiles:${NC}"
echo -e "  - Voir les logs: ${YELLOW}pm2 logs amakifr${NC}"
echo -e "  - Vérifier les migrations: ${YELLOW}npx prisma migrate status${NC}"
echo -e "  - Vérifier les tables: ${YELLOW}psql \$DATABASE_URL -c '\dt'${NC}"
