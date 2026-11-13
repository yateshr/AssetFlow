import { useState } from 'react';
import { Settings, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SettingsPage } from './SettingsPage';
import { ConfigurationPage } from './ConfigurationPage';
import type { Location, User } from '@/data/sampleData';

interface SettingsWithOrganizationPageProps {
  usersList: User[];
  onUsersChange: (users: User[]) => void;
  locationsList: Location[];
  onLocationsChange: (locations: Location[]) => void;
}

export function SettingsWithOrganizationPage(props: SettingsWithOrganizationPageProps) {
  const [tab, setTab] = useState<'general' | 'organization'>('general');

  return (
    <div className="af-stagger space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage application settings and organization configuration.
        </p>
      </div>

      <Card>
        <CardContent className="p-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={tab === 'general' ? 'default' : 'ghost'}
              onClick={() => setTab('general')}
            >
              <Settings className="mr-2 h-4 w-4" />
              General Settings
            </Button>
            <Button
              variant={tab === 'organization' ? 'default' : 'ghost'}
              onClick={() => setTab('organization')}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Organization Setup
            </Button>
          </div>
        </CardContent>
      </Card>

      {tab === 'general' ? (
        <SettingsPage />
      ) : (
        <ConfigurationPage {...props} />
      )}
    </div>
  );
}
