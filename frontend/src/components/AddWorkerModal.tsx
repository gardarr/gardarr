import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Server,
  Check,
  Plus,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { workerService } from "../services/workers";
import type { CreateWorkerRequest, Worker } from "../types/worker";
import { toast } from "sonner";
import { WorkerIcon } from "./ui/WorkerIcon";
import { availableIcons, availableColors } from "../utils/workerUtils";
import { PasswordInput } from "./auth/PasswordInput";

interface AddWorkerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (worker: Worker) => void;
}

export function AddWorkerModal({ open, onOpenChange, onSuccess }: AddWorkerModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CreateWorkerRequest>({
    name: "",
    type: "qbittorrent",
    url: "",
    username: "",
    password: "",
    icon: "QBittorrent",
    color: "#3b82f6"
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: "",
        type: "qbittorrent",
        url: "",
        username: "",
        password: "",
        icon: "QBittorrent",
        color: "#3b82f6"
      });
    }
  }, [open]);

  const handleCreateWorker = async () => {
    if (!form.name) {
      toast.error(t('workers.errors.nameRequired'));
      return;
    }
    if (!form.url) {
      toast.error(t('workers.errors.addressRequired'));
      return;
    }
    if (!form.username || !form.password) {
      toast.error(t('workers.errors.connectionFailed'));
      return;
    }

    try {
      setLoading(true);
      const response = await workerService.createWorker(form);
      if (response.error) {
        toast.error(t('workers.errors.connectionFailed'), {
          description: response.error,
        });
      } else if (response.data) {
        toast.success(t('workers.success.created'));
        onSuccess(response.data);
        onOpenChange(false);
      }
    } catch {
      toast.error(t('workers.errors.failedToCreate'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Server className="h-6 w-6 text-primary" />
            </div>
            {t('workers.createNewWorker')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm">{t('workers.name')} *</Label>
            <Input
              id="name"
              placeholder={t('workers.workerName')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-9"
            />
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-sm">{t('workers.address')} *</Label>
            <Input
              id="address"
              placeholder="http://localhost:8080"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-sm">{t('workers.username', 'Username')} *</Label>
            <Input
              id="username"
              placeholder={t('workers.usernamePlaceholder', 'qBittorrent username')}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <PasswordInput
              id="password"
              label={t('workers.password', 'Password') + ' *'}
              placeholder={t('workers.passwordPlaceholder', 'qBittorrent password')}
              value={form.password}
              onChange={(value) => setForm({ ...form, password: value })}
              disabled={loading}
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label className="text-sm">{t('workers.color')}</Label>
            <div className="flex gap-1.5 flex-wrap">
              {availableColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    form.color === color.value ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setForm({ ...form, color: color.value })}
                  title={t(`workers.colors.${color.name.toLowerCase()}`)}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div className="space-y-1.5">
            <Label className="text-sm">{t('workers.icon')}</Label>
            <div className="flex gap-1.5 flex-wrap">
              {availableIcons.map((iconItem) => {
                const IconComponent = iconItem.icon;
                return (
                  <button
                    key={iconItem.name}
                    type="button"
                    className={`w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all hover:scale-110 ${
                      form.icon === iconItem.name
                        ? 'border-foreground bg-accent scale-110'
                        : 'border-border hover:bg-accent/50'
                    }`}
                    onClick={() => setForm({ ...form, icon: iconItem.name })}
                    title={iconItem.name}
                  >
                    <IconComponent className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <Label className="text-sm">{t('workers.preview')}</Label>
            <div className="flex items-center gap-3 p-3 container-content-background/50 rounded-lg">
              <WorkerIcon
                iconName={form.icon}
                color={form.color}
                size="md"
                className="w-12 h-12 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">
                  {form.name || t('workers.workerName')}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {form.url || "http://localhost:8080"}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateWorker} disabled={loading}>
              {loading ? (
                <Plus className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {t('workers.createWorker')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
