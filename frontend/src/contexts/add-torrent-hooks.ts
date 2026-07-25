import { useContext } from "react";
import { AddTorrentContext, type AddTorrentContextValue } from "@/contexts/add-torrent-context";

export function useAddTorrent(): AddTorrentContextValue {
  const context = useContext(AddTorrentContext);
  if (!context) {
    throw new Error("useAddTorrent must be used within an AddTorrentProvider");
  }
  return context;
}
