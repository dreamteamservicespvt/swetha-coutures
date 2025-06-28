
import React from 'react';
import { Button } from '@/components/ui/button';
import { Phone, MessageCircle } from 'lucide-react';
import { generateWhatsAppLink, generateCallLink } from '@/utils/contactUtils';

interface ContactActionsProps {
  phone: string;
  message?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
}

const ContactActions: React.FC<ContactActionsProps> = ({ 
  phone, 
  message = '', 
  size = 'sm', 
  variant = 'outline' 
}) => {
  const handleCall = () => {
    window.open(generateCallLink(phone), '_self');
  };

  const handleWhatsApp = () => {
    window.open(generateWhatsAppLink(phone, message), '_blank');
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        size={size}
        variant={variant}
        className="text-blue-600 hover:bg-blue-50"
        onClick={handleCall}
      >
        <Phone className="h-3 w-3" />
      </Button>
      <Button
        size={size}
        variant={variant}
        className="text-green-600 hover:bg-green-50"
        onClick={handleWhatsApp}
      >
        <MessageCircle className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default ContactActions;
