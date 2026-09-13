import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-soft hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-border bg-transparent hover:bg-secondary hover:text-secondary-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-secondary hover:text-secondary-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonProps = React.ComponentPropsWithoutRef<'button'> & VariantProps<typeof buttonVariants> & {
  asChild?: boolean
  whileHover?: HTMLMotionProps<'button'>['whileHover']
  whileTap?: HTMLMotionProps<'button'>['whileTap']
  transition?: HTMLMotionProps<'button'>['transition']
}

const MotionButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, whileHover, whileTap, transition, ...props }, ref) => {
    const Comp = asChild ? Slot : motion.button
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...(asChild ? {} : { whileHover, whileTap, transition })}
        {...props as any}
      />
    )
  },
)
MotionButton.displayName = 'Button'

export { MotionButton as Button, buttonVariants }
