import React, { useState } from 'react';
import { 
  Dialog,
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { FileSpreadsheet, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Bill, calculateBillStatus } from '@/utils/billingUtils';

interface BillingExportDialogProps {
  bills: Bill[];
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface ExportColumn {
  id: string;
  title: string;
  key: (bill: Bill) => any;
  width: number;
  enabled: boolean;
}

const BillingExportDialog: React.FC<BillingExportDialogProps> = ({ bills, open, setOpen }) => {
  const [columns, setColumns] = useState<ExportColumn[]>([
    {
      id: 'billId',
      title: 'Bill ID',
      key: (bill: Bill) => bill.billId || 'N/A',
      width: 12,
      enabled: true
    },
    {
      id: 'customerName',
      title: 'Customer Name',
      key: (bill: Bill) => bill.customerName || 'N/A',
      width: 20,
      enabled: true
    },
    {
      id: 'customerPhone',
      title: 'Phone',
      key: (bill: Bill) => bill.customerPhone || 'N/A',
      width: 15,
      enabled: true
    },
    {
      id: 'billDate',
      title: 'Bill Date',
      key: (bill: Bill) => {
        try {
          const { formatDateForDisplay } = require('@/utils/billingUtils');
          return formatDateForDisplay(bill.date);
        } catch {
          return 'N/A';
        }
      },
      width: 12,
      enabled: true
    },
    {
      id: 'totalAmount',
      title: 'Total Amount',
      key: (bill: Bill) => bill.totalAmount || 0,
      width: 12,
      enabled: true
    },
    {
      id: 'paidAmount',
      title: 'Paid Amount',
      key: (bill: Bill) => bill.paidAmount || 0,
      width: 12,
      enabled: true
    },
    {
      id: 'balance',
      title: 'Balance',
      key: (bill: Bill) => bill.balance || 0,
      width: 12,
      enabled: true
    },
    {
      id: 'paymentStatus',
      title: 'Payment Status',
      key: (bill: Bill) => {
        const status = calculateBillStatus(bill.totalAmount || 0, bill.paidAmount || 0);
        return status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid';
      },
      width: 15,
      enabled: true
    },
    {
      id: 'workItemsSummary',
      title: 'Work Items Summary',
      key: (bill: Bill) => bill.items?.map(item => item.description).join(', ') || 'N/A',
      width: 30,
      enabled: true
    },
    {
      id: 'customerEmail',
      title: 'Email',
      key: (bill: Bill) => bill.customerEmail || 'N/A',
      width: 20,
      enabled: false
    },
    {
      id: 'customerAddress',
      title: 'Address',
      key: (bill: Bill) => bill.customerAddress || 'N/A',
      width: 25,
      enabled: false
    },
    {
      id: 'createdAt',
      title: 'Created Date',
      key: (bill: Bill) => {
        try {
          const { formatDateForDisplay } = require('@/utils/billingUtils');
          return formatDateForDisplay(bill.createdAt);
        } catch {
          return 'N/A';
        }
      },
      width: 12,
      enabled: false
    },
    {
      id: 'dueDate',
      title: 'Due Date',
      key: (bill: Bill) => {
        try {
          const { formatDateForDisplay } = require('@/utils/billingUtils');
          return bill.dueDate ? formatDateForDisplay(bill.dueDate) : 'N/A';
        } catch {
          return 'N/A';
        }
      },
      width: 12,
      enabled: false
    },
    {
      id: 'notes',
      title: 'Notes',
      key: (bill: Bill) => bill.notes || 'N/A',
      width: 25,
      enabled: false
    }
  ]);

  const toggleColumn = (id: string) => {
    setColumns(columns.map(col => 
      col.id === id ? { ...col, enabled: !col.enabled } : col
    ));
  };

  const selectAll = () => {
    setColumns(columns.map(col => ({ ...col, enabled: true })));
  };

  const deselectAll = () => {
    setColumns(columns.map(col => ({ ...col, enabled: false })));
  };

  const handleExport = () => {
    try {
      const enabledColumns = columns.filter(col => col.enabled);
      
      if (enabledColumns.length === 0) {
        toast({
          title: "Export Error",
          description: "Please select at least one column to export",
          variant: "destructive",
        });
        return;
      }

      // Prepare data for export
      const exportData = bills.map(bill => {
        const rowData: Record<string, any> = {};
        enabledColumns.forEach(col => {
          rowData[col.title] = col.key(bill);
        });
        return rowData;
      });

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      
      // Set column widths for better readability
      const colWidths = enabledColumns.map(col => ({ wch: col.width }));
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Bills');

      // Generate filename with current date
      const currentDate = new Date();
      const dateString = currentDate.toLocaleDateString('en-IN').replace(/\//g, '-');
      const filename = `bills_${dateString}.xlsx`;

      // Export file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(data, filename);

      toast({
        title: "Export Successful",
        description: `${bills.length} bills exported to ${filename}`,
      });
      
      setOpen(false);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export bills to Excel",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-full max-w-[95vw] md:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0 sm:p-6">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-purple-600" />
            <span>Export Bills to Excel</span>
          </DialogTitle>
          <DialogDescription>
            Select the columns you want to include in the Excel export.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {columns.filter(col => col.enabled).length} of {columns.length} columns selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>Deselect All</Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {columns.map((column) => (
              <div key={column.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={`column-${column.id}`} 
                  checked={column.enabled}
                  onCheckedChange={() => toggleColumn(column.id)}
                />
                <Label htmlFor={`column-${column.id}`} className="cursor-pointer">
                  {column.title}
                </Label>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-medium mb-2">Preview ({bills.length} records)</h4>
            <div className="border rounded-md overflow-hidden">
              <ScrollArea className="h-[30vh] sm:h-64 w-full">
                <div className="p-2 min-w-max">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800">
                        {columns.filter(col => col.enabled).map(col => (
                          <th key={col.id} className="text-left p-2 border-b whitespace-nowrap">{col.title}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bills.slice(0, 5).map((bill, index) => (
                        <tr key={bill.id || index} className="border-b">
                          {columns.filter(col => col.enabled).map(col => (
                            <td key={`${bill.id}-${col.id}`} className="p-2 whitespace-nowrap">
                              {typeof col.key(bill) === 'number'
                                ? col.key(bill).toLocaleString('en-IN')
                                : String(col.key(bill))
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                      {bills.length > 5 && (
                        <tr>
                          <td colSpan={columns.filter(col => col.enabled).length} className="p-2 text-center text-gray-500 dark:text-gray-400">
                            ... and {bills.length - 5} more records
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} className="sm:w-auto w-full">
              Cancel
            </Button>
            <Button onClick={handleExport} className="sm:w-auto w-full">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export to Excel
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BillingExportDialog;
