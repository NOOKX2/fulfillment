"use client";

import Link from "next/link";
import { useState } from "react";

interface StepLink {
  href: string;
  label: string;
  primary?: boolean;
}

interface Step {
  id: number;
  title: string;
  titleEn: string;
  summary: string;
  minutes: string;
  menu: string;
  url: string;
  actions: string[];
  result: string;
  effect: string;
  links: StepLink[];
}

const STEPS: Step[] = [
  {
    id: 1,
    title: "รับสินค้าเข้า",
    titleEn: "Inbound",
    summary: "สแกน ASN → ตรวจคุณภาพ (QC) → ยืนยันรับเข้า",
    minutes: "~1 นาที",
    menu: "Sidebar › รับสินค้า, ตรวจคุณภาพ",
    url: "/console/inbound",
    actions: [
      "เปิด /console/inbound แล้วเลือกแถว ASN ที่สถานะ “รอรับ” หรือ “กำลังรับ” เพื่อเข้าหน้ารายละเอียด ASN",
      "ในกล่อง “สแกนรับสินค้า” กดแถบ “ตัวจำลองการสแกน (เดโม)” แล้วแตะชิปสินค้าเพื่อจำลองการสแกนบาร์โค้ด (หรือพิมพ์บาร์โค้ดแล้วกด Enter) ทำซ้ำจนครบจำนวน",
      "สินค้าที่ต้องระบุล็อต/วันหมดอายุ ให้กรอกแล้วกด “บันทึกและรับ”",
      "ไปที่ /console/inbound/qc กดปุ่ม “ตรวจ QC” ที่แถวสินค้า แล้วกด “บันทึกผล QC”",
      "กลับมาที่หน้า ASN แล้วกด “ปิด ASN” (ถ้ามีส่วนต่างให้กด “รับทราบและปิด”)",
    ],
    result:
      "สต็อกที่รับเข้าจะอยู่สถานะ “รอ QC” ก่อน (ยังขายไม่ได้) เมื่อบันทึกผล QC ชิ้นที่ผ่านจะเป็น “พร้อมขาย” ชิ้นที่ไม่ผ่านไปโซนกักกัน และ ASN เปลี่ยนเป็นปิดแล้ว",
    effect:
      "ระบบสร้างงานจัดเก็บ (Putaway task) ให้อัตโนมัติ และตัวเลขใน /console/inventory เปลี่ยนจาก “รอ QC” เป็น “ขายได้” — สเต็ป 2 จะเห็นงานรอจัดเก็บ",
    links: [
      { href: "/console/inbound", label: "ไปหน้ารับสินค้า", primary: true },
      { href: "/console/inbound/qc", label: "คิวตรวจ QC" },
      { href: "/console/inbound/discrepancies", label: "รายการส่วนต่าง" },
    ],
  },
  {
    id: 2,
    title: "จัดเก็บเข้าตำแหน่ง",
    titleEn: "Putaway",
    summary: "ดูผัง Bin → ย้ายของเข้าช่องจัดเก็บ",
    minutes: "~1 นาที",
    menu: "Sidebar › ผังตำแหน่งจัดเก็บ, จัดเก็บเข้าตำแหน่ง",
    url: "/console/putaway",
    actions: [
      "เปิด /console/locations เพื่อดูผัง Bin (โซน/ชั้น/ช่อง และความจุที่ใช้อยู่)",
      "เปิด /console/putaway กดปุ่ม “ทำงาน” ที่งานจัดเก็บแรก ระบบแสดงช่องที่แนะนำ 3 อันดับพร้อมเหตุผล (กด “คำนวณใหม่” ได้)",
      "ขั้นที่ 1: สแกนสินค้า (ใช้ตัวจำลองการสแกน) ขั้นที่ 2: สแกนป้ายช่อง — ชิปอันดับ #1 คือช่องที่แนะนำ",
      "ถ้าสแกนช่องที่ไม่ได้แนะนำ ระบบจะขอ “เหตุผลที่เปลี่ยนตำแหน่ง” ให้กรอกก่อนยืนยัน",
    ],
    result: "งานจัดเก็บเปลี่ยนเป็น “เสร็จสิ้น” สต็อกย้ายเข้า Bin ที่เลือก และบันทึกใน ledger พร้อมเหตุผล (ถ้ามี)",
    effect:
      "สินค้าอยู่ใน Bin ที่หยิบได้จริงแล้ว จึงนับเป็นยอด ATP ในสเต็ป 3 และเป็นต้นทางของรายการหยิบในสเต็ป 4 — ดูผลที่ /console/locations",
    links: [
      { href: "/console/locations", label: "ผังตำแหน่งจัดเก็บ" },
      { href: "/console/putaway", label: "ไปหน้าจัดเก็บ", primary: true },
    ],
  },
  {
    id: 3,
    title: "คำสั่งซื้อและสต็อก",
    titleEn: "Orders & Inventory",
    summary: "เช็กยอดขายได้ (ATP) → จองสินค้า",
    minutes: "~1 นาที",
    menu: "Sidebar › สต็อกคงคลัง, คำสั่งซื้อ",
    url: "/console/orders",
    actions: [
      "เปิด /console/inventory ดูคอลัมน์ “ขายได้” และ “ล็อกไว้” ของสินค้า (ATP = ขายได้ − จัดสรร − จองอยู่)",
      "เปิด /console/orders กด “ดึงออเดอร์ใหม่ 3 รายการ” เพื่อจำลองออเดอร์จาก Shopee / Lazada / TikTok",
      "ออเดอร์สถานะ “รอชำระ” กด “รับชำระ” — ระบบจองสต็อกทั้งออเดอร์ในครั้งเดียว (ไม่ครบ = ไม่จองบางส่วน)",
      "ถ้าของไม่พอ ออเดอร์จะเป็น “รอสต็อก” เมื่อมีของเข้าแล้วกด “ลองใหม่”",
      "ออเดอร์ที่จองแล้ว กด “จัดสรรล็อต” (เลือกล็อตแบบ FEFO สำหรับสินค้ามีวันหมดอายุ ไม่งั้น FIFO)",
    ],
    result: "ออเดอร์เปลี่ยนเป็น “จองแล้ว” แล้วเป็น “จัดสรรแล้ว” ยอด ATP ของสินค้านั้นลดลงทันทีโดยไม่ขายเกินสต็อก",
    effect: "ออเดอร์ที่ “จัดสรรแล้ว” คือออเดอร์ที่พร้อมถูกรวมเป็นรอบหยิบ — ตัวเลข “ออเดอร์พร้อม” ในสเต็ป 4 มาจากตรงนี้",
    links: [
      { href: "/console/inventory", label: "สต็อกคงคลัง (ATP)" },
      { href: "/console/orders", label: "ไปหน้าคำสั่งซื้อ", primary: true },
    ],
  },
  {
    id: 4,
    title: "จัดรอบหยิบล็อต",
    titleEn: "Wave Picking",
    summary: "รวมออเดอร์ → สร้าง Wave หยิบ",
    minutes: "~1 นาที",
    menu: "Sidebar › รอบหยิบ",
    url: "/console/waves",
    actions: [
      "เปิด /console/waves กดปุ่ม “สร้างรอบหยิบ (N ออเดอร์พร้อม)” — ระบบแบ่งกลุ่มตามขนส่งและขนาดกล่อง/ซอง",
      "ที่การ์ดรอบหยิบสถานะ “ร่าง” กด “ปล่อยรอบหยิบ”",
      "กด “หยิบบนหน้านี้” แล้วสแกน “ช่อง” ก่อน จากนั้นสแกน “สินค้า” ตามลำดับเส้นทางหยิบ (ถ้าสแกนสินค้าก่อนจะถูกปฏิเสธ)",
      "หยิบครบทุกจุดแล้วกด “ปิดรอบ” (หรือทำบนมือถือที่ /pda/pick)",
    ],
    result: "ออเดอร์เปลี่ยนเป็น “อยู่ในรอบหยิบ” → “หยิบแล้ว” และของถูกใส่ตะกร้า (tote) แยกตามออเดอร์",
    effect: "ออเดอร์ที่ “หยิบแล้ว” จะปรากฏในคิวแพ็กของสเต็ป 5 พร้อมตะกร้าที่ต้องสแกน",
    links: [
      { href: "/console/waves", label: "ไปหน้ารอบหยิบ", primary: true },
      { href: "/pda/pick", label: "หยิบบนโหมด PDA" },
    ],
  },
  {
    id: 5,
    title: "คิวแพ็กพัสดุ",
    titleEn: "Packing",
    summary: "สแกนบาร์โค้ดลงกล่อง → พิมพ์ใบปะหน้า (AWB)",
    minutes: "~1 นาที",
    menu: "Sidebar › คิวแพ็ก, โต๊ะแพ็ก",
    url: "/console/pack/bench",
    actions: [
      "เปิด /console/pack ดูคิวออเดอร์ที่หยิบแล้ว แล้วเข้า /console/pack/bench",
      "สแกนตะกร้า (หรือออเดอร์) แล้วกด “เริ่มแพ็ก”",
      "สแกนสินค้าทีละชิ้นลงกล่อง — ถ้าสแกนผิด ไฟแดงจะค้างจน “เอาออกแล้ว – ปิดไฟแดง” (ผิดครบ 3 ครั้งต้องให้ “หัวหน้างานปลดล็อก”)",
      "เมื่อครบ ระบบเลือกขนาดกล่องให้ ตรวจแล้วออกใบปะหน้า จากนั้นกด “พิมพ์ใบปะหน้า” (ใบปะหน้า 100×150 มม. พร้อมบาร์โค้ด Code128)",
      "กด “ออเดอร์ถัดไป →” เพื่อแพ็กออเดอร์ต่อไป",
    ],
    result: "ออเดอร์เป็น “แพ็กแล้ว” ได้เลขพัสดุ (tracking) และพัสดุสถานะ “พิมพ์ใบปะหน้าแล้ว” — ออกใบปะหน้าไม่ได้ถ้ายังสแกนไม่ตรง",
    effect: "พัสดุที่พิมพ์ใบปะหน้าแล้วจะอยู่ในรายการ “ยังไม่ได้จัดเรียง” ของหน้าจัดเรียงขนส่งในสเต็ป 6",
    links: [
      { href: "/console/pack", label: "คิวแพ็ก" },
      { href: "/console/pack/bench", label: "ไปโต๊ะแพ็ก", primary: true },
    ],
  },
  {
    id: 6,
    title: "จัดส่งและตัดรอบ",
    titleEn: "Outbound Dispatch",
    summary: "รวมพัสดุขึ้นรถขนส่ง",
    minutes: "~1 นาที",
    menu: "Sidebar › จัดเรียงตามขนส่ง, ใบส่งมอบ, ส่งสถานะไปแพลตฟอร์ม",
    url: "/console/shipping/staging",
    actions: [
      "เปิด /console/shipping/staging สแกนเลขพัสดุเพื่อวางลงเลนของขนส่ง (หรือกด “วางในเลน”) — ถ้าเลยเวลา cut-off ต้องใส่หมายเหตุก่อนยืนยัน",
      "ที่การ์ดของขนส่งกด “สร้างใบส่งมอบ” ระบบพาไปหน้าใบส่งมอบ",
      "สแกนพัสดุขึ้นรถทีละชิ้น (พัสดุหาย/เสียหายกดบันทึกเป็นข้อยกเว้น) แล้วกด “ปิดรายการสแกน”",
      "กรอกชื่อคนขับ ทะเบียนรถ ให้เซ็นในกรอบ แล้วกด “ยืนยันส่งมอบ” จากนั้นกด “พิมพ์ใบส่งมอบ A4” ได้",
      "ดูผลที่ /console/integrations/outbox — ระบบแจ้ง “จัดส่งแล้ว” กลับช่องทางขาย (ล้มเหลวให้กด “ลองส่งใหม่”)",
    ],
    result: "พัสดุและออเดอร์เป็น “ส่งมอบแล้ว” สต็อกถูกตัดออกจากคลังจริง (ledger ประเภท ship) และสร้างเหตุการณ์แจ้งแพลตฟอร์มต่อออเดอร์",
    effect: "ออเดอร์ที่ส่งมอบแล้วเป็นต้นทางของ “คืนสินค้า” — ทดสอบต่อได้ที่ /console/returns (กด “สร้างรายการคืนจำลอง”)",
    links: [
      { href: "/console/shipping/staging", label: "ไปหน้าจัดเรียงขนส่ง", primary: true },
      { href: "/console/shipping/manifests", label: "ใบส่งมอบ" },
      { href: "/console/integrations/outbox", label: "Outbox แจ้งแพลตฟอร์ม" },
      { href: "/console/returns", label: "คืนสินค้า (ต่อยอด)" },
    ],
  },
];

const URL_MAP: { menu: string; url: string; step: number }[] = [
  { menu: "รับสินค้า", url: "/console/inbound", step: 1 },
  { menu: "ตรวจคุณภาพ", url: "/console/inbound/qc", step: 1 },
  { menu: "ผังตำแหน่งจัดเก็บ", url: "/console/locations", step: 2 },
  { menu: "จัดเก็บเข้าตำแหน่ง", url: "/console/putaway", step: 2 },
  { menu: "สต็อกคงคลัง", url: "/console/inventory", step: 3 },
  { menu: "คำสั่งซื้อ", url: "/console/orders", step: 3 },
  { menu: "รอบหยิบ", url: "/console/waves", step: 4 },
  { menu: "คิวแพ็ก", url: "/console/pack", step: 5 },
  { menu: "โต๊ะแพ็ก", url: "/console/pack/bench", step: 5 },
  { menu: "จัดเรียงตามขนส่ง", url: "/console/shipping/staging", step: 6 },
  { menu: "ใบส่งมอบ", url: "/console/shipping/manifests", step: 6 },
  { menu: "ส่งสถานะไปแพลตฟอร์ม", url: "/console/integrations/outbox", step: 6 },
];

const PREFIXES = [
  { p: "LOC:", d: "ป้ายช่องเก็บ (Bin)" },
  { p: "ORD:", d: "ออเดอร์" },
  { p: "TOT:", d: "ตะกร้าหยิบ (Tote)" },
  { p: "ASN:", d: "ใบแจ้งรับสินค้า" },
  { p: "RMA:", d: "รายการรับคืน" },
  { p: "TRK:", d: "เลขพัสดุ" },
];

export default function FlowPage() {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const count = STEPS.filter((s) => done[s.id]).length;

  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="font-bold tracking-tight">
            ◆ Fulfillment WMS <span className="ml-2 text-sm font-normal text-silver-metal">Demo Flow</span>
          </div>
          <Link
            href="/console"
            className="rounded-md border border-white px-3 py-1.5 text-sm font-semibold hover:bg-white/10"
          >
            ← กลับสู่ Console
          </Link>
        </div>
      </header>

      <section className="bg-silver">
        <div className="mx-auto max-w-5xl px-5 py-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">
            Interactive Demo Flow &amp; System Cheatsheet
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">สคริปต์เดโม 5 นาที ตั้งแต่รับของจนถึงส่งขึ้นรถ</h1>
          <p className="mt-3 max-w-3xl text-base text-muted">
            ทำตามทีละสเต็ป กดลิงก์เพื่อเปิดหน้านั้นทันที ข้อมูลทั้งหมดเป็นข้อมูลจำลองเก็บในเบราว์เซอร์ และใช้ “ตัวจำลองการสแกน”
            แทนเครื่องสแกนจริง หากต้องการเริ่มใหม่ ให้กด “รีเซ็ตข้อมูลเดโม” ที่เมนูด้านล่างของ Sidebar
          </p>
          <div className="mt-6 max-w-md">
            <div className="mb-1 flex justify-between text-sm font-semibold">
              <span>ความคืบหน้า</span>
              <span>
                {count}/{STEPS.length}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={STEPS.length}
              aria-valuenow={count}
              className="h-3 overflow-hidden rounded-full bg-white"
            >
              <div className="h-full bg-ink transition-all" style={{ width: `${(count / STEPS.length) * 100}%` }} />
            </div>
          </div>
          <nav aria-label="steps" className="mt-6 flex flex-wrap gap-2">
            {STEPS.map((s) => (
              <a
                key={s.id}
                href={`#step-${s.id}`}
                className={`flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-semibold ${
                  done[s.id] ? "border-ink bg-ink text-white" : "border-ink bg-white text-ink hover:bg-silver"
                }`}
              >
                <span aria-hidden>{done[s.id] ? "✓" : s.id}</span>
                {s.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="bg-white">
        <ol className="mx-auto max-w-5xl space-y-6 px-5 py-10">
          {STEPS.map((s) => (
            <li
              key={s.id}
              id={`step-${s.id}`}
              className={`scroll-mt-6 rounded-xl border-2 bg-white ${done[s.id] ? "border-silver-metal" : "border-ink"}`}
            >
              <div className="flex flex-wrap items-start gap-4 border-b border-silver-metal p-5">
                <div
                  aria-hidden
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-xl font-bold text-white"
                >
                  {s.id}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h2 className="text-xl font-bold">{s.title}</h2>
                    <span className="text-sm text-muted">{s.titleEn}</span>
                    <span className="rounded-full bg-silver px-2 py-0.5 text-xs font-semibold text-muted">{s.minutes}</span>
                  </div>
                  <p className="mt-1 text-muted">{s.summary}</p>
                </div>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="size-5 accent-ink"
                    checked={Boolean(done[s.id])}
                    onChange={(e) => setDone((d) => ({ ...d, [s.id]: e.target.checked }))}
                  />
                  ทำแล้ว
                </label>
              </div>

              <div className="grid gap-5 p-5 md:grid-cols-5">
                <div className="space-y-4 md:col-span-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted">1 · ไปที่ไหน</h3>
                    <p className="mt-1 text-sm">{s.menu}</p>
                    <code className="mt-1 inline-block rounded bg-silver px-2 py-1 font-mono text-sm">{s.url}</code>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted">2 · ต้องกดอะไร</h3>
                    <ol className="mt-2 space-y-2 text-sm">
                      {s.actions.map((a, i) => (
                        <li key={a} className="flex gap-3">
                          <span
                            aria-hidden
                            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink text-xs font-bold"
                          >
                            {i + 1}
                          </span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <div className="rounded-lg bg-silver p-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted">3 · ผลลัพธ์</h3>
                    <p className="mt-1 text-sm">{s.result}</p>
                  </div>
                  <div className="rounded-lg border-2 border-dashed border-muted p-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted">ส่งผลต่อหน้าถัดไป</h3>
                    <p className="mt-1 text-sm">{s.effect}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-silver-metal bg-silver/50 p-4">
                {s.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={
                      l.primary
                        ? "inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white hover:bg-black"
                        : "inline-flex min-h-11 items-center gap-2 rounded-md border-2 border-ink bg-white px-4 text-sm font-semibold text-ink hover:bg-silver"
                    }
                  >
                    {l.label} <span aria-hidden>→</span>
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-silver">
        <div className="mx-auto grid max-w-5xl gap-6 px-5 py-10 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-lg font-bold">Cheatsheet: เมนู → URL</h2>
            <div className="overflow-hidden rounded-lg border border-silver-metal bg-white">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-ink text-white">
                  <tr>
                    <th className="px-3 py-2">สเต็ป</th>
                    <th className="px-3 py-2">เมนู Sidebar</th>
                    <th className="px-3 py-2">URL</th>
                  </tr>
                </thead>
                <tbody>
                  {URL_MAP.map((r) => (
                    <tr key={r.url} className="border-t border-silver">
                      <td className="px-3 py-2 font-semibold">{r.step}</td>
                      <td className="px-3 py-2">{r.menu}</td>
                      <td className="px-3 py-2">
                        <Link href={r.url} className="font-mono text-xs underline">
                          {r.url}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-lg font-bold">Cheatsheet: คำนำหน้าบาร์โค้ด</h2>
              <ul className="divide-y divide-silver overflow-hidden rounded-lg border border-silver-metal bg-white text-sm">
                {PREFIXES.map((x) => (
                  <li key={x.p} className="flex items-center justify-between gap-3 px-3 py-2">
                    <code className="rounded bg-silver px-2 py-0.5 font-mono">{x.p}</code>
                    <span>{x.d}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">สตริงที่ไม่มีคำนำหน้าถือเป็นบาร์โค้ดสินค้า (SKU) พิมพ์แล้วกด Enter เท่ากับสแกน 1 ครั้ง</p>
            </div>
            <div className="rounded-lg border-2 border-dashed border-muted bg-white p-4 text-sm">
              <h2 className="mb-1 font-bold">เคล็ดลับตอนเดโม</h2>
              <ul className="list-disc space-y-1 pl-5">
                <li>ช่องค้นหาด้านบนของ Console สแกนแล้วพาไปหน้าที่เกี่ยวข้องให้เอง</li>
                <li>สลับภาษา ไทย / English ได้ที่แถบด้านบน</li>
                <li>พิมพ์บาร์โค้ดทดสอบจริงได้ที่ /console/dev/barcodes</li>
                <li>ทำบนมือถือ/เครื่อง PDA ได้ที่ /pda (รับ จัดเก็บ หยิบ คืนสินค้า)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-ink px-5 py-6 text-center text-sm text-silver-metal">
        Fulfillment WMS · Demo flow — ข้อมูลจำลอง ไม่เชื่อมต่อ API จริง
      </footer>
    </div>
  );
}
