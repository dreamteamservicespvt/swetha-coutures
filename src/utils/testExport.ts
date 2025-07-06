// Simple test file to verify Excel export functionality
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export const testExcelExport = () => {
  console.log('Testing Excel export functionality...');
  
  // Test data
  const testData = [
    {
      'Bill ID': 'BILL001',
      'Customer Name': 'John Doe',
      'Phone': '9876543210',
      'Bill Date': '12/01/2024',
      'Total Amount': 1500,
      'Paid Amount': 1000,
      'Balance': 500,
      'Payment Status': 'Partial',
      'Work Items Summary': 'Shirt alteration, Dress fitting'
    },
    {
      'Bill ID': 'BILL002',
      'Customer Name': 'Jane Smith',
      'Phone': '9876543211',
      'Bill Date': '13/01/2024',
      'Total Amount': 2000,
      'Paid Amount': 2000,
      'Balance': 0,
      'Payment Status': 'Paid',
      'Work Items Summary': 'Blouse stitching, Saree blouse'
    }
  ];

  try {
    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(testData);
    const workbook = XLSX.utils.book_new();
    
    // Set column widths
    const colWidths = [
      { wch: 12 }, // Bill ID
      { wch: 20 }, // Customer Name
      { wch: 15 }, // Phone
      { wch: 12 }, // Bill Date
      { wch: 12 }, // Total Amount
      { wch: 12 }, // Paid Amount
      { wch: 12 }, // Balance
      { wch: 15 }, // Payment Status
      { wch: 30 }  // Work Items Summary
    ];
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Bills');

    // Generate test file
    const filename = `test_export_${Date.now()}.xlsx`;
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, filename);

    console.log('Excel export test successful!');
    return true;
  } catch (error) {
    console.error('Excel export test failed:', error);
    return false;
  }
};
