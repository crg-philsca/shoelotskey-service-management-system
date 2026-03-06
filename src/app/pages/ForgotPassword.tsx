import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/app/components/ui/card';
import { toast } from 'sonner';
import { Mail, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const [debugToken, setDebugToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Password reset link sent!');
        setSubmitted(true);
        // FOR DEFENSE DEMO: Capture the token to show visually how it's handled
        if (data.debug_token) {
          setDebugToken(data.debug_token);
        }
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Email not found.');
      }
    } catch (err) {
      toast.error('Connection error. Is the backend running?');
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
              src="/login.png"
              alt="Shoelotskey logo"
              className="h-24 xs:h-28 sm:h-32 md:h-36 w-auto object-contain mx-auto transform -translate-x-0.5"
              loading="lazy"
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
                <br />
                {debugToken && (
                  <div className="mt-4 p-3 bg-gray-100 rounded border border-gray-300 text-xs text-left">
                    <p className="font-bold text-black mb-1">DEFENSE DEMO (Simulated Email Content):</p>
                    <p className="text-gray-600 break-all">Reset Link: http://localhost:5173/reset-password?token={debugToken}</p>
                    <button
                      onClick={() => navigate(`/reset-password?token=${debugToken}`)}
                      className="mt-2 w-full bg-blue-600 text-white rounded py-1 hover:bg-blue-700 cursor-pointer"
                    >
                      Click to "Open Email Link"
                    </button>
                  </div>
                )}
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
