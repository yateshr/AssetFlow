import { useState } from 'react';
import { 
  LayoutDashboard, 
  BarChart3,
  Package, 
  Users, 
  Building2,
  MapPin, 
  Truck, 
  Receipt,
  ArrowRightLeft, 
  FileText, 
  Headphones,
  Key, 
  Settings,
  LogOut,
  Bell,
  Search,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Login } from './Login';
import { Dashboard } from './Dashboard';
import { AssetsPage } from './AssetsPage';
import { UsersPage } from './UsersPage';
import { DepartmentsPage } from './DepartmentsPage';
import { LocationsPage } from './LocationsPage';
import { VendorsPage } from './VendorsPage';
import { InvoicesPage } from './InvoicesPage';
import { AssignmentsPage } from './AssignmentsPage';
import { AuditLogsPage } from './AuditLogsPage';
import { LicensesPage } from './LicensesPage';
import { SettingsPage } from './SettingsPage';
import { CallLogsPage } from './CallLogsPage';
import { ReportsPage } from './ReportsPage';
import {
  departments as initialDepartments,
  locations as initialLocations,
  users as initialUsers,
  type Location,
  type User,
  type Vendor,
  type Asset,
  type Assignment,
  type Invoice,
  type AssetHistoryEvent,
  assets as initialAssets,
  assignments as initialAssignments,
  invoices as initialInvoices,
  vendors as initialVendors,
  assetHistory as initialAssetHistory
} from '@/data/sampleData';

export type Page = 'dashboard' | 'reports' | 'assets' | 'call-logs' | 'users' | 'departments' | 'locations' | 'vendors' | 'invoices' | 'assignments' | 'audit-logs' | 'licenses' | 'settings';

export function App() {
  const [usersList, setUsersList] = useState<User[]>(initialUsers);
  const [locationsList, setLocationsList] = useState<Location[]>(initialLocations);
  const [departmentsList, setDepartmentsList] = useState<string[]>(initialDepartments);
  const [assetsList, setAssetsList] = useState<Asset[]>(initialAssets);
  const [assignmentsList, setAssignmentsList] = useState<Assignment[]>(initialAssignments);
  const [invoicesList, setInvoicesList] = useState<Invoice[]>(initialInvoices);
  const [vendorsList, setVendorsList] = useState<Vendor[]>(initialVendors);
  const [assetHistory, setAssetHistory] = useState<AssetHistoryEvent[]>(initialAssetHistory);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const signedInUser = currentUser ? usersList.find(user => user.id === currentUser.id) || currentUser : null;

  if (!signedInUser) {
    return <Login users={usersList} onLogin={setCurrentUser} />;
  }

  const menuItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reports' as Page, label: 'Reports', icon: BarChart3 },
    { id: 'assets' as Page, label: 'Assets', icon: Package },
    { id: 'call-logs' as Page, label: 'IT Call Logbook', icon: Headphones },
    { id: 'users' as Page, label: 'Users', icon: Users },
    { id: 'departments' as Page, label: 'Departments', icon: Building2 },
    { id: 'locations' as Page, label: 'Locations', icon: MapPin },
    { id: 'vendors' as Page, label: 'Vendors', icon: Truck },
    { id: 'invoices' as Page, label: 'Invoices', icon: Receipt },
    { id: 'assignments' as Page, label: 'Assignments', icon: ArrowRightLeft },
    { id: 'audit-logs' as Page, label: 'Audit Logs', icon: FileText },
    { id: 'licenses' as Page, label: 'Licenses', icon: Key },
    { id: 'settings' as Page, label: 'Settings', icon: Settings },
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'reports':
        return <ReportsPage />;
      case 'assets':
        return (
          <AssetsPage
            assetsList={assetsList}
            onAssetsChange={setAssetsList}
            usersList={usersList}
            locationsList={locationsList}
            history={assetHistory}
            onHistoryChange={setAssetHistory}
            currentUser={signedInUser}
          />
        );
      case 'call-logs':
        return <CallLogsPage usersList={usersList} departmentsList={departmentsList} />;
      case 'users':
        return (
          <UsersPage
            usersList={usersList}
            onUsersChange={setUsersList}
            currentUserId={signedInUser.id}
            departmentsList={departmentsList}
            locationsList={locationsList}
            assetsList={assetsList}
            assignmentsList={assignmentsList}
            onAssetsChange={setAssetsList}
            onAssignmentsChange={setAssignmentsList}
            history={assetHistory}
            onHistoryChange={setAssetHistory}
            currentUser={signedInUser}
          />
        );
      case 'departments':
        return <DepartmentsPage departmentsList={departmentsList} onDepartmentsChange={setDepartmentsList} usersList={usersList} onUsersChange={setUsersList} />;
      case 'locations':
        return <LocationsPage locationsList={locationsList} onLocationsChange={setLocationsList} />;
      case 'vendors':
        return (
          <VendorsPage
            vendorsList={vendorsList}
            onVendorsChange={setVendorsList}
          />
        );
      case 'invoices':
        return (
          <InvoicesPage
      invoicesList={invoicesList}
      onInvoicesChange={setInvoicesList}
      assetsList={assetsList}
      onAssetsChange={setAssetsList}
      vendorsList={vendorsList}
      onVendorsChange={setVendorsList}
      currentUser={signedInUser}
      history={assetHistory}
      onHistoryChange={setAssetHistory}
    />
        );
      case 'assignments':
        return (
          <AssignmentsPage
            assignmentsList={assignmentsList}
            onAssignmentsChange={setAssignmentsList}
            assetsList={assetsList}
            onAssetsChange={setAssetsList}
            usersList={usersList}
            history={assetHistory}
            onHistoryChange={setAssetHistory}
            currentUser={signedInUser}
          />
        );
      case 'audit-logs':
        return <AuditLogsPage />;
      case 'licenses':
        return <LicensesPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-sidebar border-r border-sidebar-border
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-sidebar-primary" />
              <span className="font-semibold text-sidebar-foreground">AssetFlow</span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        setCurrentPage(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
                        transition-colors
                        ${isActive 
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }
                      `}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User info */}
          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-sm font-medium">
                {signedInUser.name.split(' ').map(name => name[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{signedInUser.name}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate capitalize">{signedInUser.role}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCurrentUser(null)}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search assets, users, calls, locations..."
                className="pl-9 w-[300px] lg:w-[400px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
