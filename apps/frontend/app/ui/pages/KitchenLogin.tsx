'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { saveSession } from '../../../lib/session';

export function KitchenLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{
        access_token: string;
        role: string;
        default_warehouse?: string | null;
        source_warehouse?: string | null;
      }>('/auth/login', 'POST', { username: email, password });
      saveSession({
        token: data.access_token,
        role: data.role,
        default_warehouse: data.default_warehouse ?? null,
        source_warehouse: data.source_warehouse ?? null
      });
      router.push('/kitchen');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl text-gray-900 mb-2">Kitchen Login</h1>
          <p className="text-gray-600">Sign in to manage your requisitions</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div>
            <label className="block text-sm text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kitchen@restaurant.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label htmlFor="remember" className="ml-2 text-sm text-gray-700">
              Remember this device
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-white py-4 rounded-lg hover:bg-orange-600 transition-colors active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => router.push('/store/login')}
              className="text-sm text-gray-600 hover:text-primary"
            >
              Store Manager? Click here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
