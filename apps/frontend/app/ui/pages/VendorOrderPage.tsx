'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiRequest } from '../../../lib/api';
import { useAuthGuard } from '../../../lib/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Vendor {
  id:          string;
  displayName: string;
  phone:       string;
  color:       string;
}

interface RequestSource {
  requisitionId: number;
  warehouse: string;
  requestedDate: string;
  remainingQty: number;
}

interface CatalogItem {
  itemCode:     string;
  name:         string;
  unit:         string;
  stockQty:     number;
  neededQty:    number;
  totalRequestedQty: number;
  defaultOrderQty: number;
  shortfall:    number;
  shortfallQty: number;
  autoVendorId: string;
  lastRate:     number;
  lastPoDate:   string;
  allVendors:   { vendorId: string; rate: number; label: string }[];
  requestSources: RequestSource[];
}

interface CartLine {
  itemCode:     string;
  name:         string;
  unit:         string;
  qty:          number;
  rate:         number;
  vendorId:     string;
  isManual:     boolean;
  autoVendorId: string;
  allVendors:   { vendorId: string; rate: number; label: string }[];
  requestSources: RequestSource[];
  requestedTotalQty: number;
}

interface PastOrder {
  id:           string;
  dbId?:        number;
  vendorId:     string;
  lines:        CartLine[];
  status:       'draft' | 'sent' | 'po_created' | 'failed';
  createdAt:    string;
  poId?:        string;
  errorMessage?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const palette  = ['#16A34A','#F97316','#EF4444','#0EA5E9','#8B5CF6','#1D4ED8','#DB2777','#0891B2'];
const CART_KEY = 'store_vendor_cart_v1';
const TODAY_STR     = new Date().toISOString().split('T')[0];
const DELIVERY_DATE = new Date(Date.now() + 86400000).toISOString().split('T')[0];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const n3  = (v: number) => parseFloat(Number(v).toFixed(3));
const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtShort = (d: string) => { const [,m,day] = d.split('-'); return `${day}/${m}`; };

function mapRequestSource(source: any): RequestSource {
  return {
    requisitionId: Number(source?.requisition_id || 0),
    warehouse: String(source?.warehouse || ''),
    requestedDate: String(source?.requested_date || ''),
    remainingQty: Number(source?.remaining_qty || 0),
  };
}

function mapApiItem(item: any): CatalogItem {
  return {
    itemCode:     item.item_code,
    name:         item.item_name || item.item_code,
    unit:         item.uom || '',
    stockQty:     Number(item.stock_qty  || 0),
    neededQty:    Number(item.needed_qty || 0),
    totalRequestedQty: Number(item.total_requested_qty || item.needed_qty || 0),
    defaultOrderQty: Number(item.default_order_qty || item.total_requested_qty || item.needed_qty || 0),
    shortfall:    Number(item.shortfall  || 0),
    shortfallQty: Number(item.shortfall_qty || item.shortfall || 0),
    autoVendorId: item.vendor_id || '',
    lastRate:     Number(item.price      || 0),
    lastPoDate:   item.last_po_date || '',
    allVendors:   (item.all_vendors || []).map((v: any) => ({
      vendorId: v.vendorId,
      rate:     Number(v.rate || 0),
      label:    v.label,
    })),
    requestSources: (item.request_sources || []).map((source: any) => mapRequestSource(source)),
  };
}

function summarizeSources(sources: RequestSource[]) {
  const grouped = new Map<string, number>();
  sources.forEach(source => {
    const key = source.warehouse || 'Unknown';
    grouped.set(key, Number(grouped.get(key) || 0) + Number(source.remainingQty || 0));
  });
  return Array.from(grouped.entries())
    .map(([warehouse, qty]) => ({ warehouse, qty: n3(qty) }))
    .sort((a, b) => a.warehouse.localeCompare(b.warehouse));
}

function fallbackVendor(id: string, idx = 0): Vendor {
  return { id, displayName: id, phone: '', color: palette[idx % palette.length] };
}

function getV(vendorMap: Map<string, Vendor>, id: string): Vendor {
  return vendorMap.get(id) ?? fallbackVendor(id);
}

function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const items = [
    { icon: '🏠', label: 'Home', path: '/store' },
    { icon: '📦', label: 'Transfers', path: '/store/transfers' },
    { icon: '🛒', label: 'Orders', path: '/store/vendor-orders' },
    { icon: '📋', label: 'Receipts', path: '/store/purchase-receipts' },
  ];

  return (
    <nav className="bnav">
      {items.map((item) => (
        <button
          key={item.path}
          className={`bnav-item ${pathname === item.path ? 'active' : ''}`}
          onClick={() => router.push(item.path)}
        >
          <span className="bnav-icon">{item.icon}</span>
          <span className="bnav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function buildWaMessage(vendor: Vendor, lines: CartLine[], poId?: string): string {
  const total = lines.reduce((s, l) => s + l.qty * l.rate, 0);
  return [
    `*Purchase Order — Food Studio*`,
    poId ? `PO No: *${poId}*` : `Draft Order`,
    `Vendor: *${vendor.displayName}*`,
    `Date: ${fmt(TODAY_STR)}`,
    ``,
    `*Items:*`,
    ...lines.map(l => `• ${l.name}: *${l.qty} ${l.unit}* @ ${inr(l.rate)} = *${inr(l.qty * l.rate)}*`),
    ``,
    `*Total: ${inr(total)}*`,
    `Delivery requested: ${fmt(DELIVERY_DATE)}`,
    ``,
    `Please confirm order. Thank you 🙏`,
  ].join('\n');
}

function mapHistoryToOrders(history: any[]): PastOrder[] {
  // ERP-first: history is a flat list of PO records with erp_items from ERPNext
  return history.map((record: any) => ({
    id:           record.po_id ?? `ORD-${record.id}`,
    dbId:         record.id ?? undefined,
    vendorId:     record.vendor_id || '',
    lines:        (record.erp_items || []).map((item: any) => ({
      itemCode:     item.item_code,
      name:         item.item_name || item.item_code,
      unit:         item.uom || '',
      qty:          Number(item.qty  || 0),
      rate:         Number(item.rate || 0),
      vendorId:     record.vendor_id || '',
      isManual:     !(item.request_sources || []).length,
      autoVendorId: record.vendor_id || '',
      allVendors:   [],
      requestSources: (item.request_sources || []).map((source: any) => mapRequestSource(source)),
      requestedTotalQty: Number(item.requested_total_qty || 0),
    })),
    status:       record.status === 'po_created' ? 'po_created' : record.status === 'failed' ? 'failed' : 'draft',
    createdAt:    record.created_at,
    poId:         record.status === 'po_created' ? record.po_id : undefined,
    errorMessage: record.error_message ?? undefined,
  }));
}

// ─── CSS (exact from design reference) ───────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Mono:wght@500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --or:#F97316;--orl:#FFF7ED;--dk:#111827;--md:#6B7280;--lt:#9CA3AF;
  --bg:#F3F4F6;--wh:#fff;
  --gn:#16A34A;--gnbg:#F0FDF4;--gnbr:#BBF7D0;
  --rd:#DC2626;--rdbg:#FEF2F2;--rdbr:#FECACA;
  --am:#D97706;--ambg:#FFFBEB;--ambr:#FDE68A;
  --bl:#1D4ED8;--blbg:#EFF6FF;--blbr:#BFDBFE;
  --ln:#E5E7EB;--lnlt:#F3F4F6;
}
body{font-family:'Nunito',sans-serif;background:var(--bg);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}

.vpage{max-width:480px;margin:0 auto;min-height:100vh;background:var(--bg);padding-bottom:72px}

.vhdr{background:var(--dk);position:sticky;top:0;z-index:60}
.vhdr-top{padding:14px 16px 10px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.vhdr-back{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.1);border:none;
  color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.vhdr-back:active{background:rgba(255,255,255,.2)}
.vhdr-title{font-size:16px;font-weight:900;color:#fff}
.vhdr-sub{font-size:11px;color:#6B7280;margin-top:2px;font-weight:700}
.vhdr-review-btn{background:var(--or);color:#fff;border:none;border-radius:9px;
  padding:8px 13px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;
  display:flex;align-items:center;gap:6px;flex-shrink:0}
.vhdr-review-badge{background:rgba(255,255,255,.28);padding:1px 7px;border-radius:10px;
  font-family:'DM Mono',monospace;font-size:10px;font-weight:700}

.vsumbar{display:flex;padding:8px 0 12px;border-top:1px solid rgba(255,255,255,.07)}
.vsb{flex:1;text-align:center;position:relative}
.vsb+.vsb::before{content:'';position:absolute;left:0;top:15%;bottom:15%;width:1px;background:rgba(255,255,255,.1)}
.vsbn{font-family:'DM Mono',monospace;font-size:17px;font-weight:700;display:block;line-height:1}
.vsbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#6B7280;display:block;margin-top:3px}
.vsb.r .vsbn{color:#F87171}.vsb.o .vsbn{color:#FB923C}.vsb.g .vsbn{color:#4ADE80}.vsb.w .vsbn{color:#fff}

.vtabs{background:var(--wh);display:flex;border-bottom:2px solid var(--ln);position:sticky;top:104px;z-index:50}
.vtab{flex:1;padding:11px 6px;text-align:center;border:none;background:none;
  font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:var(--lt);
  cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .15s}
.vtab.on{color:var(--dk);border-bottom-color:var(--dk)}
.vtabcnt{display:inline-block;background:var(--or);color:#fff;font-size:9px;font-weight:800;
  padding:1px 5px;border-radius:10px;margin-left:4px;font-family:'DM Mono',monospace}
.vtabcnt.muted{background:var(--ln);color:var(--md)}
.vtabcnt.gn{background:var(--gn)}

.vbody{padding:12px 12px 164px}
.vsection-title{font-size:10px;font-weight:800;color:var(--lt);text-transform:uppercase;
  letter-spacing:.07em;padding:10px 2px 7px}

.vendor-group{margin-bottom:16px}
.vg-header{display:flex;align-items:center;gap:10px;padding:11px 14px;
  border-radius:14px 14px 0 0;color:#fff}
.vg-dot{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.45);flex-shrink:0}
.vg-name{flex:1;font-size:13px;font-weight:900}
.vg-phone{font-size:11px;font-weight:700;opacity:.7;font-family:'DM Mono',monospace}
.vg-total{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;
  background:rgba(255,255,255,.2);padding:3px 10px;border-radius:20px;flex-shrink:0}
.vg-items{border-radius:0 0 14px 14px;overflow:visible;border:1.5px solid var(--ln);border-top:none}

.shortage-row{background:var(--wh);display:flex;align-items:center;gap:10px;
  padding:11px 13px;border-bottom:1px solid var(--lnlt);cursor:pointer}
.shortage-row:last-child{border-bottom:none}
.shortage-row:active{background:#FFFBEB}
.shortage-row.added{background:var(--orl)}
.sr-info{flex:1;min-width:0}
.sr-name{font-size:13px;font-weight:800;color:var(--dk);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sr-chips{display:flex;align-items:center;gap:5px;margin-top:4px;flex-wrap:wrap}
.chip{font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px}
.chip.short{background:var(--rdbg);color:var(--rd)}
.chip.stock{background:#F1F5F9;color:#475569}
.chip.price{background:var(--gnbg);color:var(--gn)}
.chip.date{background:var(--blbg);color:var(--bl)}
.chip.manual{background:#F5F3FF;color:#7C3AED}
.chip.auto{background:var(--ambg);color:var(--am)}
.sr-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
.add-btn{width:34px;height:34px;border-radius:9px;border:none;cursor:pointer;
  font-size:22px;font-weight:900;display:flex;align-items:center;justify-content:center;transition:all .15s}
.add-btn.add{background:var(--orl);color:var(--or);border:1.5px solid #FED7AA}
.add-btn.add:active{background:var(--or);color:#fff}
.add-btn.added{background:var(--gnbg);color:var(--gn);border:1.5px solid var(--gnbr)}

.search-wrap{background:var(--wh);border-radius:14px;padding:13px;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:12px}
.search-label{font-size:11px;font-weight:800;color:var(--lt);text-transform:uppercase;
  letter-spacing:.06em;margin-bottom:9px;display:block}
.search-field{display:flex;align-items:center;gap:8px;border:1.5px solid var(--ln);
  border-radius:11px;padding:0 13px;height:44px;background:var(--bg)}
.search-field:focus-within{border-color:var(--or);background:var(--wh)}
.search-inp{flex:1;border:none;background:transparent;font-family:'Nunito',sans-serif;
  font-size:14px;font-weight:700;color:var(--dk);height:44px}
.search-inp:focus{outline:none}
.search-inp::placeholder{color:var(--lt)}
.search-clear{background:none;border:none;cursor:pointer;color:var(--lt);font-size:18px;padding:0}
.search-results{margin-top:9px;border:1.5px solid var(--ln);border-radius:11px;overflow:visible}

.search-result-row{display:flex;flex-direction:column;gap:0;padding:11px 13px;
  background:var(--wh);border-bottom:1px solid var(--lnlt);cursor:default}
.search-result-row:last-child{border-bottom:none}
.search-result-row.in-cart{background:var(--orl)}
.srr-info{flex:1;min-width:0}
.srr-name{font-size:13px;font-weight:800;color:var(--dk)}
.srr-sub{font-size:10px;font-weight:700;color:var(--lt);margin-top:3px;
  display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.srr-add-btn{width:32px;height:32px;border-radius:8px;background:var(--or);
  color:#fff;border:none;cursor:pointer;font-size:22px;font-weight:900;
  display:flex;align-items:center;justify-content:center;flex-shrink:0}
.srr-add-btn.added{background:var(--gn)}

.vendor-picker{display:flex;flex-direction:column;gap:0;margin-top:7px;
  border:1.5px solid var(--ln);border-radius:9px;overflow:hidden}
.vp-row{display:flex;align-items:center;gap:8px;padding:8px 11px;
  background:var(--wh);border-bottom:1px solid var(--lnlt);cursor:pointer}
.vp-row:last-child{border-bottom:none}
.vp-row:active{background:#FAFAFA}
.vp-row.selected{background:var(--orl)}
.vp-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.vp-label{flex:1;font-size:12px;font-weight:800;color:var(--dk)}
.vp-price{font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--md)}
.vp-check{color:var(--gn);font-size:14px;font-weight:900;flex-shrink:0}

.cart-vendor-block{background:var(--wh);border-radius:14px;overflow:visible;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:12px}
.cvb-header{padding:12px 14px;display:flex;align-items:center;gap:10px;color:#fff}
.cvb-name{flex:1;font-size:13px;font-weight:900}
.cvb-phone{font-size:11px;font-weight:700;opacity:.75;font-family:'DM Mono',monospace}
.cvb-total{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;
  background:rgba(255,255,255,.2);padding:3px 10px;border-radius:20px}

.cart-item-row{display:flex;align-items:center;gap:9px;padding:10px 14px;
  border-bottom:1px solid var(--lnlt)}
.cart-item-row:last-child{border-bottom:none}
.cir-info{flex:1;min-width:0}
.cir-name{font-size:13px;font-weight:800;color:var(--dk);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cir-price{font-size:11px;font-weight:700;color:var(--lt);margin-top:2px;
  display:flex;align-items:center;gap:5px;flex-wrap:wrap}

.vchange-btn{font-size:9px;font-weight:800;padding:2px 7px;border-radius:5px;
  background:#F1F5F9;color:#475569;border:1px solid var(--ln);cursor:pointer;
  font-family:'Nunito',sans-serif}
.vchange-btn:hover{background:var(--orl);color:var(--or);border-color:#FED7AA}

.qty-ctrl{display:flex;align-items:center;border:1.5px solid var(--ln);
  border-radius:10px;overflow:hidden;flex-shrink:0;height:38px}
.qty-btn{width:34px;height:38px;min-width:34px;border:none;cursor:pointer;
  font-size:20px;font-weight:900;background:var(--bg);color:var(--dk);
  display:flex;align-items:center;justify-content:center}
.qty-btn.add{background:var(--or);color:#fff}
.qty-btn:active{filter:brightness(.9)}
.qty-inp{width:46px;border:none;background:transparent;text-align:center;
  font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:var(--dk);
  height:38px;padding:0}
.qty-inp:focus{outline:none}
.qty-inp::-webkit-inner-spin-button{-webkit-appearance:none}
.qty-unit{font-size:10px;font-weight:800;color:var(--lt);width:26px;margin-left:4px;flex-shrink:0}
.qty-val{font-family:'DM Mono',monospace;font-size:12px;font-weight:700;
  color:var(--gn);flex-shrink:0;width:58px;text-align:right}
.remove-btn{width:28px;height:28px;border-radius:6px;background:var(--rdbg);
  color:var(--rd);border:none;cursor:pointer;font-size:14px;
  display:flex;align-items:center;justify-content:center;flex-shrink:0}

.cart-footer{padding:10px 14px;background:#F8FAFC;border-top:1px solid var(--ln);
  display:flex;justify-content:space-between;align-items:center}
.cart-footer-label{font-size:12px;font-weight:800;color:var(--md)}
.cart-footer-total{font-family:'DM Mono',monospace;font-size:16px;font-weight:700;color:var(--dk)}

.grand-total-bar{background:var(--dk);border-radius:13px;padding:13px 16px;
  display:flex;justify-content:space-between;align-items:center}
.gt-label{font-size:13px;font-weight:900;color:#9CA3AF}
.gt-value{font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:#fff}

.hist-card{background:var(--wh);border-radius:14px;overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:10px}
.hc-top{padding:12px 14px;display:flex;align-items:center;gap:10px}
.hc-info{flex:1}
.hc-id{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:var(--dk)}
.hc-meta{font-size:11px;color:var(--lt);font-weight:700;margin-top:2px}
.hc-badge{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:800}
.hc-badge.draft{background:#F1F5F9;color:#475569}
.hc-badge.sent{background:var(--gnbg);color:var(--gn)}
.hc-badge.po{background:var(--blbg);color:var(--bl)}
.hc-badge.failed{background:var(--rdbg);color:var(--rd)}
.hc-actions{padding:0 14px 12px;display:flex;gap:7px}
.hc-act{flex:1;padding:9px 8px;border-radius:9px;border:1.5px solid var(--ln);
  background:var(--bg);font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;
  cursor:pointer;text-align:center;color:var(--md)}
.hc-act.wa{background:#25D366;color:#fff;border-color:#25D366}
.hc-act.po{background:var(--blbg);color:var(--bl);border-color:var(--blbr)}
.hc-act:active{filter:brightness(.92)}

.sr-controls{display:flex;align-items:center;gap:6px;margin-top:7px;flex-wrap:wrap}
.sr-vendor-sel{flex:1;min-width:0;height:30px;border:1.5px solid var(--ln);border-radius:8px;
  background:#F9FAFB;font-family:'Nunito',sans-serif;font-size:11px;font-weight:800;
  color:var(--dk);padding:0 8px;cursor:pointer;outline:none;max-width:180px}
.sr-vendor-sel:focus{border-color:var(--or);background:#fff}
.sr-price-inp{width:80px;height:30px;border:1.5px solid var(--ln);border-radius:8px;
  background:#F9FAFB;font-family:'DM Mono',monospace;font-size:12px;font-weight:700;
  color:var(--dk);padding:0 8px;outline:none;text-align:right}
.sr-price-inp:focus{border-color:var(--or);background:#fff}
.sr-price-inp.noprice{border-color:var(--am);background:var(--ambg);color:var(--am)}
.sr-add-btn{height:30px;padding:0 14px;background:var(--or);color:#fff;border:none;
  border-radius:8px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:12px;font-weight:900;
  flex-shrink:0}
.sr-add-btn.added{background:var(--gn)}
.sr-add-btn:active{filter:brightness(.9)}
.other-search-wrap{width:100%;position:relative;margin-top:3px;z-index:200}
.other-search-inp{width:100%;height:30px;border:1.5px solid var(--or);border-radius:8px;
  background:#fff;font-family:'Nunito',sans-serif;font-size:11px;font-weight:700;
  color:var(--dk);padding:0 10px;outline:none}
.other-search-results{position:absolute;top:33px;left:0;right:0;z-index:200;
  background:#fff;border:1.5px solid var(--ln);border-radius:10px;
  box-shadow:0 4px 16px rgba(0,0,0,.12);max-height:180px;overflow-y:auto}
.osr-row{padding:9px 12px;cursor:pointer;font-size:12px;font-weight:800;color:var(--dk);
  border-bottom:1px solid var(--lnlt)}
.osr-row:last-child{border-bottom:none}
.osr-row:active{background:var(--orl)}

.bbar{position:fixed;bottom:72px;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;background:var(--wh);
  border-top:2px solid var(--ln);box-shadow:0 -4px 24px rgba(0,0,0,.1)}
.bbar-inner{padding:10px 12px 16px;display:flex;gap:9px}
.bbar-back{flex:0 0 auto;padding:13px 18px;background:var(--bg);color:var(--dk);
  border:2px solid var(--ln);border-radius:13px;cursor:pointer;
  font-family:'Nunito',sans-serif;font-size:14px;font-weight:800}
.bbar-primary{flex:1;padding:13px;background:var(--or);color:#fff;border:none;
  border-radius:13px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:14px;font-weight:900}
.bbar-primary:disabled{background:#D1D5DB;cursor:not-allowed}
.bbar-primary:not(:disabled):active{background:#EA6C04}

.bnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:480px;background:var(--wh);border-top:2px solid var(--ln);
  display:flex;z-index:60}
.bnav-item{flex:1;display:flex;flex-direction:column;align-items:center;padding:9px 4px 12px;
  cursor:pointer;border:none;background:none;-webkit-tap-highlight-color:transparent}
.bnav-icon{font-size:20px;line-height:1}
.bnav-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;
  margin-top:3px;color:var(--lt)}
.bnav-item.active .bnav-label{color:var(--or)}

.review-header{background:var(--dk);border-radius:14px;padding:16px;
  display:flex;align-items:center;gap:13px;margin-bottom:12px}
.rh-icon{font-size:34px}
.rh-info{flex:1}
.rh-title{font-size:15px;font-weight:900;color:#fff;margin-bottom:2px}
.rh-sub{font-size:11px;color:#6B7280;font-weight:700}
.rh-total-wrap{text-align:right}
.rh-total-label{font-size:9px;font-weight:800;text-transform:uppercase;
  letter-spacing:.05em;color:#6B7280;display:block;margin-bottom:2px}
.rh-total{font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:var(--or)}

.vendor-order-card{background:var(--wh);border-radius:14px;overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:12px}
.voc-header{padding:12px 14px;display:flex;align-items:center;gap:10px;color:#fff}
.voc-name{flex:1;font-size:14px;font-weight:900}
.voc-po-badge{font-size:10px;font-weight:800;background:rgba(255,255,255,.2);
  padding:2px 9px;border-radius:20px}
.voc-total{font-family:'DM Mono',monospace;font-size:13px;font-weight:700;
  background:rgba(255,255,255,.2);padding:3px 10px;border-radius:20px}
.voc-item{display:flex;align-items:center;gap:10px;padding:9px 14px;
  border-bottom:1px solid var(--lnlt)}
.voc-item:last-child{border-bottom:none}
.voc-item-name{flex:1;font-size:12px;font-weight:800;color:var(--dk)}
.voc-item-qty{font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--dk)}
.voc-item-val{font-family:'DM Mono',monospace;font-size:11px;font-weight:700;
  color:var(--gn);text-align:right;min-width:62px}
.voc-footer{padding:10px 14px;background:#F8FAFC;border-top:1px solid var(--ln);
  display:flex;justify-content:space-between}
.vof-left{font-size:11px;font-weight:800;color:var(--md)}
.vof-right{font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:var(--dk)}

.wa-btn{width:100%;padding:13px 16px;background:#25D366;color:#fff;border:none;
  border-radius:12px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:14px;
  font-weight:800;display:flex;align-items:center;justify-content:space-between}
.wa-btn:active{background:#1da851}
.wa-badge{background:rgba(255,255,255,.25);padding:3px 10px;border-radius:20px;
  font-family:'DM Mono',monospace;font-size:11px;font-weight:700}

.po-btn{width:100%;padding:14px 16px;background:var(--bl);color:#fff;border:none;
  border-radius:12px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:14px;
  font-weight:800;display:flex;align-items:center;justify-content:space-between}
.po-btn:disabled{background:#D1D5DB;cursor:not-allowed}
.po-btn:not(:disabled):active{background:#1E3A8A}
.po-badge{background:rgba(255,255,255,.2);padding:2px 10px;border-radius:20px;font-size:10px}

.success-overlay{position:fixed;inset:0;background:rgba(17,24,39,.75);z-index:100;
  display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .2s ease}
.success-sheet{background:var(--wh);width:100%;max-width:480px;
  border-radius:22px 22px 0 0;max-height:92vh;overflow-y:auto;
  animation:slideUp .25s cubic-bezier(.34,1.2,.64,1)}
.success-handle{width:40px;height:4px;background:#E5E7EB;border-radius:4px;margin:16px auto 12px}
.success-icon{font-size:56px;text-align:center;margin:8px 0 12px;
  animation:boing .4s cubic-bezier(.34,1.56,.64,1)}
.success-title{font-size:19px;font-weight:900;color:var(--dk);text-align:center;margin-bottom:5px}
.success-sub{font-size:12px;font-weight:700;color:var(--md);text-align:center;
  line-height:1.5;margin-bottom:16px}
.success-po-list{background:var(--blbg);border:1.5px solid var(--blbr);
  border-radius:12px;padding:12px 14px;margin:0 18px 16px}
.success-po-title{font-size:11px;font-weight:800;color:var(--bl);
  text-transform:uppercase;letter-spacing:.05em;margin-bottom:9px}
.success-po-row{display:flex;justify-content:space-between;align-items:center;
  padding:5px 0;border-bottom:1px solid var(--blbr)}
.success-po-row:last-child{border-bottom:none}
.success-po-vendor{font-size:12px;font-weight:800;color:var(--md)}
.success-po-id{font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--bl)}
.success-actions{padding:0 18px 32px;display:flex;flex-direction:column;gap:9px}

@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes boing{from{transform:scale(0)}to{transform:scale(1)}}
.fade{animation:fu .15s ease}
@keyframes fu{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
`;

// ─── ShortageTab ──────────────────────────────────────────────────────────────

interface ItemRowState {
  vendorId:    string;
  price:       number;
  showOther:   boolean;
  otherSearch: string;
}

function ShortageTab({ items, cart, vendorMap, onAdd, onRemove, onChangeVendor, onRateChange, loading, error }: {
  items:          CatalogItem[];
  cart:           CartLine[];
  vendorMap:      Map<string, Vendor>;
  onAdd:          (item: CatalogItem, vendorId?: string, price?: number) => void;
  onRemove:       (itemCode: string) => void;
  onChangeVendor: (itemCode: string, vendorId: string) => void;
  onRateChange:   (itemCode: string, rate: number) => void;
  loading:        boolean;
  error:          string | null;
}) {
  const shortages = useMemo(() => items.filter(i => i.totalRequestedQty > 0), [items]);

  // Per-item state: selected vendor + price
  const [rowStates, setRowStates] = useState<Record<string, ItemRowState>>({});

  // Sync row states with cart values; initialize from item defaults for new items
  useEffect(() => {
    setRowStates(prev => {
      const next = { ...prev };
      shortages.forEach(item => {
        const cartLine = cart.find(l => l.itemCode === item.itemCode);
        if (cartLine) {
          next[item.itemCode] = {
            ...(next[item.itemCode] ?? { showOther: false, otherSearch: '' }),
            vendorId:  cartLine.vendorId,
            price:     cartLine.rate,
            showOther: false,
          };
        } else if (!next[item.itemCode]) {
          next[item.itemCode] = {
            vendorId:    item.autoVendorId,
            price:       item.lastRate,
            showOther:   false,
            otherSearch: '',
          };
        }
      });
      return next;
    });
  }, [shortages, cart]);

  const getState = (code: string): ItemRowState =>
    rowStates[code] ?? { vendorId: '', price: 0, showOther: false, otherSearch: '' };

  const patchState = (code: string, patch: Partial<ItemRowState>) =>
    setRowStates(prev => ({ ...prev, [code]: { ...getState(code), ...patch } }));

  // Group by currently selected vendor (re-compute when rowStates changes)
  const byVendor = useMemo(() => {
    const mp: Record<string, CatalogItem[]> = {};
    shortages.forEach(i => {
      const vid = (rowStates[i.itemCode]?.vendorId) || i.autoVendorId || '__none__';
      if (!mp[vid]) mp[vid] = [];
      mp[vid].push(i);
    });
    return mp;
  }, [shortages, rowStates]);

  const inCart = (code: string) => cart.some(l => l.itemCode === code);

  const vendorTotal = (groupKey: string) =>
    (byVendor[groupKey] ?? [])
      .filter(i => inCart(i.itemCode))
      .reduce((s, i) => {
        const line = cart.find(l => l.itemCode === i.itemCode);
        return s + (line ? line.qty * line.rate : 0);
      }, 0);

  // All vendor entries for "Other" search
  const allVendorList = useMemo(
    () => Array.from(vendorMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [vendorMap]
  );

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9CA3AF' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
      <div style={{ fontSize: 13, fontWeight: 800 }}>Loading shortages...</div>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#DC2626' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontSize: 13, fontWeight: 800 }}>{error}</div>
    </div>
  );

  if (!shortages.length) return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9CA3AF' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 14, fontWeight: 800 }}>No pending warehouse requests</div>
    </div>
  );

  return (
    <div>
      {Object.entries(byVendor).map(([groupKey, vitems]) => {
        const vid    = groupKey === '__none__' ? '' : groupKey;
        const vendor = getV(vendorMap, vid);
        const total  = vendorTotal(groupKey);
        return (
          <div key={groupKey} className="vendor-group fade">
            <div className="vg-header" style={{ background: vendor.color }}>
              <div className="vg-dot"/>
              <div className="vg-name">{vid ? vendor.displayName : 'Unassigned'}</div>
              {vendor.phone && <div className="vg-phone">{vendor.phone}</div>}
              {total > 0 && <div className="vg-total">{inr(total)}</div>}
            </div>
            <div className="vg-items">
              {vitems.map(item => {
                const added       = inCart(item.itemCode);
                const rs          = getState(item.itemCode);
                const noPrice     = rs.price === 0;
                const otherResults = rs.otherSearch.length >= 1
                  ? allVendorList.filter(v =>
                      v.displayName.toLowerCase().includes(rs.otherSearch.toLowerCase()) ||
                      v.id.toLowerCase().includes(rs.otherSearch.toLowerCase())
                    ).slice(0, 8)
                  : [];

                return (
                  <div key={item.itemCode} className={`shortage-row ${added ? 'added' : ''}`}
                    style={{ cursor: 'default', alignItems: 'flex-start', flexDirection: 'column' }}>

                    {/* Top row: name + add button */}
                    <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10 }}>
                      <div className="sr-info" style={{ flex: 1 }}>
                        <div className="sr-name">{item.name}</div>
                        <div className="sr-chips">
                          <span className="chip manual">Req: {item.totalRequestedQty} {item.unit}</span>
                          <span className="chip stock">Stock: {item.stockQty} {item.unit}</span>
                          <span className="chip short">Short: {item.shortfallQty} {item.unit}</span>
                          {item.lastPoDate && <span className="chip date">Last PO: {item.lastPoDate}</span>}
                        </div>
                        {item.requestSources.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
                            {summarizeSources(item.requestSources).map(source => (
                              <span
                                key={`${item.itemCode}-${source.warehouse}`}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '3px 8px',
                                  borderRadius: 999,
                                  background: '#F8FAFC',
                                  color: '#475569',
                                  border: '1px solid var(--ln)',
                                }}>
                                {source.warehouse}: {source.qty} {item.unit}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className={`add-btn ${added ? 'added' : 'add'}`}
                        onClick={() => {
                          if (added) { onRemove(item.itemCode); return; }
                          if (!rs.vendorId) { alert('Please select a vendor first'); return; }
                          if (!rs.price || rs.price <= 0) { alert('Please enter a price'); return; }
                          onAdd(item, rs.vendorId, rs.price);
                        }}>
                        {added ? '✓' : '+'}
                      </button>
                    </div>

                    {/* Controls row: vendor select + price — always visible */}
                    <div className="sr-controls" onClick={e => e.stopPropagation()}>
                      {/* Vendor select */}
                      <select
                        className="sr-vendor-sel"
                        value={rs.showOther ? '__other__' : (rs.vendorId || '__none__')}
                        onChange={e => {
                          const v = e.target.value;
                          if (v === '__other__') {
                            patchState(item.itemCode, { showOther: true, otherSearch: '' });
                          } else if (v === '__none__') {
                            patchState(item.itemCode, { vendorId: '', showOther: false });
                            if (added) onChangeVendor(item.itemCode, '');
                          } else {
                            const vEntry = item.allVendors.find(av => av.vendorId === v);
                            const newPrice = vEntry?.rate ?? rs.price;
                            patchState(item.itemCode, { vendorId: v, price: newPrice, showOther: false });
                            if (added) {
                              onChangeVendor(item.itemCode, v);
                              if (newPrice > 0) onRateChange(item.itemCode, newPrice);
                            }
                          }
                        }}>
                        <option value="__none__">— No vendor —</option>
                        {item.allVendors.map(av => {
                          const vd = getV(vendorMap, av.vendorId);
                          return (
                            <option key={av.vendorId} value={av.vendorId}>
                              {vd.displayName}{av.rate > 0 ? ` ₹${av.rate}` : ''}
                            </option>
                          );
                        })}
                        <option value="__other__">Other (search)…</option>
                      </select>

                      {/* Price input */}
                      <input
                        className={`sr-price-inp${noPrice ? ' noprice' : ''}`}
                        type="number"
                        inputMode="decimal"
                        placeholder="₹ price"
                        value={rs.price || ''}
                        autoFocus={noPrice && !added}
                        onChange={e => {
                          const p = parseFloat(e.target.value) || 0;
                          patchState(item.itemCode, { price: p });
                          if (added) onRateChange(item.itemCode, p);
                        }}
                        onFocus={e => e.target.select()}
                      />
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', flexShrink: 0 }}>
                        /{item.unit}
                      </span>
                    </div>

                    {/* Other vendor search */}
                    {rs.showOther && (
                      <div className="other-search-wrap" onClick={e => e.stopPropagation()}>
                        <input
                          className="other-search-inp"
                          autoFocus
                          placeholder="Search vendor..."
                          value={rs.otherSearch}
                          onChange={e => patchState(item.itemCode, { otherSearch: e.target.value })}
                        />
                        {otherResults.length > 0 && (
                          <div className="other-search-results">
                            {otherResults.map(v => (
                              <div key={v.id} className="osr-row"
                                onPointerDown={e => {
                                  e.preventDefault();
                                  patchState(item.itemCode, { vendorId: v.id, showOther: false, otherSearch: '' });
                                  if (added) onChangeVendor(item.itemCode, v.id);
                                }}>
                                <span style={{ color: v.color }}>● </span>
                                {v.displayName}
                                {v.phone && <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 6 }}>{v.phone}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── AddItemsTab ──────────────────────────────────────────────────────────────

function AddItemsTab({ shortageItems, cart, vendorMap, token, onAdd, onRemove, onChangeVendor }: {
  shortageItems:  CatalogItem[];
  cart:           CartLine[];
  vendorMap:      Map<string, Vendor>;
  token:          string;
  onAdd:          (item: CatalogItem, vendorId?: string, price?: number) => void;
  onRemove:       (itemCode: string) => void;
  onChangeVendor: (itemCode: string, vendorId: string) => void;
}) {
  const [search,    setSearch   ] = useState('');
  const [results,   setResults  ] = useState<CatalogItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [addStates, setAddStates] = useState<Record<string, ItemRowState>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getAS = (code: string): ItemRowState =>
    addStates[code] ?? { vendorId: '', price: 0, showOther: false, otherSearch: '' };

  const patchAS = (code: string, patch: Partial<ItemRowState>) =>
    setAddStates(prev => ({ ...prev, [code]: { ...getAS(code), ...patch } }));

  const allVendorList = useMemo(
    () => Array.from(vendorMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [vendorMap]
  );

  const defaultResults = useMemo(() => shortageItems.slice(0, 10), [shortageItems]);

  useEffect(() => {
    const q = search.trim();
    if (!q) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiRequest<any[]>(`/store/vendor-order/items?q=${encodeURIComponent(q)}`, 'GET', undefined, token);
        setResults((data || []).map(mapApiItem));
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, token]);

  // Sync addStates with displayed items
  useEffect(() => {
    const items = search.trim() ? results : defaultResults;
    setAddStates(prev => {
      const next = { ...prev };
      items.forEach(item => {
        const cartLine = cart.find(l => l.itemCode === item.itemCode);
        if (cartLine && !next[item.itemCode]) {
          next[item.itemCode] = { vendorId: cartLine.vendorId, price: cartLine.rate, showOther: false, otherSearch: '' };
        } else if (!next[item.itemCode]) {
          next[item.itemCode] = { vendorId: item.autoVendorId, price: item.lastRate, showOther: false, otherSearch: '' };
        }
      });
      return next;
    });
  }, [results, defaultResults, search, cart]);

  const displayed = search.trim() ? results : defaultResults;
  const cartLine  = (code: string) => cart.find(l => l.itemCode === code);
  const inCart    = (code: string) => !!cartLine(code);

  return (
    <div>
      <div className="search-wrap">
        <span className="search-label">Item search karo</span>
        <div className="search-field">
          <span style={{ fontSize: 16, color: 'var(--lt)' }}>🔍</span>
          <input className="search-inp" placeholder="Item naam ya code type karo..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => { setSearch(''); setResults([]); }}>✕</button>}
        </div>

        {searching && (
          <div style={{ textAlign: 'center', padding: '12px', color: '#9CA3AF', fontSize: 12, fontWeight: 700 }}>
            Searching...
          </div>
        )}

        {!searching && displayed.length > 0 && (
          <div className="search-results" style={{ marginTop: 9 }}>
            {displayed.map(item => {
              const added  = inCart(item.itemCode);
              const as     = getAS(item.itemCode);
              const noPrice = as.price === 0;
              const otherResults = as.otherSearch.length >= 1
                ? allVendorList.filter(v =>
                    v.displayName.toLowerCase().includes(as.otherSearch.toLowerCase()) ||
                    v.id.toLowerCase().includes(as.otherSearch.toLowerCase())
                  ).slice(0, 8)
                : [];

              return (
                <div key={item.itemCode} className={`search-result-row ${added ? 'in-cart' : ''} fade`}
                  style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>

                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="srr-info">
                      <div className="srr-name">{item.name}</div>
                      <div className="srr-sub">
                        {item.totalRequestedQty > 0 && (
                          <span className="chip manual" style={{ fontSize: 9 }}>Req {item.totalRequestedQty} {item.unit}</span>
                        )}
                        {item.shortfallQty > 0 && (
                          <span className="chip short" style={{ fontSize: 9 }}>⚠ Short {item.shortfallQty} {item.unit}</span>
                        )}
                        {item.lastPoDate && (
                          <span className="chip date" style={{ fontSize: 9 }}>{item.lastPoDate}</span>
                        )}
                        {item.stockQty > 0 && (
                          <span className="chip stock" style={{ fontSize: 9 }}>Stock: {item.stockQty}</span>
                        )}
                      </div>
                    </div>
                    <button className={`srr-add-btn ${added ? 'added' : ''}`}
                      onClick={() => {
                        if (added) { onRemove(item.itemCode); return; }
                        if (!as.vendorId) { alert('Please select a vendor first'); return; }
                        if (!as.price || as.price <= 0) { alert('Please enter a price'); return; }
                        onAdd(item, as.vendorId, as.price);
                      }}>
                      {added ? '✓' : '+'}
                    </button>
                  </div>

                  {/* Inline vendor + price controls */}
                  <div className="sr-controls" style={{ marginTop: 6 }} onClick={e => e.stopPropagation()}>
                    <select
                      className="sr-vendor-sel"
                      value={as.showOther ? '__other__' : (as.vendorId || '__none__')}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === '__other__') {
                          patchAS(item.itemCode, { showOther: true, otherSearch: '' });
                        } else if (v === '__none__') {
                          patchAS(item.itemCode, { vendorId: '', showOther: false });
                          if (added) onChangeVendor(item.itemCode, '');
                        } else {
                          const vEntry = item.allVendors.find(av => av.vendorId === v);
                          const newPrice = vEntry?.rate ?? as.price;
                          patchAS(item.itemCode, { vendorId: v, price: newPrice, showOther: false });
                          if (added) onChangeVendor(item.itemCode, v);
                        }
                      }}>
                      <option value="__none__">— No vendor —</option>
                      {item.allVendors.map(av => {
                        const vd = getV(vendorMap, av.vendorId);
                        return (
                          <option key={av.vendorId} value={av.vendorId}>
                            {vd.displayName}{av.rate > 0 ? ` ₹${av.rate}` : ''}
                          </option>
                        );
                      })}
                      <option value="__other__">Other (search)…</option>
                    </select>
                    <input
                      className={`sr-price-inp${noPrice ? ' noprice' : ''}`}
                      type="number"
                      inputMode="decimal"
                      placeholder="₹ price"
                      value={as.price || ''}
                      onChange={e => patchAS(item.itemCode, { price: parseFloat(e.target.value) || 0 })}
                      onFocus={e => e.target.select()}
                    />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', flexShrink: 0 }}>/{item.unit}</span>
                  </div>

                  {/* Other vendor search */}
                  {as.showOther && (
                    <div className="other-search-wrap" onClick={e => e.stopPropagation()}>
                      <input
                        className="other-search-inp"
                        autoFocus
                        placeholder="Search vendor..."
                        value={as.otherSearch}
                        onChange={e => patchAS(item.itemCode, { otherSearch: e.target.value })}
                      />
                      {otherResults.length > 0 && (
                        <div className="other-search-results">
                          {otherResults.map(v => (
                            <div key={v.id} className="osr-row"
                              onPointerDown={e => {
                                e.preventDefault();
                                patchAS(item.itemCode, { vendorId: v.id, showOther: false, otherSearch: '' });
                                if (added) onChangeVendor(item.itemCode, v.id);
                              }}>
                              <span style={{ color: v.color }}>● </span>
                              {v.displayName}
                              {v.phone && <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 6 }}>{v.phone}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CartTab ──────────────────────────────────────────────────────────────────

function CartTab({ cart, vendorMap, shortageItems, token, onQtyChange, onRemove, onChangeVendor, onRateChange, onOrderSuccess }: {
  cart:           CartLine[];
  vendorMap:      Map<string, Vendor>;
  shortageItems:  CatalogItem[];
  token:          string;
  onQtyChange:    (itemCode: string, qty: number) => void;
  onRemove:       (itemCode: string) => void;
  onChangeVendor: (itemCode: string, vendorId: string) => void;
  onRateChange:   (itemCode: string, rate: number) => void;
  onOrderSuccess: (orders: PastOrder[]) => void;
}) {
  const [lineStates, setLineStates] = useState<Record<string, ItemRowState>>({});
  const [creating,   setCreating  ] = useState(false);
  const [createErr,  setCreateErr ] = useState<string | null>(null);
  const [poResult,   setPoResult  ] = useState<{
    poMap:         Record<string, string>;
    failed:        { vendor_id: string; error: string }[];
    vendorOrderId: number;
  } | null>(null);

  const allVendorList = useMemo(
    () => Array.from(vendorMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [vendorMap]
  );

  // Sync lineStates from cart — keep entries for current cart items, drop stale ones
  useEffect(() => {
    setLineStates(prev => {
      const cartCodes = new Set(cart.map(l => l.itemCode));
      const next: Record<string, ItemRowState> = {};
      cart.forEach(line => {
        next[line.itemCode] = prev[line.itemCode] ?? { vendorId: line.vendorId, price: line.rate, showOther: false, otherSearch: '' };
      });
      return next;
    });
  }, [cart]);

  const getLS = (code: string): ItemRowState =>
    lineStates[code] ?? { vendorId: '', price: 0, showOther: false, otherSearch: '' };

  const patchLS = (code: string, patch: Partial<ItemRowState>) =>
    setLineStates(prev => ({ ...prev, [code]: { ...getLS(code), ...patch } }));

  const byVendor = useMemo(() => {
    const mp: Record<string, CartLine[]> = {};
    cart.forEach(l => {
      if (!mp[l.vendorId]) mp[l.vendorId] = [];
      mp[l.vendorId].push(l);
    });
    return mp;
  }, [cart]);

  const vendorIds  = Object.keys(byVendor);
  const grandTotal = cart.reduce((s, l) => s + l.qty * l.rate, 0);

  const createAllPOs = async () => {
    setCreating(true);
    setCreateErr(null);
    try {
      const res = await apiRequest<{
        vendor_order_id: number;
        purchase_orders: { vendor_id: string; po_id: string }[];
        failed:          { vendor_id: string; error: string }[];
      }>('/store/vendor-order/create', 'POST', {
        lines: cart.map(l => ({
          item_code: l.itemCode,
          item_name: l.name,
          uom:       l.unit,
          qty:       l.qty,
          price:     l.rate,
          vendor_id: l.vendorId,
          is_manual: l.isManual,
          request_sources: l.requestSources.map(source => ({
            requisition_id: source.requisitionId,
            warehouse: source.warehouse,
            requested_date: source.requestedDate,
            remaining_qty: source.remainingQty,
          })),
        })),
      }, token);

      const newPOs: Record<string, string> = {};
      (res.purchase_orders || []).forEach(po => { newPOs[po.vendor_id] = po.po_id; });

      setPoResult({ poMap: newPOs, failed: res.failed || [], vendorOrderId: res.vendor_order_id });

      const pendingOrders: PastOrder[] = vendorIds.map(vid => ({
        id:           newPOs[vid] ?? `ORD-${res.vendor_order_id}`,
        vendorId:     vid,
        lines:        byVendor[vid],
        status:       newPOs[vid] ? 'po_created' : 'failed',
        createdAt:    new Date().toISOString(),
        poId:         newPOs[vid],
        errorMessage: (res.failed || []).find(f => f.vendor_id === vid)?.error,
      }));
      onOrderSuccess(pendingOrders);
    } catch (err: any) {
      setCreateErr(err?.message || 'PO creation failed. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const shareToVendor = (vendorId: string) => {
    const vendor = getV(vendorMap, vendorId);
    const lines  = byVendor[vendorId] ?? [];
    const poId   = poResult?.poMap[vendorId];
    const msg    = buildWaMessage(vendor, lines, poId);
    const phone  = vendor.phone.replace(/\D/g, '');
    if (phone) window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    else if (navigator.share) navigator.share({ title: 'Purchase Order', text: msg }).catch(() => {});
    else navigator.clipboard.writeText(msg).then(() => alert('Message copied to clipboard'));
  };

  const shareAll = () => {
    const msg = [
      `*Purchase Orders — Food Studio*`,
      `Date: ${fmt(TODAY_STR)}`,
      ``,
      ...vendorIds.map(vid => {
        const vendor = getV(vendorMap, vid);
        const lines  = byVendor[vid];
        const total  = lines.reduce((s, l) => s + l.qty * l.rate, 0);
        const poId   = poResult?.poMap[vid];
        return [
          `*${vendor.displayName}*${vendor.phone ? ` (${vendor.phone})` : ''}${poId ? ` — ${poId}` : ''}`,
          ...lines.map(l => `  • ${l.name}: ${l.qty} ${l.unit} = ${inr(l.qty * l.rate)}`),
          `  Subtotal: ${inr(total)}`,
        ].join('\n');
      }),
      ``,
      `*Grand Total: ${inr(grandTotal)}*`,
    ].join('\n');
    if (navigator.share) navigator.share({ title: 'Purchase Orders', text: msg }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (!cart.length) return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9CA3AF' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>🛒</div>
      <div style={{ fontSize: 14, fontWeight: 800 }}>Cart khaali hai</div>
      <div style={{ fontSize: 12, marginTop: 6 }}>Requests tab ya Add Items se items add karo</div>
    </div>
  );

  const allPOsDone = poResult && vendorIds.length > 0 && vendorIds.every(vid => poResult.poMap[vid]);

  return (
    <div>
      {/* Share overlay — shown after PO creation */}
      {poResult && (
        <div className="success-overlay">
          <div className="success-sheet">
            <div className="success-handle"/>
            <div className="success-icon">{(poResult.failed?.length ?? 0) > 0 ? '⚠️' : '🎉'}</div>
            <div className="success-title">
              {(poResult.failed?.length ?? 0) > 0 ? 'Partial Success' : 'Purchase Orders Created!'}
            </div>
            <div className="success-sub">
              {vendorIds.length} vendors · {cart.length} items · {inr(grandTotal)}
            </div>

            <div className="success-po-list">
              <div className="success-po-title">ERPNext Purchase Orders</div>
              {vendorIds.map(vid => {
                const vendor = getV(vendorMap, vid);
                const po     = poResult.poMap[vid];
                const fail   = (poResult.failed || []).find(f => f.vendor_id === vid);
                return (
                  <div key={vid} className="success-po-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                    <div style={{ display: 'flex', width: '100%' }}>
                      <span className="success-po-vendor">{vendor.displayName}</span>
                      <span className="success-po-id" style={{ marginLeft: 'auto', color: po ? 'var(--bl)' : 'var(--rd)' }}>
                        {po ?? '✗ Failed'}
                      </span>
                    </div>
                    {fail && (
                      <div style={{ fontSize: 10, color: '#DC2626', lineHeight: 1.4, fontWeight: 700, paddingBottom: 4 }}>
                        ⚠ {fail.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="success-actions">
              {vendorIds.map((vid, i) => {
                const vendor = getV(vendorMap, vid);
                const total  = (byVendor[vid] || []).reduce((s, l) => s + l.qty * l.rate, 0);
                const po     = poResult.poMap[vid];
                return (
                  <button key={i} className="wa-btn" style={{ background: vendor.color }}
                    onClick={() => shareToVendor(vid)}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>📲 {vendor.displayName}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, opacity: .8, marginTop: 2 }}>
                        {po ? `${po} · ` : ''}{inr(total)}{vendor.phone ? ` · ${vendor.phone}` : ''}
                      </div>
                    </div>
                    <span className="wa-badge">WhatsApp</span>
                  </button>
                );
              })}
              <button className="wa-btn" style={{ background: '#25D366' }} onClick={shareAll}>
                <span>📲 Share All Summary ({vendorIds.length} vendors)</span>
                <span className="wa-badge">WhatsApp</span>
              </button>
              <button style={{
                width: '100%', padding: 13, background: 'var(--bg)', color: 'var(--dk)',
                border: '2px solid var(--ln)', borderRadius: 13, cursor: 'pointer',
                fontFamily: "'Nunito',sans-serif", fontSize: 13, fontWeight: 800,
              }} onClick={() => setPoResult(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {Object.entries(byVendor).map(([vendorId, lines]) => {
        const vendor      = getV(vendorMap, vendorId);
        const vendorTotal = lines.reduce((s, l) => s + l.qty * l.rate, 0);
        return (
          <div key={vendorId} className="cart-vendor-block fade">
            <div className="cvb-header" style={{ background: vendor.color }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,.4)', flexShrink: 0 }}/>
              <span className="cvb-name">{vendor.displayName}</span>
              {vendor.phone && <span className="cvb-phone">{vendor.phone}</span>}
              <span className="cvb-total">{inr(vendorTotal)}</span>
            </div>

            {lines.map(line => {
              const catItem    = shortageItems.find(c => c.itemCode === line.itemCode);
              const allVendors = line.allVendors.length > 0 ? line.allVendors : (catItem?.allVendors ?? []);
              const ls         = getLS(line.itemCode);
              const noPrice    = line.rate === 0;
              const otherResults = ls.otherSearch.length >= 1
                ? allVendorList.filter(v =>
                    v.displayName.toLowerCase().includes(ls.otherSearch.toLowerCase()) ||
                    v.id.toLowerCase().includes(ls.otherSearch.toLowerCase())
                  ).slice(0, 8)
                : [];

              return (
                <div key={line.itemCode}>
                  <div className="cart-item-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                    {/* Top: name + qty controls + remove */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div className="cir-info" style={{ flex: 1 }}>
                        <div className="cir-name">{line.name}</div>
                        <div className="cir-price">
                          {line.isManual && <span className="chip manual">Manual</span>}
                          {line.requestedTotalQty > 0 && (
                            <span className="chip stock">Req {line.requestedTotalQty} {line.unit}</span>
                          )}
                          {line.vendorId !== line.autoVendorId && line.autoVendorId && (
                            <span className="chip auto">Changed</span>
                          )}
                          {line.requestedTotalQty > 0 && n3(line.qty) !== n3(line.requestedTotalQty) && (
                            <span className="chip date">Order {line.qty} / Req {line.requestedTotalQty}</span>
                          )}
                        </div>
                        {line.requestSources.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                            {summarizeSources(line.requestSources).map(source => (
                              <span
                                key={`${line.itemCode}-${source.warehouse}`}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '3px 8px',
                                  borderRadius: 999,
                                  background: '#F8FAFC',
                                  color: '#475569',
                                  border: '1px solid var(--ln)',
                                }}>
                                {source.warehouse}: {source.qty} {line.unit}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="qty-ctrl">
                        <button className="qty-btn"
                          onPointerDown={e => { e.preventDefault(); onQtyChange(line.itemCode, n3(line.qty - 0.5)); }}>−</button>
                        <input className="qty-inp" type="number" inputMode="decimal" step="any"
                          value={line.qty}
                          onChange={e => onQtyChange(line.itemCode, parseFloat(e.target.value) || 0)}
                          onFocus={e => e.target.select()} />
                        <button className="qty-btn add"
                          onPointerDown={e => { e.preventDefault(); onQtyChange(line.itemCode, n3(line.qty + 0.5)); }}>+</button>
                      </div>
                      <span className="qty-unit">{line.unit}</span>
                      <span className="qty-val">{inr(line.qty * line.rate)}</span>
                      <button className="remove-btn" onClick={() => onRemove(line.itemCode)}>✕</button>
                    </div>

                    {/* Inline vendor select + price */}
                    <div className="sr-controls" onClick={e => e.stopPropagation()}>
                      <select
                        className="sr-vendor-sel"
                        value={ls.showOther ? '__other__' : (line.vendorId || '__none__')}
                        onChange={e => {
                          const v = e.target.value;
                          if (v === '__other__') {
                            patchLS(line.itemCode, { showOther: true, otherSearch: '' });
                          } else if (v === '__none__') {
                            patchLS(line.itemCode, { vendorId: '', showOther: false });
                            onChangeVendor(line.itemCode, '');
                          } else {
                            const vEntry = allVendors.find(av => av.vendorId === v);
                            patchLS(line.itemCode, { vendorId: v, showOther: false });
                            onChangeVendor(line.itemCode, v);
                            if (vEntry && vEntry.rate > 0) onRateChange(line.itemCode, vEntry.rate);
                          }
                        }}>
                        <option value="__none__">— No vendor —</option>
                        {allVendors.map(av => {
                          const vd = getV(vendorMap, av.vendorId);
                          return (
                            <option key={av.vendorId} value={av.vendorId}>
                              {vd.displayName}{av.rate > 0 ? ` ₹${av.rate}` : ''}
                            </option>
                          );
                        })}
                        <option value="__other__">Other (search)…</option>
                      </select>
                      <input
                        className={`sr-price-inp${noPrice ? ' noprice' : ''}`}
                        type="number"
                        inputMode="decimal"
                        placeholder="₹ price"
                        value={line.rate || ''}
                        onChange={e => onRateChange(line.itemCode, parseFloat(e.target.value) || 0)}
                        onFocus={e => e.target.select()}
                      />
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', flexShrink: 0 }}>/{line.unit}</span>
                    </div>

                    {/* Other vendor search */}
                    {ls.showOther && (
                      <div className="other-search-wrap" onClick={e => e.stopPropagation()}>
                        <input
                          className="other-search-inp"
                          autoFocus
                          placeholder="Search vendor..."
                          value={ls.otherSearch}
                          onChange={e => patchLS(line.itemCode, { otherSearch: e.target.value })}
                        />
                        {otherResults.length > 0 && (
                          <div className="other-search-results">
                            {otherResults.map(v => (
                              <div key={v.id} className="osr-row"
                                onPointerDown={e => {
                                  e.preventDefault();
                                  patchLS(line.itemCode, { vendorId: v.id, showOther: false, otherSearch: '' });
                                  onChangeVendor(line.itemCode, v.id);
                                }}>
                                <span style={{ color: v.color }}>● </span>
                                {v.displayName}
                                {v.phone && <span style={{ fontSize: 10, color: '#9CA3AF', marginLeft: 6 }}>{v.phone}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="cart-footer">
              <span className="cart-footer-label">{lines.length} items</span>
              <span className="cart-footer-total">{inr(vendorTotal)}</span>
            </div>
          </div>
        );
      })}

      <div className="grand-total-bar">
        <span className="gt-label">Grand Total ({cart.length} items)</span>
        <span className="gt-value">{inr(grandTotal)}</span>
      </div>

      {createErr && (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12,
          padding: '11px 14px', margin: '10px 0', fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
          ⚠️ {createErr}
        </div>
      )}

      <button className="po-btn" style={{ marginTop: 12, marginBottom: 12 }}
        disabled={creating || !!allPOsDone}
        onClick={createAllPOs}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {allPOsDone ? '✅' : creating ? '⏳' : '📄'}
          {allPOsDone
            ? `${vendorIds.length} POs Created in ERPNext`
            : creating
              ? `Creating ${vendorIds.length} POs in ERPNext...`
              : `Place Order — ${vendorIds.length} Vendor${vendorIds.length !== 1 ? 's' : ''}`}
        </span>
        <span className="po-badge">{inr(grandTotal)}</span>
      </button>
    </div>
  );
}

// ─── HistoryTab ───────────────────────────────────────────────────────────────

function HistoryTab({ orders, vendorMap, loading, token, onShare, onReorder, onRetrySuccess, onDeleteSuccess }: {
  orders:    PastOrder[];
  vendorMap: Map<string, Vendor>;
  loading:   boolean;
  token:     string;
  onShare:   (o: PastOrder) => void;
  onReorder: (lines: CartLine[]) => void;
  onRetrySuccess: (dbId: number, poId: string) => void;
  onDeleteSuccess: (dbId: number) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [retryError, setRetryError] = useState<Record<number, string>>({});

  const handleRetry = async (order: PastOrder) => {
    if (!order.dbId || !token) return;
    setRetryingId(order.dbId);
    setRetryError(prev => { const n = { ...prev }; delete n[order.dbId!]; return n; });
    try {
      const res = await apiRequest<{ success: boolean; po_id?: string; error?: string }>(
        `/store/vendor-order/retry/${order.dbId}`, 'POST', undefined, token
      );
      if (res.success && res.po_id) {
        onRetrySuccess(order.dbId, res.po_id);
      } else {
        setRetryError(prev => ({ ...prev, [order.dbId!]: res.error || 'Retry failed' }));
      }
    } catch (err: any) {
      setRetryError(prev => ({ ...prev, [order.dbId!]: err?.message || 'Retry failed' }));
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async (order: PastOrder) => {
    if (!order.dbId || !token) return;
    if (!confirm('Delete this failed PO record?')) return;
    setDeletingId(order.dbId);
    try {
      await apiRequest(`/store/vendor-order/po/${order.dbId}`, 'DELETE', undefined, token);
      onDeleteSuccess(order.dbId);
    } catch { /* ignore */ } finally {
      setDeletingId(null);
    }
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9CA3AF' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
      <div style={{ fontSize: 13, fontWeight: 800 }}>Loading history...</div>
    </div>
  );

  if (!orders.length) return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#9CA3AF' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: 14, fontWeight: 800 }}>Koi past order nahi</div>
    </div>
  );

  return (
    <div>
      {orders.map((order, i) => {
        const vendor   = getV(vendorMap, order.vendorId);
        const total    = order.lines.reduce((s, l) => s + l.qty * l.rate, 0);
        const key      = `${order.id}-${i}`;
        const expanded = expandedId === key;
        const isFailed = order.status === 'failed';
        const isRetrying = retryingId === order.dbId;
        return (
          <div key={key} className="hist-card fade">
            <div className="hc-top" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : key)}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: isFailed ? '#DC2626' : vendor.color, flexShrink: 0, marginTop: 2 }}/>
              <div className="hc-info">
                <div className="hc-id">{order.poId ?? order.id}</div>
                <div className="hc-meta">
                  {vendor.displayName} · {order.lines.length} items · {inr(total)} · {new Date(order.createdAt).toLocaleDateString('en-IN')}
                </div>
              </div>
              <div className={`hc-badge ${isFailed ? 'draft' : order.status === 'po_created' ? 'po' : order.status === 'sent' ? 'sent' : 'draft'}`}
                style={isFailed ? { background: '#FEF2F2', color: '#DC2626' } : {}}>
                {isFailed ? '⚠ Failed' : order.status === 'po_created' ? 'PO Created' : order.status === 'sent' ? 'Sent' : 'Draft'}
              </div>
              <span style={{ fontSize: 13, color: '#9CA3AF', marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
            </div>

            {/* ERP error */}
            {(order.errorMessage || (order.dbId && retryError[order.dbId])) && (
              <div style={{ padding: '8px 14px', background: '#FEF2F2', borderTop: '1px solid #FECACA' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', marginBottom: 2 }}>⚠️ ERPNext Error</div>
                <div style={{ fontSize: 11, color: '#DC2626', lineHeight: 1.4 }}>
                  {(order.dbId && retryError[order.dbId]) || order.errorMessage}
                </div>
              </div>
            )}

            {/* Expanded line items */}
            {expanded && order.lines.length > 0 && (
              <div style={{ borderTop: '1px solid var(--ln)' }}>
                {order.lines.map(line => (
                  <div key={line.itemCode} style={{ borderBottom: '1px solid var(--lnlt)' }}>
                    <div className="voc-item">
                      <span className="voc-item-name">{line.name}</span>
                      <span className="voc-item-qty">{line.qty} {line.unit}</span>
                      <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: "'DM Mono',monospace" }}>{inr(line.rate)}</span>
                      <span className="voc-item-val">{inr(line.qty * line.rate)}</span>
                    </div>
                    <div style={{ padding: '0 14px 10px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {line.requestedTotalQty > 0 ? (
                          <span className="chip stock">Requested {line.requestedTotalQty} {line.unit}</span>
                        ) : (
                          <span className="chip manual">No request snapshot</span>
                        )}
                        {line.requestedTotalQty > 0 && n3(line.qty) !== n3(line.requestedTotalQty) && (
                          <span className="chip date">Ordered {line.qty} {line.unit}</span>
                        )}
                      </div>
                      {line.requestSources.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                          {summarizeSources(line.requestSources).map(source => (
                            <span
                              key={`${line.itemCode}-${source.warehouse}`}
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 999,
                                background: '#F8FAFC',
                                color: '#475569',
                                border: '1px solid var(--ln)',
                              }}>
                              {source.warehouse}: {source.qty} {line.unit}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ padding: '8px 14px', background: '#F8FAFC', borderTop: '1px solid var(--ln)',
                  display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800 }}>
                  <span style={{ color: 'var(--md)' }}>{order.lines.length} items</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", color: 'var(--dk)' }}>{inr(total)}</span>
                </div>
              </div>
            )}

            <div className="hc-actions">
              {isFailed && order.dbId && (
                <button className="hc-act" disabled={isRetrying}
                  style={{ background: '#FEF2F2', color: '#DC2626', fontWeight: 800 }}
                  onClick={() => handleRetry(order)}>
                  {isRetrying ? '⏳ Retrying...' : '🔁 Retry PO'}
                </button>
              )}
              {isFailed && order.dbId && (
                <button className="hc-act" disabled={deletingId === order.dbId}
                  style={{ background: '#FEF2F2', color: '#9CA3AF', fontWeight: 800 }}
                  onClick={() => handleDelete(order)}>
                  {deletingId === order.dbId ? '⏳' : '🗑️ Delete'}
                </button>
              )}
              <button className="hc-act wa" onClick={() => onShare(order)}>📲 WhatsApp</button>
              <button className="hc-act" onClick={() => {
                const lines: CartLine[] = order.lines.map(l => ({
                  ...l,
                  autoVendorId: l.vendorId,
                  allVendors:   l.allVendors?.length ? l.allVendors : [],
                  requestSources: [],
                  requestedTotalQty: 0,
                  isManual: true,
                }));
                onReorder(lines);
              }}>🔄 Re-order</button>
              {order.poId && <button className="hc-act po">📄 {order.poId}</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ReviewScreen ─────────────────────────────────────────────────────────────

function ReviewScreen({ cart, vendorMap, token, onBack, onDone }: {
  cart:      CartLine[];
  vendorMap: Map<string, Vendor>;
  token:     string;
  onBack:    () => void;
  onDone:    (orders: PastOrder[]) => void;
}) {
  const [creating,    setCreating   ] = useState(false);
  const [poMap,       setPoMap      ] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [createErr,   setCreateErr  ] = useState<string | null>(null);
  const pendingOrders = useRef<PastOrder[]>([]);

  const byVendor = useMemo(() => {
    const mp: Record<string, CartLine[]> = {};
    cart.forEach(l => {
      if (!mp[l.vendorId]) mp[l.vendorId] = [];
      mp[l.vendorId].push(l);
    });
    return mp;
  }, [cart]);

  const vendorIds  = Object.keys(byVendor);
  const grandTotal = cart.reduce((s, l) => s + l.qty * l.rate, 0);
  const allPosDone = vendorIds.every(vid => poMap[vid]);

  const createAllPOs = async () => {
    setCreating(true);
    setCreateErr(null);
    try {
      const res = await apiRequest<{ vendor_order_id: number; purchase_orders: { vendor_id: string; po_id: string }[] }>(
        '/store/vendor-order/create',
        'POST',
        {
          lines: cart.map(l => ({
            item_code:  l.itemCode,
            item_name:  l.name,
            uom:        l.unit,
            qty:        l.qty,
            price:      l.rate,
            vendor_id:  l.vendorId,
            is_manual:  l.isManual,
            request_sources: l.requestSources.map(source => ({
              requisition_id: source.requisitionId,
              warehouse: source.warehouse,
              requested_date: source.requestedDate,
              remaining_qty: source.remainingQty,
            })),
          })),
        },
        token
      );
      const newPOs: Record<string, string> = {};
      (res.purchase_orders || []).forEach(po => { newPOs[po.vendor_id] = po.po_id; });

      pendingOrders.current = vendorIds.map(vid => ({
        id:        newPOs[vid] ?? `ORD-${res.vendor_order_id}`,
        vendorId:  vid,
        lines:     byVendor[vid],
        status:    'po_created' as const,
        createdAt: new Date().toISOString(),
        poId:      newPOs[vid],
      }));

      setPoMap(newPOs);
      setShowSuccess(true);
    } catch (err: any) {
      setCreateErr(err?.message || 'PO creation failed. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const shareToVendor = (vendorId: string) => {
    const vendor = getV(vendorMap, vendorId);
    const lines  = byVendor[vendorId];
    const msg    = buildWaMessage(vendor, lines, poMap[vendorId]);
    const phone  = vendor.phone.replace(/\D/g, '');
    if (phone) window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    else if (navigator.share) navigator.share({ title: 'Purchase Order', text: msg }).catch(() => {});
    else navigator.clipboard.writeText(msg).then(() => alert('Message copied to clipboard'));
  };

  const shareAll = () => {
    const msg = [
      `*Purchase Orders — Food Studio*`,
      `Date: ${fmt(TODAY_STR)}`,
      ``,
      ...vendorIds.map(vid => {
        const vendor = getV(vendorMap, vid);
        const lines  = byVendor[vid];
        const total  = lines.reduce((s, l) => s + l.qty * l.rate, 0);
        return [
          `*${vendor.displayName}* (${vendor.phone})${poMap[vid] ? ` — ${poMap[vid]}` : ''}`,
          ...lines.map(l => `  • ${l.name}: ${l.qty} ${l.unit} = ${inr(l.qty * l.rate)}`),
          `  Subtotal: ${inr(total)}`,
        ].join('\n');
      }),
      ``,
      `*Grand Total: ${inr(grandTotal)}*`,
    ].join('\n');
    if (navigator.share) navigator.share({ title: 'Purchase Orders', text: msg }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div style={{ padding: '12px 12px 90px' }}>

      {showSuccess && (
        <div className="success-overlay">
          <div className="success-sheet">
            <div className="success-handle"/>
            <div className="success-icon">🎉</div>
            <div className="success-title">Purchase Orders Created!</div>
            <div className="success-sub">
              {vendorIds.length} vendors · {cart.length} items · {inr(grandTotal)}<br/>
              Draft POs banaye ERPNext mein — team approve karega
            </div>

            <div className="success-po-list">
              <div className="success-po-title">ERPNext Purchase Orders</div>
              {vendorIds.map(vid => {
                const vendor = getV(vendorMap, vid);
                return (
                  <div key={vid} className="success-po-row">
                    <span className="success-po-vendor">{vendor.displayName}</span>
                    <span className="success-po-id">{poMap[vid] || '—'}</span>
                  </div>
                );
              })}
            </div>

            <div className="success-actions">
              {vendorIds.map((vid, i) => {
                const vendor = getV(vendorMap, vid);
                const total  = byVendor[vid].reduce((s, l) => s + l.qty * l.rate, 0);
                return (
                  <button key={i} className="wa-btn"
                    style={{ background: vendor.color }}
                    onClick={() => shareToVendor(vid)}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>📲 {vendor.displayName}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, opacity: .8, marginTop: 2 }}>
                        {poMap[vid]} · {inr(total)}{vendor.phone ? ` · ${vendor.phone}` : ''}
                      </div>
                    </div>
                    <span className="wa-badge">WhatsApp</span>
                  </button>
                );
              })}

              <button className="wa-btn" style={{ background: '#25D366' }} onClick={shareAll}>
                <span>📲 Share All Summary ({vendorIds.length} vendors)</span>
                <span className="wa-badge">WhatsApp</span>
              </button>

              <button style={{
                width: '100%', padding: 13, background: 'var(--bg)', color: 'var(--dk)',
                border: '2px solid var(--ln)', borderRadius: 13, cursor: 'pointer',
                fontFamily: "'Nunito',sans-serif", fontSize: 13, fontWeight: 800,
              }} onClick={() => onDone(pendingOrders.current)}>
                Done → View History
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="review-header">
        <div className="rh-icon">📦</div>
        <div className="rh-info">
          <div className="rh-title">Order Ready to Send</div>
          <div className="rh-sub">{vendorIds.length} vendors · {cart.length} items</div>
        </div>
        <div className="rh-total-wrap">
          <span className="rh-total-label">Total</span>
          <span className="rh-total">{inr(grandTotal)}</span>
        </div>
      </div>

      {vendorIds.map(vendorId => {
        const vendor = getV(vendorMap, vendorId);
        const lines  = byVendor[vendorId];
        const total  = lines.reduce((s, l) => s + l.qty * l.rate, 0);
        const poId   = poMap[vendorId];
        return (
          <div key={vendorId} className="vendor-order-card fade">
            <div className="voc-header" style={{ background: vendor.color }}>
              <span className="voc-name">{vendor.displayName}</span>
              {poId && <span className="voc-po-badge">{poId}</span>}
              <span className="voc-total">{inr(total)}</span>
            </div>
            {lines.map(line => (
              <div key={line.itemCode} className="voc-item">
                <span className="voc-item-name">{line.name}</span>
                <span className="voc-item-qty">{line.qty} {line.unit}</span>
                <span className="voc-item-val">{inr(line.qty * line.rate)}</span>
              </div>
            ))}
            <div className="voc-footer">
              <span className="vof-left">{lines.length} items{vendor.phone ? ` · ${vendor.phone}` : ''}</span>
              <span className="vof-right">{inr(total)}</span>
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--ln)' }}>
              <button className="wa-btn" onClick={() => shareToVendor(vendorId)}>
                <span>📲 Share with {vendor.displayName}</span>
                <span className="wa-badge">WhatsApp</span>
              </button>
            </div>
          </div>
        );
      })}

      <button className="wa-btn" style={{ marginBottom: 9 }} onClick={shareAll}>
        <span>📲 Share All Orders ({vendorIds.length} vendors)</span>
        <span className="wa-badge">{inr(grandTotal)}</span>
      </button>

      {createErr && (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12,
          padding: '11px 14px', marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
          ⚠️ {createErr}
        </div>
      )}

      <button className="po-btn"
        disabled={creating || allPosDone}
        onClick={createAllPOs}
        style={{ marginBottom: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {allPosDone ? '✅' : creating ? '⏳' : '📄'}
          {allPosDone
            ? `${vendorIds.length} POs Created in ERPNext`
            : creating
              ? `Creating ${vendorIds.length} POs in ERPNext...`
              : `Create ${vendorIds.length} Purchase Orders in ERPNext`}
        </span>
        <span className="po-badge">{allPosDone ? 'Done ✓' : 'Submit'}</span>
      </button>

      <div style={{ height: 80 }}/>

      <div className="bbar">
        <div className="bbar-inner">
          <button className="bbar-back" onClick={onBack}>← Edit</button>
          <button className="bbar-primary" onClick={shareAll}>
            📲 Share All to WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorOrderPage() {
  const router = useRouter();
  const token  = useAuthGuard('/store/login');

  const [tab,          setTab         ] = useState<'shortage' | 'add' | 'cart' | 'history'>('shortage');
  const [cart,         setCart        ] = useState<CartLine[]>([]);
  const [cartKey,      setCartKey    ] = useState(0);

  // Data
  const [vendorMap,    setVendorMap   ] = useState<Map<string, Vendor>>(new Map());
  const [shortageItems,setShortageItems] = useState<CatalogItem[]>([]);
  const [historyOrders,setHistoryOrders] = useState<PastOrder[]>([]);

  // Loading / error states
  const [loadingShortage, setLoadingShortage] = useState(true);
  const [loadingHistory,  setLoadingHistory ] = useState(false);
  const [shortageError,   setShortageError  ] = useState<string | null>(null);

  // Catalog status
  const [catalogStatus,   setCatalogStatus  ] = useState<{ items: number; last_synced: string | null; refreshing: boolean } | null>(null);
  const [refreshing,      setRefreshing     ] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setCart(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ignore */ }
  }, [cart]);

  // Load catalog status
  useEffect(() => {
    if (!token) return;
    apiRequest<any>('/store/vendor-order/catalog/status', 'GET', undefined, token)
      .then(s => setCatalogStatus(s))
      .catch(() => {});
  }, [token]);

  const handleRefreshCatalog = useCallback(async () => {
    if (!token || refreshing) return;
    setRefreshing(true);
    try {
      await apiRequest('/store/vendor-order/catalog/refresh', 'POST', undefined, token);
      // Poll status until not refreshing
      const poll = setInterval(async () => {
        const s = await apiRequest<any>('/store/vendor-order/catalog/status', 'GET', undefined, token).catch(() => null);
        if (s) { setCatalogStatus(s); if (!s.refreshing) { clearInterval(poll); setRefreshing(false); loadShortage(); } }
      }, 3000);
    } catch { setRefreshing(false); }
  }, [token, refreshing]);

  // Load vendors
  useEffect(() => {
    if (!token) return;
    apiRequest<{ suppliers: any[] }>('/store/vendor-order/vendors', 'GET', undefined, token)
      .then(res => {
        const map = new Map<string, Vendor>();
        (res.suppliers || []).forEach((s: any, i: number) => {
          if (s.disabled) return;
          map.set(s.name, {
            id:          s.name,
            displayName: s.supplier_name || s.name,
            phone:       s.mobile_no || '',
            color:       palette[i % palette.length],
          });
        });
        setVendorMap(map);
      })
      .catch(() => { /* vendor map stays empty — fallback colors will be used */ });
  }, [token]);

  // Load shortage items
  const loadShortage = useCallback(async () => {
    if (!token) return;
    setLoadingShortage(true);
    setShortageError(null);
    try {
      const data = await apiRequest<any[]>('/store/vendor-order/shortage', 'GET', undefined, token);
      setShortageItems((data || []).map(mapApiItem));
    } catch (err: any) {
      setShortageError(err?.message || 'Failed to load shortage items');
    } finally {
      setLoadingShortage(false);
    }
  }, [token]);

  useEffect(() => { loadShortage(); }, [loadShortage]);

  // Load history when tab opened
  useEffect(() => {
    if (tab !== 'history' || !token) return;
    setLoadingHistory(true);
    apiRequest<any[]>('/store/vendor-order/history', 'GET', undefined, token)
      .then(data => setHistoryOrders(mapHistoryToOrders(data || [])))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [tab, token]);

  // Cart handlers
  const handleAdd = useCallback((item: CatalogItem, overrideVendorId?: string, overridePrice?: number) => {
    setCart(prev => {
      if (prev.find(l => l.itemCode === item.itemCode)) return prev;
      const vendorId = overrideVendorId ?? item.autoVendorId;
      const vEntry   = item.allVendors.find(v => v.vendorId === vendorId);
      return [...prev, {
        itemCode:     item.itemCode,
        name:         item.name,
        unit:         item.unit,
        qty:          item.defaultOrderQty > 0 ? item.defaultOrderQty : 1,
        rate:         overridePrice ?? vEntry?.rate ?? item.lastRate,
        vendorId:     vendorId || '',
        isManual:     item.requestSources.length === 0,
        autoVendorId: item.autoVendorId,
        allVendors:   item.allVendors,
        requestSources: item.requestSources,
        requestedTotalQty: item.totalRequestedQty,
      }];
    });
  }, []);

  const handleRemove = useCallback((itemCode: string) => {
    setCart(prev => prev.filter(l => l.itemCode !== itemCode));
  }, []);

  const handleQtyChange = useCallback((itemCode: string, qty: number) => {
    setCart(prev => prev.map(l =>
      l.itemCode === itemCode ? { ...l, qty: Math.max(0.5, n3(qty)) } : l
    ));
  }, []);

  const handleChangeVendor = useCallback((itemCode: string, newVendorId: string) => {
    setCart(prev => prev.map(l => {
      if (l.itemCode !== itemCode) return l;
      const newRate = l.allVendors.find(v => v.vendorId === newVendorId)?.rate ?? l.rate;
      return { ...l, vendorId: newVendorId, rate: newRate };
    }));
  }, []);

  const handleRateChange = useCallback((itemCode: string, rate: number) => {
    setCart(prev => prev.map(l => l.itemCode === itemCode ? { ...l, rate: Math.max(0, rate) } : l));
  }, []);

  const handleOrderSuccess = useCallback((orders: PastOrder[]) => {
    setHistoryOrders(prev => [...orders, ...prev]);
    setCart([]);
    setTab('history');
  }, []);

  const handleReorder = useCallback((lines: CartLine[]) => {
    // Replace cart completely — bump cartKey to force CartTab remount (clears lineStates, poResult, etc.)
    const freshCart = lines.map(l => ({
      ...l,
      isManual: true,
      autoVendorId: l.vendorId,
      requestSources: [],
      requestedTotalQty: 0,
    }));
    setCart(freshCart);
    setCartKey(k => k + 1);
    setTab('cart');
  }, []);

  const handleShareHistory = useCallback((order: PastOrder) => {
    const vendor = getV(vendorMap, order.vendorId);
    const msg    = buildWaMessage(vendor, order.lines, order.poId);
    const phone  = vendor.phone.replace(/\D/g, '');
    if (phone) window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    else if (navigator.share) navigator.share({ title: 'Purchase Order', text: msg }).catch(() => {});
    else navigator.clipboard.writeText(msg).then(() => alert('Copied to clipboard'));
  }, [vendorMap]);

  const handleRetrySuccess = useCallback((dbId: number, poId: string) => {
    setHistoryOrders(prev => prev.map(o =>
      o.dbId === dbId
        ? { ...o, status: 'po_created' as const, poId, id: poId, errorMessage: undefined }
        : o
    ));
  }, []);

  const handleDeleteSuccess = useCallback((dbId: number) => {
    setHistoryOrders(prev => prev.filter(o => o.dbId !== dbId));
  }, []);

  if (!token) return null;

  const shortageCount  = shortageItems.filter(i => i.totalRequestedQty > 0).length;
  const addedShortage  = shortageItems.filter(i => i.totalRequestedQty > 0 && cart.some(l => l.itemCode === i.itemCode)).length;
  const vendorCount    = new Set(cart.map(l => l.vendorId)).size;
  const grandTotal     = cart.reduce((s, l) => s + l.qty * l.rate, 0);

  return (
    <div className="vpage">
      <style>{CSS}</style>

      {/* Header */}
      <div className="vhdr">
        <div className="vhdr-top">
          <button className="vhdr-back" onClick={() => router.push('/store')}>←</button>
          <div style={{ flex: 1 }}>
            <div className="vhdr-title">Order to Vendor</div>
            <div className="vhdr-sub">
              {catalogStatus
                ? catalogStatus.last_synced
                  ? `Synced ${fmtShort(catalogStatus.last_synced.slice(0,10))} · ${catalogStatus.items} items`
                  : `${catalogStatus.items} items cached`
                : 'Main Store'}
              {' · '}{fmtShort(TODAY_STR)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              onClick={handleRefreshCatalog}
              disabled={refreshing}
              title="Sync catalog from ERP"
              style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: refreshing ? '#6B7280' : '#D1FAE5',
                width: 32, height: 32, borderRadius: '50%', cursor: refreshing ? 'wait' : 'pointer',
                fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {refreshing ? '⏳' : '🔄'}
            </button>
          </div>
        </div>

        <div className="vsumbar">
          <div className="vsb r"><span className="vsbn">{shortageCount}</span><span className="vsbl">Requests</span></div>
          <div className="vsb o"><span className="vsbn">{addedShortage}</span><span className="vsbl">In order</span></div>
          <div className="vsb w"><span className="vsbn">{cart.length}</span><span className="vsbl">Cart items</span></div>
          <div className="vsb g"><span className="vsbn">{inr(grandTotal)}</span><span className="vsbl">Total</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="vtabs">
        <button className={`vtab ${tab === 'shortage' ? 'on' : ''}`} onClick={() => setTab('shortage')}>
          Requests
          <span className={`vtabcnt ${shortageCount > 0 ? '' : 'muted'}`}>{shortageCount}</span>
        </button>
        <button className={`vtab ${tab === 'add' ? 'on' : ''}`} onClick={() => setTab('add')}>
          Add Items
        </button>
        <button className={`vtab ${tab === 'cart' ? 'on' : ''}`} onClick={() => setTab('cart')}>
          Cart
          <span className={`vtabcnt ${cart.length > 0 ? 'gn' : 'muted'}`}>{cart.length}</span>
        </button>
        <button className={`vtab ${tab === 'history' ? 'on' : ''}`} onClick={() => setTab('history')}>
          History
          <span className="vtabcnt muted">{historyOrders.length}</span>
        </button>
      </div>

      {/* Body */}
      <div className="vbody">
        {tab === 'shortage' && (
          <ShortageTab
            items={shortageItems}
            cart={cart}
            vendorMap={vendorMap}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onChangeVendor={handleChangeVendor}
            onRateChange={handleRateChange}
            loading={loadingShortage}
            error={shortageError}
          />
        )}
        {tab === 'add' && (
          <AddItemsTab
            shortageItems={shortageItems}
            cart={cart}
            vendorMap={vendorMap}
            token={token}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onChangeVendor={handleChangeVendor}
          />
        )}
        {tab === 'cart' && (
          <CartTab
            key={cartKey}
            cart={cart}
            vendorMap={vendorMap}
            shortageItems={shortageItems}
            token={token}
            onQtyChange={handleQtyChange}
            onRemove={handleRemove}
            onChangeVendor={handleChangeVendor}
            onRateChange={handleRateChange}
            onOrderSuccess={handleOrderSuccess}
          />
        )}
        {tab === 'history' && (
          <HistoryTab
            orders={historyOrders}
            vendorMap={vendorMap}
            loading={loadingHistory}
            token={token}
            onShare={handleShareHistory}
            onReorder={handleReorder}
            onRetrySuccess={handleRetrySuccess}
            onDeleteSuccess={handleDeleteSuccess}
          />
        )}
      </div>

      {/* Sticky bottom bar — go to cart to place order */}
      {cart.length > 0 && tab !== 'cart' && (
        <div className="bbar">
          <div className="bbar-inner">
            <button className="bbar-primary" onClick={() => setTab('cart')}>
              🛒 Cart ({cart.length} items · {vendorCount} vendor{vendorCount !== 1 ? 's' : ''}) → Place Order
            </button>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
