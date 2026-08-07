import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff, AlertTriangle, CheckCircle2, Plug } from 'lucide-react';
import type { BiotimeSyncState } from '@/utils/attendance/types';
import type { BiotimeStatus } from '@/utils/attendance/biotimeSync';

interface SyncStatusBarProps {
  status: BiotimeStatus | null;
  syncState: BiotimeSyncState;
  syncing: boolean;
  onSync: () => void;
  onConnect: () => void;
}

function relativeTime(iso?: string): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';

  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? '' : 's'} ago`;
}

/**
 * Shows whether BioTime Cloud is reachable and when punches were last pulled.
 *
 * "Not configured" is presented as a neutral setup step rather than a failure — the rest
 * of the module works without it, and the shop may simply not have registered its
 * device with BioTime Cloud yet.
 */
const SyncStatusBar: React.FC<SyncStatusBarProps> = ({
  status,
  syncState,
  syncing,
  onSync,
  onConnect,
}) => {
  const notConfigured = status ? !status.configured : false;
  const hasError = !!(status?.error || syncState.lastRunStatus === 'error');

  let tone = 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40';
  let Icon = CheckCircle2;
  let iconTone = 'text-green-600 dark:text-green-400';
  let headline = 'BioTime Cloud connected';
  let detail = `Last synced ${relativeTime(syncState.lastSyncedAt)}`;

  if (notConfigured) {
    tone = 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40';
    Icon = WifiOff;
    iconTone = 'text-amber-600 dark:text-amber-400';
    headline = 'BioTime Cloud not connected';
    detail =
      'Click "Connect BioTime" to paste your portal address and access token. ' +
      'Until then you can add attendance manually below.';
  } else if (hasError) {
    tone = 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40';
    Icon = AlertTriangle;
    iconTone = 'text-red-600 dark:text-red-400';
    headline = 'BioTime sync problem';
    detail = status?.error || syncState.lastError || 'Unknown error';
  } else if (!status) {
    tone = 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40';
    Icon = Wifi;
    iconTone = 'text-gray-500';
    headline = 'Checking BioTime Cloud…';
    detail = '';
  }

  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone}`} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{headline}</p>
          {detail && (
            <p className="mt-0.5 break-words text-xs text-gray-600 dark:text-gray-400">{detail}</p>
          )}
          {!notConfigured && !hasError && syncState.punchesImported !== undefined && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-500">
              {syncState.punchesImported} punch{syncState.punchesImported === 1 ? '' : 'es'} in the last run
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button
          onClick={onConnect}
          size="sm"
          variant={notConfigured || hasError ? 'default' : 'outline'}
          className={notConfigured || hasError ? '' : 'bg-white dark:bg-gray-900'}
        >
          <Plug className="mr-2 h-4 w-4" />
          {notConfigured ? 'Connect BioTime' : 'Connection'}
        </Button>
        <Button
          onClick={onSync}
          disabled={syncing || notConfigured}
          size="sm"
          variant="outline"
          className="bg-white dark:bg-gray-900"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
      </div>
    </div>
  );
};

export default SyncStatusBar;
