import React from 'react';
import { Infinity as InfinityIcon, CalendarRange, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type QuickRange = 'career' | 'month' | 'today';

interface QuickRangeToggleProps {
  value: QuickRange;
  onChange: (value: QuickRange) => void;
  /** When a custom date range is active, the quick toggle is overridden — show it muted. */
  muted?: boolean;
  className?: string;
}

const OPTIONS: { value: QuickRange; label: string; icon: React.ElementType }[] = [
  { value: 'career', label: 'Career', icon: InfinityIcon },
  { value: 'month', label: 'This Month', icon: CalendarRange },
  { value: 'today', label: 'Today', icon: CalendarClock },
];

/**
 * Reusable segmented control for a quick date filter.
 * "Career" = all-time, "This Month" = current calendar month, "Today" = current day.
 */
const QuickRangeToggle: React.FC<QuickRangeToggleProps> = ({
  value,
  onChange,
  muted = false,
  className,
}) => {
  return (
    <div
      role="tablist"
      aria-label="Quick date range"
      className={cn(
        'inline-flex w-full sm:w-auto items-center gap-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/60 p-1 shadow-sm',
        muted && 'opacity-60',
        className
      )}
    >
      {OPTIONS.map(({ value: optValue, label, icon: Icon }) => {
        const active = value === optValue && !muted;
        return (
          <button
            key={optValue}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(optValue)}
            className={cn(
              'flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap',
              active
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
            )}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default QuickRangeToggle;
