
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Copy, Download, MessageSquare, Send, Sparkles } from 'lucide-react';

interface BulkWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumbers: string[];
}

const BulkWhatsAppModal: React.FC<BulkWhatsAppModalProps> = ({ isOpen, onClose, phoneNumbers }) => {
  const [normalizedNumbers, setNormalizedNumbers] = useState<string[]>([]);
  const [presetMessage, setPresetMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  // Preset message templates similar to billing system
  const messageTemplates = {
    'general-greeting': `Hi! 👋

Thank you for choosing Swetha's Couture! We have exciting updates and offers for you.

We appreciate your continued trust in our services and look forward to serving you again soon! ✨

Best regards,
Swetha's Couture Team`,

    'new-collection': `🌟 NEW COLLECTION ALERT! 🌟

Dear Valued Customer,

We're thrilled to announce our latest collection at Swetha's Couture! 

✨ Latest Fashion Trends
🪡 Premium Quality Fabrics  
👗 Custom Designs Available
🎨 Professional Tailoring

Visit us today to explore our stunning new arrivals!

Best regards,
Swetha's Couture Team`,

    'special-offer': `🎉 SPECIAL OFFER JUST FOR YOU! 🎉

Dear Customer,

We have an exclusive offer waiting for you at Swetha's Couture:

🔥 Special Discount Available
💎 Premium Services
🚀 Quick Turnaround Time
✅ 100% Satisfaction Guaranteed

Don't miss out on this limited-time offer!

Contact us today!

Swetha's Couture Team`,

    'appointment-reminder': `📅 APPOINTMENT REMINDER

Hello!

This is a friendly reminder about our services at Swetha's Couture.

We're here to help you with:
• Custom Tailoring
• Design Consultations
• Alterations
• Premium Fabrics

Book your appointment today for personalized service!

Best regards,
Swetha's Couture Team`,

    'festival-wishes': `🎊 FESTIVAL GREETINGS! 🎊

Dear Customer,

Wishing you and your family a very happy and prosperous festival season!

Make this celebration special with our:
✨ Festival Collection
🌺 Traditional Wear
👑 Ethnic Designs
🎨 Custom Creations

Let us help you look your best for the festivities!

With warm wishes,
Swetha's Couture Team`,

    'thank-you': `💜 THANK YOU! 💜

Dear Valued Customer,

Thank you for choosing Swetha's Couture for your tailoring needs!

Your trust in our services means the world to us. We're committed to providing you with:

🌟 Exceptional Quality
⚡ Timely Delivery  
💎 Premium Service
😊 Customer Satisfaction

We look forward to serving you again!

With gratitude,
Swetha's Couture Team`
  };

  React.useEffect(() => {
    if (phoneNumbers.length > 0) {
      const normalized = phoneNumbers.map(phone => {
        let num = phone.replace(/^0+/, "").replace(/^\+?91/, "");
        return "+91" + num;
      });
      setNormalizedNumbers(normalized);
    }
  }, [phoneNumbers]);

  React.useEffect(() => {
    // Set default message when template changes
    if (selectedTemplate && messageTemplates[selectedTemplate as keyof typeof messageTemplates]) {
      setPresetMessage(messageTemplates[selectedTemplate as keyof typeof messageTemplates]);
    }
  }, [selectedTemplate]);

  const numbersText = normalizedNumbers.join(', ');

  const handleCopyNumbers = async () => {
    try {
      await navigator.clipboard.writeText(numbersText);
      toast({
        title: "Success",
        description: "Phone numbers copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(presetMessage);
      toast({
        title: "Success",
        description: "Message copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy message",
        variant: "destructive",
      });
    }
  };

  const handleDownloadTxt = () => {
    const content = numbersText;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-phone-numbers.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Success",
      description: "Phone numbers downloaded as TXT file",
    });
  };

  const handleDownloadExcel = () => {
    const csvContent = "Phone Number\n" + normalizedNumbers.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-phone-numbers.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Success",
      description: "Phone numbers downloaded as CSV file",
    });
  };

  const handleSendBulkWhatsApp = () => {
    if (!presetMessage.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    // Create WhatsApp links for each number
    const whatsappLinks = normalizedNumbers.map(phone => {
      const cleanPhone = phone.replace(/\D/g, '');
      const encodedMessage = encodeURIComponent(presetMessage);
      return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    });

    // Open WhatsApp links (limit to first few to avoid browser blocking)
    const maxLinks = Math.min(5, whatsappLinks.length);
    whatsappLinks.slice(0, maxLinks).forEach((link, index) => {
      setTimeout(() => {
        window.open(link, '_blank');
      }, index * 1000); // Stagger opening by 1 second
    });

    if (whatsappLinks.length > maxLinks) {
      toast({
        title: "Partial Send",
        description: `Opened ${maxLinks} WhatsApp chats. Copy remaining numbers manually.`,
      });
    } else {
      toast({
        title: "Success",
        description: `Opened ${whatsappLinks.length} WhatsApp chats`,
      });
    }
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Bulk WhatsApp Messaging
          </DialogTitle>
          <DialogDescription>
            {normalizedNumbers.length} phone numbers selected for bulk messaging
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Phone Numbers */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected Phone Numbers</Label>
                <Textarea
                  value={numbersText}
                  readOnly
                  rows={8}
                  className="mt-2 bg-gray-50 dark:bg-gray-800/50"
                  placeholder="Phone numbers will appear here..."
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button onClick={handleCopyNumbers} variant="outline" size="sm">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Numbers
                  </Button>
                  <Button onClick={handleDownloadTxt} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download TXT
                  </Button>
                  <Button onClick={handleDownloadExcel} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Message Templates */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Template Selection */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Choose Message Template</Label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select a message template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general-greeting">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            General Greeting
                          </div>
                        </SelectItem>
                        <SelectItem value="new-collection">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            New Collection Alert
                          </div>
                        </SelectItem>
                        <SelectItem value="special-offer">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Special Offer
                          </div>
                        </SelectItem>
                        <SelectItem value="appointment-reminder">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Appointment Reminder
                          </div>
                        </SelectItem>
                        <SelectItem value="festival-wishes">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Festival Wishes
                          </div>
                        </SelectItem>
                        <SelectItem value="thank-you">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Thank You Message
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Message Editor */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Message Content</Label>
                    <Textarea
                      value={presetMessage}
                      onChange={(e) => setPresetMessage(e.target.value)}
                      rows={12}
                      className="mt-2"
                      placeholder="Enter your message here or select a template above..."
                    />
                  </div>

                  {/* Message Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleCopyMessage} variant="outline" size="sm">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Copy Message
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendBulkWhatsApp}
            disabled={!presetMessage.trim()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Send className="h-4 w-4 mr-2" />
            Send via WhatsApp ({normalizedNumbers.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkWhatsAppModal;
