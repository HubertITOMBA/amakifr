#!/bin/bash

# Script de test mobile pour Phase 2
# Ce script aide à tester l'application sur différents appareils

echo "📱 Tests Mobile - Phase 2"
echo "=========================="
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier si l'application est en cours d'exécution
check_server() {
    if lsof -Pi :9052 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${GREEN}✅ Serveur de développement actif sur le port 9052${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Serveur de développement non détecté${NC}"
        return 1
    fi
}

# Obtenir l'IP locale
get_local_ip() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        ip addr show | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -n 1
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1
    else
        echo "127.0.0.1"
    fi
}

# Afficher les informations de connexion
show_connection_info() {
    local_ip=$(get_local_ip)
    echo ""
    echo -e "${BLUE}📡 Informations de connexion :${NC}"
    echo "   Local : http://localhost:9052"
    echo "   Réseau : http://${local_ip}:9052"
    echo ""
    echo -e "${YELLOW}💡 Pour tester sur un appareil mobile :${NC}"
    echo "   1. Assurez-vous que votre mobile est sur le même réseau Wi-Fi"
    echo "   2. Ouvrez le navigateur sur votre mobile"
    echo "   3. Accédez à : http://${local_ip}:9052"
    echo ""
}

# Afficher les outils de test disponibles
show_test_tools() {
    echo -e "${BLUE}🛠️  Outils de test disponibles :${NC}"
    echo ""
    echo "1. Chrome DevTools (Recommandé)"
    echo "   - Ouvrir Chrome"
    echo "   - Appuyer sur F12"
    echo "   - Appuyer sur Ctrl+Shift+M (Windows/Linux) ou Cmd+Shift+M (Mac)"
    echo "   - Sélectionner un appareil dans la liste"
    echo ""
    echo "2. Firefox DevTools"
    echo "   - Ouvrir Firefox"
    echo "   - Appuyer sur F12"
    echo "   - Appuyer sur Ctrl+Shift+M"
    echo ""
    echo "3. Test sur appareil réel"
    echo "   - Utiliser l'URL réseau affichée ci-dessus"
    echo "   - Chrome Remote Debugging : chrome://inspect"
    echo ""
}

# Afficher la checklist rapide
show_checklist() {
    echo -e "${BLUE}✅ Checklist rapide :${NC}"
    echo ""
    echo "Pages Publiques :"
    echo "  [ ] /idees"
    echo "  [ ] /user/profile"
    echo "  [ ] /user/update"
    echo ""
    echo "Pages Admin :"
    echo "  [ ] /admin/cotisations/gestion"
    echo "  [ ] /admin/users"
    echo "  [ ] /admin/elections"
    echo "  [ ] /admin/finances"
    echo "  [ ] /admin/finances/dettes"
    echo "  [ ] /admin/finances/paiements"
    echo "  [ ] /admin/finances/assistances"
    echo "  [ ] /admin/idees"
    echo "  [ ] /admin/candidatures"
    echo ""
    echo -e "${YELLOW}📋 Pour la checklist complète, voir : docs/TESTS_MOBILE_PHASE2.md${NC}"
    echo ""
}

# Menu principal
main() {
    echo -e "${GREEN}🚀 Démarrage des tests mobile${NC}"
    echo ""
    
    if check_server; then
        show_connection_info
    else
        echo -e "${YELLOW}⚠️  Le serveur de développement n'est pas actif${NC}"
        echo ""
        echo "Pour démarrer le serveur :"
        echo "  npm run dev"
        echo ""
        read -p "Voulez-vous démarrer le serveur maintenant ? (o/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[OoYy]$ ]]; then
            echo "Démarrage du serveur..."
            npm run dev &
            sleep 3
            if check_server; then
                show_connection_info
            fi
        fi
    fi
    
    show_test_tools
    show_checklist
    
    echo -e "${GREEN}✅ Prêt pour les tests !${NC}"
    echo ""
    echo "Appuyez sur Ctrl+C pour arrêter le serveur (si démarré par ce script)"
}

# Exécuter le script
main

