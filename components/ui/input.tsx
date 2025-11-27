import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-gray-400 dark:placeholder:text-gray-500 selection:bg-primary selection:text-primary-foreground",
        "dark:bg-input/30 border-gray-300 dark:border-gray-600",
        "h-11 sm:h-9 w-full min-w-0 rounded-md border bg-white dark:bg-gray-800 px-4 sm:px-3 py-2.5 sm:py-1",
        "text-base text-gray-900 dark:text-gray-100 shadow-xs transition-[color,box-shadow] outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "md:text-sm min-h-[44px] sm:min-h-0",
        "focus-visible:border-blue-500 dark:focus-visible:border-blue-400 focus-visible:ring-blue-500/50 dark:focus-visible:ring-blue-400/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
