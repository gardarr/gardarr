import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { History, Info, AlertCircle } from 'lucide-react';
import { WebhookHistoryItem } from '@/components/WebhookHistoryItem';
import { EventFilter } from '@/components/EventFilter';
import { webhookService } from '@/services/webhooks';
import type { Webhook, UpdateWebhookRequest, WebhookHistory } from '@/types/webhook';
import { toast } from 'sonner';
import { filterToStrings, buildFilterFromStrings } from '@/utils/eventFilterUtils';

interface EditIntegrationWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  webhook: Webhook | null;
  onSuccess: () => void;
}

// Helper function to check if HTTP status code is successful
const isSuccessStatus = (statusCode: number): boolean => {
  return statusCode >= 200 && statusCode < 300;
};

export function EditIntegrationWebhookModal({
  isOpen,
  onClose,
  webhook,
  onSuccess,
}: EditIntegrationWebhookModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('information');
  const [webhookHistory, setWebhookHistory] = useState<WebhookHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [formData, setFormData] = useState({
    url: '',
    insecure_skip_verify: false,
    timeout_seconds: 10,
  });
  const [filterData, setFilterData] = useState({
    eventTypeFilter: '',
    statusFilter: '',
    categoryFilter: '',
    nameTerms: '',
  });
  const [selectedProtocol, setSelectedProtocol] = useState<'http' | 'https'>('https');

  const urlHasProtocol = (url: string): boolean => {
    return url.trim().startsWith('http://') || url.trim().startsWith('https://');
  };

  const updateFormField = <K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateFilterField = <K extends keyof typeof filterData>(field: K, value: string) => {
    setFilterData(prev => ({ ...prev, [field]: value }));
  };

  const showProtocolSelector = formData.url.trim() !== '' && !urlHasProtocol(formData.url);

  const applyProtocol = () => {
    if (!urlHasProtocol(formData.url)) {
      setFormData({ ...formData, url: `${selectedProtocol}://${formData.url.trim()}` });
    }
  };

  const loadWebhookHistory = useCallback(async (webhookId: string) => {
    setLoadingHistory(true);
    const response = await webhookService.getWebhookHistory(webhookId, 50, 0);
    if (response.data) {
      setWebhookHistory(response.data.data || []);
    } else if (response.error) {
      toast.error('Failed to load webhook history', {
        description: response.error,
      });
    }
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    if (webhook && isOpen) {
      setFormData({
        url: webhook.url,
        insecure_skip_verify: webhook.insecure_skip_verify,
        timeout_seconds: webhook.timeout_seconds,
      });
      setFilterData(filterToStrings(webhook.filter));
      setActiveTab('information');
      setWebhookHistory([]);
      loadWebhookHistory(webhook.uuid);
    }
  }, [webhook, isOpen, loadWebhookHistory]);

  const handleEdit = async () => {
    if (!webhook) return;

    const filter = buildFilterFromStrings(
      filterData.eventTypeFilter,
      filterData.statusFilter,
      filterData.categoryFilter,
      filterData.nameTerms
    );
    const updateData: UpdateWebhookRequest = {
      url: formData.url,
      insecure_skip_verify: formData.insecure_skip_verify,
      timeout_seconds: formData.timeout_seconds,
      filter: filter,
    };

    const response = await webhookService.updateWebhook(webhook.uuid, updateData);
    if (response.data) {
      toast.success(t('webhooks.success.updated'));
      onSuccess();
      onClose();
    } else if (response.error) {
      toast.error(t('webhooks.errors.updateFailed'), {
        description: response.error,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('webhooks.editTitle')}</DialogTitle>
          <DialogDescription>{t('webhooks.editDescription')}</DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="information" className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Information
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="information" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-url">{t('webhooks.urlLabel')} *</Label>
              <Input
                id="edit-url"
                type="url"
                placeholder="https://example.com/webhook"
                value={formData.url}
                onChange={(e) => updateFormField('url', e.target.value)}
              />
              {showProtocolSelector && (
                <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">
                      {selectedProtocol === 'https' ? 'Use HTTPS' : 'Use HTTP'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">HTTP</span>
                      <Switch
                        checked={selectedProtocol === 'https'}
                        onCheckedChange={(checked) => setSelectedProtocol(checked ? 'https' : 'http')}
                      />
                      <span className="text-xs text-muted-foreground">HTTPS</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={applyProtocol}
                      variant="secondary"
                    >
                      {t('common.apply') || 'Apply'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-timeout">{t('webhooks.timeoutLabel')}</Label>
              <Input
                id="edit-timeout"
                type="number"
                min="1"
                max="300"
                value={formData.timeout_seconds}
                onChange={(e) => updateFormField('timeout_seconds', Number.parseInt(e.target.value, 10) || 10)}
              />
              <p className="text-sm text-muted-foreground">{t('webhooks.timeoutHelp')}</p>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-insecure">{t('webhooks.insecureLabel')}</Label>
              <Switch
                id="edit-insecure"
                checked={formData.insecure_skip_verify}
                onCheckedChange={(checked) => updateFormField('insecure_skip_verify', checked)}
              />
            </div>
            <p className="text-sm text-muted-foreground">{t('webhooks.insecureHelp')}</p>

            <EventFilter
              eventTypeFilter={filterData.eventTypeFilter}
              statusFilter={filterData.statusFilter}
              categoryFilter={filterData.categoryFilter}
              nameTerms={filterData.nameTerms}
              onEventTypeFilterChange={(value) => updateFilterField('eventTypeFilter', value)}
              onStatusFilterChange={(value) => updateFilterField('statusFilter', value)}
              onCategoryFilterChange={(value) => updateFilterField('categoryFilter', value)}
              onNameTermsChange={(value) => updateFilterField('nameTerms', value)}
              idPrefix="edit-"
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="mb-4 p-3 border rounded-md bg-muted/30">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" />
                History is stored for 7 days only
              </p>
            </div>
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : webhookHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mb-4" />
                <p>No history available</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {webhookHistory.map((history) => (
                  <WebhookHistoryItem
                    key={history.uuid}
                    history={history}
                    isSuccess={isSuccessStatus(history.status_code)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleEdit}>
            {t('webhooks.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
