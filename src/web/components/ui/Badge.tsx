import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        dev: "border-transparent bg-blue-500/20 text-blue-500 hover:bg-blue-500/30",
        qa: "border-transparent bg-orange-500/20 text-orange-500 hover:bg-orange-500/30",
        preprod: "border-transparent bg-purple-500/20 text-purple-500 hover:bg-purple-500/30",
        prod: "border-transparent bg-red-500/20 text-red-500 hover:bg-red-500/30",
        success: "border-transparent bg-emerald-500/20 text-emerald-500",
        amber: "border-transparent bg-amber-500/20 text-amber-500",
        pending: "border-transparent bg-yellow-500/20 text-yellow-500",
        running: "border-transparent bg-blue-500/20 text-blue-500 animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
