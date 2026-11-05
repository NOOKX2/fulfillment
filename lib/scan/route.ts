import { skuByBarcode } from "../domain/core";
import type { AppState } from "../domain/types";
import { parseScan } from "./parse";

/** Where a globally scanned barcode should take the operator (console top bar). */
export function routeForScan(s: AppState, raw: string): string | null {
  const p = parseScan(raw);
  const v = p.value.toLowerCase();
  switch (p.kind) {
    case "asn": {
      const a = s.asns.find((x) => x.asnNo.toLowerCase() === v || x.id.toLowerCase() === v);
      return a ? `/console/inbound/asn/${a.id}` : null;
    }
    case "order": {
      const o = s.orders.find(
        (x) => x.id.toLowerCase() === v || x.channelOrderNo.toLowerCase() === v,
      );
      return o ? `/console/orders/${o.id}` : null;
    }
    case "return": {
      const r = s.returns.find((x) => x.rmaNo.toLowerCase() === v || x.id.toLowerCase() === v);
      return r ? `/console/returns/${r.id}` : null;
    }
    case "tracking": {
      const sh = s.shipments.find((x) => x.trackingNo.toLowerCase() === v);
      if (sh) return `/console/orders/${sh.orderId}`;
      const r = s.returns.find((x) => x.returnTrackingNo.toLowerCase() === v);
      return r ? `/console/returns/${r.id}` : null;
    }
    case "bin":
      return s.bins.some((b) => b.barcode.toLowerCase() === p.raw.toLowerCase())
        ? `/console/locations?bin=${encodeURIComponent(p.raw)}`
        : null;
    case "tote":
      return "/console/pack/bench";
    case "sku": {
      const k = skuByBarcode(s, p.value);
      return k ? `/console/inventory?q=${encodeURIComponent(k.code)}` : null;
    }
    default:
      return null;
  }
}
