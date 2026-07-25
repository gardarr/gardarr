import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  AddTorrentContext,
  type AddTorrentContextValue,
  type AddTorrentMode,
  type PendingTorrent,
} from "@/contexts/add-torrent-context";

export function AddTorrentProvider({ children }: { children: ReactNode }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalMode, setAddModalMode] = useState<AddTorrentMode>("magnet");
  const [pendingTorrents, setPendingTorrents] = useState<PendingTorrent[]>([]);

  const openAddModal = useCallback((mode: AddTorrentMode = "magnet") => {
    setAddModalMode(mode);
    setIsAddModalOpen(true);
  }, []);
  const closeAddModal = useCallback(() => setIsAddModalOpen(false), []);

  const addPendingTorrent = useCallback((pending: PendingTorrent) => {
    setPendingTorrents((prev) => {
      const hash = pending.hash.toLowerCase();
      if (prev.some((item) => item.hash === hash)) {
        return prev;
      }
      return [...prev, { ...pending, hash }];
    });
  }, []);

  const removePendingTorrent = useCallback((hash: string) => {
    const normalized = hash.toLowerCase();
    setPendingTorrents((prev) => prev.filter((item) => item.hash !== normalized));
  }, []);

  const value = useMemo<AddTorrentContextValue>(
    () => ({
      isAddModalOpen,
      addModalMode,
      openAddModal,
      closeAddModal,
      pendingTorrents,
      addPendingTorrent,
      removePendingTorrent,
    }),
    [isAddModalOpen, addModalMode, openAddModal, closeAddModal, pendingTorrents, addPendingTorrent, removePendingTorrent]
  );

  return <AddTorrentContext.Provider value={value}>{children}</AddTorrentContext.Provider>;
}
