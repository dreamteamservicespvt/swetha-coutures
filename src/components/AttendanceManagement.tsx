
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { collection, getDocs, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { Clock, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  inLocation?: { lat: number; lng: number };
  outLocation?: { lat: number; lng: number };
  status: 'pending' | 'confirmed' | 'rejected';
  hoursWorked?: number;
}

const AttendanceManagement = () => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendanceRecords();
  }, []);

  const fetchAttendanceRecords = async () => {
    try {
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('status', '==', 'pending'),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(attendanceQuery);
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceRecord[];

      setAttendanceRecords(records);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      toast({
        title: "Error",
        description: "Failed to fetch attendance records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmAttendance = async (recordId: string, checkInTime: string, checkOutTime?: string) => {
    try {
      const hoursWorked = checkOutTime ? 
        (new Date(`1970-01-01T${checkOutTime}`).getTime() - new Date(`1970-01-01T${checkInTime}`).getTime()) / (1000 * 60 * 60) : 0;

      await updateDoc(doc(db, 'attendance', recordId), {
        status: 'confirmed',
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        confirmedAt: new Date().toISOString()
      });

      toast({
        title: "Success",
        description: "Attendance confirmed successfully",
      });

      fetchAttendanceRecords();
    } catch (error) {
      console.error('Error confirming attendance:', error);
      toast({
        title: "Error",
        description: "Failed to confirm attendance",
        variant: "destructive",
      });
    }
  };

  const rejectAttendance = async (recordId: string) => {
    try {
      await updateDoc(doc(db, 'attendance', recordId), {
        status: 'rejected',
        rejectedAt: new Date().toISOString()
      });

      toast({
        title: "Success",
        description: "Attendance rejected",
      });

      fetchAttendanceRecords();
    } catch (error) {
      console.error('Error rejecting attendance:', error);
      toast({
        title: "Error",
        description: "Failed to reject attendance",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">Loading attendance records...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Pending Attendance Approvals</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {attendanceRecords.length > 0 ? (
          <div className="space-y-4">
            {attendanceRecords.map((record) => (
              <div key={record.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{record.staffName}</h3>
                    <p className="text-sm text-gray-600">{record.date}</p>
                  </div>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                    {record.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Check-in: {record.checkIn || 'N/A'}</span>
                  </div>
                  {record.checkOut && (
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-red-600" />
                      <span className="text-sm">Check-out: {record.checkOut}</span>
                    </div>
                  )}
                </div>

                {record.inLocation && (
                  <div className="flex items-center space-x-2 mb-3">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">
                      Location: {record.inLocation.lat.toFixed(4)}, {record.inLocation.lng.toFixed(4)}
                    </span>
                  </div>
                )}

                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    onClick={() => confirmAttendance(record.id, record.checkIn!, record.checkOut)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectAttendance(record.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No pending attendance records to review.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceManagement;
