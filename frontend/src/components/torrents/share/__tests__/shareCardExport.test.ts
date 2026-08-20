import { describe, expect, it } from "vitest";
import type { Task } from "@/types/torrent";
import { getShareCardFileName } from "../shareCardExport";
import {
  getShareCardImageSource,
  getShareCardNames,
  getShareCardUsernameLabel,
  getTorrentSharingTime,
  resolveShareCardImageUrl,
  SHARE_CARD_FORMATS,
} from "../shareCardRenderer";

describe("share card export", () => {
  it("defines the expected social media dimensions", () => {
    expect(SHARE_CARD_FORMATS).toEqual({
      portrait: { width: 1080, height: 1350 },
      square: { width: 1080, height: 1080 },
      story: { width: 1080, height: 1920 },
    });
  });

  it("creates a safe file name from the friendly title", () => {
    const torrent = {
      name: "Technical.File.Name",
      metadata: { name: "Ação & Ficção: Edição Especial!" },
    } as Task;

    expect(getShareCardFileName(torrent)).toBe("gardarr-acao-ficcao-edicao-especial-ratio.png");
  });

  it("uses only the full torrent image", () => {
    const torrent = {
      metadata: {
        image_url: "/media/background.jpg",
        thumbnail_url: "/media/thumbnail.jpg",
      },
    } as Task;

    expect(getShareCardImageSource(torrent)).toBe("/media/background.jpg");
  });

  it("routes authenticated media through the browser origin", () => {
    expect(
      resolveShareCardImageUrl(
        "http://gardarr-internal:3200/media/uploads/images/cover.jpg",
        "https://gardarr.example.com",
      ),
    ).toBe("https://gardarr.example.com/media/uploads/images/cover.jpg");
  });

  it("keeps the real torrent name below a normalized title", () => {
    const torrent = {
      name: "Cyberpunk.2077.Ultimate.Edition.MULTi22-FitGirl",
      metadata: { name: "Cyberpunk 2077: Ultimate Edition" },
    } as Task;

    expect(getShareCardNames(torrent)).toEqual({
      title: "Cyberpunk 2077: Ultimate Edition",
      originalName: "Cyberpunk.2077.Ultimate.Edition.MULTi22-FitGirl",
    });
  });

  it("uses only the torrent name when no normalized name exists", () => {
    const torrent = { name: "Original Torrent Name", metadata: {} } as Task;

    expect(getShareCardNames(torrent)).toEqual({ title: "Original Torrent Name" });
  });

  it("calculates sharing time from the completion date", () => {
    const torrent = {
      created_at: "2026-01-01T00:00:00Z",
      completed_at: "2026-08-10T00:00:00Z",
    } as Task;

    expect(getTorrentSharingTime(torrent, new Date("2026-08-12T00:00:00Z"))).toBe("2 days");
  });

  it("falls back to the creation date when completion is unavailable", () => {
    const torrent = {
      created_at: "2026-08-11T12:00:00Z",
      completed_at: null,
    } as Task;

    expect(getTorrentSharingTime(torrent, new Date("2026-08-12T00:00:00Z"))).toBe("12 hours");
  });

  it("does not create a username badge for an empty custom field", () => {
    expect(getShareCardUsernameLabel("")).toBeUndefined();
    expect(getShareCardUsernameLabel("   ")).toBeUndefined();
  });

  it("adds the username marker only when needed", () => {
    expect(getShareCardUsernameLabel("gardarr_user")).toBe("@gardarr_user");
    expect(getShareCardUsernameLabel("@gardarr_user")).toBe("@gardarr_user");
  });
});
