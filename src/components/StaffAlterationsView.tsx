import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Calendar,
  User,
  CheckCircle,
  Clock,
  AlertTriangle,
  Filter,
  Scissors
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

interface StaffAlteration {
  id: string;
  customerName: string; // Only customer name, no phone/email
  itemType: string;
  alterationType: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  urgency: 'low' | 'medium' | 'high';
  estimatedDate: string;
  notes?: string;
  assignedTo: string[];
  createdAt: any;
}

const StaffAlterationsView = () => {
  const { userData } = useAuth();
  const [alterations, setAlterations] = useState<StaffAlteration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (userData) {
      fetchAssignedAlterations();
    }
  }, [userData]);

  const fetchAssignedAlterations = async () => {
    try {
      setLoading(true);
      
      // Fetch only alterations assigned to this staff member
      const alterationsQuery = query(
        collection(db, 'alterations'),
        where('assignedTo', 'array-contains', userData?.uid),
        orderBy('createdAt', 'desc')
      );
      
      const alterationsSnapshot = await getDocs(alterationsQuery);
      const alterationsData = alterationsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          customerName: data.customerName, // Only name, no contact details
          itemType: data.itemType,
          alterationType: data.alterationType,
          description: data.description,
          status: data.status,
          urgency: data.urgency,
          estimatedDate: data.estimatedDate,
          notes: data.notes,
          assignedTo: data.assignedTo || [],
          createdAt: data.createdAt
        };
      }) as StaffAlteration[];

      setAlterations(alterationsData);
    } catch (error) {
      console.error('Error fetching assigned alterations:', error);
      toast({
        title: "Error",
        description: "Failed to load assigned alterations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateAlterationStatus = async (alterationId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'alterations', alterationId), {
        status: newStatus,
        lastUpdated: new Date()
      });
      
      toast({
        title: "Success",
        description: "Alteration status updated successfully",
      });
      
      fetchAssignedAlterations(); // Refresh the data
    } catch (error) {
      console.error('Error updating alteration status:', error);
      toast({
        title: "Error",
        description: "Failed to update alteration status",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return 'bg-red-100 text-red-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-green-100 text-green-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'in-progress':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const filteredAlterations = alterations.filter(alteration => {
    const matchesSearch = alteration.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alteration.itemType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alteration.alterationType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alteration.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || alteration.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">My Assigned Alterations</h1>
        <p className="text-white/90">
          Alteration tasks that have been assigned to you
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Scissors className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                <p className="text-2xl font-bold">{alterations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-gray-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold">
                  {alterations.filter(alt => alt.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">
                  {alterations.filter(alt => alt.status === 'in-progress').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold">
                  {alterations.filter(alt => alt.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search Alterations</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by customer, item type, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Alterations</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alterations List */}
      <div className="space-y-4">
        {filteredAlterations.length > 0 ? (
          filteredAlterations.map((alteration) => (
            <Card key={alteration.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-500" />
                    <div>
                      <CardTitle className="text-lg">Customer: {alteration.customerName}</CardTitle>
                      <CardDescription>
                        {alteration.itemType} - {alteration.alterationType}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getUrgencyColor(alteration.urgency)}>
                      {alteration.urgency} priority
                    </Badge>
                    <Badge className={getStatusColor(alteration.status)}>
                      {getStatusIcon(alteration.status)}
                      <span className="ml-1 capitalize">{alteration.status}</span>
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Description</label>
                      <p className="font-medium">{alteration.description}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Estimated Completion</label>
                      <p className={
                        alteration.estimatedDate && new Date(alteration.estimatedDate) < new Date() 
                          ? 'text-red-600 font-medium' 
                          : ''
                      }>
                        {alteration.estimatedDate ? new Date(alteration.estimatedDate).toLocaleDateString() : 'Not set'}
                      </p>
                    </div>
                  </div>
                  
                  {alteration.notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Notes</label>
                      <p className="text-sm text-gray-700 mt-1">{alteration.notes}</p>
                    </div>
                  )}
                  
                  {/* Status Update Section */}
                  <div className="pt-4 border-t">
                    <label className="text-sm font-medium text-gray-600 mb-2 block">
                      Update Status
                    </label>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant={alteration.status === 'in-progress' ? 'default' : 'outline'}
                        onClick={() => updateAlterationStatus(alteration.id, 'in-progress')}
                        disabled={alteration.status === 'in-progress'}
                      >
                        <Clock className="h-4 w-4 mr-1" />
                        In Progress
                      </Button>
                      <Button
                        size="sm"
                        variant={alteration.status === 'completed' ? 'default' : 'outline'}
                        onClick={() => updateAlterationStatus(alteration.id, 'completed')}
                        disabled={alteration.status === 'completed'}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Completed
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Note: You can update status to track your progress on alterations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Scissors className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Assigned Alterations</h3>
              <p className="text-gray-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'No alterations match your current filters.' 
                  : 'You have no alterations assigned to you at the moment.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StaffAlterationsView;
