import { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Globe, 
  Shield, 
  Bell, 
  Database, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  category: string;
}

const integrations: Integration[] = [
  {
    id: 'entra-id',
    name: 'Microsoft Entra ID',
    description: 'Sync users and groups from Azure Active Directory',
    icon: '🔐',
    status: 'connected',
    lastSync: '2024-01-15T10:30:00Z',
    category: 'Identity'
  },
  {
    id: 'intune',
    name: 'Microsoft Intune',
    description: 'Manage device compliance and inventory',
    icon: '📱',
    status: 'connected',
    lastSync: '2024-01-15T09:45:00Z',
    category: 'Device Management'
  },
  {
    id: 'jamf',
    name: 'Jamf Pro',
    description: 'Manage Apple devices and applications',
    icon: '🍎',
    status: 'disconnected',
    category: 'Device Management'
  },
  {
    id: 'okta',
    name: 'Okta',
    description: 'Single sign-on and user provisioning',
    icon: '🔑',
    status: 'disconnected',
    category: 'Identity'
  },
  {
    id: 'aws',
    name: 'AWS',
    description: 'Sync cloud resources and EC2 instances',
    icon: '☁️',
    status: 'connected',
    lastSync: '2024-01-15T08:00:00Z',
    category: 'Cloud'
  },
  {
    id: 'azure',
    name: 'Azure',
    description: 'Manage Azure resources and virtual machines',
    icon: '🌐',
    status: 'error',
    lastSync: '2024-01-14T15:30:00Z',
    category: 'Cloud'
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Link assets to IT service tickets',
    icon: '🎫',
    status: 'connected',
    lastSync: '2024-01-15T11:00:00Z',
    category: 'ITSM'
  },
  {
    id: 'servicenow',
    name: 'ServiceNow',
    description: 'Integrate with ITSM workflows',
    icon: '⚙️',
    status: 'disconnected',
    category: 'ITSM'
  }
];

interface BackgroundJob {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'scheduled';
  lastRun?: string;
  nextRun?: string;
  duration?: string;
}

const backgroundJobs: BackgroundJob[] = [
  {
    id: 'job-1',
    name: 'Asset Sync - Intune',
    status: 'completed',
    lastRun: '2024-01-15T09:45:00Z',
    nextRun: '2024-01-15T15:45:00Z',
    duration: '2m 34s'
  },
  {
    id: 'job-2',
    name: 'User Sync - Entra ID',
    status: 'completed',
    lastRun: '2024-01-15T10:30:00Z',
    nextRun: '2024-01-15T16:30:00Z',
    duration: '1m 12s'
  },
  {
    id: 'job-3',
    name: 'Warranty Check',
    status: 'running',
    lastRun: '2024-01-15T11:00:00Z',
    duration: 'Running...'
  },
  {
    id: 'job-4',
    name: 'License Compliance Report',
    status: 'scheduled',
    nextRun: '2024-01-16T02:00:00Z'
  },
  {
    id: 'job-5',
    name: 'Azure Resource Sync',
    status: 'failed',
    lastRun: '2024-01-14T15:30:00Z',
    duration: '45s'
  }
];

interface SettingsPageProps {}

export function SettingsPage({}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState('general');

  const getStatusBadge = (status: string) => {
    const variants = {
      connected: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
      disconnected: 'bg-muted text-muted-foreground border-muted',
      error: 'bg-destructive/10 text-destructive border-destructive/20',
      running: 'bg-primary/10 text-primary border-primary/20',
      completed: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
      failed: 'bg-destructive/10 text-destructive border-destructive/20',
      scheduled: 'bg-chart-5/10 text-chart-5 border-chart-5/20'
    };
    return variants[status as keyof typeof variants];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'completed':
        return CheckCircle2;
      case 'disconnected':
        return XCircle;
      case 'error':
      case 'failed':
        return AlertCircle;
      case 'running':
        return RefreshCw;
      case 'scheduled':
        return Clock;
      default:
        return AlertCircle;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage system configuration and integrations</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="jobs">Background Jobs</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Settings</CardTitle>
              <CardDescription>Configure your organization details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Organization Name</label>
                  <Input defaultValue="Acme Corporation" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Admin Email</label>
                  <Input type="email" defaultValue="admin@acme.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Timezone</label>
                  <select className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm">
                    <option>America/New_York</option>
                    <option>America/Chicago</option>
                    <option>America/Denver</option>
                    <option>America/Los_Angeles</option>
                    <option>Europe/London</option>
                    <option>Europe/Paris</option>
                    <option>Asia/Tokyo</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Format</label>
                  <select className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm">
                    <option>MM/DD/YYYY</option>
                    <option>DD/MM/YYYY</option>
                    <option>YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure email and system notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Warranty Expiry Alerts</p>
                    <p className="text-sm text-muted-foreground">Receive alerts 30 days before warranty expires</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">License Expiry Alerts</p>
                    <p className="text-sm text-muted-foreground">Receive alerts 60 days before license expires</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Assignment Notifications</p>
                    <p className="text-sm text-muted-foreground">Notify users when assets are assigned</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Maintenance Reminders</p>
                    <p className="text-sm text-muted-foreground">Send reminders for scheduled maintenance</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4" />
                </label>
              </div>
              <Button>Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments */}
        

        {/* Integrations */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connected Integrations</CardTitle>
              <CardDescription>Manage third-party service integrations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrations.map((integration) => {
                  const StatusIcon = getStatusIcon(integration.status);
                  return (
                    <Card key={integration.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{integration.icon}</div>
                            <div>
                              <h3 className="font-semibold text-foreground">{integration.name}</h3>
                              <Badge variant="outline" className="text-xs mt-1">
                                {integration.category}
                              </Badge>
                            </div>
                          </div>
                          <Badge variant="outline" className={getStatusBadge(integration.status)}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {integration.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {integration.description}
                        </p>
                        {integration.lastSync && (
                          <p className="text-xs text-muted-foreground mb-3">
                            Last sync: {formatDateTime(integration.lastSync)}
                          </p>
                        )}
                        <div className="flex gap-2">
                          {integration.status === 'connected' ? (
                            <>
                              <Button variant="outline" size="sm">
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Sync Now
                              </Button>
                              <Button variant="ghost" size="sm">
                                Configure
                              </Button>
                            </>
                          ) : (
                            <Button size="sm">
                              Connect
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Background Jobs */}
        <TabsContent value="jobs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Background Jobs</CardTitle>
              <CardDescription>Monitor and manage automated tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {backgroundJobs.map((job) => {
                  const StatusIcon = getStatusIcon(job.status);
                  return (
                    <div key={job.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`h-5 w-5 ${
                          job.status === 'running' ? 'animate-spin text-primary' :
                          job.status === 'failed' ? 'text-destructive' :
                          job.status === 'completed' ? 'text-chart-2' :
                          'text-muted-foreground'
                        }`} />
                        <div>
                          <p className="font-medium text-foreground">{job.name}</p>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                            {job.lastRun && <span>Last run: {formatDateTime(job.lastRun)}</span>}
                            {job.nextRun && <span>Next run: {formatDateTime(job.nextRun)}</span>}
                            {job.duration && <span>Duration: {job.duration}</span>}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={getStatusBadge(job.status)}>
                        {job.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Role-Based Access Control</CardTitle>
              <CardDescription>Configure user roles and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-foreground">Admin</h3>
                    <Badge>Full Access</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Complete system access including user management, settings, and all data operations
                  </p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-foreground">Manager</h3>
                    <Badge variant="outline">Limited Access</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Can view and manage assets, users, and assignments within their department
                  </p>
                </div>
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-foreground">User</h3>
                    <Badge variant="outline">View Only</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Can view assigned assets and request new equipment
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Configure authentication and security policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Two-Factor Authentication</p>
                    <p className="text-sm text-muted-foreground">Require 2FA for all users</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Session Timeout</p>
                    <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
                  </div>
                  <select className="px-3 py-1 border border-input rounded-md bg-background text-sm">
                    <option>15 minutes</option>
                    <option>30 minutes</option>
                    <option>1 hour</option>
                    <option>4 hours</option>
                  </select>
                </label>
                <label className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Password Policy</p>
                    <p className="text-sm text-muted-foreground">Enforce strong password requirements</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </label>
              </div>
              <Button>Save Security Settings</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
