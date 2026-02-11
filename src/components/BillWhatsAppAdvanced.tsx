
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Send, Copy, Edit } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/billingUtils';
import { getPaymentSettings } from '@/utils/settingsUtils';

interface BillWhatsAppAdvancedProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  customerPhone: string;
  billId: string;
  totalAmount: number;
  balance: number;
  upiLink?: string;
  customMessage?: string;
}

const BillWhatsAppAdvanced: React.FC<BillWhatsAppAdvancedProps> = ({
  isOpen,
  onClose,
  customerName,
  customerPhone,
  billId,
  totalAmount,
  balance,
  upiLink, // We'll keep this prop but not use it directly
  customMessage
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState('bill-delivery');
  const [message, setMessage] = useState('');
  const [customTemplates, setCustomTemplates] = useState<{[key: string]: string}>({
    'custom-1': '',
    'custom-2': '',
    'custom-3': ''
  });
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [tempTemplateValue, setTempTemplateValue] = useState('');
  const [upiId, setUpiId] = useState<string>('');

  const defaultTemplates = {
    'bill-delivery': `Hello ${customerName}! 🪡✨

Your bill ${billId} for ${formatCurrency(totalAmount)} is ready from Swetha's Couture.

${upiId ? `💳 Pay via UPI: ${upiId}` : ''}

Thank you for choosing us! 💜

Best regards,
Swetha's Couture Team`,

    'payment-reminder': `Dear ${customerName}, 🙏

This is a gentle reminder about your pending payment for bill ${billId}.

Outstanding amount: ${formatCurrency(balance)}

${upiId ? `💳 Pay via UPI: ${upiId}` : ''}

Please complete your payment at your earliest convenience.

Thank you!
Swetha's Couture`,

    'custom-greeting': `Hi ${customerName}! 👋

Hope you're doing well! We wanted to reach out regarding your recent order with Swetha's Couture.

Bill ${billId}: ${formatCurrency(totalAmount)}

${balance > 0 ? `Balance due: ${formatCurrency(balance)}` : 'Payment completed ✅'}

Feel free to contact us if you have any questions!

Warm regards,
Swetha's Couture Team`
  };

  // Load UPI ID from settings
  useEffect(() => {
    const loadUpiId = async () => {
      try {
        const paymentSettings = await getPaymentSettings();
        if (paymentSettings.upiId) {
          setUpiId(paymentSettings.upiId);
        }
      } catch (error) {
        console.error('Error loading UPI ID from settings:', error);
      }
    };
    
    if (isOpen) {
      loadUpiId();
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (customMessage) {
      setMessage(customMessage);
    } else {
      updateMessageFromTemplate();
    }
  }, [selectedTemplate, customerName, billId, totalAmount, balance, upiId, customMessage]);

  const updateMessageFromTemplate = () => {
    if (selectedTemplate.startsWith('custom-') && customTemplates[selectedTemplate]) {
      setMessage(customTemplates[selectedTemplate]);
    } else if (defaultTemplates[selectedTemplate as keyof typeof defaultTemplates]) {
      setMessage(defaultTemplates[selectedTemplate as keyof typeof defaultTemplates]);
    }
  };

  const saveCustomTemplate = () => {
    if (editingTemplate) {
      setCustomTemplates(prev => ({
        ...prev,
        [editingTemplate]: tempTemplateValue
      }));
      setEditingTemplate(null);
      setTempTemplateValue('');
      if (selectedTemplate === editingTemplate) {
        setMessage(tempTemplateValue);
      }
      toast({
        title: "Template Saved",
        description: "Your custom template has been saved successfully.",
      });
    }
  };

  const startEditingTemplate = (templateKey: string) => {
    setEditingTemplate(templateKey);
    setTempTemplateValue(customTemplates[templateKey] || '');
  };

  const sendWhatsAppMessage = () => {
    if (!customerPhone || !message.trim()) {
      toast({
        title: "Error",
        description: "Phone number and message are required.",
        variant: "destructive",
      });
      return;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/91${customerPhone.replace(/[^\d]/g, '')}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    toast({
      title: "WhatsApp Opened",
      description: "Message prepared and WhatsApp opened in new tab.",
    });
    
    onClose();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message);
    toast({
      title: "Copied!",
      description: "Message copied to clipboard.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Send Bill via WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Info */}
          <Card className="bg-gray-50 dark:bg-gray-800/50">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Customer:</strong> {customerName}
                </div>
                <div>
                  <strong>Phone:</strong> {customerPhone}
                </div>
                <div>
                  <strong>Bill ID:</strong> {billId}
                </div>
                <div>
                  <strong>Amount:</strong> {formatCurrency(totalAmount)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Template Selection */}
          <div className="space-y-4">
            <Label>Choose Message Template</Label>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bill-delivery">💳 Bill Delivery</SelectItem>
                <SelectItem value="payment-reminder">⏰ Payment Reminder</SelectItem>
                <SelectItem value="custom-greeting">👋 Custom Greeting</SelectItem>
                <SelectItem value="custom-1">📝 Custom Template 1</SelectItem>
                <SelectItem value="custom-2">📝 Custom Template 2</SelectItem>
                <SelectItem value="custom-3">📝 Custom Template 3</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom Template Editor */}
            {selectedTemplate.startsWith('custom-') && (
              <div className="p-4 border rounded-lg bg-blue-50">
                <div className="flex justify-between items-center mb-2">
                  <Label className="text-sm font-medium">
                    {editingTemplate === selectedTemplate ? 'Edit Template' : 'Custom Template'}
                  </Label>
                  {editingTemplate !== selectedTemplate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditingTemplate(selectedTemplate)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <div className="space-x-2">
                      <Button size="sm" onClick={saveCustomTemplate}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingTemplate(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
                
                {editingTemplate === selectedTemplate ? (
                  <Textarea
                    value={tempTemplateValue}
                    onChange={(e) => setTempTemplateValue(e.target.value)}
                    placeholder="Create your custom template here..."
                    rows={4}
                  />
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {customTemplates[selectedTemplate] || 'No custom template saved yet. Click Edit to create one.'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Message Editor */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Message</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={copyToClipboard}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              placeholder="Type your message here..."
              className="resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Preview how this message will appear before sending
            </p>
          </div>

          {/* Quick Variables */}
          <div className="p-4 bg-yellow-50 rounded-lg">
            <Label className="text-sm font-medium mb-2 block">Quick Variables</Label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><code>{customerName}</code> - Customer name</div>
              <div><code>{billId}</code> - Bill ID</div>
              <div><code>{formatCurrency(totalAmount)}</code> - Total amount</div>
              <div><code>{formatCurrency(balance)}</code> - Balance due</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="sm:order-2"
            >
              Cancel
            </Button>
            <Button
              onClick={sendWhatsAppMessage}
              disabled={!message.trim()}
              className="bg-green-600 hover:bg-green-700 text-white sm:order-1 flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              Send via WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BillWhatsAppAdvanced;
