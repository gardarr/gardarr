import { Globe, Infinity as InfinityIcon, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LimitMode } from "@/utils/limitUtils";
import { useTranslation } from "react-i18next";

interface ModeButtonGroupProps {
  mode: LimitMode;
  onModeChange: (mode: LimitMode) => void;
}

export function ModeButtonGroup({ mode, onModeChange }: ModeButtonGroupProps) {
  const { t } = useTranslation();
  
  return (
    <ButtonGroup orientation="horizontal">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={mode === "unlimited" ? "default" : "outline"}
            size="icon"
            onClick={() => onModeChange("unlimited")}
          >
            <InfinityIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('modeButtonGroup.unlimited')}</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={mode === "global" ? "default" : "outline"}
            size="icon"
            onClick={() => onModeChange("global")}
          >
            <Globe className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('modeButtonGroup.globalLimit')}</p>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={mode === "custom" ? "default" : "outline"}
            size="icon"
            onClick={() => onModeChange("custom")}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('modeButtonGroup.custom')}</p>
        </TooltipContent>
      </Tooltip>
    </ButtonGroup>
  );
}

