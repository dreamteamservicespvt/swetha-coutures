import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, RefreshCw, FileText, ArrowRight } from 'lucide-react';
import { diagnoseBills, getMigrationPreview, executeMigration } from '@/utils/billMigration';
import { toast } from '@/hooks/use-toast';

interface DiagnosisResult {
  total: number;
  bills: Array<{ id: string; billId: string; billNumber: number | null; customer: string; date: any }>;
  duplicates: string[];
  formats: {
    correct: number;
    hash: number;
    timestamp: number;
    missing: number;
  };
}

interface MigrationResult {
  success: number;
  failed: number;
  changes: Array<{ id: string; oldBillId: string; newBillId: string; billNumber: number; date: any }>;
}

export default function BillMigrationPanel() {
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [migrationPreview, setMigrationPreview] = useState<MigrationResult | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  const handleDiagnose = async () => {
    setLoading(true);
    try {
      const result = await diagnoseBills();
      setDiagnosis(result);
      toast({
        title: 'Diagnosis Complete',
        description: `Found ${result.total} bills in database`,
      });
    } catch (error) {
      toast({
        title: 'Diagnosis Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const result = await getMigrationPreview();
      setMigrationPreview(result);
      toast({
        title: 'Migration Preview Ready',
        description: `Will update ${result.changes.length} bills`,
      });
    } catch (error) {
      toast({
        title: 'Preview Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (!confirm('⚠️ This will update all bill IDs in the database. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      const result = await executeMigration();
      setMigrationResult(result);
      toast({
        title: 'Migration Complete!',
        description: `Successfully updated ${result.success} bills`,
      });
      
      // Refresh diagnosis
      setTimeout(() => {
        handleDiagnose();
      }, 1000);
    } catch (error) {
      toast({
        title: 'Migration Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Bill Migration Tool</h1>
        <p className="text-muted-foreground">
          Fix existing bills to use the new Bill001 format
        </p>
      </div>

      {/* Step 1: Diagnose */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Step 1: Diagnose Current State
          </CardTitle>
          <CardDescription>
            Check what bill IDs currently exist in the database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleDiagnose} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              'Run Diagnosis'
            )}
          </Button>

          {diagnosis && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Found {diagnosis.total} bills in database
                </AlertDescription>
              </Alert>

              {/* Format Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Correct Format</p>
                  <p className="text-2xl font-bold text-green-600">{diagnosis.formats.correct}</p>
                  <p className="text-xs text-muted-foreground">Bill001, Bill002...</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Hash Format</p>
                  <p className="text-2xl font-bold text-yellow-600">{diagnosis.formats.hash}</p>
                  <p className="text-xs text-muted-foreground">#101, #102...</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Timestamp Format</p>
                  <p className="text-2xl font-bold text-orange-600">{diagnosis.formats.timestamp}</p>
                  <p className="text-xs text-muted-foreground">BILL215896...</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Missing/Invalid</p>
                  <p className="text-2xl font-bold text-red-600">{diagnosis.formats.missing}</p>
                  <p className="text-xs text-muted-foreground">Blank or invalid</p>
                </div>
              </div>

              {/* Duplicates Warning */}
              {diagnosis.duplicates.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Duplicates Found:</strong> {diagnosis.duplicates.length} bill ID(s) appear multiple times
                    <ul className="mt-2 list-disc list-inside">
                      {diagnosis.duplicates.map(billId => (
                        <li key={billId}>{billId}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Bill List */}
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                <h4 className="font-semibold mb-2">All Bills (Ordered by Date - Oldest First):</h4>
                <div className="space-y-2">
                  {diagnosis.bills.map((bill, index) => (
                    <div key={bill.id} className="flex items-center justify-between text-sm py-2 border-b">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">#{index + 1}</span>
                        <Badge variant={
                          /^Bill\d{3,}$/.test(bill.billId) ? 'default' :
                          bill.billId.startsWith('#') ? 'secondary' :
                          'destructive'
                        }>
                          {bill.billId}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          billNumber: {bill.billNumber ?? 'N/A'}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {bill.date?.toDate ? new Date(bill.date.toDate()).toLocaleDateString() : 
                           bill.date ? new Date(bill.date).toLocaleDateString() : 'No date'}
                        </span>
                      </div>
                      <span className="text-muted-foreground">{bill.customer}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Preview Migration */}
      {diagnosis && diagnosis.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Step 2: Preview Migration
            </CardTitle>
            <CardDescription>
              See what will change before applying updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handlePreview} disabled={loading} variant="outline">
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Preview Changes'
              )}
            </Button>

            {migrationPreview && (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Will update {migrationPreview.changes.length} bills
                  </AlertDescription>
                </Alert>

                <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                  <h4 className="font-semibold mb-2">Migration Plan (Oldest → Lowest Number):</h4>
                  <div className="space-y-2">
                    {migrationPreview.changes.map((change, index) => (
                      <div key={change.id} className="flex items-center justify-between text-sm py-2 border-b">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">#{index + 1}</span>
                          <Badge variant="secondary">{change.oldBillId}</Badge>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <Badge variant="default">{change.newBillId}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {change.date?.toDate ? new Date(change.date.toDate()).toLocaleDateString() : 
                             change.date ? new Date(change.date).toLocaleDateString() : 'No date'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          billNumber: {change.billNumber}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Execute Migration */}
      {migrationPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Step 3: Execute Migration
            </CardTitle>
            <CardDescription>
              Apply the changes to your database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This will permanently update bill IDs in the database.
                Make sure you've reviewed the preview above.
              </AlertDescription>
            </Alert>

            <Button onClick={handleMigrate} disabled={loading} variant="destructive">
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Migrating...
                </>
              ) : (
                'Execute Migration'
              )}
            </Button>

            {migrationResult && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>Migration Complete!</strong>
                  <ul className="mt-2 list-disc list-inside">
                    <li>Successfully updated: {migrationResult.success} bills</li>
                    {migrationResult.failed > 0 && (
                      <li className="text-red-600">Failed: {migrationResult.failed} bills</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
