
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Plus, Package, Users, DollarSign, Calendar, Tag, Edit2, Trash2, Settings, BarChart3 } from 'lucide-react';
import { collection, addDoc, getDocs, query, where, Timestamp, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import CategoryBreakdown from './CategoryBreakdown';
import CategoryInput from '../CategoryInput';

interface ExpensesTabProps {
  dateRange: { start: Timestamp; end: Timestamp } | null;
  onDataChange: () => void;
  loading: boolean;
}

interface ExpenseEntry {
  id: string;
  expenseName?: string;
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

interface StaffMember {
  id: string;
  name: string;
  salaryAmount?: number;
  salaryMode: 'monthly' | 'daily' | 'hourly';
  // New salary fields
  paidSalary?: number;
  bonus?: number;
  [key: string]: any;
}

const ExpensesTab = ({ dateRange, onDataChange, loading }: ExpensesTabProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCategoryBreakdown, setShowCategoryBreakdown] = useState(false);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<ExpenseEntry | null>(null);
  
  const [formData, setFormData] = useState({
    expenseName: '',
    category: '',
    amount: 0,
    date: new Date(),
    notes: ''
  });

  // Helper function to calculate monthly salary based on new logic
  const calculateMonthlySalary = (staff: StaffMember) => {
    const paidSalary = staff.paidSalary || 0;
    const bonus = staff.bonus || 0;
    const actualSalary = staff.salaryAmount || 0;
    
    // If both paid salary and bonus are entered, use their sum
    if (paidSalary > 0 && bonus > 0) {
      return paidSalary + bonus;
    }
    // If only paid salary is entered, use it
    if (paidSalary > 0) {
      return paidSalary;
    }
    // Otherwise, use actual salary
    return actualSalary;
  };

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
      
      // Fetch staff salary data - Enhanced calculation
      const salaryEntries: ExpenseEntry[] = [];
      
      try {
        // Fetch all staff members
        const staffQuery = query(collection(db, 'staff'));
        const staffSnapshot = await getDocs(staffQuery);
        const staffMembers = staffSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StaffMember[];

        // Calculate salary for each staff member in the date range
        for (const staff of staffMembers) {
          const monthlySalaryAmount = calculateMonthlySalary(staff);
          if (!monthlySalaryAmount || monthlySalaryAmount <= 0) continue;

          let salaryAmount = 0;
          let salaryDate = dateRange?.end || Timestamp.now();

          if (staff.salaryMode === 'monthly') {
            // For monthly salary, check if the date range includes any part of a month
            if (dateRange) {
              const startMonth = dateRange.start.toDate().getMonth();
              const startYear = dateRange.start.toDate().getFullYear();
              const endMonth = dateRange.end.toDate().getMonth();
              const endYear = dateRange.end.toDate().getFullYear();
              
              // Calculate monthly salary for each month in the range
              const monthsInRange = new Set();
              let currentDate = new Date(dateRange.start.toDate());
              while (currentDate <= dateRange.end.toDate()) {
                const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
                monthsInRange.add(monthKey);
                currentDate.setMonth(currentDate.getMonth() + 1);
              }
              
              salaryAmount = monthlySalaryAmount * monthsInRange.size;
            } else {
              // If no date range, use current month
              salaryAmount = monthlySalaryAmount;
            }
          } else {
            // For daily/hourly, calculate based on attendance
            let attendanceQuery = query(
              collection(db, 'attendance'),
              where('staffId', '==', staff.id),
              where('status', '==', 'confirmed')
            );
            
            if (dateRange) {
              attendanceQuery = query(
                collection(db, 'attendance'),
                where('staffId', '==', staff.id),
                where('status', '==', 'confirmed'),
                where('date', '>=', dateRange.start.toDate().toISOString().split('T')[0]),
                where('date', '<=', dateRange.end.toDate().toISOString().split('T')[0])
              ) as any;
            }
            
            const attendanceSnapshot = await getDocs(attendanceQuery);
            const attendanceCount = attendanceSnapshot.size;
            
            console.log(`Attendance records for ${staff.name} (${staff.salaryMode}):`, attendanceCount);
            
            if (staff.salaryMode === 'daily') {
              // If no attendance records but we're looking at current date, assume at least one day
              const workingDays = attendanceCount > 0 ? attendanceCount : 
                (dateRange ? 0 : 1); // Default to 1 day if no date range and no records
              
              if (workingDays > 0) {
                salaryAmount = monthlySalaryAmount * workingDays;
                console.log(`Daily salary calculation for ${staff.name}: ${workingDays} days × ₹${monthlySalaryAmount} = ₹${salaryAmount}`);
              }
            } else if (staff.salaryMode === 'hourly') {
              let totalHours = 0;
              
              if (attendanceCount > 0) {
                // Calculate based on actual attendance records
                attendanceSnapshot.docs.forEach(doc => {
                  const attendanceData = doc.data();
                  totalHours += attendanceData.hoursWorked || 8; // Default 8 hours if not specified
                });
              } else if (!dateRange) {
                // If no records but looking at current date, assume standard hours
                totalHours = 8; // Default to 8 hours if no date range specified
              }
              
              if (totalHours > 0) {
                salaryAmount = monthlySalaryAmount * totalHours;
                console.log(`Hourly salary calculation for ${staff.name}: ${totalHours} hours × ₹${monthlySalaryAmount} = ₹${salaryAmount}`);
              }
            }
          }

          if (salaryAmount > 0) {
            salaryEntries.push({
              id: `salary-${staff.id}-${salaryDate.toMillis()}`,
              amount: salaryAmount,
              date: salaryDate,
              staffName: staff.name || 'Unknown Staff',
              expenseName: `${staff.name} Salary`,
              notes: `${staff.salaryMode} salary for ${staff.name}`,
              category: 'Staff Salaries',
              type: 'salary'
            });
          }
        }
      } catch (error) {
        console.error('Error calculating staff salaries:', error);
      }
      
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
      const expenseData = {
        ...formData,
        date: Timestamp.fromDate(formData.date),
        ...(editingEntry ? { updatedAt: Timestamp.now() } : { createdAt: Timestamp.now() })
      };

      if (editingEntry) {
        await updateDoc(doc(db, 'expenses', editingEntry.id), expenseData);
        toast({
          title: "Success",
          description: "Expense entry updated successfully",
        });
      } else {
        await addDoc(collection(db, 'expenses'), expenseData);
        toast({
          title: "Success",
          description: "Expense entry added successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingEntry(null);
      setFormData({
        expenseName: '',
        category: '',
        amount: 0,
        date: new Date(),
        notes: ''
      });
      
      fetchExpenseData();
      onDataChange();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({
        title: "Error",
        description: "Failed to save expense entry",
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

  const handleEdit = (entry: ExpenseEntry) => {
    if (entry.type !== 'custom') {
      toast({
        title: "Cannot Edit",
        description: "Only custom expenses can be edited. Inventory and salary expenses are managed separately.",
        variant: "destructive",
      });
      return;
    }

    setEditingEntry(entry);
    setFormData({
      expenseName: entry.expenseName || '',
      category: entry.category || '',
      amount: entry.amount,
      date: entry.date?.toDate?.() || new Date(entry.date),
      notes: entry.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (entry: ExpenseEntry) => {
    if (entry.type !== 'custom') {
      toast({
        title: "Cannot Delete",
        description: "Only custom expenses can be deleted. Inventory and salary expenses are managed separately.",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm('Are you sure you want to delete this expense entry? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'expenses', entry.id));
        toast({
          title: "Success",
          description: "Expense entry deleted successfully",
        });
        fetchExpenseData();
        onDataChange();
      } catch (error) {
        console.error('Error deleting expense:', error);
        toast({
          title: "Error",
          description: "Failed to delete expense entry",
          variant: "destructive",
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      expenseName: '',
      category: '',
      amount: 0,
      date: new Date(),
      notes: ''
    });
    setEditingEntry(null);
  };

  const totalExpenses = expenseEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);

  if (showCategoryBreakdown) {
    return (
      <CategoryBreakdown 
        type="expense" 
        dateRange={dateRange} 
        onBack={() => setShowCategoryBreakdown(false)} 
      />
    );
  }

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
                className="bg-gradient-to-r from-red-600 to-pink-600"
                onClick={resetForm}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? 'Edit Expense Entry' : 'Add Expense Entry'}
                </DialogTitle>
                <DialogDescription>
                  {editingEntry ? 'Update the expense entry details.' : 'Add a custom expense to track business costs.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="expenseName">Expense Name</Label>
                  <Input
                    id="expenseName"
                    value={formData.expenseName}
                    onChange={(e) => setFormData({...formData, expenseName: e.target.value})}
                    placeholder="e.g., Office Rent, Material Purchase"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <CategoryInput
                    value={formData.category}
                    onChange={(value) => setFormData({...formData, category: value})}
                    type="expense"
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
                  <Button type="submit" className="bg-gradient-to-r from-red-600 to-pink-600">
                    {editingEntry ? 'Update Expense' : 'Add Expense'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
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
                  <div className="flex items-center space-x-4 flex-1">
                    <div className={`p-2 rounded-full ${getExpenseColor(entry.type)}`}>
                      {getExpenseIcon(entry.type)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {entry.type === 'inventory' ? entry.itemName : 
                         entry.type === 'salary' ? `${entry.staffName} Salary` : 
                         entry.expenseName || entry.category || 'Expense'}
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
                        {entry.category && entry.type === 'custom' && (
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
                      <div className="font-bold text-red-600">₹{entry.amount.toLocaleString()}</div>
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
          ) : (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Expense Entries</h3>
              <p className="text-gray-600 mb-4">Start by adding your first expense entry.</p>
              <Button 
                onClick={() => {
                  resetForm();
                  setIsDialogOpen(true);
                }} 
                className="bg-gradient-to-r from-red-600 to-pink-600"
              >
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
