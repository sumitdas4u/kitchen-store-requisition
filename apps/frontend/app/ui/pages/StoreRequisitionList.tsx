'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Mono:wght@500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --or:#F97316;--orl:#FFF7ED;--dk:#111827;--md:#6B7280;--lt:#9CA3AF;
  --bg:#F3F4F6;--wh:#fff;
  --gn:#16A34A;--gnbg:#F0FDF4;--gnbr:#BBF7D0;
  --rd:#DC2626;--rdbg:#FEF2F2;
  --am:#D97706;--ambg:#FFFBEB;
  --bl:#1D4ED8;--blbg:#EFF6FF;
  --ln:#E5E7EB;--lnlt:#F3F4F6;
}
body{font-family:'Nunito',sans-serif;background:var(--bg);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}

.tpage{max-width:480px;margin:0 auto;min-height:100vh;background:var(--bg);padding-bottom:72px}

/* Header */
.thdr{background:var(--dk);position:sticky;top:0;z-index:60;padding:14px 16px 14px}
.thdr-row{display:flex;align-items:center;gap:10px}
.thdr-back{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.1);border:none;
  color:#fff;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.thdr-back:active{background:rgba(255,255,255,.2)}
.thdr-info{flex:1;min-width:0}
.thdr-title{font-size:17px;font-weight:900;color:#fff}
.thdr-sub{font-size:11px;color:#6B7280;font-weight:700;margin-top:2px}
.thdr-new{padding:7px 13px;background:var(--or);color:#fff;border:none;border-radius:20px;
  font-family:'Nunito',sans-serif;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;flex-shrink:0}
.thdr-new:active{background:#EA6C04}
.thdr-refresh{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.1);border:none;
  color:#D1FAE5;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}

/* Tabs */
.ttabs{background:var(--wh);display:flex;border-bottom:2px solid var(--ln);position:sticky;top:62px;z-index:50}
.ttab{flex:1;padding:11px 6px;text-align:center;border:none;background:none;
  font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:var(--lt);
  cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px}
.ttab.on{color:var(--dk);border-bottom-color:var(--dk)}
.ttabcnt{display:inline-block;background:var(--or);color:#fff;font-size:9px;font-weight:800;
  padding:1px 5px;border-radius:10px;margin-left:4px;font-family:'DM Mono',monospace}
.ttabcnt.muted{background:var(--ln);color:var(--md)}
.ttabcnt.green{background:var(--gn)}

/* Body */
.tbody{padding:12px 12px 24px}

/* Transfer card */
.tr-card{background:var(--wh);border-radius:14px;overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:12px}
.tr-hdr{padding:11px 14px;color:#fff;display:flex;align-items:center;gap:10px}
.tr-hdr-dot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.4);flex-shrink:0}
.tr-hdr-name{flex:1;font-size:13px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tr-hdr-id{font-size:11px;font-weight:700;opacity:.8;font-family:'DM Mono',monospace;flex-shrink:0}
.tr-hdr-badge{background:rgba(255,255,255,.2);padding:2px 9px;border-radius:20px;font-size:10px;font-weight:800;flex-shrink:0}

.tr-body{padding:10px 14px 4px}
.tr-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.tr-label{font-size:12px;font-weight:700;color:var(--md)}
.tr-value{font-size:12px;font-weight:800;color:var(--dk);font-family:'DM Mono',monospace}
.tr-value.orange{color:var(--or)}
.tr-value.green{color:var(--gn)}
.tr-value.blue{color:var(--bl)}

.tr-items-preview{padding:4px 14px 10px;display:flex;flex-wrap:wrap;gap:5px}
.tr-item-chip{font-size:10px;font-weight:800;padding:3px 8px;background:var(--lnlt);
  color:var(--md);border-radius:6px;white-space:nowrap}

.tr-actions{padding:0 12px 12px;display:flex;gap:8px}
.tr-issue-btn{flex:1;padding:11px;background:var(--or);color:#fff;border:none;
  border-radius:11px;font-family:'Nunito',sans-serif;font-size:13px;font-weight:900;cursor:pointer}
.tr-issue-btn:active{background:#EA6C04}
.tr-issue-btn.done{background:var(--gn)}
.tr-issue-btn.grey{background:var(--md)}

/* Status badge */
.status-pill{font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px;white-space:nowrap}
.status-pill.submitted{background:var(--orl);color:var(--or)}
.status-pill.partial{background:var(--ambg);color:var(--am)}
.status-pill.issued{background:var(--gnbg);color:var(--gn)}
.status-pill.completed{background:var(--blbg);color:var(--bl)}

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
.empty-state{text-align:center;padding:48px 20px;color:var(--lt)}
.empty-icon{font-size:44px;margin-bottom:12px}
.empty-text{font-size:14px;font-weight:800}
.empty-sub{font-size:12px;font-weight:700;margin-top:6px;opacity:.7}

@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fade{animation:fadeUp .18s ease both}
`;

const COLORS = ['#16A34A','#F97316','#EF4444','#0EA5E9','#8B5CF6','#1D4ED8','#DB2777','#0891B2'];
const getColor = (s: string) => COLORS[Math.abs((s||'').split('').reduce((a,c) => a + c.charCodeAt(0), 0)) % COLORS.length];
const fmt = (d: string) => { try { return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' }); } catch { return d ?? ''; } };

function statusPill(status: string) {
  if (status === 'Submitted')       return <span className="status-pill submitted">Pending</span>;
  if (status === 'Partially Issued') return <span className="status-pill partial">Partial</span>;
  if (status === 'Issued')          return <span className="status-pill issued">Issued</span>;
  if (status === 'Completed')       return <span className="status-pill completed">Completed</span>;
  return <span className="status-pill submitted">{status}</span>;
}

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
        <button key={item.path} className={`bnav-item ${pathname === item.path || pathname === '/store/requisitions' && item.path === '/store/transfers' ? 'active' : ''}`}
          onClick={() => router.push(item.path)}>
          <span className="bnav-icon">{item.icon}</span>
          <span className="bnav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

type Tab = 'pending' | 'sent';

export function StoreRequisitionList() {
  const router   = useRouter();
  const token    = useAuthGuard('/store/login');
  const [reqs,   setReqs  ] = useState<any[]>([]);
  const [sent,   setSent  ] = useState<any[]>([]);
  const [tab,    setTab   ] = useState<Tab>('pending');
  const [loading,setLoading] = useState(true);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      apiRequest<any[]>('/store/requisitions', 'GET', undefined, token),
      apiRequest<any[]>('/store/transfer/sent', 'GET', undefined, token),
    ])
      .then(([incoming, outgoing]) => {
        setReqs(incoming || []);
        setSent(outgoing || []);
        setLoading(false);
      })
      .catch(() => { setReqs([]); setSent([]); setLoading(false); });
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (!token) return null;

  // Pending = Submitted or Partially Issued (kitchen requests needing store action)
  const pending = reqs.filter(r => r.status === 'Submitted' || r.status === 'Partially Issued');
  const shown   = tab === 'pending' ? pending : sent;

  return (
    <div className="tpage">
      <style>{CSS}</style>

      <div className="thdr">
        <div className="thdr-row">
          <button className="thdr-back" onClick={() => router.push('/store')}>←</button>
          <div className="thdr-info">
            <div className="thdr-title">Transfers</div>
            <div className="thdr-sub">
              {tab === 'pending'
                ? `${pending.length} pending · tap to issue`
                : `${sent.length} sent from this store`}
            </div>
          </div>
          <button className="thdr-new" onClick={() => router.push('/store/transfer/new')}>+ New</button>
          <button className="thdr-refresh" onClick={load} title="Refresh">🔄</button>
        </div>
      </div>

      <div className="ttabs">
        <button className={`ttab ${tab === 'pending' ? 'on' : ''}`} onClick={() => setTab('pending')}>
          To Issue
          <span className={`ttabcnt ${pending.length > 0 ? '' : 'muted'}`}>{pending.length}</span>
        </button>
        <button className={`ttab ${tab === 'sent' ? 'on' : ''}`} onClick={() => setTab('sent')}>
          Sent by Store
          <span className={`ttabcnt ${sent.length > 0 ? 'green' : 'muted'}`}>{sent.length}</span>
        </button>
      </div>

      <div className="tbody">
        {loading && (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <div className="empty-text">Loading transfers...</div>
          </div>
        )}

        {!loading && shown.length === 0 && (
          <div className="empty-state fade">
            <div className="empty-icon">{tab === 'pending' ? '✅' : '📭'}</div>
            <div className="empty-text">
              {tab === 'pending' ? 'No pending requests' : 'No sent transfers yet'}
            </div>
            <div className="empty-sub">
              {tab === 'pending'
                ? 'Kitchen requests will appear here'
                : 'Use + New to send material to a kitchen'}
            </div>
          </div>
        )}

        {shown.map((req) => {
          const isPending  = req.status === 'Submitted' || req.status === 'Partially Issued';
          const isIssued   = req.status === 'Issued';
          const isComplete = req.status === 'Completed';
          const color      = getColor(req.warehouse || String(req.id));
          const hdrColor   = isComplete ? '#6B7280' : color;

          return (
            <div key={req.id} className="tr-card fade">
              <div className="tr-hdr" style={{ background: hdrColor }}>
                <div className="tr-hdr-dot"/>
                <div className="tr-hdr-name">{req.warehouse}</div>
                <div className="tr-hdr-id">TR-{req.id}</div>
                {statusPill(req.status)}
              </div>

              <div className="tr-body">
                <div className="tr-row">
                  <span className="tr-label">Date</span>
                  <span className="tr-value">{fmt(req.requested_date || req.created_at || '')}</span>
                </div>
                {req.shift && (
                  <div className="tr-row">
                    <span className="tr-label">Shift</span>
                    <span className="tr-value">{req.shift}</span>
                  </div>
                )}
                <div className="tr-row">
                  <span className="tr-label">Items</span>
                  <span className={`tr-value ${isComplete ? 'blue' : isIssued ? 'green' : 'orange'}`}>
                    {req.items?.length ?? 0} items
                  </span>
                </div>
              </div>

              {req.items?.length > 0 && (
                <div className="tr-items-preview">
                  {req.items.slice(0, 4).map((it: any) => (
                    <span key={it.item_code} className="tr-item-chip">
                      {it.item_name || it.item_code}
                      {Number(it.issued_qty) > 0 ? ` · ${it.issued_qty}` : ` · ${it.requested_qty}`} {it.uom}
                    </span>
                  ))}
                  {req.items.length > 4 && (
                    <span className="tr-item-chip">+{req.items.length - 4} more</span>
                  )}
                </div>
              )}

              <div className="tr-actions">
                {isPending && (
                  <button className="tr-issue-btn"
                    onClick={() => router.push(`/store/issue/${req.id}`)}>
                    Issue Items →
                  </button>
                )}
                {isIssued && (
                  <button className="tr-issue-btn done"
                    onClick={() => router.push(`/store/issue/${req.id}`)}>
                    ✓ Issued — View Details
                  </button>
                )}
                {isComplete && (
                  <button className="tr-issue-btn grey"
                    onClick={() => router.push(`/store/issue/${req.id}`)}>
                    ✓ Completed — View
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav/>
    </div>
  );
}
