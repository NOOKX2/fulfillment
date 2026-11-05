"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle, PageHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/form";
import { useT } from "@/lib/i18n/useT";
import { actions } from "@/lib/store/actions";
import { getData, useWms } from "@/lib/store/store";

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 accent-gold-deep"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Settings() {
  const { tr, l } = useT();
  const settings = useWms((s) => s.data.settings);
  const [confirm, setConfirm] = useState(false);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fulfillment-wms-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={tr("ตั้งค่า", "Settings")}
        subtitle={tr("ปรับค่าของเดโม: เสียง รอบตัดส่งของขนส่ง และสวิตช์จำลองความล้มเหลว", "Demo options: sound, carrier cut-off times and failure simulation.")}
      />

      <Card className="mb-4">
        <CardTitle>{tr("การแจ้งเตือนสแกน", "Scan feedback")}</CardTitle>
        <Toggle
          label={tr("เสียงเตือน (สแกนถูก/ผิด)", "Sound (scan OK / error)")}
          hint={tr("เบราว์เซอร์ต้องการให้แตะหน้าจอก่อนจึงจะเปิดเสียงได้", "Browsers require a tap before audio can play.")}
          checked={settings.soundOn}
          onChange={(v) => actions.setSetting("soundOn", v)}
        />
        <Toggle
          label={tr("สั่น (อุปกรณ์ที่รองรับ)", "Vibrate (supported devices)")}
          checked={settings.vibrateOn}
          onChange={(v) => actions.setSetting("vibrateOn", v)}
        />
      </Card>

      <Card className="mb-4">
        <CardTitle>{tr("รอบตัดส่งขนส่ง (เวลาไทย UTC+7)", "Carrier cut-off times (Thailand time, UTC+7)")}</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {settings.carriers.map((c) => (
            <Field key={c.code} label={l(c.name)}>
              <Input
                type="time"
                value={c.cutoffLocal}
                onChange={(e) => e.target.value && actions.setCutoff(c.code, e.target.value)}
              />
            </Field>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          {tr(
            "พัสดุที่วางในเลนหลังเวลานี้ต้องระบุหมายเหตุว่าส่งล่าช้า",
            "Parcels staged after the cut-off need a late-handover note.",
          )}
        </p>
      </Card>

      <Card className="mb-4">
        <CardTitle>{tr("จำลองการเชื่อมต่อแพลตฟอร์ม", "Platform integration simulation")}</CardTitle>
        <Toggle
          label={tr("ให้การส่งสถานะครั้งถัดไปล้มเหลว", "Fail the next outbound status push")}
          hint={tr("ใช้ทดสอบการลองส่งซ้ำในหน้า Outbox", "Use to test retry on the Outbox page.")}
          checked={settings.failOutboxNext}
          onChange={(v) => actions.setSetting("failOutboxNext", v)}
        />
      </Card>

      <Card>
        <CardTitle>{tr("ข้อมูลเดโม", "Demo data")}</CardTitle>
        <p className="mb-3 text-sm text-muted">
          {tr(
            "ข้อมูลทั้งหมดถูกเก็บไว้ในเบราว์เซอร์นี้เท่านั้น (localStorage) ไม่มีการส่งออกไปเซิร์ฟเวอร์",
            "All data stays in this browser (localStorage). Nothing is sent to a server.",
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={exportJson}>
            ⬇ {tr("ส่งออก JSON", "Export JSON")}
          </Button>
          {confirm ? (
            <>
              <span className="text-sm">{tr("ล้างข้อมูลทั้งหมดแล้วเริ่มใหม่?", "Erase everything and start over?")}</span>
              <Button
                variant="danger"
                onClick={() => {
                  actions.resetDemo();
                  setConfirm(false);
                }}
              >
                {tr("ยืนยันรีเซ็ต", "Confirm reset")}
              </Button>
              <Button variant="secondary" onClick={() => setConfirm(false)}>
                {tr("ยกเลิก", "Cancel")}
              </Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              ↺ {tr("รีเซ็ตข้อมูลเดโม", "Reset demo data")}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
