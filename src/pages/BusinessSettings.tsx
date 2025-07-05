import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BusinessSettings } from '@/utils/billingUtils';
import { Building, Phone, Mail, MapPin, FileText, Save, Upload } from 'lucide-react';
import { useBusinessSettings } from '@/components/BusinessSettingsProvider';

const BusinessSettingsPage = () => {
  const { settings: contextSettings, loading: contextLoading, refreshSettings } = useBusinessSettings();
  const [settings, setSettings] = useState<BusinessSettings>({
    businessName: '',
    businessPhone: '',
    businessEmail: '',
    businessAddress: '',
    taxNumber: '',
    logo: ''
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contextSettings) {
      setSettings(contextSettings);
    } else if (!contextLoading) {
      fetchSettings();
    }
  }, [contextSettings, contextLoading]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const settingsDoc = await getDoc(doc(db, 'settings', 'business'));
      
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data() as BusinessSettings);
      }
    } catch (error) {
      console.error('Error fetching business settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load business settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.businessName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Business name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await setDoc(doc(db, 'settings', 'business'), settings);
      
      // Refresh the context
      await refreshSettings();
      
      toast({
        title: 'Success',
        description: 'Business settings saved successfully',
      });
    } catch (error) {
      console.error('Error saving business settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save business settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Business Information Settings</h1>
      <p className="text-muted-foreground mb-8">
        These details will appear on all invoices, receipts, and business communications.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Company Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  name="businessName"
                  placeholder="Your Business Name"
                  value={settings.businessName}
                  onChange={handleChange}
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessPhone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="businessPhone"
                      name="businessPhone"
                      placeholder="+91 98765 43210"
                      value={settings.businessPhone}
                      onChange={handleChange}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="businessEmail">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="businessEmail"
                      name="businessEmail"
                      type="email"
                      placeholder="example@business.com"
                      value={settings.businessEmail}
                      onChange={handleChange}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="businessAddress">Business Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    id="businessAddress"
                    name="businessAddress"
                    placeholder="Enter your complete business address"
                    value={settings.businessAddress}
                    onChange={handleChange}
                    className="pl-10 min-h-[100px]"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="taxNumber">Tax Number (GST/PAN)</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="taxNumber"
                    name="taxNumber"
                    placeholder="GST: 33AABCS1234Z1ZX"
                    value={settings.taxNumber}
                    onChange={handleChange}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  This will appear on all invoices.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Business Logo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="logo">Logo URL</Label>
                <Input
                  id="logo"
                  name="logo"
                  placeholder="https://example.com/logo.png"
                  value={settings.logo}
                  onChange={handleChange}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a URL for your business logo. Recommended size: 150x80 pixels.
                </p>
              </div>
              
              {settings.logo && (
                <div className="mt-4 border rounded-md p-4 text-center">
                  <p className="text-sm mb-2">Logo Preview:</p>
                  <img 
                    src={settings.logo} 
                    alt="Business Logo" 
                    className="max-h-20 mx-auto"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/150x80?text=Logo+Error';
                      toast({
                        title: 'Logo Error',
                        description: 'Could not load logo from provided URL',
                        variant: 'destructive',
                      });
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => fetchSettings()}
              disabled={loading || saving}
            >
              Reset
            </Button>
            <Button 
              onClick={handleSave}
              disabled={loading || saving}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessSettingsPage;
