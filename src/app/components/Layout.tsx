import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Calendar, Activity, Wrench, Users, LogOut, ChevronLeft, ChevronRight, Menu, Package } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '@/app/components/ui/sheet';
import { useState, useEffect } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  user: { username: string; email?: string; role: 'owner' | 'staff' };
  onLogout: () => void;
  headerAction?: React.ReactNode;
  headerActionLeft?: React.ReactNode;
}

export default function Layout({ children, user, onLogout, headerAction, headerActionLeft }: LayoutProps) {
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when location changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const ownerMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', shortLabel: 'Dashboard' },
    { path: '/job-order-form', icon: FileText, label: 'Job Order Form', shortLabel: 'Job Order' },
    { path: '/release-calendar', icon: Calendar, label: 'Release Calendar', shortLabel: 'Calendar' },
    { path: '/sales-report', icon: Activity, label: 'Sales Report', shortLabel: 'Sales' },
    { path: '/inventory', icon: Package, label: 'Inventory Management', shortLabel: 'Inventory' },
    { path: '/service-management', icon: Wrench, label: 'Service Management', shortLabel: 'Service' },
    { path: '/user-management', icon: Users, label: 'User Management', shortLabel: 'Users' },
  ];

  const staffMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', shortLabel: 'Dashboard' },
    { path: '/job-order-form', icon: FileText, label: 'Job Order Form', shortLabel: 'Job Order' },
    { path: '/release-calendar', icon: Calendar, label: 'Release Calendar', shortLabel: 'Calendar' },
    { path: '/inventory', icon: Package, label: 'Inventory Management', shortLabel: 'Inventory' },
  ];

  const pageTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/job-order-form': 'Job Order Form',
    '/release-calendar': 'Release Calendar',
    '/sales-report': 'Sales Report',
    '/service-management': 'Service Management',
    '/user-management': 'User Management',
    '/total-sales': 'Total Sales',
    '/total-orders': 'Total Orders',
    '/expenses': 'Expenses',
    '/claim-record': 'CLAIM RECORD',
    '/activity-history': 'Activity History',
    '/inventory': 'Inventory Management',
  };

  const menuItems = user.role === 'owner' ? ownerMenuItems : staffMenuItems;

  const SidebarContent = ({ collapsed }: { collapsed: boolean }) => (
    <>
      <div className="px-2 h-16 shrink-0 border-b border-red-500 flex items-center">
        <div className={collapsed ? 'flex justify-center w-full' : 'flex items-center gap-10 pl-4'}>
          <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
            <img
              src="/logo.png"
              alt="Shoelotskey logo"
              className="h-10 w-10 object-contain"
              fetchPriority="high"
              loading="eager"
              decoding="async"
            />
          </div>
          {!collapsed && (
            <div className="text-center space-y-1">
              <h1 className="text-base font-bold leading-tight">Shoelotskey</h1>
              <p className="text-xs text-red-200">{user.role === 'owner' ? 'Owner' : 'Staff'}</p>
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 ${collapsed ? 'flex flex-col items-center mt-6' : 'px-3 py-4'}`}>
        <nav className={`${collapsed ? 'flex flex-col items-center gap-1' : 'space-y-1'}`}>
          <TooltipProvider>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <Tooltip key={item.path} delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.path}
                      className={`flex ${collapsed ? 'flex-col items-center justify-center gap-1 h-auto p-2 w-full' : 'flex-row items-center gap-3 px-4 py-3 w-full'} rounded-lg transition-colors ${isActive
                        ? 'bg-red-800 text-white'
                        : 'text-red-100 hover:bg-red-600 hover:text-white'
                        }`}
                    >
                      <Icon size={20} />
                      {collapsed ? (
                        <span className="text-[10px] leading-tight text-center w-14 break-words font-bold">{(item as any).shortLabel || item.label}</span>
                      ) : (
                        <span className="text-sm font-bold">{item.label}</span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right" className="bg-red-700 text-white border border-red-600">
                      {item.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </nav>
      </div>

      <div className={`border-t border-red-500 ${collapsed ? 'flex flex-col items-center gap-2 py-4' : 'p-4 space-y-2'}`}>
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onLogout}
                className={`${collapsed ? 'flex flex-col items-center justify-center gap-1 h-auto p-2 w-full' : 'flex flex-row items-center gap-3 px-4 py-3 w-full'} rounded-lg bg-transparent text-red-100 hover:bg-red-600 hover:text-white transition-colors`}
              >
                <LogOut size={20} />
                {collapsed ? (
                  <span className="text-[10px] leading-tight text-center w-full break-normal font-bold">Logout</span>
                ) : (
                  <span className="text-sm font-bold">Logout</span>
                )}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right" className="bg-red-700 text-white border border-red-600">
                Logout
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </>
  );

  return (
    <div className={`flex h-screen bg-gray-50 ${isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
      {/* Desktop Sidebar */}
      <div className={`${isCollapsed ? 'w-20' : 'w-64'} bg-red-700 text-white hidden lg:flex flex-col transition-all duration-300 relative`}>
        <SidebarContent collapsed={isCollapsed} />

        {/* Collapse/Expand Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`absolute right-0 ${isCollapsed ? 'top-[47%]' : 'top-[51%]'} -translate-y-1/2 translate-x-1/2 bg-red-800 hover:bg-red-600 text-white rounded-full transition-all duration-300 z-10 shadow-lg border-2 border-white ${isCollapsed ? 'p-1' : 'p-2'}`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <header className="bg-white border-b border-gray-200 px-4 lg:px-8 h-16 shrink-0 flex items-center relative overflow-visible">
          {/* Mobile Menu Toggle */}
          <div className="lg:hidden mr-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-red-700 hover:bg-red-50">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 bg-red-700 border-red-800 w-64">
                <div className="h-full flex flex-col text-white">
                  <SidebarContent collapsed={false} />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center flex-grow min-w-0">
            {headerActionLeft && (
              <div className="flex items-center mr-4" style={{ zIndex: 20 }}>
                {headerActionLeft}
              </div>
            )}
            <h2 className="text-lg lg:text-2xl font-bold text-red-600 uppercase truncate">
              {pageTitles[location.pathname] || 'Dashboard'}
            </h2>
          </div>

          {headerAction && (
            <div className="ml-4 flex-shrink-0">
              {headerAction}
            </div>
          )}
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-3 px-4 lg:px-8 pb-8">
          {children}
        </main>
      </div>

    </div>
  );
}
