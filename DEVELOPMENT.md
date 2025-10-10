# Guia de Desenvolvimento Local

Este guia explica como configurar e executar o projeto seedbox para desenvolvimento local com frontend e backend separados.

## 🚀 Configuração Inicial

### 1. Instalar Dependências

```bash
# Instalar todas as dependências (frontend + backend)
make install
```

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
APP_PORT=3000
APP_DOMAINS=http://localhost:5173,http://localhost:3000
```

## 🛠️ Executando o Desenvolvimento

### Opção 1: Terminais Separados (Recomendado)

**Terminal 1 - Backend:**
```bash
make run-backend
```
- Backend rodará em: http://localhost:3000
- API disponível em: http://localhost:3000/v1/*

**Terminal 2 - Frontend:**
```bash
make run-frontend
```
- Frontend rodará em: http://localhost:5173
- Hot-reload ativo
- Proxy configurado para redirecionar `/v1/*` para o backend

### Opção 2: Comando Único

```bash
make dev
```
- Executa frontend e backend em paralelo
- Pressione `Ctrl+C` para parar ambos

## 🔧 Configurações Técnicas

### CORS
O backend está configurado para aceitar requisições de:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Backend)

### Proxy do Vite
O Vite está configurado para redirecionar automaticamente:
- `/v1/*` → `http://localhost:3000/v1/*`

### Cliente API
Use o cliente API configurado em `src/lib/api.ts`:

```typescript
import { api } from '@/lib/api';

// GET request
const response = await api.get('/health');

// POST request
const response = await api.post('/tasks', { name: 'Nova tarefa' });

// Verificar resposta
if (response.data) {
  console.log('Sucesso:', response.data);
} else {
  console.error('Erro:', response.error);
}
```

## 📁 Estrutura de Desenvolvimento

```
seedbox/
├── .env                    # Variáveis de ambiente
├── backend/               # API Go
│   ├── main.go           # Ponto de entrada
│   └── internal/         # Código interno
├── frontend/             # App React + Vite
│   ├── src/
│   │   ├── lib/api.ts    # Cliente API
│   │   └── components/   # Componentes React
│   └── vite.config.ts    # Configuração do Vite
└── Makefile              # Comandos de desenvolvimento
```

## 🐛 Troubleshooting

### Backend não inicia
- Verifique se a porta 3000 está livre
- Execute `make install-backend` para reinstalar dependências Go

### Frontend não conecta com o backend
- Verifique se o backend está rodando na porta 3000
- Confirme se o arquivo `.env` está configurado corretamente
- Verifique o console do navegador para erros de CORS

### Erro de proxy no Vite
- Verifique se o `vite.config.ts` está configurado corretamente
- Reinicie o servidor de desenvolvimento: `make run-frontend`

## 📝 Comandos Úteis

```bash
# Ver todos os comandos disponíveis
make help

# Instruções para desenvolvimento separado
make dev-separate

# Limpar builds
make clean

# Limpar tudo (incluindo node_modules)
make clean-all
```

## 🔄 Fluxo de Desenvolvimento

1. **Inicie o backend**: `make run-backend`
2. **Inicie o frontend**: `make run-frontend`
3. **Desenvolva**: Edite arquivos no `frontend/src/`
4. **Teste API**: Use o cliente em `src/lib/api.ts`
5. **Hot-reload**: Mudanças no frontend são aplicadas automaticamente

## 📚 Próximos Passos

- Implementar chamadas reais da API nos componentes
- Adicionar tratamento de erros
- Configurar testes automatizados
- Implementar autenticação/autorização
