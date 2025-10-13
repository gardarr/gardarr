# Sistema de Autenticação

Sistema completo de autenticação com sessões baseadas em cookies HTTP-only.

## 📋 Visão Geral

### Tecnologias Utilizadas
- **Hash de senha**: Argon2id (Time=3, Memory=128MB)
- **Sessões**: Tokens aleatórios armazenados em banco de dados
- **Cookies**: HTTP-only, duração de 7 dias
- **Segurança**: Salt único por usuário, tokens criptograficamente seguros

---

## 🔌 Endpoints da API

### Base URL
```
http://localhost:3000/v1/auth
```

### 1. Registro de Usuário

**Endpoint**: `POST /v1/auth/register`

**Request Body**:
```json
{
  "email": "usuario@example.com",
  "password": "SenhaSegura123"
}
```

**Validações**:
- Email válido (formato)
- Senha mínima de 8 caracteres
- Email único no sistema

**Response** (201 Created):
```json
{
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@example.com",
    "created_at": "2025-10-13T12:00:00Z"
  }
}
```

**Cookies Definidos**:
- `session_token`: Token de sessão (HTTP-only, 7 dias)

**Possíveis Erros**:
- `400 Bad Request`: Validação falhou
- `409 Conflict`: Email já existe

---

### 2. Login

**Endpoint**: `POST /v1/auth/login`

**Request Body**:
```json
{
  "email": "usuario@example.com",
  "password": "SenhaSegura123"
}
```

**Response** (200 OK):
```json
{
  "user": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@example.com",
    "created_at": "2025-10-13T12:00:00Z"
  }
}
```

**Cookies Definidos**:
- `session_token`: Token de sessão (HTTP-only, 7 dias)

**Possíveis Erros**:
- `400 Bad Request`: Validação falhou
- `401 Unauthorized`: Credenciais inválidas

---

### 3. Obter Usuário Atual (Protegido)

**Endpoint**: `GET /v1/auth/me`

**Requisitos**: Cookie `session_token` válido

**Response** (200 OK):
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "email": "usuario@example.com",
  "created_at": "2025-10-13T12:00:00Z"
}
```

**Possíveis Erros**:
- `401 Unauthorized`: Sessão inválida ou expirada

---

### 4. Logout (Protegido)

**Endpoint**: `POST /v1/auth/logout`

**Requisitos**: Cookie `session_token` válido

**Response** (200 OK):
```json
{
  "message": "Logged out successfully"
}
```

**Efeitos**:
- Invalida a sessão atual
- Remove o cookie `session_token`

---

### 5. Logout de Todos os Dispositivos (Protegido)

**Endpoint**: `POST /v1/auth/logout-all`

**Requisitos**: Cookie `session_token` válido

**Response** (200 OK):
```json
{
  "message": "Logged out from all devices"
}
```

**Efeitos**:
- Invalida TODAS as sessões do usuário
- Remove o cookie `session_token`

---

### 6. Listar Sessões Ativas (Protegido)

**Endpoint**: `GET /v1/auth/sessions`

**Requisitos**: Cookie `session_token` válido

**Response** (200 OK):
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "ip_address": "192.168.1.100",
    "created_at": "2025-10-13T12:00:00Z",
    "expires_at": "2025-10-20T12:00:00Z"
  },
  {
    "id": "223e4567-e89b-12d3-a456-426614174001",
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)...",
    "ip_address": "192.168.1.101",
    "created_at": "2025-10-12T10:30:00Z",
    "expires_at": "2025-10-19T10:30:00Z"
  }
]
```

---

## 🌐 Como o Frontend Consome

### Passo a Passo Completo

#### 1. **Registro de Novo Usuário**

```javascript
// React/Next.js/Vue/etc
async function registerUser(email, password) {
  try {
    const response = await fetch('http://localhost:3000/v1/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // IMPORTANTE: envia/recebe cookies
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const data = await response.json();
    console.log('Usuário criado:', data.user);
    
    // Cookie de sessão foi automaticamente definido
    // Redirecionar para dashboard ou home
    window.location.href = '/dashboard';
  } catch (error) {
    console.error('Erro no registro:', error.message);
  }
}
```

#### 2. **Login**

```javascript
async function login(email, password) {
  try {
    const response = await fetch('http://localhost:3000/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // IMPORTANTE: envia/recebe cookies
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const data = await response.json();
    console.log('Login bem-sucedido:', data.user);
    
    // Cookie de sessão foi automaticamente definido
    window.location.href = '/dashboard';
  } catch (error) {
    console.error('Erro no login:', error.message);
  }
}
```

#### 3. **Verificar Usuário Autenticado**

```javascript
async function getCurrentUser() {
  try {
    const response = await fetch('http://localhost:3000/v1/auth/me', {
      method: 'GET',
      credentials: 'include', // Envia o cookie de sessão
    });

    if (!response.ok) {
      // Usuário não autenticado
      window.location.href = '/login';
      return null;
    }

    const user = await response.json();
    return user;
  } catch (error) {
    console.error('Erro ao verificar autenticação:', error);
    return null;
  }
}

// Uso em componente React
useEffect(() => {
  async function checkAuth() {
    const user = await getCurrentUser();
    if (user) {
      setUser(user);
    }
  }
  checkAuth();
}, []);
```

#### 4. **Logout**

```javascript
async function logout() {
  try {
    const response = await fetch('http://localhost:3000/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      // Cookie foi removido automaticamente
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Erro no logout:', error);
  }
}
```

#### 5. **Fazer Requisições Autenticadas**

```javascript
async function getProtectedData() {
  const response = await fetch('http://localhost:3000/v1/some-protected-endpoint', {
    method: 'GET',
    credentials: 'include', // SEMPRE incluir para enviar cookies
  });

  if (response.status === 401) {
    // Sessão expirou, redirecionar para login
    window.location.href = '/login';
    return;
  }

  return await response.json();
}
```

---

## 🔐 Segurança Implementada

### 1. **Senhas**
- Hash com **Argon2id** (vencedor do Password Hashing Competition)
- Parâmetros: Time=3, Memory=128MB (resistente a ataques GPU)
- Salt único de 16 bytes por usuário
- ~9x mais difícil de quebrar via brute-force

### 2. **Sessões**
- Tokens aleatórios de 256 bits (32 bytes)
- Armazenados no banco com hash
- Expiração automática após 7 dias
- Rastreamento de User-Agent e IP

### 3. **Cookies**
- **HTTP-only**: JavaScript não pode acessar (previne XSS)
- **SameSite**: Proteção contra CSRF
- **Secure**: Apenas HTTPS em produção
- Duração: 7 dias

### 4. **Middleware de Autenticação**
```go
// Usar em rotas protegidas
protected := router.Group("")
protected.Use(middlewares.SessionMiddleware(db))
protected.GET("/protected", handler)
```

---

## 🎯 Exemplo Completo: Componente React

```jsx
import { useState, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  async function checkAuthentication() {
    try {
      const response = await fetch('http://localhost:3000/v1/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(email, password) {
    const response = await fetch('http://localhost:3000/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      const data = await response.json();
      setUser(data.user);
    } else {
      const error = await response.json();
      alert(error.error);
    }
  }

  async function handleLogout() {
    await fetch('http://localhost:3000/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
  }

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div>
      <h1>Bem-vindo, {user.email}!</h1>
      <button onClick={handleLogout}>Sair</button>
    </div>
  );
}
```

---

## ⚠️ Importante para Produção

### 1. **CORS**
Configure o backend para aceitar o domínio do frontend:
```go
// Já configurado em cmd/service/service.go
AllowOrigins: []string{"https://seu-dominio.com"}
```

### 2. **HTTPS**
Em produção, sempre use HTTPS e configure:
```go
c.SetCookie(
    sessionCookieName,
    token,
    maxAge,
    "/",
    "seu-dominio.com",
    true,  // secure = true
    true,  // httpOnly = true
)
```

### 3. **Variables de Ambiente**
```env
APP_DOMAINS=https://seu-frontend.com
DATABASE_URL=postgresql://...
```

---

## 📊 Banco de Dados

### Tabela Sessions
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_uuid UUID NOT NULL REFERENCES users(uuid),
    token VARCHAR(255) UNIQUE NOT NULL,
    user_agent VARCHAR(500),
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_uuid ON sessions(user_uuid);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

---

## 🧹 Limpeza de Sessões Expiradas

O sistema inclui uma função para limpar sessões expiradas:

```go
// Executar periodicamente (cron job, scheduler, etc)
sessionService.CleanupExpiredSessions(ctx)
```

Recomenda-se executar essa limpeza a cada 1 hora ou diariamente.

