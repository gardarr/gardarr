# Local Development Guide

This guide explains how to set up and run the seedbox project for local development with separate frontend and backend.

## 🚀 Initial Setup

### 1. Install Dependencies

```bash
# Install all dependencies (frontend + backend)
make install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
APP_PORT=3200
APP_URL=http://localhost:3200
```

## 🛠️ Running Development

### Option 1: Separate Terminals (Recommended)

**Terminal 1 - Backend:**
```bash
make run-backend
```
- Backend will run at: http://localhost:3200
- API available at: http://localhost:3200/v1/*

**Terminal 2 - Frontend:**
```bash
make run-frontend
```
- Frontend will run at: http://localhost:5173
- Hot-reload enabled
- Proxy configured to redirect `/v1/*` to the backend

### Option 2: Single Command

```bash
make dev
```
- Runs frontend and backend in parallel
- Press `Ctrl+C` to stop both

## 🔧 Technical Configuration

### CORS
The backend is configured to accept requests from:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3200` (Backend)

### Vite Proxy
Vite is configured to automatically redirect:
- `/v1/*` → `http://localhost:3200/v1/*`

### API Client
Use the API client configured in `src/lib/api.ts`:

```typescript
import { api } from '@/lib/api';

// GET request
const response = await api.get('/health');

// POST request
const response = await api.post('/tasks', { name: 'New task' });

// Check response
if (response.data) {
  console.log('Success:', response.data);
} else {
  console.error('Error:', response.error);
}
```

## 📁 Development Structure

```
seedbox/
├── .env                    # Environment variables
├── backend/               # Go API
│   ├── main.go           # Entry point
│   └── internal/         # Internal code
├── frontend/             # React + Vite App
│   ├── src/
│   │   ├── lib/api.ts    # API Client
│   │   └── components/   # React Components
│   └── vite.config.ts    # Vite Configuration
└── Makefile              # Development commands
```

## 🐛 Troubleshooting

### Backend does not start
- Check if port 3200 is available
- Run `make install-backend` to reinstall Go dependencies

### Frontend does not connect to backend
- Check if the backend is running on port 3200
- Confirm if the `.env` file is configured correctly
- Check the browser console for CORS errors

### Vite proxy error
- Check if `vite.config.ts` is configured correctly
- Restart the development server: `make run-frontend`

## 📝 Useful Commands

```bash
# View all available commands
make help

# Instructions for separate development
make dev-separate

# Clean builds
make clean

# Clean everything (including node_modules)
make clean-all
```

## 🔄 Development Workflow

1. **Start the backend**: `make run-backend`
2. **Start the frontend**: `make run-frontend`
3. **Develop**: Edit files in `frontend/src/`
4. **Test API**: Use the client in `src/lib/api.ts`
5. **Hot-reload**: Frontend changes are applied automatically

## 📚 Next Steps

- Implement real API calls in components
- Add error handling
- Configure automated tests
- Implement authentication/authorization
