#!/bin/bash

# Script pour redémarrer PM2 de manière sécurisée
# Évite les erreurs 502 lors du redémarrage en attendant que le serveur soit prêt

set -e

echo "🔄 Redémarrage sécurisé de PM2..."

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Nom de l'application PM2
APP_NAME="amakifr"

# Déterminer l'URL de health check selon l'environnement
# En production, utiliser l'URL publique, sinon localhost
if [ -z "$HEALTH_CHECK_URL" ]; then
    # Vérifier si on est en production (chemin /sites/)
    if [ -d "/sites/amakifr" ]; then
        # Production : utiliser l'URL publique ou le port local
        PORT="${PORT:-9060}"
        HEALTH_CHECK_URL="http://localhost:${PORT}/api/build-id"
    else
        # Développement : utiliser le port par défaut
        PORT="${PORT:-3000}"
        HEALTH_CHECK_URL="http://localhost:${PORT}/api/build-id"
    fi
fi

# Vérifier que l'application existe
if ! pm2 list | grep -q "$APP_NAME"; then
    echo -e "${RED}❌ L'application $APP_NAME n'existe pas dans PM2${NC}"
    exit 1
fi

# Redémarrer l'application
echo -e "${YELLOW}📦 Redémarrage de $APP_NAME...${NC}"
pm2 restart "$APP_NAME"

# Attendre que l'application soit prête
echo -e "${YELLOW}⏳ Attente que le serveur soit prêt (${HEALTH_CHECK_URL})...${NC}"

MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    # Vérifier si le serveur répond
    if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Serveur prêt après ${ATTEMPT} tentative(s)${NC}"
        break
    fi
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}⚠️  Le serveur n'a pas répondu après ${MAX_ATTEMPTS} tentatives${NC}"
        echo -e "${YELLOW}💡 Vérifiez manuellement que le serveur fonctionne${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}   Tentative ${ATTEMPT}/${MAX_ATTEMPTS}...${NC}"
    sleep 2
done

# Vérifier le statut PM2
echo -e "${YELLOW}📊 Statut de l'application:${NC}"
pm2 status "$APP_NAME"

echo -e "${GREEN}✅ Redémarrage terminé avec succès${NC}"
