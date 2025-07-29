
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, DollarSign, Search, Edit, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';
import ImageViewer from '@/components/ImageViewer';
import CategoryInput from '@/components/CategoryInput';

interface Expense {
  id: string;
  title: string;
  description: string;
  amount: number;
  category: 'personal' | 'professional';
  type: string;
  date: string;
  receiptImage?: string;
  notes?: string;
  createdAt: any;
}

const Expenses = () => {
  const { userData } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<string>('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: 0,
    category: 'professional' as 'personal' | 'professional',
    type: '',
    date: '',
    notes: ''
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const expensesQuery = query(
        collection(db, 'expenses'),
        orderBy('date', 'desc')
      );
      const expensesSnapshot = await getDocs(expensesQuery);
      const expensesData = expensesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      
      setExpenses(expensesData);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast({
        title: "Error",
        description: "Failed to fetch expenses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expenseData = {
        ...formData,
        ...(editingExpense ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp() })
      };

      if (editingExpense) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), expenseData);
        toast({
          title: "Success",
          description: "Expense updated successfully",
        });
      } else {
        await addDoc(collection(db, 'expenses'), expenseData);
        toast({
          title: "Success",
          description: "Expense added successfully",
        });
      }

      setIsDialogOpen(false);
      setEditingExpense(null);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({
        title: "Error",
        description: "Failed to save expense",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      amount: 0,
      category: 'professional',
      type: '',
      date: '',
      notes: ''
    });
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      title: expense.title,
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      type: expense.type,
      date: expense.date,
      notes: expense.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (expenseId: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await deleteDoc(doc(db, 'expenses', expenseId));
        toast({
          title: "Success",
          description: "Expense deleted successfully",
        });
        fetchExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
        toast({
          title: "Error",
          description: "Failed to delete expense",
          variant: "destructive",
        });
      }
    }
  };

  const uploadReceipt = async (file: File, expenseId: string) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'swetha');

      const response = await fetch('https://api.cloudinary.com/v1_1/dvmrhs2ek/image/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.secure_url) {
        await updateDoc(doc(db, 'expenses', expenseId), {
          receiptImage: data.secure_url,
          updatedAt: serverTimestamp()
        });

        toast({
          title: "Success",
          description: "Receipt uploaded successfully",
        });
        fetchExpenses();
      }
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast({
        title: "Error",
        description: "Failed to upload receipt",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const openImageViewer = (imageUrl: string) => {
    setCurrentImage(imageUrl);
    setImageViewerOpen(true);
  };

  const filteredExpenses = expenses.filter(expense =>
    expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Expense Management</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
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

  const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const professionalExpenses = expenses.filter(exp => exp.category === 'professional').reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const personalExpenses = expenses.filter(exp => exp.category === 'personal').reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const thisMonthExpenses = expenses.filter(exp => {
    const expenseDate = new Date(exp.date);
    const now = new Date();
    return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
  }).reduce((sum, expense) => sum + (expense.amount || 0), 0);

  // Group expenses by date
  const groupedExpenses = filteredExpenses.reduce((groups: { [key: string]: Expense[] }, expense) => {
    const date = expense.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(expense);
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expense Management</h1>
          <p className="text-gray-600">Track business and personal expenses</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              onClick={() => {
                setEditingExpense(null);
                resetForm();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] w-full sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">
                {editingExpense ? 'Edit Expense' : 'Add New Expense'}
              </DialogTitle>
              <DialogDescription className="text-sm">
                Fill in the expense details below.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <Label htmlFor="title" className="text-sm font-medium">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Expense title"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Expense description"
                  rows={2}
                  className="mt-1 resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="amount" className="text-sm font-medium">Amount (₹)</Label>
                  <NumberInput
                    id="amount"
                    value={formData.amount}
                    onChange={(value) => setFormData({...formData, amount: value || 0})}
                    min={0}
                    step={0.01}
                    decimals={2}
                    allowEmpty={false}
                    emptyValue={0}
                    placeholder="0.00"
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="date" className="text-sm font-medium">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="mt-1"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                  <select
                    id="category"
                    className="w-full p-2 mt-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value as 'personal' | 'professional'})}
                    required
                  >
                    <option value="professional">Professional</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="type" className="text-sm font-medium">Type</Label>
                  <CategoryInput
                    value={formData.type}
                    onChange={(value) => setFormData({...formData, type: value})}
                    type="expense"
                    placeholder="Enter expense type..."
                    className="mt-1"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes" className="text-sm font-medium">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes"
                  rows={2}
                  className="mt-1 resize-none"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 w-full sm:w-auto"
                >
                  {editingExpense ? 'Update Expense' : 'Add Expense'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Expenses</CardTitle>
            <DollarSign className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">₹{totalExpenses.toLocaleString()}</div>
            <p className="text-xs text-gray-500">All time expenses</p>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Professional</CardTitle>
            <DollarSign className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">₹{professionalExpenses.toLocaleString()}</div>
            <p className="text-xs text-gray-500">Business expenses</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Personal</CardTitle>
            <DollarSign className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">₹{personalExpenses.toLocaleString()}</div>
            <p className="text-xs text-gray-500">Personal expenses</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">This Month</CardTitle>
            <DollarSign className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">₹{thisMonthExpenses.toLocaleString()}</div>
            <p className="text-xs text-gray-500">Current month</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Expenses by Date */}
      {Object.keys(groupedExpenses).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedExpenses)
            .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
            .map(([date, dateExpenses]) => (
            <Card key={date} className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">{new Date(date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</CardTitle>
                <CardDescription>
                  Total: ₹{dateExpenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dateExpenses.map((expense) => (
                    <Card key={expense.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{expense.title}</h3>
                            <p className="text-sm text-gray-600">{expense.description}</p>
                          </div>
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(expense)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(expense.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center mb-2">
                          <Badge className={
                            expense.category === 'professional' ? 
                            'bg-blue-100 text-blue-700' : 
                            'bg-green-100 text-green-700'
                          }>
                            {expense.category}
                          </Badge>
                          <span className="font-bold text-lg">₹{expense.amount.toLocaleString()}</span>
                        </div>
                        
                        <div className="text-sm text-gray-500 mb-2">{expense.type}</div>
                        
                        {expense.receiptImage && (
                          <div className="mb-2">
                            <img 
                              src={expense.receiptImage} 
                              alt="Receipt" 
                              className="w-full h-24 object-cover rounded cursor-pointer"
                              onClick={() => openImageViewer(expense.receiptImage!)}
                            />
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-500">
                            {expense.notes && (
                              <div className="truncate">{expense.notes}</div>
                            )}
                          </div>
                          <div className="flex space-x-1">
                            {expense.receiptImage ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openImageViewer(expense.receiptImage!)}
                              >
                                <ImageIcon className="h-3 w-3" />
                              </Button>
                            ) : (
                              <>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) uploadReceipt(file, expense.id);
                                  }}
                                  style={{ display: 'none' }}
                                  id={`receipt-${expense.id}`}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => document.getElementById(`receipt-${expense.id}`)?.click()}
                                  disabled={uploadingImage}
                                >
                                  <Upload className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'No expenses match your search.' : 'Start by adding your first expense.'}
            </p>
            {!searchTerm && (
              <Button 
                className="bg-gradient-to-r from-blue-600 to-purple-600"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Expense
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Image Viewer */}
      <ImageViewer
        images={currentImage ? [currentImage] : []}
        currentIndex={0}
        isOpen={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        title="Receipt Image"
      />
    </div>
  );
};

export default Expenses;
