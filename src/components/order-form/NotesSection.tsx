
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';
import { UseFormRegister } from 'react-hook-form';

interface OrderFormData {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  itemType: string;
  quantity: number;
  status: string;
  orderDate: string;
  deliveryDate: string;
  totalAmount: number;
  advanceAmount: number;
  notes: string;
}

interface NotesSectionProps {
  register: UseFormRegister<OrderFormData>;
}

const NotesSection: React.FC<NotesSectionProps> = ({ register }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          {...register('notes')}
          placeholder="Any special instructions or notes..."
          rows={3}
        />
      </CardContent>
    </Card>
  );
};

export default NotesSection;
