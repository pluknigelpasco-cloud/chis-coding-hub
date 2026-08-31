'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useTheme, THEMES, AppTheme } from '@/lib/theme';

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentThemeObj = THEMES.find(t => t.id === theme) || THEMES[0];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-sm transition-all cursor-pointer group"
        title="Change App Theme"
      >
        <span className="text-sm">{currentThemeObj.icon}</span>
        <span className="hidden md:inline font-black text-[11px] text-slate-800">{currentThemeObj.name}</span>
        <Palette className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-blue transition-colors" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 border-b border-slate-100 mb-1">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Hospital Theme</p>
            <p className="text-xs font-bold text-slate-700">Choose visual styling</p>
          </div>

          <div className="space-y-1">
            {THEMES.map(t => {
              const active = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTheme(t.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    active
                      ? 'bg-blue-50/80 border border-blue-200/80 text-navy font-bold'
                      : 'hover:bg-slate-50 text-slate-700 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{t.icon}</span>
                    <div>
                      <p className="text-xs font-black leading-tight flex items-center gap-1.5">
                        {t.name}
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ backgroundColor: t.color }}
                        />
                      </p>
                      <p className="text-[10px] text-slate-400 font-normal line-clamp-1">{t.desc}</p>
                    </div>
                  </div>
                  {active && <Check className="w-4 h-4 text-brand-blue shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
