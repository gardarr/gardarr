import { Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface TimePickerProps {
  value: string;
  onValueChange: (value: string) => void;
  minuteStep?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));

function parseTime(value: string) {
  const [rawHour = "00", rawMinute = "00"] = value.split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour < 24 ? String(hour).padStart(2, "0") : "00",
    minute: Number.isInteger(minute) && minute >= 0 && minute < 60 ? String(minute).padStart(2, "0") : "00",
  };
}

// A controlled, 24-hour picker composed from the project's shadcn-style
// primitives. The value remains the API's HH:MM representation.
export function TimePicker({ value, onValueChange, minuteStep = 1, disabled, className, "aria-label": ariaLabel }: TimePickerProps) {
  const { hour, minute } = parseTime(value);
  const safeMinuteStep = Math.max(1, Math.min(60, Math.floor(minuteStep)));
  const minutes = Array.from({ length: Math.ceil(60 / safeMinuteStep) }, (_, index) => String(index * safeMinuteStep).padStart(2, "0"));
  const selectedMinute = minutes.includes(minute) ? minute : minutes.reduce((closest, current) => Math.abs(Number(current) - Number(minute)) < Math.abs(Number(closest) - Number(minute)) ? current : closest, minutes[0]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("w-full justify-start font-normal tabular-nums", className)} disabled={disabled} aria-label={ariaLabel}>
          <Clock3 className="mr-2 h-4 w-4 text-muted-foreground" />
          {hour}:{minute}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Select value={hour} onValueChange={nextHour => onValueChange(`${nextHour}:${minute}`)} disabled={disabled}>
            <SelectTrigger aria-label="Hour"><SelectValue /></SelectTrigger>
            <SelectContent>{hours.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-sm font-medium text-muted-foreground">:</span>
          <Select value={selectedMinute} onValueChange={nextMinute => onValueChange(`${hour}:${nextMinute}`)} disabled={disabled}>
            <SelectTrigger aria-label="Minute"><SelectValue /></SelectTrigger>
            <SelectContent>{minutes.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
