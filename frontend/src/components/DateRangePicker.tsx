import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

interface DateRangePickerProps {
  fromDate: Date | undefined;
  toDate: Date | undefined;
  onFromDateChange: (date: Date | undefined) => void;
  onToDateChange: (date: Date | undefined) => void;
}

export default function DateRangePicker({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<1 | 3 | 7>(1);

  const applyRange = (days: 1 | 3 | 7) => {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    onFromDateChange(start);
    onToDateChange(now);
    setSelectedDays(days);
    setIsOpen(false);
  };

  // Ensure default selection is 1d if no dates provided
  useEffect(() => {
    if (!fromDate || !toDate) {
      const now = new Date();
      const start = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      onFromDateChange(start);
      onToDateChange(now);
      setSelectedDays(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayText = useMemo(() => {
    if (selectedDays) return `Hoje -${selectedDays} dias`;
    if (fromDate && toDate) {
      // try infer known options
      const diffMs = toDate.getTime() - fromDate.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const approx = Math.round(diffMs / dayMs) as 1 | 3 | 7;
      if (approx === 1 || approx === 3 || approx === 7) {
        return `Hoje -${approx} dias`;
      }
    }
    return "Selecionar intervalo";
  }, [selectedDays, fromDate, toDate]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-fit min-w-[200px] justify-start text-left font-normal",
            !selectedDays && !(fromDate && toDate) && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2" align="start">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" className="justify-start" onClick={() => applyRange(1)}>1d</Button>
          <Button variant="ghost" className="justify-start" onClick={() => applyRange(3)}>3d</Button>
          <Button variant="ghost" className="justify-start" onClick={() => applyRange(7)}>7d</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}