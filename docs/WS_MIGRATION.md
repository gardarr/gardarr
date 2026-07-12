# Plano de Migração para WebSocket: Listagem de Torrents (/torrents)

## 1. Objetivo
Atualmente, a listagem de torrents no frontend depende de requisições REST (ex: `GET /v1/workers/tasks`), o que não é ideal para atualizações em tempo real do progresso, estado e metadados dos torrents. O objetivo desta migração é introduzir WebSockets para transmitir atualizações de eventos aos clientes conectados instantaneamente, tornando a interface gráfica dinâmica, reativa e reduzindo a sobrecarga de requisições (polling).

**Aviso:** Conforme alinhamento, **NÃO é necessário manter retrocompatibilidade**. Sendo assim, as antigas chamadas REST para listagem de torrents serão totalmente removidas em favor de uma arquitetura 100% orientada a eventos (WebSocket).

## 2. Visão Geral da Arquitetura
Como o sistema backend já possui um módulo de eventos e um `eventPollerSvc` que rastreia mudanças no estado das tasks (através do `eventsService.EnableRealTimeEmission`), a arquitetura ideal adota o padrão CQRS-like (separação entre leitura e escrita):

- **Leitura (Read/State):** 100% migrada para **WebSocket**. Ao conectar, o backend envia a lista inicial completa (payload de inicialização). A partir daí, ouve o canal de eventos emitidos e faz o broadcast das atualizações incrementais (`Tasks`) para os clientes conectados. Os endpoints REST antigos de listagem serão deletados.
- **Escrita/Mutações (Create, Update, Delete):** Permanecem **intactas via REST**. Ações do usuário (adicionar, pausar, renomear, deletar torrent) continuam usando chamadas HTTP padrão para garantir retornos síncronos de erro/sucesso. Ao completar a ação com sucesso, o backend dispara o evento no _bus_ interno, e o próprio WebSocket se encarrega de atualizar a UI do usuário em tempo real.
- **Frontend:** Abrir a conexão WS assim que carregar a tela `/torrents`. O frontend não fará mais nenhuma requisição REST inicial para buscar torrents. O estado inicial será populado pelo primeiro evento recebido no WebSocket, e atualizações subsequentes manterão o estado sincronizado reativamente às ações do REST.

## 3. Tarefas de Backend

### 3.1. Adicionar Dependência
O projeto em Go não possui atualmente uma biblioteca dedicada a WebSockets, portanto, adicionaremos o pacote padrão adotado pela comunidade para uso em conjunto com Gin:
```bash
go get github.com/gorilla/websocket
```

### 3.2. Criar Hub de Conexões (WebSocket Manager)
Criar uma estrutura em `backend/internal/services/websocket/hub.go` responsável por:
- Registrar novas conexões de clientes.
- Desregistrar/remover conexões (em caso de desconexão ou erro).
- Enviar o "State inicial" (todas as tasks) logo após o cliente conectar e autenticar com sucesso.
- Receber mensagens do canal de eventos (`eventSvc`) e realizar o *broadcast* das informações estruturadas em JSON aos clientes inscritos.

### 3.3. Criar Endpoint de WebSocket e Remover REST
1. Adicionar o endpoint `GET /v1/ws/torrents`:
   - Utilizar o `upgrader` do Gorilla WebSocket para converter a requisição HTTP em conexão WS.
   - Validar a autenticação na conexão. Como os navegadores não suportam o envio de headers na API nativa do WebSocket, o token de sessão pode ser validado por meio de um parâmetro de query (ex: `?token=XYZ`) ou por *cookies*.
   - Iniciar a rotina de escuta daquele cliente (ping/pong) e a rotina de escrita.
2. Remover as rotas antigas em `backend/internal/routes/api/v1/workers/worker_routes.go` (`GET /workers/tasks` e `GET /worker/:id/tasks`), bem como seus handlers correspondentes.

### 3.4. Consumir e Enviar os Eventos
O JSON enviado pelo backend deverá suportar tanto a carga inicial quanto atualizações incrementais. Exemplo de contrato:
```json
// Inicialização
{
  "event_type": "INITIAL_STATE",
  "payload": [ { "id": "1", "state": "downloading" }, ... ]
}

// Atualização Incremental
{
  "event_type": "TASK_UPDATED",
  "worker_id": "uuid-do-worker",
  "payload": {
     "id": "1",
     "state": "downloading",
     "progress": 45.5,
     "download_speed": 1024
  }
}
```

## 4. Tarefas de Frontend

### 4.1. Atualização do Serviço e Hooks
Substituir as chamadas de listagem no `TorrentService` (`frontend/src/services/torrents.ts`) pela inicialização de WebSocket (`new WebSocket(wsUrl)`).
- Remover as funções antigas `listTasks` e `listWorkerTasks`.
- **Mecanismo de Reconexão:** Implementar *Exponential Backoff* para garantir reconexão automática caso o WebSocket caia. Ao reconectar, a arquitetura garante que um novo `INITIAL_STATE` seja recebido, evitando perda de estado.
- **Ping/Pong:** Configurar ping/pong (se implementado pelo client) para não encerrar silenciosamente em caso de inatividade.

### 4.2. Fluxo da Interface Gráfica
1. O usuário entra na rota `/torrents` (exibindo um _loading state_).
2. A conexão WebSocket é estabelecida imediatamente.
3. Ao receber o evento `INITIAL_STATE`, o React localiza a tabela/lista e o _loading_ é desativado.
4. Quando chegam mensagens incrementais (como `TASK_UPDATED`), o frontend apenas mescla os novos dados ao estado existente na memória, disparando re-renders otimizados.

### 4.3. Tratamento de Múltiplos Eventos
Criar um *reducer* ou *switch-case* (num hook como `useTorrentsWS`) para lidar com:
- `INITIAL_STATE`: Substituir todo o array atual pelo novo _payload_.
- `TASK_ADDED`: Anexar o novo torrent à lista.
- `TASK_UPDATED`: Mesclar as mudanças com os dados existentes do torrent específico.
- `TASK_REMOVED`: Filtrar e remover o torrent do array.
- `WORKER_STATS_UPDATED`: Atualizar os mostradores globais de velocidade/estatísticas na UI.

## 5. Integração com Métricas (Prometheus e UI Stats)

A remoção dos endpoints REST aplica-se apenas às rotas voltadas para a listagem da UI. Os endpoints de métricas seguem lógicas distintas:

1. **Métricas do Prometheus (`GET /metrics`)**:
   - **Intacto**: Este endpoint é consumido por agentes externos (ex: Grafana/Prometheus) e deve permanecer como REST.
   - Embora as *rotas* REST da UI sejam removidas, os métodos internos no `workermanager.Service` (como `ListWorkersTasks`) continuarão existindo no backend, pois o `metricsService.Exporter` precisará deles para computar os dados periodicamente.

2. **Estatísticas da UI (`GET /worker/:id/tasks/stats`)**:
   - **Migrado para o WebSocket**: Atualmente a interface puxa as estatísticas globais via REST. Como o WebSocket já estará aberto e processando em tempo real, as estatísticas globais (taxa total de down/up) também passarão a ser transmitidas via evento (ex: `"event_type": "WORKER_STATS_UPDATED"`).
   - O endpoint REST `getWorkerTasksStats` será removido, concentrando o tráfego 100% no socket.

## 6. Limpeza de Código Morto (Estatísticas)
Ao revisar a base de código do frontend, constatou-se que a função `getWorkerTaskStats` e os dados agregados da rota de `/worker/:id/tasks/stats` (como nuvem de palavras e total de disco) não são chamados ou renderizados em nenhum componente da interface gráfica atual.
Para simplificar a migração e remover peso morto, o plano inclui:
- **Backend**: Remover o handler `getWorkerTasksStats` e a rota REST correspondente (`GET /worker/:id/tasks/stats`) em `worker_routes.go`. A funcionalidade pode ser reconstruída exclusivamente via WebSocket no futuro, se e quando a UI demandar.
- **Frontend**: Deletar a função `getWorkerTaskStats` no arquivo `services/workers.ts` e qualquer interface (`TaskStats`) tipada associada que não possua outras dependências ativas.

## 7. Segurança e Encerramento de Sessão (Logout)
Uma particularidade de WebSockets é que a validação do token (cookie de sessão) ocorre **apenas no handshake inicial** (upgrade da requisição HTTP). Se o usuário fizer o logout (que invalida o cookie e apaga a sessão no banco), a conexão TCP do WebSocket pode, teoricamente, continuar aberta transmitindo eventos. 
Para mitigar esse risco de segurança, o plano inclui:
- **Frontend (`AuthContext.tsx` / Hooks):** Garantir que, ao acionar o método `logout`, a instância global do WebSocket seja forçadamente encerrada (`ws.close()`).
- **Backend (Opcional/Avançado):** O Hub do WebSocket mapeará qual token/UUID de usuário pertence a qual conexão de socket. Caso o `sessionService.DeleteSession` (ou `logoutAll`) seja chamado, o Hub poderá derrubar ativamente os clientes conectados atrelados àquela sessão.

## 8. Critérios de Aceite e Considerações Finais
- [ ] O código antigo de requisições REST para listagem (tanto rotas do backend quanto requisições do frontend) foi completamente apagado.
- [ ] Todo o código "morto" referente às estatísticas de worker foi devidamente limpo no frontend e backend.
- [ ] O fluxo é 100% dependente do WebSocket para recuperar os dados e atualizar a tabela.
- [ ] A conexão WS é devidamente autenticada, impedindo acesso anônimo.
- [ ] O WebSocket encerra imediatamente a conexão assim que a sessão do usuário for finalizada (logout local ou encerramento de sessão remota).
- [ ] O frontend lida elegantemente com desconexões acidentais, tentando reconectar e refetch do `INITIAL_STATE`.
- [ ] O componente no React destrói a conexão (`ws.close()`) devidamente ao desmontar, evitando *memory leaks*.
