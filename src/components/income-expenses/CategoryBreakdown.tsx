import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, FileText, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface StaffMember {
  id: string;
  name: string;
  salaryAmount: number;
  salaryMode: 'monthly' | 'daily' | 'hourly';
  [key: string]: any;
}

interface CategoryBreakdownProps {
  type: 'income' | 'expense';
  dateRange: { start: Timestamp; end: Timestamp } | null;
  onBack?: () => void;
  inline?: boolean;
}

interface CategoryData {
  name: string;
  total: number;
  count: number;
  entries: any[];
}

interface BreakdownEntry {
  id: string;
  amount: number;
  date: any;
  notes?: string;
  category?: string;
  sourceName?: string;
  customerName?: string;
  itemName?: string;
  supplier?: string;
  type: string;
}

const CategoryBreakdown = ({ type, dateRange, onBack, inline = false }: CategoryBreakdownProps) => {
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryData | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCategoryData = async () => {
    setLoading(true);
    try {
      const categoryTotals: { [key: string]: CategoryData } = {};

      if (type === 'income') {
        // Fetch billing data from 'billing' collection (legacy)
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
        billingSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const category = 'Sales & Billing (Legacy)';
          const entry = {
            id: doc.id,
            amount: data.totalAmount || 0,
            date: data.createdAt,
            customerName: data.customerName || 'Unknown Customer',
            type: 'billing'
          };

          if (!categoryTotals[category]) {
            categoryTotals[category] = { name: category, total: 0, count: 0, entries: [] };
          }
          categoryTotals[category].total += entry.amount;
          categoryTotals[category].count++;
          categoryTotals[category].entries.push(entry);
        });

        // Fetch billing data from 'bills' collection (new)
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
        billsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const category = 'Sales & Billing';
          const entry = {
            id: doc.id,
            amount: data.totalAmount || 0,
            date: data.date,
            customerName: data.customerName || 'Unknown Customer',
            type: 'billing'
          };

          if (!categoryTotals[category]) {
            categoryTotals[category] = { name: category, total: 0, count: 0, entries: [] };
          }
          categoryTotals[category].total += entry.amount;
          categoryTotals[category].count++;
          categoryTotals[category].entries.push(entry);
        });

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
        incomeSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const category = data.category || data.sourceName || 'Other Income';
          const entry = {
            id: doc.id,
            amount: data.amount || 0,
            date: data.date || data.createdAt,
            notes: data.notes,
            sourceName: data.sourceName,
            type: 'custom'
          };

          if (!categoryTotals[category]) {
            categoryTotals[category] = { name: category, total: 0, count: 0, entries: [] };
          }
          categoryTotals[category].total += entry.amount;
          categoryTotals[category].count++;
          categoryTotals[category].entries.push(entry);
        });

      } else {
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
        inventorySnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.cost && data.broughtAt) {
            const category = 'Materials & Inventory';
            const entry = {
              id: doc.id,
              amount: data.cost || 0,
              date: data.broughtAt,
              itemName: data.itemName || data.name || 'Unknown Item',
              supplier: data.supplier || 'Unknown Supplier',
              type: 'inventory'
            };

            if (!categoryTotals[category]) {
              categoryTotals[category] = { name: category, total: 0, count: 0, entries: [] };
            }
            categoryTotals[category].total += entry.amount;
            categoryTotals[category].count++;
            categoryTotals[category].entries.push(entry);
          }
        });

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
        expensesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const category = data.category || 'Other Expenses';
          const entry = {
            id: doc.id,
            amount: data.amount || 0,
            date: data.date || data.createdAt,
            notes: data.notes,
            category: data.category,
            type: 'custom'
          };

          if (!categoryTotals[category]) {
            categoryTotals[category] = { name: category, total: 0, count: 0, entries: [] };
          }
          categoryTotals[category].total += entry.amount;
          categoryTotals[category].count++;
          categoryTotals[category].entries.push(entry);
        });

        // Calculate and add staff salaries
        try {
          const staffQuery = query(collection(db, 'staff'));
          const staffSnapshot = await getDocs(staffQuery);
          const staffMembers = staffSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as StaffMember[];

          for (const staff of staffMembers) {
            if (!staff.salaryAmount || staff.salaryAmount <= 0) continue;

            let salaryAmount = 0;
            let salaryDate = dateRange?.end || Timestamp.now();

            if (staff.salaryMode === 'monthly') {
              // For monthly salary, check if the date range includes any part of a month
              if (dateRange) {
                const monthsInRange = new Set();
                let currentDate = new Date(dateRange.start.toDate());
                while (currentDate <= dateRange.end.toDate()) {
                  const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
                  monthsInRange.add(monthKey);
                  currentDate.setMonth(currentDate.getMonth() + 1);
                }
                salaryAmount = staff.salaryAmount * monthsInRange.size;
              } else {
                // If no date range, use current month
                salaryAmount = staff.salaryAmount;
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
                  salaryAmount = staff.salaryAmount * workingDays;
                  console.log(`Daily salary calculation for ${staff.name}: ${workingDays} days × ₹${staff.salaryAmount} = ₹${salaryAmount}`);
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
                  salaryAmount = staff.salaryAmount * totalHours;
                  console.log(`Hourly salary calculation for ${staff.name}: ${totalHours} hours × ₹${staff.salaryAmount} = ₹${salaryAmount}`);
                }
              }
            }

            if (salaryAmount > 0) {
              const category = 'Staff Salaries';
              const entry = {
                id: `salary-${staff.id}-${salaryDate.toMillis()}`,
                amount: salaryAmount,
                date: salaryDate,
                staffName: staff.name || 'Unknown Staff',
                expenseName: `${staff.name} Salary`,
                notes: `${staff.salaryMode} salary for ${staff.name}`,
                type: 'salary'
              };

              if (!categoryTotals[category]) {
                categoryTotals[category] = { name: category, total: 0, count: 0, entries: [] };
              }
              categoryTotals[category].total += entry.amount;
              categoryTotals[category].count++;
              categoryTotals[category].entries.push(entry);
            }
          }
        } catch (error) {
          console.error('Error calculating staff salaries for breakdown:', error);
        }
      }

      // Convert to array and sort by total amount
      const categoriesArray = Object.values(categoryTotals).sort((a, b) => b.total - a.total);
      setCategoryData(categoriesArray);
    } catch (error) {
      console.error('Error fetching category data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategoryData();
  }, [type, dateRange]);

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

  const totalAmount = categoryData.reduce((sum, cat) => sum + cat.total, 0);

  const handleCategoryClick = (category: CategoryData) => {
    setSelectedCategory(category);
    setIsDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      {!inline && (
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-xl font-semibold">
              {type === 'income' ? 'Income' : 'Expense'} Categories Overview
            </h2>
            <p className="text-gray-600">Total: ₹{totalAmount.toLocaleString()}</p>
          </div>
        </div>
      )}

      {inline && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">
            {type === 'income' ? 'Income' : 'Expense'} Categories
          </h3>
          <p className="text-gray-600">Total: ₹{totalAmount.toLocaleString()}</p>
        </div>
      )}

      {/* Category Cards */}
      <div className={`grid gap-4 ${inline ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-6 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))
        ) : categoryData.length > 0 ? (
          categoryData.map((category, index) => (
            <Card 
              key={index} 
              className="cursor-pointer hover:shadow-lg transition-shadow border-l-4"
              style={{ 
                borderLeftColor: type === 'income' ? '#10b981' : '#ef4444' 
              }}
              onClick={() => handleCategoryClick(category)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="truncate">{category.name}</span>
                  <Eye className="h-4 w-4 text-gray-400" />
                </CardTitle>
                <CardDescription className="flex items-center space-x-2">
                  <span>{category.count} entries</span>
                  <Badge variant="secondary" className="text-xs">
                    {((category.total / totalAmount) * 100).toFixed(1)}%
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`text-lg font-bold ${type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{category.total.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  Avg: ₹{(category.total / category.count).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            {type === 'income' ? (
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            ) : (
              <TrendingDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            )}
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {type} categories found
            </h3>
            <p className="text-gray-600">
              Add some {type} entries to see category breakdown.
            </p>
          </div>
        )}
      </div>

      {/* Category Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              {type === 'income' ? (
                <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 mr-2 text-red-600" />
              )}
              {selectedCategory?.name}
            </DialogTitle>
            <DialogDescription>
              Detailed breakdown of all entries in this category
            </DialogDescription>
          </DialogHeader>

          {selectedCategory && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className={`text-2xl font-bold ${type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{selectedCategory.total.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total Amount</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedCategory.count}
                    </div>
                    <div className="text-sm text-gray-600">Total Entries</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      ₹{(selectedCategory.total / selectedCategory.count).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Average</div>
                  </div>
                </div>
              </div>

              {/* Entries List */}
              <div className="space-y-3">
                {selectedCategory.entries
                  .sort((a, b) => {
                    const dateA = a.date?.toDate?.() || new Date(a.date);
                    const dateB = b.date?.toDate?.() || new Date(b.date);
                    return dateB.getTime() - dateA.getTime();
                  })
                  .map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">
                          {entry.type === 'salary' ? `${entry.staffName} Salary` :
                           entry.expenseName || entry.sourceName || entry.customerName || entry.itemName || entry.category || 'Unnamed Entry'}
                        </div>
                        <div className="text-sm text-gray-600 flex items-center space-x-4">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(entry.date)}
                          </span>
                          {entry.supplier && (
                            <span>Supplier: {entry.supplier}</span>
                          )}
                          {entry.notes && (
                            <span className="flex items-center">
                              <FileText className="h-3 w-3 mr-1" />
                              {entry.notes}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`font-bold ${type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{entry.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoryBreakdown;
