
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
import { Plus, Scissors, Clock, CheckCircle, Search, Edit, Trash2, Phone, MessageCircle, Calendar, Grid, List } from 'lucide-react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import LoadingSpinner from '@/components/LoadingSpinner';
import ContactActions from '@/components/ContactActions';

interface Alteration {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  garmentType: string;
  alterationType: string;
  description: string;
  urgency: 'normal' | 'urgent' | 'rush';
  status: 'received' | 'in-progress' | 'completed' | 'delivered';
  estimatedCost: number;
  actualCost?: number;
  dueDate: string;
  notes?: string;
  measurements?: any;
  beforeImages?: string[];
  afterImages?: string[];
  createdAt: any;
}

const Alterations = () => {
  const { userData } = useAuth();
  const [alterations, setAlterations] = useState<Alteration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlteration, setEditingAlteration] = useState<Alteration | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    garmentType: '',
    alterationType: '',
    description: '',
    urgency: 'normal',
    estimatedCost: '',
    dueDate: '',
    notes: ''
  });

  const garmentTypes = [
    'Dress', 'Shirt', 'Pants', 'Skirt', 'Jacket', 'Blouse', 
    'Suit', 'Traditional Wear', 'Wedding Dress', 'Other'
  ];

  const alterationTypes = [
    'Hemming', 'Taking In', 'Letting Out', 'Shortening Sleeves',
    'Lengthening', 'Zipper Replacement', 'Button Replacement',
    'Patching', 'Resizing', 'Style Change', 'Repair', 'Other'
  ];

  useEffect(() => {
    if (!userData) {
      setLoading(false);
      return;
    }
    fetchAlterations();
  }, [userData]);

  const fetchAlterations = async () => {
    try {
      setLoading(true);
      const alterationsQuery = query(
        collection(db, 'alterations'),
        orderBy('createdAt', 'desc')
      );
      const alterationsSnapshot = await getDocs(alterationsQuery);
      const alterationsData = alterationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Alteration[];
      
      setAlterations(alterationsData || []);
    } catch (error) {
      console.error('Error fetching alterations:', error);
      toast({
        title: "Error",
        description: "Failed to fetch alterations",
        variant: "destructive",
      });
      setAlterations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const alterationData = {
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        customerEmail: formData.customerEmail || undefined,
        garmentType: formData.garmentType,
        alterationType: formData.alterationType,
        description: formData.description,
        urgency: formData.urgency as 'normal' | 'urgent' | 'rush',
        estimatedCost: parseFloat(formData.estimatedCost) || 0,
        dueDate: formData.dueDate,
        notes: formData.notes || undefined,
        status: 'received' as const,
        ...(editingAlteration ? {} : { createdAt: serverTimestamp() })
      };

      if (editingAlteration) {
        await updateDoc(doc(db, 'alterations', editingAlteration.id), alterationData);
        toast({
          title: "Success",
          description: "Alteration updated successfully",
        });
      } else {
        await addDoc(collection(db, 'alterations'), alterationData);
        toast({
          title: "Success",
          description: "Alteration request added successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingAlteration(null);
      resetForm();
      fetchAlterations();
    } catch (error) {
      console.error('Error saving alteration:', error);
      toast({
        title: "Error",
        description: "Failed to save alteration",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      garmentType: '',
      alterationType: '',
      description: '',
      urgency: 'normal',
      estimatedCost: '',
      dueDate: '',
      notes: ''
    });
  };

  const handleEdit = (alteration: Alteration) => {
    setEditingAlteration(alteration);
    setFormData({
      customerName: alteration.customerName || '',
      customerPhone: alteration.customerPhone || '',
      customerEmail: alteration.customerEmail || '',
      garmentType: alteration.garmentType || '',
      alterationType: alteration.alterationType || '',
      description: alteration.description || '',
      urgency: alteration.urgency || 'normal',
      estimatedCost: alteration.estimatedCost?.toString() || '',
      dueDate: alteration.dueDate || '',
      notes: alteration.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (alterationId: string) => {
    if (window.confirm('Are you sure you want to delete this alteration request?')) {
      try {
        await deleteDoc(doc(db, 'alterations', alterationId));
        toast({
          title: "Success",
          description: "Alteration deleted successfully",
        });
        fetchAlterations();
      } catch (error) {
        console.error('Error deleting alteration:', error);
        toast({
          title: "Error",
          description: "Failed to delete alteration",
          variant: "destructive",
        });
      }
    }
  };

  const updateStatus = async (alterationId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'alterations', alterationId), {
        status: newStatus
      });
      
      toast({
        title: "Success",
        description: `Alteration marked as ${newStatus}`,
      });
      fetchAlterations();
    } catch (error) {
      console.error('Error updating alteration status:', error);
      toast({
        title: "Error",
        description: "Failed to update alteration status",
        variant: "destructive",
      });
    }
  };

  if (!userData) {
    return <LoadingSpinner type="page" />;
  }

  if (loading) {
    return <LoadingSpinner type="page" />;
  }

  const filteredAlterations = alterations.filter(alteration => {
    if (!alteration) return false;
    
    const matchesSearch = (
      (alteration.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (alteration.garmentType || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (alteration.alterationType || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const matchesStatus = statusFilter === 'all' || alteration.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Safe calculations
  const totalAlterations = alterations.length;
  const inProgressAlterations = alterations.filter(alt => alt?.status === 'in-progress').length;
  const completedAlterations = alterations.filter(alt => alt?.status === 'completed').length;
  const rushJobs = alterations.filter(alt => alt?.urgency === 'rush' && alt?.status !== 'delivered').length;

  return (
    <div className="mobile-page-layout">
      <div className="mobile-page-wrapper container-responsive space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="mobile-page-header">
          <div className="space-y-1 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-dark-fix">Alterations</h1>
            <p className="responsive-text-base text-muted-dark-fix">Manage alteration requests and repairs</p>
          </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="btn-responsive w-full md:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-600 dark:hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-200"
              onClick={() => {
                setEditingAlteration(null);
                resetForm();
              }}
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
              New Alteration
            </Button>
          </DialogTrigger>
          <DialogContent className="mobile-dialog max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAlteration ? 'Edit Alteration' : 'New Alteration Request'}
              </DialogTitle>
              <DialogDescription>
                Fill in the alteration details below.
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

              <div className="form-grid-responsive">
                <div>
                  <Label htmlFor="garmentType">Garment Type</Label>
                  <Select value={formData.garmentType} onValueChange={(value) => setFormData({...formData, garmentType: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select garment type" />
                    </SelectTrigger>
                    <SelectContent>
                      {garmentTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="alterationType">Alteration Type</Label>
                  <Select value={formData.alterationType} onValueChange={(value) => setFormData({...formData, alterationType: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select alteration type" />
                    </SelectTrigger>
                    <SelectContent>
                      {alterationTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe the alteration needed"
                  rows={3}
                  required
                />
              </div>

              <div className="form-grid-responsive-3">
                <div>
                  <Label htmlFor="urgency">Urgency</Label>
                  <Select value={formData.urgency} onValueChange={(value) => setFormData({...formData, urgency: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select urgency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="rush">Rush</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="estimatedCost">Estimated Cost (₹)</Label>
                  <Input
                    id="estimatedCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.estimatedCost}
                    onChange={(e) => setFormData({...formData, estimatedCost: e.target.value})}
                    placeholder="Enter cost"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Any additional notes or special instructions"
                  rows={2}
                />
              </div>

              <div className="responsive-actions">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="btn-responsive">
                  Cancel
                </Button>
                <Button type="submit" className="btn-responsive bg-gradient-to-r from-blue-600 to-purple-600">
                  {editingAlteration ? 'Update Alteration' : 'Add Alteration'}
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
            <CardTitle className="responsive-text-sm font-medium text-gray-600 dark:text-gray-400">Total Alterations</CardTitle>
            <Scissors className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{totalAlterations}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">All requests</p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="responsive-text-sm font-medium text-gray-600 dark:text-gray-400">In Progress</CardTitle>
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{inProgressAlterations}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Currently working</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="responsive-text-sm font-medium text-gray-600 dark:text-gray-400">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{completedAlterations}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ready for pickup</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="responsive-text-sm font-medium text-gray-600 dark:text-gray-400">Rush Jobs</CardTitle>
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{rushJobs}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Priority items</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="search-filter-container">
        <div className="relative flex-1">
          <Search className="absolute left-2 sm:left-3 top-2.5 sm:top-3 h-3 w-3 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Search alterations..."
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
            <SelectItem value="received" className="text-gray-900 dark:text-gray-100">Received</SelectItem>
            <SelectItem value="in-progress" className="text-gray-900 dark:text-gray-100">In Progress</SelectItem>
            <SelectItem value="completed" className="text-gray-900 dark:text-gray-100">Completed</SelectItem>
            <SelectItem value="delivered" className="text-gray-900 dark:text-gray-100">Delivered</SelectItem>
          </SelectContent>
        </Select>
        
        {/* View Toggle */}
        <div className="flex rounded-lg border bg-white dark:bg-gray-800">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-r-none"
            title="List View"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-l-none"
            title="Grid View"
          >
            <Grid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Alterations List */}
      <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Alteration Requests</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">Manage all alteration requests and repairs</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAlterations.length > 0 ? (
            viewMode === 'grid' ? (
              // Grid View
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAlterations.map((alteration) => (
                  <Card key={alteration?.id} className="hover:shadow-lg transition-shadow border-2 hover:border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <CardTitle className="text-lg font-bold truncate">
                            {alteration?.customerName || 'Unknown Customer'}
                          </CardTitle>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
                            <Badge variant="outline" className="text-xs">{alteration?.garmentType || 'N/A'}</Badge>
                            <span className="hidden sm:inline">•</span>
                            <span className="truncate">{alteration?.alterationType || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="flex flex-row sm:flex-col gap-1 sm:space-y-1 sm:items-end">
                          <Badge 
                            variant={
                              alteration?.status === 'delivered' ? 'default' : 
                              alteration?.status === 'completed' ? 'secondary' : 
                              alteration?.status === 'in-progress' ? 'outline' : 'outline'
                            }
                            className="text-xs"
                          >
                            {alteration?.status || 'Unknown'}
                          </Badge>
                          {(alteration?.urgency === 'rush' || alteration?.urgency === 'urgent') && (
                            <Badge 
                              variant={alteration?.urgency === 'rush' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {alteration?.urgency === 'rush' ? 'Rush' : 'Urgent'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Due Date:</span>
                          <span className="font-medium">{alteration?.dueDate ? format(new Date(alteration.dueDate), 'PPP') : 'No date'}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Cost:</span>
                          <span className="font-bold text-primary">₹{(alteration?.estimatedCost || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      
                      {alteration?.description && (
                        <div className="border rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">{alteration.description}</p>
                        </div>
                      )}
                      
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 pt-2">
                        <div className="order-2 sm:order-1">
                          <ContactActions 
                            phone={alteration?.customerPhone}
                            message={`Hi ${alteration?.customerName}, your ${alteration?.garmentType} alteration is ${alteration?.status}. Due date: ${alteration?.dueDate ? format(new Date(alteration.dueDate), 'PPP') : 'TBD'}.`}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1 sm:gap-2 order-1 sm:order-2 justify-end">
                          <Select 
                            value={alteration?.status} 
                            onValueChange={(value) => updateStatus(alteration?.id, value)}
                          >
                            <SelectTrigger className="w-28 sm:w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="received">Received</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(alteration)} className="h-8 w-8 p-0 flex-shrink-0">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleDelete(alteration?.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500 flex-shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              // List View
              <div className="space-y-4">
                {filteredAlterations.map((alteration) => (
                <div key={alteration?.id} className="mobile-item-card">
                  {/* Desktop Layout */}
                  <div className="hidden md:flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{alteration?.customerName || 'Unknown Customer'}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {alteration?.garmentType || 'N/A'} • {alteration?.alterationType || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Due: {alteration?.dueDate ? format(new Date(alteration.dueDate), 'PPP') : 'No date'} • ₹{(alteration?.estimatedCost || 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex space-x-1">
                          <Badge 
                            variant={
                              alteration?.status === 'delivered' ? 'default' : 
                              alteration?.status === 'completed' ? 'secondary' : 
                              alteration?.status === 'in-progress' ? 'outline' : 'outline'
                            }
                          >
                            {alteration?.status || 'Unknown'}
                          </Badge>
                          {alteration?.urgency === 'rush' && (
                            <Badge variant="destructive">Rush</Badge>
                          )}
                          {alteration?.urgency === 'urgent' && (
                            <Badge variant="secondary">Urgent</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ContactActions 
                        phone={alteration?.customerPhone}
                        message={`Hi ${alteration?.customerName}, your ${alteration?.garmentType} alteration is ${alteration?.status}. Due date: ${alteration?.dueDate ? format(new Date(alteration.dueDate), 'PPP') : 'TBD'}.`}
                      />
                      <Select 
                        value={alteration?.status} 
                        onValueChange={(value) => updateStatus(alteration?.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="received">Received</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(alteration)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDelete(alteration?.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{alteration?.customerName || 'Unknown Customer'}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {alteration?.garmentType || 'N/A'} • {alteration?.alterationType || 'N/A'}
                        </p>
                      </div>
                      <div className="flex flex-col space-y-1 items-end">
                        <Badge 
                          variant={
                            alteration?.status === 'delivered' ? 'default' : 
                            alteration?.status === 'completed' ? 'secondary' : 
                            alteration?.status === 'in-progress' ? 'outline' : 'outline'
                          }
                          className="text-xs"
                        >
                          {alteration?.status || 'Unknown'}
                        </Badge>
                        {(alteration?.urgency === 'rush' || alteration?.urgency === 'urgent') && (
                          <Badge 
                            variant={alteration?.urgency === 'rush' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {alteration?.urgency === 'rush' ? 'Rush' : 'Urgent'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-500">
                      <span>Due: {alteration?.dueDate ? format(new Date(alteration.dueDate), 'PPP') : 'No date'}</span>
                      <span className="font-medium">₹{(alteration?.estimatedCost || 0).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <ContactActions 
                          phone={alteration?.customerPhone}
                          message={`Hi ${alteration?.customerName}, your ${alteration?.garmentType} alteration is ${alteration?.status}. Due date: ${alteration?.dueDate ? format(new Date(alteration.dueDate), 'PPP') : 'TBD'}.`}
                        />
                        <Select 
                          value={alteration?.status} 
                          onValueChange={(value) => updateStatus(alteration?.id, value)}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="received">Received</SelectItem>
                            <SelectItem value="in-progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="responsive-actions">
                        <Button size="sm" variant="outline" onClick={() => handleEdit(alteration)} className="h-8 w-8 p-0">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleDelete(alteration?.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12">
              <Scissors className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No alterations</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchTerm ? 'No alterations match your search.' : 'Add your first alteration request to get started.'}
              </p>
              {!searchTerm && (
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-600 dark:hover:to-purple-600"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Alteration
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

export default Alterations;
