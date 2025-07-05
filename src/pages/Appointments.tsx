import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Calendar as CalendarIcon, Clock, CheckCircle, Search, Edit, Trash2, Phone, MessageCircle, User, ExternalLink, Video } from 'lucide-react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import LoadingSpinner from '@/components/LoadingSpinner';
import ContactActions from '@/components/ContactActions';

interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  appointmentDate: any;
  appointmentTime: string;
  duration: number;
  purpose: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  reminderSent?: boolean;
  gmeetUrl?: string;
  createdAt: any;
}

const Appointments = () => {
  const { userData } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date>();

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    appointmentDate: '',
    appointmentTime: '',
    duration: '60',
    purpose: '',
    notes: '',
    gmeetUrl: ''
  });

  const appointmentPurposes = [
    'Consultation',
    'Measurement',
    'Fitting',
    'Delivery',
    'Alteration',
    'Design Discussion',
    'Follow-up'
  ];

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30'
  ];

  useEffect(() => {
    if (!userData) {
      setLoading(false);
      return;
    }
    fetchAppointments();
  }, [userData]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const appointmentsQuery = query(
        collection(db, 'appointments'),
        orderBy('appointmentDate', 'asc')
      );
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const appointmentsData = appointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[];
      
      setAppointments(appointmentsData || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch appointments",
        variant: "destructive",
      });
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const appointmentDateTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`);
      
      const appointmentData = {
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail || undefined,
        appointmentDate: appointmentDateTime,
        appointmentTime: formData.appointmentTime,
        duration: parseInt(formData.duration),
        purpose: formData.purpose,
        notes: formData.notes || undefined,
        gmeetUrl: formData.gmeetUrl || undefined,
        status: 'scheduled' as const,
        reminderSent: false,
        ...(editingAppointment ? {} : { createdAt: serverTimestamp() })
      };

      if (editingAppointment) {
        await updateDoc(doc(db, 'appointments', editingAppointment.id), appointmentData);
        toast({
          title: "Success",
          description: "Appointment updated successfully",
        });
      } else {
        await addDoc(collection(db, 'appointments'), appointmentData);
        toast({
          title: "Success",
          description: "Appointment scheduled successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingAppointment(null);
      resetForm();
      fetchAppointments();
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast({
        title: "Error",
        description: "Failed to save appointment",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      appointmentDate: '',
      appointmentTime: '',
      duration: '60',
      purpose: '',
      notes: '',
      gmeetUrl: ''
    });
  };

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    const appointmentDate = appointment.appointmentDate?.toDate?.() || new Date(appointment.appointmentDate);
    setFormData({
      customerName: appointment.customerName || '',
      customerPhone: appointment.customerPhone || '',
      customerEmail: appointment.customerEmail || '',
      appointmentDate: format(appointmentDate, 'yyyy-MM-dd'),
      appointmentTime: appointment.appointmentTime || '',
      duration: appointment.duration?.toString() || '60',
      purpose: appointment.purpose || '',
      notes: appointment.notes || '',
      gmeetUrl: appointment.gmeetUrl || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (appointmentId: string) => {
    if (window.confirm('Are you sure you want to delete this appointment?')) {
      try {
        await deleteDoc(doc(db, 'appointments', appointmentId));
        toast({
          title: "Success",
          description: "Appointment deleted successfully",
        });
        fetchAppointments();
      } catch (error) {
        console.error('Error deleting appointment:', error);
        toast({
          title: "Error",
          description: "Failed to delete appointment",
          variant: "destructive",
        });
      }
    }
  };

  const updateStatus = async (appointmentId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'appointments', appointmentId), {
        status: newStatus
      });
      
      toast({
        title: "Success",
        description: `Appointment marked as ${newStatus}`,
      });
      fetchAppointments();
    } catch (error) {
      console.error('Error updating appointment status:', error);
      toast({
        title: "Error",
        description: "Failed to update appointment status",
        variant: "destructive",
      });
    }
  };

  const sendGmeetWhatsApp = (appointment: Appointment) => {
    if (!appointment.customerPhone) {
      toast({
        title: "Error",
        description: "Customer phone number not available",
        variant: "destructive",
      });
      return;
    }

    const appointmentDate = appointment.appointmentDate?.toDate?.() || new Date(appointment.appointmentDate);
    
    let message = `Hi ${appointment.customerName || 'Customer'},\n\n`;
    message += `Your appointment is scheduled for:\n`;
    message += `📅 Date: ${format(appointmentDate, 'PPP')}\n`;
    message += `⏰ Time: ${appointment.appointmentTime}\n`;
    message += `📝 Purpose: ${appointment.purpose}\n`;
    message += `⏱️ Duration: ${appointment.duration} minutes\n\n`;
    
    if (appointment.gmeetUrl) {
      message += `🎥 Google Meet Link:\n${appointment.gmeetUrl}\n\n`;
      message += `Please join the meeting at the scheduled time.\n\n`;
    }
    
    message += `Looking forward to meeting with you!\n\n`;
    message += `Best regards,\nSwetha Couture`;

    const whatsappUrl = `https://wa.me/${appointment.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (!userData) {
    return <LoadingSpinner type="page" />;
  }

  if (loading) {
    return <LoadingSpinner type="page" />;
  }

  const filteredAppointments = appointments.filter(appointment => {
    if (!appointment) return false;
    
    const matchesSearch = (
      (appointment.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (appointment.purpose || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Safe calculations
  const todayAppointments = appointments.filter(apt => {
    if (!apt?.appointmentDate) return false;
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const aptDate = apt.appointmentDate?.toDate?.() || new Date(apt.appointmentDate);
      return format(aptDate, 'yyyy-MM-dd') === today;
    } catch {
      return false;
    }
  }).length;

  const upcomingAppointments = appointments.filter(apt => {
    if (!apt?.appointmentDate) return false;
    try {
      const aptDate = apt.appointmentDate?.toDate?.() || new Date(apt.appointmentDate);
      return aptDate > new Date() && apt.status !== 'cancelled';
    } catch {
      return false;
    }
  }).length;

  const totalAppointments = appointments.length;

  return (
    <div className="mobile-page-layout">
      <div className="mobile-page-wrapper container-responsive space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="mobile-page-header">
          <div className="space-y-1 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-dark-fix">Appointments</h1>
            <p className="responsive-text-base text-muted-dark-fix">Schedule and manage customer appointments</p>
          </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="btn-responsive w-full md:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-600 dark:hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-200"
              onClick={() => {
                setEditingAppointment(null);
                resetForm();
              }}
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
              Book Appointment
            </Button>
          </DialogTrigger>
          <DialogContent className="mobile-dialog max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAppointment ? 'Edit Appointment' : 'Book New Appointment'}
              </DialogTitle>
              <DialogDescription>
                Fill in the appointment details below.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-grid-responsive">
                <div>
                  <Label htmlFor="customerName">Customer Name</Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    placeholder="Enter customer name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">Phone Number</Label>
                  <Input
                    id="customerPhone"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                    placeholder="Enter phone number"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="customerEmail">Email (Optional)</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                  placeholder="Enter email address"
                />
              </div>

              <div className="form-grid-responsive-3">
                <div>
                  <Label htmlFor="appointmentDate">Date</Label>
                  <Input
                    id="appointmentDate"
                    type="date"
                    value={formData.appointmentDate}
                    onChange={(e) => setFormData({...formData, appointmentDate: e.target.value})}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="appointmentTime">Time</Label>
                  <Select value={formData.appointmentTime} onValueChange={(value) => setFormData({...formData, appointmentTime: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Select value={formData.duration} onValueChange={(value) => setFormData({...formData, duration: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="purpose">Purpose</Label>
                <Select value={formData.purpose} onValueChange={(value) => setFormData({...formData, purpose: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    {appointmentPurposes.map(purpose => (
                      <SelectItem key={purpose} value={purpose}>{purpose}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="gmeetUrl">Google Meet URL (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="gmeetUrl"
                    type="url"
                    value={formData.gmeetUrl}
                    onChange={(e) => setFormData({...formData, gmeetUrl: e.target.value})}
                    placeholder="https://meet.google.com/..."
                    className="flex-1"
                  />
                  {formData.gmeetUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(formData.gmeetUrl, '_blank')}
                      title="Test Google Meet link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Add a Google Meet link for virtual appointments
                </p>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Any additional notes or requirements"
                  rows={3}
                />
              </div>

              <div className="responsive-actions">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="btn-responsive">
                  Cancel
                </Button>
                <Button type="submit" className="btn-responsive bg-gradient-to-r from-blue-600 to-purple-600">
                  {editingAppointment ? 'Update Appointment' : 'Book Appointment'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid-responsive">
        <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="responsive-text-sm font-medium text-gray-600 dark:text-gray-400">Today's Appointments</CardTitle>
            <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{todayAppointments}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Scheduled for today</p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="responsive-text-sm font-medium text-gray-600 dark:text-gray-400">Upcoming</CardTitle>
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{upcomingAppointments}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Future appointments</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="responsive-text-sm font-medium text-gray-600 dark:text-gray-400">Total Appointments</CardTitle>
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{totalAppointments}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">All appointments</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="responsive-text-sm font-medium text-gray-600 dark:text-gray-400">Completed</CardTitle>
            <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {appointments.filter(apt => apt?.status === 'completed').length}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Successfully completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="search-filter-container">
        <div className="relative flex-1">
          <Search className="absolute left-2 sm:left-3 top-2.5 sm:top-3 h-3 w-3 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Search appointments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 sm:pl-10 responsive-text-sm h-8 sm:h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 h-8 sm:h-10 responsive-text-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <SelectItem value="all" className="text-gray-900 dark:text-gray-100">All Status</SelectItem>
            <SelectItem value="scheduled" className="text-gray-900 dark:text-gray-100">Scheduled</SelectItem>
            <SelectItem value="confirmed" className="text-gray-900 dark:text-gray-100">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Appointments List */}
      <Card className="border-0 shadow-md bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Appointments</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">Manage all customer appointments</CardDescription>
        </CardHeader>
        <CardContent className="card-content-responsive">
          {filteredAppointments.length > 0 ? (
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => {
                const appointmentDate = appointment?.appointmentDate?.toDate?.() || new Date(appointment?.appointmentDate);
                
                return (
                  <div key={appointment?.id} className="mobile-item-card">
                    <div className="flex-1 space-y-2 md:space-y-0">
                      <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 responsive-text-base">
                            {appointment?.customerName || 'Unknown Customer'}
                          </h3>
                          <p className="responsive-text-sm text-gray-600 dark:text-gray-400">
                            {format(appointmentDate, 'PPP')} at {appointment?.appointmentTime || 'No time'} • {appointment?.purpose || 'No purpose'}
                          </p>
                          <p className="responsive-text-xs text-gray-500 dark:text-gray-500">
                            Duration: {appointment?.duration || 0} minutes
                          </p>
                          {appointment?.gmeetUrl && (
                            <div className="flex items-center gap-2 mt-1">
                              <Video className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <Button
                                size="sm"
                                variant="link"
                                className="p-0 h-auto text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                onClick={() => window.open(appointment.gmeetUrl, '_blank')}
                              >
                                Join Google Meet
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 md:mt-0">
                          <Badge 
                            className={`status-badge-responsive ${
                              appointment?.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-700' : 
                              appointment?.status === 'confirmed' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700' : 
                              appointment?.status === 'cancelled' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-700' : 
                              'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {appointment?.status || 'Unknown'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="responsive-actions">
                      <ContactActions 
                        phone={appointment?.customerPhone}
                        message={`Hi ${appointment?.customerName}, this is regarding your appointment on ${format(appointmentDate, 'PPP')} at ${appointment?.appointmentTime}.`}
                      />
                      {appointment?.gmeetUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendGmeetWhatsApp(appointment)}
                          className="bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                          title="Send appointment details with Google Meet link"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span className="hidden sm:inline ml-1">Meet Link</span>
                        </Button>
                      )}
                      <Select 
                        value={appointment?.status} 
                        onValueChange={(value) => updateStatus(appointment?.id, value)}
                      >
                        <SelectTrigger className="btn-responsive min-w-[8rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(appointment)} className="btn-responsive">
                        <Edit className="h-4 w-4" />
                        <span className="hidden sm:inline ml-1">Edit</span>
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDelete(appointment?.id)}
                        className="btn-responsive text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline ml-1">Delete</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <CalendarIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No appointments</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchTerm ? 'No appointments match your search.' : 'Book your first appointment to get started.'}
              </p>
              {!searchTerm && (
                <Button 
                  className="btn-responsive bg-gradient-to-r from-blue-600 to-purple-600"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Book First Appointment
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Appointments;
