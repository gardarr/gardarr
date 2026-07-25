import { createContext } from "react";

export interface PendingTorrent {
  hash: string;
  name: string;
  size?: number;
  workerId: string;
  category: string;
  addedAt: number;
}

export type AddTorrentMode = "magnet" | "file";

export interface AddTorrentContextValue {
  isAddModalOpen: boolean;
  addModalMode: AddTorrentMode;
  openAddModal: (mode?: AddTorrentMode) => void;
  closeAddModal: () => void;
  pendingTorrents: PendingTorrent[];
  addPendingTorrent: (pending: PendingTorrent) => void;
  removePendingTorrent: (hash: string) => void;
}

export const AddTorrentContext = createContext<AddTorrentContextValue | undefined>(undefined);
