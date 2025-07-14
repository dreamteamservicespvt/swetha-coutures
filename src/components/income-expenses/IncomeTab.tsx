
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Plus, Receipt, User, Calendar, DollarSign, Edit2, Trash2, Settings, BarChart3 } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, onSnapshot, Timestamp, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import CategoryBreakdown from './CategoryBreakdown';
import CategoryInput from '../CategoryInput';

interface IncomeTabProps {
  dateRange: { start: Timestamp; end: Timestamp } | null;
  onDataChange: () => void;
  loading: boolean;
}

interface IncomeEntry {
  id: string;
  sourceName?: string;
  category?: string;
  amount: number;
  date: any;
  notes?: string;
  customerName?: string;
  billId?: string;
  type: 'billing' | 'custom';
}

const IncomeTab = ({ dateRange, onDataChange, loading }: IncomeTabProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<IncomeEntry | null>(null);
  
  const [formData, setFormData] = useState({
    sourceName: '',
    category: '',
    amount: 0,
    date: new Date(),
    notes: ''
  });

  const fetchIncomeData = async () => {
    try {
      let incomeData: IncomeEntry[] = [];
      
      // Fetch legacy billing data
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
        category: 'Sales & Billing (Legacy)',
        type: 'billing' as const
      }));

      // Fetch new bills data
      let billsQuery = collection(db, 'bills');
      if (dateRange) {
        billsQuery = query(
          collection(db, 'bills'),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end),
          orderBy('date', 'desc')
        ) as any;
      } else {
        billsQuery = query(
          collection(db, 'bills'),
          orderBy('date', 'desc')
        ) as any;
      }
      
      const billsSnapshot = await getDocs(billsQuery);
      const billsEntries = billsSnapshot.docs.map(doc => ({
        id: doc.id,
        amount: doc.data().totalAmount || 0,
        date: doc.data().date,
        customerName: doc.data().customerName || 'Unknown Customer',
        billId: doc.id,
        category: 'Sales & Billing',
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
      
      incomeData = [...billingEntries, ...billsEntries, ...customEntries].sort((a, b) => {
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
      const incomeData = {
        ...formData,
        date: Timestamp.fromDate(formData.date),
        ...(editingEntry ? { updatedAt: Timestamp.now() } : { createdAt: Timestamp.now() })
      };

      if (editingEntry) {
        await updateDoc(doc(db, 'income', editingEntry.id), incomeData);
        toast({
          title: "Success",
          description: "Income entry updated successfully",
        });
      } else {
        await addDoc(collection(db, 'income'), incomeData);
        toast({
          title: "Success",
          description: "Income entry added successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingEntry(null);
      setFormData({
        sourceName: '',
        category: '',
        amount: 0,
        date: new Date(),
        notes: ''
      });
      
      fetchIncomeData();
      onDataChange();
    } catch (error) {
      console.error('Error saving income:', error);
      toast({
        title: "Error",
        description: "Failed to save income entry",
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

  const handleEdit = (entry: IncomeEntry) => {
    if (entry.type === 'billing') {
      toast({
        title: "Cannot Edit",
        description: "Billing entries cannot be edited from here. Please edit from the billing section.",
        variant: "destructive",
      });
      return;
    }

    setEditingEntry(entry);
    setFormData({
      sourceName: entry.sourceName || '',
      category: entry.category || '',
      amount: entry.amount,
      date: entry.date?.toDate?.() || new Date(entry.date),
      notes: entry.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (entry: IncomeEntry) => {
    if (entry.type === 'billing') {
      toast({
        title: "Cannot Delete",
        description: "Billing entries cannot be deleted from here. Please delete from the billing section.",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm('Are you sure you want to delete this income entry? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'income', entry.id));
        toast({
          title: "Success",
          description: "Income entry deleted successfully",
        });
        fetchIncomeData();
        onDataChange();
      } catch (error) {
        console.error('Error deleting income:', error);
        toast({
          title: "Error",
          description: "Failed to delete income entry",
          variant: "destructive",
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      sourceName: '',
      category: '',
      amount: 0,
      date: new Date(),
      notes: ''
    });
    setEditingEntry(null);
  };

  const totalIncome = incomeEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

  if (showCategoryBreakdown) {
    return (
      <CategoryBreakdown 
        type="income" 
        dateRange={dateRange} 
        onBack={() => setShowCategoryBreakdown(false)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Income Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Income Entries</h2>
          <p className="text-gray-600">Total: ₹{totalIncome.toLocaleString()}</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => setShowCategoryBreakdown(true)}
            className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Category Breakdown
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-gradient-to-r from-green-600 to-blue-600"
                onClick={resetForm}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Income
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? 'Edit Income Entry' : 'Add Income Entry'}
                </DialogTitle>
                <DialogDescription>
                  {editingEntry ? 'Update the income entry details.' : 'Add a custom income source to track additional revenue.'}
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
                  <Label htmlFor="category">Category</Label>
                  <CategoryInput
                    value={formData.category}
                    onChange={(value) => setFormData({...formData, category: value})}
                    type="income"
                    placeholder="Enter or select category"
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
                    {editingEntry ? 'Update Income' : 'Add Income'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
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
            <div className="h-96 overflow-y-auto">
              <div className="space-y-3 pr-2">
                {incomeEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`p-2 rounded-full ${entry.type === 'billing' ? 'bg-blue-100' : 'bg-green-100'}`}>
                      {entry.type === 'billing' ? (
                        <Receipt className={`h-4 w-4 ${entry.type === 'billing' ? 'text-blue-600' : 'text-green-600'}`} />
                      ) : (
                        <DollarSign className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
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
                        {entry.category && (
                          <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                            {entry.category}
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
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="font-bold text-green-600">₹{entry.amount.toLocaleString()}</div>
                      <div className="text-xs text-gray-500 capitalize">{entry.type}</div>
                    </div>
                    {entry.type === 'custom' && (
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(entry)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Income Entries</h3>
              <p className="text-gray-600 mb-4">Start by adding your first income entry or wait for billing data.</p>
              <Button 
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(true);
                }} 
                className="bg-gradient-to-r from-green-600 to-blue-600"
              >
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
