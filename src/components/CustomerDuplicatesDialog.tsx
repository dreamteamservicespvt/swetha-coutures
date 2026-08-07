import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Merge, Loader2, CheckCircle2 } from 'lucide-react';
import { collection, doc, getDocs, query, where, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface CustomerLike {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  createdAt?: any;
  totalBills?: number;
  outstandingBalance?: number;
  [key: string]: any;
}

interface CustomerDuplicatesDialogProps {
  customers: CustomerLike[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}

interface DuplicateGroup {
  phone: string;
  members: CustomerLike[];
}

const digits = (value?: string) => (value || '').replace(/\D/g, '').slice(-10);

/**
 * Finds and merges customer records that are the same person entered twice.
 *
 * Duplicates matter beyond tidiness: bill lookup falls back to matching on phone, so two
 * records sharing a number both claim the same bills and the amount owed is counted twice.
 * Merging keeps the oldest record (the one other data is most likely to reference), copies
 * across any field the survivor is missing, repoints orders/bills to it, and deletes the rest.
 */
const CustomerDuplicatesDialog: React.FC<CustomerDuplicatesDialogProps> = ({
  customers,
  open,
  onOpenChange,
  onMerged,
}) => {
  const [merging, setMerging] = useState<string | null>(null);

  const groups = useMemo<DuplicateGroup[]>(() => {
    const byPhone = new Map<string, CustomerLike[]>();
    customers.forEach((customer) => {
      const key = digits(customer.phone);
      if (key.length < 10) return; // Too little to be confident it is the same person.
      byPhone.set(key, [...(byPhone.get(key) || []), customer]);
    });

    return Array.from(byPhone.entries())
      .filter(([, members]) => members.length > 1)
      .map(([phone, members]) => ({
        phone,
        // Oldest first — that record becomes the survivor.
        members: [...members].sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return aTime - bTime;
        }),
      }));
  }, [customers]);

  const mergeGroup = async (group: DuplicateGroup) => {
    const [survivor, ...duplicates] = group.members;
    if (!survivor || duplicates.length === 0) return;

    const names = duplicates.map((d) => d.name).join(', ');
    if (
      !window.confirm(
        `Merge ${duplicates.length} duplicate record(s) into "${survivor.name}"?\n\n` +
          `Removing: ${names}\n\n` +
          `Their orders and bills will be repointed to the surviving record. This cannot be undone.`
      )
    ) {
      return;
    }

    setMerging(group.phone);
    try {
      // 1. Fill any gap on the survivor from the duplicates, so nothing typed is lost.
      const patch: Record<string, any> = {};
      const fields = ['email', 'address', 'city', 'pincode', 'notes', 'sizes', 'customerType'];
      fields.forEach((field) => {
        if (survivor[field]) return;
        const donor = duplicates.find((d) => d[field]);
        if (donor) patch[field] = donor[field];
      });

      const batch = writeBatch(db);
      if (Object.keys(patch).length > 0) {
        batch.update(doc(db, 'customers', survivor.id), patch);
      }

      // 2. Repoint anything that references a duplicate by customerId.
      for (const duplicate of duplicates) {
        for (const collectionName of ['orders', 'bills']) {
          const snapshot = await getDocs(
            query(collection(db, collectionName), where('customerId', '==', duplicate.id))
          );
          snapshot.docs.forEach((docSnap) => {
            batch.update(doc(db, collectionName, docSnap.id), {
              customerId: survivor.id,
              customerName: survivor.name,
            });
          });
        }
      }

      await batch.commit();

      // 3. Delete the duplicates only after the repointing has committed, so a failure
      //    mid-way leaves the data reachable rather than orphaned.
      for (const duplicate of duplicates) {
        await deleteDoc(doc(db, 'customers', duplicate.id));
      }

      toast({
        title: 'Customers merged',
        description: `${duplicates.length} duplicate record(s) merged into ${survivor.name}.`,
      });
      onMerged();
    } catch (error) {
      console.error('Merge failed:', error);
      toast({
        title: 'Merge failed',
        description: error instanceof Error ? error.message : 'Could not merge these records.',
        variant: 'destructive',
      });
    } finally {
      setMerging(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-600" />
            Duplicate customers
          </DialogTitle>
          <DialogDescription>
            Records that share a phone number are almost certainly the same person. While they
            exist, the same bills are counted against both, which inflates what appears to be
            owed.
          </DialogDescription>
        </DialogHeader>

        {groups.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500" />
            <p className="font-medium text-gray-800 dark:text-gray-200">No duplicates found</p>
            <p className="text-sm text-gray-500">Every customer has a unique phone number.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const [survivor, ...duplicates] = group.members;
              return (
                <div key={group.phone} className="rounded-lg border p-3 dark:border-gray-700">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{group.members[0].phone}</Badge>
                    <span className="text-sm text-gray-500">
                      {group.members.length} records
                    </span>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between gap-2 rounded bg-green-50 px-2 py-1.5 dark:bg-green-950/30">
                      <span className="min-w-0 truncate">
                        <b>{survivor.name}</b>{' '}
                        <span className="text-xs text-green-700 dark:text-green-400">keep</span>
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {survivor.totalBills || 0} bills
                      </span>
                    </div>
                    {duplicates.map((duplicate) => (
                      <div
                        key={duplicate.id}
                        className="flex items-center justify-between gap-2 rounded bg-red-50 px-2 py-1.5 dark:bg-red-950/30"
                      >
                        <span className="min-w-0 truncate">
                          {duplicate.name}{' '}
                          <span className="text-xs text-red-700 dark:text-red-400">remove</span>
                        </span>
                        <span className="shrink-0 text-xs text-gray-500">
                          {duplicate.totalBills || 0} bills
                        </span>
                      </div>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    disabled={merging !== null}
                    onClick={() => mergeGroup(group)}
                  >
                    {merging === group.phone ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Merge className="mr-2 h-4 w-4" />
                    )}
                    Merge into {survivor.name}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDuplicatesDialog;
