import { describe, expect, it } from "vitest";
import { assertInvariants } from "./pickHelpers";
import { packedState } from "./flowHelpers";
import { outboxBegin, outboxFinish, outboxRetry } from "@/lib/domain/outbox";
import {
  createManifest,
  finishManifestScan,
  manifestScan,
  markManifestException,
  signManifest,
  stageScan,
} from "@/lib/domain/shipping";
import { ctx, must } from "./helpers";

const NIGHT = "2026-11-04T16:00:00.000Z"; // 23:00 Thailand, after every cut-off

describe("shipping: staging, manifest, handover, outbox", () => {
  const setup = packedState;

  it("rejects unknown tracking and parcels in the wrong state", () => {
    const s = setup(1);
    const r = stageScan(s, ctx(), { raw: "TH999999999" });
    expect(!r.ok && r.code).toBe("TRACKING_UNKNOWN");
    const sh = s.shipments[0];
    must(stageScan(s, ctx(), { raw: sh.trackingNo }));
    const again = stageScan(s, ctx(), { raw: sh.trackingNo });
    expect(!again.ok && again.code).toBe("SHIPMENT_STATE");
  });

  it("stages on time without a note and requires a note after the cut-off", () => {
    const s = setup(2);
    const [a, b] = s.shipments;
    const ok1 = must(stageScan(s, ctx(), { raw: a.trackingNo }));
    expect(ok1.late).toBe(false);
    expect(s.orders.find((o) => o.id === a.orderId)!.status).toBe("ready_to_ship");

    const r = stageScan(s, ctx(NIGHT), { raw: b.trackingNo });
    expect(!r.ok && r.code).toBe("LATE_NOTE_REQUIRED");
    expect(b.status).toBe("label_printed");
    const ok2 = must(stageScan(s, ctx(NIGHT), { raw: b.trackingNo, lateNote: "รถมาช้า" }));
    expect(ok2.late).toBe(true);
    expect(b.lateNote).toBe("รถมาช้า");
  });

  it("does not create an empty manifest", () => {
    const s = setup(1);
    const r = createManifest(s, ctx(), { carrier: "flash" });
    expect(!r.ok && r.code).toBe("EMPTY_MANIFEST");
  });

  it("runs the full handover: scan, exception, finish, signature, outbox", () => {
    const s = setup(3);
    for (const sh of s.shipments) must(stageScan(s, ctx(), { raw: sh.trackingNo }));
    const { manifestId } = must(createManifest(s, ctx(), { carrier: "flash" }));
    const m = s.manifests[0];
    expect(m.shipmentIds).toHaveLength(3);

    const wrong = manifestScan(s, ctx(), { manifestId, raw: "TH999999999" });
    expect(!wrong.ok && wrong.code).toBe("TRACKING_UNKNOWN");

    must(manifestScan(s, ctx(), { manifestId, raw: s.shipments[0].trackingNo }));
    must(manifestScan(s, ctx(), { manifestId, raw: s.shipments[1].trackingNo }));
    const early = finishManifestScan(s, ctx(), { manifestId });
    expect(!early.ok && early.code).toBe("UNSCANNED_PARCELS");

    must(markManifestException(s, { manifestId, shipmentId: s.shipments[2].id, reason: "missing" }));
    const fin = must(finishManifestScan(s, ctx(), { manifestId }));
    expect(fin.parcels).toBe(2);
    expect(m.status).toBe("awaiting_signature");
    // the excepted parcel goes back to the lane
    expect(s.shipments[2].status).toBe("staged");
    expect(s.shipments[2].manifestId).toBeUndefined();

    const noSig = signManifest(s, ctx(), { manifestId, driverName: "สมชาย", vehiclePlate: "1กข 1234" });
    expect(!noSig.ok && noSig.code).toBe("SIGNATURE_REQUIRED");
    const noDriver = signManifest(s, ctx(), { manifestId, driverName: " ", vehiclePlate: "", signatureKey: "k" });
    expect(!noDriver.ok && noDriver.code).toBe("DRIVER_REQUIRED");

    must(signManifest(s, ctx(), { manifestId, driverName: "สมชาย", vehiclePlate: "1กข 1234", signatureKey: "manifest-1" }));
    expect(m.status).toBe("handed_over");
    expect(s.shipments.filter((x) => x.status === "handed_over")).toHaveLength(2);
    expect(s.outbox.filter((e) => e.kind === "shipped")).toHaveLength(2);
    expect(s.allocations.filter((a) => a.status === "shipped")).toHaveLength(2);
    expect(assertInvariants(s)).toEqual([]);
    // a handed-over manifest cannot be scanned or signed again
    const again = manifestScan(s, ctx(), { manifestId, raw: s.shipments[0].trackingNo });
    expect(!again.ok && again.code).toBe("MANIFEST_STATE");
  });

  it("outbox: a simulated failure stays failed until retried", () => {
    const s = setup(1);
    must(stageScan(s, ctx(), { raw: s.shipments[0].trackingNo }));
    const { manifestId } = must(createManifest(s, ctx(), { carrier: "flash" }));
    must(manifestScan(s, ctx(), { manifestId, raw: s.shipments[0].trackingNo }));
    must(finishManifestScan(s, ctx(), { manifestId }));
    must(signManifest(s, ctx(), { manifestId, driverName: "ก", vehiclePlate: "ข", signatureKey: "k" }));
    const ev = s.outbox[0];
    s.settings.failOutboxNext = true;
    must(outboxBegin(s, ctx(), ev.id));
    expect(must(outboxFinish(s, ctx(), ev.id)).sent).toBe(false);
    expect(ev.status).toBe("failed");
    expect(s.settings.failOutboxNext).toBe(false);
    must(outboxRetry(s, ctx(), ev.id));
    must(outboxBegin(s, ctx(), ev.id));
    expect(must(outboxFinish(s, ctx(), ev.id)).sent).toBe(true);
    expect(ev.status).toBe("sent");
    expect(ev.attempts).toBe(2);
  });
});
