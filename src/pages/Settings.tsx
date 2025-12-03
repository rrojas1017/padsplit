import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/contexts/ThemeContext';
import { Database, Bell, Moon, Sun, Upload, Key } from 'lucide-react';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <DashboardLayout 
      title="Settings" 
      subtitle="Configure your dashboard preferences"
    >
      <div className="max-w-3xl space-y-6">
        {/* Appearance */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            {theme === 'dark' ? <Moon className="w-5 h-5 text-accent" /> : <Sun className="w-5 h-5 text-accent" />}
            <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">Dark Mode</p>
              <p className="text-sm text-muted-foreground">Toggle between light and dark themes</p>
            </div>
            <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive daily performance reports via email</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Slack Alerts</p>
                <p className="text-sm text-muted-foreground">Get notified when targets are reached</p>
              </div>
              <Switch />
            </div>
          </div>
        </div>

        {/* Data Import */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-semibold text-foreground">Data Import</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label>Google Sheets URL</Label>
              <Input 
                placeholder="https://docs.google.com/spreadsheets/d/..." 
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Connect your Google Sheet for automatic data sync
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Upload CSV
              </Button>
              <Button className="gap-2">
                <Database className="w-4 h-4" />
                Sync Now
              </Button>
            </div>
          </div>
        </div>

        {/* API Integrations */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            <Key className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-semibold text-foreground">API Integrations</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <span className="font-bold text-orange-500">H</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">HubSpot</p>
                  <p className="text-sm text-muted-foreground">Not connected</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Connect</Button>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <span className="font-bold text-blue-500">K</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">Kixie</p>
                  <p className="text-sm text-muted-foreground">Not connected</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Connect</Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
