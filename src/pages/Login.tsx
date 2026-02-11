import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessSettings } from '@/components/BusinessSettingsProvider';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Scissors, Crown, UserPlus } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const { user, login, createAdminUser } = useAuth();
  const { settings: businessSettings } = useBusinessSettings();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (userType: 'admin' | 'staff') => {
    if (userType === 'admin') {
      setEmail('swetha@gmail.com');
      setPassword('swetha@gmail.com');
    } else {
      setEmail('staf@gmail.com');
      setPassword('staf@gmail.com');
    }
  };

  const handleCreateAdmin = async () => {
    setCreatingAdmin(true);
    try {
      await createAdminUser();
    } catch (error) {
      console.error('Error creating admin:', error);
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="absolute inset-0 bg-black/20"></div>
      <Card className="w-full max-w-md relative z-10 bg-white dark:bg-gray-900/95 backdrop-blur-sm border-0 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center items-center space-x-3">
            <Crown className="h-8 w-8 text-purple-600" />
            <Scissors className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {businessSettings?.businessName || 'Business Management'}
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Premium Business Management System
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="transition-all duration-200 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="transition-all duration-200 focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition-all duration-300"
              disabled={loading}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>
          
          <div className="space-y-3">
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">Quick Login</div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => handleQuickLogin('admin')}
                className="border-purple-200 text-purple-600 hover:bg-purple-50 transition-all duration-200"
              >
                Admin
              </Button>
              <Button
                variant="outline"
                onClick={() => handleQuickLogin('staff')}
                className="border-blue-200 text-blue-600 hover:bg-blue-50 transition-all duration-200"
              >
                Staff
              </Button>
            </div>
          </div>

          <div className="border-t pt-4">
            <Button
              onClick={handleCreateAdmin}
              variant="outline"
              className="w-full border-orange-200 text-orange-600 hover:bg-orange-50 transition-all duration-200"
              disabled={creatingAdmin}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {creatingAdmin ? 'Creating Admin...' : 'Create Admin User'}
            </Button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Click this if admin login fails
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
