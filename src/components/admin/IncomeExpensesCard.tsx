import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { formatCurrency } from '@/utils/billingUtils';
import { useNavigate } from 'react-router-dom';

interface IncomeExpensesCardProps {
  onClick?: () => void;
}

interface StaffMember {
  id: string;
  name: string;
  salaryAmount: number;
  salaryMode: 'monthly' | 'daily' | 'hourly';
  [key: string]: any;
}

const IncomeExpensesCard: React.FC<IncomeExpensesCardProps> = ({ onClick }) => {
  const navigate = useNavigate();
  const [financialData, setFinancialData] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
    trend: 'neutral' as 'up' | 'down' | 'neutral'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      // Get current month date range
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      const dateRange = {
        start: Timestamp.fromDate(startOfMonth),
        end: Timestamp.fromDate(endOfMonth)
      };
      
      let totalIncome = 0;
      let totalExpenses = 0;
      
      // Fetch bills for income (using the 'bills' collection)
      let billsQuery = query(
        collection(db, 'bills'),
        where('date', '>=', dateRange.start),
        where('date', '<=', dateRange.end)
      );
      
      const billsSnapshot = await getDocs(billsQuery);
      const billsIncome = billsSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.totalAmount || 0);
      }, 0);
      
      totalIncome += billsIncome;
      
      // Calculate expenses from Cost of Goods Sold (COGS) - from bill items
      const cogsExpenses = billsSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        if (data.items && Array.isArray(data.items)) {
          const itemsCost = data.items.reduce((itemSum: number, item: any) => {
            // Calculate cost for each item type
            const itemCost = (item.cost || 0) * (item.quantity || 1);
            return itemSum + itemCost;
          }, 0);
          return sum + itemsCost;
        }
        return sum;
      }, 0);
      
      totalExpenses += cogsExpenses;
      
      // Fetch legacy billing data for backward compatibility
      let legacyBillingQuery = query(
        collection(db, 'billing'),
        where('createdAt', '>=', dateRange.start),
        where('createdAt', '<=', dateRange.end)
      );
      
      const legacyBillingSnapshot = await getDocs(legacyBillingQuery);
      const legacyBillingIncome = legacyBillingSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.totalAmount || 0);
      }, 0);
      
      totalIncome += legacyBillingIncome;
      
      // Fetch custom income
      let incomeQuery = query(
        collection(db, 'income'),
        where('date', '>=', dateRange.start),
        where('date', '<=', dateRange.end)
      );
      
      const incomeSnapshot = await getDocs(incomeQuery);
      const customIncome = incomeSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.amount || 0);
      }, 0);
      
      totalIncome += customIncome;
      
      // Fetch custom expenses (operational expenses not related to sales)
      let expensesQuery = query(
        collection(db, 'expenses'),
        where('date', '>=', dateRange.start),
        where('date', '<=', dateRange.end)
      );
      
      const expensesSnapshot = await getDocs(expensesQuery);
      const customExpenses = expensesSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data();
        return sum + (data.amount || 0);
      }, 0);
      
      totalExpenses += customExpenses;
      
      // Calculate staff salaries as expenses
      try {
        // Fetch all staff members
        const staffQuery = query(collection(db, 'staff'));
        const staffSnapshot = await getDocs(staffQuery);
        const staffMembers = staffSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StaffMember[];

        let totalStaffSalaries = 0;

        // Calculate salary for each staff member in the date range
        for (const staff of staffMembers) {
          if (!staff.salaryAmount || staff.salaryAmount <= 0) continue;

          let salaryAmount = 0;

          if (staff.salaryMode === 'monthly') {
            // For monthly salary, check if the current month is in range
            // Since we're looking at just this month already, include one month's salary
            salaryAmount = staff.salaryAmount;
          } else {
            // For daily/hourly, calculate based on attendance
            let attendanceQuery = query(
              collection(db, 'attendance'),
              where('staffId', '==', staff.id),
              where('status', '==', 'confirmed'),
              where('date', '>=', startOfMonth.toISOString().split('T')[0]),
              where('date', '<=', endOfMonth.toISOString().split('T')[0])
            );
            
            const attendanceSnapshot = await getDocs(attendanceQuery);
            const attendanceCount = attendanceSnapshot.size;
            
            if (staff.salaryMode === 'daily') {
              // Calculate based on actual working days
              const workingDays = attendanceCount > 0 ? attendanceCount : 0;
              if (workingDays > 0) {
                salaryAmount = staff.salaryAmount * workingDays;
              }
            } else if (staff.salaryMode === 'hourly') {
              let totalHours = 0;
              
              if (attendanceCount > 0) {
                // Calculate based on actual attendance records
                attendanceSnapshot.docs.forEach(doc => {
                  const attendanceData = doc.data();
                  totalHours += attendanceData.hoursWorked || 8; // Default 8 hours if not specified
                });
              }
              
              if (totalHours > 0) {
                salaryAmount = staff.salaryAmount * totalHours;
              }
            }
          }

          if (salaryAmount > 0) {
            totalStaffSalaries += salaryAmount;
          }
        }

        // Add staff salaries to total expenses
        totalExpenses += totalStaffSalaries;
        console.log('Total staff salaries included in expenses:', totalStaffSalaries);
      } catch (error) {
        console.error('Error calculating staff salaries:', error);
      }
      
      // Calculate net profit and profit margin
      const netProfit = totalIncome - totalExpenses;
      const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
      
      // Determine trend (for demo purposes, we'll say anything above 15% is good)
      let trend: 'up' | 'down' | 'neutral' = 'neutral';
      if (profitMargin >= 15) {
        trend = 'up';
      } else if (profitMargin < 0) {
        trend = 'down';
      }
      
      setFinancialData({
        totalIncome,
        totalExpenses,
        netProfit,
        profitMargin,
        trend
      });
      
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate('/income-expenses');
    }
  };

  const getTrendIcon = () => {
    if (financialData.trend === 'up') {
      return <TrendingUp className="h-5 w-5 text-green-600" />;
    } else if (financialData.trend === 'down') {
      return <TrendingDown className="h-5 w-5 text-red-600" />;
    } else {
      return <ArrowRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getColorClass = () => {
    if (financialData.netProfit >= 0) {
      return 'text-green-600';
    } else {
      return 'text-red-600';
    }
  };

  const getBgColorClass = () => {
    if (financialData.netProfit >= 0) {
      return 'bg-green-50';
    } else {
      return 'bg-red-50';
    }
  };

  return (
    <Card 
      className="hover:shadow-xl transition-all duration-300 border-0 shadow-lg cursor-pointer group transform hover:-translate-y-1"
      onClick={handleClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Income & Expenses
        </CardTitle>
        <div className={`p-3 rounded-lg ${getBgColorClass()} group-hover:scale-110 transition-transform duration-300`}>
          <Calculator className={`h-5 w-5 ${getColorClass()}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-2xl font-bold ${getColorClass()} mb-1`}>
              {loading ? '...' : formatCurrency(financialData.netProfit)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Net profit this month</p>
          </div>
          <div className={`flex items-center gap-1 ${financialData.trend === 'up' ? 'text-green-600' : financialData.trend === 'down' ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
            {getTrendIcon()}
            <span className="text-sm font-medium">
              {loading ? '...' : `${financialData.profitMargin >= 0 ? '' : '-'}${Math.abs(financialData.profitMargin).toFixed(1)}%`}
            </span>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400">Income</span>
            <span className="font-medium text-green-600">
              {loading ? '...' : formatCurrency(financialData.totalIncome)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400">Expenses</span>
            <span className="font-medium text-red-600">
              {loading ? '...' : formatCurrency(financialData.totalExpenses)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IncomeExpensesCard;
