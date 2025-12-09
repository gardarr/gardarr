import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";

export const CONTAINER_CLASSES = "min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4";
export const MIN_PASSWORD_LENGTH = 8;
export const REDIRECT_DELAY = 2000;

interface PasswordInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  autoFocus?: boolean;
}

export function PasswordInput({ id, label, placeholder, value, onChange, disabled, autoFocus }: PasswordInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          type="password"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-10"
          required
          minLength={MIN_PASSWORD_LENGTH}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      </div>
    </div>
  );
}

interface CenteredCardProps {
  children: React.ReactNode;
  className?: string;
}

export function CenteredCard({ children, className = "" }: CenteredCardProps) {
  return (
    <div className={CONTAINER_CLASSES}>
      <Card className={`w-full max-w-md ${className}`}>
        {children}
      </Card>
    </div>
  );
}
