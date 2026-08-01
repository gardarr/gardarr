import { describe, expect, it } from "vitest";
import { getTorrentRenderKey, type TorrentListItem } from "../types";

describe("getTorrentRenderKey", () => {
  it("keeps equal torrent hashes distinct across workers", () => {
    const torrent = {
      id: "same-hash",
      hash: "same-hash",
    } as TorrentListItem;

    expect(getTorrentRenderKey({ ...torrent, workerUUID: "worker-a" })).toBe(
      "worker-a:same-hash"
    );
    expect(getTorrentRenderKey({ ...torrent, workerUUID: "worker-b" })).toBe(
      "worker-b:same-hash"
    );
  });
});
