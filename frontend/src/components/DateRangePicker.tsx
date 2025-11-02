import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface DateRangePickerProps {
  fromDate: Date | undefined;
  toDate: Date | undefined;
  onFromDateChange: (date: Date | undefined) => void;
  onToDateChange: (date: Date | undefined) => void;
}

type RangeOption = 
  | { type: 'minute'; value: 5 | 10 | 30 } 
  | { type: 'hour'; value: 1 | 3 | 6 } 
  | { type: 'day'; value: 1 | 3 | 7 };

export default function DateRangePicker({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
}: DateRangePickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<RangeOption | undefined>(undefined);

  const applyRange = (range: RangeOption) => {
    const now = new Date();
    let start: Date;
    
    if (range.type === 'minute') {
      start = new Date(now.getTime() - range.value * 60 * 1000);
    } else if (range.type === 'hour') {
      start = new Date(now.getTime() - range.value * 60 * 60 * 1000);
    } else {
      start = new Date(now.getTime() - range.value * 24 * 60 * 60 * 1000);
    }
    
    onFromDateChange(start);
    onToDateChange(now);
    setSelectedRange(range);
    setIsOpen(false);
  };

  // Ensure default selection is 1h if no dates provided on mount
  useEffect(() => {
    if (!fromDate || !toDate) {
      const now = new Date();
      const start = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
      onFromDateChange(start);
      onToDateChange(now);
      setSelectedRange({ type: 'hour', value: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute matching preset from fromDate/toDate whenever they change
  useEffect(() => {
    if (!fromDate || !toDate) {
      setSelectedRange(undefined);
      return;
    }

    const diffMs = toDate.getTime() - fromDate.getTime();
    const minuteMs = 60 * 1000;
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;
    
    // Allow small tolerance for rounding (±1 second)
    const tolerance = 1000;

    // Check for minute ranges
    const minutes = diffMs / minuteMs;
    if (Math.abs(minutes - 5) < tolerance / minuteMs) {
      setSelectedRange({ type: 'minute', value: 5 });
      return;
    }
    if (Math.abs(minutes - 10) < tolerance / minuteMs) {
      setSelectedRange({ type: 'minute', value: 10 });
      return;
    }
    if (Math.abs(minutes - 30) < tolerance / minuteMs) {
      setSelectedRange({ type: 'minute', value: 30 });
      return;
    }

    // Check for hour ranges
    const hours = diffMs / hourMs;
    if (Math.abs(hours - 1) < tolerance / hourMs) {
      setSelectedRange({ type: 'hour', value: 1 });
      return;
    }
    if (Math.abs(hours - 3) < tolerance / hourMs) {
      setSelectedRange({ type: 'hour', value: 3 });
      return;
    }
    if (Math.abs(hours - 6) < tolerance / hourMs) {
      setSelectedRange({ type: 'hour', value: 6 });
      return;
    }

    // Check for day ranges
    const days = diffMs / dayMs;
    if (Math.abs(days - 1) < tolerance / dayMs) {
      setSelectedRange({ type: 'day', value: 1 });
      return;
    }
    if (Math.abs(days - 3) < tolerance / dayMs) {
      setSelectedRange({ type: 'day', value: 3 });
      return;
    }
    if (Math.abs(days - 7) < tolerance / dayMs) {
      setSelectedRange({ type: 'day', value: 7 });
      return;
    }

    // No matching preset found
    setSelectedRange(undefined);
  }, [fromDate, toDate]);

  const displayText = useMemo(() => {
    if (selectedRange) {
      if (selectedRange.type === 'minute') {
        return `${t("dateRangePicker.today")} -${selectedRange.value}${t("dateRangePicker.minuteShort")}`;
      } else if (selectedRange.type === 'hour') {
        return `${t("dateRangePicker.today")} -${selectedRange.value}${t("dateRangePicker.hourShort")}`;
      } else {
        return `${t("dateRangePicker.today")} -${selectedRange.value} ${t("dateRangePicker.dayShort")}`;
      }
    }
    
    if (fromDate && toDate) {
      // Try to infer known options
      const diffMs = toDate.getTime() - fromDate.getTime();
      const minuteMs = 60 * 1000;
      const hourMs = 60 * 60 * 1000;
      const dayMs = 24 * 60 * 60 * 1000;
      
      // Check for minute ranges first
      const minutes = Math.round(diffMs / minuteMs);
      if (minutes === 5 || minutes === 10 || minutes === 30) {
        return `${t("dateRangePicker.today")} -${minutes}${t("dateRangePicker.minuteShort")}`;
      }
      
      // Check for hour ranges
      const hours = Math.round(diffMs / hourMs);
      if (hours === 1 || hours === 3 || hours === 6) {
        return `${t("dateRangePicker.today")} -${hours}${t("dateRangePicker.hourShort")}`;
      }
      
      // Check for day ranges
      const days = Math.round(diffMs / dayMs);
      if (days === 1 || days === 3 || days === 7) {
        return `${t("dateRangePicker.today")} -${days} ${t("dateRangePicker.dayShort")}`;
      }
    }
    return t("dateRangePicker.selectInterval");
  }, [selectedRange, fromDate, toDate, t]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-fit min-w-[200px] justify-start text-left font-normal",
            !selectedRange && !(fromDate && toDate) && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2" align="start">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-muted-foreground px-2 py-1">{t("dateRangePicker.minutes")}</div>
          <Button variant="ghost" className="justify-start" onClick={() => applyRange({ type: 'minute', value: 5 })}>5{t("dateRangePicker.minuteShort")}</Button>
          <Button variant="ghost" className="justify-start" onClick={() => applyRange({ type: 'minute', value: 10 })}>10{t("dateRangePicker.minuteShort")}</Button>
          <Button variant="ghost" className="justify-start" onClick={() => applyRange({ type: 'minute', value: 30 })}>30{t("dateRangePicker.minuteShort")}</Button>
          <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mt-2">{t("dateRangePicker.hours")}</div>
          <Button variant="ghost" className="justify-start" onClick={() => applyRange({ type: 'hour', value: 1 })}>1{t("dateRangePicker.hourShort")}</Button>
          <Button variant="ghost" className="justify-start" onClick={() => applyRange({ type: 'hour', value: 3 })}>3{t("dateRangePicker.hourShort")}</Button>
          <Button variant="ghost" className="justify-start" onClick={() => applyRange({ type: 'hour', value: 6 })}>6{t("dateRangePicker.hourShort")}</Button>
          <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mt-2">{t("dateRangePicker.days")}</div>
          <Button variant="ghost" className="justify-start" onClick={() => applyRange({ type: 'day', value: 1 })}>1{t("dateRangePicker.dayShortLabel")}</Button>
          <Button variant="ghost" className="justify-start" onClick={() => applyRange({ type: 'day', value: 3 })}>3{t("dateRangePicker.dayShortLabel")}</Button>
          <Button variant="ghost" className="justify-start" onClick={() => applyRange({ type: 'day', value: 7 })}>7{t("dateRangePicker.dayShortLabel")}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}