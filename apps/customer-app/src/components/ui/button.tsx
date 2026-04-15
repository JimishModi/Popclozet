import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-2xl font-bold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2546d]/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[#f2546d] to-pink-500 text-white shadow-lg shadow-[#f2546d]/25",
        destructive:
          "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20",
        outline:
          "border border-[#f2546d]/30 bg-[#f2546d]/5 text-[#f2546d] hover:bg-[#f2546d]/10",
        secondary:
          "bg-zinc-900 border border-white/5 text-white hover:bg-zinc-800",
        ghost:
          "bg-white/5 border border-white/5 text-white hover:bg-white/10",
        link: "text-[#f2546d] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-14 px-6 text-base",
        sm: "h-10 px-4 text-sm rounded-xl",
        lg: "h-16 px-8 text-lg",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
