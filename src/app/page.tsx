'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar, { NAV_ITEMS } from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import AuthShell from '@/components/AuthShell';
import DashboardView from '@/components/DashboardView';
import CHISLookupView from '@/components/CHISLookupView';
import AICodingView from '@/components/AICodingView';
import UploadNoticeView from '@/components/UploadNoticeView';
import ModuleTableView from '@/components/ModuleTableView';
import ActivityLogView from '@/components/ActivityLogView';
import AccountSettingsView from '@/components/AccountSettingsView';
import PrintNoticeModal from '@/components/PrintNoticeModal';
import PasswordModal from '@/components/PasswordModal';
import { AppUser, DashboardMetrics, BaseRecord, ModuleType } from '@/lib/types';
import { useToast } from '@/components/Toast';

export default function Home() {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [transmitters, setTransmitters] = useState<{ userId: string; username: string; fullName: string }[]>([]);
  const [currentView, setCurrentView] = useState<string>('DASHBOARD');
  const [initialModuleStatus, setInitialModuleStatus] = useState<string>('ALL');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>('');

  // Modals
  const [printRecords, setPrintRecords] = useState<BaseRecord[] | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (res.ok && data.ok && data.user) {
        setUser(data.user);
        setTransmitters(data.transmitters || []);
        setGeneratedAt(data.generatedAt || '');
        if (data.user.mustChangePassword) {
          setPasswordModalOpen(true);
        }
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (res.ok && data.ok) {
        setDashboardMetrics(data.dashboard);
        setGeneratedAt(data.generatedAt || '');
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (user && currentView === 'DASHBOARD') {
      loadDashboard();
    }
  }, [user, currentView, loadDashboard]);

  function handleLoginSuccess(newToken: string, newUser: AppUser) {
    setToken(newToken);
    setUser(newUser);
    loadSession();
    toast(`Welcome back, ${newUser.fullName}!`);
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setUser(null);
    setToken(null);
    toast('Signed out successfully.');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Restoring secure session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthShell onLoginSuccess={handleLoginSuccess} />;
  }

  const activeNav = NAV_ITEMS.find(i => i.id === currentView) || NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex">
      {/* Collapsible Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={view => {
          setCurrentView(view);
          setInitialModuleStatus('ALL');
        }}
        user={user}
        onLogout={handleLogout}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Area (Dynamic Full Width) */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <Topbar
          title={activeNav.label}
          subtitle={
            currentView === 'DASHBOARD'
              ? 'Live priority countdown and monitoring queue'
              : currentView === 'CHIS_SEARCH'
              ? 'Search ICD-10 codes, RVS procedures, and PhilHealth case rates'
              : currentView === 'AI_CODING'
              ? 'Analyze diagnoses and suggest ICD-10 codes from your CHIS database'
              : currentView === 'UPLOAD'
              ? 'Import official PhilHealth RTH and Denied notice PDFs'
              : currentView === 'RTH'
              ? 'Retrieve, comply, and refile before the deadline'
              : currentView === 'DENIED'
              ? 'Track motion-for-reconsideration transmission deadlines'
              : currentView === 'INPATIENT'
              ? 'Monitor discharge-date transmission deadlines'
              : currentView === 'HD'
              ? 'Monitor encounter transmission deadlines'
              : currentView === 'ACTIVITY'
              ? 'Audit log and user modifications'
              : 'Profile, user accounts, and system configuration'
          }
          generatedAt={generatedAt}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onRefresh={() => {
            if (currentView === 'DASHBOARD') loadDashboard();
            else loadSession();
          }}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        <main className="p-4 sm:p-6 lg:p-8 w-full max-w-[1700px] mx-auto flex-1 transition-all">
          {currentView === 'DASHBOARD' && dashboardMetrics && (
            <DashboardView
              metrics={dashboardMetrics}
              user={user}
              onNavigateModule={(mod, st) => {
                setCurrentView(mod);
                if (st) setInitialModuleStatus(st);
              }}
            />
          )}

          {currentView === 'UPLOAD' && (
            <UploadNoticeView
              onSuccess={() => {
                setCurrentView('DASHBOARD');
                loadDashboard();
              }}
            />
          )}

          {currentView === 'CHIS_SEARCH' && <CHISLookupView />}

          {currentView === 'AI_CODING' && <AICodingView />}

          {['RTH', 'DENIED', 'INPATIENT', 'HD'].includes(currentView) && (
            <ModuleTableView
              key={`${currentView}-${initialModuleStatus}`}
              module={currentView as ModuleType}
              title={activeNav.label}
              subtitle={
                currentView === 'RTH'
                  ? 'Track compliance countdowns and refiled status'
                  : currentView === 'DENIED'
                  ? 'Track MR compliance deadlines and transmitters'
                  : currentView === 'INPATIENT'
                  ? '60-day discharge transmission monitor'
                  : '60-day hemodialysis encounter monitor'
              }
              user={user}
              transmitters={transmitters}
              initialStatus={initialModuleStatus}
              onOpenPrint={records => setPrintRecords(records)}
            />
          )}

          {currentView === 'ACTIVITY' && <ActivityLogView />}

          {currentView === 'ACCOUNT' && (
            <AccountSettingsView
              currentUser={user}
              onOpenChangePassword={() => setPasswordModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {printRecords && (
        <PrintNoticeModal records={printRecords} onClose={() => setPrintRecords(null)} />
      )}

      {passwordModalOpen && (
        <PasswordModal
          mustChange={user.mustChangePassword}
          onClose={() => setPasswordModalOpen(false)}
          onSuccess={() => {
            setPasswordModalOpen(false);
            loadSession();
          }}
        />
      )}
    </div>
  );
}
