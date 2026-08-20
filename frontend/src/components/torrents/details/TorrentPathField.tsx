import { FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AutoSaveField } from "./AutoSaveField";

interface TorrentPathFieldProps {
  torrentId: string;
  path: string;
  onSetLocation?: (torrentId: string, location: string) => void;
}

export function TorrentPathField({ torrentId, path, onSetLocation }: TorrentPathFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        {t("torrentDetails.path.title", { defaultValue: "Caminho" })}
      </h3>
      {onSetLocation ? (
        <AutoSaveField
          icon={FolderOpen}
          value={path}
          ariaLabel={t("torrentDetails.path.edit", { defaultValue: "Editar caminho" })}
          copyText={path}
          onSave={(nextPath) => onSetLocation(torrentId, nextPath)}
        />
      ) : (
        <div className="flex min-h-7 items-center gap-2 text-xs sm:text-sm">
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 break-all text-muted-foreground">{path}</span>
        </div>
      )}
    </div>
  );
}
