import { Component, lazy, Suspense, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
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
  CalendarClock,
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
import { GlobalSearch } from './GlobalSearch';
import { GlobalNotificationCenter } from './GlobalNotificationCenter';
import {
  type Location,
  type User,
  type Vendor,
  type Asset,
  type Assignment,
  type Invoice,
  type AssetHistoryEvent,
  type ItCallLog,
  type AssetCategory,
  type Company,
} from '@/data/models';
import { DEFAULT_ASSET_CATEGORIES } from '@/data/assetCategories';
import { DEFAULT_SYSTEM_POLICY, MASTER_DATA_DEFAULTS, type MasterDataOption, type SystemPolicy } from '@/data/masterData';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import { clearCache, getActiveCompanyId, getCollection, hydrate, loadCompanies, replaceCollection, useCollection } from '@/lib/db';
import { eraseAllData, loadDemoData } from '@/lib/demo';
import { ShieldAlert } from 'lucide-react';
import { PageLoader, WorkspaceBoot } from '@/components/ui/loading';

const ExpiryCenterPage = lazy(() => import('./ExpiryCenterPage').then(module => ({ default: module.ExpiryCenterPage })));
const Dashboard = lazy(() => import('./Dashboard').then(module => ({ default: module.Dashboard })));
const AssetsPage = lazy(() => import('./AssetsPage').then(module => ({ default: module.AssetsPage })));
const UsersPage = lazy(() => import('./UsersPage').then(module => ({ default: module.UsersPage })));
const LocationsPage = lazy(() => import('./LocationsPage').then(module => ({ default: module.LocationsPage })));
const VendorsPage = lazy(() => import('./VendorsPage').then(module => ({ default: module.VendorsPage })));
const InvoicesPage = lazy(() => import('./InvoicesPage').then(module => ({ default: module.InvoicesPage })));
const AssignmentsPage = lazy(() => import('./AssignmentsPage').then(module => ({ default: module.AssignmentsPage })));
const AuditLogsPage = lazy(() => import('./AuditLogsPage').then(module => ({ default: module.AuditLogsPage })));
const LicensesPage = lazy(() => import('./LicensesPage').then(module => ({ default: module.LicensesPage })));
const CallLogsPage = lazy(() => import('./CallLogsPage').then(module => ({ default: module.CallLogsPage })));
const ReportsPage = lazy(() => import('./ReportsPage').then(module => ({ default: module.ReportsPage })));
const OperationsPage = lazy(() => import('./OperationsPage').then(module => ({ default: module.OperationsPage })));
const DataManagementPage = lazy(() => import('./DataManagementPage').then(module => ({ default: module.DataManagementPage })));
const SettingsWithOrganizationPage = lazy(() => import('./SettingsWithOrganizationPage').then(module => ({ default: module.SettingsWithOrganizationPage })));
const TransferApprovalsPage = lazy(() => import('./TransferApprovalsPage').then(module => ({ default: module.TransferApprovalsPage })));

export type Page = 'dashboard' | 'reports' | 'assets' | 'operations' | 'call-logs' | 'users' | 'locations' | 'vendors' | 'invoices' | 'assignments' | 'audit-logs' | 'licenses' | 'expiry' | 'settings' | 'data-tools' | 'transfer-approvals';

type DepartmentRecord = { id: string; name: string; siteId?: string };

class ApplicationErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AssetFlow application error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <section className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">AssetFlow could not start</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">The browser encountered an application error. Refresh once; if it persists, the technical details below identify the failing part.</p>
          <pre className="mt-5 max-h-36 overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-rose-200">{this.state.error.message}</pre>
          <Button className="mt-6" onClick={() => window.location.reload()}>Reload AssetFlow</Button>
        </section>
      </div>
    );
  }
}

function AppShell({ currentUserId, currentUserProfile, onLogout, companies }: { currentUserId: string; currentUserProfile: User; onLogout: () => void; companies: Company[] }) {
  const [usersList, setUsersList] = useCollection<User>('users');
  const [sitesList, setSitesList] = useCollection<Location>('locations');
  const [departmentRecords, setDepartmentRecords] = useCollection<DepartmentRecord>('departments');
  const [assetsList, setAssetsList] = useCollection<Asset>('assets');
  const [assignmentsList, setAssignmentsList] = useCollection<Assignment>('assignments');
  const [invoicesList, setInvoicesList] = useCollection<Invoice>('invoices');
  const [vendorsList, setVendorsList] = useCollection<Vendor>('vendors');
  const [assetHistory, setAssetHistory] = useCollection<AssetHistoryEvent>('history');
  const [callLogsList, setCallLogsList] = useCollection<ItCallLog>('call-logs');
  const [assetCategories, setAssetCategories] = useCollection<AssetCategory>('asset-categories');
  const departmentsList = Array.from(new Set(departmentRecords.map(d => d.name)));
  const setDepartmentsList = (names: string[]) => setDepartmentRecords(names.map(name => ({ id: crypto.randomUUID(), name })));
  // Scanning a label QR code opens the app at /?asset=TAG: jump straight to that asset.
  const [assetSearchRequest, setAssetSearchRequest] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get('asset'); } catch { return null; }
  });
  const [currentPage, setCurrentPage] = useState<Page>(() => (assetSearchRequest ? 'assets' : 'dashboard'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [operationsTab, setOperationsTab] = useState('overview');
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [assetFilterRequest, setAssetFilterRequest] = useState<{ status?: Asset['status']; warranty?: 'expired' | '30' | '60' | '90'; type?: Asset['type'] } | null>(null);
  const signedInUser = usersList.find(user => user.id === currentUserId) ?? currentUserProfile;
  const activeCompanyId=getActiveCompanyId();
  const activeCompany=companies.find(company=>company.id===activeCompanyId);
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

  const menuGroups: { label: string; items: { id: Page; label: string; icon: typeof Package }[] }[] = [
    {
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'expiry', label: 'Expiry & Alerts', icon: CalendarClock },
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
        { id: 'users', label: 'Employees', icon: Users },
        { id: 'locations', label: 'Sites', icon: MapPin },
        { id: 'vendors', label: 'Vendors', icon: Truck },
      ],
    },
    {
      label: 'System',
      items: [
        { id: 'settings', label: 'Settings', icon: Settings },
        ...(['super_admin','admin'].includes(signedInUser.role) ? [{ id: 'transfer-approvals' as Page, label: 'Transfer Approvals', icon: ArrowRightLeft }] : []),
        ...(['super_admin','admin'].includes(signedInUser.role) ? [{ id: 'data-tools' as Page, label: 'Data Management', icon: Database }] : []),
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
            sitesList={sitesList}
            departmentsList={departmentsList}
            assetCategories={assetCategories}
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
            sitesList={sitesList}
            history={assetHistory}
            onHistoryChange={setAssetHistory}
            currentUser={signedInUser}
            assetCategories={assetCategories}
            invoices={invoicesList}
            companies={companies}
            initialFilter={assetFilterRequest}
            onInitialFilterConsumed={() => setAssetFilterRequest(null)}
            initialSearch={assetSearchRequest}
            onInitialSearchConsumed={() => { setAssetSearchRequest(null); try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ } }}
          />
        );
      case 'call-logs':
        return <CallLogsPage usersList={usersList} departmentsList={departmentsList} assetsList={assetsList} callLogs={callLogsList} onCallLogsChange={setCallLogsList} currentUser={signedInUser} />;
      case 'users':
        return (
          <UsersPage
            usersList={usersList}
            onUsersChange={setUsersList}
            currentUserId={signedInUser.id}
            departmentsList={departmentsList}
            onDepartmentsChange={setDepartmentsList}
            departmentRecords={departmentRecords}
            onDepartmentRecordsChange={setDepartmentRecords}
            sitesList={sitesList}
            assetsList={assetsList}
            assignmentsList={assignmentsList}
            onAssetsChange={setAssetsList}
            onAssignmentsChange={setAssignmentsList}
            history={assetHistory}
            onHistoryChange={setAssetHistory}
            currentUser={signedInUser}
            companies={companies}
          />
        );
      case 'locations':
        return <LocationsPage sitesList={sitesList} onSitesChange={setSitesList} />;
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
      assetCategories={assetCategories}
      sitesList={sitesList}
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
      case 'expiry':
        return <ExpiryCenterPage assetsList={assetsList} invoicesList={invoicesList} vendorsList={vendorsList} onNavigate={setCurrentPage} />;
      case 'licenses':
        return <LicensesPage />;
      case 'settings':
        return (
          <SettingsWithOrganizationPage
            usersList={usersList}
            onUsersChange={setUsersList}
            sitesList={sitesList}
            onSitesChange={setSitesList}
            assetCategories={assetCategories}
            onAssetCategoriesChange={setAssetCategories}
            companies={companies}
            onCompaniesChanged={() => window.location.reload()}
          />
        );
      case 'data-tools':
        return (
          <DataManagementPage
            isAdmin={['super_admin','admin'].includes(signedInUser.role)}
            onLoadDemoData={async () => { await loadDemoData(); window.location.reload(); }}
            onEraseAllData={async () => { await eraseAllData(); window.location.reload(); }}
          />
        );
      case 'transfer-approvals':
        return <TransferApprovalsPage companies={companies} />;
      default:
        return <Dashboard onNavigate={setCurrentPage} assetsList={assetsList} usersList={usersList} assignmentsList={assignmentsList} onAssetDrilldown={(filter) => { setAssetFilterRequest(filter); setCurrentPage('assets'); }} />;
    }
  };

  const initials = signedInUser.name.split(' ').map(name => name[0]).join('').slice(0, 2);
  const currentLabel = menuItems.find(i => i.id === currentPage)?.label ?? '';

  return (
    <div className="flex h-screen bg-background">
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
          w-[248px] ${collapsed ? 'lg:w-[68px]' : 'lg:w-[248px]'}
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-8 w-8 shrink-0 rounded-md bg-white/10 ring-1 ring-white/10 flex items-center justify-center">
                <Package className="h-[18px] w-[18px] text-sidebar-primary" />
              </div>
              <span className={`font-semibold text-[17px] tracking-[-0.02em] text-sidebar-foreground whitespace-nowrap transition-opacity duration-150 ${collapsed ? 'lg:opacity-0' : ''}`}>
                AssetFlow
              </span>
            </div>
            <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3 space-y-4">
            {menuGroups.map((group) => (
              <div key={group.label}>
                <p className={`px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45 transition-opacity duration-150 ${collapsed ? 'lg:opacity-0 lg:h-0 lg:mb-0 lg:overflow-hidden' : ''}`}>
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
                            group relative w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] font-medium
                            transition-colors duration-150
                            ${isActive
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                            }
                          `}
                        >
                          <span
                            className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-primary transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isActive ? 'h-5 opacity-100' : 'h-0 opacity-0'}`}
                          />
                          <Icon className={`h-[17px] w-[17px] shrink-0 ${isActive ? 'text-sidebar-primary' : ''}`} />
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
            <div className="flex items-center gap-3 rounded-md p-2 hover:bg-sidebar-accent transition-colors">
              <div className="h-8 w-8 shrink-0 rounded-md bg-white/10 text-sidebar-foreground flex items-center justify-center text-xs font-semibold ring-1 ring-white/10">
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
        <header className="h-16 shrink-0 border-b bg-card sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6">
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
              locations={sitesList}
              invoices={invoicesList}
              onNavigate={(page) => setCurrentPage(page)}
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="hidden sm:flex items-center gap-2 mr-2 rounded-md border bg-background px-2.5 h-9">
              <Building2 className="h-4 w-4 text-muted-foreground"/>
              <span className="sr-only">Active company</span>
              <select className="max-w-48 bg-transparent text-sm font-medium outline-none" value={activeCompanyId??''} onChange={event=>{localStorage.setItem('assetflow-company-id',event.target.value);window.location.reload();}}>
                {companies.filter(company=>company.active).map(company=><option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <span className="hidden xl:block mr-3 text-xs font-medium text-muted-foreground">{activeCompany?.code ?? 'Workspace'} / <span className="text-foreground">{currentLabel}</span></span>
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
            <GlobalNotificationCenter
              assets={assetsList}
              invoices={invoicesList}
              callLogs={callLogsList}
              vendors={vendorsList}
              onViewAll={() => { setNotificationOpen(false); setCurrentPage('expiry'); }}
              open={notificationOpen}
              onOpenChange={setNotificationOpen}
              onCountChange={setNotificationCount}
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative text-muted-foreground hover:text-foreground"
                  title={`${notificationCount} unread notification${notificationCount === 1 ? '' : 's'}`}
                >
                  <Bell className="h-5 w-5" />
                  {notificationCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-white text-[10px] leading-4 text-center font-medium af-scale-in ring-2 ring-background">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </span>
                  )}
                </Button>
              }
            />
          </div>
        </header>
        {/* Page content: keyed so each page animates in */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-7">
          <div key={currentPage} className="af-page mx-auto w-full max-w-[1440px]">
            <Suspense fallback={
              <PageLoader label={`Loading ${currentLabel || 'page'}`} />
            }>
              {renderPage()}
            </Suspense>
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
  | { name: 'ready'; user: User; companies: Company[] }
  | { name: 'blocked'; email: string }
  | { name: 'error'; message: string };

const withTimeout = <T,>(promise: Promise<T>, label: string, ms = 20000) => Promise.race<T>([
  promise,
  new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(`${label} timed out. Check your Supabase connection, then retry.`)), ms)),
]);

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
        await withTimeout(hydrate(), 'Loading workspace data');
        if (getCollection<AssetCategory>('asset-categories').length === 0) {
          await replaceCollection<AssetCategory>('asset-categories', DEFAULT_ASSET_CATEGORIES);
        }
        for (const [collection, defaults] of Object.entries(MASTER_DATA_DEFAULTS)) {
          if (getCollection<MasterDataOption>(collection).length === 0) await replaceCollection(collection, defaults);
        }
        if (getCollection<SystemPolicy>('system-policies').length === 0) await replaceCollection('system-policies', [DEFAULT_SYSTEM_POLICY]);
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
            siteId: '',
            role: 'super_admin',
            phone: '',
            joinDate: new Date().toISOString().split('T')[0],
            status: 'active',
          };
          await replaceCollection<User>('users', [me]);
          // Make sure it really reached the database before continuing.
          await withTimeout(hydrate(), 'Refreshing workspace data');
          me = getCollection<User>('users').find(u => u.email.toLowerCase() === email);
          if (!me) throw new Error('The administrator account could not be saved. Check that the database migration has been applied.');
          if (meta.company_name) {
            const config = loadConfig();
            saveConfig({ ...config, organization: { ...config.organization, companyName: String(meta.company_name) } });
          }
        }

        const companies=await withTimeout(loadCompanies(), 'Loading company access');
        // IT access is separate from employee records. An invited site IT admin
        // can sign in without being added to the employee directory.
        if (!me && companies.length) {
          const meta=session.user.user_metadata ?? {};
          me={id:authId,name:String(meta.full_name||email.split('@')[0]),email,department:'IT',siteId:'',role:'manager',phone:'',joinDate:new Date().toISOString().slice(0,10),status:'active'};
        }
        if (cancelled) return;
        setPhase(me && me.status === 'active' ? { name: 'ready', user: me, companies } : { name: 'blocked', email });
      } catch (e) {
        if (!cancelled) setPhase({ name: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    };

    void withTimeout(supabase.auth.getSession(), 'Checking sign-in').then(({ data }) => boot(data.session)).catch(error => { if (!cancelled) setPhase({ name: 'error', message: error instanceof Error ? error.message : String(error) }); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { void boot(session); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const logout = async () => {
    await flushAndSignOut();
  };

  if (!supabase) return <ConfigMissing />;

  switch (phase.name) {
    case 'loading':
      return <WorkspaceBoot />;
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
      return <AppShell key={`${phase.user.id}:${getActiveCompanyId()}`} currentUserId={phase.user.id} currentUserProfile={phase.user} companies={phase.companies} onLogout={logout} />;
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
      <ApplicationErrorBoundary>
        <AppGate />
      </ApplicationErrorBoundary>
      <Toaster richColors position="top-right" />
    </>
  );
}
