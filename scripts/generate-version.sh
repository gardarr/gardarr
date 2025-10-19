#!/bin/bash

# Script para gerar informações de versão
# Uso: ./scripts/generate-version.sh [version] [commit] [date]

set -e

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="$PROJECT_DIR/backend/pkg/version/version.go"

# Valores padrão ou argumentos passados
VERSION="${1:-$(git describe --tags --always --dirty 2>/dev/null || echo 'dev')}"
COMMIT="${2:-$(git rev-parse HEAD 2>/dev/null || echo 'unknown')}"
DATE="${3:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

# Remove o prefixo 'v' da versão se existir
VERSION=$(echo "$VERSION" | sed 's/^v//')

# Limpa a versão de caracteres especiais
VERSION=$(echo "$VERSION" | sed 's/[^a-zA-Z0-9.-]//g')

# Se a versão estiver vazia ou for apenas 'dev', usa um valor padrão
if [ -z "$VERSION" ] || [ "$VERSION" = "dev" ]; then
    VERSION="0.0.0-dev"
fi

echo "Gerando versão:"
echo "  Version: $VERSION"
echo "  Commit:  $COMMIT"
echo "  Date:    $DATE"

# Cria o arquivo de versão
cat > "$VERSION_FILE" << EOF
package version

var (
	Version = "$VERSION"
	Commit  = "$COMMIT"
	Date    = "$DATE"
)
EOF

echo "Arquivo de versão gerado: $VERSION_FILE"
