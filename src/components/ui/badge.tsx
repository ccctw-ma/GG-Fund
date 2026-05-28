import { cn } from '../../lib/utils';

export function Badge({ className, tone = 'slate', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'slate' | 'red' | 'green' | 'blue' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    red: 'bg-red-50 text-red-700',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone], className)} {...props} />;
}
