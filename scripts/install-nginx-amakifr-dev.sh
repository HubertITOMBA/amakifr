#!/bin/bash
# Installe la config nginx de test maintenance (port 8090) dans /etc/nginx/conf.d/
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="${PROJECT_ROOT}/deploy/nginx/amakifr-dev.conf"
DEST="/etc/nginx/conf.d/amakifr-dev.conf"

echo "Installation de ${SRC} -> ${DEST}"
echo "⚠️  Vérifiez les chemins dans ${DEST} (AMAKI_ROOT, port 9052)"
sudo cp "$SRC" "$DEST"
sudo nginx -t
sudo systemctl reload nginx
echo "✅ Nginx rechargé."
echo "   Test via nginx : http://localhost:8090/"
echo "   Test direct Next : http://localhost:9052/"
