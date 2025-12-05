import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Database, Bell, Moon, Sun, Upload, Key, FileText, Download, Brain, Phone, BookOpen, Shield, ScrollText } from 'lucide-react';
import { generateRoleDocumentationPDF } from '@/utils/roleDocumentation';
import { CallTypeList } from '@/components/ai-management/CallTypeList';
import { KnowledgeList } from '@/components/ai-management/KnowledgeList';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { hasRole } = useAuth();
  
  const canAccessAIManagement = hasRole(['super_admin', 'admin']);

  return (
    <DashboardLayout 
      title="Settings" 
      subtitle="Configure your dashboard preferences"
    >
      <div className="max-w-4xl">
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto gap-1">
            <TabsTrigger value="general" className="gap-2">
              <Sun className="w-4 h-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-2">
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Data</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
            {canAccessAIManagement && (
              <TabsTrigger value="ai" className="gap-2">
                <Brain className="w-4 h-4" />
                <span className="hidden sm:inline">AI Management</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="docs" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Docs</span>
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
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
          </TabsContent>

          {/* Data Import Tab */}
          <TabsContent value="data" className="space-y-6">
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
          </TabsContent>

          {/* API Integrations Tab */}
          <TabsContent value="integrations" className="space-y-6">
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
          </TabsContent>

          {/* AI Management Tab - Only for Admin/Super Admin */}
          {canAccessAIManagement && (
            <TabsContent value="ai" className="space-y-6">
              {/* Call Types Section */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center gap-3 mb-6">
                  <Phone className="w-5 h-5 text-accent" />
                  <h3 className="text-lg font-semibold text-foreground">Call Types</h3>
                </div>
                <CallTypeList />
              </div>

              {/* Company Knowledge Section */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center gap-3 mb-6">
                  <BookOpen className="w-5 h-5 text-accent" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Company Knowledge</h3>
                    <p className="text-sm text-muted-foreground">Add context for AI to better understand your business</p>
                  </div>
                </div>
                <KnowledgeList />
              </div>

              {/* Call Rules Section */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-accent" />
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Call Rules</h3>
                      <p className="text-sm text-muted-foreground">Define evaluation criteria for each call type</p>
                    </div>
                  </div>
                  <Button size="sm" className="gap-2">
                    <Shield className="w-4 h-4" />
                    Add Rule
                  </Button>
                </div>
                
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No rules configured</p>
                  <p className="text-sm">Add required, recommended, or prohibited actions for calls</p>
                </div>
              </div>

              {/* Script Templates Section */}
              <div className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <ScrollText className="w-5 h-5 text-accent" />
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Script Templates</h3>
                      <p className="text-sm text-muted-foreground">Upload scripts for adherence checking</p>
                    </div>
                  </div>
                  <Button size="sm" className="gap-2">
                    <ScrollText className="w-4 h-4" />
                    Add Script
                  </Button>
                </div>
                
                <div className="text-center py-8 text-muted-foreground">
                  <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No scripts uploaded</p>
                  <p className="text-sm">Add conversation scripts for AI to evaluate adherence</p>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <div className="flex gap-3">
                  <Brain className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground mb-1">Default AI Behavior</p>
                    <p className="text-muted-foreground">
                      When no custom configurations are set, the AI uses built-in analysis optimized for sales calls. 
                      Add call types, knowledge, and rules to customize AI insights for your specific needs.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          {/* Documentation Tab */}
          <TabsContent value="docs" className="space-y-6">
            <div className="bg-card rounded-xl border border-border p-6 shadow-card">
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Documentation</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-foreground">Role & Permissions Guide</p>
                  <p className="text-sm text-muted-foreground">
                    Download the complete user manual with role definitions, permissions, and responsibilities
                  </p>
                </div>
                
                <Button onClick={generateRoleDocumentationPDF} className="gap-2">
                  <Download className="w-4 h-4" />
                  Download PDF Guide
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
