'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiRequest, apiUploadFiles } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';
import { compressImage } from '../../../lib/image-utils';

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

/* Mode cards (landing) */
.mode-cards{display:flex;flex-direction:column;gap:12px;padding-top:8px}
.mode-card{background:var(--wh);border-radius:16px;padding:20px 18px;display:flex;align-items:center;gap:16px;
  box-shadow:0 1px 4px rgba(0,0,0,.07);cursor:pointer;border:2px solid transparent}
.mode-card:active{border-color:var(--or);background:var(--orl)}
.mode-card-icon{font-size:36px;flex-shrink:0}
.mode-card-title{font-size:15px;font-weight:900;color:var(--dk)}
.mode-card-desc{font-size:12px;font-weight:700;color:var(--md);margin-top:3px}
.mode-card-arrow{margin-left:auto;font-size:18px;color:var(--or);font-weight:900;flex-shrink:0}

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

/* Vendor list (direct mode) */
.vendor-search{display:flex;align-items:center;gap:8px;background:var(--wh);border-radius:12px;
  padding:0 12px;margin-bottom:12px;border:1.5px solid var(--ln)}
.vendor-search:focus-within{border-color:var(--or)}
.vendor-search-icon{font-size:16px;color:var(--lt);flex-shrink:0}
.vendor-search input{flex:1;border:none;background:none;padding:12px 0;
  font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;color:var(--dk);outline:none}
.vendor-search input::placeholder{color:var(--lt)}
.vendor-row{background:var(--wh);border-radius:12px;padding:13px 14px;margin-bottom:8px;
  display:flex;align-items:center;gap:10px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.vendor-row:active{background:var(--orl)}
.vendor-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.vendor-name{flex:1;font-size:13px;font-weight:800;color:var(--dk)}
.vendor-arrow{font-size:14px;color:var(--lt)}

/* Item search (direct mode) */
.item-search-wrap{position:relative;margin-bottom:12px}
.item-search{display:flex;align-items:center;gap:8px;background:var(--wh);border-radius:12px;
  padding:0 12px;border:1.5px solid var(--ln)}
.item-search:focus-within{border-color:var(--or)}
.item-search input{flex:1;border:none;background:none;padding:12px 0;
  font-family:'Nunito',sans-serif;font-size:14px;font-weight:700;color:var(--dk);outline:none}
.item-search input::placeholder{color:var(--lt)}
.search-results{background:var(--wh);border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.12);
  max-height:260px;overflow-y:auto;margin-bottom:12px}
.search-item{padding:11px 14px;border-bottom:1px solid var(--lnlt);display:flex;align-items:center;gap:10px;cursor:pointer}
.search-item:last-child{border-bottom:none}
.search-item:active{background:var(--orl)}
.search-item-info{flex:1}
.search-item-name{font-size:13px;font-weight:800;color:var(--dk)}
.search-item-code{font-size:10px;font-weight:700;color:var(--lt);font-family:'DM Mono',monospace;margin-top:1px}
.search-item-add{width:32px;height:32px;border-radius:50%;background:var(--or);color:#fff;border:none;
  font-size:20px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}

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
.lc-remove{width:24px;height:24px;border-radius:50%;background:var(--rdbg);color:var(--rd);border:none;
  font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.lc-body{padding:10px 14px;display:flex;align-items:center;gap:10px}
.lc-ordered{font-size:11px;font-weight:800;color:var(--md);flex:1}
.lc-ordered span{color:var(--bl);font-family:'DM Mono',monospace}

.lc-photo{padding:8px 14px 12px;border-top:1px solid var(--lnlt)}
.lc-photo-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:10px;
  background:var(--lnlt);border:1.5px dashed var(--ln);border-radius:10px;cursor:pointer;
  font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:var(--md)}
.lc-photo-btn:active{border-color:var(--or);color:var(--or);background:var(--orl)}
.lc-photo-row{display:flex;align-items:center;gap:10px}
.lc-photo-retake{background:none;border:none;cursor:pointer;font-family:'Nunito',sans-serif;
  font-size:11px;font-weight:800;color:var(--or)}
.lc-photo-retake:active{opacity:.7}

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

/* Photo section */
.photo-section{background:var(--wh);border-radius:14px;overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:10px;padding:14px}
.photo-title{font-size:11px;font-weight:800;color:var(--md);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.photo-grid{display:flex;flex-wrap:wrap;gap:8px}
.photo-thumb{width:72px;height:72px;border-radius:10px;overflow:hidden;position:relative;border:1.5px solid var(--ln)}
.photo-thumb img{width:100%;height:100%;object-fit:cover}
.photo-thumb-del{position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;
  background:rgba(0,0,0,.6);color:#fff;border:none;font-size:12px;cursor:pointer;
  display:flex;align-items:center;justify-content:center}
.photo-add-btn{width:72px;height:72px;border-radius:10px;border:2px dashed var(--ln);
  background:var(--lnlt);cursor:pointer;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:2px;color:var(--lt)}
.photo-add-btn:active{border-color:var(--or);color:var(--or)}
.photo-add-icon{font-size:22px}
.photo-add-label{font-size:8px;font-weight:800;text-transform:uppercase}

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
.rbbar-continue{flex:1;padding:13px;background:var(--or);color:#fff;border:none;
  border-radius:13px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:14px;font-weight:900}
.rbbar-continue:disabled{background:#D1D5DB;cursor:not-allowed}

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

/* Uploading indicator */
.upload-bar{background:var(--blbg);border:1.5px solid var(--blbr);border-radius:12px;
  padding:10px 14px;margin:0 18px 12px;display:flex;align-items:center;gap:8px}
.upload-bar-text{font-size:12px;font-weight:800;color:var(--bl);flex:1}

@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.anim-up{animation:slideUp .25s cubic-bezier(.34,1.2,.64,1)}
@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.fade{animation:fadeUp .18s ease both}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner{display:inline-block;width:14px;height:14px;border:2px solid var(--blbr);border-top-color:var(--bl);border-radius:50%;animation:spin .6s linear infinite}

/* Empty state */
.empty{text-align:center;padding:48px 20px;color:#9CA3AF}
.empty-icon{font-size:44px;margin-bottom:12px}
.empty-title{font-size:14px;font-weight:800}
.empty-desc{font-size:12px;margin-top:6px}
`;

interface PoRow {
  po_id: string;
  vendor_id: string;
  vendor_name?: string | null;
  erp: any | null;
}
interface ReceiptLine { item_code: string; item_name?: string; uom?: string; qty: number; ordered?: number }
interface Vendor { name: string; supplier_name?: string }
interface SearchItem { item_code: string; item_name: string; uom?: string }

type Mode = 'landing' | 'po_select' | 'direct_vendor' | 'direct_items' | 'confirm';

const COLORS = ['#16A34A','#F97316','#EF4444','#0EA5E9','#8B5CF6','#1D4ED8','#DB2777'];
const getColor = (s: string) => COLORS[Math.abs((s||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % COLORS.length];
const n3 = (v: number) => parseFloat(Number(v).toFixed(3));
const inr = (n: number) => `\u20B9${Number(n).toLocaleString('en-IN', { maximumFractionDigits:0 })}`;

function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const items = [
    { icon: '\uD83C\uDFE0', label: 'Home',      path: '/store' },
    { icon: '\uD83D\uDCE6', label: 'Transfers', path: '/store/transfers' },
    { icon: '\uD83D\uDED2', label: 'Orders',    path: '/store/vendor-orders' },
    { icon: '\uD83D\uDCCB', label: 'Receipts',  path: '/store/purchase-receipts' },
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
  const router = useRouter();
  const token  = useAuthGuard('/store/login');

  // ── State ──
  const [mode, setMode] = useState<Mode>('landing');
  const [openPos, setOpenPos] = useState<PoRow[]>([]);
  const [fetchingPos, setFetchingPos] = useState(false);

  // PO mode
  const [selected, setSelected] = useState<PoRow | null>(null);

  // Direct mode
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [itemQuery, setItemQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Shared confirm state
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Photos — per-item photos keyed by item_code
  const [itemPhotos, setItemPhotos] = useState<Record<string, { file: File; preview: string }>>({});
  const [billPhoto, setBillPhoto] = useState<File | null>(null);
  const [billPreview, setBillPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activePhotoItem, setActivePhotoItem] = useState<string | null>(null);
  const itemPhotoRef = useRef<HTMLInputElement>(null);
  const billPhotoRef = useRef<HTMLInputElement>(null);

  // ── Data loading ──
  const loadOpenPos = () => {
    if (!token) return;
    setFetchingPos(true);
    apiRequest<PoRow[]>('/store/purchase-receipts/open-pos', 'GET', undefined, token)
      .then(d => { setOpenPos(d || []); setFetchingPos(false); })
      .catch(() => { setOpenPos([]); setFetchingPos(false); });
  };

  const loadVendors = () => {
    if (!token) return;
    apiRequest<{ suppliers: Vendor[] }>('/store/vendor-order/vendors', 'GET', undefined, token)
      .then(d => setVendors(d?.suppliers || []))
      .catch(() => setVendors([]));
  };

  useEffect(() => {
    if (mode === 'po_select') loadOpenPos();
    if (mode === 'direct_vendor') loadVendors();
  }, [mode, token]);

  // Item search with debounce
  useEffect(() => {
    if (mode !== 'direct_items' || !token || itemQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      apiRequest<SearchItem[]>(`/store/vendor-order/items?q=${encodeURIComponent(itemQuery)}`, 'GET', undefined, token)
        .then(d => { setSearchResults(d || []); setSearching(false); })
        .catch(() => { setSearchResults([]); setSearching(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [itemQuery, mode, token]);

  // PO selection -> populate lines
  useEffect(() => {
    if (!selected) return;
    const items = Array.isArray(selected.erp?.items) ? selected.erp.items : [];
    setLines(items.map((item: any) => {
      const ordered   = Number(item.qty || 0);
      const received  = Number(item.received_qty || 0);
      const remaining = Math.max(0, ordered - received);
      return { item_code: item.item_code, item_name: item.item_name, uom: item.uom, qty: remaining > 0 ? remaining : ordered, ordered };
    }));
    setMode('confirm');
  }, [selected]);

  // ── Computed ──
  const grandTotal = useMemo(() => lines.reduce((s, l) => s + l.qty, 0), [lines]);
  const vendorId   = selected?.vendor_id || selectedVendor?.name || '';
  const vendorName = selected?.vendor_name || selectedVendor?.supplier_name || selectedVendor?.name || '';
  const poId       = selected?.po_id;
  const filteredVendors = useMemo(() => {
    if (!vendorSearch.trim()) return vendors;
    const q = vendorSearch.toLowerCase();
    return vendors.filter(v =>
      (v.supplier_name || v.name || '').toLowerCase().includes(q)
    );
  }, [vendors, vendorSearch]);

  // ── Helpers ──
  const setLineQty = (code: string, qty: number) =>
    setLines(prev => prev.map(l => l.item_code === code ? { ...l, qty: Math.max(0, n3(qty)) } : l));

  const removeLine = (code: string) =>
    setLines(prev => prev.filter(l => l.item_code !== code));

  const addItem = (item: SearchItem) => {
    if (lines.some(l => l.item_code === item.item_code)) return;
    setLines(prev => [...prev, { item_code: item.item_code, item_name: item.item_name, uom: item.uom || 'Nos', qty: 1 }]);
  };

  const handleItemPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePhotoItem) return;
    e.target.value = '';
    const compressed = await compressImage(file);
    const code = activePhotoItem;
    setItemPhotos(prev => {
      if (prev[code]?.preview) URL.revokeObjectURL(prev[code].preview);
      return { ...prev, [code]: { file: compressed, preview: URL.createObjectURL(compressed) } };
    });
    setActivePhotoItem(null);
  };

  const removeItemPhoto = (code: string) => {
    setItemPhotos(prev => {
      if (prev[code]?.preview) URL.revokeObjectURL(prev[code].preview);
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const handleBillPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const compressed = await compressImage(file);
    if (billPreview) URL.revokeObjectURL(billPreview);
    setBillPhoto(compressed);
    setBillPreview(URL.createObjectURL(compressed));
  };

  const removeBillPhoto = () => {
    if (billPreview) URL.revokeObjectURL(billPreview);
    setBillPhoto(null);
    setBillPreview(null);
  };

  const resetAll = () => {
    setMode('landing');
    setSelected(null);
    setSelectedVendor(null);
    setLines([]);
    setItemQuery('');
    setSearchResults([]);
    setError(null);
    Object.values(itemPhotos).forEach(p => URL.revokeObjectURL(p.preview));
    if (billPreview) URL.revokeObjectURL(billPreview);
    setItemPhotos({});
    setBillPhoto(null);
    setBillPreview(null);
    setUploading(false);
  };

  const goBack = () => {
    if (mode === 'confirm' && !selected) { setMode('direct_items'); return; }
    if (mode === 'confirm') { setSelected(null); setLines([]); setMode('po_select'); return; }
    if (mode === 'direct_items') { setMode('direct_vendor'); return; }
    if (mode === 'po_select' || mode === 'direct_vendor') { resetAll(); return; }
    router.push('/store');
  };

  const handleSubmit = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ receipt_id: string }>(
        '/store/purchase-receipts/create', 'POST',
        {
          ...(poId ? { po_id: poId } : {}),
          vendor_id: vendorId,
          vendor_name: vendorName,
          lines: lines.map(l => ({ item_code: l.item_code, item_name: l.item_name, uom: l.uom, qty: Number(l.qty || 0) }))
        },
        token
      );
      setSuccessId(res?.receipt_id || 'Created');

      // Upload photos with meaningful filenames so they're identifiable in ERPNext
      const namedFiles: File[] = [];
      for (const [code, p] of Object.entries(itemPhotos)) {
        const safeName = code.replace(/[\/\\]/g, '_');
        namedFiles.push(new File([p.file], `${safeName}_photo.jpg`, { type: 'image/jpeg' }));
      }
      if (billPhoto) {
        namedFiles.push(new File([billPhoto], 'bill_invoice.jpg', { type: 'image/jpeg' }));
      }
      if (namedFiles.length > 0 && res?.receipt_id) {
        setUploading(true);
        apiUploadFiles(`/store/purchase-receipts/${res.receipt_id}/upload`, namedFiles, token)
          .catch(() => {})
          .finally(() => setUploading(false));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create receipt. Please try again.');
    } finally { setLoading(false); }
  };

  // ── Header config ──
  const headerTitle = (() => {
    if (mode === 'po_select') return 'Select Purchase Order';
    if (mode === 'direct_vendor') return 'Select Supplier';
    if (mode === 'direct_items') return 'Add Items';
    if (mode === 'confirm') return 'Confirm Receipt';
    return 'Purchase Receipts';
  })();

  const headerSub = (() => {
    if (mode === 'po_select') return `${openPos.length} open POs`;
    if (mode === 'direct_vendor') return `${vendors.length} suppliers`;
    if (mode === 'direct_items') return `${vendorName} \u00B7 ${lines.length} items`;
    if (mode === 'confirm') return `${vendorName} \u00B7 ${lines.length} items`;
    return 'Receive goods into warehouse';
  })();

  if (!token) return null;

  return (
    <div className="rpage">
      <style>{CSS}</style>

      {/* ── Success overlay ── */}
      {successId && (
        <div className="success-overlay">
          <div className="success-sheet anim-up">
            <div className="success-handle"/>
            <div className="success-icon">{'\uD83D\uDCCB'}</div>
            <div className="success-title">Receipt Created!</div>
            <div className="success-sub">Purchase receipt submitted to ERPNext</div>
            {uploading && (
              <div className="upload-bar">
                <span className="spinner"/>
                <span className="upload-bar-text">Uploading photos...</span>
              </div>
            )}
            <div className="success-id-box">
              <div style={{ fontSize:11, fontWeight:800, color:'var(--lt)', marginBottom:4 }}>Receipt ID</div>
              <div className="success-id">{successId}</div>
            </div>
            <button className="success-done-btn" style={{ width:'calc(100% - 36px)' }}
              onClick={() => { setSuccessId(null); resetAll(); }}>
              {'\u2713'} Done — Receive Another
            </button>
            <button className="success-more-btn" style={{ width:'calc(100% - 36px)' }}
              onClick={() => router.push('/store')}>
              Go to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="rhdr">
        <div className="rhdr-row">
          <button className="rhdr-back" onClick={goBack}>{'\u2190'}</button>
          <div>
            <div className="rhdr-title">{headerTitle}</div>
            <div className="rhdr-sub">{headerSub}</div>
          </div>
        </div>
      </div>

      <div className="rbody">

        {/* ══════════ LANDING ══════════ */}
        {mode === 'landing' && (
          <div className="mode-cards fade">
            <div className="mode-card" onClick={() => setMode('po_select')}>
              <div className="mode-card-icon">{'\uD83D\uDCE5'}</div>
              <div>
                <div className="mode-card-title">Receive Against PO</div>
                <div className="mode-card-desc">Select an open purchase order to receive items</div>
              </div>
              <div className="mode-card-arrow">{'\u2192'}</div>
            </div>
            <div className="mode-card" onClick={() => setMode('direct_vendor')}>
              <div className="mode-card-icon">{'\uD83D\uDCDD'}</div>
              <div>
                <div className="mode-card-title">Direct Receipt (No PO)</div>
                <div className="mode-card-desc">Create a receipt without a purchase order</div>
              </div>
              <div className="mode-card-arrow">{'\u2192'}</div>
            </div>
          </div>
        )}

        {/* ══════════ PO SELECTION ══════════ */}
        {mode === 'po_select' && (
          <>
            <div className="sec-title">Open Purchase Orders</div>
            {fetchingPos && (
              <div className="empty">
                <div className="empty-icon">{'\u23F3'}</div>
                <div className="empty-title">Loading open POs...</div>
              </div>
            )}
            {!fetchingPos && openPos.length === 0 && (
              <div className="empty">
                <div className="empty-icon">{'\uD83D\uDCED'}</div>
                <div className="empty-title">No open purchase orders</div>
                <div className="empty-desc">Create a vendor order first to receive items</div>
              </div>
            )}
            {openPos.map(po => {
              const color = getColor(po.vendor_id);
              const items = Array.isArray(po.erp?.items) ? po.erp.items : [];
              const total = po.erp?.grand_total ? inr(po.erp.grand_total) : `${items.length} items`;
              return (
                <div key={po.po_id} className="po-card fade" onClick={() => setSelected(po)}>
                  <div className="po-hdr" style={{ background: color }}>
                    <div className="po-hdr-dot"/>
                    <div className="po-hdr-vendor">{po.vendor_name || po.vendor_id}</div>
                    <div className="po-hdr-id">{po.po_id}</div>
                  </div>
                  <div className="po-body">
                    <div className="po-items-count">{items.length} items {'\u00B7'} {total}</div>
                    <div className="po-arrow">Receive {'\u2192'}</div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ══════════ DIRECT: VENDOR SELECTION ══════════ */}
        {mode === 'direct_vendor' && (
          <>
            <div className="sec-title">Select Supplier</div>
            <div className="vendor-search">
              <span className="vendor-search-icon">{'\uD83D\uDD0D'}</span>
              <input placeholder="Search suppliers..." value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)} autoFocus />
            </div>
            {filteredVendors.length === 0 && (
              <div className="empty">
                <div className="empty-icon">{'\uD83D\uDCED'}</div>
                <div className="empty-title">No suppliers found</div>
              </div>
            )}
            {filteredVendors.map(v => (
              <div key={v.name} className="vendor-row fade"
                onClick={() => { setSelectedVendor(v); setMode('direct_items'); }}>
                <div className="vendor-dot" style={{ background: getColor(v.name) }}/>
                <div className="vendor-name">{v.supplier_name || v.name}</div>
                <div className="vendor-arrow">{'\u203A'}</div>
              </div>
            ))}
          </>
        )}

        {/* ══════════ DIRECT: ITEM SEARCH & ADD ══════════ */}
        {mode === 'direct_items' && (
          <>
            <div className="sec-title">Search & Add Items</div>
            <div className="item-search">
              <span style={{ fontSize:16, color:'var(--lt)' }}>{'\uD83D\uDD0D'}</span>
              <input placeholder="Search items..." value={itemQuery}
                onChange={e => setItemQuery(e.target.value)} autoFocus />
              {searching && <span className="spinner"/>}
            </div>

            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(item => {
                  const added = lines.some(l => l.item_code === item.item_code);
                  return (
                    <div key={item.item_code} className="search-item" onClick={() => !added && addItem(item)}>
                      <div className="search-item-info">
                        <div className="search-item-name">{item.item_name}</div>
                        <div className="search-item-code">{item.item_code} {'\u00B7'} {item.uom}</div>
                      </div>
                      {!added && <button className="search-item-add">+</button>}
                      {added && <span style={{ fontSize:11, fontWeight:800, color:'var(--gn)' }}>{'\u2713'} Added</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {lines.length > 0 && (
              <>
                <div className="sec-title">Added Items ({lines.length})</div>
                {lines.map(line => (
                  <div key={line.item_code} className="line-card fade">
                    <div className="lc-hdr">
                      <div className="lc-name">{line.item_name || line.item_code}</div>
                      <button className="lc-remove" onClick={() => removeLine(line.item_code)}>{'\u2715'}</button>
                    </div>
                    <div className="lc-body">
                      <span className="qty-unit" style={{ fontSize:11 }}>{line.uom}</span>
                      <div className="qty-ctrl">
                        <button className="qty-btn"
                          onPointerDown={e => { e.preventDefault(); setLineQty(line.item_code, line.qty - 0.5); }}>{'\u2212'}</button>
                        <input className="qty-inp" type="number" inputMode="decimal" step="any"
                          value={line.qty}
                          onChange={e => setLineQty(line.item_code, parseFloat(e.target.value) || 0)}
                          onFocus={e => e.target.select()} />
                        <button className="qty-btn add"
                          onPointerDown={e => { e.preventDefault(); setLineQty(line.item_code, line.qty + 0.5); }}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ══════════ CONFIRM RECEIPT ══════════ */}
        {mode === 'confirm' && (
          <>
            {/* Vendor summary card */}
            <div className="receipt-hdr fade">
              <div className="rh-vendor" style={{ background: getColor(vendorId) }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:'rgba(255,255,255,.4)', flexShrink:0 }}/>
                <div className="rh-vendor-name">{vendorName || vendorId}</div>
                {poId && <div className="rh-vendor-po">{poId}</div>}
                {!poId && <div className="rh-vendor-po">DIRECT</div>}
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
                {selected?.erp?.grand_total && (
                  <div className="rh-stat">
                    <span className="rh-stat-val" style={{ fontSize:14 }}>{inr(selected.erp.grand_total)}</span>
                    <span className="rh-stat-lbl">Order Value</span>
                  </div>
                )}
              </div>
            </div>

            {/* Line items with per-item photo */}
            {lines.map(line => {
              const photo = itemPhotos[line.item_code];
              return (
                <div key={line.item_code} className="line-card fade">
                  <div className="lc-hdr">
                    <div className="lc-name">{line.item_name || line.item_code}</div>
                    <div className="lc-code">{line.item_code}</div>
                  </div>
                  <div className="lc-body">
                    {line.ordered != null && (
                      <div className="lc-ordered">
                        Ordered: <span>{line.ordered} {line.uom}</span>
                      </div>
                    )}
                    {line.ordered == null && (
                      <span className="qty-unit" style={{ fontSize:11 }}>{line.uom}</span>
                    )}
                    <div className="qty-ctrl">
                      <button className="qty-btn"
                        onPointerDown={e => { e.preventDefault(); setLineQty(line.item_code, line.qty - 0.5); }}>{'\u2212'}</button>
                      <input className="qty-inp" type="number" inputMode="decimal" step="any"
                        value={line.qty}
                        onChange={e => setLineQty(line.item_code, parseFloat(e.target.value) || 0)}
                        onFocus={e => e.target.select()} />
                      <button className="qty-btn add"
                        onPointerDown={e => { e.preventDefault(); setLineQty(line.item_code, line.qty + 0.5); }}>+</button>
                    </div>
                    <span className="qty-unit">{line.uom}</span>
                  </div>
                  <div className="lc-photo">
                    {photo ? (
                      <div className="lc-photo-row">
                        <div className="photo-thumb">
                          <img src={photo.preview} alt={line.item_name || line.item_code} />
                          <button className="photo-thumb-del" onClick={() => removeItemPhoto(line.item_code)}>{'\u2715'}</button>
                        </div>
                        <button className="lc-photo-retake" onClick={() => { setActivePhotoItem(line.item_code); itemPhotoRef.current?.click(); }}>
                          {'\uD83D\uDCF7'} Retake
                        </button>
                      </div>
                    ) : (
                      <button className="lc-photo-btn" onClick={() => { setActivePhotoItem(line.item_code); itemPhotoRef.current?.click(); }}>
                        {'\uD83D\uDCF7'} Take Photo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <input ref={itemPhotoRef} type="file" accept="image/*" capture="environment"
              style={{ display:'none' }} onChange={handleItemPhoto} />

            {/* ── Bill / Invoice Photo ── */}
            <div className="photo-section fade">
              <div className="photo-title">
                {'\uD83E\uDDFE'} Bill / Invoice Photo
              </div>
              <div className="photo-grid">
                {billPreview && (
                  <div className="photo-thumb">
                    <img src={billPreview} alt="Bill" />
                    <button className="photo-thumb-del" onClick={removeBillPhoto}>{'\u2715'}</button>
                  </div>
                )}
                {!billPreview && (
                  <button className="photo-add-btn" onClick={() => billPhotoRef.current?.click()}>
                    <span className="photo-add-icon">{'\uD83E\uDDFE'}</span>
                    <span className="photo-add-label">Capture</span>
                  </button>
                )}
              </div>
              <input ref={billPhotoRef} type="file" accept="image/*" capture="environment"
                style={{ display:'none' }} onChange={handleBillPhoto} />
            </div>
          </>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ margin:'0 12px 12px', padding:'11px 14px', background:'var(--rdbg)',
          border:'1.5px solid #FECACA', borderRadius:12, fontSize:13, fontWeight:700,
          color:'var(--rd)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ flex:1 }}>{'\u26A0\uFE0F'} {error}</span>
          <button onClick={() => setError(null)} style={{ background:'none', border:'none',
            cursor:'pointer', color:'var(--rd)', fontSize:16, lineHeight:1 }}>{'\u2715'}</button>
        </div>
      )}

      {/* ── Bottom nav (landing only) ── */}
      {mode === 'landing' && <BottomNav/>}

      {/* ── Bottom bar: direct_items continue ── */}
      {mode === 'direct_items' && (
        <div className="rbbar">
          <div className="rbbar-inner">
            <button className="rbbar-cancel" onClick={goBack}>{'\u2190'} Back</button>
            <button className="rbbar-continue" disabled={lines.length === 0}
              onClick={() => setMode('confirm')}>
              Continue {'\u2014'} {lines.length} Items {'\u2192'}
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom bar: confirm receipt ── */}
      {mode === 'confirm' && (
        <div className="rbbar">
          <div className="rbbar-inner">
            <button className="rbbar-cancel" onClick={goBack}>{'\u2190'} Back</button>
            <button className="rbbar-confirm" disabled={loading || lines.length === 0} onClick={handleSubmit}>
              {loading ? '\u23F3 Creating...' : `\u2713 Confirm Receipt \u2014 ${lines.length} Items`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
