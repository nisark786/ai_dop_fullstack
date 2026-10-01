import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  GraduationCap,
  Bot,
  CircleDollarSign,
  ClipboardCheck,
  Zap,
  CheckCircle2,
  RefreshCw,
  Trash2,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export interface NavGroup {
  groupName: string;
  items: NavItem[];
}

interface SidebarProps {}

export const Sidebar: React.FC<SidebarProps> = () => {
  const navGroups: NavGroup[] = [
    {
      groupName: 'CORE OPERATIONS',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/schools', label: 'School Management', icon: GraduationCap },
        { path: '/batches', label: 'Batch Management', icon: Layers },
      ],
    },
    {
      groupName: 'AI AGENTS',
      items: [
        { path: '/agents', label: 'Agent Operations', icon: Bot },
        { path: '/costs', label: 'Cost & Token Monitor', icon: CircleDollarSign },
      ],
    },
    {
      groupName: 'REVIEW & PUBLISH',
      items: [
        {
          path: '/results',
          label: 'Results',
          icon: ClipboardCheck,
        },
        {
          path: '/review',
          label: 'Verification Queue',
          icon: Zap,
        },
        {
          path: '/approved',
          label: 'Approved Schools',
          icon: CheckCircle2,
        },
        {
          path: '/recrawl',
          label: 'Re-crawl Queue',
          icon: RefreshCw,
        },
      ],
    },
  ];

  return (
    <aside className="w-16 sm:w-72 min-w-[4rem] sm:min-w-[18rem] bg-[#0A1F3C] text-[#CBD5E1] flex flex-col h-screen sticky top-0 z-20 select-none border-r border-[#1B3F73]">
      {/* Brand logo & title */}
      <div className="h-16 flex items-center gap-3.5 px-5 border-b border-[#1B3F73] justify-center sm:justify-start">
        <div className="w-9 h-9 rounded-lg bg-[#2563EB] text-white flex items-center justify-center flex-shrink-0 shadow-md">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <div className="hidden sm:flex flex-col">
          <span className="text-sm font-bold text-white tracking-wide leading-tight">
            SchoolPath
          </span>
          <span className="text-[11px] text-[#94A3B8] leading-none mt-1">data operations platform</span>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 p-4 overflow-y-auto space-y-5">
        {navGroups.map((grp) => (
          <div key={grp.groupName} className="space-y-1.5">
            <div className="hidden sm:block text-[11px] font-semibold uppercase tracking-wider text-[#7F93B2] px-3.5 py-1">
              {grp.groupName}
            </div>
            <ul className="space-y-1.5 list-none m-0 p-0">
              {grp.items.map((item) => {
                const IconComponent = item.icon;
                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm transition-all duration-150 justify-center sm:justify-start cursor-pointer ${
                          isActive
                            ? 'bg-[#2563EB] text-white font-semibold shadow-sm'
                            : 'text-[#CBD5E1] hover:text-white hover:bg-[#12305C]'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <IconComponent
                            className={`w-4 h-4 flex-shrink-0 ${
                              isActive ? 'text-white' : 'text-[#94A3B8]'
                            }`}
                          />
                          <span className="hidden sm:inline flex-1 text-left truncate">{item.label}</span>
                          {item.badge && (
                            <span className="hidden sm:inline bg-[#F59E0B] text-[#0A1F3C] text-xs font-bold px-2 py-0.5 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom Trash Bucket */}
      <div className="px-4 py-2 border-t border-[#1B3F73]/60">
        <NavLink
          to="/trash"
          className={({ isActive }) =>
            `w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 justify-center sm:justify-start cursor-pointer ${
              isActive
                ? 'bg-[#2563EB] text-white font-semibold shadow-sm'
                : 'text-[#CBD5E1] hover:text-white hover:bg-[#12305C]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Trash2
                className={`w-4 h-4 flex-shrink-0 ${
                  isActive ? 'text-white' : 'text-[#94A3B8]'
                }`}
              />
              <span className="hidden sm:inline flex-1 text-left truncate">Trash Bucket</span>
            </>
          )}
        </NavLink>
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-[#1B3F73] bg-[#07172E] flex justify-center sm:justify-start">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Zap className="w-3 h-3 fill-current" />
          </div>
          <div className="hidden sm:flex flex-col">
            <strong className="text-xs text-white font-semibold leading-tight">ERCIE Brain Active</strong>
            <small className="text-[10px] text-[#7F93B2] mt-0.5">Continuous verification</small>
          </div>
        </div>
      </div>
    </aside>
  );
};
