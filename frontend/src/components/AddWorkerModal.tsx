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
  Eye,
  EyeOff,
  Check,
  Plus,
  Server,
  Shuffle,
  Copy
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { workerService } from "../services/workers";
import type { CreateWorkerRequest, Worker } from "../types/worker";
import { toast } from "sonner";
import { WorkerIcon } from "./ui/WorkerIcon";
import { availableIcons, availableColors } from "../utils/workerUtils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface AddWorkerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (worker: Worker) => void;
}

function generateToken(length = 40): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);
  return Array.from(randomValues).map(val => chars[val % chars.length]).join("");
}

export function AddWorkerModal({ open, onOpenChange, onSuccess }: AddWorkerModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [form, setForm] = useState<CreateWorkerRequest>({
    name: "",
    type: "qbittorrent",
    address: "",
    token: "",
    icon: "QBittorrent",
    color: "#3b82f6"
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: "",
        type: "qbittorrent",
        address: "",
        token: "",
        icon: "QBittorrent",
        color: "#3b82f6"
      });
      setShowToken(false);
    }
  }, [open]);

  const handleGenerateToken = () => {
    const token = generateToken();
    setForm({ ...form, token });
    setShowToken(true);
  };

  const handleCopyToken = async () => {
    if (!form.token) return;
    try {
      await navigator.clipboard.writeText(form.token);
      toast.success(t('workers.tokenCopied'));
    } catch {
      toast.error(t('workers.tokenCopyFailed'));
    }
  };

  const handleCreateWorker = async () => {
    if (!form.name) {
      toast.error(t('workers.errors.nameRequired'));
      return;
    }
    if (!form.address) {
      toast.error(t('workers.errors.addressRequired'));
      return;
    }
    if (!form.token) {
      toast.error(t('workers.errors.tokenRequired'));
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

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-sm">{t('workers.address')} *</Label>
            <Input
              id="address"
              placeholder="https://worker.domain"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="h-9"
            />
          </div>

          {/* Token */}
          <div className="space-y-1.5">
            <Label htmlFor="token" className="text-sm">{t('workers.token')} *</Label>
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id="token"
                  type={showToken ? "text" : "password"}
                  placeholder={t('workers.authenticationToken')}
                  value={form.token}
                  onChange={(e) => setForm({ ...form, token: e.target.value })}
                  className="h-9 pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleGenerateToken}
                      className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-md border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Shuffle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('workers.generateToken')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      disabled={!form.token}
                      className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('workers.copyToken')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
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
                  {form.address || "https://worker.domain"}
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
