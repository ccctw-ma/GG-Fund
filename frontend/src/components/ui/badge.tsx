import { cn } from '../../lib/utils';

export function Badge({ className, tone = 'slate', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'slate' | 'red' | 'green' | 'blue' }) {
  const tones = {
    slate: 'bg-white/[0.08] text-[var(--text-muted)] ring-1 ring-white/10',
    red: 'bg-[#ef4444]/12 text-[#fecaca] ring-1 ring-[#ef4444]/18',
    green: 'bg-[var(--mint)]/12 text-[var(--mint)] ring-1 ring-[var(--mint)]/18',
    blue: 'bg-[var(--blue)]/12 text-[var(--blue)] ring-1 ring-[var(--blue)]/18',
  };
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold', tones[tone], className)} {...props} />;
}
