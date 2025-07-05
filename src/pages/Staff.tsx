import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Plus, Users, Clock, CheckCircle, Search, Edit, Trash2, Phone, MessageCircle, Filter, X, UserCheck } from 'lucide-react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import ContactActions from '@/components/ContactActions';
import StaffProfileModal from '@/components/StaffProfileModal';

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  email?: string;
  password?: string;
  role: string;
  department: string;
  skills: string[];
  status: 'active' | 'inactive';
  joinDate: any;
  salary?: number;
  address?: string;
  upiId?: string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  salaryAmount?: number;
  salaryMode?: 'monthly' | 'hourly' | 'daily';
  emergencyContact?: {
    name: string;
    phone: string;
    relation: string;
  };
  createdAt: any;
}

const Staff = () => {
  const { userData } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Staff profile modal states
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [showStaffProfile, setShowStaffProfile] = useState(false);
  
  // Date filter states
  const [joinDateFrom, setJoinDateFrom] = useState<Date | undefined>();
  const [joinDateTo, setJoinDateTo] = useState<Date | undefined>();
  
  // New role/department states
  const [showNewRole, setShowNewRole] = useState(false);
  const [showNewDepartment, setShowNewDepartment] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [newDepartment, setNewDepartment] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    role: '',
    department: '',
    skills: '',
    salary: '',
    address: '',
    upiId: '',
    bankName: '',
    accountNo: '',
    ifsc: '',
    salaryAmount: '',
    salaryMode: 'monthly' as 'monthly' | 'hourly' | 'daily',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: ''
  });

  const defaultRoles = ['Tailor', 'Cutter', 'Designer', 'Finisher', 'Assistant', 'Manager'];
  const defaultDepartments = ['Production', 'Design', 'Finishing', 'Quality Control', 'Administration'];

  useEffect(() => {
    if (!userData) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [userData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch staff with filters
      let staffQuery = query(collection(db, 'staff'), orderBy('createdAt', 'desc'));
      
      if (joinDateFrom && joinDateTo) {
        staffQuery = query(
          collection(db, 'staff'),
          where('joinDate', '>=', joinDateFrom),
          where('joinDate', '<=', joinDateTo),
          orderBy('joinDate', 'desc')
        );
      }
      
      const staffSnapshot = await getDocs(staffQuery);
      const staffData = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StaffMember[];
      
      setStaff(staffData || []);
      
      // Fetch roles and departments
      const rolesSnapshot = await getDocs(collection(db, 'roles'));
      const customRoles = rolesSnapshot.docs.map(doc => doc.data().name);
      setRoles([...defaultRoles, ...customRoles]);
      
      const departmentsSnapshot = await getDocs(collection(db, 'departments'));
      const customDepartments = departmentsSnapshot.docs.map(doc => doc.data().name);
      setDepartments([...defaultDepartments, ...customDepartments]);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive",
      });
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const addNewRole = async () => {
    if (!newRole.trim()) return;
    
    try {
      await addDoc(collection(db, 'roles'), { name: newRole.trim() });
      setRoles([...roles, newRole.trim()]);
      setFormData({...formData, role: newRole.trim()});
      setNewRole('');
      setShowNewRole(false);
      toast({
        title: "Success",
        description: "New role added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add new role",
        variant: "destructive",
      });
    }
  };

  const addNewDepartment = async () => {
    if (!newDepartment.trim()) return;
    
    try {
      await addDoc(collection(db, 'departments'), { name: newDepartment.trim() });
      setDepartments([...departments, newDepartment.trim()]);
      setFormData({...formData, department: newDepartment.trim()});
      setNewDepartment('');
      setShowNewDepartment(false);
      toast({
        title: "Success",
        description: "New department added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add new department",
        variant: "destructive",
      });
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({...formData, password});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Generate password if not provided
      const password = formData.password || Math.random().toString(36).slice(-8);
      
      const staffData = {
        name: formData.name,
        phone: formData.phone,
        role: formData.role,
        department: formData.department,
        skills: formData.skills.split(',').map(skill => skill.trim()).filter(Boolean),
        salary: formData.salary ? parseFloat(formData.salary) : 0,
        salaryAmount: formData.salaryAmount ? parseFloat(formData.salaryAmount) : 0,
        salaryMode: formData.salaryMode || 'monthly',
        status: 'active' as const,
        ...(editingStaff ? {} : { 
          joinDate: serverTimestamp(),
          createdAt: serverTimestamp() 
        }),
        // Only include optional fields if they have values
        ...(formData.email && { email: formData.email }),
        ...(formData.address && { address: formData.address }),
        ...(formData.upiId && { upiId: formData.upiId }),
        ...(formData.bankName && { bankName: formData.bankName }),
        ...(formData.accountNo && { accountNo: formData.accountNo }),
        ...(formData.ifsc && { ifsc: formData.ifsc }),
        ...(formData.emergencyContactName && {
          emergencyContact: {
            name: formData.emergencyContactName,
            phone: formData.emergencyContactPhone,
            relation: formData.emergencyContactRelation
          }
        }),
        password
      };

      if (editingStaff) {
        await updateDoc(doc(db, 'staff', editingStaff.id), staffData);
        toast({
          title: "Success",
          description: "Staff member updated successfully",
        });
      } else {
        // Create Firebase Auth user if email is provided
        if (formData.email) {
          try {
            await createUserWithEmailAndPassword(auth, formData.email, password);
          } catch (authError) {
            console.log('Auth user creation failed, continuing with staff creation');
          }
        }
        
        await addDoc(collection(db, 'staff'), staffData);
        toast({
          title: "Success",
          description: `Staff member added successfully. Password: ${password}`,
        });
      }

      setIsDialogOpen(false);
      setEditingStaff(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving staff member:', error);
      toast({
        title: "Error",
        description: "Failed to save staff member",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      password: '',
      role: '',
      department: '',
      skills: '',
      salary: '',
      address: '',
      upiId: '',
      bankName: '',
      accountNo: '',
      ifsc: '',
      salaryAmount: '',
      salaryMode: 'monthly',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: ''
    });
  };

  const handleEdit = (member: StaffMember) => {
    setEditingStaff(member);
    setFormData({
      name: member.name || '',
      phone: member.phone || '',
      email: member.email || '',
      password: member.password || '',
      role: member.role || '',
      department: member.department || '',
      skills: (member.skills || []).join(', '),
      salary: member.salary?.toString() || '',
      address: member.address || '',
      upiId: member.upiId || '',
      bankName: member.bankName || '',
      accountNo: member.accountNo || '',
      ifsc: member.ifsc || '',
      salaryAmount: member.salaryAmount?.toString() || '',
      salaryMode: member.salaryMode || 'monthly',
      emergencyContactName: member.emergencyContact?.name || '',
      emergencyContactPhone: member.emergencyContact?.phone || '',
      emergencyContactRelation: member.emergencyContact?.relation || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (staffId: string) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        await deleteDoc(doc(db, 'staff', staffId));
        toast({
          title: "Success",
          description: "Staff member deleted successfully",
        });
        fetchData();
      } catch (error) {
        console.error('Error deleting staff member:', error);
        toast({
          title: "Error",
          description: "Failed to delete staff member",
          variant: "destructive",
        });
      }
    }
  };

  const toggleStatus = async (staffId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'staff', staffId), {
        status: newStatus
      });
      
      toast({
        title: "Success",
        description: `Staff member marked as ${newStatus}`,
      });
      fetchData();
    } catch (error) {
      console.error('Error updating staff status:', error);
      toast({
        title: "Error",
        description: "Failed to update staff status",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setJoinDateFrom(undefined);
    setJoinDateTo(undefined);
    setSearchTerm('');
    fetchData();
  };

  if (!userData) {
    return <LoadingSpinner type="page" />;
  }

  if (loading) {
    return <LoadingSpinner type="page" />;
  }

  const filteredStaff = staff.filter(member =>
    (member?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (member?.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (member?.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeStaff = staff.filter(member => member?.status === 'active').length;
  const totalStaff = staff.length;

  return (
    <div className="mobile-page-layout">
      <div className="mobile-page-wrapper container-responsive space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="mobile-page-header">
          <div className="space-y-1 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-dark-fix">Staff Management</h1>
            <p className="responsive-text-base text-muted-dark-fix">Manage your team members and assignments</p>
          </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="btn-responsive w-full md:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-600 dark:hover:to-purple-600 shadow-lg hover:shadow-xl transition-all duration-200"
              onClick={() => {
                setEditingStaff(null);
                resetForm();
              }}
            >
              <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
              Add Staff Member
            </Button>
          </DialogTrigger>
          <DialogContent className="mobile-dialog max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </DialogTitle>
              <DialogDescription>
                Fill in the staff member details below. Login credentials will be created automatically.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-grid-responsive">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="Enter phone number"
                    required
                  />
                </div>
              </div>

              <div className="form-grid-responsive">
                <div>
                  <Label htmlFor="email">Email (For Login)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="Enter email address"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="Auto-generated if empty"
                    />
                    <Button type="button" variant="outline" onClick={generatePassword} className="shrink-0">
                      Generate
                    </Button>
                  </div>
                </div>
              </div>

              <div className="form-grid-responsive">
                <div>
                  <Label htmlFor="role">Role</Label>
                  {showNewRole ? (
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                      <Input
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        placeholder="Enter new role"
                        className="flex-1"
                      />
                      <div className="responsive-actions">
                        <Button type="button" size="sm" onClick={addNewRole}>Save</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowNewRole(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Select value={formData.role} onValueChange={(value) => {
                      if (value === 'add_new') {
                        setShowNewRole(true);
                      } else {
                        setFormData({...formData, role: value});
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                        <SelectItem value="add_new">+ Add New Role</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  {showNewDepartment ? (
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                      <Input
                        value={newDepartment}
                        onChange={(e) => setNewDepartment(e.target.value)}
                        placeholder="Enter new department"
                        className="flex-1"
                      />
                      <div className="responsive-actions">
                        <Button type="button" size="sm" onClick={addNewDepartment}>Save</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowNewDepartment(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Select value={formData.department} onValueChange={(value) => {
                      if (value === 'add_new') {
                        setShowNewDepartment(true);
                      } else {
                        setFormData({...formData, department: value});
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                        <SelectItem value="add_new">+ Add New Department</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="skills">Skills (comma separated)</Label>
                <Input
                  id="skills"
                  value={formData.skills}
                  onChange={(e) => setFormData({...formData, skills: e.target.value})}
                  placeholder="e.g., Embroidery, Pattern Making, Alterations"
                />
              </div>

              {/* Financial Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Financial Information</h3>
                <div className="form-grid-responsive-3">
                  <div>
                    <Label htmlFor="salaryAmount">Salary Amount</Label>
                    <Input
                      id="salaryAmount"
                      type="number"
                      value={formData.salaryAmount}
                      onChange={(e) => setFormData({...formData, salaryAmount: e.target.value})}
                      placeholder="Enter salary amount"
                    />
                  </div>
                  <div>
                    <Label htmlFor="salaryMode">Salary Mode</Label>
                    <Select value={formData.salaryMode} onValueChange={(value: 'monthly' | 'hourly' | 'daily') => setFormData({...formData, salaryMode: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="upiId">UPI ID</Label>
                    <Input
                      id="upiId"
                      value={formData.upiId}
                      onChange={(e) => setFormData({...formData, upiId: e.target.value})}
                      placeholder="Enter UPI ID"
                    />
                  </div>
                </div>
                <div className="form-grid-responsive-3">
                  <div>
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input
                      id="bankName"
                      value={formData.bankName}
                      onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                      placeholder="Enter bank name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="accountNo">Account Number</Label>
                    <Input
                      id="accountNo"
                      value={formData.accountNo}
                      onChange={(e) => setFormData({...formData, accountNo: e.target.value})}
                      placeholder="Enter account number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ifsc">IFSC Code</Label>
                    <Input
                      id="ifsc"
                      value={formData.ifsc}
                      onChange={(e) => setFormData({...formData, ifsc: e.target.value})}
                      placeholder="Enter IFSC code"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address (Optional)</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Enter address"
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Emergency Contact (Optional)</h3>
                <div className="form-grid-responsive-3">
                  <div>
                    <Label htmlFor="emergencyContactName">Name</Label>
                    <Input
                      id="emergencyContactName"
                      value={formData.emergencyContactName}
                      onChange={(e) => setFormData({...formData, emergencyContactName: e.target.value})}
                      placeholder="Contact name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyContactPhone">Phone</Label>
                    <Input
                      id="emergencyContactPhone"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => setFormData({...formData, emergencyContactPhone: e.target.value})}
                      placeholder="Contact phone"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyContactRelation">Relation</Label>
                    <Input
                      id="emergencyContactRelation"
                      value={formData.emergencyContactRelation}
                      onChange={(e) => setFormData({...formData, emergencyContactRelation: e.target.value})}
                      placeholder="e.g., Spouse, Parent"
                    />
                  </div>
                </div>
              </div>

              <div className="responsive-actions">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="btn-responsive">
                  Cancel
                </Button>
                <Button type="submit" className="btn-responsive bg-gradient-to-r from-blue-600 to-purple-600">
                  {editingStaff ? 'Update Staff Member' : 'Add Staff Member'}
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
            <CardTitle className="responsive-text-sm font-medium text-gray-600 dark:text-gray-400">Total Staff</CardTitle>
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{totalStaff}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">All team members</p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="responsive-text-sm font-medium text-gray-600 dark:text-gray-400">Active Staff</CardTitle>
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{activeStaff}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Currently working</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="responsive-text-sm font-medium text-gray-600 dark:text-gray-400">Departments</CardTitle>
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="card-content-responsive">
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{departments.length}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active departments</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="search-filter-container">
        <div className="relative flex-1">
          <Search className="absolute left-2 sm:left-3 top-2.5 sm:top-3 h-3 w-3 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Search staff..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 sm:pl-10 responsive-text-sm h-8 sm:h-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
        </div>
        <div className="responsive-actions">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="btn-responsive bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
          >
            <Filter className="h-3 w-3 sm:h-4 sm:w-4" />
            Filters
          </Button>
          {(joinDateFrom || joinDateTo || searchTerm) && (
            <Button
              variant="outline"
              onClick={clearFilters}
              className="btn-responsive bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Date Filters */}
      {showFilters && (
        <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">Date Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="form-grid-responsive">
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Join Date From</Label>
                <DatePicker
                  date={joinDateFrom}
                  onDateChange={setJoinDateFrom}
                  placeholder="Select start date"
                />
              </div>
              <div>
                <Label className="text-gray-700 dark:text-gray-300">Join Date To</Label>
                <DatePicker
                  date={joinDateTo}
                  onDateChange={setJoinDateTo}
                  placeholder="Select end date"
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={fetchData} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">Apply Filters</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff List */}
      <Card className="border-0 shadow-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-gray-100">Staff Members</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">Manage your team members</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredStaff.length > 0 ? (
            <div className="space-y-4">
              {filteredStaff.map((member) => (
                <div key={member.id} className="mobile-item-card">
                  {/* Desktop Layout */}
                  <div className="hidden md:flex items-center justify-between">
                    <div 
                      className="flex-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-3 rounded-lg transition-colors"
                      onClick={() => {
                        setSelectedStaff(member);
                        setShowStaffProfile(true);
                      }}
                    >
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{member.name || 'Unknown'}</h3>
                            <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{member.role || 'No Role'} • {member.department || 'No Department'}</p>
                          {member.email && (
                            <p className="text-xs text-blue-600 dark:text-blue-400">Email: {member.email}</p>
                          )}
                          {member.password && (
                            <p className="text-xs text-green-600 dark:text-green-400">Password: {member.password}</p>
                          )}
                          {member.salaryAmount && (
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              Salary: ₹{member.salaryAmount.toLocaleString()}/{member.salaryMode}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(member.skills || []).slice(0, 3).map((skill, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {(member.skills || []).length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{(member.skills || []).length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge 
                          variant={member.status === 'active' ? 'default' : 'secondary'}
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStatus(member.id, member.status);
                          }}
                        >
                          {member.status || 'Unknown'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ContactActions 
                        phone={member.phone}
                        message={`Hi ${member.name}, this is regarding your work schedule.`}
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(member);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(member.id);
                        }}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div 
                    className="md:hidden space-y-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-3 rounded-lg transition-colors"
                    onClick={() => {
                      setSelectedStaff(member);
                      setShowStaffProfile(true);
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{member.name || 'Unknown'}</h3>
                          <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{member.role || 'No Role'} • {member.department || 'No Department'}</p>
                      </div>
                      <Badge 
                        variant={member.status === 'active' ? 'default' : 'secondary'}
                        className="cursor-pointer text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStatus(member.id, member.status);
                        }}
                      >
                        {member.status || 'Unknown'}
                      </Badge>
                    </div>

                    {member.email && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">Email: {member.email}</p>
                    )}
                    
                    {member.password && (
                      <p className="text-xs text-green-600 dark:text-green-400">Password: {member.password}</p>
                    )}
                    
                    {member.salaryAmount && (
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Salary: ₹{member.salaryAmount.toLocaleString()}/{member.salaryMode}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {(member.skills || []).slice(0, 2).map((skill, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {(member.skills || []).length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{(member.skills || []).length - 2} more
                        </Badge>
                      )}
                    </div>

                    <div className="flex justify-between items-center">
                      <ContactActions 
                        phone={member.phone}
                        message={`Hi ${member.name}, this is regarding your work schedule.`}
                      />
                      <div className="responsive-actions">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(member);
                          }} 
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(member.id);
                          }}
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
          ) : (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No staff members</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchTerm ? 'No staff members match your search.' : 'Add your first staff member to get started.'}
              </p>
              {!searchTerm && (
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-500 dark:to-purple-500 dark:hover:from-blue-600 dark:hover:to-purple-600"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Staff Member
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Profile Modal */}
      <Dialog open={showStaffProfile} onOpenChange={setShowStaffProfile}>
        <DialogContent className="mobile-dialog max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Staff Profile
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 sm:p-6">
            {selectedStaff && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div className="flex-1 mb-4 sm:mb-0">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">{selectedStaff.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedStaff.role} • {selectedStaff.department}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <Badge 
                      variant={selectedStaff.status === 'active' ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => toggleStatus(selectedStaff.id, selectedStaff.status)}
                    >
                      {selectedStaff.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">Phone Number</Label>
                    <Input
                      value={selectedStaff.phone}
                      readOnly
                      className="bg-gray-100 dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">Email</Label>
                    <Input
                      value={selectedStaff.email}
                      readOnly
                      className="bg-gray-100 dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">Skills</Label>
                    <div className="flex flex-wrap gap-2">
                      {(selectedStaff.skills || []).map((skill, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">Salary</Label>
                    <Input
                      value={`₹${selectedStaff.salaryAmount?.toLocaleString()}/${selectedStaff.salaryMode}`}
                      readOnly
                      className="bg-gray-100 dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">Join Date</Label>
                    <Input
                      value={selectedStaff.joinDate?.toDate().toLocaleDateString()}
                      readOnly
                      className="bg-gray-100 dark:bg-gray-700"
                    />
                  </div>
                </div>

                {/* Emergency Contact */}
                {selectedStaff.emergencyContact && (
                  <div className="mt-6">
                    <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">Emergency Contact</h4>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-gray-700 dark:text-gray-300">Name</Label>
                        <Input
                          value={selectedStaff.emergencyContact.name}
                          readOnly
                          className="bg-gray-100 dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-700 dark:text-gray-300">Phone</Label>
                        <Input
                          value={selectedStaff.emergencyContact.phone}
                          readOnly
                          className="bg-gray-100 dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-700 dark:text-gray-300">Relation</Label>
                        <Input
                          value={selectedStaff.emergencyContact.relation}
                          readOnly
                          className="bg-gray-100 dark:bg-gray-700"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowStaffProfile(false)}
                    className="btn-responsive"
                  >
                    Close
                  </Button>
                  <Button 
                    onClick={() => {
                      handleEdit(selectedStaff);
                      setShowStaffProfile(false);
                    }}
                    className="btn-responsive bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    Edit Staff Member
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Staff Profile Modal */}
      <StaffProfileModal
        isOpen={showStaffProfile}
        onClose={() => {
          setShowStaffProfile(false);
          setSelectedStaff(null);
        }}
        staff={selectedStaff}
      />
      </div>
    </div>
  );
};

export default Staff;
