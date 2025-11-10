# Sistema de Eventos - Gardarr

## Visão Geral

O sistema de eventos rastreia automaticamente mudanças de estado dos torrents, integrando-se ao polling de estatísticas existente. Todos os eventos são armazenados em banco de dados com timestamps precisos e podem ser consultados via API.

## Tipos de Eventos

As constantes de tipos de eventos estão definidas em `internal/constants/event.go`:

```go
const (
    EventTypeTorrentStateChange = "torrent.state_change"
    EventTypeTorrentAdded       = "torrent.added"
    EventTypeTorrentRemoved     = "torrent.removed"
    EventTypeTorrentCompleted   = "torrent.completed"
)
```

### `torrent.state_change`
Disparado quando o estado de um torrent muda (ex: `DOWNLOADING` → `UPLOADING`)
- **Campos**: `old_value`, `new_value`, `task_hash`
- **Metadata**: `name`, `old_progress`, `new_progress`

### `torrent.added`
Disparado quando um novo torrent é detectado
- **Campos**: `new_value` (estado inicial), `task_hash`
- **Metadata**: `name`, `progress`

### `torrent.removed`
Disparado quando um torrent não é mais encontrado
- **Campos**: `old_value` (último estado), `task_hash`
- **Metadata**: `last_progress`

### `torrent.completed`
Disparado quando um torrent atinge 100% de progresso
- **Campos**: `new_value` (estado atual), `task_hash`
- **Metadata**: `name`

## Estrutura de Dados

### Event Entity
```go
type Event struct {
    UUID      uuid.UUID
    AgentID   uuid.UUID
    Type      string // Usar constantes de constants.EventType*
    TaskHash  string
    OldValue  string
    NewValue  string
    Metadata  map[string]interface{}
    CreatedAt time.Time
}
```

## API Endpoints

### `GET /v1/events`
Lista eventos com filtros opcionais

**Query Parameters:**
- `agent_id` (string, opcional): UUID do agente
- `type` (string, opcional): Tipo do evento
- `limit` (int, default: 50, max: 200): Número de resultados
- `offset` (int, default: 0): Offset para paginação

**Exemplo:**
```bash
curl -X GET "http://localhost:3000/v1/events?agent_id=abc-123&type=torrent.state_change&limit=10"
```

**Response:**
```json
{
  "events": [
    {
      "uuid": "event-uuid",
      "agent_id": "agent-uuid",
      "type": "torrent.state_change",
      "task_hash": "abc123",
      "old_value": "DOWNLOADING",
      "new_value": "UPLOADING",
      "metadata": {
        "name": "Ubuntu 22.04",
        "old_progress": 0.95,
        "new_progress": 1.0
      },
      "created_at": "2025-11-09T20:00:00Z"
    }
  ],
  "total": 1
}
```

### `GET /v1/events/:uuid`
Obtém um evento específico por UUID

**Exemplo:**
```bash
curl -X GET "http://localhost:3000/v1/events/event-uuid"
```

## Integração com Statistics

O sistema de eventos está integrado ao serviço de estatísticas (`internal/services/statistics`):

```go
// Em collectAgentData():
if s.eventService != nil {
    _ = s.eventService.TrackTasks(ctx, tasks, a.UUID, now)
    _ = s.eventService.DetectRemovedTasks(ctx, tasks, a.UUID, now)
}
```

- **Polling Interval**: Configurado via `STATISTICS_INTERVAL` (default: 30s)
- **Detecção Automática**: Compara estados a cada ciclo de polling
- **Performance**: Execução concorrente por agente

## Retenção de Dados

### Configuração via Variável de Ambiente
```env
# Dias para manter eventos (default: 30, 0 = sem limite)
EVENT_RETENTION_DAYS=30
```

O serviço lê automaticamente esta configuração na inicialização:
```go
func NewService(db *database.Database) *Service {
    return &Service{
        retentionDays: env.Get("EVENT_RETENTION_DAYS").Default(30).ValueInt(),
        // ...
    }
}
```

### Exemplos de Configuração
```env
# Manter eventos por 7 dias (ideal para ambientes de teste)
EVENT_RETENTION_DAYS=7

# Manter eventos por 90 dias (recomendado para produção)
EVENT_RETENTION_DAYS=90

# Manter eventos indefinidamente
EVENT_RETENTION_DAYS=0
```

### Limpeza Automática
O serviço oferece método para purgar eventos antigos baseado na configuração:
```go
eventService.PurgeOldEvents(ctx) // Remove eventos mais antigos que EVENT_RETENTION_DAYS
```

### Limpeza de Estados em Memória
Estados de torrents inativos (>24h) são automaticamente removidos:
```go
eventService.CleanStaleStates() // Remove estados não vistos em 24h
```

## Arquitetura

### Componentes

1. **Constants** (`internal/constants/event.go`)
   - Define constantes de tipos de eventos

2. **Entity** (`internal/entities/event.go`)
   - Define estrutura do evento

3. **Model** (`internal/models/event_model.go`)
   - Mapeamento para banco de dados (GORM)

4. **Repository** (`internal/repository/event/repository.go`)
   - Operações de persistência
   - Não deve conter lógica de negócio

5. **Service** (`internal/services/events/service.go`)
   - Lógica de rastreamento de estados
   - Detecção de mudanças
   - Cache em memória de estados
   - Delega persistência ao repository

6. **Routes** (`internal/routes/api/v1/events/routes.go`)
   - Endpoints REST

7. **Migration** (`009_create_events_table`)
   - Criação da tabela de eventos

## Uso Futuro: Webhooks

A estrutura está preparada para webhooks:

```go
// Exemplo de implementação futura
type WebhookConfig struct {
    URL    string
    Events []string // Usar constants.EventType*
}

func (s *Service) NotifyWebhooks(event *Event) {
    // Enviar evento para webhooks configurados
}
```

### Possíveis Notificações
- Torrent completado → notificar Plex para atualizar biblioteca
- Estado mudou → dashboard em tempo real
- Torrent removido → limpeza de arquivos
- Torrent adicionado → logs/auditoria

## Performance

### Estado em Memória
- Estados de torrents mantidos em `map[string]*TaskState`
- Acesso O(1) para verificação de mudanças
- Sincronização com `sync.RWMutex`

### Concorrência Multi-Nível
1. **Nível Agent**: Cada agente processado em goroutine separada
2. **Nível Task**: Cada task processada concorrentemente
   - `TrackTasks`: Goroutines para cada tarefa
   - `DetectRemovedTasks`: Goroutines para cada remoção
3. **Buffered Channels**: Eventos coletados em canais
4. **Lock Granular**: RWMutex minimiza contenção

### Otimizações
- ✅ Processamento paralelo de tarefas
- ✅ Lock apenas quando necessário (read/write separados)
- ✅ Canais buffered para coleta de eventos
- ✅ Criação de eventos em batch
- ✅ Sem impacto no desempenho do polling

### Índices de Banco
```sql
CREATE INDEX idx_events_agent_id ON events(agent_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_task_hash ON events(task_hash);
CREATE INDEX idx_events_created_at ON events(created_at);
```

## Configuração Recomendada

### Arquivo .env
```env
# Eventos - Sistema de rastreamento
EVENT_RETENTION_DAYS=30        # Retenção de eventos (dias)

# Estatísticas - Necessário para eventos funcionarem
STATISTICS_ENABLED=true
STATISTICS_INTERVAL=30s
STATISTICS_DIR=./data/statistics
STATISTICS_RETENTION_DAYS=7
```

### Recomendações por Ambiente

**Desenvolvimento**:
```env
EVENT_RETENTION_DAYS=7
STATISTICS_INTERVAL=60s
```

**Produção**:
```env
EVENT_RETENTION_DAYS=90
STATISTICS_INTERVAL=30s
```

**Heavy Load** (muitos torrents):
```env
EVENT_RETENTION_DAYS=30
STATISTICS_INTERVAL=30s
```

## Troubleshooting

### Eventos não sendo criados
1. Verificar se statistics está habilitado: `STATISTICS_ENABLED=true`
2. Verificar logs do serviço de estatísticas
3. Confirmar que migration foi aplicada: `009_create_events_table`
4. Verificar se `EVENT_RETENTION_DAYS` não é 0 (se usar purge automático)

### Muitos eventos gerados
1. Ajustar `STATISTICS_INTERVAL` para polling menos frequente
2. Implementar filtros no frontend
3. Configurar retenção menor: `EVENT_RETENTION_DAYS=7`
4. Implementar purge automático agendado

### Performance degradada
1. Verificar tamanho da tabela de eventos
2. Executar limpeza: `eventService.PurgeOldEvents(ctx)`
3. Verificar índices do banco de dados
4. Considerar reduzir `EVENT_RETENTION_DAYS`

## Exemplos de Uso

### Frontend - Página de Histórico
```typescript
// Buscar eventos recentes
const response = await api.get('/events', {
  params: {
    limit: 20,
    offset: 0
  }
});

// Filtrar por agente específico
const agentEvents = await api.get('/events', {
  params: {
    agent_id: selectedAgent.uuid,
    type: 'torrent.state_change'
  }
});
```

### Monitoramento de Completados
```typescript
// Buscar torrents que completaram hoje
const today = new Date().toISOString().split('T')[0];
const completed = await api.get('/events', {
  params: {
    type: 'torrent.completed',
    // Adicionar filtro de data no backend se necessário
  }
});
```

## Próximos Passos

1. ✅ Sistema de eventos básico implementado
2. 🔄 Criar página de histórico no frontend
3. 📋 Implementar webhooks
4. 📊 Adicionar métricas e analytics
5. 🔔 Notificações em tempo real (WebSocket)
6. 🎯 Filtros avançados (por data, múltiplos agentes, etc)
7. 📁 Export de eventos (CSV, JSON)
