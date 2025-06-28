
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Settings as SettingsIcon, User, Building, Bell, Shield, Palette, Database } from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

interface BusinessSettings {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;
  businessLogo?: string;
  taxNumber?: string;
  // Payment Settings
  bankDetails: {
    accountName: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
  };
  upiId: string;
  businessHours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
}

interface NotificationSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  orderUpdates: boolean;
  appointmentReminders: boolean;
  lowStockAlerts: boolean;
  paymentReminders: boolean;
}

const Settings = () => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>({
    businessName: '',
    businessAddress: '',
    businessPhone: '',
    businessEmail: '',
    businessLogo: '',
    taxNumber: '',
    // Payment Settings
    bankDetails: {
      accountName: 'Swetha\'s Couture',
      accountNumber: '1234567890',
      ifsc: 'HDFC0001234',
      bankName: 'HDFC Bank'
    },
    upiId: 'swethascouture@paytm',
    businessHours: {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '09:00', close: '18:00', closed: false },
      sunday: { open: '09:00', close: '18:00', closed: true }
    }
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    smsNotifications: true,
    orderUpdates: true,
    appointmentReminders: true,
    lowStockAlerts: true,
    paymentReminders: true
  });

  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    phone: '',
    role: ''
  });

  useEffect(() => {
    if (!userData) {
      setLoading(false);
      return;
    }
    
    loadSettings();
  }, [userData]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Load user profile
      setUserProfile({
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        role: userData.role || ''
      });

      // Try to load business settings from Firestore
      try {
        const businessDoc = await getDoc(doc(db, 'settings', 'business'));
        if (businessDoc.exists()) {
          setBusinessSettings({ ...businessSettings, ...businessDoc.data() });
        }
      } catch (error) {
        console.log('No business settings found, using defaults');
      }

      // Try to load notification settings from Firestore
      try {
        const notificationDoc = await getDoc(doc(db, 'settings', 'notifications'));
        if (notificationDoc.exists()) {
          setNotificationSettings({ ...notificationSettings, ...notificationDoc.data() });
        }
      } catch (error) {
        console.log('No notification settings found, using defaults');
      }

    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveBusinessSettings = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, 'settings', 'business'), businessSettings);
      toast({
        title: "Success",
        description: "Business settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving business settings:', error);
      toast({
        title: "Error",
        description: "Failed to save business settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveNotificationSettings = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, 'settings', 'notifications'), notificationSettings);
      toast({
        title: "Success",
        description: "Notification settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast({
        title: "Error",
        description: "Failed to save notification settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateBusinessHours = (day: string, field: string, value: string | boolean) => {
    setBusinessSettings({
      ...businessSettings,
      businessHours: {
        ...businessSettings.businessHours,
        [day]: {
          ...businessSettings.businessHours[day as keyof typeof businessSettings.businessHours],
          [field]: value
        }
      }
    });
  };

  if (!userData) {
    return <LoadingSpinner type="page" />;
  }

  if (loading) {
    return <LoadingSpinner type="page" />;
  }

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your business settings and preferences</p>
      </div>

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="grid grid-cols-4 lg:w-[400px]">
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* Business Settings */}
        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="h-5 w-5" />
                <span>Business Information</span>
              </CardTitle>
              <CardDescription>
                Configure your business details and operating hours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={businessSettings.businessName}
                    onChange={(e) => setBusinessSettings({...businessSettings, businessName: e.target.value})}
                    placeholder="Enter business name"
                  />
                </div>
                <div>
                  <Label htmlFor="businessPhone">Business Phone</Label>
                  <Input
                    id="businessPhone"
                    value={businessSettings.businessPhone}
                    onChange={(e) => setBusinessSettings({...businessSettings, businessPhone: e.target.value})}
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessEmail">Business Email</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    value={businessSettings.businessEmail}
                    onChange={(e) => setBusinessSettings({...businessSettings, businessEmail: e.target.value})}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="taxNumber">Tax Number (Optional)</Label>
                  <Input
                    id="taxNumber"
                    value={businessSettings.taxNumber || ''}
                    onChange={(e) => setBusinessSettings({...businessSettings, taxNumber: e.target.value})}
                    placeholder="Enter tax number"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="businessAddress">Business Address</Label>
                <Textarea
                  id="businessAddress"
                  value={businessSettings.businessAddress}
                  onChange={(e) => setBusinessSettings({...businessSettings, businessAddress: e.target.value})}
                  placeholder="Enter complete business address"
                  rows={3}
                />
              </div>

              <Separator />

              {/* Payment Settings */}
              <div>
                <h3 className="text-lg font-medium mb-4">Payment Settings</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="upiId">UPI ID</Label>
                    <Input
                      id="upiId"
                      value={businessSettings.upiId}
                      onChange={(e) => setBusinessSettings({...businessSettings, upiId: e.target.value})}
                      placeholder="Enter UPI ID (e.g., 9876543210@paytm)"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="accountName">Account Name</Label>
                      <Input
                        id="accountName"
                        value={businessSettings.bankDetails.accountName}
                        onChange={(e) => setBusinessSettings({
                          ...businessSettings,
                          bankDetails: { ...businessSettings.bankDetails, accountName: e.target.value }
                        })}
                        placeholder="Enter account holder name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        id="bankName"
                        value={businessSettings.bankDetails.bankName}
                        onChange={(e) => setBusinessSettings({
                          ...businessSettings,
                          bankDetails: { ...businessSettings.bankDetails, bankName: e.target.value }
                        })}
                        placeholder="Enter bank name"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="accountNumber">Account Number</Label>
                      <Input
                        id="accountNumber"
                        value={businessSettings.bankDetails.accountNumber}
                        onChange={(e) => setBusinessSettings({
                          ...businessSettings,
                          bankDetails: { ...businessSettings.bankDetails, accountNumber: e.target.value }
                        })}
                        placeholder="Enter account number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ifsc">IFSC Code</Label>
                      <Input
                        id="ifsc"
                        value={businessSettings.bankDetails.ifsc}
                        onChange={(e) => setBusinessSettings({
                          ...businessSettings,
                          bankDetails: { ...businessSettings.bankDetails, ifsc: e.target.value }
                        })}
                        placeholder="Enter IFSC code"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-medium mb-4">Business Hours</h3>
                <div className="space-y-3">
                  {days.map((day) => {
                    const daySettings = businessSettings.businessHours[day as keyof typeof businessSettings.businessHours];
                    return (
                      <div key={day} className="flex items-center space-x-4">
                        <div className="w-24">
                          <span className="text-sm font-medium capitalize">{day}</span>
                        </div>
                        <Switch
                          checked={!daySettings.closed}
                          onCheckedChange={(checked) => updateBusinessHours(day, 'closed', !checked)}
                        />
                        {!daySettings.closed && (
                          <>
                            <Input
                              type="time"
                              value={daySettings.open}
                              onChange={(e) => updateBusinessHours(day, 'open', e.target.value)}
                              className="w-32"
                            />
                            <span className="text-sm text-gray-500">to</span>
                            <Input
                              type="time"
                              value={daySettings.close}
                              onChange={(e) => updateBusinessHours(day, 'close', e.target.value)}
                              className="w-32"
                            />
                          </>
                        )}
                        {daySettings.closed && (
                          <span className="text-sm text-gray-500">Closed</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveBusinessSettings} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Business Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>User Profile</span>
              </CardTitle>
              <CardDescription>
                Manage your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="userName">Name</Label>
                  <Input
                    id="userName"
                    value={userProfile.name}
                    onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <Label htmlFor="userEmail">Email</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={userProfile.email}
                    onChange={(e) => setUserProfile({...userProfile, email: e.target.value})}
                    placeholder="Enter email address"
                    disabled
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="userPhone">Phone</Label>
                  <Input
                    id="userPhone"
                    value={userProfile.phone}
                    onChange={(e) => setUserProfile({...userProfile, phone: e.target.value})}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="userRole">Role</Label>
                  <Input
                    id="userRole"
                    value={userProfile.role}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button disabled>
                  Profile updates coming soon
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notification Preferences</span>
              </CardTitle>
              <CardDescription>
                Configure how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Email Notifications</h4>
                    <p className="text-sm text-gray-600">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={notificationSettings.emailNotifications}
                    onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, emailNotifications: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">SMS Notifications</h4>
                    <p className="text-sm text-gray-600">Receive notifications via SMS</p>
                  </div>
                  <Switch
                    checked={notificationSettings.smsNotifications}
                    onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, smsNotifications: checked})}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Order Updates</h4>
                    <p className="text-sm text-gray-600">Get notified about order status changes</p>
                  </div>
                  <Switch
                    checked={notificationSettings.orderUpdates}
                    onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, orderUpdates: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Appointment Reminders</h4>
                    <p className="text-sm text-gray-600">Receive reminders for upcoming appointments</p>
                  </div>
                  <Switch
                    checked={notificationSettings.appointmentReminders}
                    onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, appointmentReminders: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Low Stock Alerts</h4>
                    <p className="text-sm text-gray-600">Get alerted when inventory is running low</p>
                  </div>
                  <Switch
                    checked={notificationSettings.lowStockAlerts}
                    onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, lowStockAlerts: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Payment Reminders</h4>
                    <p className="text-sm text-gray-600">Send reminders for pending payments</p>
                  </div>
                  <Switch
                    checked={notificationSettings.paymentReminders}
                    onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, paymentReminders: checked})}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveNotificationSettings} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Notification Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Settings */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Advanced Settings</span>
              </CardTitle>
              <CardDescription>
                Advanced configuration options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-yellow-600" />
                  <h4 className="font-medium text-yellow-800">Data Management</h4>
                </div>
                <p className="text-sm text-yellow-700 mt-2">
                  Advanced data management features are coming soon. This will include data export, backup, and restore functionality.
                </p>
              </div>

              <div className="space-y-3">
                <Button variant="outline" disabled>
                  Export Data
                </Button>
                <Button variant="outline" disabled>
                  Backup Settings
                </Button>
                <Button variant="outline" disabled>
                  Reset to Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
