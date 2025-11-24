import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, Plus, X } from 'lucide-react';
import { TASK_STATUSES, type TaskStatus } from '@/utils/statusUtils';
import { getStatusIcon, getStatusColor } from '@/components/TorrentStatusIcon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EVENT_TYPES, EVENT_TYPE_LABELS, EVENT_TYPE_DESCRIPTIONS } from '@/constants/eventTypes';

interface EventFilterProps {
  eventTypeFilter: string;
  statusFilter: string;
  categoryFilter: string;
  nameTerms: string;
  onEventTypeFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onNameTermsChange: (value: string) => void;
  idPrefix?: string;
}

type FilterType = 'status' | 'category' | 'nameTerms';

export function EventFilter({
  eventTypeFilter,
  statusFilter,
  categoryFilter,
  nameTerms,
  onEventTypeFilterChange,
  onStatusFilterChange,
  onCategoryFilterChange,
  onNameTermsChange,
  idPrefix = '',
}: EventFilterProps) {
  const { t } = useTranslation();
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set());
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
  const [isAddFilterPopoverOpen, setIsAddFilterPopoverOpen] = useState(false);

  const addFilter = (filterType: FilterType) => {
    setActiveFilters((prev) => new Set(prev).add(filterType));
    setIsAddFilterPopoverOpen(false);
  };

  const removeFilter = (filterType: FilterType) => {
    setActiveFilters((prev) => {
      const newSet = new Set(prev);
      newSet.delete(filterType);
      return newSet;
    });

    // Clear the filter value when removing
    if (filterType === 'status') onStatusFilterChange('');
    if (filterType === 'category') onCategoryFilterChange('');
    if (filterType === 'nameTerms') onNameTermsChange('');
  };

  // Status filter management
  const selectedStatuses = statusFilter
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0) as TaskStatus[];

  const addStatus = (status: TaskStatus) => {
    if (!selectedStatuses.includes(status)) {
      const newStatuses = [...selectedStatuses, status];
      onStatusFilterChange(newStatuses.join(', '));
    }
    setIsStatusPopoverOpen(false);
  };

  const removeStatus = (status: TaskStatus) => {
    const newStatuses = selectedStatuses.filter((s) => s !== status);
    onStatusFilterChange(newStatuses.join(', '));
  };

  const availableStatuses = TASK_STATUSES.filter(
    (status) => !selectedStatuses.includes(status)
  );

  const availableFilters = [
    { type: 'status' as FilterType, label: t('webhooks.filters.statusLabel') },
    { type: 'category' as FilterType, label: t('webhooks.filters.categoryLabel') },
    { type: 'nameTerms' as FilterType, label: t('webhooks.filters.nameTermsLabel') },
  ].filter((filter) => !activeFilters.has(filter.type));

  return (
    <>
      <Separator className="my-2" />

      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-primary" />
        <Label className="text-base font-semibold">{t('webhooks.filters.title')}</Label>
      </div>

      {/* Event Type Filter - Always visible */}
      <div className="mb-4">
        <Label htmlFor={`${idPrefix}event-type-filter`} className="mb-3 block">Event Type</Label>
        <Select
          value={eventTypeFilter || 'all'}
          onValueChange={(value) => onEventTypeFilterChange(value === 'all' ? '' : value)}
        >
          <SelectTrigger id={`${idPrefix}event-type-filter`} className="w-full">
            <SelectValue placeholder="Select an event type">
              {eventTypeFilter && eventTypeFilter !== 'all' 
                ? EVENT_TYPE_LABELS[eventTypeFilter as keyof typeof EVENT_TYPE_LABELS] 
                : 'All event types'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex flex-col items-start gap-0.5">
                <span className="font-medium">All event types</span>
                <span className="text-xs text-muted-foreground">No filter applied</span>
              </div>
            </SelectItem>
            {EVENT_TYPES.map((eventType) => (
              <SelectItem key={eventType} value={eventType}>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="font-medium">{EVENT_TYPE_LABELS[eventType]}</span>
                  <span className="text-xs text-muted-foreground">
                    {EVENT_TYPE_DESCRIPTIONS[eventType]}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground mt-2">
          {eventTypeFilter && eventTypeFilter !== 'all' && EVENT_TYPE_DESCRIPTIONS[eventTypeFilter as keyof typeof EVENT_TYPE_DESCRIPTIONS] 
            ? EVENT_TYPE_DESCRIPTIONS[eventTypeFilter as keyof typeof EVENT_TYPE_DESCRIPTIONS]
            : 'Select an event type to filter which events trigger this webhook'}
        </p>
      </div>

      {/* Optional Filters Section */}
      <Separator className="my-4" />

      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <Label className="text-base font-semibold">Additional Filters</Label>
          <p className="text-sm text-muted-foreground">{t('webhooks.filters.subtitle')}</p>
        </div>

        {availableFilters.length > 0 && (
          <Popover open={isAddFilterPopoverOpen} onOpenChange={setIsAddFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Filter
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-2">
              <div className="space-y-1">
                {availableFilters.map((filter) => (
                  <Button
                    key={filter.type}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => addFilter(filter.type)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {activeFilters.has('status') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('webhooks.filters.statusLabel')}</Label>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => removeFilter('status')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Selected statuses */}
          {selectedStatuses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedStatuses.map((status) => {
                const StatusIcon = getStatusIcon(status);
                return (
                  <Badge
                    key={status}
                    variant="outline"
                    className="flex items-center gap-1.5 pr-1"
                  >
                    <StatusIcon className={`h-3 w-3 ${getStatusColor(status)}`} />
                    <span className={`text-xs ${getStatusColor(status)}`}>{status}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => removeStatus(status)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Add status button */}
          {availableStatuses.length > 0 && (
            <Popover open={isStatusPopoverOpen} onOpenChange={setIsStatusPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Status
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 p-2">
                <ScrollArea className="h-72">
                  <div className="space-y-1 pr-3">
                    {availableStatuses.map((status) => {
                      const StatusIcon = getStatusIcon(status);
                      return (
                        <Button
                          key={status}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => addStatus(status)}
                        >
                          <StatusIcon className={`h-4 w-4 mr-2 ${getStatusColor(status)}`} />
                          <span className={getStatusColor(status)}>{status}</span>
                        </Button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}

          <p className="text-sm text-muted-foreground">{t('webhooks.filters.statusHelp')}</p>
        </div>
      )}

      {activeFilters.has('category') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${idPrefix}category-filter`}>{t('webhooks.filters.categoryLabel')}</Label>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => removeFilter('category')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Input
            id={`${idPrefix}category-filter`}
            type="text"
            placeholder={t('webhooks.filters.categoryPlaceholder')}
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">{t('webhooks.filters.categoryHelp')}</p>
        </div>
      )}

      {activeFilters.has('nameTerms') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${idPrefix}name-terms`}>{t('webhooks.filters.nameTermsLabel')}</Label>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => removeFilter('nameTerms')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Input
            id={`${idPrefix}name-terms`}
            type="text"
            placeholder={t('webhooks.filters.nameTermsPlaceholder')}
            value={nameTerms}
            onChange={(e) => onNameTermsChange(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">{t('webhooks.filters.nameTermsHelp')}</p>
        </div>
      )}
    </>
  );
}
