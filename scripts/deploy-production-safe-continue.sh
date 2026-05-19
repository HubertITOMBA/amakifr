#!/bin/bash
# Reprendre le déploiement après une sauvegarde déjà effectuée (étapes 5 à 9)
# Usage sur le serveur :
#   SKIP_BACKUP=1 SKIP_MAINTENANCE=1 bash scripts/deploy-production-safe-continue.sh
#
# Ou directement :
#   bash scripts/deploy-production-safe-continue.sh

export SKIP_BACKUP=1
export SKIP_MAINTENANCE="${SKIP_MAINTENANCE:-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/deploy-production-safe.sh"
