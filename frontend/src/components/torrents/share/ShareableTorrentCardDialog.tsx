import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Copy,
  Download,
  LoaderCircle,
  Moon,
  RectangleVertical,
  Share2,
  Smartphone,
  Square,
  Sun,
} from "lucide-react";
import type { Task } from "@/types/torrent";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { ColorPicker } from "@/components/ColorPicker";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ShareableTorrentCard } from "./ShareableTorrentCard";
import {
  canShareCardFiles,
  copyShareCardImage,
  createShareCardBlob,
  downloadShareCardImage,
  shareCardImage,
} from "./shareCardExport";
import type { ShareCardFormat, ShareCardTheme } from "./shareCardRenderer";
import { cn } from "@/lib/utils";

interface ShareableTorrentCardDialogProps {
  torrent: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ShareAction = "copy" | "download" | "share";

const FORMAT_OPTIONS: Array<{
  value: ShareCardFormat;
  icon: typeof Square;
  ratio: string;
}> = [
  { value: "portrait", icon: RectangleVertical, ratio: "4:5" },
  { value: "square", icon: Square, ratio: "1:1" },
  { value: "story", icon: Smartphone, ratio: "9:16" },
];

export function ShareableTorrentCardDialog({
  torrent,
  open,
  onOpenChange,
}: ShareableTorrentCardDialogProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ShareCardFormat>("portrait");
  const [theme, setTheme] = useState<ShareCardTheme>("dark");
  const [imagePositionY, setImagePositionY] = useState(torrent.metadata?.image_position_y ?? 50);
  const [includeDescription, setIncludeDescription] = useState(false);
  const [username, setUsername] = useState("");
  const [titleColor, setTitleColor] = useState("#FAFAFA");
  const [isTitleColorCustom, setIsTitleColorCustom] = useState(false);
  const [busyAction, setBusyAction] = useState<ShareAction | null>(null);
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false);

  useEffect(() => {
    if (open) {
      setNativeShareAvailable(canShareCardFiles());
      setImagePositionY(torrent.metadata?.image_position_y ?? 50);
      setIncludeDescription(false);
      setUsername("");
    }
  }, [open, torrent.metadata?.image_position_y]);

  const handleThemeChange = (nextTheme: ShareCardTheme) => {
    setTheme(nextTheme);
    if (!isTitleColorCustom) {
      setTitleColor(nextTheme === "dark" ? "#FAFAFA" : "#0F172A");
    }
  };

  const createBlob = () => createShareCardBlob(torrent, {
    format,
    theme,
    imagePositionY,
    includeDescription,
    titleColor,
    username,
  });

  const runAction = async (action: ShareAction) => {
    setBusyAction(action);

    try {
      const blob = await createBlob();

      if (action === "copy") {
        await copyShareCardImage(blob);
        toast.success(t("torrentDetails.shareCard.toasts.copied"));
      } else if (action === "download") {
        downloadShareCardImage(blob, torrent);
        toast.success(t("torrentDetails.shareCard.toasts.downloaded"));
      } else {
        await shareCardImage(
          blob,
          torrent,
          t("torrentDetails.shareCard.shareText", {
            title: torrent.metadata?.name || torrent.name,
            ratio: Number(torrent.ratio || 0).toFixed(2),
          }),
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      const key = action === "copy"
        ? "torrentDetails.shareCard.toasts.copyError"
        : action === "download"
          ? "torrentDetails.shareCard.toasts.downloadError"
          : "torrentDetails.shareCard.toasts.shareError";
      toast.error(t(key));
    } finally {
      setBusyAction(null);
    }
  };

  const actionIcon = (action: ShareAction, Icon: typeof Copy) => (
    busyAction === action
      ? <LoaderCircle className="h-4 w-4 animate-spin" />
      : <Icon className="h-4 w-4" />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-share-card-dialog
        className="flex h-auto max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-none flex-col overflow-hidden rounded-xl border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:h-[95dvh] sm:max-h-[95dvh] sm:w-[96vw] sm:max-w-5xl sm:rounded-lg sm:p-6"
      >
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{t("torrentDetails.shareCard.title")}</DialogTitle>
          <DialogDescription>{t("torrentDetails.shareCard.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:overflow-hidden">
          <div className="relative z-0 flex min-h-0 flex-none flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border bg-muted/35 p-2 sm:p-3 lg:h-full">
            <ShareableTorrentCard
              torrent={torrent}
              format={format}
              theme={theme}
              imagePositionY={imagePositionY}
              includeDescription={includeDescription}
              titleColor={titleColor}
              username={username}
              onImagePositionChange={setImagePositionY}
              className={cn(
                "h-auto w-full max-w-lg flex-none lg:h-full lg:max-w-none lg:aspect-auto",
                format === "square" && "aspect-square",
                format === "portrait" && "aspect-[4/5]",
                format === "story" && "aspect-[9/16]",
              )}
            />
            <div className="shrink-0 text-center text-xs text-muted-foreground">
              {t("torrentDetails.shareCard.dragHint")}
            </div>
          </div>

          <div className="relative z-10 flex min-h-0 flex-none flex-col gap-4 bg-background px-0.5 pb-1 lg:h-full lg:overflow-y-auto lg:bg-transparent lg:pr-1">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none">
                {t("torrentDetails.shareCard.formatLabel")}
              </legend>
              <ButtonGroup className="w-full">
                {FORMAT_OPTIONS.map(({ value, icon: Icon, ratio }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={format === value ? "default" : "outline"}
                    className="h-auto min-w-0 flex-1 flex-col gap-1 py-2"
                    aria-pressed={format === value}
                    onClick={() => setFormat(value)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{t(`torrentDetails.shareCard.formats.${value}`)}</span>
                    <span className="text-[10px] opacity-70">{ratio}</span>
                  </Button>
                ))}
              </ButtonGroup>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="share-card-username" className="text-sm font-medium">
                {t("torrentDetails.shareCard.username")}
              </label>
              <Input
                id="share-card-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={t("torrentDetails.shareCard.usernamePlaceholder")}
                maxLength={40}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                {t("torrentDetails.shareCard.usernameHint")}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-1">
                <label htmlFor="share-card-description" className="text-sm font-medium">
                  {t("torrentDetails.shareCard.includeDescription")}
                </label>
                <p className="text-xs text-muted-foreground">
                  {t("torrentDetails.shareCard.includeDescriptionHint")}
                </p>
              </div>
              <Switch
                id="share-card-description"
                checked={includeDescription}
                onCheckedChange={setIncludeDescription}
                aria-label={t("torrentDetails.shareCard.includeDescription")}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none">
                {t("torrentDetails.shareCard.themeLabel")}
              </legend>
              <ButtonGroup className="w-full">
                <Button
                  type="button"
                  variant={theme === "light" ? "default" : "outline"}
                  className="flex-1"
                  aria-pressed={theme === "light"}
                  onClick={() => handleThemeChange("light")}
                >
                  <Sun className="h-4 w-4" />
                  {t("torrentDetails.shareCard.themes.light")}
                </Button>
                <Button
                  type="button"
                  variant={theme === "dark" ? "default" : "outline"}
                  className="flex-1"
                  aria-pressed={theme === "dark"}
                  onClick={() => handleThemeChange("dark")}
                >
                  <Moon className="h-4 w-4" />
                  {t("torrentDetails.shareCard.themes.dark")}
                </Button>
              </ButtonGroup>
            </fieldset>

            <ColorPicker
              label={t("torrentDetails.shareCard.titleColor")}
              value={titleColor}
              onChange={(color) => {
                setTitleColor(color);
                setIsTitleColorCustom(true);
              }}
            />

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              {t("torrentDetails.shareCard.privacyNote")}
            </div>

            <div className="sticky bottom-0 z-10 -mx-0.5 mt-auto grid grid-cols-2 gap-2 bg-background/95 px-0.5 pb-1 pt-2 backdrop-blur-sm lg:static lg:grid-cols-1 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
              <Button
                type="button"
                variant="outline"
                disabled={busyAction !== null}
                onClick={() => void runAction("copy")}
              >
                {actionIcon("copy", Copy)}
                {t("torrentDetails.shareCard.copyImage")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busyAction !== null}
                onClick={() => void runAction("download")}
              >
                {actionIcon("download", Download)}
                {t("torrentDetails.shareCard.download")}
              </Button>
              {nativeShareAvailable && (
                <Button
                  type="button"
                  className="col-span-2 lg:col-span-1"
                  disabled={busyAction !== null}
                  onClick={() => void runAction("share")}
                >
                  {actionIcon("share", Share2)}
                  {t("torrentDetails.shareCard.nativeShare")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
