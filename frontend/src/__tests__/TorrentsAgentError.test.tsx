import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import TorrentsPage from '../Torrents';

// Mock the translation hook
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
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
  };
});

// Mock the services
vi.mock('../services/torrents', () => ({
  torrentService: {
    listTasks: vi.fn().mockResolvedValue({ data: [] }),
    listAgentTasks: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../services/agents', () => ({
  agentService: {
    listAgents: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock the auth context
vi.mock('../contexts/auth-hooks', () => ({
  useAuth: () => ({
    user: { role: 'admin' },
    logout: vi.fn(),
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
    vi.clearAllMocks();
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
    const { agentService } = await import('../services/agents');
    vi.mocked(agentService.listAgents).mockResolvedValue({ data: mockAgents });

    renderWithRouter(<TorrentsPage />);

    // Wait for the component to load and check for agent error state
    await screen.findByText('Agent Error');
    expect(screen.getByText('Your agent is experiencing an error and needs to be fixed before managing torrents. Please check the agent configuration and try again.')).toBeInTheDocument();
    expect(screen.getByText('Fix Agent')).toBeInTheDocument();
  });

  it('shows no agents state when no agents are available', async () => {
    // Mock empty agents array
    const { agentService } = await import('../services/agents');
    vi.mocked(agentService.listAgents).mockResolvedValue({ data: [] });

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

    const { agentService } = await import('../services/agents');
    vi.mocked(agentService.listAgents).mockResolvedValue({ data: mockAgents });

    renderWithRouter(<TorrentsPage />);

    // Wait for the component to load and check for no torrents state
    await screen.findByText('No torrents yet');
    expect(screen.getByText('You have agents configured but no torrents. Add your first torrent to start downloading.')).toBeInTheDocument();
    // There are multiple "Add Torrent" buttons (header and empty state), so use getAllByText
    const addTorrentButtons = screen.getAllByText('Add Torrent');
    expect(addTorrentButtons.length).toBeGreaterThan(0);
  });
});
