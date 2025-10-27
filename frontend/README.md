# Seedbox Frontend

Frontend moderno para gerenciamento de servidor Seedbox, construído com React, TypeScript e shadcn/ui.

## ✨ Características

- **Layout Responsivo**: Sidebar à esquerda, header no topo e conteúdo principal
- **Modo Escuro Nativo**: Interface escura por padrão para melhor experiência visual
- **Componentes Modernos**: Utiliza shadcn/ui para componentes consistentes e acessíveis
- **TypeScript**: Código totalmente tipado para melhor desenvolvimento
- **Tailwind CSS**: Estilização utilitária e responsiva

## 🚀 Tecnologias

- React 19
- TypeScript 5.8
- Vite 7.1
- Tailwind CSS 4.1
- shadcn/ui
- Lucide React (ícones)
- React Router DOM

## 📁 Estrutura do Projeto

```
src/
├── components/
│   └── ui/           # Componentes shadcn/ui
│       ├── button.tsx
│       ├── card.tsx
│       ├── sidebar.tsx
│       └── ...
├── App.tsx           # Componente principal com roteamento
├── AppLayout.tsx     # Layout principal com sidebar e header
├── Dashboard.tsx     # Página do dashboard
└── index.css         # Estilos globais e tema escuro
```

## 🎨 Layout

### Sidebar
- **Posição**: Lado esquerdo da tela
- **Conteúdo**: 
  - Logo e nome da aplicação
  - Menu de navegação (Dashboard, Downloads, Arquivos, Usuários, Analytics)
  - Configurações no rodapé
- **Funcionalidades**: Colapsável, responsiva para mobile

### Header
- **Posição**: Topo da tela
- **Conteúdo**:
  - Botão para toggle da sidebar
  - Título da página atual
  - Ações rápidas (Perfil, Configurações)

### Área Principal
- **Posição**: Entre sidebar e header
- **Conteúdo**: Renderiza o componente da rota ativa
- **Layout**: Container responsivo com padding e largura máxima

## 🌙 Modo Escuro

O aplicativo utiliza modo escuro por padrão com:
- Fundo escuro (`--background: oklch(0.145 0 0)`)
- Texto claro (`--foreground: oklch(0.985 0 0)`)
- Cards com fundo escuro (`--card: oklch(0.205 0 0)`)
- Bordas sutis com transparência

## 📱 Responsividade

- **Desktop**: Sidebar sempre visível, layout em colunas
- **Mobile**: Sidebar colapsável, menu hambúrguer
- **Tablet**: Layout adaptativo entre desktop e mobile

## 🚀 Como Executar

### Desenvolvimento
```bash
npm run dev
```

### Build de Produção
```bash
npm run build
```

### Preview da Build
```bash
npm run preview
```

## 🔧 Configuração

### shadcn/ui
O projeto está configurado com shadcn/ui usando o estilo "new-york" e tema neutro.

### Tailwind CSS
Configurado com Vite e suporte a variáveis CSS customizadas para temas.

## Roadmap

- TheGamesDB Integration to bound information and covers
- TheMoviesDB Integration to bound information and covers
- Webhooks Notification Integration on task status update
- Ntfy Notification Integration on task status update
- Jellyfin library Sync Integration on task status update
- Kativa library Sync Integration on task status update
- RoMM library Sync Integration on task status update

## 🎯 Próximos Passos

- [ ] Implementar autenticação de usuários
- [ ] Adicionar páginas para Downloads, Arquivos, Usuários e Analytics
- [ ] Integração com API backend
- [ ] Sistema de notificações
- [ ] Configurações do usuário
- [ ] Temas personalizáveis

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.
