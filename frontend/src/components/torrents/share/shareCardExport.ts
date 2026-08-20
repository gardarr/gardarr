import type { Task } from "@/types/torrent";
import { renderShareCard, type ShareCardOptions } from "./shareCardRenderer";

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to create PNG"));
    }, "image/png");
  });
}

export function getShareCardFileName(torrent: Task): string {
  const title = torrent.metadata?.name || torrent.name || "torrent";
  const safeTitle = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 72);

  return `gardarr-${safeTitle || "torrent"}-ratio.png`;
}

export async function createShareCardBlob(torrent: Task, options: ShareCardOptions): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  await renderShareCard(canvas, torrent, options);
  return canvasToBlob(canvas);
}

export async function copyShareCardImage(blob: Blob): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard is not supported");
  }

  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export function downloadShareCardImage(blob: Blob, torrent: Task): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = getShareCardFileName(torrent);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function canShareCardFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;

  try {
    const probe = new File([new Blob()], "gardarr-ratio.png", { type: "image/png" });
    return typeof navigator.canShare !== "function" || navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function shareCardImage(blob: Blob, torrent: Task, text: string): Promise<void> {
  const file = new File([blob], getShareCardFileName(torrent), { type: "image/png" });
  const data: ShareData = {
    files: [file],
    title: torrent.metadata?.name || torrent.name,
    text,
  };

  if (!canShareCardFiles()) throw new Error("File sharing is not supported");
  await navigator.share(data);
}
