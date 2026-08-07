import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { formatCurrency } from '@/utils/billingUtils';
import { getFinancialSummary } from '@/utils/financeReports';
import { useNavigate } from 'react-router-dom';

interface IncomeExpensesCardProps {
  onClick?: () => void;
}

const IncomeExpensesCard: React.FC<IncomeExpensesCardProps> = ({ onClick }) => {
  const navigate = useNavigate();
  const [financialData, setFinancialData] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
    uncollected: 0,
    trend: 'neutral' as 'up' | 'down' | 'neutral'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      // Same shared calculation the Income & Expenses page uses, so the dashboard figure
      // and that page can never disagree. Income here is money *collected*, not billed.
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const { totalIncome, totalExpenses, netProfit, uncollected } = await getFinancialSummary({
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(end),
      });

      const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
      let trend: 'up' | 'down' | 'neutral' = 'neutral';
      if (profitMargin >= 15) trend = 'up';
      else if (profitMargin < 0) trend = 'down';

      setFinancialData({ totalIncome, totalExpenses, netProfit, profitMargin, trend, uncollected });
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
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Net profit this month (collected)
            </p>
          </div>
          <div className={`flex items-center gap-1 ${financialData.trend === 'up' ? 'text-green-600' : financialData.trend === 'down' ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
            {getTrendIcon()}
            <span className="text-sm font-medium">
              {loading ? '...' : `${financialData.profitMargin >= 0 ? '' : '-'}${Math.abs(financialData.profitMargin).toFixed(1)}%`}
            </span>
          </div>
        </div>
        
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400">Collected</span>
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
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400">Yet to collect</span>
            <span className="font-medium text-amber-600">
              {loading ? '...' : formatCurrency(financialData.uncollected)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IncomeExpensesCard;
