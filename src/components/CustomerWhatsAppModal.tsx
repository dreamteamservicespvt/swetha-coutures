import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Copy, Send, Plus, Save, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getOrCreateShareToken, generatePublicBillUrl } from '@/utils/billShareUtils';
import { useBusinessSettings } from '@/components/BusinessSettingsProvider';
import { daysSince, formatBilledDate, formatPendingSince } from '@/utils/customerCalculations';
import { toJsDate } from '@/utils/financeReports';

interface PendingBillRef {
  id: string;
  billId: string;
  balance: number;
  totalAmount?: number;
  paidAmount?: number;
  date?: any;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  customerType: 'regular' | 'premium' | 'vip';
  totalOrders?: number;
  totalSpent?: number;
  lastOrderDate?: string;
  outstandingBalance?: number;
  pendingBills?: PendingBillRef[];
  daysPending?: number;
}

interface CustomerWhatsAppModalProps {
  customer: Customer;
  isOpen: boolean;
  onClose: () => void;
}

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
}

const CustomerWhatsAppModal: React.FC<CustomerWhatsAppModalProps> = ({
  customer,
  isOpen,
  onClose
}) => {
  const { settings: businessSettings } = useBusinessSettings();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [buildingReminder, setBuildingReminder] = useState(false);

  const businessName = businessSettings?.businessName || "Swetha's Couture";
  const pendingBills = (customer.pendingBills || []).filter((bill) => (bill.balance || 0) > 0.5);
  const outstanding =
    customer.outstandingBalance ?? pendingBills.reduce((sum, bill) => sum + (bill.balance || 0), 0);
  const hasPending = outstanding > 0.5;

  const inr = (value: number) => `₹${(value || 0).toLocaleString('en-IN')}`;

  /**
   * Builds the polite payment-reminder message.
   *
   * Each pending bill gets its own public share link, so the customer can open the bill,
   * see exactly what is owed and pay straight from that page — minting the share token
   * here is what makes "share the bill along with it" work without extra clicks.
   */
  const buildPaymentReminder = async (): Promise<string> => {
    const lines: string[] = [];

    for (const bill of pendingBills) {
      let link = '';
      try {
        const token = await getOrCreateShareToken(bill.id);
        link = generatePublicBillUrl(token);
      } catch (error) {
        console.error('Could not create share link for bill', bill.billId, error);
      }

      const billedOn = toJsDate(bill.date);
      const age = daysSince(billedOn);

      lines.push(
        `• ${bill.billId} — ${inr(bill.balance)} pending` +
          (bill.totalAmount && bill.paidAmount
            ? `\n  (Bill ${inr(bill.totalAmount)}, paid ${inr(bill.paidAmount)})`
            : '') +
          `\n  Billed on: ${formatBilledDate(billedOn)} — pending since ${formatPendingSince(age)}` +
          (link ? `\n  View & pay: ${link}` : '')
      );
    }

    // The oldest bill drives the headline, since that is the one that most needs settling.
    const oldest = pendingBills.reduce<Date | null>((acc, bill) => {
      const date = toJsDate(bill.date);
      if (!date) return acc;
      return !acc || date < acc ? date : acc;
    }, null);
    const oldestAge = daysSince(oldest);

    return [
      `Dear ${customer.name},`,
      '',
      `Warm greetings from ${businessName}! 🙏`,
      '',
      `This is a gentle reminder that a payment of *${inr(outstanding)}* is still pending on your account` +
        (oldest ? `, outstanding since *${formatPendingSince(oldestAge)}* (billed ${formatBilledDate(oldest)}).` : '.'),
      '',
      pendingBills.length > 0 ? 'PENDING BILL(S):' : '',
      pendingBills.length > 0 ? '━━━━━━━━━━━━━━━━━━━━' : '',
      ...lines,
      '',
      'You can open the link above to view your bill and pay directly — UPI, QR and bank details are all on that page.',
      '',
      'If you have already made the payment, please ignore this message and kindly share the payment screenshot with us.',
      '',
      'Thank you so much for your support and for choosing us 💖',
      '',
      `Warm regards,`,
      `${businessName}`,
    ]
      .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
      .join('\n');
  };

  const [templates, setTemplates] = useState<MessageTemplate[]>([
    {
      id: 'payment-reminder',
      name: '💰 Payment Reminder (with bill link)',
      // Built asynchronously in handleTemplateChange because it needs share links.
      content: '',
    },
    {
      id: 'welcome',
      name: 'Welcome Message',
      content: `Dear {customerName},

Welcome to Swetha's Couture! We're delighted to have you as our valued customer.

CUSTOMER DETAILS:
━━━━━━━━━━━━━━━━━━━━
• Name: {customerName}
• Phone: {customerPhone}
• Customer Type: {customerType}
• Total Orders: {totalOrders}
• Total Spent: ₹{totalSpent}

We specialize in creating beautiful, custom garments tailored to your unique style and preferences. Our skilled artisans are committed to delivering exceptional quality and service.

For any inquiries or to place a new order, please don't hesitate to contact us.

Thank you for choosing Swetha's Couture!

Best regards,
Swetha's Couture Team`
    },
    {
      id: 'follow-up',
      name: 'Follow-up Message',
      content: `Dear {customerName},

We hope you're doing well! We wanted to follow up and see how you're enjoying your recent purchase from Swetha's Couture.

YOUR PROFILE:
━━━━━━━━━━━━━━━━━━━━
• Customer Since: Your first order
• Total Orders: {totalOrders}
• Customer Type: {customerType}
• Last Order: {lastOrderDate}

Your satisfaction is our priority, and we'd love to hear your feedback about our products and services.

If you have any questions, need alterations, or are interested in placing a new order, please let us know!

Thank you for being a valued customer.

Best regards,
Swetha's Couture Team`
    },
    {
      id: 'new-collection',
      name: 'New Collection Alert',
      content: `Dear {customerName},

Exciting news! We've just launched our new collection at Swetha's Couture, and we thought you'd love to see what we have in store.

SPECIAL OFFER FOR YOU:
━━━━━━━━━━━━━━━━━━━━
• Customer Type: {customerType}
• Exclusive Preview Access
• Special Discounts Available
• Custom Fitting Consultation

Our new collection features:
✨ Latest fashion trends
✨ Premium quality fabrics
✨ Custom tailoring options
✨ Unique designs

As one of our {customerType} customers, you get early access to our new pieces. Visit us for a personalized consultation and fitting.

Book your appointment today!

Best regards,
Swetha's Couture Team`
    },
    {
      id: 'appointment-reminder',
      name: 'Appointment Reminder',
      content: `Dear {customerName},

This is a friendly reminder about your upcoming appointment with Swetha's Couture.

APPOINTMENT DETAILS:
━━━━━━━━━━━━━━━━━━━━
• Customer: {customerName}
• Phone: {customerPhone}
• Customer Type: {customerType}
• Appointment: [Please specify date and time]

Please bring any reference materials or inspiration images you'd like to discuss during your consultation.

If you need to reschedule or have any questions, please contact us as soon as possible.

We look forward to seeing you!

Best regards,
Swetha's Couture Team`
    },
    {
      id: 'seasonal-offer',
      name: 'Seasonal Offer',
      content: `Dear {customerName},

🎉 Special Seasonal Offer just for you! 🎉

As one of our valued {customerType} customers, we're excited to offer you exclusive seasonal discounts.

YOUR BENEFITS:
━━━━━━━━━━━━━━━━━━━━
• Customer Type: {customerType}
• Previous Orders: {totalOrders}
• Special Discount: [Specify discount]
• Valid Until: [Specify end date]

This is the perfect time to:
• Get your festive outfits ready
• Try our latest designs
• Book consultations for upcoming events
• Enjoy premium tailoring services

Don't miss out on this limited-time offer!

Contact us today to schedule your appointment.

Best regards,
Swetha's Couture Team`
    }
  ]);

  useEffect(() => {
    if (customer) {
      // Format phone number for WhatsApp
      let formattedPhone = customer.phone;
      if (formattedPhone) {
        formattedPhone = formattedPhone.replace(/^0+/, "").replace(/^\+?91/, "");
        formattedPhone = "+91" + formattedPhone;
      }
      setPhoneNumber(formattedPhone);
    }
  }, [customer]);

  const replaceTemplateVariables = (content: string) => {
    return content
      .replace(/\{customerName\}/g, customer.name || '')
      .replace(/\{customerPhone\}/g, customer.phone || '')
      .replace(/\{customerType\}/g, customer.customerType || 'regular')
      .replace(/\{totalOrders\}/g, (customer.totalOrders || 0).toString())
      .replace(/\{totalSpent\}/g, (customer.totalSpent || 0).toLocaleString())
      .replace(/\{lastOrderDate\}/g, customer.lastOrderDate || 'N/A');
  };

  const handleTemplateChange = async (templateId: string) => {
    setSelectedTemplate(templateId);

    if (templateId === 'payment-reminder') {
      setBuildingReminder(true);
      try {
        setMessage(await buildPaymentReminder());
      } catch (error) {
        console.error('Error building payment reminder:', error);
        toast({
          title: 'Could not build reminder',
          description: 'The bill links could not be created. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setBuildingReminder(false);
      }
      return;
    }

    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessage(replaceTemplateVariables(template.content));
    }
  };

  // A customer who owes money opens straight onto the reminder — that is the reason
  // this modal is usually opened from the collections view.
  useEffect(() => {
    if (!isOpen) return;
    if (hasPending && !selectedTemplate) {
      handleTemplateChange('payment-reminder');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, hasPending]);

  const handleSaveTemplate = () => {
    if (customTemplateName.trim() && message.trim()) {
      const newTemplate: MessageTemplate = {
        id: `custom-${Date.now()}`,
        name: customTemplateName,
        content: message
      };
      setTemplates([...templates, newTemplate]);
      setCustomTemplateName('');
      setShowSaveTemplate(false);
      toast({
        title: "Success",
        description: "Custom template saved successfully",
      });
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
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

  const handleSendWhatsApp = () => {
    if (phoneNumber && message) {
      // Add country code to phone number
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const phoneWithCountryCode = cleanPhone.length === 10 ? `91${cleanPhone}` : 
                                    (cleanPhone.startsWith('91') && cleanPhone.length === 12) ? cleanPhone :
                                    `91${cleanPhone}`;
      const whatsappUrl = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp Message - {customer.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Customer Details */}
          <div className="space-y-4">
            {hasPending && (
              <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
                <CardContent className="p-4">
                  <h3 className="mb-2 flex items-center gap-2 font-semibold text-red-800 dark:text-red-300">
                    <AlertTriangle className="h-4 w-4" />
                    Payment pending: {inr(outstanding)}
                  </h3>
                  <div className="space-y-1.5 text-sm">
                    {pendingBills.map((bill) => (
                      <div key={bill.id} className="flex justify-between gap-2">
                        <span className="min-w-0 text-gray-700 dark:text-gray-300">
                          <span className="block truncate font-medium">{bill.billId}</span>
                          <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                            {formatBilledDate(toJsDate(bill.date))} · pending{' '}
                            {formatPendingSince(daysSince(toJsDate(bill.date)))}
                          </span>
                        </span>
                        <span className="shrink-0 font-medium text-red-600 dark:text-red-400">
                          {inr(bill.balance)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-red-700/80 dark:text-red-300/80">
                    The reminder template below includes a share link for each bill so the customer
                    can pay from it directly.
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Customer Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Name:</span>
                    <span className="font-medium">{customer.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                    <span className="font-medium">{customer.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Type:</span>
                    <Badge variant="outline" className="capitalize">
                      {customer.customerType}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Orders:</span>
                    <span className="font-medium">{customer.totalOrders || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Spent:</span>
                    <span className="font-medium">₹{(customer.totalSpent || 0).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter WhatsApp number"
                />
              </div>
              
              <div>
                <Label htmlFor="template">Message Template</Label>
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates
                      .filter(template => template.id !== 'payment-reminder' || hasPending)
                      .map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {buildingReminder && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Creating secure bill links…
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Message Composition */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={15}
                className="resize-none"
              />
            </div>

            {/* Save Template Section */}
            {showSaveTemplate && (
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <Label htmlFor="templateName">Template Name</Label>
                    <Input
                      id="templateName"
                      value={customTemplateName}
                      onChange={(e) => setCustomTemplateName(e.target.value)}
                      placeholder="Enter template name"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSaveTemplate} size="sm">
                        <Save className="h-4 w-4 mr-2" />
                        Save Template
                      </Button>
                      <Button variant="outline" onClick={() => setShowSaveTemplate(false)} size="sm">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCopyMessage} variant="outline" className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copy Message
              </Button>
              <Button onClick={() => setShowSaveTemplate(true)} variant="outline" className="flex-1">
                <Plus className="h-4 w-4 mr-2" />
                Save Template
              </Button>
              <Button 
                onClick={handleSendWhatsApp} 
                disabled={!phoneNumber || !message}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Send className="h-4 w-4 mr-2" />
                Send WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerWhatsAppModal;
