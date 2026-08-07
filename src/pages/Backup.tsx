import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ShieldCheck,
  Download,
  Upload,
  Loader2,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  History,
  Database,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import {
  exportBackup,
  inspectBackup,
  restoreBackup,
  BackupRange,
  BackupProgress,
  RestorePreview,
} from '@/utils/backup/backupEngine';
import {
  BackupState,
  decideReminder,
  fetchBackupState,
  monthKey,
  monthLabel,
  monthRange,
  recordBackup,
} from '@/utils/backup/backupReminder';
import { BACKUP_COLLECTIONS } from '@/utils/backup/backupSchema';

type RangeMode = 'all' | 'month' | 'monthRange' | 'day' | 'dayRange';

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};
const endOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

/** The last 24 months, newest first — the realistic window for a shop's backups. */
function recentMonths(count = 24): string[] {
  const out: string[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = 0; i < count; i++) {
    out.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return out;
}

/**
 * Backup & Restore.
 *
 * Everything the business depends on lives in one Firebase project, which is a single point
 * of failure. This page turns that into an ordinary file the owner keeps: a workbook that
 * can be re-imported into a brand-new Firebase project and bring the shop back.
 */
const Backup: React.FC = () => {
  const { userData } = useAuth();
  const months = recentMonths();

  const [state, setState] = useState<BackupState>({});
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<RangeMode>('all');
  const [month, setMonth] = useState(months[1] || months[0]);
  const [monthFrom, setMonthFrom] = useState(months[1] || months[0]);
  const [monthTo, setMonthTo] = useState(months[0]);
  const [day, setDay] = useState<Date | undefined>(new Date());
  const [dayFrom, setDayFrom] = useState<Date | undefined>();
  const [dayTo, setDayTo] = useState<Date | undefined>();

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMerge, setRestoreMerge] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setState(await fetchBackupState());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!userData) return <LoadingSpinner type="page" />;
  if (userData.role !== 'admin') {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="py-8 text-center">
            <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-gray-400" />
            <h3 className="mb-1 text-lg font-semibold">Admins only</h3>
            <p className="text-sm text-gray-600">Backups contain the whole business record.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const buildRange = (): BackupRange => {
    if (mode === 'all') return { start: null, end: null, label: 'All time' };
    if (mode === 'month') {
      const { start, end } = monthRange(month);
      return { start, end, label: monthLabel(month) };
    }
    if (mode === 'monthRange') {
      const from = monthRange(monthFrom);
      const to = monthRange(monthTo);
      const start = from.start <= to.start ? from.start : to.start;
      const end = from.end >= to.end ? from.end : to.end;
      return { start, end, label: `${monthLabel(monthFrom)} to ${monthLabel(monthTo)}` };
    }
    if (mode === 'day' && day) {
      return {
        start: startOfDay(day),
        end: endOfDay(day),
        label: day.toLocaleDateString('en-IN'),
      };
    }
    if (mode === 'dayRange' && dayFrom && dayTo) {
      return {
        start: startOfDay(dayFrom),
        end: endOfDay(dayTo),
        label: `${dayFrom.toLocaleDateString('en-IN')} to ${dayTo.toLocaleDateString('en-IN')}`,
      };
    }
    return { start: null, end: null, label: 'All time' };
  };

  const rangeValid =
    mode === 'all' ||
    mode === 'month' ||
    mode === 'monthRange' ||
    (mode === 'day' && !!day) ||
    (mode === 'dayRange' && !!dayFrom && !!dayTo);

  const handleExport = async () => {
    const range = buildRange();
    setExporting(true);
    setProgress(null);
    try {
      const result = await exportBackup(range, setProgress);
      await recordBackup({
        periodKey: mode === 'month' ? month : mode === 'all' ? 'full' : 'custom',
        label: range.label,
        rows: result.totalRows,
        filename: result.filename,
        exportedBy: userData.email || userData.name || 'admin',
        isFull: mode === 'all',
      });
      toast({
        title: 'Backup downloaded',
        description: `${result.totalRows.toLocaleString()} records saved to ${result.filename}`,
      });
      await load();
    } catch (error) {
      console.error('Backup failed:', error);
      toast({
        title: 'Backup failed',
        description: error instanceof Error ? error.message : 'Could not create the backup file.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
      setProgress(null);
    }
  };

  const handleFilePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setRestoreFile(file);
    setPreview(null);
    try {
      setPreview(await inspectBackup(file));
      setRestoreOpen(true);
    } catch (error) {
      console.error('Could not read backup:', error);
      toast({
        title: 'Not a valid backup file',
        description: 'Pick a workbook that was exported from this page.',
        variant: 'destructive',
      });
      setRestoreFile(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const result = await restoreBackup(restoreFile, { merge: restoreMerge });
      if (result.errors.length > 0) {
        toast({
          title: 'Restored with problems',
          description: `${result.written} records written. Issues: ${result.errors.join('; ')}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Restore complete',
          description: `${result.written.toLocaleString()} records written back to the database.`,
        });
      }
      setRestoreOpen(false);
      setRestoreFile(null);
      setPreview(null);
      setConfirmText('');
    } catch (error) {
      console.error('Restore failed:', error);
      toast({
        title: 'Restore failed',
        description: error instanceof Error ? error.message : 'Could not restore the file.',
        variant: 'destructive',
      });
    } finally {
      setRestoring(false);
    }
  };

  const reminder = decideReminder(state);
  const history = state.history || [];

  return (
    <div className="mobile-page-layout">
      <div className="mobile-page-wrapper container-responsive space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl lg:text-3xl">
              Backup &amp; Restore
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Download your entire business record as an Excel file — and put it back if you ever need to
            </p>
          </div>
        </div>

        {/* Status */}
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 py-10 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading backup history…
            </CardContent>
          </Card>
        ) : (
          <Card
            className={
              reminder.kind === 'none'
                ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
                : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
            }
          >
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {reminder.kind === 'none' ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {reminder.kind === 'first-full'
                      ? 'No backup has ever been taken'
                      : reminder.kind === 'monthly'
                        ? `${reminder.months.length} month${reminder.months.length === 1 ? '' : 's'} still need a backup`
                        : 'Your backups are up to date'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {reminder.kind === 'first-full'
                      ? 'Take a full "All time" export now — after that you only need one small file a month.'
                      : reminder.kind === 'monthly'
                        ? reminder.months.map(monthLabel).join(', ')
                        : state.lastExportAt
                          ? `Last export: ${state.lastExportLabel} on ${new Date(state.lastExportAt).toLocaleString('en-IN')}`
                          : ''}
                  </p>
                </div>
              </div>
              {reminder.kind === 'monthly' && reminder.months[0] && (
                <Button
                  className="shrink-0 bg-amber-600 hover:bg-amber-700"
                  onClick={() => {
                    setMode('month');
                    setMonth(reminder.months[0]);
                  }}
                >
                  Select {monthLabel(reminder.months[0])}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Download className="h-5 w-5 text-blue-600" />
              Export a backup
            </CardTitle>
            <CardDescription>
              Choose what period to include. Reference data (categories, product names,
              employees, settings) is always exported in full so any file can stand alone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm">Period</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as RangeMode)}>
                <SelectTrigger className="w-full sm:max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everything (full backup)</SelectItem>
                  <SelectItem value="month">A single month</SelectItem>
                  <SelectItem value="monthRange">From month → to month</SelectItem>
                  <SelectItem value="day">A single day</SelectItem>
                  <SelectItem value="dayRange">From day → to day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === 'month' && (
              <div className="max-w-xs">
                <Label className="mb-1.5 block text-sm">Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((key) => (
                      <SelectItem key={key} value={key}>
                        {monthLabel(key)}
                        {(state.exportedMonths || []).includes(key) ? ' ✓' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {mode === 'monthRange' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-lg">
                <div>
                  <Label className="mb-1.5 block text-sm">From month</Label>
                  <Select value={monthFrom} onValueChange={setMonthFrom}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((key) => (
                        <SelectItem key={key} value={key}>{monthLabel(key)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">To month</Label>
                  <Select value={monthTo} onValueChange={setMonthTo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((key) => (
                        <SelectItem key={key} value={key}>{monthLabel(key)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {mode === 'day' && (
              <div className="max-w-xs">
                <Label className="mb-1.5 block text-sm">Day</Label>
                <DatePicker date={day} onDateChange={setDay} placeholder="Pick a date" className="w-full" />
              </div>
            )}

            {mode === 'dayRange' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-lg">
                <div>
                  <Label className="mb-1.5 block text-sm">From day</Label>
                  <DatePicker date={dayFrom} onDateChange={setDayFrom} placeholder="Start date" className="w-full" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">To day</Label>
                  <DatePicker date={dayTo} onDateChange={setDayTo} placeholder="End date" className="w-full" />
                </div>
              </div>
            )}

            <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800/60">
              <div className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-200">
                <CalendarDays className="h-4 w-4 shrink-0" />
                Will export: {buildRange().label}
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {BACKUP_COLLECTIONS.length} collections · bills, orders, customers, inventory,
                income, expenses, employees, attendance, payroll, settings and all catalog data.
              </p>
            </div>

            {exporting && progress && (
              <div className="space-y-2">
                <Progress value={(progress.index / progress.total) * 100} />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {progress.index}/{progress.total} · {progress.collection} ({progress.rows} rows)
                </p>
              </div>
            )}

            <Button
              onClick={handleExport}
              disabled={exporting || !rangeValid}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 sm:w-auto"
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Download Excel backup
            </Button>
          </CardContent>
        </Card>

        {/* Restore */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Upload className="h-5 w-5 text-green-600" />
              Restore from a backup file
            </CardTitle>
            <CardDescription>
              Writes every row back to the database under its original id. Safe to run on a
              brand-new, empty Firebase project — that is exactly the disaster-recovery path.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-medium">Read before restoring into a live database</p>
              <p className="mt-1 text-xs">
                Restoring overwrites documents that share an id with the file. If you only
                meant to look at the data, open the Excel file instead — restoring is for
                recovery.
              </p>
            </div>
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full sm:w-auto">
              <Upload className="mr-2 h-4 w-4" />
              Choose backup file…
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFilePick}
            />
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <History className="h-5 w-5 text-purple-600" />
              Backup history
            </CardTitle>
            <CardDescription>Every export taken from this page</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="py-8 text-center">
                <Database className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                <p className="font-medium text-gray-700 dark:text-gray-300">No backups yet</p>
                <p className="text-sm text-gray-500">Take a full export above to get started.</p>
              </div>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {history.map((entry, index) => (
                  <div
                    key={`${entry.exportedAt}-${index}`}
                    className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {entry.label}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {entry.rows.toLocaleString()} rows
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {entry.filename}
                      </p>
                    </div>
                    <div className="shrink-0 text-xs text-gray-500 dark:text-gray-400 sm:text-right">
                      {new Date(entry.exportedAt).toLocaleString('en-IN')}
                      <div>by {entry.exportedBy}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Restore confirmation */}
        <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
          <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Restore this backup?
              </DialogTitle>
              <DialogDescription>{restoreFile?.name}</DialogDescription>
            </DialogHeader>

            {preview && (
              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800/60">
                  <p>
                    <b>{preview.totalRows.toLocaleString()}</b> records across{' '}
                    <b>{preview.sheets.length}</b> collections
                  </p>
                  {preview.generatedAt && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Taken {preview.generatedAt} · period {preview.period}
                    </p>
                  )}
                  {preview.unknownSheets.length > 0 && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Ignoring unknown sheets: {preview.unknownSheets.join(', ')}
                    </p>
                  )}
                </div>

                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2 text-sm dark:border-gray-700">
                  {preview.sheets.map((sheet) => (
                    <div key={sheet.sheet} className="flex justify-between gap-2">
                      <span className="truncate">{sheet.label}</span>
                      <span className="shrink-0 text-gray-500">{sheet.rows}</span>
                    </div>
                  ))}
                </div>

                <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm dark:border-gray-700">
                  <Checkbox
                    checked={restoreMerge}
                    onCheckedChange={(checked) => setRestoreMerge(checked === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Merge with existing data</span>
                    <span className="mt-0.5 block text-xs text-gray-600 dark:text-gray-400">
                      Keeps fields that exist in the database but not in the file. Leave this on
                      unless you are restoring into an empty project and want an exact copy.
                    </span>
                  </span>
                </label>

                <div>
                  <Label className="mb-1.5 block text-sm">
                    Type <b>RESTORE</b> to confirm
                  </Label>
                  <Input
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    placeholder="RESTORE"
                    className="font-mono"
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setRestoreOpen(false)} disabled={restoring}>
                Cancel
              </Button>
              <Button
                onClick={handleRestore}
                disabled={restoring || confirmText !== 'RESTORE'}
                className="bg-green-600 hover:bg-green-700"
              >
                {restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Restore data
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Backup;
