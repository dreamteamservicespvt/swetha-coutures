import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Plus, ChevronDown, Star, Clock } from 'lucide-react';
import { WorkDescription, getWorkDescriptions, addWorkDescription, updateWorkDescriptionUsage, getMostUsedWorkDescriptions } from '@/utils/workDescriptions';
import { toast } from '@/hooks/use-toast';

interface WorkDescriptionInputProps {
  value: string;
  onChange: (value: string, defaultRate?: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const WorkDescriptionInput: React.FC<WorkDescriptionInputProps> = ({
  value,
  onChange,
  placeholder = "Enter work description...",
  disabled = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [workDescriptions, setWorkDescriptions] = useState<WorkDescription[]>([]);
  const [mostUsed, setMostUsed] = useState<WorkDescription[]>([]);
  const [filteredDescriptions, setFilteredDescriptions] = useState<WorkDescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDescriptionMode, setNewDescriptionMode] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newRate, setNewRate] = useState<number | ''>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Categories for new descriptions
  const categories = ['Stitching', 'Alterations', 'Tailoring', 'Designing', 'Embroidery', 'Materials', 'Services', 'Other'];

  useEffect(() => {
    loadWorkDescriptions();
  }, []);

  useEffect(() => {
    if (value && workDescriptions.length > 0) {
      const filtered = workDescriptions.filter(desc =>
        desc.description.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredDescriptions(filtered);
    } else {
      setFilteredDescriptions(workDescriptions);
    }
  }, [value, workDescriptions]);

  const loadWorkDescriptions = async () => {
    try {
      setLoading(true);
      const [descriptions, mostUsedDescs] = await Promise.all([
        getWorkDescriptions(),
        getMostUsedWorkDescriptions()
      ]);
      setWorkDescriptions(descriptions);
      setMostUsed(mostUsedDescs);
      setFilteredDescriptions(descriptions);
    } catch (error) {
      console.error('Error loading work descriptions:', error);
      toast({
        title: "Error",
        description: "Failed to load work descriptions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDescription = async (description: WorkDescription) => {
    onChange(description.description, description.defaultRate);
    setIsOpen(false);
    
    // Update usage count
    try {
      await updateWorkDescriptionUsage(description.id);
      // Refresh most used list
      const updatedMostUsed = await getMostUsedWorkDescriptions();
      setMostUsed(updatedMostUsed);
    } catch (error) {
      console.error('Error updating usage count:', error);
    }
  };

  const handleAddNewDescription = async () => {
    if (!value.trim() || !newCategory) {
      toast({
        title: "Validation Error",
        description: "Please enter description and select category",
        variant: "destructive"
      });
      return;
    }

    try {
      await addWorkDescription(value.trim(), newCategory, Number(newRate) || 0);
      await loadWorkDescriptions();
      setNewDescriptionMode(false);
      setNewCategory('');
      setNewRate('');
      toast({
        title: "Success",
        description: "Work description added successfully",
      });
    } catch (error) {
      console.error('Error adding description:', error);
      toast({
        title: "Error",
        description: "Failed to add work description",
        variant: "destructive"
      });
    }
  };

  const groupedDescriptions = workDescriptions.reduce((acc, desc) => {
    if (!acc[desc.category]) {
      acc[desc.category] = [];
    }
    acc[desc.category].push(desc);
    return acc;
  }, {} as Record<string, WorkDescription[]>);

  return (
    <div className={`relative ${className}`}>
      <Label className="text-sm font-medium text-gray-700 mb-1 block">
        Work Description *
      </Label>
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              placeholder={placeholder}
              disabled={disabled}
              className={`pr-8 ${value ? 'font-medium' : ''}`}
              onFocus={(e) => {
                // Prevent default focusing behavior to avoid dropdown closing issues
                e.stopPropagation();
                setIsOpen(true);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isOpen) setIsOpen(true);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsOpen(!isOpen);
              }}
              disabled={disabled}
            >
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </Button>
          </div>
        </PopoverTrigger>
        
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search work descriptions..."
              value={value}
              onValueChange={onChange}
            />
            <CommandList className="max-h-80">
              {loading ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  Loading descriptions...
                </div>
              ) : (
                <>
                  {/* Most Used Section */}
                  {mostUsed.length > 0 && (
                    <CommandGroup heading="Most Used">
                      {mostUsed.map((desc) => (
                        <CommandItem
                          key={desc.id}
                          onSelect={() => handleSelectDescription(desc)}
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-blue-50"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{desc.description}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {desc.category}
                              </Badge>
                              {desc.defaultRate && desc.defaultRate > 0 && (
                                <span>₹{desc.defaultRate}</span>
                              )}
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{desc.usageCount || 0} uses</span>
                              </div>
                            </div>
                          </div>
                          <Star className="h-4 w-4 text-yellow-500" />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {/* All Descriptions by Category */}
                  {Object.entries(groupedDescriptions).map(([category, descriptions]) => (
                    <CommandGroup key={category} heading={category}>
                      {descriptions
                        .filter(desc => 
                          desc.description.toLowerCase().includes(value.toLowerCase()) ||
                          value === ''
                        )
                        .map((desc) => (
                          <CommandItem
                            key={desc.id}
                            onSelect={() => handleSelectDescription(desc)}
                            className="flex items-center justify-between p-3 cursor-pointer"
                          >
                            <div className="flex-1">
                              <div className="font-medium">{desc.description}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-2">
                                {desc.defaultRate && desc.defaultRate > 0 && (
                                  <span>Default: ₹{desc.defaultRate}</span>
                                )}
                                {desc.usageCount > 0 && (
                                  <span>{desc.usageCount} uses</span>
                                )}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  ))}

                  {/* Add New Description */}
                  {value && !workDescriptions.some(desc => 
                    desc.description.toLowerCase() === value.toLowerCase()
                  ) && (
                    <CommandGroup heading="Add New">
                      <div className="p-3 border-t">
                        {!newDescriptionMode ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setNewDescriptionMode(true)}
                            className="w-full justify-center gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add "{value}" as new description
                          </Button>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs">Category</Label>
                              <select
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                className="w-full mt-1 text-sm border rounded px-2 py-1"
                              >
                                <option value="">Select category</option>
                                {categories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs">Default Rate (₹)</Label>
                              <Input
                                type="number"
                                value={newRate}
                                onChange={(e) => setNewRate(e.target.value === '' ? '' : Number(e.target.value))}
                                placeholder="0"
                                className="text-sm mt-1"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleAddNewDescription}
                                className="flex-1"
                              >
                                Add
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setNewDescriptionMode(false);
                                  setNewCategory('');
                                  setNewRate('');
                                }}
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CommandGroup>
                  )}

                  {filteredDescriptions.length === 0 && !loading && !newDescriptionMode && (
                    <CommandEmpty>
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500 mb-2">No descriptions found</p>
                        {value && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setNewDescriptionMode(true)}
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add "{value}"
                          </Button>
                        )}
                      </div>
                    </CommandEmpty>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default WorkDescriptionInput;
