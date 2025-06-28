
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Copy, Download, MessageSquare } from 'lucide-react';

interface BulkWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumbers: string[];
}

const BulkWhatsAppModal: React.FC<BulkWhatsAppModalProps> = ({ isOpen, onClose, phoneNumbers }) => {
  const [normalizedNumbers, setNormalizedNumbers] = useState<string[]>([]);
  const [presetMessage, setPresetMessage] = useState(
    "Hi! Thank you for choosing Swetha's Couture. We have exciting updates for you!"
  );

  React.useEffect(() => {
    if (phoneNumbers.length > 0) {
      const normalized = phoneNumbers.map(phone => {
        let num = phone.replace(/^0+/, "").replace(/^\+?91/, "");
        return "+91" + num;
      });
      setNormalizedNumbers(normalized);
    }
  }, [phoneNumbers]);

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk WhatsApp Numbers</DialogTitle>
          <DialogDescription>
            {normalizedNumbers.length} phone numbers selected for bulk messaging
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="numbers">Phone Numbers</Label>
            <Textarea
              id="numbers"
              value={numbersText}
              readOnly
              rows={6}
              className="mt-2"
              placeholder="Phone numbers will appear here..."
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCopyNumbers} variant="outline">
              <Copy className="h-4 w-4 mr-2" />
              Copy Numbers
            </Button>
            <Button onClick={handleDownloadTxt} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download TXT
            </Button>
            <Button onClick={handleDownloadExcel} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>
          
          <div>
            <Label htmlFor="message">Preset Message</Label>
            <Textarea
              id="message"
              value={presetMessage}
              onChange={(e) => setPresetMessage(e.target.value)}
              rows={3}
              className="mt-2"
              placeholder="Enter your message..."
            />
            <Button onClick={handleCopyMessage} variant="outline" className="mt-2">
              <MessageSquare className="h-4 w-4 mr-2" />
              Copy Message
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkWhatsAppModal;
