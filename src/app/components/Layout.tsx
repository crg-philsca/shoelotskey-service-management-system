import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Calendar, Activity, Wrench, Users, LogOut, ChevronLeft, ChevronRight, Settings, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip';
import { useState, useEffect } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  user: { username: string; email?: string; role: 'owner' | 'staff' };
  onLogout: () => void;
  onUpdateUser?: (username: string, email: string) => void;
  headerAction?: React.ReactNode;
  headerActionLeft?: React.ReactNode;
}

export default function Layout({ children, user, onLogout, onUpdateUser, headerAction, headerActionLeft }: LayoutProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState(user?.username || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Update local state when user prop changes
  useEffect(() => {
    if (user) {
      setProfileUsername(user.username);
      setProfileEmail(user.email || '');
    }
  }, [user]);

  const ownerMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', shortLabel: 'Dashboard' },
    { path: '/service-intake', icon: FileText, label: 'Service Intake', shortLabel: 'Intake' },
    { path: '/calendar', icon: Calendar, label: 'Release Calendar', shortLabel: 'Calendar' },
    { path: '/reports', icon: Activity, label: 'Sales Report', shortLabel: 'Sales' },
    { path: '/service-management', icon: Wrench, label: 'Service Management', shortLabel: 'Service' },
    { path: '/user-management', icon: Users, label: 'User Management', shortLabel: 'Users' },
  ];

  const staffMenuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', shortLabel: 'Dashboard' },
    { path: '/service-intake', icon: FileText, label: 'Service Intake', shortLabel: 'Intake' },
    { path: '/calendar', icon: Calendar, label: 'Release Calendar', shortLabel: 'Calendar' },
  ];

  // Page title mappings (including non-menu pages)
  const pageTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/service-intake': 'Service Intake',
    '/calendar': 'Release Calendar',
    '/reports': 'Sales Report',
    '/service-management': 'Service Management',
    '/user-management': 'User Management',
    '/total-sales': 'Total Sales',
    '/total-orders': 'Total Orders',
    '/expenses': 'Expenses',
    '/claim-monitoring': 'Claim Monitoring',
    '/activity-history': 'Activity History',
  };

  const menuItems = user.role === 'owner' ? ownerMenuItems : staffMenuItems;

  return (
    <div className={`flex h-screen bg-gray-50 ${isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
      {/* Sidebar */}
      <div className={`${isCollapsed ? 'w-20' : 'w-64'} bg-red-700 text-white flex flex-col transition-all duration-300 relative`}>
        <div className="px-2 py-2 border-b border-red-500 flex items-center">
          <div className={isCollapsed ? 'flex justify-center w-full' : 'flex items-center gap-10 pl-4'}>
            <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              <img
                src="/logo2.png"
                alt="Shoelotskey logo"
                className="h-10 w-10 object-contain"
              />
            </div>
            {!isCollapsed && (
              <div className="text-center space-y-1">
                <h1 className="text-base font-bold leading-tight">Shoelotskey</h1>
                <p className="text-xs text-red-200">{user.role === 'owner' ? 'Owner' : 'Staff'}</p>
              </div>
            )}
          </div>
        </div>

        <div className={`flex-1 ${isCollapsed ? 'flex flex-col items-center mt-6' : 'px-3 py-4'}`}>
          <nav className={`${isCollapsed ? 'flex flex-col items-center gap-1' : 'space-y-1'}`}>
            <TooltipProvider>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Tooltip key={item.path} delayDuration={300}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.path}
                        className={`flex ${isCollapsed ? 'flex-col items-center justify-center gap-1 h-auto p-2 w-full' : 'flex-row items-center gap-3 px-4 py-3 w-full'} rounded-lg transition-colors ${isActive
                          ? 'bg-red-800 text-white'
                          : 'text-red-100 hover:bg-red-600 hover:text-white'
                          }`}
                      >
                        <Icon size={20} />
                        {isCollapsed ? (
                          <span className="text-[10px] leading-tight text-center w-14 break-words font-bold">{(item as any).shortLabel || item.label}</span>
                        ) : (
                          <span className="text-sm font-bold">{item.label}</span>
                        )}
                      </Link>
                    </TooltipTrigger>
                    {isCollapsed && (
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

        <div className={`border-t border-red-500 ${isCollapsed ? 'flex flex-col items-center gap-2 py-4' : 'p-4 space-y-2'}`}>
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(true)}
                  className={`${isCollapsed ? 'flex flex-col items-center justify-center gap-1 h-auto p-2 w-full' : 'flex flex-row items-center gap-3 px-4 py-3 w-full'} rounded-lg bg-transparent text-red-100 hover:bg-red-600 hover:text-white transition-colors`}
                >
                  <Settings size={20} />
                  {isCollapsed ? (
                    <span className="text-[10px] leading-tight text-center w-full break-normal font-bold">Profile</span>
                  ) : (
                    <span className="text-sm font-bold">Profile Settings</span>
                  )}
                </button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" className="bg-red-700 text-white border border-red-600">
                  Profile Settings
                </TooltipContent>
              )}
            </Tooltip>

            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onLogout}
                  className={`${isCollapsed ? 'flex flex-col items-center justify-center gap-1 h-auto p-2 w-full' : 'flex flex-row items-center gap-3 px-4 py-3 w-full'} rounded-lg bg-transparent text-red-100 hover:bg-red-600 hover:text-white transition-colors`}
                >
                  <LogOut size={20} />
                  {isCollapsed ? (
                    <span className="text-[10px] leading-tight text-center w-full break-normal font-bold">Logout</span>
                  ) : (
                    <span className="text-sm font-bold">Logout</span>
                  )}
                </button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" className="bg-red-700 text-white border border-red-600">
                  Logout
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Collapse/Expand Button - Positioned on right edge */}
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
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center relative overflow-visible">
          {headerActionLeft && <div className="absolute left-8 flex items-center" style={{ zIndex: 20 }}>{headerActionLeft}</div>}
          <h2 className="text-2xl font-bold text-red-600 uppercase flex-grow text-left">
            {pageTitles[location.pathname] || 'Dashboard'}
          </h2>
          {headerAction && <div className="absolute right-8">{headerAction}</div>}
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-3 px-8 pb-8">
          {children}
        </main>
      </div>

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="profile-username">Username</Label>
              <Input
                id="profile-username"
                value={profileUsername}
                onChange={(e) => setProfileUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-password">Password</Label>
              <div className="relative">
                <Input
                  id="profile-password"
                  type={showPassword ? "text" : "password"}
                  value={profilePassword}
                  onChange={(e) => setProfilePassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setIsProfileOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 font-bold" onClick={() => {
              if (onUpdateUser) {
                onUpdateUser(profileUsername, profileEmail);
              }
              toast.success('Profile updated successfully');
              setIsProfileOpen(false);
            }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
