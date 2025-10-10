# Nome do binário final
BINARY_NAME=seedbox-app

# Flags de compilação
BUILD_FLAGS=-ldflags="-s -w"

# Diretórios
FRONTEND_DIR=frontend
BACKEND_DIR=backend

# Comando para build do frontend
build-frontend:
	cd $(FRONTEND_DIR) && npm ci && npm run build

# Comando para copiar frontend build para o diretório web do backend
copy-frontend:
	mkdir -p $(BACKEND_DIR)/web
	cp -r $(FRONTEND_DIR)/dist/* $(BACKEND_DIR)/web/

# Comando para build completo (frontend + backend)
build-full: build-frontend copy-frontend build-linux

# Comando para build com Docker
docker-build:
	docker build -t $(BINARY_NAME) .

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
	cd $(BACKEND_DIR) && GOOS=linux GOARCH=amd64 go build $(BUILD_FLAGS) -o ../$(BINARY_NAME)_linux_amd64 main.go

# Comando para compilar para macOS (Darwin)
build-darwin:
	cd $(BACKEND_DIR) && GOOS=darwin GOARCH=amd64 go build $(BUILD_FLAGS) -o ../$(BINARY_NAME)_darwin_amd64 main.go

# Comando para compilar para ambos (Linux e macOS)
build-all: build-linux build-darwin

# Comando para instalar dependências do frontend
install-frontend:
	cd $(FRONTEND_DIR) && npm ci

# Comando para instalar dependências do backend
install-backend:
	cd $(BACKEND_DIR) && go mod download

# Comando para instalar todas as dependências
install: install-frontend install-backend

# Comando para testar integração
test-integration:
	cd $(BACKEND_DIR) && ./test-integration.sh

# Comando para limpar builds
clean:
	rm -f $(BINARY_NAME)_linux_amd64 $(BINARY_NAME)_darwin_amd64
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
	@echo "Backend: http://localhost:3000"
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
	@echo "Backend: http://localhost:3000"

# Comando para build de produção com Docker
docker-prod: docker-build
	docker run -p 3000:3000 $(BINARY_NAME)

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
	@echo "  make dev              - Desenvolvimento com hot-reload (paralelo)"
	@echo "  make dev-separate     - Instruções para desenvolvimento separado"
	@echo "  make build-full       - Build completo para produção"
	@echo "  make docker-build     - Build com Docker"
	@echo "  make docker-prod      - Build e executar com Docker"
	@echo "  make test-integration - Testar integração"
	@echo "  make clean            - Limpar builds"
	@echo "  make clean-all        - Limpar tudo"
	@echo "  make help             - Mostrar esta ajuda"
	@echo ""
	@echo "Desenvolvimento Local:"
	@echo "  Terminal 1: make run-backend   (Backend na porta 3000)"
	@echo "  Terminal 2: make run-frontend  (Frontend na porta 5173)"

.PHONY: build-frontend copy-frontend build-full docker-build run-local run-backend run-frontend build-linux build-darwin build-all install-frontend install-backend install test-integration clean clean-deps clean-all dev dev-separate docker-prod docker-stop docker-clean help
