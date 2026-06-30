import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, GitMerge, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  CatalogKind,
  countUsage,
  createCatalogEntry,
  deleteCatalogEntry,
  renameCatalogEntry,
} from '@/utils/catalogManagement';

export type CatalogMode = 'create' | 'rename' | 'merge' | 'delete';

interface CatalogManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: CatalogKind;
  mode: CatalogMode;
  /** The service/product the action applies to (rename/merge/delete). */
  sourceName?: string;
  /** All existing names of this kind — used for the merge target list. */
  existingNames: string[];
  /** Called after a successful change so the parent can refresh. */
  onDone: () => void;
}

const kindLabel = (k: CatalogKind) => (k === 'service' ? 'Service' : 'Product');

const CatalogManageDialog: React.FC<CatalogManageDialogProps> = ({
  open,
  onOpenChange,
  kind,
  mode,
  sourceName = '',
  existingNames,
  onDone,
}) => {
  const [newName, setNewName] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [usage, setUsage] = useState<{ bills: number; orders: number } | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Reset + load usage whenever the dialog opens
  useEffect(() => {
    if (!open) return;
    setNewName(mode === 'rename' ? sourceName : '');
    setMergeTarget('');
    setUsage(null);
    if (mode !== 'create') {
      setLoadingUsage(true);
      countUsage(kind, sourceName)
        .then(setUsage)
        .catch(() => setUsage(null))
        .finally(() => setLoadingUsage(false));
    }
  }, [open, mode, kind, sourceName]);

  const title =
    mode === 'create'
      ? `Add ${kindLabel(kind)}`
      : mode === 'rename'
        ? `Rename ${kindLabel(kind)}`
        : mode === 'merge'
          ? `Merge ${kindLabel(kind)}`
          : `Delete ${kindLabel(kind)}`;

  const mergeOptions = existingNames.filter((n) => n.toLowerCase() !== sourceName.toLowerCase());

  const handleConfirm = async () => {
    setProcessing(true);
    try {
      if (mode === 'create') {
        const created = await createCatalogEntry(kind, newName);
        toast({
          title: created ? 'Added' : 'Already exists',
          description: created
            ? `${kindLabel(kind)} "${newName.trim()}" added to the catalog.`
            : `A ${kindLabel(kind).toLowerCase()} with that name already exists.`,
        });
      } else if (mode === 'rename') {
        if (!newName.trim()) throw new Error('Name cannot be empty');
        if (newName.trim().toLowerCase() === sourceName.toLowerCase()) {
          toast({ title: 'No change', description: 'The name is unchanged.' });
          onOpenChange(false);
          return;
        }
        const res = await renameCatalogEntry(kind, sourceName, newName.trim());
        toast({
          title: 'Renamed',
          description: `Updated ${res.billsUpdated} bill(s) and ${res.ordersUpdated} order(s).`,
        });
      } else if (mode === 'merge') {
        if (!mergeTarget) throw new Error('Pick a target to merge into');
        const res = await renameCatalogEntry(kind, sourceName, mergeTarget);
        toast({
          title: 'Merged',
          description: `"${sourceName}" merged into "${mergeTarget}" across ${res.billsUpdated} bill(s) and ${res.ordersUpdated} order(s).`,
        });
      } else if (mode === 'delete') {
        const removed = await deleteCatalogEntry(kind, sourceName);
        toast({
          title: 'Deleted',
          description: removed > 0
            ? `Removed "${sourceName}" from the catalog.`
            : `"${sourceName}" was not in the catalog list.`,
        });
      }
      onDone();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Catalog action failed:', error);
      toast({ title: 'Error', description: error?.message || 'Action failed', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const confirmDisabled =
    processing ||
    (mode === 'create' && !newName.trim()) ||
    (mode === 'rename' && !newName.trim()) ||
    (mode === 'merge' && !mergeTarget);

  const Icon = mode === 'merge' ? GitMerge : mode === 'delete' ? Trash2 : mode === 'create' ? Plus : Pencil;

  const usageLine = loadingUsage ? (
    <span className="flex items-center gap-1 text-sm text-gray-500">
      <Loader2 className="h-3 w-3 animate-spin" /> checking usage…
    </span>
  ) : usage ? (
    <span className="text-sm text-gray-600 dark:text-gray-300">
      Appears in <b>{usage.bills}</b> bill(s) and <b>{usage.orders}</b> order(s).
    </span>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-purple-600" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' && `Add a new ${kindLabel(kind).toLowerCase()} to the billing catalog.`}
            {mode === 'rename' && `Rename "${sourceName}" everywhere — historical bills & orders are updated (amounts unchanged).`}
            {mode === 'merge' && `Combine "${sourceName}" into another ${kindLabel(kind).toLowerCase()}. Historical bills & orders are updated.`}
            {mode === 'delete' && `Remove "${sourceName}" from the catalog list.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {mode !== 'create' && <div>{usageLine}</div>}

          {(mode === 'create' || mode === 'rename') && (
            <div>
              <Label className="text-sm">Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`${kindLabel(kind)} name`}
                className="mt-1"
                autoFocus
              />
              {mode === 'rename' && (
                <p className="text-xs text-gray-500 mt-1">
                  Tip: renaming to an existing name merges them.
                </p>
              )}
            </div>
          )}

          {mode === 'merge' && (
            <div>
              <Label className="text-sm">Merge into</Label>
              <Select value={mergeTarget} onValueChange={setMergeTarget}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={`Pick a ${kindLabel(kind).toLowerCase()}…`} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {mergeOptions.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mergeTarget && (
                <p className="text-xs text-gray-500 mt-2">
                  All "{sourceName}" lines become "{mergeTarget}" in bills & orders.
                </p>
              )}
            </div>
          )}

          {mode === 'delete' && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-900/20 p-3 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs">
                This only removes it from the catalog list (dropdowns). It does <b>not</b> change bill amounts, so if it
                still appears in past bills its ROI history will remain — use <b>Merge</b> to fold it into another {kindLabel(kind).toLowerCase()} instead.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={confirmDisabled}
            variant={mode === 'delete' ? 'destructive' : 'default'}
            className={mode !== 'delete' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : ''}
          >
            {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Icon className="h-4 w-4 mr-2" />}
            {mode === 'create' ? 'Add' : mode === 'rename' ? 'Rename' : mode === 'merge' ? 'Merge' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CatalogManageDialog;
