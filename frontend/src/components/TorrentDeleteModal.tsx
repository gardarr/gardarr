import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface TorrentDeleteModalProps {
  isOpen: boolean;
  mode: "single" | "bulk";
  torrentName?: string;
  selectedCount?: number;
  onClose: () => void;
  onConfirm: (purge: boolean) => void;
}

export function TorrentDeleteModal({
  isOpen,
  mode,
  torrentName,
  selectedCount = 0,
  onClose,
  onConfirm,
}: TorrentDeleteModalProps) {
  const [purge, setPurge] = useState(false);

  const handleConfirm = () => {
    onConfirm(purge);
    setPurge(false);
  };

  const handleClose = () => {
    setPurge(false);
    onClose();
  };

  const isBulk = mode === "bulk";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">{isBulk ? "Remover Torrents" : "Remover Torrent"}</DialogTitle>
              <DialogDescription>
                Esta ação não pode ser desfeita
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {isBulk
              ? `Tem certeza que deseja remover ${selectedCount} torrents selecionados?`
              : "Tem certeza que deseja remover este torrent?"}
          </p>

          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium break-words">
              {isBulk ? `${selectedCount} selecionado(s)` : torrentName}
            </p>
          </div>

          <div className="flex items-start space-x-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4">
            <Checkbox
              id="purge"
              checked={purge}
              onCheckedChange={(checked: boolean) => setPurge(checked)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="purge" className="text-sm font-medium leading-none cursor-pointer">
                Remover arquivos do disco
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Se marcado, todos os arquivos baixados serão permanentemente deletados do disco
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            {purge ? (isBulk ? "Remover Tudo" : "Remover Tudo") : (isBulk ? "Remover Selecionados" : "Remover Torrent")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
