
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, DollarSign, Receipt } from 'lucide-react';

interface BillWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerPhone: string;
  defaultMessage: string;
}

const BillWhatsAppModal: React.FC<BillWhatsAppModalProps> = ({
  isOpen,
  onClose,
  customerName,
  customerPhone,
  defaultMessage
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customMessage, setCustomMessage] = useState(defaultMessage);

  const messageTemplates = {
    billDelivery: defaultMessage,
    paymentReminder: `Dear ${customerName}, this is a gentle reminder about your pending payment. Please settle your bill at your earliest convenience. Thank you for choosing Swetha's Couture!`,
    thankYou: `Dear ${customerName}, thank you for your payment! We appreciate your business. Looking forward to serving you again at Swetha's Couture! 🪡✨`
  };

  const categories = [
    {
      id: 'billDelivery',
      title: 'Bill Delivery',
      icon: Receipt,
      description: 'Send bill details to customer'
    },
    {
      id: 'paymentReminder',
      title: 'Payment Reminder',
      icon: DollarSign,
      description: 'Remind customer about pending payment'
    },
    {
      id: 'thankYou',
      title: 'Thank You',
      icon: MessageSquare,
      description: 'Thank customer for payment'
    }
  ];

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCustomMessage(messageTemplates[categoryId as keyof typeof messageTemplates]);
  };

  const sendWhatsAppMessage = () => {
    const phone = customerPhone.replace(/\D/g, '');
    const formattedPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const message = encodeURIComponent(customMessage);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${message}`;
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send WhatsApp Message</DialogTitle>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>To: {customerName}</span>
            <Badge variant="outline">{customerPhone}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Category Selection */}
          <div>
            <h3 className="text-sm font-medium mb-3">Choose Message Type:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    className="h-auto p-4 flex flex-col items-center text-center"
                    onClick={() => handleCategorySelect(category.id)}
                  >
                    <Icon className="h-6 w-6 mb-2" />
                    <div className="font-medium">{category.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{category.description}</div>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Message Preview/Edit */}
          <div>
            <h3 className="text-sm font-medium mb-2">Message Preview & Edit:</h3>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              placeholder="Your message will appear here..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={sendWhatsAppMessage}
              disabled={!customMessage.trim()}
              className="bg-green-600 hover:bg-green-700"
            >
              Send via WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BillWhatsAppModal;
