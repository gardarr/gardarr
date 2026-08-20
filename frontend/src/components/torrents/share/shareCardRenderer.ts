import i18n from "@/i18n";
import gardarrBannerUrl from "@/assets/img/banner.png";
import type { Task } from "@/types/torrent";
import { formatBytes } from "@/utils/bytes";
import {
  getGradeDescription,
  getGradeMessage,
  getGradeStars,
  getRatioGrade,
} from "@/utils/ratioUtils";

export type ShareCardFormat = "portrait" | "square" | "story";
export type ShareCardTheme = "light" | "dark";

export interface ShareCardOptions {
  format: ShareCardFormat;
  theme: ShareCardTheme;
  imagePositionY?: number;
  includeDescription?: boolean;
  titleColor?: string;
  username?: string;
}

export const SHARE_CARD_FORMATS: Record<ShareCardFormat, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

interface CardPalette {
  background: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  muted: string;
  imageOverlay: string;
  imageFadeEnd: string;
}

export function getShareCardImageSource(torrent: Task): string | undefined {
  return torrent.metadata?.image_url;
}

export function getShareCardNames(torrent: Task): {
  title: string;
  originalName?: string;
} {
  const originalName = torrent.name.trim();
  const normalizedName = torrent.metadata?.name?.trim();

  if (normalizedName && normalizedName !== originalName) {
    return { title: normalizedName, originalName };
  }

  return { title: originalName || normalizedName || "Torrent" };
}

export function getTorrentSharingTime(torrent: Task, now = new Date()): string {
  const completedAt = torrent.completed_at ? new Date(torrent.completed_at) : null;
  const createdAt = torrent.created_at ? new Date(torrent.created_at) : null;
  const start = completedAt && !Number.isNaN(completedAt.getTime()) ? completedAt : createdAt;

  if (!start || Number.isNaN(start.getTime())) return "—";

  const totalMinutes = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  if (days > 0) return `${days} ${i18n.t("duration.day", { count: days })}`;

  const hours = Math.floor(totalMinutes / 60);
  if (hours > 0) return `${hours} ${i18n.t("duration.hour", { count: hours })}`;

  return `${totalMinutes} ${i18n.t("duration.minute", { count: totalMinutes })}`;
}

export function getShareCardUsernameLabel(username?: string): string | undefined {
  const trimmed = username?.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export function resolveShareCardImageUrl(url: string, currentOrigin = window.location.origin): string {
  const parsedUrl = new URL(url, currentOrigin);

  // APP_URL can point to an internal host when Gardarr is behind a proxy.
  // Serve authenticated media through the origin currently open in the
  // browser so the session is preserved and Canvas can export the PNG.
  if (parsedUrl.pathname.startsWith("/media/")) {
    return `${currentOrigin}${parsedUrl.pathname}${parsedUrl.search}`;
  }

  return parsedUrl.toString();
}

const GRADE_ACCENTS: Record<string, string> = {
  "S++": "#a855f7",
  "S+": "#ec4899",
  S: "#eab308",
  A: "#22c55e",
  B: "#3b82f6",
  C: "#f97316",
  D: "#ef4444",
  E: "#64748b",
};

const shareCardImageCache = new Map<string, Promise<HTMLImageElement | null>>();

function getPalette(theme: ShareCardTheme): CardPalette {
  if (theme === "light") {
    return {
      background: "#f8fafc",
      surface: "rgba(255,255,255,0.88)",
      surfaceBorder: "rgba(15,23,42,0.12)",
      text: "#0f172a",
      muted: "#475569",
      imageOverlay: "rgba(15,23,42,0.12)",
      imageFadeEnd: "rgba(248,250,252,1)",
    };
  }

  return {
    background: "#09090b",
    surface: "rgba(24,24,27,0.88)",
    surfaceBorder: "rgba(255,255,255,0.14)",
    text: "#fafafa",
    muted: "#a1a1aa",
    imageOverlay: "rgba(0,0,0,0.22)",
    imageFadeEnd: "rgba(9,9,11,1)",
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  positionY = 50,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = Math.max(0, (image.naturalWidth - sourceWidth) / 2);
  const normalizedPositionY = Math.min(100, Math.max(0, positionY));
  const sourceY = Math.max(0, image.naturalHeight - sourceHeight) * (normalizedPositionY / 100);

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function splitTextLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) lines.push(currentLine);
    currentLine = word;

    if (lines.length === maxLines) break;
  }

  if (lines.length < maxLines && currentLine) lines.push(currentLine);
  const wasTruncated = lines.join(" ").length < words.join(" ").length;

  if (wasTruncated && lines.length > 0) {
    let lastLine = lines[lines.length - 1];
    while (lastLine.length > 1 && context.measureText(`${lastLine}…`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1);
    }
    lines[lines.length - 1] = `${lastLine.trimEnd()}…`;
  }

  return lines.slice(0, maxLines);
}

function drawLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
) {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}

function fitSingleLine(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (context.measureText(text).width <= maxWidth) return text;

  let fitted = text;
  while (fitted.length > 1 && context.measureText(`${fitted}…`).width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  return `${fitted.trimEnd()}…`;
}

function drawUsernameBadge(
  context: CanvasRenderingContext2D,
  username: string | undefined,
  palette: CardPalette,
  canvasWidth: number,
  margin: number,
) {
  const label = getShareCardUsernameLabel(username);
  if (!label) return;

  context.save();
  context.font = "700 26px system-ui, -apple-system, sans-serif";
  context.textBaseline = "middle";
  const fittedLabel = fitSingleLine(context, label, 310);
  const horizontalPadding = 24;
  const badgeHeight = 58;
  const badgeWidth = context.measureText(fittedLabel).width + horizontalPadding * 2;
  const x = canvasWidth - margin - badgeWidth;
  const y = 48;

  roundedRect(context, x, y, badgeWidth, badgeHeight, badgeHeight / 2);
  context.fillStyle = palette.surface;
  context.fill();
  context.fillStyle = palette.text;
  context.fillText(fittedLabel, x + horizontalPadding, y + badgeHeight / 2 + 1);
  context.restore();
}

async function loadCardImage(url?: string): Promise<HTMLImageElement | null> {
  if (!url) return null;

  const resolvedUrl = encodeURI(resolveShareCardImageUrl(url));
  const cached = shareCardImageCache.get(resolvedUrl);
  if (cached) return cached;

  const request = (async () => {
    try {
      const image = new Image();
      image.decoding = "async";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Unable to load share card image"));
        image.src = resolvedUrl;
      });
      return image;
    } catch {
      shareCardImageCache.delete(resolvedUrl);
      return null;
    }
  })();

  shareCardImageCache.set(resolvedUrl, request);
  return request;
}

function drawRatioPanel(
  context: CanvasRenderingContext2D,
  torrent: Task,
  palette: CardPalette,
  accent: string,
  grade: string,
  banner: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
  format: ShareCardFormat,
) {
  context.save();
  roundedRect(context, x, y, width, height, 42);
  context.fillStyle = palette.surface;
  context.fill();
  context.strokeStyle = palette.surfaceBorder;
  context.lineWidth = 2;
  context.stroke();

  const left = x + 46;
  const top = y + 42;
  const gradeColumnWidth = format === "story" ? 330 : 286;
  const dividerX = x + width - gradeColumnWidth;

  context.save();
  if (banner) {
    const bannerWidth = format === "story" ? 250 : 220;
    const bannerHeight = bannerWidth * (banner.naturalHeight / banner.naturalWidth);
    const logoAreaCenterX = dividerX - 190;
    const bannerX = logoAreaCenterX - bannerWidth / 2;
    const bannerY = y - bannerHeight / 2;
    context.shadowColor = "rgba(0,0,0,0.3)";
    context.shadowBlur = 14;
    context.shadowOffsetY = 6;
    context.drawImage(banner, bannerX, bannerY, bannerWidth, bannerHeight);
  } else {
    context.fillStyle = palette.muted;
    context.font = "800 24px system-ui, -apple-system, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("GARDARR", dividerX - 190, y);
    context.textAlign = "left";
  }
  context.restore();

  context.fillStyle = palette.muted;
  context.font = "700 22px system-ui, -apple-system, sans-serif";
  context.textBaseline = "alphabetic";
  context.fillText(i18n.t("torrentDetails.shareCard.card.ratio").toUpperCase(), left, top + 20);

  context.fillStyle = palette.text;
  context.font = `800 ${format === "story" ? 74 : 66}px system-ui, -apple-system, sans-serif`;
  context.fillText(`${Number(torrent.ratio || 0).toFixed(2)}x`, left, top + 94);

  const statY = top + (format === "story" ? 156 : 140);
  const secondStatY = statY + (format === "story" ? 104 : 94);
  context.fillStyle = palette.muted;
  context.font = "700 20px system-ui, -apple-system, sans-serif";
  context.fillText(i18n.t("torrentDetails.shareCard.card.uploaded").toUpperCase(), left, statY);
  context.fillText(i18n.t("torrentDetails.shareCard.card.size").toUpperCase(), left + 250, statY);

  context.fillStyle = palette.text;
  context.font = "650 30px system-ui, -apple-system, sans-serif";
  context.fillText(formatBytes(torrent.network?.upload?.amount || 0), left, statY + 42);
  context.fillText(formatBytes(torrent.size || 0), left + 250, statY + 42);

  context.fillStyle = palette.muted;
  context.font = "700 20px system-ui, -apple-system, sans-serif";
  context.fillText(i18n.t("torrentDetails.shareCard.card.sharingTime").toUpperCase(), left, secondStatY);
  context.fillText(i18n.t("torrentDetails.shareCard.card.popularity").toUpperCase(), left + 250, secondStatY);

  context.fillStyle = palette.text;
  context.font = "650 30px system-ui, -apple-system, sans-serif";
  context.fillText(getTorrentSharingTime(torrent), left, secondStatY + 42);
  context.fillText(Number(torrent.popularity || 0).toFixed(2), left + 250, secondStatY + 42);

  context.beginPath();
  context.moveTo(dividerX, y + 30);
  context.lineTo(dividerX, y + height - 30);
  context.strokeStyle = palette.surfaceBorder;
  context.stroke();

  const gradeCenterX = dividerX + gradeColumnWidth / 2;
  const gradeCenterY = y + height / 2;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = accent;
  context.shadowColor = accent;
  context.shadowBlur = 28;
  context.font = `900 ${format === "story" ? 142 : 124}px system-ui, -apple-system, sans-serif`;
  context.fillText(grade, gradeCenterX, gradeCenterY - 48);
  context.shadowBlur = 0;

  const stars = getGradeStars(grade);
  context.font = `700 ${format === "story" ? 34 : 30}px system-ui, -apple-system, sans-serif`;
  context.fillText(`${"★".repeat(stars)}${"☆".repeat(5 - stars)}`, gradeCenterX, gradeCenterY + 45);
  context.fillStyle = palette.muted;
  context.font = `800 ${format === "story" ? 28 : 25}px system-ui, -apple-system, sans-serif`;
  context.fillText(getGradeDescription(grade), gradeCenterX, gradeCenterY + 88);

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillStyle = palette.muted;
  context.font = "500 22px system-ui, -apple-system, sans-serif";
  const messageMaxWidth = dividerX - left - 28;
  const messageLines = splitTextLines(context, getGradeMessage(grade), messageMaxWidth, format === "story" ? 3 : 2);
  drawLines(context, messageLines, left, y + height - 38 - (messageLines.length - 1) * 30, 30);
  context.restore();
}

export async function renderShareCard(
  canvas: HTMLCanvasElement,
  torrent: Task,
  options: ShareCardOptions,
): Promise<void> {
  const dimensions = SHARE_CARD_FORMATS[options.format];
  const [image, gardarrBanner] = await Promise.all([
    loadCardImage(getShareCardImageSource(torrent)),
    loadCardImage(gardarrBannerUrl),
  ]);
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported");

  const { width, height } = dimensions;
  const palette = getPalette(options.theme);
  const grade = getRatioGrade(Number(torrent.ratio || 0));
  const accent = GRADE_ACCENTS[grade] ?? GRADE_ACCENTS.E;
  const margin = 64;
  const hasDescription = options.includeDescription !== false && Boolean(torrent.metadata?.description);
  const panelHeight = options.format === "story" ? 470 : options.format === "square" ? 400 : 420;
  const panelY = height - panelHeight - margin;
  const defaultImageHeight = options.format === "story" ? 1000 : options.format === "square" ? 600 : 710;
  const imageHeight = hasDescription ? defaultImageHeight : panelY + 40;

  context.fillStyle = palette.background;
  context.fillRect(0, 0, width, height);

  if (image) {
    drawCoverImage(context, image, 0, 0, width, imageHeight, options.imagePositionY ?? 50);
  } else {
    const fallback = context.createLinearGradient(0, 0, width, imageHeight);
    fallback.addColorStop(0, accent);
    fallback.addColorStop(1, palette.background);
    context.fillStyle = fallback;
    context.fillRect(0, 0, width, imageHeight);
  }

  context.fillStyle = palette.imageOverlay;
  context.fillRect(0, 0, width, imageHeight);

  const fade = context.createLinearGradient(0, Math.max(0, imageHeight - 360), 0, imageHeight + 40);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, palette.imageFadeEnd);
  context.fillStyle = fade;
  context.fillRect(0, Math.max(0, imageHeight - 360), width, 400);

  drawUsernameBadge(context, options.username, palette, width, margin);

  const { title, originalName } = getShareCardNames(torrent);
  const releaseDate = torrent.metadata?.release_date;
  const titleLineHeight = options.format === "story" ? 72 : 64;
  const originalNameLineHeight = options.format === "story" ? 44 : 40;

  context.fillStyle = options.titleColor ?? palette.text;
  context.font = `800 ${options.format === "story" ? 62 : 54}px system-ui, -apple-system, sans-serif`;
  context.textBaseline = "alphabetic";
  const titleLines = splitTextLines(context, title, width - margin * 2, 2);
  const regularContentY = options.format === "story" ? 950 : options.format === "square" ? 420 : 610;
  const compactContentHeight = titleLines.length * titleLineHeight
    + (originalName ? originalNameLineHeight : 0)
    + (releaseDate ? 46 : 0);
  const contentY = hasDescription
    ? regularContentY
    : panelY - compactContentHeight - 34;
  drawLines(context, titleLines, margin, contentY, titleLineHeight);

  let cursorY = contentY + titleLines.length * titleLineHeight + 4;
  if (originalName) {
    context.fillStyle = palette.muted;
    context.font = `500 ${options.format === "story" ? 28 : 25}px system-ui, -apple-system, sans-serif`;
    context.fillText(
      fitSingleLine(context, originalName, width - margin * 2),
      margin,
      cursorY,
    );
    cursorY += originalNameLineHeight;
  }
  if (releaseDate) {
    context.fillStyle = accent;
    context.font = "700 25px system-ui, -apple-system, sans-serif";
    context.fillText(releaseDate, margin, cursorY);
    cursorY += 46;
  }

  if (hasDescription && torrent.metadata?.description) {
    context.fillStyle = palette.muted;
    context.font = `450 ${options.format === "story" ? 30 : 27}px system-ui, -apple-system, sans-serif`;
    const availableHeight = panelY - cursorY - 34;
    const lineHeight = options.format === "story" ? 42 : 38;
    const maxLinesBySpace = Math.max(0, Math.floor(availableHeight / lineHeight));
    const formatLimit = options.format === "story" ? 7 : options.format === "portrait" ? 4 : 3;
    if (maxLinesBySpace > 0) {
      const descriptionLines = splitTextLines(
        context,
        torrent.metadata.description,
        width - margin * 2,
        Math.min(formatLimit, maxLinesBySpace),
      );
      drawLines(context, descriptionLines, margin, cursorY, lineHeight);
    }
  }

  drawRatioPanel(
    context,
    torrent,
    palette,
    accent,
    grade,
    gardarrBanner,
    margin,
    panelY,
    width - margin * 2,
    panelHeight,
    options.format,
  );
}
