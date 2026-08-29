import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CheckSquare, Play, Pause, RefreshCw, RadioTower, Folder, Tag, Gauge, Trash2, X, Link2, ChevronsUp, ChevronUp, ChevronDown, ChevronsDown } from "lucide-react";
import type { BulkTaskAction, QueuePriorityAction } from "@/services/torrents";
import type { Category } from "@/types/category";
import { useActionPulse } from "@/hooks/useActionPulse";

// Queue-priority direction -> transient pulse styling shown on the clicked
// icon (see useActionPulse). Reuses Tailwind's built-in animate-bounce, no
// custom keyframes needed.
const QUEUE_PULSE_CLASSNAME: Record<QueuePriorityAction, string> = {
  top: "animate-bounce text-emerald-300",
  up: "animate-bounce text-emerald-300",
  down: "animate-bounce text-amber-300",
  bottom: "animate-bounce text-amber-300",
};

const QUEUE_DIRECTION_TO_BULK_ACTION: Record<QueuePriorityAction, BulkTaskAction> = {
  top: "queue_top",
  up: "queue_up",
  down: "queue_down",
  bottom: "queue_bottom",
};

interface BulkActionBarProps {
  selectedCount: number;
  categories: Category[];
  availableTags: string[];
  onAction: (action: BulkTaskAction, options?: { category?: string; tags?: string[]; trackers?: string[] }) => void;
  onLimits: () => void;
  onDelete: () => void;
  onClear: () => void;
}

// Floating action bar shown while selection mode is active: applies bulk
// actions to every selected torrent via the /workers/tasks/bulk endpoint.
export function BulkActionBar({
  selectedCount,
  categories,
  availableTags,
  onAction,
  onLimits,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  const { t } = useTranslation();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [pendingTags, setPendingTags] = useState<Set<string>>(new Set());
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [trackerUrls, setTrackerUrls] = useState("");
  const { pulsedAction, pulseToken, trigger: triggerPulse } = useActionPulse<QueuePriorityAction>();

  const disabled = selectedCount === 0;

  const iconButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void
  ) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-full hover:bg-primary-foreground/20"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {icon}
    </Button>
  );

  const queueIconButton = (label: string, icon: React.ReactElement, direction: QueuePriorityAction) => {
    const isPulsing = pulsedAction === direction;
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full hover:bg-primary-foreground/20"
        onClick={() => {
          triggerPulse(direction);
          onAction(QUEUE_DIRECTION_TO_BULK_ACTION[direction]);
        }}
        disabled={disabled}
        aria-label={label}
        title={label}
      >
        <span
          key={isPulsing ? pulseToken : "idle"}
          className={`inline-flex ${isPulsing ? QUEUE_PULSE_CLASSNAME[direction] : ""}`}
        >
          {icon}
        </span>
      </Button>
    );
  };

  const togglePendingTag = (tag: string) => {
    setPendingTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  const parsedTrackerUrls = trackerUrls
    .split("\n")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  const applyTrackerAction = (action: "add_tracker" | "remove_tracker") => {
    if (parsedTrackerUrls.length === 0) return;
    setTrackerOpen(false);
    onAction(action, { trackers: parsedTrackerUrls });
    setTrackerUrls("");
  };

  return (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-primary text-primary-foreground border border-primary/20 rounded-full px-4 py-2 shadow-lg flex items-center gap-1.5">
        <div className="flex items-center gap-2 pr-2 border-r border-primary-foreground/20">
          <CheckSquare className="h-4 w-4" />
          <span className="text-sm font-medium whitespace-nowrap">
            <span className="font-semibold">{selectedCount}</span>
            <span className="opacity-90"> {t('torrents.selection.selected')}</span>
          </span>
        </div>

        {iconButton(t('torrents.bulk.resume'), <Play className="h-4 w-4" />, () => onAction('start'))}
        {iconButton(t('torrents.bulk.pause'), <Pause className="h-4 w-4" />, () => onAction('stop'))}
        {iconButton(t('torrents.bulk.recheck'), <RefreshCw className="h-4 w-4" />, () => onAction('force_recheck'))}
        {iconButton(t('torrents.bulk.reannounce'), <RadioTower className="h-4 w-4" />, () => onAction('force_reannounce'))}

        <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-primary-foreground/20"
              disabled={disabled}
              aria-label={t('torrents.bulk.category')}
              title={t('torrents.bulk.category')}
            >
              <Folder className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="w-56 p-1 max-h-72 overflow-y-auto">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setCategoryOpen(false);
                  onAction('set_category', { category: category.name });
                }}
              >
                {category.name}
              </button>
            ))}
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                setCategoryOpen(false);
                onAction('set_category', { category: '' });
              }}
            >
              {t('torrents.bulk.removeCategory')}
            </button>
          </PopoverContent>
        </Popover>

        <Popover
          open={tagsOpen}
          onOpenChange={(open) => {
            setTagsOpen(open);
            if (!open) setPendingTags(new Set());
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-primary-foreground/20"
              disabled={disabled || availableTags.length === 0}
              aria-label={t('torrents.bulk.tags')}
              title={t('torrents.bulk.tags')}
            >
              <Tag className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="w-56 p-2 max-h-72 overflow-y-auto">
            <div className="space-y-1">
              {availableTags.map((tag) => (
                <label key={tag} className="flex items-center gap-2 px-2 py-1 text-sm rounded-sm hover:bg-accent cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pendingTags.has(tag)}
                    onChange={() => togglePendingTag(tag)}
                  />
                  <span className="truncate">{tag}</span>
                </label>
              ))}
            </div>
            <Button
              size="sm"
              className="w-full mt-2"
              disabled={pendingTags.size === 0}
              onClick={() => {
                setTagsOpen(false);
                onAction('add_tags', { tags: Array.from(pendingTags) });
                setPendingTags(new Set());
              }}
            >
              {t('torrents.bulk.apply')}
            </Button>
          </PopoverContent>
        </Popover>

        <Popover
          open={trackerOpen}
          onOpenChange={(open) => {
            setTrackerOpen(open);
            if (!open) setTrackerUrls("");
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-primary-foreground/20"
              disabled={disabled}
              aria-label={t('torrents.bulk.trackers')}
              title={t('torrents.bulk.trackers')}
            >
              <Link2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="center" className="w-64 p-2 space-y-2">
            <Textarea
              value={trackerUrls}
              onChange={(e) => setTrackerUrls(e.target.value)}
              placeholder={t('torrents.bulk.trackerPlaceholder')}
              rows={3}
              className="text-xs font-mono resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={parsedTrackerUrls.length === 0}
                onClick={() => applyTrackerAction('add_tracker')}
              >
                {t('torrents.bulk.addTracker')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={parsedTrackerUrls.length === 0}
                onClick={() => applyTrackerAction('remove_tracker')}
              >
                {t('torrents.bulk.removeTracker')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {queueIconButton(t('torrents.bulk.queueTop', { defaultValue: 'Move to top of queue' }), <ChevronsUp className="h-4 w-4" />, "top")}
        {queueIconButton(t('torrents.bulk.queueUp', { defaultValue: 'Move up in queue' }), <ChevronUp className="h-4 w-4" />, "up")}
        {queueIconButton(t('torrents.bulk.queueDown', { defaultValue: 'Move down in queue' }), <ChevronDown className="h-4 w-4" />, "down")}
        {queueIconButton(t('torrents.bulk.queueBottom', { defaultValue: 'Move to bottom of queue' }), <ChevronsDown className="h-4 w-4" />, "bottom")}

        {iconButton(t('torrents.bulk.limits'), <Gauge className="h-4 w-4" />, onLimits)}
        {iconButton(t('torrents.bulk.delete'), <Trash2 className="h-4 w-4" />, onDelete)}

        <div className="pl-1 border-l border-primary-foreground/20">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full hover:bg-primary-foreground/20"
            onClick={onClear}
            aria-label={t('torrents.selection.disable')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
