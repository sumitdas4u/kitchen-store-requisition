'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';

interface VendorRequestSource {
  warehouse: string;
  remainingQty: number;
}

interface VendorSummaryItem {
  itemCode: string;
  name: string;
  unit: string;
  totalRequestedQty: number;
  stockQty: number;
  shortfallQty: number;
  requestSources: VendorRequestSource[];
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Mono:wght@500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --or:#F97316;--orl:#FFF7ED;--dk:#111827;--md:#6B7280;--lt:#9CA3AF;
  --bg:#F3F4F6;--wh:#fff;
  --gn:#16A34A;--gnbg:#F0FDF4;--gnbr:#BBF7D0;
  --rd:#DC2626;--rdbg:#FEF2F2;
  --am:#D97706;--ambg:#FFFBEB;
  --bl:#1D4ED8;--blbg:#EFF6FF;--blbr:#BFDBFE;
  --ln:#E5E7EB;--lnlt:#F3F4F6;
}
body{font-family:'Nunito',sans-serif;background:var(--bg);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}

.spage{max-width:480px;margin:0 auto;min-height:100vh;background:var(--bg);padding-bottom:72px}

/* Header */
.shdr{background:var(--dk);position:sticky;top:0;z-index:60}
.shdr-top{padding:14px 16px 0;display:flex;align-items:flex-start;justify-content:space-between}
.shdr-greeting{font-size:11px;font-weight:700;color:#6B7280}
.shdr-title{font-size:20px;font-weight:900;color:#fff;margin-top:2px}
.shdr-date{font-size:11px;color:#6B7280;font-weight:700;text-align:right}
.shdr-time{font-size:14px;font-weight:800;color:#fff;text-align:right;margin-top:2px;font-family:'DM Mono',monospace}

.sstatbar{display:flex;padding:10px 0 12px;border-top:1px solid rgba(255,255,255,.07);margin-top:10px}
.ssb{flex:1;text-align:center;position:relative}
.ssb+.ssb::before{content:'';position:absolute;left:0;top:15%;bottom:15%;width:1px;background:rgba(255,255,255,.1)}
.ssbn{font-family:'DM Mono',monospace;font-size:18px;font-weight:700;display:block;line-height:1}
.ssbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;display:block;margin-top:3px}
.ssb.r .ssbn{color:#F87171}
.ssb.o .ssbn{color:#FB923C}
.ssb.g .ssbn{color:#4ADE80}
.ssb.w .ssbn{color:#fff}

/* Body */
.sbody{padding:14px 12px}
.sec-title{font-size:10px;font-weight:800;color:var(--lt);text-transform:uppercase;letter-spacing:.07em;padding:12px 2px 8px}
.sec-title:first-child{padding-top:0}

/* Action grid */
.action-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px}
.action-card{background:var(--wh);border-radius:16px;padding:16px 14px;cursor:pointer;
  box-shadow:0 1px 4px rgba(0,0,0,.07);border:1.5px solid var(--ln);
  -webkit-tap-highlight-color:transparent;user-select:none}
.action-card:active{transform:scale(.97);box-shadow:0 0 0 rgba(0,0,0,0)}
.action-card.wide{grid-column:1/-1}
.ac-icon{font-size:28px;margin-bottom:8px;display:block}
.ac-label{font-size:13px;font-weight:900;color:var(--dk);display:block}
.ac-sub{font-size:11px;font-weight:700;color:var(--lt);margin-top:3px;display:block}
.ac-badge{display:inline-block;margin-top:7px;padding:3px 10px;border-radius:20px;
  font-size:11px;font-weight:800;font-family:'DM Mono',monospace}
.ac-badge.red{background:var(--rdbg);color:var(--rd)}
.ac-badge.orange{background:var(--orl);color:var(--or)}
.ac-badge.green{background:var(--gnbg);color:var(--gn)}
.ac-badge.blue{background:var(--blbg);color:var(--bl)}

/* Pending transfer cards */
.tr-card{background:var(--wh);border-radius:14px;overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:10px;cursor:pointer;
  -webkit-tap-highlight-color:transparent}
.tr-card:active{opacity:.88}
.tr-hdr{padding:10px 14px;color:#fff;display:flex;align-items:center;gap:10px}
.tr-hdr-dot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.4);flex-shrink:0}
.tr-hdr-name{flex:1;font-size:13px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tr-hdr-id{font-size:11px;font-weight:700;opacity:.75;font-family:'DM Mono',monospace;flex-shrink:0}
.tr-body{padding:9px 14px 12px;display:flex;align-items:center;justify-content:space-between}
.tr-meta{font-size:12px;font-weight:800;color:var(--md)}
.tr-meta-sub{font-size:10px;font-weight:700;color:var(--lt);margin-top:2px}
.tr-items-pill{background:var(--orl);color:var(--or);font-size:11px;font-weight:800;
  padding:4px 10px;border-radius:20px;font-family:'DM Mono',monospace;flex-shrink:0}
.tr-issue-btn{display:block;margin:0 12px 12px;padding:10px;background:var(--or);color:#fff;border:none;
  border-radius:10px;width:calc(100% - 24px);font-family:'Nunito',sans-serif;font-size:13px;
  font-weight:900;cursor:pointer;text-align:center}
.tr-issue-btn:active{background:#EA6C04}

/* View all button */
.view-all-btn{width:100%;padding:12px;background:var(--wh);color:var(--or);
  border:1.5px solid var(--ln);border-radius:12px;font-family:'Nunito',sans-serif;
  font-size:13px;font-weight:800;cursor:pointer;margin-bottom:8px}
.view-all-btn:active{background:var(--orl)}

/* Bottom nav */
.bnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;background:var(--wh);border-top:2px solid var(--ln);
  display:flex;z-index:60}
.bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;padding:9px 4px 12px;
  cursor:pointer;border:none;background:none;-webkit-tap-highlight-color:transparent}
.bnav-icon{font-size:20px;line-height:1}
.bnav-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;
  margin-top:3px;color:var(--lt)}
.bnav-item.active .bnav-label{color:var(--or)}

/* Empty state */
.empty-state{text-align:center;padding:40px 20px;color:var(--lt)}
.empty-icon{font-size:44px;margin-bottom:12px}
.empty-text{font-size:14px;font-weight:800;color:var(--lt)}
.empty-sub{font-size:12px;font-weight:700;color:var(--lt);margin-top:6px;opacity:.7}

@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fade{animation:fadeUp .2s ease both}
`;

const COLORS = ['#16A34A','#F97316','#EF4444','#0EA5E9','#8B5CF6','#1D4ED8','#DB2777','#0891B2'];
const getColor = (s: string) => COLORS[Math.abs((s||'').split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % COLORS.length];
const fmt = (d: string) => { try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short' }); } catch { return d; } };
const nowTime = () => new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12: true });
const nowDate = () => new Date().toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short' });

const mapVendorSummaryItem = (item: any): VendorSummaryItem => ({
  itemCode: String(item.item_code || ''),
  name: String(item.item_name || item.item_code || ''),
  unit: String(item.uom || ''),
  totalRequestedQty: Number(item.total_requested_qty || item.needed_qty || 0),
  stockQty: Number(item.stock_qty || 0),
  shortfallQty: Number(item.shortfall_qty || item.shortfall || 0),
  requestSources: (item.request_sources || []).map((source: any) => ({
    warehouse: String(source.warehouse || ''),
    remainingQty: Number(source.remaining_qty || 0),
  })),
});

const summarizeSources = (sources: VendorRequestSource[]) => {
  const grouped = new Map<string, number>();
  sources.forEach(source => {
    const key = source.warehouse || 'Unknown';
    grouped.set(key, Number(grouped.get(key) || 0) + Number(source.remainingQty || 0));
  });
  return Array.from(grouped.entries())
    .map(([warehouse, qty]) => ({ warehouse, qty }))
    .sort((a, b) => a.warehouse.localeCompare(b.warehouse));
};

function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const items = [
    { icon: '🏠', label: 'Home',      path: '/store' },
    { icon: '📦', label: 'Transfers', path: '/store/transfers' },
    { icon: '🛒', label: 'Orders',    path: '/store/vendor-orders' },
    { icon: '📋', label: 'Receipts',  path: '/store/purchase-receipts' },
  ];
  return (
    <nav className="bnav">
      {items.map(item => (
        <button key={item.path} className={`bnav-item ${pathname === item.path ? 'active' : ''}`}
          onClick={() => router.push(item.path)}>
          <span className="bnav-icon">{item.icon}</span>
          <span className="bnav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function StoreDashboard() {
  const router         = useRouter();
  const token          = useAuthGuard('/store/login');
  const [reqs,   setReqs  ] = useState<any[]>([]);
  const [vendorItems, setVendorItems] = useState<VendorSummaryItem[]>([]);
  const [showShortageOnly, setShowShortageOnly] = useState(false);
  const [time,   setTime  ] = useState(nowTime());
  const [loading,setLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTime(nowTime()), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      apiRequest<any[]>('/store/requisitions', 'GET', undefined, token),
      apiRequest<any[]>('/store/vendor-order/shortage', 'GET', undefined, token),
    ])
      .then(([requisitions, shortage]) => {
        setReqs(requisitions || []);
        setVendorItems((shortage || []).map(mapVendorSummaryItem));
        setLoading(false);
      })
      .catch(() => {
        setReqs([]);
        setVendorItems([]);
        setLoading(false);
      });
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (!token) return null;

  // Status values are Title Case: 'Submitted', 'Partially Issued', 'Issued', 'Completed'
  const pending    = reqs.filter(r => r.status === 'Submitted' || r.status === 'Partially Issued');
  const totalItems = reqs.reduce((s, r) => s + (r.items?.length ?? 0), 0);
  const visibleVendorItems = showShortageOnly
    ? vendorItems.filter(item => item.shortfallQty > 0)
    : vendorItems;
  const vendorWarehouseCount = new Set(
    visibleVendorItems.flatMap(item => summarizeSources(item.requestSources).map(source => source.warehouse))
  ).size;

  return (
    <div className="spage">
      <style>{CSS}</style>

      {/* Header */}
      <div className="shdr">
        <div className="shdr-top">
          <div>
            <div className="shdr-greeting">Welcome back 👋</div>
            <div className="shdr-title">Food Store</div>
          </div>
          <div>
            <div className="shdr-date">{nowDate()}</div>
            <div className="shdr-time">{time}</div>
          </div>
        </div>
        <div className="sstatbar">
          <div className="ssb r"><span className="ssbn">{pending.length}</span><span className="ssbl">Pending</span></div>
          <div className="ssb o"><span className="ssbn">{reqs.length}</span><span className="ssbl">Requests</span></div>
          <div className="ssb g"><span className="ssbn">{totalItems}</span><span className="ssbl">Items</span></div>
          <div className="ssb w"><span className="ssbn">{loading ? '…' : '✓'}</span><span className="ssbl">Status</span></div>
        </div>
      </div>

      <div className="sbody">
        {/* Quick Actions */}
        <div className="sec-title">Quick Actions</div>
        <div className="action-grid">
          <div className="action-card" onClick={() => router.push('/store/transfers')}>
            <span className="ac-icon">📦</span>
            <span className="ac-label">Transfers</span>
            <span className="ac-sub">Kitchen requests</span>
            {pending.length > 0
              ? <span className="ac-badge red">{pending.length} pending</span>
              : <span className="ac-badge green">All clear</span>}
          </div>
          <div className="action-card" onClick={() => router.push('/store/vendor-orders')}>
            <span className="ac-icon">🛒</span>
            <span className="ac-label">Vendor Orders</span>
            <span className="ac-sub">Purchase from vendors</span>
            <span className="ac-badge orange">New order</span>
          </div>
          <div className="action-card" onClick={() => router.push('/store/purchase-receipts')}>
            <span className="ac-icon">📋</span>
            <span className="ac-label">Purchase Receipts</span>
            <span className="ac-sub">Receive vendor delivery</span>
            <span className="ac-badge blue">Confirm</span>
          </div>
          <div className="action-card" onClick={() => router.push('/store/transfer/new')}>
            <span className="ac-icon">🚚</span>
            <span className="ac-label">Send Material</span>
            <span className="ac-sub">Push stock to kitchen</span>
            <span className="ac-badge orange">+ New</span>
          </div>
        </div>

        <div className="sec-title">Vendor Order Summary</div>
        <div
          className="fade"
          style={{
            background: 'var(--wh)',
            borderRadius: 16,
            padding: 14,
            boxShadow: '0 1px 4px rgba(0,0,0,.07)',
            border: '1.5px solid var(--ln)',
            marginBottom: 12,
          }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--dk)' }}>
                {visibleVendorItems.length} {showShortageOnly ? 'shortage' : 'aggregated'} items
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lt)', marginTop: 2 }}>
                {vendorWarehouseCount} warehouses contributing to vendor demand
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => setShowShortageOnly(current => !current)}
                style={{
                  border: `1.5px solid ${showShortageOnly ? 'var(--rd)' : 'var(--ln)'}`,
                  borderRadius: 999,
                  background: showShortageOnly ? 'var(--rdbg)' : '#fff',
                  color: showShortageOnly ? 'var(--rd)' : 'var(--md)',
                  padding: '8px 10px',
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                {showShortageOnly ? 'Shortage only' : 'All requests'}
              </button>
              <button
                onClick={() => router.push('/store/vendor-orders')}
                style={{
                  border: 'none',
                  borderRadius: 10,
                  background: 'var(--or)',
                  color: '#fff',
                  padding: '10px 12px',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}>
                Create Order
              </button>
            </div>
          </div>

          {visibleVendorItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visibleVendorItems.slice(0, 5).map(item => (
                <div
                  key={item.itemCode}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    background: '#F8FAFC',
                    border: '1px solid var(--ln)',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--dk)' }}>
                    {item.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <span className="ac-badge orange" style={{ marginTop: 0 }}>Req {item.totalRequestedQty} {item.unit}</span>
                    <span className="ac-badge blue" style={{ marginTop: 0 }}>Stock {item.stockQty} {item.unit}</span>
                    <span className="ac-badge red" style={{ marginTop: 0 }}>Short {item.shortfallQty} {item.unit}</span>
                  </div>
                  {item.requestSources.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {summarizeSources(item.requestSources).map(source => (
                        <span
                          key={`${item.itemCode}-${source.warehouse}`}
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: '#fff',
                            color: '#475569',
                            border: '1px solid var(--ln)',
                          }}>
                          {source.warehouse}: {source.qty} {item.unit}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '18px 12px', color: 'var(--lt)' }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                {showShortageOnly ? 'No shortage items right now' : 'No vendor-order items waiting'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                {showShortageOnly ? 'Turn off the filter to see all requested items' : 'Warehouse request totals will appear here'}
              </div>
            </div>
          )}
        </div>

        {/* Pending Transfers */}
        {pending.length > 0 && (
          <>
            <div className="sec-title">Needs Your Action — {pending.length} Pending</div>
            {pending.slice(0, 4).map((req, i) => (
              <div key={req.id} className="tr-card fade" onClick={() => router.push(`/store/issue/${req.id}`)}>
                <div className="tr-hdr" style={{ background: getColor(req.warehouse || String(req.id)) }}>
                  <div className="tr-hdr-dot"/>
                  <div className="tr-hdr-name">{req.warehouse}</div>
                  <div className="tr-hdr-id">TR-{req.id}</div>
                </div>
                <div className="tr-body">
                  <div>
                    <div className="tr-meta">{req.shift || 'All day'}</div>
                    <div className="tr-meta-sub">{fmt(req.requested_date || req.created_at || '')}</div>
                  </div>
                  <div className="tr-items-pill">{req.items?.length ?? 0} items</div>
                </div>
                <button className="tr-issue-btn" onClick={e => { e.stopPropagation(); router.push(`/store/issue/${req.id}`); }}>
                  Issue Items →
                </button>
              </div>
            ))}
            {pending.length > 4 && (
              <button className="view-all-btn" onClick={() => router.push('/store/transfers')}>
                View all {pending.length} pending transfers →
              </button>
            )}
          </>
        )}

        {!loading && pending.length === 0 && (
          <div className="empty-state fade">
            <div className="empty-icon">✅</div>
            <div className="empty-text">All clear — no pending transfers</div>
            <div className="empty-sub">Kitchen requests will appear here</div>
          </div>
        )}
      </div>

      <BottomNav/>
    </div>
  );
}
