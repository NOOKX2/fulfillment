"use client";

import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";
import { beepOk, unlockAudio } from "@/lib/feedback/audio";
import { useT } from "@/lib/i18n/useT";
import { Button } from "../ui/Button";

/** Sound on/off. Toggling on is a user gesture, which also unlocks the AudioContext. */
export function SoundToggle({ onDark = false }: { onDark?: boolean }) {
  const on = useWms((s) => s.data.settings.soundOn);
  const { t } = useT();
  return (
    <Button
      variant="secondary"
      size="sm"
      onDark={onDark}
      aria-pressed={on}
      onClick={() => {
        unlockAudio();
        actions.setSetting("soundOn", !on);
        if (!on) beepOk();
      }}
    >
      {on ? "🔊" : "🔇"} {on ? t("scan.soundOn") : t("scan.soundOff")}
    </Button>
  );
}
