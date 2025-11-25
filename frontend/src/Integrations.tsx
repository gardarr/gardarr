import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Webhook, Bell, Plug, Monitor, BookOpen, Joystick, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { EventList, type Event, type FilterType } from '@/components/EventList';

interface EventsResponse {
  events: Event[];
  total: number;
}

export default function IntegrationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showEvents, setShowEvents] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [limit] = useState(10);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const offset = page * limit;
      let url = `/events?limit=${limit}&offset=${offset}`;
      
      if (filterType && filterType !== "all") {
        url += `&type=${encodeURIComponent(filterType)}`;
      }
      
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      
      const response = await api.get<EventsResponse>(url);

      if (response.data) {
        setEvents(response.data.events || []);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, filterType, searchQuery]);

  useEffect(() => {
    if (showEvents) {
      loadEvents();
    }
  }, [showEvents, loadEvents]);

  const integrations = [
    {
      id: 'webhook',
      name: t('integrations.webhook.name'),
      description: t('integrations.webhook.description'),
      icon: Webhook,
      category: 'notifications',
      status: 'available'
    },
    {
      id: 'ntfy',
      name: t('integrations.ntfy.name'),
      description: t('integrations.ntfy.description'),
      icon: Bell,
      category: 'notifications',
      status: 'available'
    },
    {
      id: 'jellyfin',
      name: t('integrations.jellyfin.name'),
      description: t('integrations.jellyfin.description'),
      icon: Monitor,
      category: 'synchronizations',
      status: 'available'
    },
    {
      id: 'kavita',
      name: t('integrations.kavita.name'),
      description: t('integrations.kavita.description'),
      icon: BookOpen,
      category: 'synchronizations',
      status: 'available'
    },
    {
      id: 'romm',
      name: t('integrations.romm.name'),
      description: t('integrations.romm.description'),
      icon: Joystick,
      category: 'synchronizations',
      status: 'available'
    }
  ];

  const categories = {
    notifications: {
      title: t('integrations.categories.notifications'),
      description: t('integrations.categories.notificationsDescription')
    },
    synchronizations: {
      title: t('integrations.categories.synchronizations'),
      description: t('integrations.categories.synchronizationsDescription')
    }
  };

  const getIntegrationsByCategory = (category: string) => {
    return integrations.filter(integration => integration.category === category);
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Plug className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t('integrations.title')}</h1>
          </div>
          <Button 
            onClick={() => setShowEvents(true)}
          >
            <Activity />
            {t('history.showEvents')}
          </Button>
        </div>
        <p className="text-muted-foreground mt-2">
          {t('integrations.subtitle')}
        </p>
      </div>

      {/* Notifications Category */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{categories.notifications.title}</h2>
          <p className="text-muted-foreground">
            {categories.notifications.description}
          </p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {getIntegrationsByCategory('notifications').map((integration) => {
            const IconComponent = integration.icon;
            return (
              <Card key={integration.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {integration.description}
                  </CardDescription>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    disabled={integration.id !== 'webhook'}
                    onClick={() => {
                     if (integration.id === 'webhook') {
                      navigate('/integrations/webhooks');
                    }
                  }}
                  >
                    {integration.id === 'webhook' 
                      ? t('integrations.configure') 
                      : t('integrations.comingSoon')
                    }
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Synchronizations Category */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{categories.synchronizations.title}</h2>
          <p className="text-muted-foreground">
            {categories.synchronizations.description}
          </p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {getIntegrationsByCategory('synchronizations').map((integration) => {
            const IconComponent = integration.icon;
            return (
              <Card key={integration.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {integration.description}
                  </CardDescription>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    disabled={integration.id !== 'webhook'}
                    onClick={() => integration.id === 'webhook' && navigate('/integrations/webhooks')}
                  >
                    {integration.id === 'webhook' 
                      ? t('integrations.configure') 
                      : t('integrations.comingSoon')
                    }
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Events Drawer */}
      <Sheet open={showEvents} onOpenChange={setShowEvents}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="space-y-1">
            <SheetTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              {t('history.title')}
            </SheetTitle>
            <SheetDescription>
              {t('history.subtitle')}
            </SheetDescription>
          </SheetHeader>
          <EventList
              events={events}
              isLoading={isLoading}
              total={total}
              page={page}
              limit={limit}
              filterType={filterType}
              searchQuery={searchQuery}
              onFilterChange={setFilterType}
              onPageChange={setPage}
              onRefresh={loadEvents}
              onSearchChange={setSearchQuery}
            />
        </SheetContent>
      </Sheet>
    </div>
  );
}
