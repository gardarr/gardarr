import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";

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

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    // If no fromDate is selected, set it as fromDate
    if (!fromDate) {
      onFromDateChange(date);
      return;
    }

    // If fromDate is selected but no toDate, set it as toDate
    if (fromDate && !toDate) {
      // If selected date is before fromDate, swap them
      if (date < fromDate) {
        onToDateChange(fromDate);
        onFromDateChange(date);
      } else {
        onToDateChange(date);
      }
      setIsOpen(false);
      return;
    }

    // If both dates are selected, reset and start over
    onFromDateChange(date);
    onToDateChange(undefined);
  };

  const clearSelection = () => {
    onFromDateChange(undefined);
    onToDateChange(undefined);
  };

  const getDisplayText = () => {
    if (!fromDate && !toDate) {
      return "Select date range";
    }
    
    if (fromDate && !toDate) {
      return `${format(fromDate, "dd/MM/yyyy")} - Select end date`;
    }
    
    if (fromDate && toDate) {
      return `${format(fromDate, "dd/MM/yyyy")} - ${format(toDate, "dd/MM/yyyy")}`;
    }
    
    return "Select date range";
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-fit min-w-[200px] justify-start text-left font-normal",
            (!fromDate && !toDate) && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {getDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={fromDate}
          onSelect={handleDateSelect}
          initialFocus
          disabled={(date) => {
            const today = new Date();
            const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
            return date > today || date < fourteenDaysAgo;
          }}
          modifiers={{
            range_start: fromDate,
            range_end: toDate,
          }}
          modifiersClassNames={{
            range_start: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            range_end: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
          }}
        />
        {(fromDate || toDate) && (
          <div className="p-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={clearSelection}
              className="w-full"
            >
              Clear Selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}