import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Users from '../Users';
import { AuthProvider } from '../contexts/AuthContext';
import type { User } from '../types/user';

// Mock the auth service
vi.mock('../services/auth', () => ({
  authService: {
    getCurrentUser: vi.fn(),
  },
}));

// Mock the user service
vi.mock('../services/users', () => ({
  userService: {
    listUsers: vi.fn(),
  },
}));

// Mock the signup service
vi.mock('../services/signup', () => ({
  signupService: {
    listMagicLinks: vi.fn(),
    createMagicLink: vi.fn(),
    revokeMagicLink: vi.fn(),
    getSignupUrl: vi.fn(),
  },
}));

// Mock the toast hook
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    showSuccess: vi.fn(),
    showError: vi.fn(),
    removeToast: vi.fn(),
  }),
}));

// Mock the auth context - use vi.hoisted to create shared state
const mockAuthContext = vi.hoisted(() => ({
  user: null as User | null,
  loading: true,
  login: vi.fn(),
  logout: vi.fn(),
  checkAuth: vi.fn(),
}));

vi.mock('../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../contexts/AuthContext')>();
  const { createContext } = await import('react');
  
  const MockAuthContext = createContext(mockAuthContext);
  
  return {
    ...actual,
    AuthContext: MockAuthContext,
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock('../contexts/auth-hooks', () => ({
  useAuth: () => mockAuthContext,
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Users Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state when authentication is loading', () => {
    mockAuthContext.loading = true;
    mockAuthContext.user = null;

    renderWithRouter(<Users />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows loading state when user is not admin', async () => {
    mockAuthContext.loading = false;
    mockAuthContext.user = { 
      uuid: 'uuid-1',
      email: 'user@example.com', 
      role: 'user',
      created_at: '2023-01-01T00:00:00Z'
    };

    renderWithRouter(<Users />);

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  it('renders users page when user is admin', async () => {
    mockAuthContext.loading = false;
    mockAuthContext.user = { 
      uuid: 'uuid-1',
      email: 'admin@example.com', 
      role: 'admin',
      created_at: '2023-01-01T00:00:00Z'
    };

    renderWithRouter(<Users />);

    await waitFor(() => {
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Manage user accounts and permissions')).toBeInTheDocument();
    });
  });
});
