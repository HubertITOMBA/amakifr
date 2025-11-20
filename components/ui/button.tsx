import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-white dark:bg-input/30 border-gray-300 dark:border-input text-gray-700 dark:text-gray-200 shadow-xs hover:bg-gray-50 dark:hover:bg-input/50 hover:text-gray-900 dark:hover:text-gray-100",
        secondary:
          "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700",
        ghost:
          "text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100",
        link: "text-blue-600 dark:text-blue-400 underline-offset-4 hover:underline hover:text-blue-800 dark:hover:text-blue-300",
      },
      size: {
        default: "h-10 sm:h-9 px-3 sm:px-4 py-2 sm:py-2 has-[>svg]:px-2.5 sm:has-[>svg]:px-3 min-h-[40px] sm:min-h-0 text-sm",
        sm: "h-9 sm:h-8 rounded-md gap-1.5 px-2.5 sm:px-3 has-[>svg]:px-2 sm:has-[>svg]:px-2.5 min-h-[36px] sm:min-h-0 text-xs sm:text-sm",
        lg: "h-11 sm:h-10 rounded-md px-4 sm:px-6 has-[>svg]:px-3 sm:has-[>svg]:px-4 min-h-[44px] sm:min-h-0 text-sm sm:text-base",
        icon: "size-10 sm:size-9 min-h-[40px] sm:min-h-0",
        "icon-sm": "size-9 sm:size-8 min-h-[36px] sm:min-h-0",
        "icon-lg": "size-11 sm:size-10 min-h-[44px] sm:min-h-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
