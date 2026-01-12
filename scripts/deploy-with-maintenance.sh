#!/bin/bash

###############################################################################
# Script de déploiement avec mode maintenance automatique
# 
# Ce script automatise le processus complet de déploiement :
# 1. Active le mode maintenance
# 2. Pull du code depuis Git
# 3. Installation des dépendances
# 4. Build de l'application
# 5. Migrations de base de données
# 6. Redémarrage de l'application
# 7. Désactivation du mode maintenance
#
# Usage: ./scripts/deploy-with-maintenance.sh
###############################################################################

set -e  # Arrêter en cas d'erreur

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
APP_DIR="/sites/amakifr"
PM2_APP_NAME="amaki"
GIT_BRANCH="main"

echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${PURPLE}🚀  DÉPLOIEMENT AUTOMATIQUE AVEC MAINTENANCE - AMAKI${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté depuis la racine du projet.${NC}"
    exit 1
fi

# Afficher l'heure de début
START_TIME=$(date +%s)
echo -e "${CYAN}⏰ Début du déploiement: $(date '+%d/%m/%Y à %H:%M:%S')${NC}"
echo ""

# Demander confirmation
echo -e "${YELLOW}⚠️  Ce script va:${NC}"
echo -e "${YELLOW}   • Activer le mode maintenance (site inaccessible temporairement)${NC}"
echo -e "${YELLOW}   • Mettre à jour le code depuis Git (branche: $GIT_BRANCH)${NC}"
echo -e "${YELLOW}   • Installer les dépendances${NC}"
echo -e "${YELLOW}   • Rebuilder l'application${NC}"
echo -e "${YELLOW}   • Exécuter les migrations de base de données${NC}"
echo -e "${YELLOW}   • Redémarrer l'application${NC}"
echo -e "${YELLOW}   • Désactiver le mode maintenance${NC}"
echo ""
read -p "Voulez-vous continuer ? (o/n) : " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[OoYy]$ ]]; then
    echo -e "${BLUE}ℹ️  Déploiement annulé.${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Fonction pour gérer les erreurs
handle_error() {
    echo ""
    echo -e "${RED}❌ Erreur détectée lors de l'étape: $1${NC}"
    echo -e "${YELLOW}⚠️  Le mode maintenance est toujours actif !${NC}"
    echo -e "${YELLOW}   Vous devez le désactiver manuellement:${NC}"
    echo -e "${GREEN}   bash scripts/maintenance-off.sh${NC}"
    echo ""
    exit 1
}

# Étape 1 : Activer le mode maintenance
echo ""
echo -e "${GREEN}1️⃣  Activation du mode maintenance...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if bash scripts/maintenance-on.sh; then
    echo -e "${GREEN}   ✅ Mode maintenance activé${NC}"
else
    handle_error "Activation du mode maintenance"
fi
sleep 2

# Étape 2 : Sauvegarder l'état actuel
echo ""
echo -e "${GREEN}2️⃣  Sauvegarde de l'état actuel...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
CURRENT_COMMIT=$(git rev-parse HEAD)
echo -e "${CYAN}   Commit actuel: ${CURRENT_COMMIT:0:8}${NC}"
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${CYAN}   Branche actuelle: $CURRENT_BRANCH${NC}"

# Étape 3 : Pull du code
echo ""
echo -e "${GREEN}3️⃣  Récupération du code depuis Git...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if git pull origin $GIT_BRANCH; then
    NEW_COMMIT=$(git rev-parse HEAD)
    if [ "$CURRENT_COMMIT" = "$NEW_COMMIT" ]; then
        echo -e "${YELLOW}   ℹ️  Aucune mise à jour disponible (déjà à jour)${NC}"
    else
        echo -e "${GREEN}   ✅ Code mis à jour${NC}"
        echo -e "${CYAN}   Nouveau commit: ${NEW_COMMIT:0:8}${NC}"
    fi
else
    handle_error "Pull du code depuis Git"
fi

# Étape 4 : Installation des dépendances
echo ""
echo -e "${GREEN}4️⃣  Installation des dépendances...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if npm install --production=false; then
    echo -e "${GREEN}   ✅ Dépendances installées${NC}"
else
    handle_error "Installation des dépendances"
fi

# Étape 5 : Build de l'application
echo ""
echo -e "${GREEN}5️⃣  Build de l'application Next.js...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if npm run build; then
    echo -e "${GREEN}   ✅ Build terminé avec succès${NC}"
else
    handle_error "Build de l'application"
fi

# Étape 6 : Migrations de base de données
echo ""
echo -e "${GREEN}6️⃣  Exécution des migrations de base de données...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if npx prisma migrate deploy; then
    echo -e "${GREEN}   ✅ Migrations appliquées${NC}"
else
    echo -e "${YELLOW}   ⚠️  Erreur lors des migrations (peut être normal si aucune migration à appliquer)${NC}"
    # Ne pas arrêter le déploiement pour cette erreur
fi

# Étape 7 : Génération du client Prisma
echo ""
echo -e "${GREEN}7️⃣  Génération du client Prisma...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if npx prisma generate; then
    echo -e "${GREEN}   ✅ Client Prisma généré${NC}"
else
    handle_error "Génération du client Prisma"
fi

# Étape 8 : Redémarrage de l'application
echo ""
echo -e "${GREEN}8️⃣  Redémarrage de l'application...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if pm2 restart $PM2_APP_NAME; then
    echo -e "${GREEN}   ✅ Application redémarrée${NC}"
    sleep 3
    # Vérifier que l'application tourne
    if pm2 list | grep -q "$PM2_APP_NAME.*online"; then
        echo -e "${GREEN}   ✅ Application en ligne${NC}"
    else
        echo -e "${RED}   ❌ L'application ne semble pas démarrée correctement${NC}"
        echo -e "${YELLOW}   ℹ️  Vérifiez les logs: pm2 logs $PM2_APP_NAME${NC}"
        handle_error "Vérification du statut de l'application"
    fi
else
    handle_error "Redémarrage de l'application"
fi

# Étape 9 : Désactivation du mode maintenance
echo ""
echo -e "${GREEN}9️⃣  Désactivation du mode maintenance...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if bash scripts/maintenance-off.sh; then
    echo -e "${GREEN}   ✅ Mode maintenance désactivé${NC}"
else
    handle_error "Désactivation du mode maintenance"
fi

# Calcul du temps écoulé
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

# Résumé final
echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅  DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}📊 Résumé:${NC}"
echo -e "   • Branche: ${GREEN}$GIT_BRANCH${NC}"
echo -e "   • Commit: ${GREEN}${NEW_COMMIT:0:8}${NC}"
echo -e "   • Temps écoulé: ${GREEN}${MINUTES}m ${SECONDS}s${NC}"
echo -e "   • Fin: ${CYAN}$(date '+%d/%m/%Y à %H:%M:%S')${NC}"
echo ""
echo -e "${GREEN}🎉 L'application est maintenant en ligne !${NC}"
echo ""
echo -e "${BLUE}💡 Vérifications recommandées:${NC}"
echo -e "   1. Tester l'accès au site"
echo -e "   2. Vérifier les logs: ${GREEN}pm2 logs $PM2_APP_NAME${NC}"
echo -e "   3. Surveiller pendant quelques minutes"
echo ""
