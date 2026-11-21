import { useState } from 'react';
import { Settings, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SettingsPage } from './SettingsPage';
import { ConfigurationPage } from './ConfigurationPage';
import type { AssetCategory, Location, User } from '@/data/models';
import type { Company } from '@/data/models';
import { CompanyManagement } from './CompanyManagement';

interface SettingsWithOrganizationPageProps {
  usersList: User[];
  onUsersChange: (users: User[]) => void;
  sitesList: Location[];
  onSitesChange: (locations: Location[]) => void;
  assetCategories: AssetCategory[];
  onAssetCategoriesChange: (categories: AssetCategory[]) => void;
  companies: Company[];
  onCompaniesChanged: () => void;
}

export function SettingsWithOrganizationPage(props: SettingsWithOrganizationPageProps) {
  const [tab, setTab] = useState<'system' | 'company'>('system');

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
              variant={tab === 'system' ? 'default' : 'ghost'}
              onClick={() => setTab('system')}
            >
              <Settings className="mr-2 h-4 w-4" />
              System Settings
            </Button>
            <Button
              variant={tab === 'company' ? 'default' : 'ghost'}
              onClick={() => setTab('company')}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Company Setup
            </Button>
          </div>
        </CardContent>
      </Card>

      {tab === 'system' ? (
        <SettingsPage />
      ) : (
        <div className="space-y-6"><CompanyManagement companies={props.companies} locations={props.sitesList} onChanged={props.onCompaniesChanged}/><ConfigurationPage {...props} /></div>
      )}
    </div>
  );
}
