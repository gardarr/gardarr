# Middlewares

Este pacote contém middlewares para autenticação, autorização e outras funcionalidades de segurança.

## Middlewares Disponíveis

### SessionMiddleware

Valida tokens de sessão de cookies com rate limiting.

```go
// Uso básico
router.Use(middlewares.SessionMiddleware(db))

// Em rotas protegidas
protected := router.Group("/api")
protected.Use(middlewares.SessionMiddleware(db))
protected.GET("/profile", getProfile)
```

### OptionalSessionMiddleware

Valida sessões mas não bloqueia se não houver token (útil para rotas que podem ser acessadas com ou sem autenticação).

```go
router.Use(middlewares.OptionalSessionMiddleware(db))
```

### RequireAdminRole

Valida que o usuário autenticado tem role "admin". **Deve ser usado após SessionMiddleware**.

```go
// Uso correto - após SessionMiddleware
adminRoutes := router.Group("/admin")
adminRoutes.Use(middlewares.SessionMiddleware(db))
adminRoutes.Use(middlewares.RequireAdminRole())
adminRoutes.GET("/users", listUsers)
adminRoutes.POST("/users", createUser)
```

### RequireAgentBearerToken

Valida tokens Bearer para agentes externos.

```go
agentRoutes := router.Group("/agent")
agentRoutes.Use(middlewares.RequireAgentBearerToken())
agentRoutes.POST("/status", updateStatus)
```

## Exemplo de Uso Completo

```go
package main

import (
    "github.com/gardarr/gardarr/internal/middlewares"
    "github.com/gin-gonic/gin"
)

func setupRoutes(router *gin.Engine, db *database.Database) {
    // Rotas públicas
    router.GET("/health", healthCheck)
    router.POST("/signup/verify", verifySignup)
    
    // Rotas que requerem autenticação
    protected := router.Group("/api")
    protected.Use(middlewares.SessionMiddleware(db))
    {
        protected.GET("/profile", getProfile)
        protected.PUT("/profile", updateProfile)
    }
    
    // Rotas que requerem role admin
    admin := router.Group("/admin")
    admin.Use(middlewares.SessionMiddleware(db))
    admin.Use(middlewares.RequireAdminRole())
    {
        admin.GET("/users", listUsers)
        admin.POST("/users", createUser)
        admin.DELETE("/users/:id", deleteUser)
        admin.GET("/signup/magic_link", listMagicLinks)
        admin.POST("/signup/magic_link", createMagicLink)
    }
    
    // Rotas para agentes
    agent := router.Group("/agent")
    agent.Use(middlewares.RequireAgentBearerToken())
    {
        agent.POST("/status", updateAgentStatus)
        agent.GET("/tasks", getTasks)
    }
}
```

## Context Keys

Os middlewares definem as seguintes chaves no contexto do Gin:

- `middlewares.UserContextKey` - Contém a entidade `*entities.User`
- `middlewares.SessionContextKey` - Contém a entidade `*entities.Session`

### Acessando Dados do Usuário

```go
func getProfile(c *gin.Context) {
    // Obter usuário do contexto
    userInterface, exists := c.Get(middlewares.UserContextKey)
    if !exists {
        c.JSON(401, gin.H{"error": "User not found in context"})
        return
    }
    
    user, ok := userInterface.(*entities.User)
    if !ok {
        c.JSON(500, gin.H{"error": "Invalid user data"})
        return
    }
    
    c.JSON(200, gin.H{
        "email": user.Email,
        "role": user.Role,
        "uuid": user.UUID,
    })
}
```

## Códigos de Resposta

### SessionMiddleware
- `401 Unauthorized` - Token de sessão inválido ou ausente
- `429 Too Many Requests` - Rate limit excedido

### RequireAdminRole
- `401 Unauthorized` - Usuário não autenticado
- `403 Forbidden` - Usuário não tem role admin
- `500 Internal Server Error` - Dados de usuário inválidos

### RequireAgentBearerToken
- `403 Forbidden` - Token Bearer ausente ou inválido

## Rate Limiting

O `SessionMiddleware` inclui rate limiting automático para prevenir ataques de força bruta:

- Registra tentativas de autenticação falhadas
- Bloqueia IPs após múltiplas tentativas
- Reset automático após autenticação bem-sucedida
- Log de atividades suspeitas

## Segurança

### Cookies de Sessão
- HttpOnly: true (não acessível via JavaScript)
- Secure: true (apenas HTTPS em produção)
- SameSite: Lax (proteção CSRF)

### Rate Limiting
- Identificação por IP + User-Agent
- Bloqueio temporário após falhas
- Log de atividades suspeitas

### Validação de Roles
- Verificação rigorosa de tipos
- Mensagens de erro informativas
- Abort imediato em caso de falha

## Testes

Execute os testes dos middlewares:

```bash
cd apps/backend/gardarr/backend
go test ./internal/middlewares/... -v
```

## Considerações de Produção

1. **HTTPS**: Sempre use HTTPS em produção para cookies seguros
2. **Rate Limiting**: Configure limites apropriados para seu caso de uso
3. **Logging**: Monitore logs de segurança para atividades suspeitas
4. **Session Timeout**: Configure timeouts apropriados para sessões
5. **Admin Access**: Use com cuidado - admin tem acesso total ao sistema

## Troubleshooting

### Erro 401 "Authentication required"
- Verifique se `SessionMiddleware` está sendo usado antes de `RequireAdminRole`
- Confirme que o cookie de sessão está sendo enviado
- Verifique se a sessão não expirou

### Erro 403 "Admin privileges required"
- Confirme que o usuário tem role "admin"
- Verifique se o usuário foi criado corretamente
- Confirme que o role foi definido durante o signup

### Erro 500 "Invalid user data"
- Problema interno - verifique logs do servidor
- Pode indicar corrupção de dados ou bug no código
