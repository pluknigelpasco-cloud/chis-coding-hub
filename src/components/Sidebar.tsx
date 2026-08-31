'use client';
import React from 'react';
import {
  LayoutGrid,
  Search,
  Sparkles,
  Upload,
  RotateCcw,
  Ban,
  Building2,
  Activity,
  History,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AppUser } from '@/lib/types';
import { HOSPITAL_NAME } from '@/lib/assets';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  user: AppUser | null;
  onLogout: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const NAV_ITEMS = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutGrid },
  { id: 'CHIS_SEARCH', label: 'CHIS Search', icon: Search },
  { id: 'AI_CODING', label: 'AI Coding Assistant', icon: Sparkles },
  { id: 'UPLOAD', label: 'Upload Notice PDF', icon: Upload },
  { id: 'RTH', label: 'RTH Notice', icon: RotateCcw },
  { id: 'DENIED', label: 'Denied Notice', icon: Ban },
  { id: 'INPATIENT', label: '60 Days Inpatient', icon: Building2 },
  { id: 'HD', label: '60 Days Hemodialysis', icon: Activity },
  { id: 'ACTIVITY', label: 'Activity Log', icon: History },
  { id: 'ACCOUNT', label: 'Account Settings', icon: Settings },
];

export default function Sidebar({
  currentView,
  onNavigate,
  user,
  onLogout,
  isOpenMobile,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <>
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 theme-sidebar text-white p-3 flex flex-col justify-between z-50 transition-all duration-300 shadow-2xl ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } ${isOpenMobile ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div>
          {/* Header Brand */}
          <div className="flex items-center justify-between pb-4 pt-1 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-0.5 shadow-lg shrink-0 overflow-hidden ring-2 ring-white/20">
                <img src="/cph_logo.png" alt="Hospital Logo" className="w-full h-full object-contain" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0 transition-opacity duration-200">
                  <h1 className="font-black text-sm leading-tight tracking-tight truncate text-white">Transmittal Monitor</h1>
                  <p className="text-[10px] text-blue-200 truncate font-medium">{HOSPITAL_NAME}</p>
                </div>
              )}
            </div>

            {/* Desktop Collapse Toggle Button */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-blue-200 hover:text-white transition-colors shrink-0"
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="mt-4 space-y-1.5">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onCloseMobile();
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl font-bold text-xs transition-all text-left group ${
                    active
                      ? 'bg-white text-navy shadow-lg shadow-black/10 scale-[1.02]'
                      : 'text-blue-100/90 hover:bg-white/10 hover:text-white'
                  } ${isCollapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                      active ? 'text-brand-blue' : 'text-blue-300'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        {user && (
          <div className={`bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 ${isCollapsed ? 'text-center' : ''}`}>
            <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-blue to-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-md">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black leading-tight truncate text-white">{user.fullName}</p>
                  <p className="text-[10px] text-blue-200 truncate font-semibold">
                    {user.role} · @{user.username}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={onLogout}
              title={isCollapsed ? 'Sign out' : undefined}
              className={`mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold text-red-200 hover:text-white hover:bg-red-500/20 rounded-xl transition-all ${
                isCollapsed ? 'px-0' : ''
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              {!isCollapsed && <span>Sign out</span>}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
