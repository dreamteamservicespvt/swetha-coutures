import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, RefreshCw, Calendar, ArrowRight } from 'lucide-react';
import { checkDateFormats, fixDateFormats } from '@/utils/fixDateFormats';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface DateCheckResult {
  total: number;
  needsFix: number;
  correct: number;
  bills: Array<{
    id: string;
    billId: string;
    createdAtType: string;
    dateType: string;
    dueDateType: string;
    needsFix: boolean;
    createdAtRaw?: any;
    dateRaw?: any;
    dueDateRaw?: any;
  }>;
}

interface FixResult {
  success: number;
  failed: number;
  skipped: number;
  details: Array<{
    id: string;
    billId: string;
    action: 'fixed' | 'skipped' | 'failed';
    reason?: string;
  }>;
}

export default function DateFormatFixer() {
  const [loading, setLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<DateCheckResult | null>(null);
  const [fixResult, setFixResult] = useState<FixResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCheck = async () => {
    setLoading(true);
    try {
      const result = await checkDateFormats();
      setCheckResult(result);
      toast({
        title: 'Check Complete',
        description: `Found ${result.needsFix} bills with incorrect date format`,
      });
    } catch (error) {
      toast({
        title: 'Check Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async () => {
    if (!confirm('⚠️ This will convert date formats for all affected bills. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      const result = await fixDateFormats();
      setFixResult(result);
      
      toast({
        title: 'Date Formats Fixed!',
        description: `Successfully fixed ${result.success} bills`,
      });

      // Refresh check after fix
      setTimeout(() => {
        handleCheck();
      }, 1000);
    } catch (error) {
      toast({
        title: 'Fix Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoToMigration = () => {
    navigate('/billing-migration');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Date Format Fixer</h1>
        <p className="text-muted-foreground">
          Fix bills with incorrect date storage format (Map → Firebase Timestamp)
        </p>
      </div>

      {/* Step 1: Check Date Formats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Step 1: Check Date Formats
          </CardTitle>
          <CardDescription>
            Identify bills with dates stored as maps instead of Firebase Timestamps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleCheck} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              'Check All Bills'
            )}
          </Button>

          {checkResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Bills</p>
                  <p className="text-2xl font-bold">{checkResult.total}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Need Fix</p>
                  <p className="text-2xl font-bold text-orange-600">{checkResult.needsFix}</p>
                  <p className="text-xs text-muted-foreground">Bills 75-95+</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Correct Format</p>
                  <p className="text-2xl font-bold text-green-600">{checkResult.correct}</p>
                  <p className="text-xs text-muted-foreground">Bills 1-74</p>
                </div>
              </div>

              {checkResult.needsFix > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Issue Found:</strong> {checkResult.needsFix} bills have dates stored as plain objects (Maps) instead of Firebase Timestamps.
                    This will cause sorting issues in migration.
                  </AlertDescription>
                </Alert>
              )}

              {/* Bill List with Preview */}
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                <h4 className="font-semibold mb-2">Bills Needing Fix:</h4>
                <div className="space-y-2">
                  {checkResult.bills
                    .filter(bill => bill.needsFix)
                    .map((bill) => (
                      <div key={bill.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive">
                              {bill.billId}
                            </Badge>
                            <span className="text-xs text-orange-600">Needs Fix</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedBill(selectedBill === bill.id ? null : bill.id)}
                          >
                            {selectedBill === bill.id ? 'Hide Preview' : 'Show Preview'}
                          </Button>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>• createdAt: {bill.createdAtType}</div>
                          <div>• date: {bill.dateType}</div>
                          <div>• dueDate: {bill.dueDateType}</div>
                        </div>

                        {/* Preview Section */}
                        {selectedBill === bill.id && (
                          <div className="mt-3 p-3 bg-muted rounded-md space-y-3 text-xs">
                            <div className="font-semibold text-sm">Before → After Preview:</div>
                            
                            {/* createdAt Preview */}
                            {bill.createdAtType.includes('❌') && (
                              <div className="space-y-1">
                                <div className="font-medium">createdAt:</div>
                                <div className="pl-2 space-y-1">
                                  <div className="text-red-600">
                                    ❌ Before (Map):
                                    <pre className="mt-1 p-2 bg-red-50 rounded text-xs overflow-x-auto">
                                      {JSON.stringify(bill.createdAtRaw, null, 2)}
                                    </pre>
                                  </div>
                                  <div className="text-green-600">
                                    ✅ After (Timestamp):
                                    <div className="mt-1 p-2 bg-green-50 rounded">
                                      {bill.createdAtRaw?.seconds 
                                        ? new Date(bill.createdAtRaw.seconds * 1000).toLocaleString()
                                        : 'Will convert to Timestamp'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* date Preview */}
                            {bill.dateType.includes('❌') && (
                              <div className="space-y-1">
                                <div className="font-medium">date:</div>
                                <div className="pl-2 space-y-1">
                                  <div className="text-red-600">
                                    ❌ Before (Map):
                                    <pre className="mt-1 p-2 bg-red-50 rounded text-xs overflow-x-auto">
                                      {JSON.stringify(bill.dateRaw, null, 2)}
                                    </pre>
                                  </div>
                                  <div className="text-green-600">
                                    ✅ After (Timestamp):
                                    <div className="mt-1 p-2 bg-green-50 rounded">
                                      {bill.dateRaw?.seconds 
                                        ? new Date(bill.dateRaw.seconds * 1000).toLocaleString()
                                        : 'Will convert to Timestamp'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* dueDate Preview */}
                            {bill.dueDateRaw && bill.dueDateType.includes('❌') && (
                              <div className="space-y-1">
                                <div className="font-medium">dueDate:</div>
                                <div className="pl-2 space-y-1">
                                  <div className="text-red-600">
                                    ❌ Before (Map):
                                    <pre className="mt-1 p-2 bg-red-50 rounded text-xs overflow-x-auto">
                                      {JSON.stringify(bill.dueDateRaw, null, 2)}
                                    </pre>
                                  </div>
                                  <div className="text-green-600">
                                    ✅ After (Timestamp):
                                    <div className="mt-1 p-2 bg-green-50 rounded">
                                      {bill.dueDateRaw?.seconds 
                                        ? new Date(bill.dueDateRaw.seconds * 1000).toLocaleString()
                                        : 'Will convert to Timestamp'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                <strong>Note:</strong> The actual date/time values remain the same. 
                                Only the storage format changes from Map to Firebase Timestamp.
                              </AlertDescription>
                            </Alert>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Preview Changes */}
      {checkResult && checkResult.needsFix > 0 && !showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Step 2: Preview Changes
            </CardTitle>
            <CardDescription>
              See what will be changed before applying fixes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Click below to see a detailed preview of all the changes that will be made.
                You can review each bill individually above by clicking "Show Preview".
              </AlertDescription>
            </Alert>

            <Button onClick={() => setShowPreview(true)} variant="outline" size="lg">
              Preview All Changes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Fix Date Formats */}
      {checkResult && checkResult.needsFix > 0 && showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Step 3: Apply Fixes
            </CardTitle>
            <CardDescription>
              Convert plain date objects to Firebase Timestamps
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>What this does:</strong>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>Converts date Maps to Firebase Timestamps</li>
                  <li>Fixes createdAt, date, and dueDate fields</li>
                  <li>Preserves the original date/time values</li>
                  <li>Makes dates sortable for migration</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Summary of what will be fixed */}
            <div className="border rounded-lg p-4 bg-muted">
              <h4 className="font-semibold mb-3">Preview Summary:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Bills to fix:</span>
                  <Badge variant="destructive">{checkResult.needsFix}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Fields per bill:</span>
                  <span className="text-muted-foreground">createdAt, date, dueDate</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Date values preserved:</span>
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span>Format after fix:</span>
                  <span className="text-green-600">Firebase Timestamp ✅</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleFix} disabled={loading} variant="default">
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  `Fix ${checkResult.needsFix} Bills Now`
                )}
              </Button>
              <Button onClick={() => setShowPreview(false)} variant="outline" disabled={loading}>
                Cancel
              </Button>
            </div>

            {fixResult && (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Fix Complete!</strong>
                    <ul className="mt-2 list-disc list-inside">
                      <li className="text-green-600">Successfully fixed: {fixResult.success} bills</li>
                      <li className="text-gray-600">Skipped (already correct): {fixResult.skipped} bills</li>
                      {fixResult.failed > 0 && (
                        <li className="text-red-600">Failed: {fixResult.failed} bills</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>

                {/* Details */}
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                  <h4 className="font-semibold mb-2">Fix Details:</h4>
                  <div className="space-y-2">
                    {fixResult.details
                      .filter(d => d.action === 'fixed')
                      .map((detail) => (
                        <div key={detail.id} className="text-sm py-2 border-b">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <Badge variant="default">{detail.billId}</Badge>
                            <span className="text-xs text-muted-foreground">{detail.reason}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Go to Migration */}
      {fixResult && fixResult.success > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Step 4: Run Bill Migration
            </CardTitle>
            <CardDescription>
              Now that dates are fixed, you can run the bill migration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                ✅ Date formats are now correct! You can proceed to the Bill Migration page to assign sequential bill numbers based on dates.
              </AlertDescription>
            </Alert>

            <Button onClick={handleGoToMigration} variant="default" size="lg">
              Go to Bill Migration →
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
