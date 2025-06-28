import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Wrench } from 'lucide-react';
import WorkDescriptionInput from '@/components/WorkDescriptionInput';
import { formatCurrency } from '@/utils/billingUtils';

export interface WorkItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

// MaterialItem interface kept for backward compatibility
export interface MaterialItem {
  id: string;
  description: string;
  inventoryId?: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface BillWorkAndMaterialsProps {
  workItems: WorkItem[];
  materialItems: MaterialItem[]; // Kept for backward compatibility
  onWorkItemsChange: (items: WorkItem[]) => void;
  onMaterialItemsChange: (items: MaterialItem[]) => void; // Kept for backward compatibility
}

const BillWorkAndMaterials: React.FC<BillWorkAndMaterialsProps> = ({
  workItems,
  onWorkItemsChange
}) => {
  // Work Items Functions
  const addWorkItem = () => {
    const newWorkItem: WorkItem = {
      id: uuidv4(),
      description: '',
      quantity: 1,
      rate: 0,
      amount: 0
    };
    onWorkItemsChange([...workItems, newWorkItem]);
  };

  const updateWorkItem = (id: string, field: keyof WorkItem, value: any) => {
    const updatedItems = workItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updatedItem.amount = updatedItem.quantity * updatedItem.rate;
        }
        return updatedItem;
      }
      return item;
    });
    onWorkItemsChange(updatedItems);
  };

  const removeWorkItem = (id: string) => {
    onWorkItemsChange(workItems.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Work Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-purple-600" />
              Work
            </div>
            <Button type="button" onClick={addWorkItem} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Work Type
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workItems.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-blue-50">
                <div className="lg:col-span-2">
                  {/* Label is now inside WorkDescriptionInput component, so removing it here */}
                  <WorkDescriptionInput
                    value={item.description}
                    onChange={(value, defaultRate) => {
                      updateWorkItem(item.id, 'description', value);
                      if (defaultRate && defaultRate > 0 && item.rate === 0) {
                        updateWorkItem(item.id, 'rate', defaultRate);
                      }
                    }}
                    placeholder="Enter work description..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`work-qty-${item.id}`} className="text-sm font-medium text-gray-700">
                    Quantity *
                  </Label>
                  <Input
                    id={`work-qty-${item.id}`}
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateWorkItem(item.id, 'quantity', Number(e.target.value))}
                    min="1"
                    className="mt-1 bg-white"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor={`work-rate-${item.id}`} className="text-sm font-medium text-gray-700">
                    Rate (₹) *
                  </Label>
                  <Input
                    id={`work-rate-${item.id}`}
                    type="number"
                    value={item.rate === 0 ? '' : item.rate}
                    onChange={(e) => updateWorkItem(item.id, 'rate', e.target.value === '' ? 0 : Number(e.target.value))}
                    min="0"
                    step="0.01"
                    className="mt-1 bg-white"
                    placeholder="Enter rate"
                    required
                  />
                </div>
                <div className="flex items-end justify-between">
                  <div className="flex-1 mr-2">
                    <Label className="text-sm font-medium text-gray-700">Amount (₹)</Label>
                    <Input
                      value={formatCurrency(item.amount || 0)}
                      readOnly
                      className="mt-1 bg-gray-100 border-gray-200 font-semibold text-green-700"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeWorkItem(item.id)}
                    className="text-red-600 hover:bg-red-50 hover:border-red-200"
                    title="Remove work item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {workItems.length === 0 && (
              <div className="text-center py-8 text-gray-500 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-2 border-dashed border-purple-200">
                <Wrench className="h-12 w-12 mx-auto mb-4 text-purple-400" />
                <p className="text-lg font-medium">No work items added yet</p>
                <p className="text-sm">Click "Add Work Type" to add stitching, alterations, etc.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillWorkAndMaterials;
