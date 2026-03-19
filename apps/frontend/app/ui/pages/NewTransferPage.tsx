'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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

.ntpage{max-width:480px;margin:0 auto;min-height:100vh;background:var(--bg);padding-bottom:96px}

/* Header */
.nthdr{background:var(--dk);position:sticky;top:0;z-index:60}
.nthdr-top{padding:14px 16px 10px;display:flex;align-items:center;gap:12px}
.nthdr-back{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.1);border:none;
  color:#fff;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nthdr-back:active{background:rgba(255,255,255,.2)}
.nthdr-info{flex:1}
.nthdr-title{font-size:16px;font-weight:900;color:#fff}
.nthdr-sub{font-size:11px;color:#6B7280;font-weight:700;margin-top:2px}

.ntstatbar{display:flex;padding:8px 0 12px;border-top:1px solid rgba(255,255,255,.07)}
.ntsb{flex:1;text-align:center;position:relative}
.ntsb+.ntsb::before{content:'';position:absolute;left:0;top:15%;bottom:15%;width:1px;background:rgba(255,255,255,.1)}
.ntsbn{font-family:'DM Mono',monospace;font-size:16px;font-weight:700;display:block;line-height:1}
.ntsbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;display:block;margin-top:3px}
.ntsb.o .ntsbn{color:#FB923C}
.ntsb.g .ntsbn{color:#4ADE80}
.ntsb.w .ntsbn{color:#fff}

/* Steps indicator */
.steps{display:flex;padding:12px 16px 0;gap:6px}
.step{flex:1;height:3px;border-radius:3px;background:rgba(255,255,255,.15)}
.step.done{background:var(--or)}
.step.active{background:rgba(255,255,255,.6)}

/* Body */
.ntbody{padding:12px 12px}
.sec-title{font-size:10px;font-weight:800;color:var(--lt);text-transform:uppercase;letter-spacing:.07em;padding:10px 2px 8px}

/* Warehouse picker */
.wh-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.wh-card{background:var(--wh);border-radius:13px;padding:14px;cursor:pointer;border:2px solid var(--ln);
  transition:border-color .12s;-webkit-tap-highlight-color:transparent}
.wh-card:active{opacity:.85}
.wh-card.selected{border-color:var(--or);background:var(--orl)}
.wh-card-icon{font-size:22px;margin-bottom:6px;display:block}
.wh-card-name{font-size:12px;font-weight:900;color:var(--dk);line-height:1.3}
.wh-custom-input{width:100%;height:44px;border:1.5px solid var(--ln);border-radius:11px;
  background:var(--bg);font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;
  color:var(--dk);padding:0 13px;outline:none;grid-column:1/-1}
.wh-custom-input:focus{border-color:var(--or);background:#fff}

/* Item search */
.search-wrap{background:var(--wh);border-radius:14px;padding:13px;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:12px}
.search-field{display:flex;align-items:center;gap:8px;border:1.5px solid var(--ln);
  border-radius:11px;padding:0 13px;height:44px;background:var(--bg)}
.search-field:focus-within{border-color:var(--or);background:var(--wh)}
.search-inp{flex:1;border:none;background:transparent;font-family:'Nunito',sans-serif;
  font-size:14px;font-weight:700;color:var(--dk);height:44px}
.search-inp:focus{outline:none}
.search-inp::placeholder{color:var(--lt)}
.search-results{margin-top:9px;border:1.5px solid var(--ln);border-radius:11px;overflow:visible}

.srr{display:flex;flex-direction:column;padding:11px 13px;background:var(--wh);
  border-bottom:1px solid var(--lnlt)}
.srr:last-child{border-bottom:none;border-radius:0 0 11px 11px}
.srr:first-child{border-radius:11px 11px 0 0}
.srr:only-child{border-radius:11px}
.srr-top{display:flex;align-items:center;gap:10px}
.srr-name{flex:1;font-size:13px;font-weight:800;color:var(--dk)}
.srr-sub{font-size:10px;font-weight:700;color:var(--lt);margin-top:2px}
.srr-add-btn{width:32px;height:32px;border-radius:8px;background:var(--or);
  color:#fff;border:none;cursor:pointer;font-size:20px;font-weight:900;
  display:flex;align-items:center;justify-content:center;flex-shrink:0}
.srr-add-btn.in-cart{background:var(--gn)}

/* Cart items */
.cart-card{background:var(--wh);border-radius:14px;overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:10px}
.cc-hdr{padding:10px 14px;display:flex;align-items:center;justify-content:space-between}
.cc-hdr-title{font-size:11px;font-weight:800;color:var(--lt);text-transform:uppercase;letter-spacing:.06em}
.cc-hdr-count{font-size:11px;font-weight:800;color:var(--or);font-family:'DM Mono',monospace}

.cart-item-row{display:flex;align-items:center;gap:9px;padding:9px 14px;
  border-top:1px solid var(--lnlt)}
.cir-name{flex:1;font-size:13px;font-weight:800;color:var(--dk);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qty-ctrl{display:flex;align-items:center;border:1.5px solid var(--ln);border-radius:10px;overflow:hidden;height:38px}
.qty-btn{width:34px;height:38px;border:none;cursor:pointer;font-size:20px;font-weight:900;
  background:var(--bg);color:var(--dk);display:flex;align-items:center;justify-content:center}
.qty-btn.add{background:var(--or);color:#fff}
.qty-btn:active{filter:brightness(.9)}
.qty-inp{width:46px;border:none;background:transparent;text-align:center;
  font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:var(--dk);height:38px;padding:0}
.qty-inp:focus{outline:none}
.qty-inp::-webkit-inner-spin-button{-webkit-appearance:none}
.qty-unit{font-size:10px;font-weight:800;color:var(--lt);flex-shrink:0;width:28px}
.remove-btn{width:28px;height:28px;border-radius:6px;background:var(--rdbg);
  color:var(--rd);border:none;cursor:pointer;font-size:14px;
  display:flex;align-items:center;justify-content:center;flex-shrink:0}

/* Note */
.note-wrap{background:var(--wh);border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.07);padding:14px;margin-bottom:12px}
.note-label{font-size:11px;font-weight:800;color:var(--lt);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.note-inp{width:100%;min-height:60px;border:1.5px solid var(--ln);border-radius:10px;
  background:var(--bg);font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;
  color:var(--dk);padding:10px 12px;resize:none;outline:none}
.note-inp:focus{border-color:var(--or);background:#fff}

/* Bottom bar */
.ntbbar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;background:var(--wh);border-top:2px solid var(--ln);
  box-shadow:0 -4px 24px rgba(0,0,0,.1)}
.ntbbar-inner{padding:10px 12px 18px;display:flex;gap:9px}
.ntbbar-back{padding:13px 18px;background:var(--bg);color:var(--md);
  border:2px solid var(--ln);border-radius:13px;cursor:pointer;
  font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;flex-shrink:0}
.ntbbar-next{flex:1;padding:13px;background:var(--or);color:#fff;border:none;
  border-radius:13px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:14px;font-weight:900}
.ntbbar-next:disabled{background:#D1D5DB;cursor:not-allowed}
.ntbbar-next.green{background:var(--gn)}
.ntbbar-next:not(:disabled):active{filter:brightness(.9)}

/* Success overlay */
.success-overlay{position:fixed;inset:0;background:rgba(17,24,39,.75);z-index:100;
  display:flex;align-items:flex-end;justify-content:center}
.success-sheet{background:var(--wh);width:100%;max-width:480px;border-radius:22px 22px 0 0;padding-bottom:36px}
.success-handle{width:40px;height:4px;background:#E5E7EB;border-radius:4px;margin:16px auto 20px}
.success-icon{font-size:56px;text-align:center;margin-bottom:12px}
.success-title{font-size:19px;font-weight:900;color:var(--dk);text-align:center;margin-bottom:6px}
.success-sub{font-size:13px;font-weight:700;color:var(--md);text-align:center;margin:0 20px 20px;line-height:1.5}
.success-info{background:var(--gnbg);border:1.5px solid var(--gnbr);border-radius:12px;
  padding:12px 18px;margin:0 18px 20px}
.success-row{display:flex;justify-content:space-between;padding:4px 0;
  font-size:12px;font-weight:800}
.success-row .label{color:var(--md)}
.success-row .value{color:var(--dk);font-family:'DM Mono',monospace}
.success-btn{display:block;margin:0 18px;padding:14px;background:var(--gn);color:#fff;border:none;
  border-radius:13px;font-family:'Nunito',sans-serif;font-size:14px;font-weight:900;cursor:pointer;
  text-align:center;width:calc(100% - 36px)}
.success-btn2{display:block;margin:10px 18px 0;padding:13px;background:var(--bg);color:var(--dk);
  border:2px solid var(--ln);border-radius:13px;font-family:'Nunito',sans-serif;font-size:13px;
  font-weight:800;cursor:pointer;text-align:center;width:calc(100% - 36px)}

@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.anim-up{animation:slideUp .25s cubic-bezier(.34,1.2,.64,1)}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fade{animation:fadeUp .18s ease both}
`;

const COLORS = ['#16A34A','#F97316','#EF4444','#0EA5E9','#8B5CF6','#1D4ED8','#DB2777','#0891B2'];
const getColor = (s: string) => COLORS[Math.abs((s||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % COLORS.length];
const n3 = (v: number) => parseFloat(Number(v).toFixed(3));

interface CartItem { item_code: string; item_name: string; uom: string; qty: number; stock_qty: number }

export function NewTransferPage() {
  const router = useRouter();
  const token  = useAuthGuard('/store/login');

  const [step,         setStep        ] = useState<1|2|3>(1);
  const [kitchens,     setKitchens    ] = useState<string[]>([]);
  const [targetWh,     setTargetWh    ] = useState('');
  const [customWh,     setCustomWh    ] = useState('');
  const [search,       setSearch      ] = useState('');
  const [results,      setResults     ] = useState<any[]>([]);
  const [searching,    setSearching   ] = useState(false);
  const [cart,         setCart        ] = useState<CartItem[]>([]);
  const [note,         setNote        ] = useState('');
  const [submitting,   setSubmitting  ] = useState(false);
  const [submitErr,    setSubmitErr   ] = useState<string|null>(null);
  const [success,      setSuccess     ] = useState<any|null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => {
    if (!token) return;
    apiRequest<string[]>('/store/transfer/kitchens', 'GET', undefined, token)
      .then(d => setKitchens(d || []))
      .catch(() => setKitchens([]));
  }, [token]);

  useEffect(() => {
    const q = search.trim();
    if (!q) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!token) return;
      setSearching(true);
      try {
        const data = await apiRequest<any[]>(`/store/vendor-order/items?q=${encodeURIComponent(q)}`, 'GET', undefined, token);
        setResults(data || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, token]);

  const effectiveTarget = targetWh === '__custom__' ? customWh.trim() : targetWh;
  const inCart = (code: string) => cart.some(c => c.item_code === code);

  const addItem = (item: any) => {
    if (inCart(item.item_code)) return;
    setCart(prev => [...prev, {
      item_code: item.item_code,
      item_name: item.item_name || item.item_code,
      uom:       item.uom || '',
      qty:       1,
      stock_qty: Number(item.stock_qty || 0),
    }]);
  };

  const removeItem = (code: string) => setCart(prev => prev.filter(c => c.item_code !== code));
  const setQty = (code: string, qty: number) =>
    setCart(prev => prev.map(c => c.item_code === code ? { ...c, qty: Math.max(0.5, n3(qty)) } : c));

  const totalQty = useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart]);

  const handleSubmit = async () => {
    if (!token || !effectiveTarget || cart.length === 0) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const res = await apiRequest<any>('/store/transfer/create', 'POST', {
        target_warehouse: effectiveTarget,
        note: note || undefined,
        items: cart.map(c => ({ item_code: c.item_code, item_name: c.item_name, uom: c.uom, qty: c.qty })),
      }, token);
      setSuccess(res);
    } catch (err: any) {
      setSubmitErr(err?.message || 'Transfer failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) return null;

  return (
    <div className="ntpage">
      <style>{CSS}</style>

      {/* Success overlay */}
      {success && (
        <div className="success-overlay">
          <div className="success-sheet anim-up">
            <div className="success-handle"/>
            <div className="success-icon">✅</div>
            <div className="success-title">Transfer Issued!</div>
            <div className="success-sub">
              Material sent to <strong>{effectiveTarget}</strong> — no request needed.
            </div>
            <div className="success-info">
              <div className="success-row"><span className="label">To Kitchen</span><span className="value">{effectiveTarget}</span></div>
              <div className="success-row"><span className="label">Items</span><span className="value">{success.items ?? cart.length}</span></div>
              <div className="success-row"><span className="label">Transfer ID</span><span className="value">TR-{success.requisition_id}</span></div>
              {success.erp_draft && (
                <div className="success-row"><span className="label">ERP Draft SE</span><span className="value" style={{color:'#16A34A'}}>{success.erp_draft}</span></div>
              )}
              {success.erp_error && (
                <div className="success-row" style={{background:'#FEF2F2',borderRadius:8,padding:'6px 8px',marginTop:4}}>
                  <span className="label" style={{color:'#DC2626'}}>ERP Warning</span>
                  <span className="value" style={{color:'#DC2626',fontSize:10,fontFamily:'sans-serif'}}>Draft not created — will be handled at finalize</span>
                </div>
              )}
            </div>
            <button className="success-btn" onClick={() => router.push('/store/transfers')}>
              Done → View Transfers
            </button>
            <button className="success-btn2" onClick={() => {
              setSuccess(null); setCart([]); setNote(''); setSearch(''); setStep(1); setTargetWh('');
            }}>
              Send Another Transfer
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="nthdr">
        <div className="nthdr-top">
          <button className="nthdr-back" onClick={() => step === 1 ? router.push('/store/transfers') : setStep(s => (s - 1) as any)}>←</button>
          <div className="nthdr-info">
            <div className="nthdr-title">New Transfer</div>
            <div className="nthdr-sub">
              {step === 1 ? 'Select destination kitchen' : step === 2 ? `To: ${effectiveTarget}` : `Review — ${cart.length} items`}
            </div>
          </div>
        </div>

        <div className="steps">
          <div className={`step ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}`}/>
          <div className={`step ${step >= 2 ? (step > 2 ? 'done' : 'active') : ''}`}/>
          <div className={`step ${step >= 3 ? 'active' : ''}`}/>
        </div>

        {cart.length > 0 && (
          <div className="ntstatbar">
            <div className="ntsb o"><span className="ntsbn">{cart.length}</span><span className="ntsbl">Items</span></div>
            <div className="ntsb g"><span className="ntsbn">{totalQty.toFixed(1)}</span><span className="ntsbl">Total Qty</span></div>
            <div className="ntsb w"><span className="ntsbn">{effectiveTarget ? '✓' : '—'}</span><span className="ntsbl">Kitchen</span></div>
          </div>
        )}
      </div>

      <div className="ntbody">

        {/* Step 1: Select kitchen */}
        {step === 1 && (
          <>
            <div className="sec-title">Select Kitchen / Destination</div>
            <div className="wh-grid">
              {kitchens.map(wh => (
                <div key={wh} className={`wh-card ${targetWh === wh ? 'selected' : ''}`}
                  onClick={() => setTargetWh(targetWh === wh ? '' : wh)}>
                  <span className="wh-card-icon" style={{ color: getColor(wh) }}>🏪</span>
                  <span className="wh-card-name">{wh}</span>
                </div>
              ))}
              <div className={`wh-card ${targetWh === '__custom__' ? 'selected' : ''}`}
                onClick={() => setTargetWh('__custom__')}>
                <span className="wh-card-icon">✏️</span>
                <span className="wh-card-name">Custom Kitchen</span>
              </div>
            </div>
            {targetWh === '__custom__' && (
              <input
                className="wh-custom-input"
                placeholder="Type kitchen warehouse name..."
                value={customWh}
                onChange={e => setCustomWh(e.target.value)}
                autoFocus
              />
            )}
            {kitchens.length === 0 && (
              <div style={{ textAlign:'center', padding:'24px 20px', color:'#9CA3AF', fontSize:12, fontWeight:700 }}>
                No kitchens found — use Custom Kitchen to type manually
              </div>
            )}
          </>
        )}

        {/* Step 2: Add items */}
        {step === 2 && (
          <>
            <div className="search-wrap">
              <div className="search-field">
                <span style={{ fontSize:16, color:'var(--lt)' }}>🔍</span>
                <input className="search-inp"
                  placeholder="Search items to send..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
                {search && <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--lt)', fontSize:16 }}
                  onClick={() => { setSearch(''); setResults([]); }}>✕</button>}
              </div>

              {searching && (
                <div style={{ textAlign:'center', padding:'12px', color:'#9CA3AF', fontSize:12, fontWeight:700 }}>
                  Searching...
                </div>
              )}

              {!searching && results.length > 0 && (
                <div className="search-results" style={{ marginTop:9 }}>
                  {results.map(item => {
                    const added = inCart(item.item_code);
                    return (
                      <div key={item.item_code} className="srr fade">
                        <div className="srr-top">
                          <div style={{ flex:1 }}>
                            <div className="srr-name">{item.item_name || item.item_code}</div>
                            <div className="srr-sub">
                              {item.stock_qty > 0 ? `In store: ${item.stock_qty} ${item.uom}` : 'Stock unknown'}
                              {item.last_po_date ? ` · ${item.last_po_date}` : ''}
                            </div>
                          </div>
                          <button className={`srr-add-btn ${added ? 'in-cart' : ''}`}
                            onClick={() => added ? removeItem(item.item_code) : addItem(item)}>
                            {added ? '✓' : '+'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart preview */}
            {cart.length > 0 && (
              <div className="cart-card fade">
                <div className="cc-hdr">
                  <span className="cc-hdr-title">Added Items</span>
                  <span className="cc-hdr-count">{cart.length} items</span>
                </div>
                {cart.map(item => (
                  <div key={item.item_code} className="cart-item-row">
                    <span className="cir-name">{item.item_name}</span>
                    <div className="qty-ctrl">
                      <button className="qty-btn"
                        onPointerDown={e => { e.preventDefault(); setQty(item.item_code, item.qty - 0.5); }}>−</button>
                      <input className="qty-inp" type="number" inputMode="decimal" step="any"
                        value={item.qty}
                        onChange={e => setQty(item.item_code, parseFloat(e.target.value) || 0)}
                        onFocus={e => e.target.select()} />
                      <button className="qty-btn add"
                        onPointerDown={e => { e.preventDefault(); setQty(item.item_code, item.qty + 0.5); }}>+</button>
                    </div>
                    <span className="qty-unit">{item.uom}</span>
                    <button className="remove-btn" onClick={() => removeItem(item.item_code)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Step 3: Review & send */}
        {step === 3 && (
          <>
            {/* Destination */}
            <div className="sec-title">Sending To</div>
            <div style={{ background:'var(--wh)', borderRadius:14, padding:'12px 14px',
              boxShadow:'0 1px 4px rgba(0,0,0,.07)', marginBottom:12, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:getColor(effectiveTarget),
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🏪</div>
              <div>
                <div style={{ fontSize:14, fontWeight:900, color:'var(--dk)' }}>{effectiveTarget}</div>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--lt)', marginTop:2 }}>
                  {cart.length} items · {totalQty.toFixed(1)} total qty
                </div>
              </div>
            </div>

            <div className="sec-title">Items to Transfer</div>
            <div className="cart-card fade">
              <div className="cc-hdr">
                <span className="cc-hdr-title">Transfer List</span>
                <span className="cc-hdr-count">{cart.length} items</span>
              </div>
              {cart.map(item => (
                <div key={item.item_code} className="cart-item-row">
                  <span className="cir-name">{item.item_name}</span>
                  <div className="qty-ctrl">
                    <button className="qty-btn"
                      onPointerDown={e => { e.preventDefault(); setQty(item.item_code, item.qty - 0.5); }}>−</button>
                    <input className="qty-inp" type="number" inputMode="decimal" step="any"
                      value={item.qty}
                      onChange={e => setQty(item.item_code, parseFloat(e.target.value) || 0)}
                      onFocus={e => e.target.select()} />
                    <button className="qty-btn add"
                      onPointerDown={e => { e.preventDefault(); setQty(item.item_code, item.qty + 0.5); }}>+</button>
                  </div>
                  <span className="qty-unit">{item.uom}</span>
                  <button className="remove-btn" onClick={() => removeItem(item.item_code)}>✕</button>
                </div>
              ))}
            </div>

            <div className="note-wrap fade">
              <div className="note-label">Note (optional)</div>
              <textarea className="note-inp"
                placeholder="Add a note for the kitchen..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            {submitErr && (
              <div style={{ background:'var(--rdbg)', border:'1.5px solid #FECACA', borderRadius:12,
                padding:'11px 14px', marginBottom:10, fontSize:13, fontWeight:700, color:'var(--rd)' }}>
                ⚠️ {submitErr}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="ntbbar">
        <div className="ntbbar-inner">
          {step > 1 && (
            <button className="ntbbar-back" onClick={() => setStep(s => (s - 1) as any)}>← Back</button>
          )}
          {step === 1 && (
            <button className="ntbbar-next"
              disabled={!effectiveTarget}
              style={{ flex:1 }}
              onClick={() => setStep(2)}>
              Next → Add Items
            </button>
          )}
          {step === 2 && (
            <button className="ntbbar-next"
              disabled={cart.length === 0}
              style={{ flex:1 }}
              onClick={() => setStep(3)}>
              Review {cart.length > 0 ? `(${cart.length} items)` : ''} →
            </button>
          )}
          {step === 3 && (
            <button className={`ntbbar-next green`}
              style={{ flex:1 }}
              disabled={submitting || cart.length === 0}
              onClick={handleSubmit}>
              {submitting ? '⏳ Sending...' : `✓ Issue Transfer to ${effectiveTarget}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
