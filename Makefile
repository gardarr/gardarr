# Nome do binário final
BINARY_NAME=gardarr

# Flags de compilação
BUILD_FLAGS=-ldflags="-s -w"

# Scripts
VERSION_SCRIPT=scripts/generate-version.sh
BUILD_SCRIPT=scripts/build.sh

# Version information (will be set dynamically)
VERSION ?= 0.0.0-dev
COMMIT ?= unknown
DATE ?= unknown

# Diretórios
FRONTEND_DIR=frontend
BACKEND_DIR=backend

# Comando para gerar informações de versão
generate-version:
	@echo "Gerando informações de versão..."
	@./$(VERSION_SCRIPT)

# Comando para build do frontend
build-frontend:
	cd $(FRONTEND_DIR) && npm ci && npm run build

# Comando para copiar frontend build para o diretório web do backend
copy-frontend:
	mkdir -p $(BACKEND_DIR)/web
	cp -r $(FRONTEND_DIR)/dist/* $(BACKEND_DIR)/web/

# Comando para obter informações de versão do git
get-version:
	@echo "Obtendo informações de versão..."
	@if command -v git >/dev/null 2>&1 && [ -d ".git" ]; then \
		if git describe --tags --exact-match HEAD >/dev/null 2>&1; then \
			VERSION=$$(git describe --tags --exact-match HEAD | sed 's/^v//'); \
		else \
			COMMIT_COUNT=$$(git rev-list --count HEAD 2>/dev/null || echo "0"); \
			SHORT_HASH=$$(git rev-parse --short HEAD 2>/dev/null || echo "unknown"); \
			VERSION="0.0.0-dev+$$COMMIT_COUNT.$$SHORT_HASH"; \
		fi; \
		COMMIT=$$(git rev-parse HEAD 2>/dev/null || echo "unknown"); \
		DATE=$$(date -u +"%Y-%m-%dT%H:%M:%SZ"); \
		echo "VERSION=$$VERSION" > .version; \
		echo "COMMIT=$$COMMIT" >> .version; \
		echo "DATE=$$DATE" >> .version; \
		echo "Version: $$VERSION"; \
		echo "Commit: $$COMMIT"; \
		echo "Date: $$DATE"; \
	else \
		echo "VERSION=0.0.0-dev" > .version; \
		echo "COMMIT=unknown" >> .version; \
		echo "DATE=$$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> .version; \
		echo "Using default version information"; \
	fi

# Comando para build com versão dinâmica
build-with-version: get-version
	@echo "Building with dynamic version..."
	@source .version && \
	cd $(BACKEND_DIR) && \
	CGO_ENABLED=1 go build \
		-ldflags "-X github.com/jfxdev/gardarr/pkg/version.Version=$$VERSION \
		          -X github.com/jfxdev/gardarr/pkg/version.Commit=$$COMMIT \
		          -X github.com/jfxdev/gardarr/pkg/version.Date=$$DATE \
		          -w -s" \
		-o ../$(BINARY_NAME) .

# Comando para build completo (frontend + backend) com versão
build-full: get-version build-frontend copy-frontend build-with-version

# Comando para build usando script
build-script:
	@./$(BUILD_SCRIPT)

# Comando para build completo usando script
build-full-script: build-frontend copy-frontend build-script

# Comando para build com Docker
docker-build:
	docker build -t $(BINARY_NAME) .

# Comando para build local no estilo do pipeline (gera artefatos e usa o Dockerfile)
docker-build-pipeline: get-version build-frontend
	@echo "Building artifacts like CI pipeline (linux/amd64)..."
	@mkdir -p $(BACKEND_DIR)/dist
	@source .version && \
	docker run --rm --platform linux/amd64 \
		-v "$(PWD)/$(BACKEND_DIR):/src" \
		-v "$(PWD)/$(BACKEND_DIR)/dist:/dist" \
		-w /src \
		golang:1.25.3-alpine \
		sh -c "apk add --no-cache gcc musl-dev sqlite-dev && \
		CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build \
			-ldflags='-X github.com/jfxdev/gardarr/pkg/version.Version=$$VERSION \
					-X github.com/jfxdev/gardarr/pkg/version.Commit=$$COMMIT \
					-X github.com/jfxdev/gardarr/pkg/version.Date=$$DATE \
					-w -s -linkmode external -extldflags \"-static\"' \
			-tags 'osusergo netgo sqlite_omit_load_extension' \
			-o /dist/gardarr-amd64 ."
	@echo "Building Docker image from pipeline artifacts..."
	docker build -t 10.0.0.100:5555/gardarr:pipeline5 --build-arg APP_PORT=3200 .
	docker push 10.0.0.100:5555/gardarr:pipeline5
# Comando para build local com Docker (compila tudo dentro do container)
docker-build-local:
	docker build -f Dockerfile.local -t $(BINARY_NAME):local .

# Comando para rodar o código localmente (com frontend)
run-local: build-frontend copy-frontend
	cd $(BACKEND_DIR) && go run main.go

# Comando para rodar apenas o backend (sem frontend)
run-backend:
	cd $(BACKEND_DIR) && go run main.go

# Comando para rodar apenas o frontend em modo dev
run-frontend:
	cd $(FRONTEND_DIR) && npm run dev

# Comando para compilar para Linux
build-linux:
	cd $(BACKEND_DIR) && CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build $(BUILD_FLAGS) -o ../$(BINARY_NAME)_linux_amd64 main.go

# Comando para compilar para macOS (Darwin)
build-darwin:
	cd $(BACKEND_DIR) && GOOS=darwin GOARCH=amd64 go build $(BUILD_FLAGS) -o ../$(BINARY_NAME)_darwin_amd64 main.go

# Comando para compilar para macOS ARM64 (Darwin ARM64)
build-darwin-arm64:
	cd $(BACKEND_DIR) && GOOS=darwin GOARCH=arm64 go build $(BUILD_FLAGS) -o ../$(BINARY_NAME)_darwin_arm64 main.go

# Comando para compilar para Windows
build-windows:
	cd $(BACKEND_DIR) && GOOS=windows GOARCH=amd64 go build $(BUILD_FLAGS) -o ../$(BINARY_NAME)_windows_amd64.exe main.go

# Comando para compilar para Windows ARM64
build-windows-arm64:
	cd $(BACKEND_DIR) && GOOS=windows GOARCH=arm64 go build $(BUILD_FLAGS) -o ../$(BINARY_NAME)_windows_arm64.exe main.go

# Comando para compilar para todos os sistemas
build-all: build-linux build-darwin build-darwin-arm64 build-windows build-windows-arm64

# Comando para instalar dependências do frontend
install-frontend:
	cd $(FRONTEND_DIR) && npm ci

# Comando para instalar dependências do backend
install-backend:
	cd $(BACKEND_DIR) && go mod download

# Comando para testar o backend
test-backend:
	cd $(BACKEND_DIR) && go test ./...

# Comando para instalar todas as dependências
install: install-frontend install-backend

# Comando para testar integração
test-integration:
	cd $(BACKEND_DIR) && ./test-integration.sh

# Comando para limpar builds
clean:
	rm -f $(BINARY_NAME)_linux_amd64 $(BINARY_NAME)_darwin_amd64 $(BINARY_NAME)_darwin_arm64 $(BINARY_NAME)_windows_amd64.exe $(BINARY_NAME)_windows_arm64.exe
	rm -rf $(FRONTEND_DIR)/dist
	rm -rf $(BACKEND_DIR)/web

# Comando para limpar dependências
clean-deps:
	rm -rf $(FRONTEND_DIR)/node_modules
	cd $(BACKEND_DIR) && go clean -modcache

# Comando para limpar tudo
clean-all: clean clean-deps

# Comando para desenvolvimento (frontend + backend em paralelo)
dev:
	@echo "Iniciando desenvolvimento..."
	@echo "Frontend: http://localhost:5173"
	@echo "Backend: http://localhost:3200"
	@echo "Pressione Ctrl+C para parar"
	@trap 'kill %1 %2' INT; \
	cd $(FRONTEND_DIR) && npm run dev & \
	cd $(BACKEND_DIR) && go run main.go & \
	wait

# Comando para desenvolvimento separado (recomendado)
dev-separate:
	@echo "Para desenvolvimento separado, execute em terminais diferentes:"
	@echo "Terminal 1: make run-backend"
	@echo "Terminal 2: make run-frontend"
	@echo ""
	@echo "Frontend: http://localhost:5173"
	@echo "Backend: http://localhost:3200"

# Comando para build de produção com Docker
docker-prod: docker-build
	docker run -p 3200:3200 $(BINARY_NAME)

# Comando para build e executar localmente com Docker
docker-run-local: docker-build-local
	docker run -p 3200:3200 $(BINARY_NAME):local

# Comando para parar containers Docker
docker-stop:
	docker stop $$(docker ps -q --filter ancestor=$(BINARY_NAME)) 2>/dev/null || true

# Comando para remover containers Docker
docker-clean: docker-stop
	docker rmi $(BINARY_NAME) 2>/dev/null || true

# Comando para mostrar ajuda
help:
	@echo "Comandos disponíveis:"
	@echo "  make install          - Instalar todas as dependências"
	@echo "  make run-local        - Executar aplicação local (frontend + backend)"
	@echo "  make run-backend      - Executar apenas o backend"
	@echo "  make run-frontend     - Executar apenas o frontend em modo dev"
	@echo "  make test-backend     - Testar o backend"
	@echo "  make dev              - Desenvolvimento com hot-reload (paralelo)"
	@echo "  make dev-separate     - Instruções para desenvolvimento separado"
	@echo "  make build-full       - Build completo para produção"
	@echo "  make docker-build     - Build com Docker (CI/CD)"
	@echo "  make docker-build-pipeline - Build local igual ao pipeline (artefatos + Dockerfile)"
	@echo "  make docker-build-local - Build local com Docker (compila tudo)"
	@echo "  make docker-run-local - Build e executar local com Docker"
	@echo "  make docker-prod      - Build e executar com Docker"
	@echo "  make test-integration - Testar integração"
	@echo "  make clean            - Limpar builds"
	@echo "  make clean-all        - Limpar tudo"
	@echo "  make help             - Mostrar esta ajuda"
	@echo ""
	@echo "Desenvolvimento Local:"
	@echo "  Terminal 1: make run-backend   (Backend na porta 3200)"
	@echo "  Terminal 2: make run-frontend  (Frontend na porta 5173)"

.PHONY: build-frontend copy-frontend build-full docker-build docker-build-pipeline docker-build-local docker-run-local run-local run-backend run-frontend test-backend build-linux build-darwin build-darwin-arm64 build-windows build-windows-arm64 build-all install-frontend install-backend install test-integration clean clean-deps clean-all dev dev-separate docker-prod docker-stop docker-clean help
