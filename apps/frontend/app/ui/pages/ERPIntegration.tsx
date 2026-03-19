'use client';

import { useEffect, useState } from 'react';
import { DesktopLayout } from '../DesktopLayout';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';

type ErpCompany = { name: string; company_name?: string; country?: string };

export function ERPIntegration() {
  const token = useAuthGuard('/admin/login');
  const [erpUrl, setErpUrl] = useState('https://erp.food-studio.in');
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    const load = async () => {
      try {
        const [settings, companiesData] = await Promise.all([
          apiRequest<{ erp_base_url?: string }>(
            '/admin/settings',
            'GET',
            undefined,
            token ?? undefined
          ),
          apiRequest<ErpCompany[]>(
            '/admin/erp/companies',
            'GET',
            undefined,
            token ?? undefined
          )
        ]);
        if (settings?.erp_base_url) {
          setErpUrl(settings.erp_base_url);
        }
        setCompanies(companiesData);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    load();
  }, [token]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await apiRequest('/admin/settings/test', 'POST', {}, token ?? undefined);
      setTestResult('success');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <DesktopLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl text-gray-900 mb-2">ERP Integration</h1>
          <p className="text-gray-600">Configure ERPNext connection</p>
        </div>

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
                This should match your ERPNext base URL
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-2">Companies</label>
              <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                {companies.length > 0
                  ? `${companies.length} companies available from ERPNext`
                  : 'No companies loaded'}
              </div>
            </div>

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
                        ERPNext connection is healthy
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-red-900">Connection Failed</p>
                      <p className="text-sm text-red-700 mt-0.5">
                        Unable to connect. Check API credentials and URL.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleTestConnection}
                disabled={testing}
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
                onClick={async () => {
                  await apiRequest(
                    '/admin/settings',
                    'PUT',
                    {
                      erp_base_url: erpUrl
                    },
                    token ?? undefined
                  );
                }}
                disabled={!erpUrl}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Settings
              </button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600 mt-4">{error}</p> : null}
        </div>
      </div>
    </DesktopLayout>
  );
}
