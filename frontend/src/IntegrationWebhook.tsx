import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Webhook, Trash2, Edit2, Plus, ArrowLeft, CheckCircle, XCircle, Clock, Filter, FileJson, Send, Loader2, BookOpen } from 'lucide-react';
import { webhookService } from '@/services/webhooks';
import type { Webhook as WebhookType, CreateWebhookRequest, UpdateWebhookRequest } from '@/types/webhook';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EventFilter } from '@/components/EventFilter';
import { buildFilterFromStrings } from '@/utils/eventFilterUtils';
import { EditIntegrationWebhookModal } from '@/components/EditIntegrationWebhookModal';
import { WebhookDocumentationModal } from '@/components/WebhookDocumentationModal';

export default function IntegrationWebhookPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);
  const [isDocumentationModalOpen, setIsDocumentationModalOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookType | null>(null);
  const [formData, setFormData] = useState<CreateWebhookRequest>({
    url: '',
    insecure_skip_verify: false,
    timeout_seconds: 10,
  });
  const [filterData, setFilterData] = useState<{
    eventTypeFilter: string;
    statusFilter: string;
    categoryFilter: string;
    nameTerms: string;
  }>({
    eventTypeFilter: '',
    statusFilter: '',
    categoryFilter: '',
    nameTerms: '',
  });
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    const response = await webhookService.listWebhooks();
    if (response.data) {
      setWebhooks(response.data);
    } else if (response.error) {
      toast.error(t('webhooks.errors.loadFailed'), {
        description: response.error,
      });
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  const handleCreate = async () => {
    if (!formData.url) {
      toast.error(t('webhooks.errors.urlRequired'));
      return;
    }

    const filter = buildFilterFromStrings(
      filterData.eventTypeFilter,
      filterData.statusFilter,
      filterData.categoryFilter,
      filterData.nameTerms
    );
    const requestData: CreateWebhookRequest = {
      ...formData,
      filter: filter,
    };

    const response = await webhookService.createWebhook(requestData);
    if (response.data) {
      toast.success(t('webhooks.success.created'));
      setIsCreateModalOpen(false);
      setFormData({ url: '', insecure_skip_verify: false, timeout_seconds: 10 });
      setFilterData({ eventTypeFilter: '', statusFilter: '', categoryFilter: '', nameTerms: '' });
      loadWebhooks();
    } else if (response.error) {
      toast.error(t('webhooks.errors.createFailed'), {
        description: response.error,
      });
    }
  };


  const handleDelete = async () => {
    if (!selectedWebhook) return;

    const response = await webhookService.deleteWebhook(selectedWebhook.uuid);
    if (response.data !== undefined) {
      toast.success(t('webhooks.success.deleted'));
      setIsDeleteModalOpen(false);
      setSelectedWebhook(null);
      loadWebhooks();
    } else if (response.error) {
      toast.error(t('webhooks.errors.deleteFailed'), {
        description: response.error,
      });
    }
  };

  const handleToggleEnabled = async (webhook: WebhookType) => {
    const updateData: UpdateWebhookRequest = {
      enabled: !webhook.enabled,
    };

    const response = await webhookService.updateWebhook(webhook.uuid, updateData);
    if (response.data) {
      toast.success(webhook.enabled ? t('webhooks.success.disabled') : t('webhooks.success.enabled'));
      loadWebhooks();
    } else if (response.error) {
      toast.error(t('webhooks.errors.updateFailed'), {
        description: response.error,
      });
    }
  };

  const openEditModal = (webhook: WebhookType) => {
    setSelectedWebhook(webhook);
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedWebhook(null);
    loadWebhooks();
  };

  const openDeleteModal = (webhook: WebhookType) => {
    setSelectedWebhook(webhook);
    setIsDeleteModalOpen(true);
  };

  const handleTestWebhook = async (webhookId: string) => {
    setTestingWebhookId(webhookId);
    try {
      const response = await webhookService.testWebhook(webhookId);
      if (response.data?.success) {
        toast.success(t('webhooks.success.testSuccess'), {
          description: t('webhooks.success.testSuccessDescription'),
        });
      } else {
        toast.error(t('webhooks.errors.testFailed'), {
          description: response.data?.error || response.error,
        });
      }
    } catch {
      toast.error(t('webhooks.errors.testFailed'));
    } finally {
      setTestingWebhookId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/integrations')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
              <Webhook className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight truncate">{t('webhooks.title')}</h1>
              <p className="text-sm text-muted-foreground hidden sm:block">{t('webhooks.subtitle')}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Button 
            variant="outline" 
            onClick={() => setIsDocumentationModalOpen(true)}
            className="flex-1 sm:flex-none"
            size="sm"
          >
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">{t('webhooks.documentation')}</span>
            <span className="sm:hidden ml-2">Docs</span>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsExampleModalOpen(true)}
            className="flex-1 sm:flex-none"
            size="sm"
          >
            <FileJson className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">{t('webhooks.examplePayload')}</span>
            <span className="sm:hidden ml-2">Exemplo</span>
          </Button>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 sm:flex-none"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="ml-2">{t('webhooks.addWebhook')}</span>
          </Button>
        </div>
      </div>

      {/* Webhooks List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {t('webhooks.noWebhooks')}
            </p>
            <Button className="mt-4" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('webhooks.addFirstWebhook')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.uuid}>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${webhook.enabled ? 'bg-green-500/10' : 'bg-gray-500/10'}`}>
                      <Webhook className={`h-4 w-4 sm:h-5 sm:w-5 ${webhook.enabled ? 'text-green-500' : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm sm:text-base break-all">
                        {webhook.url}
                      </CardTitle>
                      {webhook.filter && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {webhook.filter.event_type_filter && (
                            <Badge variant="secondary" className="gap-1">
                              <Filter className="h-3 w-3" />
                              Event Type: {webhook.filter.event_type_filter}
                            </Badge>
                          )}
                          {webhook.filter.status_filter && webhook.filter.status_filter.length > 0 && (
                            <Badge variant="secondary" className="gap-1">
                              <Filter className="h-3 w-3" />
                              Status: {webhook.filter.status_filter.join(', ')}
                            </Badge>
                          )}
                          {webhook.filter.category_filter && webhook.filter.category_filter.length > 0 && (
                            <Badge variant="secondary" className="gap-1">
                              <Filter className="h-3 w-3" />
                              Category: {webhook.filter.category_filter.join(', ')}
                            </Badge>
                          )}
                          {webhook.filter.name_terms && webhook.filter.name_terms.length > 0 && (
                            <Badge variant="secondary" className="gap-1">
                              <Filter className="h-3 w-3" />
                              Terms: {webhook.filter.name_terms.join(', ')}
                            </Badge>
                          )}
                        </div>
                      )}
                      <CardDescription className="flex flex-wrap items-center gap-2 mt-2 text-xs sm:text-sm">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {webhook.timeout_seconds}s
                        </span>
                        {webhook.insecure_skip_verify && (
                          <span className="text-orange-500">
                            {t('webhooks.insecureMode')}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col lg:flex-row items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => handleTestWebhook(webhook.uuid)}
                          disabled={testingWebhookId === webhook.uuid}
                        >
                          {testingWebhookId === webhook.uuid ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 text-blue-500" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('webhooks.test')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => handleToggleEnabled(webhook)}
                          aria-label={webhook.enabled ? t('webhooks.enabled') : t('webhooks.disabled')}
                        >
                          {webhook.enabled ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {webhook.enabled ? t('webhooks.disable') : t('webhooks.enable')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => openEditModal(webhook)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('webhooks.edit')}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => openDeleteModal(webhook)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('common.delete')}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('webhooks.createTitle')}</DialogTitle>
            <DialogDescription>{t('webhooks.createDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">{t('webhooks.urlLabel')} *</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/webhook"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeout">{t('webhooks.timeoutLabel')}</Label>
              <Input
                id="timeout"
                type="number"
                min="1"
                max="300"
                value={formData.timeout_seconds}
                onChange={(e) => setFormData({ ...formData, timeout_seconds: Number.parseInt(e.target.value, 10) || 10 })}
              />
              <p className="text-sm text-muted-foreground">{t('webhooks.timeoutHelp')}</p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="insecure">{t('webhooks.insecureLabel')}</Label>
              <Switch
                id="insecure"
                checked={formData.insecure_skip_verify}
                onCheckedChange={(checked) => setFormData({ ...formData, insecure_skip_verify: checked })}
              />
            </div>
            <p className="text-sm text-muted-foreground">{t('webhooks.insecureHelp')}</p>

            <EventFilter
              eventTypeFilter={filterData.eventTypeFilter}
              statusFilter={filterData.statusFilter}
              categoryFilter={filterData.categoryFilter}
              nameTerms={filterData.nameTerms}
              onEventTypeFilterChange={(value) => setFilterData({ ...filterData, eventTypeFilter: value })}
              onStatusFilterChange={(value) => setFilterData({ ...filterData, statusFilter: value })}
              onCategoryFilterChange={(value) => setFilterData({ ...filterData, categoryFilter: value })}
              onNameTermsChange={(value) => setFilterData({ ...filterData, nameTerms: value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate}>
              {t('webhooks.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <EditIntegrationWebhookModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedWebhook(null);
        }}
        webhook={selectedWebhook}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('webhooks.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('webhooks.deleteDescription')}
              <br />
              <span className="font-semibold">{selectedWebhook?.url}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Example Payload Modal */}
      <Dialog open={isExampleModalOpen} onOpenChange={setIsExampleModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              {t('webhooks.examplePayloadTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('webhooks.examplePayloadDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Method: POST</Badge>
              <Badge variant="secondary">Content-Type: application/json</Badge>
            </div>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
              <code>
                {'{\n'}
                {'  "event_id": "e637b596-51bd-4f42-8120-14dcc1d73ca8",\n'}
                {'  "event_type": '}
                <span className="bg-primary/20 text-primary px-1 rounded font-semibold">"torrent.added"</span>
                {',\n'}
                {'  "agent_id": "0c32bee5-1bc8-47c2-9b70-68971c3d4e59 ",\n'}
                {'  "task_hash": "36x8a5j74vfrk0usr6xedby71gn69mqm6bblp5h2",\n'}
                {'  "new_value": '}
                <span className="bg-primary/20 text-primary px-1 rounded font-semibold">"STALLED_DOWNLOAD"</span>
                {',\n'}
                {'  "metadata": {\n'}
                {'    "category": '}
                <span className="bg-primary/20 text-primary px-1 rounded font-semibold">"iso"</span>
                {',\n'}
                {'    "directory": "/data/downloads/iso",\n'}
                {'    "hash": "36x8a5j74vfrk0usr6xedby71gn69mqm6bblp5h2",\n'}
                {'    "name": '}
                <span className="bg-primary/20 text-primary px-1 rounded font-semibold">"ubuntu-25.10-desktop-amd64.is"</span>
                {',\n'}
                {'    "progress": 100,\n'}
                {'    "ratio": 0.3,\n'}
                {'    "size": 890405393,\n'}
                {'    "state": '}
                <span className="bg-primary/20 text-primary px-1 rounded font-semibold">"DOWNLOADING"</span>
                {',\n'}
                {'    "tags": ["iso", "ubuntu", "linux"]\n'}
                {'  },\n'}
                {'  "timestamp": "2025-11-23T21:33:54Z"\n'}
                {'}'}
              </code>
            </pre>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsExampleModalOpen(false)}>
              {t('common.close') || 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Documentation Modal */}
      <WebhookDocumentationModal
        isOpen={isDocumentationModalOpen}
        onClose={() => setIsDocumentationModalOpen(false)}
      />
    </div>
  );
}

