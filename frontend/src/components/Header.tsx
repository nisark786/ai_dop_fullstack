import React from 'react';
import type { UserRole } from '../types';

interface HeaderProps {
  currentTabName: string;
  currentRole?: UserRole;
  onRoleChange?: (role: UserRole) => void;
  onOpenCopilot?: () => void;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTabName }) => {
  return (
    <header className="h-[66px] bg-white border-b border-[#E2E8F0] flex items-center justify-between px-6 sm:px-8 sticky top-0 z-10 select-none shadow-xs">
      {/* Left side: Screen Title & Minimal Breadcrumb */}
      <div>
        <h1 className="text-[19px] font-bold text-[#0A1F3C] tracking-tight leading-tight">
          {currentTabName}
        </h1>
        <p className="text-[12px] text-[#64748B] leading-none mt-0.5 hidden sm:block">
          SchoolPath AI-DOP Operations
        </p>
      </div>
    </header>
  );
};
