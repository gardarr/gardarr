import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2, Save, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { workerService } from "../services/workers";
import type { SpeedLimitsSchema, ActiveLimitsSchema } from "../types/worker";
import { formatBytesPerSecond } from "../utils/bytes";
import { QBittorrentIcon } from "@/components/ui/QBittorrentIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const MAX_SPEED_LIMIT_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB/s upper bound for slider
const SPEED_SLIDER_STEP_BYTES = 100 * 1024; // 100 KB increments keep slider responsive

const sanitizeSpeedInput = (rawValue: string): number => {
    if (rawValue === "" || rawValue === null) {
        return 0;
    }
    const parsed = Number.parseInt(rawValue, 10);
    if (isNaN(parsed)) {
        return 0;
    }
    return Math.max(0, parsed);
};

const getSliderDisplayValue = (bytesPerSecond: number): number => {
    if (bytesPerSecond <= 0) {
        return 0;
    }
    const clamped = Math.min(bytesPerSecond, MAX_SPEED_LIMIT_BYTES);
    return Math.max(
        SPEED_SLIDER_STEP_BYTES,
        Math.round(clamped / SPEED_SLIDER_STEP_BYTES) * SPEED_SLIDER_STEP_BYTES
    );
};

const applySliderValue = (value: number, setter: (nextValue: number) => void) => {
    if (value <= 0) {
        setter(0);
        return;
    }
    const normalized = Math.min(
        MAX_SPEED_LIMIT_BYTES,
        Math.max(0, Math.round(value / SPEED_SLIDER_STEP_BYTES) * SPEED_SLIDER_STEP_BYTES)
    );
    setter(normalized);
};

interface WorkerLimitsProps {
    workerId: string;
    disableScroll?: boolean;
}

export function WorkerLimits({ workerId, disableScroll = false }: WorkerLimitsProps) {
    const { t } = useTranslation();

    const [loading, setLoading] = useState(true);
    const [savingSpeedLimits, setSavingSpeedLimits] = useState(false);
    const [savingActiveLimits, setSavingActiveLimits] = useState(false);
    const [activeScheduleName, setActiveScheduleName] = useState<string | null>(null);

    // Speed limits state (0 = unlimited)
    const [downloadLimit, setDownloadLimit] = useState<number>(0);
    const [uploadLimit, setUploadLimit] = useState<number>(0);

    // Active limits state
    const [maxActiveDownloads, setMaxActiveDownloads] = useState<number>(1);
    const [maxActiveUploads, setMaxActiveUploads] = useState<number>(1);
    const [maxActiveTorrents, setMaxActiveTorrents] = useState<number>(1);
    const [maxActiveCheckingTorrents, setMaxActiveCheckingTorrents] = useState<number>(1);

    // Load current preferences
    useEffect(() => {
        const loadPreferences = async () => {
            try {
                setLoading(true);
                setActiveScheduleName(null);
                const [response, schedulePreview] = await Promise.all([
                    workerService.getWorkerPreferences(workerId),
                    workerService.getSchedulePreview(workerId),
                ]);

                if (response.error) {
                    toast.error(response.error);
                    return;
                }

                if (response.data) {
                    const prefs = response.data;
                    setDownloadLimit(prefs.global_rate_limits.download_speed_limit);
                    setUploadLimit(prefs.global_rate_limits.upload_speed_limit);
                    setMaxActiveDownloads(Math.max(1, prefs.active_torrent_limits.max_active_downloads));
                    setMaxActiveUploads(Math.max(1, prefs.active_torrent_limits.max_active_uploads));
                    setMaxActiveTorrents(Math.max(1, prefs.active_torrent_limits.max_active_torrents));
                    setMaxActiveCheckingTorrents(Math.max(1, prefs.active_torrent_limits.max_active_checking_torrents));
                }

                setActiveScheduleName(schedulePreview.data?.source === "schedule" ? schedulePreview.data.schedule?.name ?? null : null);
            } catch (err) {
                console.error('Failed to load preferences:', err);
                toast.error(String(err));
            } finally {
                setLoading(false);
            }
        };

        if (workerId) {
            loadPreferences();
        }
    }, [workerId]);

    // Save speed limits
    const handleSaveSpeedLimits = async () => {
        try {
            setSavingSpeedLimits(true);

            const speedLimits: SpeedLimitsSchema = {
                download_limit: downloadLimit,
                upload_limit: uploadLimit,
            };

            const response = await workerService.setWorkerSpeedLimits(workerId, speedLimits);

            if (response.error) {
                toast.error(response.error);
                return;
            }

            toast.success(t('workers.limits.speedToastTitle', 'Speed limits updated'));
        } catch (err) {
            console.error('Failed to save speed limits:', err);
            toast.error(String(err));
        } finally {
            setSavingSpeedLimits(false);
        }
    };

    // Save active limits
    const handleSaveActiveLimits = async () => {
        try {
            setSavingActiveLimits(true);

            const activeLimits: ActiveLimitsSchema = {
                max_active_downloads: maxActiveDownloads,
                max_active_uploads: maxActiveUploads,
                max_active_torrents: maxActiveTorrents,
                max_active_checking_torrents: maxActiveCheckingTorrents,
            };

            const response = await workerService.setWorkerActiveLimits(workerId, activeLimits);

            if (response.error) {
                toast.error(response.error);
                return;
            }

            toast.success(t('workers.limits.activeToastTitle', 'Active limits updated'));
        } catch (err) {
            console.error('Failed to save active limits:', err);
            toast.error(String(err));
        } finally {
            setSavingActiveLimits(false);
        }
    };

    // Format speed limit display - handle unlimited separately from formatting
    const formatSpeedLimit = (bytesPerSecond: number): string => {
        if (bytesPerSecond === 0) {
            return t('workers.limits.unlimited', 'Unlimited');
        }
        return formatBytesPerSecond(bytesPerSecond);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t('workers.limits.loading', 'Loading limits...')}</span>
            </div>
        );
    }

    const content = (
        <div className="space-y-6 p-4 pb-8">
            {activeScheduleName && (
                <Alert className="border-amber-500/50 bg-amber-50/80 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('workers.limits.scheduleActiveTitle', 'A speed schedule is active')}</AlertTitle>
                    <AlertDescription>
                        {t('workers.limits.scheduleActiveDescription', '“{{name}}” is currently controlling the limits. Changes saved here apply immediately, but are temporary until the next schedule transition. They also update the default limits used outside schedules.', { name: activeScheduleName })}
                    </AlertDescription>
                </Alert>
            )}
            {/* Speed Limits Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div>
                                    <QBittorrentIcon size="lg" className="text-primary h-5 w-5" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>qBittorrent</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <h3 className="text-lg font-semibold">{t('workers.limits.instanceSpeedLimits', 'Instance Speed Limits')}</h3>
                </div>

                <div className="space-y-4 p-4 container-content-background/50 rounded-lg">
                    {/* Speed Limits - Download and Upload in same row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Download Limit */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="download-limit" className="flex items-center gap-2">
                                    <Download className="h-4 w-4" />
                                    {t('workers.limits.downloadLimit', 'Download Limit')}
                                </Label>
                                <span className="text-sm text-muted-foreground">
                                    {formatSpeedLimit(downloadLimit)}
                                </span>
                            </div>
                            <Input
                                id="download-limit"
                                type="number"
                                value={downloadLimit}
                                onChange={(e) => {
                                    setDownloadLimit(sanitizeSpeedInput(e.target.value));
                                }}
                                placeholder="0"
                                min="0"
                                autoComplete="off"
                            />
                            <div className="space-y-2">
                                <Slider
                                    value={[downloadLimit === 0 ? 0 : getSliderDisplayValue(downloadLimit)]}
                                    min={0}
                                    max={MAX_SPEED_LIMIT_BYTES}
                                    step={SPEED_SLIDER_STEP_BYTES}
                                    onValueChange={(value) => applySliderValue(value[0], setDownloadLimit)}
                                />
                                <div className="flex justify-between text-xs text-muted-foreground px-1">
                                    <span>{t('workers.limits.unlimited', 'Unlimited')}</span>
                                    <span>{formatBytesPerSecond(MAX_SPEED_LIMIT_BYTES)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Upload Limit */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="upload-limit" className="flex items-center gap-2">
                                    <Upload className="h-4 w-4" />
                                    {t('workers.limits.uploadLimit', 'Upload Limit')}
                                </Label>
                                <span className="text-sm text-muted-foreground">
                                    {formatSpeedLimit(uploadLimit)}
                                </span>
                            </div>
                            <Input
                                id="upload-limit"
                                type="number"
                                value={uploadLimit}
                                onChange={(e) => {
                                    setUploadLimit(sanitizeSpeedInput(e.target.value));
                                }}
                                placeholder="0"
                                min="0"
                                autoComplete="off"
                            />
                            <div className="space-y-2">
                                <Slider
                                    value={[uploadLimit === 0 ? 0 : getSliderDisplayValue(uploadLimit)]}
                                    min={0}
                                    max={MAX_SPEED_LIMIT_BYTES}
                                    step={SPEED_SLIDER_STEP_BYTES}
                                    onValueChange={(value) => applySliderValue(value[0], setUploadLimit)}
                                />
                                <div className="flex justify-between text-xs text-muted-foreground px-1">
                                    <span>{t('workers.limits.unlimited', 'Unlimited')}</span>
                                    <span>{formatBytesPerSecond(MAX_SPEED_LIMIT_BYTES)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Button
                        onClick={handleSaveSpeedLimits}
                        disabled={savingSpeedLimits}
                        className="w-full"
                    >
                        {savingSpeedLimits ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('workers.limits.saving', 'Saving...')}
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                {t('workers.limits.saveSpeedLimits', 'Save Speed Limits')}
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Active Torrents Limits Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div>
                                    <QBittorrentIcon size="lg" className="text-primary h-5 w-5" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>qBittorrent</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <h3 className="text-lg font-semibold">{t('workers.limits.instanceActiveLimits', 'Instance Active Torrent Limits')}</h3>
                </div>

                <div className="space-y-4 p-4 container-content-background/50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Max Active Downloads */}
                        <div className="space-y-2">
                            <Label htmlFor="max-active-downloads">
                                {t('workers.limits.maxActiveDownloads', 'Max Active Downloads')}
                            </Label>
                            <Input
                                id="max-active-downloads"
                                type="number"
                                value={maxActiveDownloads}
                                onChange={(e) => setMaxActiveDownloads(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                                placeholder="1"
                                min="1"
                            />
                        </div>

                        {/* Max Active Uploads */}
                        <div className="space-y-2">
                            <Label htmlFor="max-active-uploads">
                                {t('workers.limits.maxActiveUploads', 'Max Active Uploads')}
                            </Label>
                            <Input
                                id="max-active-uploads"
                                type="number"
                                value={maxActiveUploads}
                                onChange={(e) => setMaxActiveUploads(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                                placeholder="1"
                                min="1"
                            />
                        </div>

                        {/* Max Active Torrents */}
                        <div className="space-y-2">
                            <Label htmlFor="max-active-torrents">
                                {t('workers.limits.maxActiveTorrents', 'Max Active Torrents')}
                            </Label>
                            <Input
                                id="max-active-torrents"
                                type="number"
                                value={maxActiveTorrents}
                                onChange={(e) => setMaxActiveTorrents(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                                placeholder="1"
                                min="1"
                            />
                        </div>

                        {/* Max Active Checking Torrents */}
                        <div className="space-y-2">
                            <Label htmlFor="max-active-checking">
                                {t('workers.limits.maxActiveChecking', 'Max Active Checking Torrents')}
                            </Label>
                            <Input
                                id="max-active-checking"
                                type="number"
                                value={maxActiveCheckingTorrents}
                                onChange={(e) => setMaxActiveCheckingTorrents(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                                placeholder="1"
                                min="1"
                            />
                        </div>
                    </div>

                    <Button
                        onClick={handleSaveActiveLimits}
                        disabled={savingActiveLimits}
                        className="w-full"
                    >
                        {savingActiveLimits ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('workers.limits.saving', 'Saving...')}
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                {t('workers.limits.saveActiveLimits', 'Save Active Limits')}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );

    if (disableScroll) {
        return content;
    }

    return (
        <ScrollArea className="h-full">
            {content}
        </ScrollArea>
    );
}
