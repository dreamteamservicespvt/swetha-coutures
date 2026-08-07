import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, FileText, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { getCategoryData } from '@/utils/financeReports';

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
  expenseName?: string; // ✅ Added expenseName field
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
      // Aggregation lives in the shared util so the Tracking tab and the Accounts/CA export stay in sync
      const categoriesArray = await getCategoryData(type, dateRange);
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
      let dateObj: Date;

      if (!date) return 'N/A';

      // Firebase Timestamp with toDate()
      if (typeof date?.toDate === 'function') {
        dateObj = date.toDate();
      // Raw Firestore Timestamp {seconds, nanoseconds}
      } else if (date && typeof date === 'object' && 'seconds' in date) {
        dateObj = new Date(date.seconds * 1000);
      // Already a Date
      } else if (date instanceof Date) {
        dateObj = date;
      // String or number
      } else {
        dateObj = new Date(date);
      }

      if (isNaN(dateObj.getTime())) return 'N/A';

      return dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return 'N/A';
    }
  };

  const totalAmount = categoryData.reduce((sum, cat) => sum + cat.total, 0);

  const handleCategoryClick = (category: CategoryData) => {
    setSelectedCategory(category);
    setIsDetailOpen(true);
  };

  return (
    <div className={inline ? 'space-y-3' : 'space-y-6'}>
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
            <p className="text-gray-600 dark:text-gray-400">Total: ₹{totalAmount.toLocaleString()}</p>
          </div>
        </div>
      )}

      {inline && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total</span>
          <span className={`text-lg font-bold ${type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
            ₹{totalAmount.toLocaleString()}
          </span>
        </div>
      )}

      {/* Category Cards — inline (Tracking tab) gets a fixed height with internal scroll */}
      <div className={`grid gap-4 ${inline ? 'grid-cols-1 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
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
                <div className="flex items-center space-x-2">
                  <CardDescription className="mb-0">
                    {category.count} entries
                  </CardDescription>
                  <Badge variant="secondary" className="text-xs">
                    {((category.total / totalAmount) * 100).toFixed(1)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-lg font-bold ${type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{category.total.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
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
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No {type} categories found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
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
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Amount</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedCategory.count}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Entries</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      ₹{(selectedCategory.total / selectedCategory.count).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Average</div>
                  </div>
                </div>
              </div>

              {/* Entries List */}
              <div className="space-y-3">
                {selectedCategory.entries
                  .sort((a, b) => {
                    const toDate = (d: any) => {
                      if (!d) return new Date(0);
                      if (typeof d?.toDate === 'function') return d.toDate();
                      if (d && typeof d === 'object' && 'seconds' in d) return new Date(d.seconds * 1000);
                      if (d instanceof Date) return d;
                      const parsed = new Date(d);
                      return isNaN(parsed.getTime()) ? new Date(0) : parsed;
                    };
                    return toDate(b.date).getTime() - toDate(a.date).getTime();
                  })
                  .map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">
                          {entry.type === 'salary' ? `${entry.staffName} Salary` :
                           entry.type === 'inventory' ? entry.itemName || 'Material Item' :
                           entry.type === 'billing' ? `${entry.billNumber || 'Bill'} - ${entry.customerName || 'Customer'}${entry.instalment ? ` (${entry.instalment})` : ''}` :
                           entry.type === 'custom' && type === 'expense' ? entry.expenseName || 'Expense Entry' :
                           entry.type === 'custom' && type === 'income' ? entry.sourceName || 'Income Entry' :
                           entry.sourceName || entry.customerName || entry.itemName || 'Entry'}
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
