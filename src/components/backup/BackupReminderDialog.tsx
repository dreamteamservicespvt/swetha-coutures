import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Download, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  decideReminder,
  fetchBackupState,
  monthLabel,
  monthRange,
  recordBackup,
  snoozeReminder,
  ReminderDecision,
} from '@/utils/backup/backupReminder';
import { exportBackup } from '@/utils/backup/backupEngine';

/**
 * Nags the admin until a backup exists.
 *
 * Deliberately not dismissible with a plain "close": the whole point is that data loss is
 * silent until it matters, so the reminder keeps coming back on every page load until either
 * the backup is taken or the admin explicitly snoozes it for a few days. It only appears for
 * admins, and never on the Backup page itself (they are already dealing with it).
 */
const BackupReminderDialog: React.FC = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [decision, setDecision] = useState<ReminderDecision | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (userData?.role !== 'admin') return;
    if (location.pathname === '/backup') return;

    let cancelled = false;
    const check = async () => {
      const state = await fetchBackupState();
      if (cancelled) return;
      const result = decideReminder(state);
      if (result.kind !== 'none') {
        setDecision(result);
        setOpen(true);
      }
    };
    // Small delay so it does not fight the page's own first render.
    const timer = window.setTimeout(check, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [userData?.role, location.pathname]);

  if (!decision || userData?.role !== 'admin') return null;

  const isFirst = decision.kind === 'first-full';
  const targetMonth = decision.months[0];

  const runExport = async () => {
    setBusy(true);
    try {
      const range = isFirst
        ? { start: null, end: null, label: 'All time' }
        : { ...monthRange(targetMonth), label: monthLabel(targetMonth) };

      const result = await exportBackup(range);
      await recordBackup({
        periodKey: isFirst ? 'full' : targetMonth,
        label: range.label,
        rows: result.totalRows,
        filename: result.filename,
        exportedBy: userData?.email || userData?.name || 'admin',
        isFull: isFirst,
      });

      toast({
        title: 'Backup saved',
        description: `${result.totalRows.toLocaleString()} records downloaded. Keep this file somewhere safe.`,
      });
      setOpen(false);
    } catch (error) {
      console.error('Reminder backup failed:', error);
      toast({
        title: 'Backup failed',
        description: error instanceof Error ? error.message : 'Could not create the file.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSnooze = async () => {
    setBusy(true);
    try {
      await snoozeReminder(3);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
      <DialogContent
        className="max-w-[95vw] sm:max-w-md"
        // No stray click or Escape should dismiss a data-safety prompt by accident.
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            {isFirst ? 'Protect your data — first backup' : 'Monthly backup due'}
          </DialogTitle>
          <DialogDescription className="pt-1">
            {isFirst ? (
              <>
                You have never taken a backup. Everything — bills, orders, customers,
                inventory, payroll — lives in one place right now. Download a{' '}
                <b>full backup</b> once, and from next month we will only ask for one small
                monthly file.
              </>
            ) : (
              <>
                <b>{decision.months.map(monthLabel).join(', ')}</b>{' '}
                {decision.months.length === 1 ? 'has' : 'have'} no backup yet. It takes a few
                seconds and downloads a single Excel file you can keep anywhere.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800/60">
          <p className="font-medium text-gray-800 dark:text-gray-200">
            {isFirst ? 'Full backup — everything, all time' : `Backup for ${monthLabel(targetMonth)}`}
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            The file can be imported back into this app — even into a brand-new Firebase
            project — to rebuild the business if anything is ever lost.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={handleSnooze} disabled={busy} className="sm:mr-auto">
            <Clock className="mr-2 h-4 w-4" />
            Remind me in 3 days
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                navigate('/backup');
              }}
            >
              Open Backup page
            </Button>
            <Button onClick={runExport} disabled={busy} className="bg-gradient-to-r from-blue-600 to-purple-600">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isFirst ? 'Download full backup' : 'Download now'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BackupReminderDialog;
