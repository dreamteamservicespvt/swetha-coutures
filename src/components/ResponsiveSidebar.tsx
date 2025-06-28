
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ChevronLeft, 
  ChevronRight, 
  LayoutDashboard, 
  Package2, 
  Users, 
  Calendar, 
  FileText, 
  BarChart3, 
  Settings,
  Menu,
  X
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface SidebarItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const sidebarItems: SidebarItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Orders', url: '/orders', icon: Package2 },
  { title: 'Customers', url: '/customers', icon: Users },
  { title: 'Inventory', url: '/inventory', icon: Package2 },
  { title: 'Appointments', url: '/appointments', icon: Calendar },
  { title: 'Billing', url: '/billing', icon: FileText },
  { title: 'Reports', url: '/reports', icon: BarChart3 },
  { title: 'Settings', url: '/settings', icon: Settings },
];

interface ResponsiveSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onToggleMobile: () => void;
}

const ResponsiveSidebar: React.FC<ResponsiveSidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onToggleMobile
}) => {
  const location = useLocation();
  const isMobile = useIsMobile();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h1 className="text-xl font-bold text-purple-600">Swetha's Couture</h1>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={isMobile ? onToggleMobile : onToggleCollapse}
            className="ml-auto"
          >
            {isMobile ? (
              <X className="h-4 w-4" />
            ) : isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <TooltipProvider>
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.url;
            
            const navButton = (
              <NavLink
                to={item.url}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-purple-100 text-purple-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={isMobile ? onToggleMobile : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.title}</span>}
              </NavLink>
            );

            return isCollapsed && !isMobile ? (
              <Tooltip key={item.url}>
                <TooltipTrigger asChild>
                  {navButton}
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.title}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div key={item.url}>{navButton}</div>
            );
          })}
        </TooltipProvider>
      </nav>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile overlay */}
        {isMobileOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={onToggleMobile}
          />
        )}
        
        {/* Mobile sidebar */}
        <div className={`
          fixed top-0 left-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 z-50 md:hidden
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <SidebarContent />
        </div>
      </>
    );
  }

  // Desktop sidebar
  return (
    <div className={`
      hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300
      ${isCollapsed ? 'w-16' : 'w-64'}
    `}>
      <SidebarContent />
    </div>
  );
};

export default ResponsiveSidebar;
