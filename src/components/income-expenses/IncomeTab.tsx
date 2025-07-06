
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Plus, Receipt, User, Calendar, DollarSign } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface IncomeTabProps {
  dateRange: { start: Timestamp; end: Timestamp } | null;
  onDataChange: () => void;
  loading: boolean;
}

interface IncomeEntry {
  id: string;
  sourceName?: string;
  amount: number;
  date: any;
  notes?: string;
  customerName?: string;
  billId?: string;
  type: 'billing' | 'custom';
}

const IncomeTab = ({ dateRange, onDataChange, loading }: IncomeTabProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [formData, setFormData] = useState({
    sourceName: '',
    amount: 0,
    date: new Date(),
    notes: ''
  });

  const fetchIncomeData = async () => {
    try {
      let incomeData: IncomeEntry[] = [];
      
      // Fetch billing data
      let billingQuery = collection(db, 'billing');
      if (dateRange) {
        billingQuery = query(
          collection(db, 'billing'),
          where('createdAt', '>=', dateRange.start),
          where('createdAt', '<=', dateRange.end),
          orderBy('createdAt', 'desc')
        ) as any;
      } else {
        billingQuery = query(
          collection(db, 'billing'),
          orderBy('createdAt', 'desc')
        ) as any;
      }
      
      const billingSnapshot = await getDocs(billingQuery);
      const billingEntries = billingSnapshot.docs.map(doc => ({
        id: doc.id,
        amount: doc.data().totalAmount || 0,
        date: doc.data().createdAt,
        customerName: doc.data().customerName || 'Unknown Customer',
        billId: doc.id,
        type: 'billing' as const
      }));
      
      // Fetch custom income
      let incomeQuery = collection(db, 'income');
      if (dateRange) {
        incomeQuery = query(
          collection(db, 'income'),
          where('createdAt', '>=', dateRange.start),
          where('createdAt', '<=', dateRange.end),
          orderBy('createdAt', 'desc')
        ) as any;
      } else {
        incomeQuery = query(
          collection(db, 'income'),
          orderBy('createdAt', 'desc')
        ) as any;
      }
      
      const incomeSnapshot = await getDocs(incomeQuery);
      const customEntries = incomeSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'custom' as const
      })) as IncomeEntry[];
      
      incomeData = [...billingEntries, ...customEntries].sort((a, b) => {
        const dateA = a.date?.toDate?.() || new Date(a.date);
        const dateB = b.date?.toDate?.() || new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      
      setIncomeEntries(incomeData);
    } catch (error) {
      console.error('Error fetching income data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch income data",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchIncomeData();
  }, [dateRange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'income'), {
        ...formData,
        date: Timestamp.fromDate(formData.date),
        createdAt: Timestamp.now()
      });

      toast({
        title: "Success",
        description: "Income entry added successfully",
      });

      setIsDialogOpen(false);
      setFormData({
        sourceName: '',
        amount: 0,
        date: new Date(),
        notes: ''
      });
      
      fetchIncomeData();
      onDataChange();
    } catch (error) {
      console.error('Error adding income:', error);
      toast({
        title: "Error",
        description: "Failed to add income entry",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: any) => {
    try {
      const dateObj = date?.toDate?.() || new Date(date);
      return dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const totalIncome = incomeEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Add Income Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Income Entries</h2>
          <p className="text-gray-600">Total: ₹{totalIncome.toLocaleString()}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-green-600 to-blue-600">
              <Plus className="h-4 w-4 mr-2" />
              Add Income
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Income Entry</DialogTitle>
              <DialogDescription>
                Add a custom income source to track additional revenue.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="sourceName">Source Name</Label>
                <Input
                  id="sourceName"
                  value={formData.sourceName}
                  onChange={(e) => setFormData({...formData, sourceName: e.target.value})}
                  placeholder="e.g., Consulting Fee"
                  required
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount (₹)</Label>
                <NumberInput
                  id="amount"
                  value={formData.amount}
                  onChange={(value) => setFormData({...formData, amount: value || 0})}
                  min={0}
                  step={0.01}
                  decimals={2}
                  allowEmpty={false}
                  emptyValue={0}
                  placeholder="0.00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <DatePicker
                  date={formData.date}
                  onDateChange={(date) => setFormData({...formData, date: date || new Date()})}
                  placeholder="Select date"
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes"
                  rows={2}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-green-600 to-blue-600">
                  Add Income
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Income Entries */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Income History</CardTitle>
          <CardDescription>All income entries including sales and custom sources</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center space-x-4 p-4 border rounded-lg">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                </div>
              ))}
            </div>
          ) : incomeEntries.length > 0 ? (
            <div className="space-y-3">
              {incomeEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${entry.type === 'billing' ? 'bg-blue-100' : 'bg-green-100'}`}>
                      {entry.type === 'billing' ? (
                        <Receipt className={`h-4 w-4 ${entry.type === 'billing' ? 'text-blue-600' : 'text-green-600'}`} />
                      ) : (
                        <DollarSign className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        {entry.type === 'billing' ? `Bill #${entry.billId?.slice(-6)}` : entry.sourceName}
                      </div>
                      <div className="text-sm text-gray-600 flex items-center space-x-4">
                        {entry.customerName && (
                          <span className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            {entry.customerName}
                          </span>
                        )}
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(entry.date)}
                        </span>
                      </div>
                      {entry.notes && (
                        <div className="text-xs text-gray-500 mt-1">{entry.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">₹{entry.amount.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 capitalize">{entry.type}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Income Entries</h3>
              <p className="text-gray-600 mb-4">Start by adding your first income entry or wait for billing data.</p>
              <Button onClick={() => setIsDialogOpen(true)} className="bg-gradient-to-r from-green-600 to-blue-600">
                <Plus className="h-4 w-4 mr-2" />
                Add First Income
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IncomeTab;
