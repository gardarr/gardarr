import type { Task } from "@/types/torrent";
import { formatBytes } from "@/utils/bytes";

interface TorrentContributionWidgetProps {
  taskData: Task;
}

export function TorrentContributionWidget({ taskData }: TorrentContributionWidgetProps) {
  const downloadAmount = taskData.network.download.amount;
  const uploadAmount = taskData.network.upload.amount;
  const total = downloadAmount + uploadAmount;
  const downloadPercent = total > 0 ? (downloadAmount / total) * 100 : 50;
  const uploadPercent = total > 0 ? (uploadAmount / total) * 100 : 50;

  return (
    <div className="space-y-3 p-3 container-content-background/50 rounded-lg">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">Contribuição para a Rede</span>
        <span className="text-sm font-mono font-medium">
          {taskData.ratio.toFixed(2)}x
        </span>
      </div>
      
      {/* Barra de Proporção Download/Upload */}
      <div className="space-y-2">
        <div className="w-full h-2 rounded-lg overflow-hidden flex">
          {/* Parte de Download */}
          <div 
            className="transition-all duration-500"
            style={{ 
              width: `${downloadPercent}%`,
              background: `linear-gradient(90deg, var(--accent) 0%, color-mix(in oklch, var(--accent) 85%, black) 100%)`,
              minWidth: downloadPercent > 0 ? '8px' : '0'
            }}
          />
          
          {/* Parte de Upload */}
          <div 
            className="transition-all duration-500"
            style={{ 
              width: `${uploadPercent}%`,
              background: `linear-gradient(90deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 85%, black) 100%)`,
              minWidth: uploadPercent > 0 ? '8px' : '0'
            }}
          />
        </div>
        
        {/* Labels abaixo da barra */}
        <div className="flex justify-between items-center text-xs px-1">
          <div className="flex items-center gap-1">
            <div 
              className="w-3 h-3 rounded" 
              style={{ background: 'var(--accent)' }}
            ></div>
            <span className="font-medium text-muted-foreground">Baixado:</span>
            <span className="font-mono">{formatBytes(taskData.network.download.amount)}</span>
          </div>
          <div className="flex items-center gap-1">
            <div 
              className="w-3 h-3 rounded" 
              style={{ background: 'var(--primary)' }}
            ></div>
            <span className="font-medium text-muted-foreground">Enviado:</span>
            <span className="font-mono">{formatBytes(taskData.network.upload.amount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

