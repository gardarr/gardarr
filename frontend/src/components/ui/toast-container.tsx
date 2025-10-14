import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "./alert";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { Button } from "./button";

export type ToastType = "success" | "error";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-md pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300); // Wait for animation to complete
    }, 3000);

    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      className={`pointer-events-auto transition-all duration-300 ${
        isExiting
          ? "opacity-0 translate-x-full"
          : "opacity-100 translate-x-0"
      }`}
    >
      <Alert
        variant={toast.type === "error" ? "destructive" : "success"}
        className="shadow-lg"
      >
        {toast.type === "success" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        <AlertDescription className="flex items-center justify-between gap-2">
          <span>{toast.message}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-70 hover:opacity-100"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

