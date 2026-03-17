import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/app/components/ui/card';
import { toast } from 'sonner';
import { Mail, CheckCircle } from 'lucide-react';

const API_BASE = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? `http://${window.location.hostname}:8000/api`
  : '/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const result = await response.json();
      
      if (response.ok) {
        toast.success(result.message || 'Password reset link sent!');
        setSubmitted(true);
        // Professional log for defense:
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.info("%c[DEFENSE MODE] Password reset link sent to your system console.", "color: #e11d48; font-weight: bold;");
        }
      } else {
        toast.error(result.detail || 'Email not found.');
      }
    } catch (err) {
      toast.error('Service Unreachable: The system server is currently offline.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-r from-red-200 via-white to-red-200 overflow-y-auto">
      <div className="flex flex-col flex-grow items-center justify-center w-full py-8 px-2 sm:px-4 md:px-6 mt-10">
        <Card className="w-full max-w-xs sm:max-w-sm md:max-w-md shadow-2xl mx-auto">
          <CardHeader className="space-y-0 text-center pb-0 mb-0" style={{ marginBottom: '-4px', paddingBottom: 0 }}>
            <img
              src="/logo.png"
              alt="Shoelotskey logo"
              className="h-24 xs:h-28 sm:h-32 md:h-36 w-auto object-contain mx-auto transform -translate-x-0.5"
              fetchPriority="high"
              loading="eager"
              decoding="async"
            />
            <CardDescription className="text-base xs:text-lg md:text-xl font-semibold text-black">
              FORGOT PASSWORD
            </CardDescription>
          </CardHeader>
          {submitted && (
            <div className="flex justify-center py-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
          )}
          <CardContent>
            {submitted ? (
              <div className="text-center text-green-700 font-medium my-0" style={{ marginTop: '-4px', marginBottom: 0 }}>
                Check your email for a password reset link.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-0">
                <div className="mb-3">
                  <Label htmlFor="email" className="block mb-1">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-white border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 cursor-pointer text-base mt-2">
                  {loading ? 'Sending...' : 'Send'}
                </Button>
              </form>
            )}
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                className="text-sm text-black hover:text-red-600 hover:underline transition-colors font-normal cursor-pointer"
                onClick={() => navigate('/')}
              >
                Back to Login
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex-shrink-0">
        <p className="text-xs text-gray-700 text-center py-4">© 2026 Shoelotskey Villamor-Pasay • Developed by AGS AviaTech</p>
      </div>
    </div>
  );
}
