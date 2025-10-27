import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TorrentsPage from '../Torrents';
import { useTranslation } from 'react-i18next';

// Mock the translation hook
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'torrents.title': 'Torrents',
        'torrents.subtitle': 'Manage your downloads and uploads',
        'torrents.agentError': 'Agent Error',
        'torrents.agentErrorDesc': 'Your agent is experiencing an error and needs to be fixed before managing torrents. Please check the agent configuration and try again.',
        'torrents.fixAgent': 'Fix Agent',
        'torrents.noAgents': 'No agents available',
        'torrents.noAgentsDesc': 'You need to register an agent before managing torrents. Add your first torrent client to get started.',
        'torrents.addFirstAgent': 'Add Agent',
        'torrents.noTorrentsWithAgents': 'No torrents yet',
        'torrents.noTorrentsWithAgentsDesc': 'You have agents configured but no torrents. Add your first torrent to start downloading.',
        'torrents.addTorrent': 'Add Torrent',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock the services
jest.mock('../services/torrents', () => ({
  torrentService: {
    listTasks: jest.fn().mockResolvedValue({ data: [] }),
  },
}));

jest.mock('../services/agents', () => ({
  agentService: {
    listAgents: jest.fn().mockResolvedValue({ data: [] }),
  },
}));

// Mock the toast hook
jest.mock('../hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    showSuccess: jest.fn(),
    showError: jest.fn(),
    removeToast: jest.fn(),
  }),
}));

// Mock the auth context
jest.mock('../contexts/auth-hooks', () => ({
  useAuth: () => ({
    user: { role: 'admin' },
    logout: jest.fn(),
  }),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('TorrentsPage - Agent Error States', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows agent error state when only agent has ERRORED status', async () => {
    // Mock agents with error status
    const mockAgents = [
      {
        uuid: '1',
        name: 'Test Agent',
        address: 'http://localhost:8080',
        status: 'ERRORED' as const,
        error: 'Connection failed',
        instance: {
          application: {
            name: 'qBittorrent',
            version: '4.5.0',
          },
          server: {
            free_space_on_disk: 1000000000,
          },
        },
      },
    ];

    // Mock the agent service to return the errored agent
    const { agentService } = require('../services/agents');
    agentService.listAgents.mockResolvedValue({ data: mockAgents });

    renderWithRouter(<TorrentsPage />);

    // Wait for the component to load and check for agent error state
    await screen.findByText('Agent Error');
    expect(screen.getByText('Your agent is experiencing an error and needs to be fixed before managing torrents. Please check the agent configuration and try again.')).toBeInTheDocument();
    expect(screen.getByText('Fix Agent')).toBeInTheDocument();
  });

  it('shows no agents state when no agents are available', async () => {
    // Mock empty agents array
    const { agentService } = require('../services/agents');
    agentService.listAgents.mockResolvedValue({ data: [] });

    renderWithRouter(<TorrentsPage />);

    // Wait for the component to load and check for no agents state
    await screen.findByText('No agents available');
    expect(screen.getByText('You need to register an agent before managing torrents. Add your first torrent client to get started.')).toBeInTheDocument();
    expect(screen.getByText('Add Agent')).toBeInTheDocument();
  });

  it('shows no torrents state when agents are active but no torrents', async () => {
    // Mock agents with active status
    const mockAgents = [
      {
        uuid: '1',
        name: 'Test Agent',
        address: 'http://localhost:8080',
        status: 'ACTIVE' as const,
        instance: {
          application: {
            name: 'qBittorrent',
            version: '4.5.0',
          },
          server: {
            free_space_on_disk: 1000000000,
          },
        },
      },
    ];

    const { agentService } = require('../services/agents');
    agentService.listAgents.mockResolvedValue({ data: mockAgents });

    renderWithRouter(<TorrentsPage />);

    // Wait for the component to load and check for no torrents state
    await screen.findByText('No torrents yet');
    expect(screen.getByText('You have agents configured but no torrents. Add your first torrent to start downloading.')).toBeInTheDocument();
    expect(screen.getByText('Add Torrent')).toBeInTheDocument();
  });
});
