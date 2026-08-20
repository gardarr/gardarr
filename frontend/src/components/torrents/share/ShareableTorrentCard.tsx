import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Task } from "@/types/torrent";
import { cn } from "@/lib/utils";
import {
  renderShareCard,
  type ShareCardFormat,
  type ShareCardTheme,
} from "./shareCardRenderer";

interface ShareableTorrentCardProps {
  torrent: Task;
  format: ShareCardFormat;
  theme: ShareCardTheme;
  imagePositionY: number;
  includeDescription: boolean;
  titleColor: string;
  username: string;
  onImagePositionChange: (position: number) => void;
  className?: string;
}

export function ShareableTorrentCard({
  torrent,
  format,
  theme,
  imagePositionY,
  includeDescription,
  titleColor,
  username,
  onImagePositionChange,
  className,
}: ShareableTorrentCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startPosition: number } | null>(null);
  const hasRenderedRef = useRef(false);
  const [isRendering, setIsRendering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let active = true;
    if (!hasRenderedRef.current) setIsRendering(true);
    setHasError(false);

    renderShareCard(canvas, torrent, { format, theme, imagePositionY, includeDescription, titleColor, username })
      .catch(() => {
        if (active) setHasError(true);
      })
      .finally(() => {
        if (active) {
          hasRenderedRef.current = true;
          setIsRendering(false);
        }
      });

    return () => {
      active = false;
    };
  }, [format, imagePositionY, includeDescription, theme, titleColor, torrent, username]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startPosition: imagePositionY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const height = Math.max(1, event.currentTarget.getBoundingClientRect().height);
    const nextPosition = drag.startPosition - ((event.clientY - drag.startY) / height) * 100;
    onImagePositionChange(Math.min(100, Math.max(0, nextPosition)));
  };

  const finishDragging = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className={cn("relative flex h-full w-full items-center justify-center", className)}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-grab touch-none rounded-md object-contain shadow-2xl active:cursor-grabbing lg:h-auto lg:w-auto lg:max-h-full lg:max-w-full"
        role="img"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDragging}
        onPointerCancel={finishDragging}
        aria-label={t("torrentDetails.shareCard.previewAria", {
          title: torrent.metadata?.name || torrent.name,
        })}
      />
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/65 text-sm text-muted-foreground backdrop-blur-sm">
          {t("torrentDetails.shareCard.rendering")}
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-destructive/10 px-6 text-center text-sm text-destructive">
          {t("torrentDetails.shareCard.previewError")}
        </div>
      )}
    </div>
  );
}
