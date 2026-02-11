import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, RefreshCw, FileWarning } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  diagnoseDuplicateBills,
  fixDuplicateBills,
  getAllBillsInfo,
  DuplicateBillInfo,
  FixResult
} from '@/utils/fixDuplicateBills';

const DuplicateBillFixer = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateBillInfo[]>([]);
  const [fixResults, setFixResults] = useState<FixResult[]>([]);
  const [allBills, setAllBills] = useState<Array<{
    id: string;
    billId: string;
    billNumber?: number;
    customerName: string;
    date: any;
  }>>([]);
  const [step, setStep] = useState<'initial' | 'diagnosed' | 'fixed'>('initial');

  const handleDiagnose = async () => {
    setDiagnosing(true);
    try {
      const duplicatesList = await diagnoseDuplicateBills();
      setDuplicates(duplicatesList);
      setStep('diagnosed');
      
      if (duplicatesList.length === 0) {
        toast({
          title: "✅ No Issues Found",
          description: "No duplicate Bill096 entries found in the system",
        });
      } else {
        toast({
          title: "⚠️ Issues Found",
          description: `Found ${duplicatesList.length} duplicate Bill096 ${duplicatesList.length === 1 ? 'entry' : 'entries'}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error diagnosing:', error);
      toast({
        title: "Error",
        description: "Failed to diagnose duplicate bills",
        variant: "destructive"
      });
    } finally {
      setDiagnosing(false);
    }
  };

  const handleFix = async () => {
    setFixing(true);
    try {
      const results = await fixDuplicateBills();
      setFixResults(results);
      setStep('fixed');
      
      toast({
        title: "✅ Success",
        description: `Successfully fixed ${results.length} duplicate ${results.length === 1 ? 'bill' : 'bills'}`,
      });
      
      // Refresh bill list
      await handleVerify();
    } catch (error) {
      console.error('Error fixing:', error);
      toast({
        title: "Error",
        description: "Failed to fix duplicate bills",
        variant: "destructive"
      });
    } finally {
      setFixing(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      const bills = await getAllBillsInfo();
      setAllBills(bills);
      
      toast({
        title: "✅ Verified",
        description: `Loaded ${bills.length} bills successfully`,
      });
    } catch (error) {
      console.error('Error verifying:', error);
      toast({
        title: "Error",
        description: "Failed to load bills for verification",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: any): string => {
    if (!date) return 'N/A';
    
    if (date.seconds) {
      return new Date(date.seconds * 1000).toLocaleDateString();
    }
    
    if (date instanceof Date) {
      return date.toLocaleDateString();
    }
    
    return 'N/A';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                🔧 Duplicate Bill Fixer
              </h1>
              <p className="text-purple-100">
                Diagnose and fix duplicate Bill096 entries
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/billing')}
              className="bg-white text-purple-600 hover:bg-purple-50"
            >
              Back to Billing
            </Button>
          </div>
        </div>

        {/* Process Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-orange-500" />
              Fix Process
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Step 1: Diagnose */}
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  step === 'initial' ? 'bg-purple-600 text-white' : 
                  step === 'diagnosed' || step === 'fixed' ? 'bg-green-500 text-white' : 
                  'bg-gray-300 text-gray-600 dark:text-gray-400'
                }`}>
                  1
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">Step 1: Diagnose Issues</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Scan the database to find all bills with duplicate Bill096 ID
                  </p>
                  <Button 
                    onClick={handleDiagnose} 
                    disabled={diagnosing || step !== 'initial'}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {diagnosing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Diagnosing...
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Run Diagnosis
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Diagnosis Results */}
              {step !== 'initial' && duplicates.length > 0 && (
                <Card className="bg-orange-50 border-orange-200">
                  <CardHeader>
                    <CardTitle className="text-orange-800 text-base">
                      Found {duplicates.length} Duplicate Bill096 {duplicates.length === 1 ? 'Entry' : 'Entries'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {duplicates.map((bill, index) => (
                        <div key={bill.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <div>
                            <p className="font-semibold">{bill.billId}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{bill.customerName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Date: {formatDate(bill.date)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Bill #{bill.billNumber || 'N/A'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Fix */}
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  step === 'diagnosed' ? 'bg-purple-600 text-white' : 
                  step === 'fixed' ? 'bg-green-500 text-white' : 
                  'bg-gray-300 text-gray-600 dark:text-gray-400'
                }`}>
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">Step 2: Fix Duplicates</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Reassign sequential bill numbers to all duplicate entries based on their date
                  </p>
                  <Button 
                    onClick={handleFix} 
                    disabled={fixing || step !== 'diagnosed' || duplicates.length === 0}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {fixing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Fixing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Fix Duplicates
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Fix Results */}
              {step === 'fixed' && fixResults.length > 0 && (
                <Card className="bg-green-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="text-green-800 text-base">
                      ✅ Successfully Fixed {fixResults.length} {fixResults.length === 1 ? 'Bill' : 'Bills'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {fixResults.map((result, index) => (
                        <div key={result.docId} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                          <div>
                            <p className="font-semibold text-green-700">{result.newBillId}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{result.customerName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              <span className="line-through text-red-500">{result.oldBillId}</span>
                              {' → '}
                              <span className="text-green-600">{result.newBillId}</span>
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Bill #{result.newBillNumber}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Verify */}
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  step === 'fixed' ? 'bg-purple-600 text-white' : 
                  'bg-gray-300 text-gray-600 dark:text-gray-400'
                }`}>
                  3
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">Step 3: Verify Results</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Check all bills to ensure proper numbering
                  </p>
                  <Button 
                    onClick={handleVerify} 
                    disabled={loading || step !== 'fixed'}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Verify All Bills
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Verification Results */}
              {allBills.length > 0 && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-blue-800 text-base">
                      All Bills ({allBills.length} total)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {allBills.map((bill, index) => (
                        <div key={bill.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <div>
                            <p className="font-semibold">{bill.billId}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{bill.customerName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Date: {formatDate(bill.date)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Bill #{bill.billNumber || 'N/A'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-purple-50 border-purple-200">
          <CardHeader>
            <CardTitle className="text-purple-800 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-purple-600">•</span>
                <span><strong>Step 1:</strong> Scans all bills to find entries with "Bill096" ID</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600">•</span>
                <span><strong>Step 2:</strong> Finds the highest existing bill number and continues from there</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600">•</span>
                <span><strong>Step 3:</strong> Assigns sequential numbers (Bill097, Bill098, etc.) based on bill date (oldest first)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600">•</span>
                <span><strong>Step 4:</strong> Updates both billId and billNumber fields in the database</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600">•</span>
                <span><strong>Safe:</strong> Only fixes duplicate Bill096 entries, leaves other bills unchanged</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DuplicateBillFixer;
