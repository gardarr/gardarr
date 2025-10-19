"use client"

import * as React from "react"
import { ScrollArea, ScrollBar } from "./scroll-area"
import { cn } from "@/lib/utils"

interface CustomScrollAreaProps extends React.ComponentPropsWithoutRef<typeof ScrollArea> {
  variant?: "default" | "thin" | "thick"
  hideScrollbar?: boolean
  mobileFallback?: boolean // Nova prop para fallback mobile
}

const CustomScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollArea>,
  CustomScrollAreaProps
>(({ className, variant = "default", hideScrollbar = false, mobileFallback = true, children, ...props }, ref) => {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)
    
    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  // Fallback para mobile - usa scroll nativo
  if (isMobile && mobileFallback) {
    return (
      <div
        ref={ref}
        className={cn(
          "overflow-auto",
          // Aplicar estilos de scrollbar customizado apenas em desktop
          "md:scrollbar md:scrollbar-track-transparent md:scrollbar-thumb-border/60 md:hover:scrollbar-thumb-border",
          variant === "thin" && "md:scrollbar-thin md:scrollbar-track-transparent md:scrollbar-thumb-border/50 md:hover:scrollbar-thumb-border",
          variant === "thick" && "md:scrollbar-thick md:scrollbar-track-transparent md:scrollbar-thumb-border/70 md:hover:scrollbar-thumb-border",
          hideScrollbar && "md:scrollbar-none",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  // Desktop - usa ScrollArea do Radix
  return (
    <ScrollArea
      ref={ref}
      className={cn(
        // Base styles
        "relative overflow-hidden",
        // Custom scrollbar styles based on variant
        variant === "thin" && "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/50 hover:scrollbar-thumb-border",
        variant === "thick" && "scrollbar-thick scrollbar-track-transparent scrollbar-thumb-border/70 hover:scrollbar-thumb-border",
        variant === "default" && "scrollbar scrollbar-track-transparent scrollbar-thumb-border/60 hover:scrollbar-thumb-border",
        // Hide scrollbar option
        hideScrollbar && "scrollbar-none",
        className
      )}
      {...props}
    >
      {children}
      {!hideScrollbar && (
        <>
          <ScrollBar 
            orientation="vertical" 
            className={cn(
              "w-2.5 border-l border-l-transparent p-[1px]",
              // Custom scrollbar thumb styles
              variant === "thin" && "w-1.5",
              variant === "thick" && "w-3.5",
              // Theme-aware scrollbar colors
              "bg-transparent",
              "[&>[data-radix-scroll-area-thumb]]:bg-border/60",
              "[&>[data-radix-scroll-area-thumb]]:hover:bg-border/80",
              "[&>[data-radix-scroll-area-thumb]]:dark:bg-border/40",
              "[&>[data-radix-scroll-area-thumb]]:dark:hover:bg-border/60",
              "[&>[data-radix-scroll-area-thumb]]:rounded-full",
              "[&>[data-radix-scroll-area-thumb]]:transition-colors",
              "[&>[data-radix-scroll-area-thumb]]:duration-200"
            )}
          />
          <ScrollBar 
            orientation="horizontal" 
            className={cn(
              "h-2.5 border-t border-t-transparent p-[1px]",
              variant === "thin" && "h-1.5",
              variant === "thick" && "h-3.5",
              "bg-transparent",
              "[&>[data-radix-scroll-area-thumb]]:bg-border/60",
              "[&>[data-radix-scroll-area-thumb]]:hover:bg-border/80",
              "[&>[data-radix-scroll-area-thumb]]:dark:bg-border/40",
              "[&>[data-radix-scroll-area-thumb]]:dark:hover:bg-border/60",
              "[&>[data-radix-scroll-area-thumb]]:rounded-full",
              "[&>[data-radix-scroll-area-thumb]]:transition-colors",
              "[&>[data-radix-scroll-area-thumb]]:duration-200"
            )}
          />
        </>
      )}
    </ScrollArea>
  )
})

CustomScrollArea.displayName = "CustomScrollArea"

export { CustomScrollArea }
