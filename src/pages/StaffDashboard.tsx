
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Phone,
  Calendar,
  Package,
  User,
  LogIn,
  LogOut,
  MapPin,
  DollarSign,
  TrendingUp,
  FileText,
  CheckSquare
} from 'lucide-react';
import { collection, getDocs, addDoc, query, where, serverTimestamp, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  assignedBy: string;
  dueDate: string;
  createdAt: any;
}

interface Attendance {
  id: string;
  staffId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: 'pending' | 'confirmed' | 'rejected';
  inLocation?: { lat: number; lng: number };
  outLocation?: { lat: number; lng: number };
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  salary: number;
  salaryAmount: number;
  salaryMode: 'monthly' | 'hourly' | 'daily';
  // New salary fields
  paidSalary?: number;
  bonus?: number;
  actualSalary?: number; // This will be calculated as paidSalary + bonus when both are provided
}

interface EarningsSummary {
  completedTasks: number;
  ratePerTask: number;
  totalEarnings: number;
  workingDays: number;
  baseRate: number;
  // New earning fields
  actualSalary: number;
  paidSalary: number;
  bonus: number;
  totalMonthlySalary: number; // paidSalary + bonus
}

const StaffDashboard = () => {
  const { userData } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedIn, setCheckedIn] = useState(false);
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(null);
  const [staffData, setStaffData] = useState<StaffMember | null>(null);
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary>({
    completedTasks: 0,
    ratePerTask: 0,
    totalEarnings: 0,
    workingDays: 0,
    baseRate: 0,
    actualSalary: 0,
    paidSalary: 0,
    bonus: 0,
    totalMonthlySalary: 0
  });
  const [assignedOrders, setAssignedOrders] = useState<any[]>([]);

  useEffect(() => {
    if (userData) {
      fetchStaffData();
      getCurrentLocation();
    }
  }, [userData]);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast({
            title: "Location Access",
            description: "Unable to get your location. Please enable location services.",
            variant: "destructive",
          });
        }
      );
    }
  };

  const fetchStaffData = async () => {
    try {
      // Fetch staff member details
      const staffDoc = await getDoc(doc(db, 'staff', userData?.uid || ''));
      if (staffDoc.exists()) {
        const staffInfo = { id: staffDoc.id, ...staffDoc.data() } as StaffMember;
        setStaffData(staffInfo);
      }

      // Fetch assigned tasks
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', userData?.uid),
        orderBy('createdAt', 'desc')
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasksData = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];

      // Fetch assigned orders (staff can only see their assigned orders)
      const ordersQuery = query(
        collection(db, 'orders'),
        where('assignedStaff', 'array-contains', userData?.uid)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAssignedOrders(ordersData);

      // Calculate earnings
      const completedTasks = tasksData.filter(task => task.status === 'completed').length;
      const completedOrders = ordersData.filter((order: any) => order.status === 'completed').length;
      const totalCompleted = completedTasks + completedOrders;
      
      let ratePerTask = 0;
      let baseRate = 0;
      
      if (staffData) {
        ratePerTask = staffData.salaryMode === 'monthly' ? (staffData.salaryAmount / 30) : 
                     staffData.salaryMode === 'daily' ? staffData.salaryAmount : 
                     staffData.salaryAmount; // hourly
        baseRate = staffData.salaryAmount;
      }

      // Count working days this month
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('staffId', '==', userData?.uid),
        where('status', '==', 'confirmed'),
        where('date', '>=', firstDay.toISOString().split('T')[0])
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const workingDays = attendanceSnapshot.size;

      // Calculate salary information
      const actualSalary = staffData?.salaryAmount || 0;
      const paidSalary = staffData?.paidSalary || 0;
      const bonus = staffData?.bonus || 0;
      const totalMonthlySalary = (paidSalary > 0 || bonus > 0) ? (paidSalary + bonus) : actualSalary;

      setEarningsSummary({
        completedTasks: totalCompleted,
        ratePerTask: ratePerTask,
        totalEarnings: totalCompleted * ratePerTask + (workingDays * (baseRate / 30)),
        workingDays,
        baseRate,
        actualSalary,
        paidSalary,
        bonus,
        totalMonthlySalary
      });

      // Fetch today's attendance
      const today2 = new Date().toISOString().split('T')[0];
      const todayAttendanceQuery = query(
        collection(db, 'attendance'),
        where('staffId', '==', userData?.uid),
        where('date', '==', today2)
      );
      const todayAttendanceSnapshot = await getDocs(todayAttendanceQuery);
      
      if (!todayAttendanceSnapshot.empty) {
        const attendanceData = {
          id: todayAttendanceSnapshot.docs[0].id,
          ...todayAttendanceSnapshot.docs[0].data()
        } as Attendance;
        setAttendance(attendanceData);
        setCheckedIn(!!attendanceData.checkIn && !attendanceData.checkOut);
      }

      setTasks(tasksData);
    } catch (error) {
      console.error('Error fetching staff data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const timeString = now.toTimeString().split(' ')[0];

      const attendanceData = {
        staffId: userData?.uid,
        staffName: userData?.name,
        date: today,
        checkIn: timeString,
        inLocation: location,
        status: 'pending',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'attendance'), attendanceData);

      setCheckedIn(true);
      toast({
        title: "Success",
        description: "Checked in successfully. Awaiting admin approval.",
      });
      fetchStaffData();
    } catch (error) {
      console.error('Error checking in:', error);
      toast({
        title: "Error",
        description: "Failed to check in",
        variant: "destructive",
      });
    }
  };

  const handleCheckOut = async () => {
    try {
      if (attendance) {
        const now = new Date();
        const timeString = now.toTimeString().split(' ')[0];
        
        // In a real implementation, you would update the existing attendance record
        // For now, we'll create a new check-out record
        const checkoutData = {
          staffId: userData?.uid,
          staffName: userData?.name,
          date: new Date().toISOString().split('T')[0],
          checkIn: attendance.checkIn,
          checkOut: timeString,
          inLocation: attendance.inLocation,
          outLocation: location,
          status: 'pending',
          updatedAt: serverTimestamp()
        };

        await addDoc(collection(db, 'attendance'), checkoutData);
        
        setCheckedIn(false);
        toast({
          title: "Success",
          description: "Checked out successfully. Awaiting admin approval.",
        });
        fetchStaffData();
      }
    } catch (error) {
      console.error('Error checking out:', error);
      toast({
        title: "Error",
        description: "Failed to check out",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
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

  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
  const completedTasks = tasks.filter(task => task.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome, {userData?.name}!
        </h1>
        <p className="text-white/90">
          Here's your dashboard for today. Role: {staffData?.role} | Department: {staffData?.department}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Attendance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {attendance && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <LogIn className="h-4 w-4 text-green-600" />
                    <span>Check-in: {attendance.checkIn || 'Not checked in'}</span>
                  </div>
                  {attendance.checkOut && (
                    <div className="flex items-center space-x-2">
                      <LogOut className="h-4 w-4 text-red-600" />
                      <span>Check-out: {attendance.checkOut}</span>
                    </div>
                  )}
                  {attendance.inLocation && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <span>Location recorded</span>
                    </div>
                  )}
                </div>
                <Badge 
                  variant={
                    attendance.status === 'confirmed' ? 'default' : 
                    attendance.status === 'rejected' ? 'destructive' : 'secondary'
                  }
                >
                  Status: {attendance.status}
                </Badge>
              </div>
            )}
            
            <div className="flex space-x-2">
              {!checkedIn ? (
                <Button 
                  onClick={handleCheckIn}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!location}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Check In
                </Button>
              ) : (
                <Button 
                  onClick={handleCheckOut}
                  variant="outline"
                  className="border-red-600 text-red-600 hover:bg-red-50"
                  disabled={!location}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Check Out
                </Button>
              )}
            </div>
            
            {!location && (
              <div className="text-xs text-amber-600 flex items-center space-x-1">
                <AlertTriangle className="h-3 w-3" />
                <span>Location access required for attendance</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5" />
              <span>My Earnings</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tasks Completed:</span>
                <Badge variant="outline" className="bg-green-100 text-green-700">
                  {earningsSummary.completedTasks}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Working Days:</span>
                <Badge variant="outline" className="bg-blue-100 text-blue-700">
                  {earningsSummary.workingDays}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Actual Salary:</span>
                <span className="font-medium">₹{earningsSummary.actualSalary.toLocaleString()}</span>
              </div>
              {(earningsSummary.paidSalary > 0 || earningsSummary.bonus > 0) && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Paid Salary:</span>
                    <span className="font-medium text-blue-600">₹{earningsSummary.paidSalary.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Bonus:</span>
                    <span className="font-medium text-green-600">₹{earningsSummary.bonus.toLocaleString()}</span>
                  </div>
                </>
              )}
              <div className="border-t pt-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Monthly Salary:</span>
                  <span className="text-lg font-bold text-green-600">
                    ₹{earningsSummary.totalMonthlySalary.toLocaleString()}
                  </span>
                </div>
                {(earningsSummary.paidSalary > 0 || earningsSummary.bonus > 0) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Based on Paid Salary + Bonus
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Today's Tasks</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pending:</span>
                <Badge variant="outline">{pendingTasks.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">In Progress:</span>
                <Badge variant="outline" className="bg-blue-100 text-blue-700">
                  {inProgressTasks.length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Completed:</span>
                <Badge variant="outline" className="bg-green-100 text-green-700">
                  {completedTasks.length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Orders Section */}
      <Card>
        <CardHeader>
          <CardTitle>My Assigned Orders</CardTitle>
          <CardDescription>Orders assigned specifically to you</CardDescription>
        </CardHeader>
        <CardContent>
          {assignedOrders.length > 0 ? (
            <div className="space-y-4">
              {assignedOrders.slice(0, 5).map((order: any) => (
                <div key={order.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">Customer: {order.customerName}</h3>
                    <Badge className={
                      order.status === 'completed' ? 'bg-green-100 text-green-700' :
                      order.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Item:</strong> {order.items?.[0]?.description || 'No description'}</p>
                    <p><strong>Category:</strong> {order.items?.[0]?.category || 'General'}</p>
                    <p><strong>Delivery Date:</strong> {order.items?.[0]?.deliveryDate ? new Date(order.items[0].deliveryDate).toLocaleDateString() : 'Not set'}</p>
                  </div>
                  {/* Note: Customer phone/email are deliberately hidden for staff privacy */}
                </div>
              ))}
              {assignedOrders.length > 5 && (
                <div className="text-center text-sm text-gray-500">
                  Showing 5 of {assignedOrders.length} assigned orders
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No orders assigned yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle>My Tasks</CardTitle>
          <CardDescription>Your assigned tasks and responsibilities</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length > 0 ? (
            <div className="space-y-4">
              {tasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{task.title}</h3>
                    <div className="flex space-x-2">
                      <Badge className={
                        task.priority === 'high' ? 'bg-red-100 text-red-700' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }>
                        {task.priority}
                      </Badge>
                      <Badge className={
                        task.status === 'completed' ? 'bg-green-100 text-green-700' :
                        task.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }>
                        {task.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                  <div className="text-xs text-gray-500">
                    Due: {task.dueDate}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No tasks assigned yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffDashboard;
