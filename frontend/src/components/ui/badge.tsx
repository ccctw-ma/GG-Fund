import { cn } from '../../lib/utils';

export function Badge({ className, tone = 'slate', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'slate' | 'red' | 'green' | 'blue' }) {
  const tones = {
    slate: 'bg-[#10251f]/8 text-[#10251f]/70 ring-1 ring-[#10251f]/8',
    red: 'bg-[#b42318]/10 text-[#9f1f16] ring-1 ring-[#b42318]/10',
    green: 'bg-[#047857]/10 text-[#047857] ring-1 ring-[#047857]/10',
    blue: 'bg-[#0d3029]/10 text-[#0d3029] ring-1 ring-[#0d3029]/10',
  };
  return <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold', tones[tone], className)} {...props} />;
}
