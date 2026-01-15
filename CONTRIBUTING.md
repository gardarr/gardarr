# Contributing to Gardarr

First off, thank you for considering contributing to Gardarr! It's people like you that make Gardarr such a great tool for the selfhosted community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Testing](#testing)
- [Documentation](#documentation)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to creating a welcoming and inclusive environment. Please be respectful and constructive in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/gardarr.git
   cd gardarr
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/jfxdev/gardarr.git
   ```

## Development Setup

### Prerequisites

- Go 1.25 or later
- Node.js 20 or later
- npm 10 or later
- Docker (optional, for containerized development)

### Quick Start

```bash
# Install all dependencies
make install

# Run in development mode (frontend + backend)
make dev
```

### Running Separately

**Terminal 1 - Backend:**
```bash
make run-backend
# Backend runs at http://localhost:3200
```

**Terminal 2 - Frontend:**
```bash
make run-frontend
# Frontend runs at http://localhost:5173
```

### Environment Configuration

Create a `.env` file in the project root:

```env
APP_PORT=3200
APP_URL=http://localhost:3200
GIN_MODE=debug
```

See [backend/docs/ENVIRONMENT_VARIABLES.md](backend/docs/ENVIRONMENT_VARIABLES.md) for all options.

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-ntfy-integration`
- `fix/webhook-timeout-issue`
- `docs/update-api-reference`
- `refactor/simplify-auth-flow`

### Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the [coding standards](#coding-standards)

3. **Test your changes**:
   ```bash
   make test-backend
   cd frontend && npm test
   ```

4. **Commit your changes** using [conventional commits](#commit-messages)

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** against `main`

## Pull Request Process

1. **Fill out the PR template** completely
2. **Ensure all CI checks pass**
3. **Request review** from maintainers
4. **Address feedback** promptly
5. **Squash commits** if requested

### PR Checklist

- [ ] Code follows the project's coding standards
- [ ] Tests added for new functionality
- [ ] Documentation updated if needed
- [ ] Changelog updated for user-facing changes
- [ ] All CI checks passing
- [ ] No merge conflicts

## Coding Standards

### Backend (Go)

- Follow standard Go conventions and idioms
- Use `gofmt` for formatting
- Run `go vet` before committing
- Keep functions focused and small
- Add comments for exported functions
- Use meaningful variable names

```go
// Good
func (s *Service) GetUserByEmail(ctx context.Context, email string) (*User, error) {
    // Implementation
}

// Bad
func (s *Service) Get(e string) *User {
    // Implementation
}
```

### Frontend (TypeScript/React)

- Use TypeScript strict mode
- Follow React best practices
- Use functional components with hooks
- Keep components small and focused
- Use meaningful prop names
- Add JSDoc comments for complex components

```typescript
// Good
interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
  isLoading?: boolean;
}

export function UserCard({ user, onEdit, isLoading = false }: UserCardProps) {
  // Implementation
}
```

### CSS/Styling

- Use TailwindCSS utility classes
- Follow mobile-first approach
- Keep custom CSS minimal
- Use CSS variables for theming

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(webhooks): add test webhook functionality

Add endpoint to send test events to webhooks for connectivity verification.
Includes frontend button and success/error feedback.

Closes #123
```

```
fix(auth): resolve session timeout race condition

Sessions were being invalidated during concurrent requests.
Added mutex lock to session validation.
```

## Testing

### Backend Tests

```bash
# Run all backend tests
make test-backend

# Run specific test
cd backend && go test ./internal/services/auth/...
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

### Writing Tests

- Write tests for all new functionality
- Aim for meaningful test coverage
- Test edge cases and error conditions
- Use table-driven tests in Go when appropriate

## Documentation

- Update README.md for major features
- Add JSDoc/godoc comments for public APIs
- Update CHANGELOG.md for user-facing changes
- Keep environment variables documented

## Reporting Bugs

### Before Submitting

1. Check if the issue already exists
2. Try to reproduce with the latest version
3. Gather relevant information

### Bug Report Template

```markdown
**Description**
A clear description of the bug.

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What should happen.

**Actual Behavior**
What actually happens.

**Environment**
- OS: [e.g., Ubuntu 22.04]
- Browser: [e.g., Firefox 120]
- Gardarr Version: [e.g., 0.9.0-beta]
- Docker: [yes/no]

**Screenshots**
If applicable.

**Logs**
Relevant error messages or logs.
```

## Feature Requests

### Before Submitting

1. Check the roadmap in README.md
2. Search existing issues
3. Consider if it fits the project scope

### Feature Request Template

```markdown
**Problem Statement**
What problem does this solve?

**Proposed Solution**
How should it work?

**Alternatives Considered**
Other approaches you've thought about.

**Additional Context**
Any other relevant information.
```

## Questions?

- Open a [Discussion](https://github.com/jfxdev/gardarr/discussions) for general questions
- Check the [Documentation](docs/) for guides
- Review existing issues for similar problems

---

Thank you for contributing to Gardarr! 🌱
