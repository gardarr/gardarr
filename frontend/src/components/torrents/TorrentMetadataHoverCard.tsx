import {
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { Image as ImageIcon } from "lucide-react";

import { getTorrentDisplayDescription, getTorrentDisplayName, getTorrentImageUrl, hasTorrentMetadata } from "./helpers";
import type { TorrentListItem } from "./types";

type PreviewPosition = {
  top: number;
  left: number;
};

function canUseHoverPreview() {
  if (typeof globalThis.window === "undefined" || typeof globalThis.window.matchMedia !== "function") {
    return true;
  }

  return globalThis.window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function TorrentMetadataHoverCard({
  torrent,
  children,
  ...passthroughProps
}: {
  torrent: TorrentListItem;
  children: ReactElement;
} & HTMLAttributes<HTMLElement>) {
  const [hoverEnabled, setHoverEnabled] = useState(canUseHoverPreview);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PreviewPosition>({ top: 0, left: 0 });

  useEffect(() => {
    if (typeof globalThis.window === "undefined" || typeof globalThis.window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = globalThis.window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateHoverEnabled = () => setHoverEnabled(mediaQuery.matches);

    updateHoverEnabled();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateHoverEnabled);
      return () => mediaQuery.removeEventListener("change", updateHoverEnabled);
    }

    mediaQuery.addListener(updateHoverEnabled);
    return () => mediaQuery.removeListener(updateHoverEnabled);
  }, []);

  const hasMetadata = hasTorrentMetadata(torrent);
  const imageUrl = getTorrentImageUrl(torrent);
  const title = getTorrentDisplayName(torrent);
  const description = getTorrentDisplayDescription(torrent);
  const portalRoot = typeof document !== "undefined" ? document.body : null;

  const updatePosition = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const previewWidth = 320;
    const gutter = 12;
    const maxLeft = Math.max(gutter, window.innerWidth - previewWidth - gutter);
    const preferredLeft = rect.right + gutter;
    const nextLeft = preferredLeft <= maxLeft
      ? preferredLeft
      : Math.max(gutter, rect.left - previewWidth - gutter);
    const nextTop = Math.min(
      Math.max(gutter, rect.top),
      Math.max(gutter, window.innerHeight - 132 - gutter)
    );

    setPosition({
      top: nextTop,
      left: nextLeft,
    });
  };

  const handleMouseEnter = (event: ReactMouseEvent<HTMLElement>) => {
    updatePosition(event.currentTarget);
    setIsOpen(true);
  };

  const handleMouseMove = (event: ReactMouseEvent<HTMLElement>) => {
    updatePosition(event.currentTarget);
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  const child = useMemo(() => {
    if (!isValidElement(children)) {
      return children;
    }

    const childElement = children as ReactElement<{
      onMouseEnter?: (event: ReactMouseEvent<HTMLElement>) => void;
      onMouseMove?: (event: ReactMouseEvent<HTMLElement>) => void;
      onMouseLeave?: (event: ReactMouseEvent<HTMLElement>) => void;
      [key: string]: unknown;
    }>;
    const originalProps = childElement.props;
    const shouldAttachHoverHandlers = hoverEnabled && hasMetadata;

    return cloneElement(childElement, {
      ...passthroughProps,
      onMouseEnter: (event: ReactMouseEvent<HTMLElement>) => {
        const passthroughMouseEnter = passthroughProps.onMouseEnter as ((event: ReactMouseEvent<HTMLElement>) => void) | undefined;
        passthroughMouseEnter?.(event);
        originalProps.onMouseEnter?.(event);
        if (shouldAttachHoverHandlers) {
          handleMouseEnter(event);
        }
      },
      onMouseMove: (event: ReactMouseEvent<HTMLElement>) => {
        const passthroughMouseMove = passthroughProps.onMouseMove as ((event: ReactMouseEvent<HTMLElement>) => void) | undefined;
        passthroughMouseMove?.(event);
        originalProps.onMouseMove?.(event);
        if (shouldAttachHoverHandlers) {
          handleMouseMove(event);
        }
      },
      onMouseLeave: (event: ReactMouseEvent<HTMLElement>) => {
        const passthroughMouseLeave = passthroughProps.onMouseLeave as ((event: ReactMouseEvent<HTMLElement>) => void) | undefined;
        passthroughMouseLeave?.(event);
        originalProps.onMouseLeave?.(event);
        if (shouldAttachHoverHandlers) {
          handleMouseLeave();
        }
      },
    });
  }, [children, handleMouseEnter, handleMouseLeave, handleMouseMove, hasMetadata, hoverEnabled, passthroughProps]);

  return (
    <>
      {child}
      {hoverEnabled && hasMetadata && isOpen && portalRoot
        ? createPortal(
          <div
            className="pointer-events-none fixed z-50 w-80 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg"
            style={{ top: position.top, left: position.left }}
          >
            <div className="flex gap-3 p-3">
              <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted via-muted/80 to-muted-foreground/10">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5 text-foreground">
                  {title}
                </p>
                {description ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          ,
          portalRoot
        )
        : null}
    </>
  );
}
