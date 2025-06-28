
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Plus, Package, Users, DollarSign, Calendar, Tag } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface ExpensesTabProps {
  dateRange: { start: Timestamp; end: Timestamp } | null;
  onDataChange: () => void;
  loading: boolean;
}

interface ExpenseEntry {
  id: string;
  category?: string;
  amount: number;
  date: any;
  notes?: string;
  itemName?: string;
  supplier?: string;
  staffName?: string;
  hours?: number;
  type: 'inventory' | 'salary' | 'custom';
}

const ExpensesTab = ({ dateRange, onDataChange, loading }: ExpensesTabProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [formData, setFormData] = useState({
    category: '',
    amount: 0,
    date: new Date(),
    notes: ''
  });

  const expenseCategories = [
    'Materials',
    'Equipment',
    'Utilities',
    'Transportation',
    'Marketing',
    'Staff Wages',
    'Rent',
    'Insurance',
    'Maintenance',
    'Office Supplies',
    'Food & Beverages',
    'Other'
  ];

  const fetchExpenseData = async () => {
    try {
      let expenseData: ExpenseEntry[] = [];
      
      // Fetch inventory purchases
      let inventoryQuery = collection(db, 'inventory');
      if (dateRange) {
        inventoryQuery = query(
          collection(db, 'inventory'),
          where('broughtAt', '>=', dateRange.start),
          where('broughtAt', '<=', dateRange.end),
          orderBy('broughtAt', 'desc')
        ) as any;
      } else {
        inventoryQuery = query(
          collection(db, 'inventory'),
          orderBy('broughtAt', 'desc')
        ) as any;
      }
      
      const inventorySnapshot = await getDocs(inventoryQuery);
      const inventoryEntries = inventorySnapshot.docs
        .filter(doc => doc.data().cost && doc.data().broughtAt)
        .map(doc => ({
          id: doc.id,
          amount: doc.data().cost || 0,
          date: doc.data().broughtAt,
          itemName: doc.data().itemName || doc.data().name || 'Unknown Item',
          supplier: doc.data().supplier || 'Unknown Supplier',
          type: 'inventory' as const
        }));
      
      // Fetch staff salary data (simplified - you can enhance this based on your attendance system)
      let attendanceQuery = collection(db, 'attendance');
      if (dateRange) {
        attendanceQuery = query(
          collection(db, 'attendance'),
          where('date', '>=', dateRange.start),
          where('date', '<=', dateRange.end),
          where('status', '==', 'Confirmed'),
          orderBy('date', 'desc')
        ) as any;
      }
      
      // Note: This is a simplified salary calculation. You might need to enhance based on your actual data structure
      const salaryEntries: ExpenseEntry[] = [];
      
      // Fetch custom expenses
      let expensesQuery = collection(db, 'expenses');
      if (dateRange) {
        expensesQuery = query(
          collection(db, 'expenses'),
          where('createdAt', '>=', dateRange.start),
          where('createdAt', '<=', dateRange.end),
          orderBy('createdAt', 'desc')
        ) as any;
      } else {
        expensesQuery = query(
          collection(db, 'expenses'),
          orderBy('createdAt', 'desc')
        ) as any;
      }
      
      const expensesSnapshot = await getDocs(expensesQuery);
      const customEntries = expensesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'custom' as const
      })) as ExpenseEntry[];
      
      expenseData = [...inventoryEntries, ...salaryEntries, ...customEntries].sort((a, b) => {
        const dateA = a.date?.toDate?.() || new Date(a.date);
        const dateB = b.date?.toDate?.() || new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      
      setExpenseEntries(expenseData);
    } catch (error) {
      console.error('Error fetching expense data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch expense data",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchExpenseData();
  }, [dateRange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'expenses'), {
        ...formData,
        date: Timestamp.fromDate(formData.date),
        createdAt: Timestamp.now()
      });

      toast({
        title: "Success",
        description: "Expense entry added successfully",
      });

      setIsDialogOpen(false);
      setFormData({
        category: '',
        amount: 0,
        date: new Date(),
        notes: ''
      });
      
      fetchExpenseData();
      onDataChange();
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({
        title: "Error",
        description: "Failed to add expense entry",
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

  const totalExpenses = expenseEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

  const getExpenseIcon = (type: string) => {
    switch (type) {
      case 'inventory':
        return <Package className="h-4 w-4 text-blue-600" />;
      case 'salary':
        return <Users className="h-4 w-4 text-purple-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-red-600" />;
    }
  };

  const getExpenseColor = (type: string) => {
    switch (type) {
      case 'inventory':
        return 'bg-blue-100';
      case 'salary':
        return 'bg-purple-100';
      default:
        return 'bg-red-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Expense Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Expense Entries</h2>
          <p className="text-gray-600">Total: ₹{totalExpenses.toLocaleString()}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-red-600 to-pink-600">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Expense Entry</DialogTitle>
              <DialogDescription>
                Add a custom expense to track business costs.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  required
                >
                  <option value="">Select category</option>
                  {expenseCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
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
                <Button type="submit" className="bg-gradient-to-r from-red-600 to-pink-600">
                  Add Expense
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expense Entries */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle>Expense History</CardTitle>
          <CardDescription>All expense entries including inventory, salaries, and custom expenses</CardDescription>
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
          ) : expenseEntries.length > 0 ? (
            <div className="space-y-3">
              {expenseEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${getExpenseColor(entry.type)}`}>
                      {getExpenseIcon(entry.type)}
                    </div>
                    <div>
                      <div className="font-medium">
                        {entry.type === 'inventory' ? entry.itemName : 
                         entry.type === 'salary' ? `Salary - ${entry.staffName}` : 
                         entry.category}
                      </div>
                      <div className="text-sm text-gray-600 flex items-center space-x-4">
                        {entry.supplier && (
                          <span className="flex items-center">
                            <Tag className="h-3 w-3 mr-1" />
                            {entry.supplier}
                          </span>
                        )}
                        {entry.hours && (
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {entry.hours}h
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
                    <div className="font-bold text-red-600">₹{entry.amount.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 capitalize">{entry.type}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Expense Entries</h3>
              <p className="text-gray-600 mb-4">Start by adding your first expense entry.</p>
              <Button onClick={() => setIsDialogOpen(true)} className="bg-gradient-to-r from-red-600 to-pink-600">
                <Plus className="h-4 w-4 mr-2" />
                Add First Expense
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpensesTab;
