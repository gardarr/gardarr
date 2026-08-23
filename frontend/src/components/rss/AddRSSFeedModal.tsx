import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface AddRSSFeedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workers: Worker[];
  defaultWorkerId?: string;
  onAdd: (workerId: string, url: string, path: string) => Promise<void>;
}

export function AddRSSFeedModal({ open, onOpenChange, workers, defaultWorkerId, onAdd }: AddRSSFeedModalProps) {
  const { t } = useTranslation();
  const [workerId, setWorkerId] = useState("");
  const [url, setUrl] = useState("");
  const [path, setPath] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setWorkerId(defaultWorkerId || workers[0]?.uuid || "");
      setUrl("");
      setPath("");
    }
  }, [open, defaultWorkerId, workers]);

  const handleSubmit = async () => {
    if (!workerId || !url.trim()) {
      toast.error(t("rss.errors.feedFieldsRequired"));
      return;
    }

    setSubmitting(true);
    try {
      await onAdd(workerId, url.trim(), path.trim());
      onOpenChange(false);
    } catch {
      // onAdd already surfaces the error via toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("rss.addFeed")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("rss.fields.worker")}</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
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
            <Label>{t("rss.fields.feedUrl")}</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/feed.rss"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("rss.fields.feedPath")}</Label>
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder={t("rss.fields.feedPathPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("rss.fields.feedPathHelp")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {t("rss.addFeed")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
