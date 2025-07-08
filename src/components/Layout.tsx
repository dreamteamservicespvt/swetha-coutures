import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useBusinessSettings } from '@/components/BusinessSettingsProvider';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingBag, 
  Package, 
  Calendar, 
  Scissors, 
  UserPlus, 
  DollarSign, 
  BarChart3, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Shield,
  ChevronDown,
  User,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { toast } from '@/hooks/use-toast';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { userData } = useAuth();
  const { theme, setTheme } = useTheme();
  const { settings: businessSettings } = useBusinessSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isAdmin = userData?.role === 'admin';
  const isStaff = userData?.role === 'staff';

  const adminMenuItems = [
    { name: 'Admin Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Orders', href: '/orders', icon: ShoppingBag },
    { name: 'Billing', href: '/billing', icon: Receipt },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Income & Expenses', href: '/income-expenses', icon: DollarSign },
    { name: 'ROI Analytics', href: '/roi-analytics', icon: BarChart3 },
    { name: 'Staff', href: '/staff', icon: UserPlus },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Appointments', href: '/appointments', icon: Calendar },
    { name: 'Alterations', href: '/alterations', icon: Scissors },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const staffMenuItems = [
    { name: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
    { name: 'My Orders', href: '/staff/orders', icon: ShoppingBag },
    { name: 'My Alterations', href: '/staff/alterations', icon: Scissors },
    { name: 'Inventory View', href: '/staff/inventory', icon: Package },
  ];

  const menuItems = isAdmin ? adminMenuItems : staffMenuItems;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "Failed to log out",
        variant: "destructive",
      });
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
            onClick={closeSidebar}
          />
        )}

        {/* Desktop Sidebar */}
        <div className={`
          hidden lg:flex flex-col bg-card border-r border-border shadow-sm sidebar-shadow transition-all duration-300 ease-in-out fixed inset-y-0 left-0 z-30
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
        `}>
          <div className="flex flex-col h-full">
            {/* Logo Section - Fixed header spacing */}
            <div className={`flex items-center min-h-[4rem] px-3 border-b border-border ${sidebarCollapsed ? 'justify-center py-4' : 'justify-between py-3'}`}>
              {!sidebarCollapsed && (
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-9 h-9 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">SC</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base font-semibold text-foreground truncate">{businessSettings?.businessName || 'Business Management'}</h1>
                    <p className="text-xs text-muted-foreground truncate">{isAdmin ? 'Admin Panel' : 'Staff Panel'}</p>
                  </div>
                </div>
              )}
              
              {sidebarCollapsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-9 h-9 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">SC</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-medium">{businessSettings?.businessName || 'Business Management'}</p>
                    <p className="text-xs">{isAdmin ? 'Admin Panel' : 'Staff Panel'}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {!sidebarCollapsed && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleSidebarCollapse}
                  className="collapse-btn w-8 h-8 p-0 flex-shrink-0"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              )}
              
              {sidebarCollapsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={toggleSidebarCollapse}
                      className="collapse-btn w-8 h-8 p-0 absolute -right-3 top-1/2 -translate-y-1/2 bg-card border border-border shadow-sm"
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    Expand Sidebar
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-thin">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                
                const menuButton = (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={closeSidebar}
                    className={`
                      flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group sidebar-item menu-item
                      ${sidebarCollapsed ? 'justify-center w-10 h-10' : 'space-x-3'}
                      ${isActive 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-accent-foreground'} flex-shrink-0`} />
                    {!sidebarCollapsed && <span className="truncate sidebar-text">{item.name}</span>}
                  </Link>
                );

                return sidebarCollapsed ? (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      {menuButton}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  menuButton
                );
              })}
            </nav>

            {/* Theme Toggle */}
            <div className="px-2 py-2 border-t border-border">
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleTheme}
                      className="w-10 h-10 p-0 justify-center theme-toggle"
                    >
                      {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className="w-full justify-start space-x-3 theme-toggle"
                >
                  {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </Button>
              )}
            </div>

            {/* User Profile Section */}
            <div className="border-t border-border p-2">
              <div className="relative">
                {sidebarCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                          <User className="h-3 w-3 text-white" />
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <div className="text-sm">
                        <p className="font-medium">{userData?.name || 'User'}</p>
                        <p className="text-muted-foreground">{userData?.email}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-3 w-full p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-foreground">{userData?.name || 'User'}</p>
                      <p className="text-xs text-muted-foreground">{userData?.email}</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}

                {/* User Dropdown Menu */}
                {userMenuOpen && (
                  <div className={`absolute user-menu ${sidebarCollapsed ? 'bottom-0 left-full ml-2' : 'bottom-full left-0 right-0 mb-2'} bg-card border border-border rounded-lg shadow-lg py-2 z-50`}>
                    {sidebarCollapsed && (
                      <div className="px-4 py-2 border-b border-border min-w-48">
                        <p className="text-sm font-medium text-foreground">{userData?.name}</p>
                        <p className="text-xs text-muted-foreground">{userData?.email}</p>
                        <Badge 
                          variant="outline" 
                          className={`mt-1 text-xs ${isAdmin ? 'text-purple-600 border-purple-200' : 'text-blue-600 border-blue-200'}`}
                        >
                          {isAdmin ? 'Administrator' : 'Staff Member'}
                        </Badge>
                      </div>
                    )}
                    {!sidebarCollapsed && (
                      <div className="px-4 py-2 border-b border-border">
                        <p className="text-sm font-medium text-foreground">{userData?.name}</p>
                        <p className="text-xs text-muted-foreground">{userData?.email}</p>
                        <Badge 
                          variant="outline" 
                          className={`mt-1 text-xs ${isAdmin ? 'text-purple-600 border-purple-200' : 'text-blue-600 border-blue-200'}`}
                        >
                          {isAdmin ? 'Administrator' : 'Staff Member'}
                        </Badge>
                      </div>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-card shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full">
            {/* Mobile Logo Section */}
            <div className="flex items-center justify-between h-16 px-6 border-b border-border">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SC</span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">{businessSettings?.businessName || 'Business Management'}</h1>
                  <p className="text-xs text-muted-foreground">{isAdmin ? 'Admin Panel' : 'Staff Panel'}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={closeSidebar}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Mobile Navigation Menu */}
            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={closeSidebar}
                    className={`
                      flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150
                      ${isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }
                    `}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Theme Toggle */}
            <div className="px-4 py-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="w-full justify-start space-x-3 theme-toggle"
              >
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
              </Button>
            </div>

            {/* Mobile User Profile Section */}
            <div className="border-t border-border p-4">
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center space-x-3 w-full p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-foreground">{userData?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{userData?.email}</p>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Mobile User Dropdown Menu */}
                {userMenuOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg py-2 z-50">
                    <div className="px-4 py-2 border-b border-border">
                      <p className="text-sm font-medium text-foreground">{userData?.name}</p>
                      <p className="text-xs text-muted-foreground">{userData?.email}</p>
                      <Badge 
                        variant="outline" 
                        className={`mt-1 text-xs ${isAdmin ? 'text-purple-600 border-purple-200' : 'text-blue-600 border-blue-200'}`}
                      >
                        {isAdmin ? 'Administrator' : 'Staff Member'}
                      </Badge>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
          {/* Top Navigation Bar */}
          <header className="bg-card shadow-sm border-b border-border h-16 flex items-center justify-between px-6 lg:px-8 sticky top-0 z-20">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {menuItems.find(item => item.href === location.pathname)?.name || 'Dashboard'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Welcome back, {userData?.name}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Badge 
                variant="outline" 
                className={`${isAdmin ? 'text-purple-600 border-purple-200' : 'text-blue-600 border-blue-200'}`}
              >
                {isAdmin ? 'Admin' : 'Staff'}
              </Badge>
            </div>
          </header>

          {/* Page Content - Scrollable main content area */}
          <main className="flex-1 p-6 lg:p-8 overflow-y-auto overflow-x-visible bg-background">
            <div className="min-h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Layout;
