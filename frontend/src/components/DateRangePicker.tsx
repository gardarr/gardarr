import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Clock, ArrowUpFromLine, ArrowDownToLine } from "lucide-react";
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
  const [fromTime, setFromTime] = useState("00:00");
  const [toTime, setToTime] = useState("23:59");

  const handleFromDateChange = (date: Date | undefined) => {
    if (date) {
      const [hours, minutes] = fromTime.split(':');
      const newDate = new Date(date);
      newDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      onFromDateChange(newDate);
    }
  };

  const handleToDateChange = (date: Date | undefined) => {
    if (date) {
      const [hours, minutes] = toTime.split(':');
      const newDate = new Date(date);
      newDate.setHours(parseInt(hours), parseInt(minutes), 59, 999);
      onToDateChange(newDate);
    }
  };

  const handleFromTimeChange = (time: string) => {
    setFromTime(time);
    if (fromDate) {
      const [hours, minutes] = time.split(':');
      const newDate = new Date(fromDate);
      newDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      onFromDateChange(newDate);
    }
  };

  const handleToTimeChange = (time: string) => {
    setToTime(time);
    if (toDate) {
      const [hours, minutes] = time.split(':');
      const newDate = new Date(toDate);
      newDate.setHours(parseInt(hours), parseInt(minutes), 59, 999);
      onToDateChange(newDate);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <ArrowUpFromLine className="h-4 w-4 text-muted-foreground" />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[200px] justify-start text-left font-normal",
                !fromDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {fromDate ? (
                <span>
                  {format(fromDate, "dd/MM/yyyy")} 
                  <span className="text-foreground/60 ml-1">{fromTime}</span>
                </span>
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={fromDate}
              onSelect={handleFromDateChange}
              initialFocus
              disabled={(date) => {
                const today = new Date();
                const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
                return date > today || date < fourteenDaysAgo;
              }}
            />
            <div className="p-3 border-t">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <input
                  type="time"
                  value={fromTime}
                  onChange={(e) => handleFromTimeChange(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[200px] justify-start text-left font-normal",
                !toDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {toDate ? (
                <span>
                  {format(toDate, "dd/MM/yyyy")} 
                  <span className="text-foreground/60 ml-1">{toTime}</span>
                </span>
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={toDate}
              onSelect={handleToDateChange}
              initialFocus
              disabled={(date) => {
                const today = new Date();
                const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
                return date > today || date < fourteenDaysAgo;
              }}
            />
            <div className="p-3 border-t">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <input
                  type="time"
                  value={toTime}
                  onChange={(e) => handleToTimeChange(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}