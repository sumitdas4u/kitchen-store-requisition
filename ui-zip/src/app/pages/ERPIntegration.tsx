import { useState } from 'react';
import { DesktopLayout } from '../components/DesktopLayout';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

export function ERPIntegration() {
  const [erpUrl, setErpUrl] = useState('https://erp.food-studio.in');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    // Mock API test
    setTimeout(() => {
      setTesting(false);
      setTestResult('success');
    }, 2000);
  };

  return (
    <DesktopLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">ERP Integration</h1>
          <p className="text-gray-600">Connect your ERPNext instance for seamless data synchronization</p>
        </div>

        {/* Configuration Form */}
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-6">
            <div>
              <label className="block text-sm text-gray-700 mb-2">ERP URL</label>
              <input
                type="url"
                value={erpUrl}
                onChange={(e) => setErpUrl(e.target.value)}
                placeholder="https://erp.yourcompany.com"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter the full URL of your ERPNext instance
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">API Secret</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter your API secret"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Test Result */}
            {testResult && (
              <div
                className={`p-4 rounded-lg flex items-center gap-3 ${
                  testResult === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {testResult === 'success' ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-green-900">Connection Successful</p>
                      <p className="text-sm text-green-700 mt-0.5">
                        Successfully connected to ERPNext
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-red-900">Connection Failed</p>
                      <p className="text-sm text-red-700 mt-0.5">
                        Unable to connect. Please check your credentials.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleTestConnection}
                disabled={testing || !erpUrl || !apiKey || !apiSecret}
                className="flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </button>
              
              <button
                onClick={() => alert('Settings saved successfully!')}
                disabled={!erpUrl || !apiKey || !apiSecret}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Settings
              </button>
            </div>
          </div>

          {/* Sync Settings */}
          <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-4 mt-6">
            <h3 className="text-lg text-gray-900">Sync Settings</h3>
            
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 text-primary" />
              <div>
                <p className="text-gray-900">Auto-sync Item Master</p>
                <p className="text-sm text-gray-500">Automatically sync items from ERPNext</p>
              </div>
            </label>
            
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer">
              <input type="checkbox" defaultChecked className="w-5 h-5 text-primary" />
              <div>
                <p className="text-gray-900">Sync Stock Levels</p>
                <p className="text-sm text-gray-500">Keep stock levels in sync with ERPNext</p>
              </div>
            </label>
            
            <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg cursor-pointer">
              <input type="checkbox" className="w-5 h-5 text-primary" />
              <div>
                <p className="text-gray-900">Create Material Requests</p>
                <p className="text-sm text-gray-500">Automatically create material requests in ERPNext</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </DesktopLayout>
  );
}
