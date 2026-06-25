import { useTheme } from '@/context/ThemeContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Moon, Sun, Monitor, Trash2, AlertTriangle,
  Database, HardDrive, Download, Upload, RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { repairs, customers, invoices } = useData();
  const [confirmReset, setConfirmReset] = useState(false);

  const handleExport = () => {
    const data = { repairs, customers, invoices, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repairpro-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.repairs) localStorage.setItem('repairpro-repairs', JSON.stringify(data.repairs));
          if (data.customers) localStorage.setItem('repairpro-customers', JSON.stringify(data.customers));
          if (data.invoices) localStorage.setItem('repairpro-invoices', JSON.stringify(data.invoices));
          alert('Data imported successfully! Please restart the app.');
          window.location.reload();
        } catch {
          alert('Invalid backup file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleReset = () => {
    localStorage.removeItem('repairpro-repairs');
    localStorage.removeItem('repairpro-customers');
    localStorage.removeItem('repairpro-invoices');
    window.location.reload();
  };

  const totalStorage = JSON.stringify({ repairs, customers, invoices }).length;
  const storageKB = (totalStorage / 1024).toFixed(1);

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Monitor className="w-4 h-4" /> Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-3 block">Theme</Label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${theme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'}`}
              >
                <Sun className="w-6 h-6" />
                <span className="text-sm font-medium">Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'}`}
              >
                <Moon className="w-6 h-6" />
                <span className="text-sm font-medium">Dark</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4" /> Data Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
            <div className="flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Local Storage Used</p>
                <p className="text-xs text-muted-foreground">{storageKB} KB</p>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{repairs.length} repairs</p>
              <p>{customers.length} customers</p>
              <p>{invoices.length} invoices</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">Backup & Restore</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={handleExport}>
                <Download className="w-4 h-4" /> Export Data
              </Button>
              <Button variant="outline" className="flex-1 gap-2" onClick={handleImport}>
                <Upload className="w-4 h-4" /> Import Data
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">Danger Zone</p>
            <Button variant="destructive" className="gap-2 w-full" onClick={() => setConfirmReset(true)}>
              <Trash2 className="w-4 h-4" /> Reset All Data
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><RefreshCw className="w-4 h-4" /> About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">RepairPro Desktop</span> v1.0.0</p>
          <p>Offline-first electronics repair shop management application.</p>
          <p>All data is stored locally on your device. No internet connection required.</p>
          <p className="pt-2">Built with React + Tauri</p>
        </CardContent>
      </Card>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Reset All Data
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all repairs, customers, and invoices. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReset}>Yes, Reset Everything</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
