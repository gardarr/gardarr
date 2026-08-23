import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Worker } from "@/types/worker";
import type { RSSFeed, RSSRule, RSSSetRuleRequest } from "@/types/rss";

interface RSSRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workers: Worker[];
  feeds: RSSFeed[];
  defaultWorkerId?: string;
  editingRule?: RSSRule | null;
  onSave: (workerId: string, ruleName: string, data: RSSSetRuleRequest) => Promise<void>;
}

// affected_feeds is stored as an array server-side; the form edits it as one
// feed URL per line, which is far easier to type/read than a JSON array.
function feedsToLines(feeds?: string[]): string {
  return (feeds || []).join("\n");
}

function linesToFeeds(lines: string): string[] {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const emptyForm: RSSSetRuleRequest = {
  enabled: true,
  must_contain: "",
  must_not_contain: "",
  use_regex: false,
  smart_filter: false,
  affected_feeds: [],
  ignore_days: 0,
  add_paused: false,
  assigned_category: "",
  save_path: "",
};

export function RSSRuleModal({ open, onOpenChange, workers, feeds, defaultWorkerId, editingRule, onSave }: RSSRuleModalProps) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [form, setForm] = useState<RSSSetRuleRequest>(emptyForm);
  const [feedsText, setFeedsText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isEditing = Boolean(editingRule);

  useEffect(() => {
    if (!open) return;

    if (editingRule) {
      setWorkerId(editingRule.worker_id || "");
      setRuleName(editingRule.name);
      setForm({
        enabled: editingRule.enabled,
        must_contain: editingRule.must_contain,
        must_not_contain: editingRule.must_not_contain,
        use_regex: editingRule.use_regex,
        episode_filter: editingRule.episode_filter,
        smart_filter: editingRule.smart_filter,
        affected_feeds: editingRule.affected_feeds || [],
        ignore_days: editingRule.ignore_days,
        add_paused: editingRule.add_paused,
        assigned_category: editingRule.assigned_category,
        save_path: editingRule.save_path,
        torrent_content_layout: editingRule.torrent_content_layout,
      });
      setFeedsText(feedsToLines(editingRule.affected_feeds));
    } else {
      setWorkerId(defaultWorkerId || workers[0]?.uuid || "");
      setRuleName("");
      setForm(emptyForm);
      setFeedsText("");
    }
  }, [open, editingRule, defaultWorkerId, workers]);

  const workerFeeds = feeds.filter((feed) => feed.worker_id === workerId);

  const handleSubmit = async () => {
    if (!workerId || !ruleName.trim()) {
      toast.error(t("rss.errors.ruleFieldsRequired"));
      return;
    }

    setSubmitting(true);
    try {
      await onSave(workerId, ruleName.trim(), {
        ...form,
        affected_feeds: linesToFeeds(feedsText),
      });
      onOpenChange(false);
    } catch {
      // onSave already surfaces the error via toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("rss.editRule") : t("rss.addRule")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("rss.fields.worker")}</Label>
            <Select value={workerId} onValueChange={setWorkerId} disabled={isEditing}>
              <SelectTrigger>
                <SelectValue placeholder={t("rss.fields.workerPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {workers.map((worker) => (
                  <SelectItem key={worker.uuid} value={worker.uuid}>
                    {worker.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("rss.fields.ruleName")}</Label>
            <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} disabled={isEditing} />
          </div>

          <div className="flex items-center justify-between">
            <Label>{t("rss.fields.enabled")}</Label>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("rss.fields.mustContain")}</Label>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground font-normal">{t("rss.fields.useRegex")}</Label>
                <Switch checked={form.use_regex} onCheckedChange={(v) => setForm({ ...form, use_regex: v })} />
              </div>
            </div>
            <Input
              value={form.must_contain}
              onChange={(e) => setForm({ ...form, must_contain: e.target.value })}
              placeholder="1080p WEB-DL"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("rss.fields.mustNotContain")}</Label>
            <Input
              value={form.must_not_contain}
              onChange={(e) => setForm({ ...form, must_not_contain: e.target.value })}
              placeholder="CAM TS"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("rss.fields.affectedFeeds")}</Label>
            <Textarea
              value={feedsText}
              onChange={(e) => setFeedsText(e.target.value)}
              placeholder={t("rss.fields.affectedFeedsPlaceholder")}
              rows={3}
            />
            {workerFeeds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("rss.fields.affectedFeedsHelp")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("rss.fields.assignedCategory")}</Label>
              <Input
                value={form.assigned_category || ""}
                onChange={(e) => setForm({ ...form, assigned_category: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("rss.fields.savePath")}</Label>
              <Input
                value={form.save_path || ""}
                onChange={(e) => setForm({ ...form, save_path: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label>{t("rss.fields.addPaused")}</Label>
              <Switch checked={form.add_paused} onCheckedChange={(v) => setForm({ ...form, add_paused: v })} />
            </div>
            <div className="space-y-2">
              <Label>{t("rss.fields.ignoreDays")}</Label>
              <Input
                type="number"
                min={0}
                value={form.ignore_days}
                onChange={(e) => setForm({ ...form, ignore_days: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
