import type { TorrentListItem } from "./types";

export function getTorrentDisplayName(torrent: TorrentListItem) {
  return torrent.metadata?.name || torrent.name;
}

export function getTorrentImageUrl(torrent: TorrentListItem) {
  return torrent.metadata?.image_url ? encodeURI(torrent.metadata.image_url) : undefined;
}
