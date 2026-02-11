import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessSettings } from '@/components/BusinessSettingsProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, 
  Database, 
  Users, 
  Activity, 
  Bell, 
  Settings, 
  Download, 
  Upload,
  Monitor,
  Clock,
  HardDrive,
  Wifi,
  AlertTriangle,
  CheckCircle,
  Lock,
  Key
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalOrders: number;
  systemRevenue: number;
  storageUsed: number;
  databaseSize: number;
  systemUptime: string;
}

interface BackupRecord {
  id: string;
  date: string;
  type: 'full' | 'orders' | 'inventory' | 'customers';
  size: number;
  status: 'completed' | 'failed' | 'in-progress';
}

interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  isActive: boolean;
  lastLogin?: Date;
  totalLogins: number;
  lastIP?: string;
}

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout';
  module: string;
  details: string;
  timestamp: Date;
  ipAddress?: string;
  beforeData?: any;
  afterData?: any;
}

interface SystemSettings {
  systemName: string;
  adminEmail: string;
  primaryPhone: string;
  businessLocation: string;
  enabledModules: {
    expenses: boolean;
    inventory: boolean;
    appointments: boolean;
    alterations: boolean;
    reports: boolean;
  };
  dateFormat: string;
  currency: string;
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
}

const AdminControlPanel = () => {
  const { userData } = useAuth();
  const { settings: businessSettings } = useBusinessSettings();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('metrics');
  
  // State for different sections
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalUsers: 0,
    activeUsers: 0,
    totalOrders: 0,
    systemRevenue: 0,
    storageUsed: 0,
    databaseSize: 0,
    systemUptime: '0 days'
  });

  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    systemName: businessSettings?.businessName || "Business Management System",
    adminEmail: businessSettings?.businessEmail || 'admin@business.com',
    primaryPhone: businessSettings?.businessPhone || '+91 9876543210',
    businessLocation: businessSettings?.businessAddress?.split('\n').slice(-1)[0] || 'Business Location',
    enabledModules: {
      expenses: true,
      inventory: true,
      appointments: true,
      alterations: true,
      reports: true
    },
    dateFormat: 'DD/MM/YYYY',
    currency: 'INR',
    autoBackup: true,
    backupFrequency: 'daily'
  });

  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupInProgress, setBackupInProgress] = useState(false);

  useEffect(() => {
    if (userData?.role === 'admin') {
      fetchControlPanelData();
    } else {
      setLoading(false);
    }
  }, [userData]);

  const fetchControlPanelData = async () => {
    try {
      setLoading(true);
      
      // Fetch real metrics from Firebase
      const [ordersSnapshot, usersSnapshot, inventorySnapshot] = await Promise.all([
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'inventory'))
      ]);

      const orders = ordersSnapshot.docs.map(doc => doc.data());
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Array<{
        id: string;
        name?: string;
        email?: string;
        role?: string;
        isActive?: boolean;
        lastLogin?: any;
        totalLogins?: number;
        lastIP?: string;
      }>;

      const totalRevenue = orders
        .filter(order => order.status === 'completed')
        .reduce((sum, order) => sum + (order.totalAmount || 0), 0);

      const activeUsers = usersData.filter(user => {
        if (user.lastLogin) {
          const lastLogin = user.lastLogin.seconds ? 
            new Date(user.lastLogin.seconds * 1000) : 
            new Date(user.lastLogin);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return lastLogin > weekAgo;
        }
        return false;
      }).length;

      setMetrics({
        totalUsers: usersData.length,
        activeUsers,
        totalOrders: orders.length,
        systemRevenue: totalRevenue,
        storageUsed: Math.random() * 500 + 100, // Mock storage
        databaseSize: Math.random() * 50 + 20, // Mock DB size
        systemUptime: `${Math.floor(Math.random() * 30) + 1} days`
      });

      // Set users data with proper type handling
      setUsers(usersData.map(user => ({
        id: user.id,
        name: user.name || 'Unknown',
        email: user.email || '',
        role: (user.role as 'admin' | 'staff') || 'staff',
        isActive: user.isActive !== false,
        lastLogin: user.lastLogin ? (
          user.lastLogin.seconds ? 
            new Date(user.lastLogin.seconds * 1000) : 
            new Date(user.lastLogin)
        ) : undefined,
        totalLogins: user.totalLogins || 0,
        lastIP: user.lastIP || '192.168.1.1'
      })));

      // Mock backup records
      setBackups([
        {
          id: '1',
          date: new Date().toISOString(),
          type: 'full',
          size: 245.6,
          status: 'completed'
        },
        {
          id: '2',
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          type: 'orders',
          size: 89.2,
          status: 'completed'
        }
      ]);

      // Mock activity logs
      setActivityLogs([
        {
          id: '1',
          userId: userData?.uid || '',
          userName: userData?.name || '',
          action: 'login',
          module: 'Authentication',
          details: 'Admin logged into control panel',
          timestamp: new Date(),
          ipAddress: '192.168.1.1'
        },
        {
          id: '2',
          userId: userData?.uid || '',
          userName: userData?.name || '',
          action: 'create',
          module: 'Orders',
          details: 'Created new order #12345',
          timestamp: new Date(Date.now() - 3600000),
          ipAddress: '192.168.1.1'
        }
      ]);

    } catch (error) {
      console.error('Error fetching control panel data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch control panel data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async (type: string) => {
    try {
      setBackupInProgress(true);
      
      // Simulate backup process
      toast({
        title: "Backup Started",
        description: `Creating ${type} backup...`,
      });

      // Mock backup creation with delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      const newBackup: BackupRecord = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        type: type as any,
        size: Math.random() * 200 + 50,
        status: 'completed'
      };

      setBackups(prev => [newBackup, ...prev]);
      
      toast({
        title: "Backup Complete",
        description: `${type} backup created successfully`,
      });
      
      setIsBackupModalOpen(false);
    } catch (error) {
      console.error('Error creating backup:', error);
      toast({
        title: "Backup Failed",
        description: "Failed to create backup",
        variant: "destructive",
      });
    } finally {
      setBackupInProgress(false);
    }
  };

  const updateSystemSettings = async () => {
    try {
      // In a real app, this would save to Firebase
      toast({
        title: "Settings Updated",
        description: "System settings saved successfully",
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    }
  };

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      setUsers(prev => 
        prev.map(user => 
          user.id === userId ? { ...user, isActive } : user
        )
      );
      
      toast({
        title: "User Updated",
        description: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const resetUserPassword = async (userId: string, email: string) => {
    if (window.confirm(`Reset password for ${email}?`)) {
      try {
        // In a real app, this would use Firebase Auth password reset
        toast({
          title: "Password Reset",
          description: `Password reset email sent to ${email}`,
        });
      } catch (error) {
        console.error('Error resetting password:', error);
        toast({
          title: "Error",
          description: "Failed to reset password",
          variant: "destructive",
        });
      }
    }
  };

  if (userData?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Admin Access Required</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Only system administrators can access the control panel.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Control Panel</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
            <Shield className="h-8 w-8 text-purple-600" />
            <span>System Control Panel</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Real-time system monitoring and administration</p>
        </div>
        <div className="flex space-x-3">
          <Dialog open={isBackupModalOpen} onOpenChange={setIsBackupModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Create Backup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create System Backup</DialogTitle>
                <DialogDescription>
                  Select the type of backup you want to create.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => createBackup('full')}
                    disabled={backupInProgress}
                  >
                    Full Backup
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => createBackup('orders')}
                    disabled={backupInProgress}
                  >
                    Orders Only
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => createBackup('inventory')}
                    disabled={backupInProgress}
                  >
                    Inventory Only
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => createBackup('customers')}
                    disabled={backupInProgress}
                  >
                    Customers Only
                  </Button>
                </div>
                {backupInProgress && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="text-sm text-gray-600 mt-2">Creating backup...</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* System Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.totalUsers}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">System users</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Users</CardTitle>
            <Activity className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.activeUsers}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Last 7 days</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Orders</CardTitle>
            <Database className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.totalOrders}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">All time orders</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">System Revenue</CardTitle>
            <Monitor className="h-5 w-5 text-gold-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">₹{metrics.systemRevenue.toLocaleString()}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total revenue</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Storage Used</CardTitle>
            <HardDrive className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.storageUsed.toFixed(1)} MB</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Cloudinary storage</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Database Size</CardTitle>
            <Database className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.databaseSize.toFixed(1)} MB</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Firebase storage</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">System Uptime</CardTitle>
            <Clock className="h-5 w-5 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.systemUptime}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Continuous uptime</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">System Status</CardTitle>
            <Wifi className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-lg font-bold text-green-600">Healthy</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      {/* Control Panel Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="logs">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>System Health Monitor</CardTitle>
                <CardDescription>Real-time system performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Database Connection</span>
                  </div>
                  <Badge className="bg-green-100 text-green-700">Online</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Authentication Service</span>
                  </div>
                  <Badge className="bg-green-100 text-green-700">Active</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Cloud Storage</span>
                  </div>
                  <Badge className="bg-green-100 text-green-700">Connected</Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">API Response Time</span>
                  </div>
                  <span className="text-sm font-medium">245ms avg</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>System notifications and warnings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">Storage at 75%</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Consider upgrading storage plan</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                  <Bell className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">Backup completed</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Daily backup finished successfully</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">System updated</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">All modules are up to date</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="backups" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Backup Management</CardTitle>
              <CardDescription>Create, schedule, and manage system backups</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Auto Backup</Label>
                  <Switch 
                    checked={systemSettings.autoBackup}
                    onCheckedChange={(checked) => 
                      setSystemSettings(prev => ({ ...prev, autoBackup: checked }))
                    }
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Backup Frequency</Label>
                  <select
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={systemSettings.backupFrequency}
                    onChange={(e) => 
                      setSystemSettings(prev => ({ 
                        ...prev, 
                        backupFrequency: e.target.value as any 
                      }))
                    }
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label>Next Backup</Label>
                  <div className="p-2 bg-gray-50 rounded-md text-sm">
                    {new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Backup History</h3>
                <div className="space-y-3">
                  {backups.map((backup) => (
                    <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <Badge variant={backup.status === 'completed' ? 'default' : 'destructive'}>
                            {backup.status}
                          </Badge>
                          <span className="font-medium capitalize">{backup.type} Backup</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">{backup.size.toFixed(1)} MB</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {new Date(backup.date).toLocaleString()}
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                        <Button variant="outline" size="sm">
                          Restore
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage system users and their access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                        </div>
                        <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                          {user.role}
                        </Badge>
                        <Badge variant={user.isActive ? 'outline' : 'destructive'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 space-x-4">
                        {user.lastLogin && (
                          <span>Last login: {user.lastLogin.toLocaleDateString()}</span>
                        )}
                        <span>Total logins: {user.totalLogins}</span>
                        {user.lastIP && <span>IP: {user.lastIP}</span>}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Switch
                        checked={user.isActive}
                        onCheckedChange={(checked) => toggleUserStatus(user.id, checked)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resetUserPassword(user.id, user.email)}
                      >
                        <Key className="h-3 w-3 mr-1" />
                        Reset Password
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Configure system-wide settings and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="systemName">System Name</Label>
                    <Input
                      id="systemName"
                      value={systemSettings.systemName}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, systemName: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="adminEmail">Admin Email</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={systemSettings.adminEmail}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, adminEmail: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="primaryPhone">Primary Contact</Label>
                    <Input
                      id="primaryPhone"
                      value={systemSettings.primaryPhone}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, primaryPhone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="businessLocation">Business Location</Label>
                    <Input
                      id="businessLocation"
                      value={systemSettings.businessLocation}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, businessLocation: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <select
                      id="currency"
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={systemSettings.currency}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, currency: e.target.value }))}
                    >
                      <option value="INR">Indian Rupee (₹)</option>
                      <option value="USD">US Dollar ($)</option>
                      <option value="EUR">Euro (€)</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="dateFormat">Date Format</Label>
                    <select
                      id="dateFormat"
                      className="w-full p-2 border border-gray-300 rounded-md"
                      value={systemSettings.dateFormat}
                      onChange={(e) => setSystemSettings(prev => ({ ...prev, dateFormat: e.target.value }))}
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium">Module Settings</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(systemSettings.enabledModules).map(([module, enabled]) => (
                    <div key={module} className="flex items-center space-x-2">
                      <Switch
                        id={module}
                        checked={enabled}
                        onCheckedChange={(checked) =>
                          setSystemSettings(prev => ({
                            ...prev,
                            enabledModules: { ...prev.enabledModules, [module]: checked }
                          }))
                        }
                      />
                      <Label htmlFor={module} className="capitalize">{module}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={updateSystemSettings}>
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Security Center</CardTitle>
              <CardDescription>Monitor and configure system security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Session Management</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Active Sessions</span>
                      <Badge>3</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Failed Login Attempts (24h)</span>
                      <Badge variant="destructive">2</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Password Changes (30d)</span>
                      <Badge>1</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Security Settings</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Require 2FA for Admin</span>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Auto-lock after inactivity</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Email login notifications</span>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
              <CardDescription>System activity and audit trail</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <Badge variant={
                          log.action === 'login' ? 'outline' :
                          log.action === 'create' ? 'default' :
                          log.action === 'update' ? 'secondary' :
                          log.action === 'delete' ? 'destructive' : 'outline'
                        }>
                          {log.action}
                        </Badge>
                        <span className="font-medium">{log.module}</span>
                        <span className="text-gray-600 dark:text-gray-400">by {log.userName}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{log.details}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {log.timestamp.toLocaleString()} • IP: {log.ipAddress}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between items-center mt-6">
                <Button variant="outline">
                  Export Logs
                </Button>
                <Button variant="outline">
                  Load More
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminControlPanel;
