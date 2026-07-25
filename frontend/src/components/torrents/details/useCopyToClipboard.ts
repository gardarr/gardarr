import { useEffect, useRef, useState } from "react";

export function useCopyToClipboard(resetDelayMs: number = 2000) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopiedField(null), resetDelayMs);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return { copiedField, copyToClipboard };
}
