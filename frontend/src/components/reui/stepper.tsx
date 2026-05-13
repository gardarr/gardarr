import { Children, createContext, useContext } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type StepperContextValue = {
  value: number;
  onValueChange?: (value: number) => void;
};

type StepperItemContextValue = {
  step: number;
  completed: boolean;
  disabled: boolean;
  loading: boolean;
  active: boolean;
};

const StepperContext = createContext<StepperContextValue | null>(null);
const StepperItemContext = createContext<StepperItemContextValue | null>(null);

function useStepperContext() {
  const context = useContext(StepperContext);
  if (!context) {
    throw new Error("Stepper components must be used within Stepper");
  }
  return context;
}

function useStepperItemContext() {
  const context = useContext(StepperItemContext);
  if (!context) {
    throw new Error("Stepper item components must be used within StepperItem");
  }
  return context;
}

function Stepper({
  value,
  onValueChange,
  className,
  children,
  orientation = "horizontal",
}: React.ComponentProps<"div"> & {
  value: number;
  onValueChange?: (value: number) => void;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <StepperContext.Provider value={{ value, onValueChange }}>
      <div
        data-slot="stepper"
        data-orientation={orientation}
        className={cn("w-full", className)}
      >
        {children}
      </div>
    </StepperContext.Provider>
  );
}

function StepperNav({ className, ...props }: React.ComponentProps<"div">) {
  const { value } = useStepperContext();
  const count = Children.count(props.children);
  const progress = count > 1 ? ((Math.max(value, 1) - 1) / (count - 1)) * 100 : 0;

  return (
    <div
      data-slot="stepper-nav"
      className={cn("relative flex w-full items-center justify-between", className)}
      {...props}
    >
      {count > 1 && (
        <>
          <div className="pointer-events-none absolute left-[14px] right-[14px] top-1/2 h-px -translate-y-1/2 bg-border" />
          <div
            className="pointer-events-none absolute left-[14px] top-1/2 h-px -translate-y-1/2 bg-primary transition-all"
            style={{ width: `calc((100% - 28px) * ${progress / 100})` }}
          />
        </>
      )}
      {props.children}
    </div>
  );
}

function StepperItem({
  step,
  completed = false,
  disabled = false,
  loading = false,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  step: number;
  completed?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { value } = useStepperContext();
  const active = value === step;

  return (
    <StepperItemContext.Provider value={{ step, completed, disabled, loading, active }}>
      <div
        data-slot="stepper-item"
        data-state={active ? "active" : completed ? "completed" : "inactive"}
        className={cn(
          "relative z-10 flex items-center text-sm transition-colors",
          disabled && "opacity-60",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </StepperItemContext.Provider>
  );
}

function StepperTrigger({
  className,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
}) {
  const { onValueChange } = useStepperContext();
  const { step, disabled } = useStepperItemContext();
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="stepper-trigger"
      type={asChild ? undefined : "button"}
      onClick={() => {
        if (!disabled) {
          onValueChange?.(step);
        }
      }}
      className={cn("flex shrink-0 items-center justify-center gap-2 text-left", className)}
      disabled={!asChild ? disabled : undefined}
      {...props}
    >
      {children}
    </Comp>
  );
}

function StepperIndicator({ className, children, ...props }: React.ComponentProps<"div">) {
  const { active, completed } = useStepperItemContext();

  return (
    <div
      data-slot="stepper-indicator"
      className={cn(
        "relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
        active
          ? "bg-white text-black"
          : completed
            ? "bg-primary text-primary-foreground"
            : "bg-zinc-800 text-zinc-400",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function StepperTitle({ className, ...props }: React.ComponentProps<"span">) {
  const { active } = useStepperItemContext();
  return (
    <span
      data-slot="stepper-title"
      className={cn(active ? "font-medium text-foreground" : "text-muted-foreground", className)}
      {...props}
    />
  );
}

function StepperDescription({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="stepper-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

function StepperSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="stepper-separator" className={cn("hidden", className)} {...props} />;
}

function StepperPanel({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="stepper-panel" className={className} {...props} />;
}

function StepperContent({
  value,
  forceMount = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  value: number;
  forceMount?: boolean;
}) {
  const { value: currentValue } = useStepperContext();

  if (!forceMount && currentValue !== value) {
    return null;
  }

  return (
    <div data-slot="stepper-content" hidden={currentValue !== value} {...props}>
      {children}
    </div>
  );
}

export {
  Stepper,
  StepperContent,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
};
