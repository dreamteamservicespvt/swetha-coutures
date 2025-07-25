
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Copy, Send, Plus, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: string;
  totalAmount: number;
  remainingAmount: number;
  deliveryDate: string;
  orderDate: string;
  itemType?: string;
  items?: any[];
}

interface WhatsAppMessageModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
}

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
}

const WhatsAppMessageModal: React.FC<WhatsAppMessageModalProps> = ({
  order,
  isOpen,
  onClose
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const [templates, setTemplates] = useState<MessageTemplate[]>([
    {
      id: 'order-confirmation',
      name: 'Order Confirmation Letter',
      content: `Dear {customerName},

We are pleased to acknowledge receipt of your order #{orderNumber} at Swetha's Couture.

ORDER DETAILS:
━━━━━━━━━━━━━━━━━━━━
• Order Number: {orderNumber}
• Item Type: {itemType}
• Order Date: {orderDate}
• Expected Delivery: {deliveryDate}
• Total Amount: ₹{totalAmount}
• Current Status: {status}

We are committed to delivering exceptional quality and service. Our team will begin working on your order shortly, and we will keep you informed of the progress.

Should you have any questions or concerns, please do not hesitate to contact us.

Thank you for choosing Swetha's Couture.

Best regards,
Swetha's Couture Team`
    },
    {
      id: 'status-update',
      name: 'Status Update Notice',
      content: `Dear {customerName},

We would like to update you on the progress of your order #{orderNumber}.

STATUS UPDATE:
━━━━━━━━━━━━━━━━━━━━
• Order Number: {orderNumber}
• Current Status: {status}
• Item Type: {itemType}
• Expected Delivery: {deliveryDate}

We are working diligently to ensure your order meets our high standards of quality. We will continue to keep you informed of any further developments.

Thank you for your patience and for choosing Swetha's Couture.

Best regards,
Swetha's Couture Team`
    },
    {
      id: 'payment-reminder',
      name: 'Payment Reminder Notice',
      content: `Dear {customerName},

We hope this message finds you well. We would like to bring to your attention the outstanding balance for your order.

PAYMENT DETAILS:
━━━━━━━━━━━━━━━━━━━━
• Order Number: {orderNumber}
• Total Amount: ₹{totalAmount}
• Outstanding Balance: ₹{balance}
• Item Type: {itemType}

We kindly request you to arrange payment at your earliest convenience. Your prompt attention to this matter would be greatly appreciated.

Thank you for your cooperation and for choosing Swetha's Couture.

Best regards,
Swetha's Couture Team`
    },
    {
      id: 'ready-notification',
      name: 'Order Ready Notice',
      content: `Dear {customerName},

We are delighted to inform you that your order #{orderNumber} has been completed and is ready for collection.

COLLECTION DETAILS:
━━━━━━━━━━━━━━━━━━━━
• Order Number: {orderNumber}
• Item Type: {itemType}
• Status: Ready for Pickup
• Outstanding Balance: ₹{balance}

Please visit us at your convenience during our business hours to collect your order. We trust that you will be pleased with the quality of our work.

Thank you for choosing Swetha's Couture.

Best regards,
Swetha's Couture Team`
    },
    {
      id: 'delivery-confirmation',
      name: 'Delivery Confirmation',
      content: `Dear {customerName},

We are pleased to confirm that your order #{orderNumber} has been successfully delivered.

DELIVERY CONFIRMATION:
━━━━━━━━━━━━━━━━━━━━
• Order Number: {orderNumber}
• Item Type: {itemType}
• Delivery Status: Completed
• Delivery Date: {orderDate}

We trust that you are completely satisfied with your order. It has been our pleasure to serve you, and we look forward to your continued patronage.

Thank you for choosing Swetha's Couture.

Best regards,
Swetha's Couture Team`
    }
  ]);

  const variables = [
    { key: '{customerName}', value: order.customerName, description: 'Customer Name' },
    { key: '{orderNumber}', value: order.orderNumber, description: 'Order Number' },
    { key: '{orderId}', value: order.orderNumber, description: 'Order ID' },
    { key: '{status}', value: order.status, description: 'Order Status' },
    { key: '{totalAmount}', value: order.totalAmount?.toLocaleString() || '0', description: 'Total Amount' },
    { key: '{balance}', value: order.remainingAmount?.toLocaleString() || '0', description: 'Balance Amount' },
    { key: '{deliveryDate}', value: order.deliveryDate, description: 'Delivery Date' },
    { key: '{orderDate}', value: order.orderDate, description: 'Order Date' },
    { key: '{itemType}', value: order.itemType || 'order', description: 'Item Type' },
    { key: '{phone}', value: order.customerPhone, description: 'Phone Number' }
  ];

  useEffect(() => {
    if (isOpen && order) {
      setPhoneNumber(order.customerPhone || '');
      setMessage('');
      setSelectedTemplate('');
      setShowSaveTemplate(false);
      setCustomTemplateName('');
    }
  }, [isOpen, order]);

  const resolveVariables = (text: string): string => {
    let resolvedText = text;
    variables.forEach(variable => {
      const regex = new RegExp(variable.key.replace(/[{}]/g, '\\$&'), 'g');
      resolvedText = resolvedText.replace(regex, variable.value);
    });
    return resolvedText;
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setMessage(template.content);
    }
  };

  const insertVariable = (variable: string) => {
    const cursorPosition = (document.getElementById('message-textarea') as HTMLTextAreaElement)?.selectionStart || message.length;
    const newMessage = message.slice(0, cursorPosition) + variable + message.slice(cursorPosition);
    setMessage(newMessage);
  };

  const handleCopyMessage = () => {
    const resolvedMessage = resolveVariables(message);
    navigator.clipboard.writeText(resolvedMessage).then(() => {
      toast({
        title: "Copied!",
        description: "Message copied to clipboard",
      });
    });
  };

  const handleSendWhatsApp = () => {
    if (!phoneNumber || !message) {
      toast({
        title: "Error",
        description: "Please enter phone number and message",
        variant: "destructive",
      });
      return;
    }

    const resolvedMessage = resolveVariables(message);
    const encodedMessage = encodeURIComponent(resolvedMessage);
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  const handleSaveTemplate = () => {
    if (!customTemplateName || !message) {
      toast({
        title: "Error",
        description: "Please enter template name and message",
        variant: "destructive",
      });
      return;
    }

    const newTemplate: MessageTemplate = {
      id: `custom-${Date.now()}`,
      name: customTemplateName,
      content: message
    };

    setTemplates(prev => [...prev, newTemplate]);
    
    // Save to localStorage
    const savedTemplates = JSON.parse(localStorage.getItem('whatsapp-templates') || '[]');
    savedTemplates.push(newTemplate);
    localStorage.setItem('whatsapp-templates', JSON.stringify(savedTemplates));

    toast({
      title: "Success",
      description: "Template saved successfully",
    });

    setShowSaveTemplate(false);
    setCustomTemplateName('');
  };

  // Load custom templates from localStorage
  useEffect(() => {
    const savedTemplates = JSON.parse(localStorage.getItem('whatsapp-templates') || '[]');
    if (savedTemplates.length > 0) {
      setTemplates(prev => {
        const defaultTemplates = prev.filter(t => !t.id.startsWith('custom-'));
        return [...defaultTemplates, ...savedTemplates];
      });
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-green-600" />
            Send WhatsApp Message
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Message Area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Customer Info */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Customer Name</Label>
                    <Input value={order.customerName} readOnly className="bg-gray-50" />
                  </div>
                  <div>
                    <Label>Phone Number</Label>
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Template Selection */}
            <div>
              <Label>Choose Message Template</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template or write custom message" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message Textarea */}
            <div>
              <Label>Message</Label>
              <Textarea
                id="message-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={8}
                className="resize-none"
              />
            </div>

            {/* Save Template */}
            {message && !selectedTemplate && (
              <div className="space-y-2">
                {!showSaveTemplate ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSaveTemplate(true)}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save as Template
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Input
                      value={customTemplateName}
                      onChange={(e) => setCustomTemplateName(e.target.value)}
                      placeholder="Template name"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveTemplate}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSaveTemplate(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Message Preview */}
            {message && (
              <div>
                <Label>Message Preview</Label>
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="whitespace-pre-wrap text-sm">
                    {resolveVariables(message)}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyMessage}
                disabled={!message}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Message
              </Button>
              <Button
                onClick={handleSendWhatsApp}
                disabled={!message || !phoneNumber}
                className="bg-green-600 hover:bg-green-700"
              >
                <Send className="h-4 w-4 mr-2" />
                Send WhatsApp
              </Button>
            </div>
          </div>

          {/* Quick Variables Panel */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Quick Variables</Label>
              <p className="text-xs text-gray-600 mb-3">Click to insert into message</p>
              <div className="grid grid-cols-1 gap-2">
                {variables.map(variable => (
                  <Button
                    key={variable.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(variable.key)}
                    className="justify-start h-auto p-2"
                  >
                    <div className="text-left">
                      <div className="font-mono text-xs text-blue-600">{variable.key}</div>
                      <div className="text-xs text-gray-500">{variable.description}</div>
                      <div className="text-xs font-medium text-gray-800">{variable.value}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <Card>
              <CardContent className="p-4">
                <Label className="text-sm font-medium">Order Summary</Label>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Order #:</span>
                    <span className="font-medium">{order.orderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <Badge variant="outline" className="text-xs">
                      {order.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-medium">₹{order.totalAmount?.toLocaleString() || 0}</span>
                  </div>
                  {order.remainingAmount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Balance:</span>
                      <span className="font-medium">₹{order.remainingAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Delivery:</span>
                    <span className="text-xs">{order.deliveryDate}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppMessageModal;
