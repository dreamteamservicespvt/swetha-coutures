
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Users } from 'lucide-react';

interface Staff {
  id: string;
  name: string;
  designation: string;
  phone: string;
  profileImage?: string;
}

interface StaffAssignmentProps {
  selectedStaff: string[];
  onChange: (staffIds: string[]) => void;
}

const StaffAssignment: React.FC<StaffAssignmentProps> = ({
  selectedStaff,
  onChange
}) => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const staffData = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Staff[];
      setStaff(staffData);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffToggle = (staffId: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedStaff, staffId]);
    } else {
      onChange(selectedStaff.filter(id => id !== staffId));
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Assign Staff</Label>
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading staff...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label className="flex items-center">
        <Users className="h-4 w-4 mr-2" />
        Assign Staff
      </Label>
      
      {staff.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {staff.map((member) => {
            const isSelected = selectedStaff.includes(member.id);
            return (
              <label 
                key={member.id}
                htmlFor={`staff-${member.id}`}
                className="cursor-pointer"
                role="checkbox"
                aria-checked={isSelected}
              >
                <Card 
                  className={`p-3 transition-all duration-200 hover:shadow-md ${
                    isSelected 
                      ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200' 
                      : 'hover:bg-gray-50 dark:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`staff-${member.id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleStaffToggle(member.id, checked as boolean)}
                    />
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.profileImage} />
                      <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{member.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{member.designation}</div>
                      <div className="text-xs text-gray-400">{member.phone}</div>
                    </div>
                  </div>
                </Card>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-gray-500 p-4 border rounded-md">
          No staff members found. Add staff members in the Admin section.
        </div>
      )}
    </div>
  );
};

export default StaffAssignment;
