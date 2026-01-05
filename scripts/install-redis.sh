#!/bin/bash

# Script d'installation de Redis sur un VPS Linux
# Supporte Ubuntu/Debian et CentOS/RHEL
# 
# NOTE: Sur CentOS/RHEL, si l'installation native échoue, vous pouvez utiliser Podman/Docker:
#   sudo podman run -d --replace --name redis \
#     -p 6380:6379 \
#     -v /var/lib/redis:/data \
#     --restart=always \
#     docker.io/library/redis:8
# 
# Puis configurez REDIS_URL=redis://127.0.0.1:6380 dans votre .env
#
# Usage: ./scripts/install-redis.sh

set -e

echo "🔴 Installation de Redis sur le VPS"
echo "===================================="

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Détecter le système d'exploitation
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo -e "${RED}❌ Impossible de détecter le système d'exploitation${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Système détecté: $OS $VER${NC}"

# Vérifier si Redis est déjà installé
if command -v redis-server &> /dev/null; then
    REDIS_VERSION=$(redis-server --version | awk '{print $3}' | cut -d'=' -f2)
    echo -e "${YELLOW}⚠️  Redis est déjà installé (version $REDIS_VERSION)${NC}"
    read -p "Voulez-vous continuer quand même? (o/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Oo]$ ]]; then
        exit 0
    fi
fi

# Installation selon le système
if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    echo -e "${BLUE}📦 Mise à jour des paquets...${NC}"
    sudo apt-get update
    
    echo -e "${BLUE}📦 Installation de Redis...${NC}"
    sudo apt-get install -y redis-server
    
elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
    echo -e "${BLUE}📦 Installation de Redis...${NC}"
    if [[ "$OS" == "fedora" ]]; then
        sudo dnf install -y redis
    else
        # Pour CentOS/RHEL, installer EPEL d'abord si nécessaire
        if ! rpm -qa | grep -q epel-release; then
            echo -e "${BLUE}📦 Installation d'EPEL (requis pour Redis)...${NC}"
            # Détecter la version de CentOS/RHEL
            if [[ "$VER" == "8" ]] || [[ "$VER" == "9" ]] || [[ "$VER" == "10" ]]; then
                # CentOS 8/9/10 ou RHEL 8/9/10
                sudo dnf install -y epel-release
            else
                # CentOS 7 ou versions antérieures
                sudo yum install -y epel-release
            fi
        fi
        
        # Installer Redis
        if command -v dnf &> /dev/null; then
            sudo dnf install -y redis
        else
            sudo yum install -y redis
        fi
    fi
else
    echo -e "${RED}❌ Système d'exploitation non supporté: $OS${NC}"
    echo -e "${YELLOW}💡 Veuillez installer Redis manuellement${NC}"
    exit 1
fi

# Vérifier l'installation
if ! command -v redis-server &> /dev/null; then
    echo -e "${RED}❌ L'installation de Redis a échoué${NC}"
    exit 1
fi

REDIS_VERSION=$(redis-server --version | awk '{print $3}' | cut -d'=' -f2)
echo -e "${GREEN}✅ Redis installé (version $REDIS_VERSION)${NC}"

# Configuration de Redis
echo -e "${BLUE}⚙️  Configuration de Redis...${NC}"

REDIS_CONF="/etc/redis/redis.conf"
if [ ! -f "$REDIS_CONF" ]; then
    REDIS_CONF="/etc/redis.conf"
fi

if [ ! -f "$REDIS_CONF" ]; then
    echo -e "${YELLOW}⚠️  Fichier de configuration Redis non trouvé${NC}"
    echo -e "${YELLOW}💡 Configuration par défaut utilisée${NC}"
else
    # Sauvegarder la configuration originale
    sudo cp "$REDIS_CONF" "${REDIS_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Modifications recommandées pour la production
    echo -e "${BLUE}📝 Application des optimisations de production...${NC}"
    
    # Activer la persistance (RDB + AOF)
    sudo sed -i 's/^save 900 1/save 900 1/' "$REDIS_CONF"
    sudo sed -i 's/^save 300 10/save 300 10/' "$REDIS_CONF"
    sudo sed -i 's/^save 60 10000/save 60 10000/' "$REDIS_CONF"
    
    # Activer AOF (Append Only File) pour une meilleure durabilité
    sudo sed -i 's/^appendonly no/appendonly yes/' "$REDIS_CONF"
    
    # Limiter la mémoire (optionnel, ajuster selon les besoins)
    # sudo sed -i 's/^# maxmemory <bytes>/maxmemory 256mb/' "$REDIS_CONF"
    # sudo sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' "$REDIS_CONF"
    
    # Sécuriser Redis (bind sur localhost uniquement)
    sudo sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' "$REDIS_CONF"
    sudo sed -i 's/^bind 0.0.0.0/bind 127.0.0.1/' "$REDIS_CONF"
    
    # Désactiver les commandes dangereuses en production
    sudo sed -i 's/^# rename-command FLUSHDB ""/rename-command FLUSHDB ""/' "$REDIS_CONF"
    sudo sed -i 's/^# rename-command FLUSHALL ""/rename-command FLUSHALL ""/' "$REDIS_CONF"
    sudo sed -i 's/^# rename-command CONFIG ""/rename-command CONFIG ""/' "$REDIS_CONF"
    
    echo -e "${GREEN}✅ Configuration appliquée${NC}"
fi

# Démarrer et activer Redis
echo -e "${BLUE}🚀 Démarrage de Redis...${NC}"

if systemctl is-active --quiet redis || systemctl is-active --quiet redis-server; then
    echo -e "${YELLOW}⚠️  Redis est déjà en cours d'exécution${NC}"
    sudo systemctl restart redis 2>/dev/null || sudo systemctl restart redis-server
else
    sudo systemctl start redis 2>/dev/null || sudo systemctl start redis-server
fi

# Activer Redis au démarrage
sudo systemctl enable redis 2>/dev/null || sudo systemctl enable redis-server

# Vérifier le statut
if systemctl is-active --quiet redis || systemctl is-active --quiet redis-server; then
    echo -e "${GREEN}✅ Redis est en cours d'exécution${NC}"
else
    echo -e "${RED}❌ Redis n'a pas pu démarrer${NC}"
    exit 1
fi

# Tester la connexion
echo -e "${BLUE}🧪 Test de connexion à Redis...${NC}"
if redis-cli ping | grep -q "PONG"; then
    echo -e "${GREEN}✅ Redis répond correctement${NC}"
else
    echo -e "${RED}❌ Redis ne répond pas${NC}"
    exit 1
fi

# Afficher les informations
echo -e "\n${GREEN}📊 Informations Redis:${NC}"
echo -e "  - Version: ${YELLOW}$REDIS_VERSION${NC}"
echo -e "  - Statut: ${GREEN}Actif${NC}"
echo -e "  - Port: ${YELLOW}6379${NC}"
echo -e "  - Host: ${YELLOW}127.0.0.1 (localhost uniquement)${NC}"

# Afficher les commandes utiles
echo -e "\n${BLUE}💡 Commandes utiles:${NC}"
echo -e "  - Voir le statut: ${YELLOW}sudo systemctl status redis${NC}"
echo -e "  - Voir les logs: ${YELLOW}sudo journalctl -u redis -f${NC}"
echo -e "  - Tester Redis: ${YELLOW}redis-cli ping${NC}"
echo -e "  - Arrêter Redis: ${YELLOW}sudo systemctl stop redis${NC}"
echo -e "  - Redémarrer Redis: ${YELLOW}sudo systemctl restart redis${NC}"

# Afficher la configuration pour .env
echo -e "\n${BLUE}📝 Ajoutez ces variables à votre fichier .env:${NC}"
echo -e "${YELLOW}REDIS_URL=redis://127.0.0.1:6379${NC}"
echo -e "${YELLOW}REDIS_HOST=127.0.0.1${NC}"
echo -e "${YELLOW}REDIS_PORT=6379${NC}"

echo -e "\n${GREEN}✅ Installation de Redis terminée avec succès!${NC}"

# Vérifier si Redis est dans un conteneur Podman/Docker
if command -v podman &> /dev/null; then
    if podman ps --format "{{.Names}}" | grep -q "^redis$"; then
        echo -e "\n${YELLOW}ℹ️  Redis est en cours d'exécution dans un conteneur Podman${NC}"
        REDIS_PORT=$(podman port redis 6379 2>/dev/null | cut -d: -f2 || echo "6379")
        echo -e "${YELLOW}   Port mappé: ${REDIS_PORT}${NC}"
        echo -e "${YELLOW}   Utilisez REDIS_URL=redis://127.0.0.1:${REDIS_PORT} dans votre .env${NC}"
    fi
elif command -v docker &> /dev/null; then
    if docker ps --format "{{.Names}}" | grep -q "^redis$"; then
        echo -e "\n${YELLOW}ℹ️  Redis est en cours d'exécution dans un conteneur Docker${NC}"
        REDIS_PORT=$(docker port redis 6379 2>/dev/null | cut -d: -f2 || echo "6379")
        echo -e "${YELLOW}   Port mappé: ${REDIS_PORT}${NC}"
        echo -e "${YELLOW}   Utilisez REDIS_URL=redis://127.0.0.1:${REDIS_PORT} dans votre .env${NC}"
    fi
fi
