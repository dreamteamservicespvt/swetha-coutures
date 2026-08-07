
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface NetProfitChartProps {
  financialData: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    incomeData: any[];
    expenseData: any[];
  };
}

const NetProfitChart = ({ financialData }: NetProfitChartProps) => {
  // Collapsed by default — the same three figures already sit in the cards at the top of
  // the page, so the chart is a detail the admin opens when they want it (Req 4).
  const [open, setOpen] = useState(false);
  const chartData = [
    {
      name: 'Income',
      value: financialData.totalIncome,
      type: 'income'
    },
    {
      name: 'Expenses',
      value: financialData.totalExpenses,
      type: 'expense'
    },
    {
      name: 'Net Profit',
      value: financialData.netProfit,
      type: 'net'
    }
  ];

  const getBarColor = (type: string, value: number) => {
    switch (type) {
      case 'income':
        return '#10b981'; // green
      case 'expense':
        return '#ef4444'; // red
      case 'net':
        return value >= 0 ? '#10b981' : '#ef4444'; // green if positive, red if negative
      default:
        return '#6b7280'; // gray
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // Determine color based on type and value
      let textColor = 'text-gray-600 dark:text-gray-400';
      if (data.type === 'income') {
        textColor = 'text-green-600';
      } else if (data.type === 'expense') {
        textColor = 'text-red-600';
      } else if (data.type === 'net') {
        textColor = data.value >= 0 ? 'text-green-600' : 'text-red-600';
      }
      
      // Format the value with proper sign for negative numbers
      const formattedValue = data.value < 0 ? 
        `-₹${Math.abs(data.value).toLocaleString()}` : 
        `₹${data.value.toLocaleString()}`;
      
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p className={`text-sm ${textColor}`}>
            {formattedValue}
            {data.type === 'net' && data.value < 0 && ' (Loss)'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="min-w-0">
            <CardTitle className="text-base sm:text-lg">Financial Overview</CardTitle>
            <CardDescription className="mt-1 truncate">
              Income vs Expenses comparison · tap to {open ? 'hide' : 'show'} the chart
            </CardDescription>
          </span>
          {open ? (
            <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 text-gray-500" />
          )}
        </button>
      </CardHeader>
      {open && (
      <CardContent>
        <div className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="value" 
                radius={[4, 4, 0, 0]}
                maxBarSize={80}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getBarColor(entry.type, entry.value)} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Cards Below Chart */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">Income Collected</div>
            <div className="text-lg font-bold text-green-600">
              ₹{financialData.totalIncome.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</div>
            <div className="text-lg font-bold text-red-600">
              ₹{financialData.totalExpenses.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">Net Profit</div>
            <div className={`text-lg font-bold ${financialData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {financialData.netProfit < 0 ?
                `-₹${Math.abs(financialData.netProfit).toLocaleString()}` :
                `₹${financialData.netProfit.toLocaleString()}`
              }
            </div>
          </div>
        </div>
      </CardContent>
      )}
    </Card>
  );
};

export default NetProfitChart;
