'use client';

import { useEffect, useMemo, useState } from 'react';
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
  --bl:#1D4ED8;--blbg:#EFF6FF;--blbr:#BFDBFE;
  --ln:#E5E7EB;--lnlt:#F3F4F6;
}
body{font-family:'Nunito',sans-serif;background:var(--bg);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}

.rpage{max-width:480px;margin:0 auto;min-height:100vh;background:var(--bg);padding-bottom:72px}

/* Header */
.rhdr{background:var(--dk);position:sticky;top:0;z-index:60;padding:14px 16px 14px}
.rhdr-row{display:flex;align-items:center;gap:12px}
.rhdr-back{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.1);border:none;
  color:#fff;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rhdr-back:active{background:rgba(255,255,255,.2)}
.rhdr-title{font-size:17px;font-weight:900;color:#fff}
.rhdr-sub{font-size:11px;color:#6B7280;font-weight:700;margin-top:2px}

/* Body */
.rbody{padding:12px 12px}
.sec-title{font-size:10px;font-weight:800;color:var(--lt);text-transform:uppercase;letter-spacing:.07em;padding:10px 2px 8px}

/* PO list */
.po-card{background:var(--wh);border-radius:14px;overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:10px;cursor:pointer}
.po-card:active{opacity:.85}
.po-hdr{padding:11px 14px;color:#fff;display:flex;align-items:center;gap:10px}
.po-hdr-dot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.4);flex-shrink:0}
.po-hdr-vendor{flex:1;font-size:13px;font-weight:900}
.po-hdr-id{font-size:11px;font-weight:700;opacity:.8;font-family:'DM Mono',monospace}
.po-body{padding:10px 14px;display:flex;align-items:center;justify-content:space-between}
.po-items-count{font-size:12px;font-weight:800;color:var(--md)}
.po-arrow{font-size:16px;color:var(--or);font-weight:900}

/* Receipt items */
.receipt-hdr{background:var(--wh);border-radius:14px;overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:12px}
.rh-vendor{padding:12px 14px;color:#fff;display:flex;align-items:center;gap:10px}
.rh-vendor-name{flex:1;font-size:14px;font-weight:900}
.rh-vendor-po{font-size:11px;font-weight:700;opacity:.8;font-family:'DM Mono',monospace}
.rh-stats{display:flex;padding:10px 14px;gap:12px;border-top:1px solid var(--lnlt)}
.rh-stat{flex:1;text-align:center}
.rh-stat-val{font-family:'DM Mono',monospace;font-size:17px;font-weight:700;color:var(--dk);display:block}
.rh-stat-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--lt);margin-top:2px;display:block}

/* Line item */
.line-card{background:var(--wh);border-radius:14px;overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:10px}
.lc-hdr{padding:11px 14px;border-bottom:1px solid var(--lnlt);display:flex;align-items:center;gap:8px}
.lc-name{flex:1;font-size:13px;font-weight:900;color:var(--dk)}
.lc-code{font-size:10px;font-weight:700;color:var(--lt);font-family:'DM Mono',monospace}
.lc-body{padding:10px 14px;display:flex;align-items:center;gap:10px}
.lc-ordered{font-size:11px;font-weight:800;color:var(--md);flex:1}
.lc-ordered span{color:var(--bl);font-family:'DM Mono',monospace}

.qty-ctrl{display:flex;align-items:center;border:1.5px solid var(--ln);border-radius:11px;overflow:hidden;height:42px}
.qty-btn{width:38px;height:42px;border:none;cursor:pointer;font-size:20px;font-weight:900;
  background:var(--bg);color:var(--dk);display:flex;align-items:center;justify-content:center}
.qty-btn.add{background:var(--or);color:#fff}
.qty-btn:active{filter:brightness(.9)}
.qty-inp{width:52px;border:none;background:transparent;text-align:center;
  font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:var(--dk);height:42px;padding:0}
.qty-inp:focus{outline:none}
.qty-inp::-webkit-inner-spin-button{-webkit-appearance:none}
.qty-unit{font-size:10px;font-weight:800;color:var(--lt);flex-shrink:0}

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

/* Bottom bar (for confirm receipt) */
.rbbar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;background:var(--wh);border-top:2px solid var(--ln);
  box-shadow:0 -4px 24px rgba(0,0,0,.1);z-index:61}
.rbbar-inner{padding:10px 12px 18px;display:flex;gap:9px}
.rbbar-cancel{padding:13px 16px;background:var(--bg);color:var(--md);
  border:2px solid var(--ln);border-radius:13px;cursor:pointer;
  font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;flex-shrink:0}
.rbbar-confirm{flex:1;padding:13px;background:var(--gn);color:#fff;border:none;
  border-radius:13px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:14px;font-weight:900}
.rbbar-confirm:disabled{background:#D1D5DB;cursor:not-allowed}
.rbbar-confirm:not(:disabled):active{background:#15803D}

/* Success */
.success-overlay{position:fixed;inset:0;background:rgba(17,24,39,.75);z-index:100;
  display:flex;align-items:flex-end;justify-content:center}
.success-sheet{background:var(--wh);width:100%;max-width:480px;border-radius:22px 22px 0 0;padding-bottom:32px}
.success-handle{width:40px;height:4px;background:#E5E7EB;border-radius:4px;margin:16px auto 20px}
.success-icon{font-size:56px;text-align:center;margin-bottom:12px}
.success-title{font-size:19px;font-weight:900;color:var(--dk);text-align:center;margin-bottom:6px}
.success-sub{font-size:13px;font-weight:700;color:var(--md);text-align:center;margin-bottom:20px}
.success-id-box{background:var(--gnbg);border:1.5px solid var(--gnbr);border-radius:12px;
  padding:12px 18px;margin:0 18px 16px;text-align:center}
.success-id{font-family:'DM Mono',monospace;font-size:15px;font-weight:700;color:var(--gn)}
.success-done-btn{display:block;margin:0 18px;padding:14px;background:var(--gn);color:#fff;border:none;
  border-radius:13px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:900;cursor:pointer;width:calc(100% - 36px)}
.success-more-btn{display:block;margin:10px 18px 0;padding:13px;background:var(--bg);color:var(--dk);
  border:2px solid var(--ln);border-radius:13px;font-family:'Nunito',sans-serif;font-size:13px;
  font-weight:800;cursor:pointer;width:calc(100% - 36px)}

@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.anim-up{animation:slideUp .25s cubic-bezier(.34,1.2,.64,1)}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fade{animation:fadeUp .18s ease both}
`;

interface PoRow {
  po_id: string;
  vendor_id: string;
  vendor_name?: string | null;
  erp: any | null;
}
interface ReceiptLine { item_code: string; item_name?: string; uom?: string; qty: number; ordered?: number }

const COLORS = ['#16A34A','#F97316','#EF4444','#0EA5E9','#8B5CF6','#1D4ED8','#DB2777'];
const getColor = (s: string) => COLORS[Math.abs((s||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % COLORS.length];
const n3 = (v: number) => parseFloat(Number(v).toFixed(3));
const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits:0 })}`;

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

export function PurchaseReceipts() {
  const router   = useRouter();
  const token    = useAuthGuard('/store/login');
  const [openPos,  setOpenPos ] = useState<PoRow[]>([]);
  const [selected, setSelected] = useState<PoRow | null>(null);
  const [lines,    setLines   ] = useState<ReceiptLine[]>([]);
  const [loading,  setLoading ] = useState(false);
  const [fetchingPos, setFetchingPos] = useState(true);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOpenPos = () => {
    if (!token) return;
    setFetchingPos(true);
    apiRequest<PoRow[]>('/store/purchase-receipts/open-pos', 'GET', undefined, token)
      .then(d => { setOpenPos(d || []); setFetchingPos(false); })
      .catch(() => { setOpenPos([]); setFetchingPos(false); });
  };

  useEffect(() => { loadOpenPos(); }, [token]);

  useEffect(() => {
    if (!selected) { setLines([]); return; }
    const items = Array.isArray(selected.erp?.items) ? selected.erp.items : [];
    setLines(items.map((item: any) => {
      const ordered   = Number(item.qty || 0);
      const received  = Number(item.received_qty || 0);
      const remaining = Math.max(0, ordered - received);
      return { item_code: item.item_code, item_name: item.item_name, uom: item.uom, qty: remaining > 0 ? remaining : ordered, ordered };
    }));
  }, [selected]);

  const grandTotal = useMemo(
    () => lines.reduce((s, l) => s + l.qty, 0),
    [lines]
  );

  const handleSubmit = async () => {
    if (!token || !selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ receipt_id: string }>(
        '/store/purchase-receipts/create', 'POST',
        { po_id: selected.po_id, vendor_id: selected.vendor_id, vendor_name: selected.vendor_name, lines: lines.map(l => ({ item_code: l.item_code, item_name: l.item_name, uom: l.uom, qty: Number(l.qty || 0) })) },
        token
      );
      setSuccessId(res?.receipt_id || 'Created');
      setSelected(null); setLines([]);
      loadOpenPos();
    } catch (err: any) {
      setError(err?.message || 'Failed to create receipt. Please try again.');
    } finally { setLoading(false); }
  };

  const setLineQty = (code: string, qty: number) =>
    setLines(prev => prev.map(l => l.item_code === code ? { ...l, qty: Math.max(0, n3(qty)) } : l));

  if (!token) return null;

  return (
    <div className="rpage">
      <style>{CSS}</style>

      {/* Success overlay */}
      {successId && (
        <div className="success-overlay">
          <div className="success-sheet anim-up">
            <div className="success-handle"/>
            <div className="success-icon">📋</div>
            <div className="success-title">Receipt Created!</div>
            <div className="success-sub">Purchase receipt submitted to ERPNext</div>
            <div className="success-id-box">
              <div style={{ fontSize:11, fontWeight:800, color:'var(--lt)', marginBottom:4 }}>Receipt ID</div>
              <div className="success-id">{successId}</div>
            </div>
            <button className="success-done-btn" style={{ width:'calc(100% - 36px)' }}
              onClick={() => { setSuccessId(null); }}>
              ✓ Done — Receive Another
            </button>
            <button className="success-more-btn" style={{ width:'calc(100% - 36px)' }}
              onClick={() => router.push('/store')}>
              Go to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="rhdr">
        <div className="rhdr-row">
          <button className="rhdr-back" onClick={() => selected ? setSelected(null) : router.push('/store')}>←</button>
          <div>
            <div className="rhdr-title">{selected ? 'Confirm Receipt' : 'Purchase Receipts'}</div>
            <div className="rhdr-sub">
              {selected
                ? `${selected.vendor_name || selected.vendor_id} · ${lines.length} items`
                : `${openPos.length} open POs`}
            </div>
          </div>
        </div>
      </div>

      <div className="rbody">
        {/* PO selection list */}
        {!selected && (
          <>
            <div className="sec-title">Open Purchase Orders</div>

            {fetchingPos && (
              <div style={{ textAlign:'center', padding:'48px 20px', color:'#9CA3AF' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>⏳</div>
                <div style={{ fontSize:13, fontWeight:800 }}>Loading open POs...</div>
              </div>
            )}

            {!fetchingPos && openPos.length === 0 && (
              <div style={{ textAlign:'center', padding:'48px 20px', color:'#9CA3AF' }}>
                <div style={{ fontSize:44, marginBottom:12 }}>📭</div>
                <div style={{ fontSize:14, fontWeight:800 }}>No open purchase orders</div>
                <div style={{ fontSize:12, marginTop:6 }}>Create a vendor order first to receive items</div>
              </div>
            )}

            {openPos.map((po, i) => {
              const color   = getColor(po.vendor_id);
              const items   = Array.isArray(po.erp?.items) ? po.erp.items : [];
              const total   = po.erp?.grand_total ? inr(po.erp.grand_total) : `${items.length} items`;
              return (
                <div key={po.po_id} className="po-card fade" onClick={() => setSelected(po)}>
                  <div className="po-hdr" style={{ background: color }}>
                    <div className="po-hdr-dot"/>
                    <div className="po-hdr-vendor">{po.vendor_name || po.vendor_id}</div>
                    <div className="po-hdr-id">{po.po_id}</div>
                  </div>
                  <div className="po-body">
                    <div className="po-items-count">{items.length} items · {total}</div>
                    <div className="po-arrow">Receive →</div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Receipt entry */}
        {selected && (
          <>
            {/* Vendor summary card */}
            <div className="receipt-hdr fade">
              <div className="rh-vendor" style={{ background: getColor(selected.vendor_id) }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:'rgba(255,255,255,.4)', flexShrink:0 }}/>
                <div className="rh-vendor-name">{selected.vendor_name || selected.vendor_id}</div>
                <div className="rh-vendor-po">{selected.po_id}</div>
              </div>
              <div className="rh-stats">
                <div className="rh-stat">
                  <span className="rh-stat-val">{lines.length}</span>
                  <span className="rh-stat-lbl">Items</span>
                </div>
                <div className="rh-stat">
                  <span className="rh-stat-val">{grandTotal.toFixed(1)}</span>
                  <span className="rh-stat-lbl">Total Qty</span>
                </div>
                {selected.erp?.grand_total && (
                  <div className="rh-stat">
                    <span className="rh-stat-val" style={{ fontSize:14 }}>{inr(selected.erp.grand_total)}</span>
                    <span className="rh-stat-lbl">Order Value</span>
                  </div>
                )}
              </div>
            </div>

            {/* Line items */}
            {lines.map(line => (
              <div key={line.item_code} className="line-card fade">
                <div className="lc-hdr">
                  <div className="lc-name">{line.item_name || line.item_code}</div>
                  <div className="lc-code">{line.item_code}</div>
                </div>
                <div className="lc-body">
                  <div className="lc-ordered">
                    Ordered: <span>{line.ordered ?? line.qty} {line.uom}</span>
                  </div>
                  <div className="qty-ctrl">
                    <button className="qty-btn"
                      onPointerDown={e => { e.preventDefault(); setLineQty(line.item_code, line.qty - 0.5); }}>−</button>
                    <input className="qty-inp" type="number" inputMode="decimal" step="any"
                      value={line.qty}
                      onChange={e => setLineQty(line.item_code, parseFloat(e.target.value) || 0)}
                      onFocus={e => e.target.select()} />
                    <button className="qty-btn add"
                      onPointerDown={e => { e.preventDefault(); setLineQty(line.item_code, line.qty + 0.5); }}>+</button>
                  </div>
                  <span className="qty-unit">{line.uom}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ margin:'0 12px 12px', padding:'11px 14px', background:'var(--rdbg)',
          border:'1.5px solid #FECACA', borderRadius:12, fontSize:13, fontWeight:700,
          color:'var(--rd)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ flex:1 }}>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={{ background:'none', border:'none',
            cursor:'pointer', color:'var(--rd)', fontSize:16, lineHeight:1 }}>✕</button>
        </div>
      )}

      {/* Bottom nav (shown when not confirming) */}
      {!selected && <BottomNav/>}

      {/* Bottom bar for confirm */}
      {selected && (
        <div className="rbbar">
          <div className="rbbar-inner">
            <button className="rbbar-cancel" onClick={() => setSelected(null)}>← Back</button>
            <button className="rbbar-confirm" disabled={loading || lines.length === 0} onClick={handleSubmit}>
              {loading ? '⏳ Creating...' : `✓ Confirm Receipt — ${lines.length} Items`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
