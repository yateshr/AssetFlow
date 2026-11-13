import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { 
  LayoutDashboard, 
  BarChart3,
  Package, 
  Wrench,
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
  Menu,
  X,
  Database,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Login, ConfigMissing } from './Login';
import { Toaster } from '@/components/ui/sonner';
import { loadConfig, saveConfig } from '@/lib/assetflowConfig';
import { Dashboard } from './Dashboard';
import { AssetsPage } from './AssetsPage';
import { UsersPage } from './UsersPage';
import { LocationsPage } from './LocationsPage';
import { VendorsPage } from './VendorsPage';
import { InvoicesPage } from './InvoicesPage';
import { AssignmentsPage } from './AssignmentsPage';
import { AuditLogsPage } from './AuditLogsPage';
import { LicensesPage } from './LicensesPage';
import { SettingsPage } from './SettingsPage';
import { CallLogsPage } from './CallLogsPage';
import { ReportsPage } from './ReportsPage';
import { GlobalSearch } from './GlobalSearch';
import { GlobalNotificationCenter } from './GlobalNotificationCenter';
import { OperationsPage } from './OperationsPage';
import { DataManagementPage } from './DataManagementPage';
import { SettingsWithOrganizationPage } from './SettingsWithOrganizationPage';
import {
  type Location,
  type User,
  type Vendor,
  type Asset,
  type Assignment,
  type Invoice,
  type AssetHistoryEvent,
  type ItCallLog,
} from '@/data/models';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import { clearCache, getCollection, hydrate, replaceCollection, useCollection } from '@/lib/db';
import { eraseAllData, loadDemoData } from '@/lib/demo';
import { Loader2, ShieldAlert } from 'lucide-react';

export type Page = 'dashboard' | 'reports' | 'assets' | 'operations' | 'call-logs' | 'users' | 'locations' | 'vendors' | 'invoices' | 'assignments' | 'audit-logs' | 'licenses' | 'settings' | 'data-tools';

type DepartmentRecord = { id: string; name: string };

function AppShell({ currentUserId, onLogout }: { currentUserId: string; onLogout: () => void }) {
  const [usersList, setUsersList] = useCollection<User>('users');
  const [locationsList, setLocationsList] = useCollection<Location>('locations');
  const [departmentRecords, setDepartmentRecords] = useCollection<DepartmentRecord>('departments');
  const [assetsList, setAssetsList] = useCollection<Asset>('assets');
  const [assignmentsList, setAssignmentsList] = useCollection<Assignment>('assignments');
  const [invoicesList, setInvoicesList] = useCollection<Invoice>('invoices');
  const [vendorsList, setVendorsList] = useCollection<Vendor>('vendors');
  const [assetHistory, setAssetHistory] = useCollection<AssetHistoryEvent>('history');
  const [callLogsList, setCallLogsList] = useCollection<ItCallLog>('call-logs');
  const departmentsList = departmentRecords.map(d => d.name);
  const setDepartmentsList = (names: string[]) => setDepartmentRecords(names.map(name => ({ id: name, name })));
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [operationsTab, setOperationsTab] = useState('overview');
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [assetFilterRequest, setAssetFilterRequest] = useState<{ status?: Asset['status']; warranty?: 'expired' | '30' | '60' | '90'; type?: Asset['type'] } | null>(null);
  const signedInUser = usersList.find(user => user.id === currentUserId) ?? null;
  const setCurrentUser = (_: null) => onLogout();

  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);

  // Restore saved theme (or system preference) once on the client
  useEffect(() => {
    try {
      const saved = localStorage.getItem('assetflow-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDark(saved ? saved === 'dark' : prefersDark);
    } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Start each page at the top
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0 });
  }, [currentPage]);

  const toggleTheme = () => {
    setDark(prev => {
      const next = !prev;
      try { localStorage.setItem('assetflow-theme', next ? 'dark' : 'light'); } catch { /* ignore */ }
      return next;
    });
  };

  if (!signedInUser) return null;


  const menuGroups: { label: string; items: { id: Page; label: string; icon: typeof Package }[] }[] = [
    {
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { id: 'assets', label: 'Assets', icon: Package },
        { id: 'assignments', label: 'Assignments', icon: ArrowRightLeft },
        { id: 'licenses', label: 'Licenses', icon: Key },
        { id: 'invoices', label: 'Invoices', icon: Receipt },
      ],
    },
    {
      label: 'Operations',
      items: [
        { id: 'operations', label: 'IT Operations', icon: Wrench },
        { id: 'call-logs', label: 'IT Call Logbook', icon: Headphones },
        { id: 'audit-logs', label: 'Audit Logs', icon: FileText },
      ],
    },
    {
      label: 'Organization',
      items: [
        { id: 'users', label: 'Users', icon: Users },
        { id: 'locations', label: 'Locations', icon: MapPin },
        { id: 'vendors', label: 'Vendors', icon: Truck },
      ],
    },
    {
      label: 'System',
      items: [
        { id: 'settings', label: 'Settings', icon: Settings },
        ...(signedInUser.role === 'admin' ? [{ id: 'data-tools' as Page, label: 'Demo & Data', icon: Database }] : []),
      ],
    },
  ];
  const menuItems = menuGroups.flatMap(g => g.items);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard
          onNavigate={setCurrentPage}
          assetsList={assetsList}
          usersList={usersList}
          assignmentsList={assignmentsList}
          onAssetDrilldown={(filter) => {
            setAssetFilterRequest(filter);
            setCurrentPage('assets');
          }}
        />;
      case 'reports':
        return (
          <ReportsPage
            assetsList={assetsList}
            usersList={usersList}
            assignmentsList={assignmentsList}
            invoicesList={invoicesList}
            vendorsList={vendorsList}
            locationsList={locationsList}
            departmentsList={departmentsList}
            callLogsList={callLogsList}
            history={assetHistory}
          />
        );
      case 'operations':
        return (
          <OperationsPage
            assetsList={assetsList}
            onAssetsChange={setAssetsList}
            usersList={usersList}
            history={assetHistory}
            onHistoryChange={setAssetHistory}
            currentUser={signedInUser}
            initialTab={operationsTab}
            onNotificationsChange={setNotificationCount}
            notificationOpen={notificationOpen}
            onNotificationOpenChange={setNotificationOpen}
          />
        );
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
            initialFilter={assetFilterRequest}
            onInitialFilterConsumed={() => setAssetFilterRequest(null)}
          />
        );
      case 'call-logs':
        return <CallLogsPage usersList={usersList} departmentsList={departmentsList} callLogs={callLogsList} onCallLogsChange={setCallLogsList} />;
      case 'users':
        return (
          <UsersPage
            usersList={usersList}
            onUsersChange={setUsersList}
            currentUserId={signedInUser.id}
            departmentsList={departmentsList}
            onDepartmentsChange={setDepartmentsList}
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
        return <AuditLogsPage history={assetHistory} usersList={usersList} assetsList={assetsList} />;
      case 'licenses':
        return <LicensesPage />;
      case 'settings':
        return (
          <SettingsWithOrganizationPage
            usersList={usersList}
            onUsersChange={setUsersList}
            locationsList={locationsList}
            onLocationsChange={setLocationsList}
          />
        );
      case 'data-tools':
        return (
          <DataManagementPage
            isAdmin={signedInUser.role === 'admin'}
            onLoadDemoData={async () => { await loadDemoData(); window.location.reload(); }}
            onEraseAllData={async () => { await eraseAllData(); window.location.reload(); }}
          />
        );
      default:
        return <Dashboard onNavigate={setCurrentPage} assetsList={assetsList} usersList={usersList} assignmentsList={assignmentsList} onAssetDrilldown={(filter) => { setAssetFilterRequest(filter); setCurrentPage('assets'); }} />;
    }
  };

  const initials = signedInUser.name.split(' ').map(name => name[0]).join('').slice(0, 2);
  const currentLabel = menuItems.find(i => i.id === currentPage)?.label ?? '';

  return (
    <div className="flex h-screen af-ambient">
      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 shrink-0
          bg-sidebar border-r border-sidebar-border
          transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          w-64 ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'}
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-primary to-chart-4 flex items-center justify-center shadow-lg shadow-primary/30">
                <Package className="h-5 w-5 text-white" />
              </div>
              <span className={`font-semibold text-lg tracking-tight text-sidebar-foreground whitespace-nowrap transition-opacity duration-200 ${collapsed ? 'lg:opacity-0' : ''}`}>
                AssetFlow
              </span>
            </div>
            <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-5">
            {menuGroups.map((group) => (
              <div key={group.label}>
                <p className={`px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 transition-opacity duration-200 ${collapsed ? 'lg:opacity-0 lg:h-0 lg:mb-0 lg:overflow-hidden' : ''}`}>
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => {
                            setCurrentPage(item.id);
                            setSidebarOpen(false);
                          }}
                          title={collapsed ? item.label : undefined}
                          aria-current={isActive ? 'page' : undefined}
                          className={`
                            group relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                            transition-all duration-200 active:scale-[0.98]
                            ${isActive
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground hover:translate-x-0.5'
                            }
                          `}
                        >
                          <span
                            className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-primary transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isActive ? 'h-5 opacity-100' : 'h-0 opacity-0'}`}
                          />
                          <Icon className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-primary' : ''}`} />
                          <span className={`whitespace-nowrap transition-opacity duration-200 ${collapsed ? 'lg:opacity-0' : ''}`}>{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* User info */}
          <div className="border-t border-sidebar-border p-3">
            <div className="flex items-center gap-3 rounded-xl p-2 hover:bg-sidebar-accent/50 transition-colors">
              <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-primary to-chart-4 text-white flex items-center justify-center text-sm font-semibold ring-2 ring-sidebar-border">
                {initials}
              </div>
              <div className={`flex-1 min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
                <p className="text-sm font-medium text-sidebar-foreground truncate">{signedInUser.name}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate capitalize">{signedInUser.role}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className={collapsed ? 'lg:hidden' : ''}
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 shrink-0 border-b border-border/70 af-glass sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex text-muted-foreground"
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>
            <GlobalSearch
              assets={assetsList}
              users={usersList}
              vendors={vendorsList}
              locations={locationsList}
              invoices={invoicesList}
              onNavigate={(page) => setCurrentPage(page)}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="hidden md:block mr-3 text-sm text-muted-foreground">{currentLabel}</span>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={toggleTheme}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span key={dark ? 'moon' : 'sun'} className="af-scale-in">
                {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground"
              title={`${notificationCount} unread notification${notificationCount === 1 ? '' : 's'}`}
              onClick={() => setNotificationOpen(true)}
            >
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-white text-[10px] leading-4 text-center font-medium af-scale-in ring-2 ring-background">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </Button>
          </div>
        </header>
        <GlobalNotificationCenter
          assets={assetsList}
          open={notificationOpen}
          onOpenChange={setNotificationOpen}
          onCountChange={setNotificationCount}
        />

        {/* Page content: keyed so each page animates in */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div key={currentPage} className="af-page mx-auto w-full max-w-[1500px]">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Authentication gate: signs in, loads this company's data, then shows the app.
// ---------------------------------------------------------------------------
type Phase =
  | { name: 'loading' }
  | { name: 'anon' }
  | { name: 'ready'; userId: string }
  | { name: 'blocked'; email: string }
  | { name: 'error'; message: string };

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen af-ambient flex items-center justify-center p-6">
      <div className="af-page max-w-md w-full rounded-2xl border bg-card p-8 text-center shadow-[var(--shadow-soft)]">{children}</div>
    </div>
  );
}

function AppGate() {
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  // undefined = nothing evaluated yet; null = signed out; string = signed-in auth id
  const activeUser = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    const boot = async (session: Session | null) => {
      const authId = session?.user.id ?? null;
      if (authId === activeUser.current) return; // token refresh etc.
      activeUser.current = authId;

      if (!session) {
        clearCache();
        if (!cancelled) setPhase({ name: 'anon' });
        return;
      }
      if (!cancelled) setPhase({ name: 'loading' });
      try {
        await hydrate();
        const email = (session.user.email ?? '').toLowerCase();
        const users = getCollection<User>('users');
        let me = users.find(u => u.email.toLowerCase() === email);

        // First run: the very first account becomes the administrator.
        if (!me && users.length === 0) {
          const meta = session.user.user_metadata ?? {};
          me = {
            id: crypto.randomUUID(),
            name: String(meta.full_name || email.split('@')[0]),
            email,
            department: '',
            locationId: '',
            role: 'admin',
            phone: '',
            joinDate: new Date().toISOString().split('T')[0],
            status: 'active',
          };
          await replaceCollection<User>('users', [me]);
          // Make sure it really reached the database before continuing.
          await hydrate();
          me = getCollection<User>('users').find(u => u.email.toLowerCase() === email);
          if (!me) throw new Error('The administrator account could not be saved. Check that the database migration has been applied.');
          if (meta.company_name) {
            const config = loadConfig();
            saveConfig({ ...config, organization: { ...config.organization, companyName: String(meta.company_name) } });
          }
        }

        if (cancelled) return;
        setPhase(me && me.status === 'active' ? { name: 'ready', userId: me.id } : { name: 'blocked', email });
      } catch (e) {
        if (!cancelled) setPhase({ name: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    };

    supabase.auth.getSession().then(({ data }) => boot(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { void boot(session); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const logout = async () => {
    await flushAndSignOut();
  };

  if (!supabase) return <ConfigMissing />;

  switch (phase.name) {
    case 'loading':
      return (
        <FullScreenMessage>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Loading your workspace…</p>
        </FullScreenMessage>
      );
    case 'anon':
      return <Login />;
    case 'blocked':
      return (
        <FullScreenMessage>
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-4 text-xl font-bold">No access</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {phase.email} is not an active user of this workspace. Ask an administrator to add or re-activate you.
          </p>
          <Button className="mt-6" variant="outline" onClick={logout}>Sign out</Button>
        </FullScreenMessage>
      );
    case 'error':
      return (
        <FullScreenMessage>
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-4 text-xl font-bold">Could not load data</h1>
          <p className="mt-2 text-sm text-muted-foreground break-words">{phase.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">Check that the migration in supabase/migrations has been run on this project.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Retry</Button>
            <Button variant="outline" onClick={logout}>Sign out</Button>
          </div>
        </FullScreenMessage>
      );
    case 'ready':
      return <AppShell key={phase.userId} currentUserId={phase.userId} onLogout={logout} />;
  }
}

async function flushAndSignOut() {
  const { pendingWrites, flushKv } = await import('@/lib/db');
  flushKv();
  await pendingWrites();
  await signOut();
}

export function App() {
  return (
    <>
      <AppGate />
      <Toaster richColors position="top-right" />
    </>
  );
}
