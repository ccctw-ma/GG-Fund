import * as React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn('h-12 w-full rounded-full border border-[#10251f]/12 bg-[#fffaf0]/90 px-5 text-sm font-semibold text-[#10251f] outline-none transition placeholder:text-[#10251f]/36 focus:border-[#047857] focus:ring-4 focus:ring-[#047857]/10', className)}
    {...props}
  />
));
Input.displayName = 'Input';
