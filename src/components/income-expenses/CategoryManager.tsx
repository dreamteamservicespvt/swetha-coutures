import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Tag, X } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface CategoryManagerProps {
  type: 'income' | 'expense';
  isOpen: boolean;
  onClose: () => void;
  onCategoryAdded?: () => void;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  createdAt: any;
  isDefault?: boolean;
}

const CategoryManager = ({ type, isOpen, onClose, onCategoryAdded }: CategoryManagerProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchCategories = async () => {
    try {
      const categoriesQuery = query(
        collection(db, 'categories'),
        where('type', '==', type),
        orderBy('name', 'asc')
      );
      const snapshot = await getDocs(categoriesQuery);
      const categoriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen, type]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsLoading(true);
    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName.trim(),
        type,
        createdAt: new Date(),
        isDefault: false
      });

      toast({
        title: "Success",
        description: `${type === 'income' ? 'Income' : 'Expense'} category added successfully`,
      });

      setNewCategoryName('');
      fetchCategories();
      onCategoryAdded?.();
    } catch (error) {
      console.error('Error adding category:', error);
      toast({
        title: "Error",
        description: "Failed to add category",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (window.confirm(`Are you sure you want to delete "${categoryName}"? This action cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, 'categories', categoryId));
        toast({
          title: "Success",
          description: "Category deleted successfully",
        });
        fetchCategories();
        onCategoryAdded?.();
      } catch (error) {
        console.error('Error deleting category:', error);
        toast({
          title: "Error",
          description: "Failed to delete category",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Tag className="h-5 w-5 mr-2" />
            Manage {type === 'income' ? 'Income' : 'Expense'} Categories
          </DialogTitle>
          <DialogDescription>
            Add or remove custom categories for better organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAddCategory} className="space-y-4">
          <div>
            <Label htmlFor="categoryName">Category Name</Label>
            <div className="flex space-x-2">
              <Input
                id="categoryName"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={`New ${type} category`}
                required
              />
              <Button type="submit" disabled={isLoading} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          <h4 className="font-medium text-sm text-gray-700">Existing Categories:</h4>
          {categories.length > 0 ? (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-2 border rounded-lg bg-gray-50"
                >
                  <span className="text-sm">{category.name}</span>
                  {!category.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(category.id, category.name)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No custom categories yet.</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryManager;
