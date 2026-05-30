import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-extrabold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/50 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[var(--gold)] text-[#101828] shadow-[0_16px_34px_rgba(244,183,64,0.24)] hover:-translate-y-0.5 hover:bg-[#ffd46a]',
        secondary: 'border border-[var(--mint)]/25 bg-[var(--mint)]/12 text-[var(--mint)] hover:-translate-y-0.5 hover:bg-[var(--mint)]/18',
        outline: 'border border-white/15 bg-white/[0.06] text-[var(--text-strong)] hover:-translate-y-0.5 hover:bg-white/[0.1]',
        ghost: 'text-[var(--text-muted)] hover:bg-white/[0.08] hover:text-[var(--text-strong)]',
        destructive: 'bg-[#ef4444] text-white hover:-translate-y-0.5 hover:bg-[#dc2626]',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-10 px-3',
        lg: 'h-12 px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';
