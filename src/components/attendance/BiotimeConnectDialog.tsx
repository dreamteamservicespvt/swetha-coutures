import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  clearConnection,
  fetchConnection,
  saveConnection,
} from '@/utils/attendance/attendanceStore';

interface BiotimeConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Where the admin supplies the BioTime portal address and access token.
 *
 * ZKBio Time Cloud has no permanent API key and its session tokens expire, so this has
 * to be re-pasteable from inside the app — putting it only in environment variables
 * would mean a redeploy every time it lapses.
 */
const BiotimeConnectDialog: React.FC<BiotimeConnectDialogProps> = ({
  open,
  onOpenChange,
  onSaved,
}) => {
  const { userData } = useAuth();
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchConnection()
      .then((connection) => {
        setBaseUrl(connection?.baseUrl || '');
        setToken(connection?.token || '');
      })
      .catch(() => undefined);
  }, [open]);

  const handleSave = async () => {
    const url = baseUrl.trim().replace(/\/+$/, '');
    const trimmedToken = token.trim();

    if (!url) {
      toast({ title: 'Portal address is required', variant: 'destructive' });
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({
        title: 'Address must start with https://',
        description: 'For example https://itime.minervaiot.com',
        variant: 'destructive',
      });
      return;
    }
    if (!trimmedToken) {
      toast({ title: 'Access token is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await saveConnection({
        baseUrl: url,
        token: trimmedToken,
        authScheme: 'JWT',
        updatedBy: userData?.name || userData?.email || 'admin',
      });
      toast({ title: 'BioTime connected', description: 'Checking the connection…' });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Could not save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      await clearConnection();
      setBaseUrl('');
      setToken('');
      toast({ title: 'BioTime disconnected' });
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect BioTime Cloud</DialogTitle>
          <DialogDescription>
            Links this app to your fingerprint device's cloud account so check-ins and
            check-outs arrive automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="biotimeUrl">Portal address</Label>
            <Input
              id="biotimeUrl"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://itime.minervaiot.com"
            />
            <p className="text-xs text-gray-500">
              The address you see in your browser when logged into ZKBio Time Cloud.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="biotimeToken">Access token</Label>
            <Textarea
              id="biotimeToken"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste the accessToken value here"
              rows={4}
              className="font-mono text-xs"
            />
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-900 dark:bg-blue-950/40">
            <p className="mb-1.5 font-semibold text-blue-900 dark:text-blue-200">
              How to get the token
            </p>
            <ol className="list-decimal space-y-1 pl-4 text-blue-800 dark:text-blue-300">
              <li>Open your BioTime portal in Chrome and log in.</li>
              <li>
                Press <strong>F12</strong> to open developer tools.
              </li>
              <li>
                Go to the <strong>Application</strong> tab → <strong>Local Storage</strong> →
                your portal address.
              </li>
              <li>
                Find the row named <strong>accessToken</strong> and copy its value.
              </li>
              <li>Paste it above and press Save.</li>
            </ol>
            <p className="mt-2 text-blue-800 dark:text-blue-300">
              This token expires after a while. When attendance stops updating, repeat these
              steps and paste a fresh one — nothing else needs changing.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-700"
            onClick={handleDisconnect}
            disabled={saving}
          >
            Disconnect
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save & connect'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BiotimeConnectDialog;
