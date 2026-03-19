import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Package } from 'lucide-react';

export function StoreLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login
    navigate('/store');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-2xl mb-4">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl text-gray-900 mb-2">Store Manager Login</h1>
          <p className="text-gray-600">Sign in to manage inventory</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div>
            <label className="block text-sm text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="store@restaurant.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
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
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              required
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent"
            />
            <label htmlFor="remember" className="ml-2 text-sm text-gray-700">
              Remember this device
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-accent text-white py-4 rounded-lg hover:bg-green-600 transition-colors active:scale-98"
          >
            Login
          </button>

          <div className="text-center pt-4">
            <button
              type="button"
              onClick={() => navigate('/kitchen/login')}
              className="text-sm text-gray-600 hover:text-accent"
            >
              Kitchen staff? Click here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
