# Auth Service

Serviço unificado de autenticação que gerencia tokens de cadastro (signup) e recuperação de senha (password reset).

## Funcionalidades

### Signup Tokens
- Gerar tokens seguros para cadastro de usuários
- Validar e usar tokens para criar novos usuários
- Gerenciar expiração de tokens
- Prevenir reutilização de tokens
- Listar e revogar tokens

### Password Reset
- Gerar tokens seguros de recuperação de senha
- Validar e redefinir senhas usando tokens
- Gerenciar expiração de tokens (1 hora por padrão)
- Prevenir reutilização de tokens
- Revogar tokens por email

### Limpeza
- Limpeza automática de tokens expirados (ambos os tipos)

## Uso

### Inicializar o Serviço

```go
import (
    "github.com/gardarr/gardarr/internal/services/auth"
    "github.com/gardarr/gardarr/internal/infra/database"
)

// Inicializar o serviço
db := database.NewDatabase()
service := auth.NewService(db)
```

## Signup Tokens

### Gerar Token de Cadastro

```go
ctx := context.Background()

// Gerar token para cadastro de usuário
token, err := service.GenerateSignupToken(ctx, "user", 48, "")
if err != nil {
    log.Printf("Erro ao gerar token: %v", err)
    return
}

// Gerar token para cadastro de admin com email específico
token, err := service.GenerateSignupToken(ctx, "admin", 24, "admin@example.com")
if err != nil {
    log.Printf("Erro ao gerar token: %v", err)
    return
}

log.Printf("Token gerado: %s", token.Token)
log.Printf("Expira em: %s", token.ExpiresAt)
```

### Usar Token para Criar Usuário

```go
// Quando o usuário clicar no link de cadastro
tokenValue := "token-recebido"
email := "newuser@example.com"
password := "SecurePassword123"

user, err := service.ValidateAndUseSignupToken(ctx, tokenValue, email, password)
if err != nil {
    log.Printf("Erro ao criar usuário: %v", err)
    return
}

log.Printf("Usuário criado: %s com role %s", user.Email, user.Role)
```

### Listar Tokens de Cadastro

```go
tokens, err := service.ListSignupTokens(ctx)
if err != nil {
    log.Printf("Erro ao listar tokens: %v", err)
    return
}

for _, token := range tokens {
    log.Printf("Token: %s, Role: %s, Expires: %s", 
        token.Token, token.Role, token.ExpiresAt)
}
```

### Revogar Token de Cadastro

```go
err := service.RevokeSignupToken(ctx, "token-to-revoke")
if err != nil {
    log.Printf("Erro ao revogar token: %v", err)
}
```

## Password Reset

### Gerar Token de Recuperação de Senha

```go
ctx := context.Background()

// Gerar token para recuperação de senha
token, err := service.GeneratePasswordResetToken(ctx, "user@example.com")
if err != nil {
    log.Printf("Erro ao gerar token: %v", err)
    return
}

// O token gerado pode ser enviado por email
log.Printf("Token gerado: %s", token.Token)
log.Printf("Expira em: %s", token.ExpiresAt)
```

### Redefinir Senha Usando Token

```go
// Quando o usuário clicar no link de recuperação
tokenValue := "token-recebido-por-email"
newPassword := "NovaSenhaSegura123"

err := service.ValidateAndResetPassword(ctx, tokenValue, newPassword)
if err != nil {
    log.Printf("Erro ao redefinir senha: %v", err)
    return
}

log.Println("Senha redefinida com sucesso!")
```

### Revogar Tokens de Recuperação por Email

```go
// Útil quando o usuário muda a senha manualmente
err := service.RevokePasswordResetTokensByEmail(ctx, "user@example.com")
if err != nil {
    log.Printf("Erro ao revogar tokens: %v", err)
}
```

## Limpeza

### Limpar Tokens Expirados de Cadastro

```go
err := service.CleanupExpiredSignupTokens(ctx)
if err != nil {
    log.Printf("Erro ao limpar tokens de cadastro: %v", err)
}
```

### Limpar Tokens Expirados de Recuperação

```go
err := service.CleanupExpiredPasswordResetTokens(ctx)
if err != nil {
    log.Printf("Erro ao limpar tokens de recuperação: %v", err)
}
```

### Limpar Todos os Tokens Expirados

```go
// Execute periodicamente (recomendado: daily cron job)
err := service.CleanupAllExpiredTokens(ctx)
if err != nil {
    log.Printf("Erro ao limpar tokens expirados: %v", err)
}
```

## Exemplo de Fluxo Completo

### Fluxo de Cadastro

```go
package main

import (
    "context"
    "log"
    
    "github.com/gardarr/gardarr/internal/services/auth"
    "github.com/gardarr/gardarr/internal/infra/database"
)

func signupFlow() {
    ctx := context.Background()
    db := database.NewDatabase()
    service := auth.NewService(db)
    
    // 1. Admin gera token de cadastro
    token, err := service.GenerateSignupToken(ctx, "user", 48, "")
    if err != nil {
        log.Fatalf("Erro: %v", err)
    }
    
    // 2. Enviar email com o link (não implementado aqui)
    signupLink := "https://seu-app.com/signup?token=" + token.Token
    log.Printf("Enviar este link para o novo usuário: %s", signupLink)
    
    // 3. Novo usuário clica no link e se cadastra
    user, err := service.ValidateAndUseSignupToken(
        ctx, 
        token.Token, 
        "newuser@example.com", 
        "SecurePass123",
    )
    if err != nil {
        log.Fatalf("Erro ao criar usuário: %v", err)
    }
    
    log.Printf("✓ Usuário %s criado com role %s!", user.Email, user.Role)
}
```

### Fluxo de Recuperação de Senha

```go
func passwordResetFlow() {
    ctx := context.Background()
    db := database.NewDatabase()
    service := auth.NewService(db)
    
    // 1. Usuário solicita recuperação de senha
    email := "user@example.com"
    token, err := service.GeneratePasswordResetToken(ctx, email)
    if err != nil {
        log.Fatalf("Erro: %v", err)
    }
    
    // 2. Enviar email com o link (não implementado aqui)
    resetLink := "https://seu-app.com/reset-password?token=" + token.Token
    log.Printf("Enviar este link para o usuário: %s", resetLink)
    
    // 3. Usuário clica no link e envia nova senha
    newPassword := "NovaSenhaSegura123"
    err = service.ValidateAndResetPassword(ctx, token.Token, newPassword)
    if err != nil {
        log.Fatalf("Erro ao redefinir senha: %v", err)
    }
    
    log.Println("✓ Senha redefinida com sucesso!")
}
```

## Validações

### GenerateSignupToken
- Role não pode ser vazio
- Role deve ser 'admin' ou 'user'
- Expiração deve ser no mínimo 1 hora

### ValidateAndUseSignupToken
- Token não pode ser vazio
- Email não pode ser vazio
- Senha não pode ser vazia
- Token não pode estar expirado
- Token não pode ter sido usado anteriormente
- Se o token tiver email específico, deve corresponder ao email fornecido
- Usuário não pode já existir

### GeneratePasswordResetToken
- Email não pode ser vazio
- Usuário deve existir no sistema
- Tokens anteriores do mesmo email são automaticamente revogados

### ValidateAndResetPassword
- Token não pode ser vazio
- Senha não pode ser vazia
- Senha deve ter no mínimo 8 caracteres
- Token não pode estar expirado
- Token não pode ter sido usado anteriormente

## Segurança

- **Tokens criptograficamente seguros**: Gerados com 32 bytes (256 bits) de entropia
- **Expiração automática**: 
  - Signup tokens: Configurável pelo admin
  - Password reset tokens: 1 hora
- **Uso único**: Tokens só podem ser usados uma vez
- **Proteção contra enumeração**: Não revela se um usuário existe ou não (password reset)
- **Hash seguro de senhas**: Utiliza Argon2id para hash de senhas
- **Revogação automática**: Password reset tokens anteriores são revogados ao gerar novo

## Testes

Execute os testes unitários:

```bash
cd apps/backend/gardarr/backend
go test ./internal/services/auth/... -v
```

## Estrutura de Dados

### SignupToken

```go
type SignupToken struct {
    UUID      uuid.UUID  // Identificador único
    Token     string     // Token para cadastro (32 bytes base64)
    Email     string     // Email específico (opcional)
    Role      string     // Role do usuário (admin/user)
    ExpiresAt time.Time  // Data de expiração
    UsedAt    *time.Time // Data de uso (nil se não usado)
    CreatedAt time.Time  // Data de criação
    UpdatedAt time.Time  // Data de atualização
}
```

### PasswordResetToken

```go
type PasswordResetToken struct {
    UUID      uuid.UUID  // Identificador único
    Token     string     // Token para reset (32 bytes base64)
    Email     string     // Email do usuário
    ExpiresAt time.Time  // Data de expiração
    UsedAt    *time.Time // Data de uso (nil se não usado)
    CreatedAt time.Time  // Data de criação
    UpdatedAt time.Time  // Data de atualização
}
```

## Considerações

- Configure um cron job para executar `CleanupAllExpiredTokens()` diariamente
- Implemente rate limiting para prevenir abuso da geração de tokens
- Envie emails de forma assíncrona para melhor performance
- Considere adicionar logging para auditoria de segurança
- Em produção, use HTTPS para todas as comunicações
- Para signup tokens, defina políticas claras de expiração baseadas em seu caso de uso

