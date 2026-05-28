import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-extrabold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/25 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[#071b18] text-[#fbf1df] shadow-[0_16px_34px_rgba(7,27,24,0.18)] hover:-translate-y-0.5 hover:bg-[#0d3029]',
        secondary: 'bg-[#e5f7e9] text-[#0d3029] hover:-translate-y-0.5 hover:bg-[#d6f2dd]',
        outline: 'border border-[#10251f]/15 bg-[#fffaf0] text-[#10251f] hover:-translate-y-0.5 hover:bg-white',
        ghost: 'text-[#10251f]/72 hover:bg-[#10251f]/8 hover:text-[#10251f]',
        destructive: 'bg-[#b42318] text-white hover:-translate-y-0.5 hover:bg-[#9f1f16]',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 px-3',
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
