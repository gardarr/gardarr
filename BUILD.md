# Build Guide

Este documento descreve como compilar o Gardarr com informações de versão dinâmicas.

## 🚀 Build com Versão Dinâmica

### Usando Makefile

```bash
# Build completo com versão dinâmica (recomendado)
make build-full

# Apenas o backend com versão dinâmica
make build-with-version

# Usando o script de build
make build-script
```

### Usando Script de Build

```bash
# Build padrão (detecta versão automaticamente)
./scripts/build.sh

# Build com versão específica
./scripts/build.sh "1.2.3"

# Build para plataforma específica
./scripts/build.sh "1.2.3" "dist" "linux" "arm64"
```

### Build Manual

```bash
# Obter informações de versão
make get-version

# Build com ldflags
cd backend
go build \
  -ldflags "-X github.com/jfxdev/gardarr/pkg/version.Version=1.2.3 \
            -X github.com/jfxdev/gardarr/pkg/version.Commit=abc1234 \
            -X github.com/jfxdev/gardarr/pkg/version.Date=2025-01-18T21:30:00Z \
            -w -s" \
  -o ../gardarr .
```

## 🐳 Build com Docker

### Build Local

```bash
# Build com versão padrão
docker build -t gardarr .

# Build com versão específica
docker build \
  --build-arg VERSION=1.2.3 \
  --build-arg COMMIT=abc1234 \
  --build-arg DATE=2025-01-18T21:30:00Z \
  -t gardarr .
```

### Build via CI/CD

O GitHub Actions automaticamente:
- Detecta a versão do git tag (para releases)
- Usa commit count + hash para builds de desenvolvimento
- Injeta informações de versão via ldflags
- Cria binários para múltiplas plataformas
- Gera imagens Docker com metadados

## 📋 Informações de Versão

### Estrutura da Versão

- **Release**: `1.2.3` (baseado na git tag)
- **Development**: `0.0.0-dev+123.abc1234` (commit count + short hash)

### Variáveis Injetadas

- `Version`: Versão da aplicação
- `Commit`: Hash completo do commit
- `Date`: Data/hora do build (UTC)

### Acesso às Informações

```bash
# Via API (requer autenticação)
curl http://localhost:3000/v1/version

# Resposta:
{
  "version": "1.2.3",
  "commit": "abc1234567890abcdef1234567890abcdef1234",
  "date": "2025-01-18T21:30:00Z"
}
```

## 🔧 Configuração

### Variáveis de Ambiente

```bash
# Para override manual
export VERSION=1.2.3
export COMMIT=abc1234
export DATE=2025-01-18T21:30:00Z
```

### Arquivo .version

O Makefile gera um arquivo `.version` com as informações:

```bash
VERSION=1.2.3
COMMIT=abc1234567890abcdef1234567890abcdef1234
DATE=2025-01-18T21:30:00Z
```

## 🎯 Plataformas Suportadas

### Binários

- Linux (amd64, arm64)
- Windows (amd64)
- macOS (amd64, arm64)

### Docker

- linux/amd64
- linux/arm64

## 🚨 Troubleshooting

### Erro: "package github.com/jfxdev/gardarr/pkg/version not found"

Verifique se o módulo Go está configurado corretamente:

```bash
cd backend
go mod tidy
go mod verify
```

### Erro: "ldflags: invalid syntax"

Verifique se as aspas estão corretas no comando ldflags:

```bash
# ✅ Correto
-ldflags "-X pkg.version.Version=1.2.3"

# ❌ Incorreto
-ldflags '-X pkg.version.Version=1.2.3'
```

### Versão não aparece na API

1. Verifique se o build foi feito com ldflags
2. Confirme se o endpoint `/v1/version` está registrado
3. Teste com `curl http://localhost:3000/v1/version`

## 📚 Referências

- [Go Build Constraints](https://pkg.go.dev/cmd/go#hdr-Build_constraints)
- [Go ldflags](https://pkg.go.dev/cmd/link)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
