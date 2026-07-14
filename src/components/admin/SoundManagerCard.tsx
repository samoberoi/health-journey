import { useEffect, useState } from "react";
import { Volume2, VolumeX, Play, Save, Music4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  getNotificationSoundSettings,
  saveNotificationSoundSettings,
  DEFAULT_SOUND_SETTINGS,
  type NotificationSoundSettings,
} from "@/lib/notificationSoundService";
import {
  NOTIFICATION_SOUND_OPTIONS,
  playNotificationSound,
  setMasterVolume,
  type BbdoNotificationSound,
} from "@/lib/soundEngine";

/**
 * Global sound manager for notifications. Ships a signature BBDO chime by
 * default, but admins can swap the variant, tune volume, or mute all sounds
 * app-wide. Settings persist to `app_settings` and are read by every client
 * that subscribes to realtime notifications.
 */
export default function SoundManagerCard() {
  const [settings, setSettings] = useState<NotificationSoundSettings>(DEFAULT_SOUND_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getNotificationSoundSettings()
      .then((s) => setSettings(s))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof NotificationSoundSettings>(k: K, v: NotificationSoundSettings[K]) {
    setSettings((s) => ({ ...s, [k]: v }));
    setDirty(true);
  }

  function preview(variant?: BbdoNotificationSound) {
    setMasterVolume(settings.volume);
    playNotificationSound(variant ?? settings.variant);
  }

  async function onSave() {
    setSaving(true);
    try {
      await saveNotificationSoundSettings(settings);
      toast.success("Notification sound updated for everyone");
      setDirty(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border rounded-xl p-4 sm:p-5 bg-card space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-black flex items-center gap-2">
            <Music4 className="w-5 h-5" /> Sound Manager
          </h3>
          <p className="text-sm text-muted-foreground">
            The BBDO signature chime plays on every incoming notification.
            Pick a variant, tune volume, or mute app-wide.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => preview()} disabled={!settings.enabled}>
            <Play className="w-4 h-4 mr-1" /> Preview
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving || !dirty || loading}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          {settings.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-semibold">Play sound on notifications</span>
        </div>
        <Switch checked={settings.enabled} onCheckedChange={(v) => update("enabled", v)} />
      </div>

      <div className={settings.enabled ? "" : "opacity-50 pointer-events-none"}>
        <div className="space-y-2">
          <Label>Volume · {Math.round(settings.volume * 100)}%</Label>
          <Slider
            min={0}
            max={100}
            step={5}
            value={[Math.round(settings.volume * 100)]}
            onValueChange={([v]) => update("volume", Math.max(0, Math.min(1, (v ?? 0) / 100)))}
          />
        </div>

        <div className="mt-5 space-y-2">
          <Label>Sound variant</Label>
          <RadioGroup
            value={settings.variant}
            onValueChange={(v) => update("variant", v as BbdoNotificationSound)}
            className="grid gap-2"
          >
            {NOTIFICATION_SOUND_OPTIONS.map((opt) => {
              const active = settings.variant === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    active ? "border-primary bg-primary/5" : "hover:bg-accent/40"
                  }`}
                >
                  <RadioGroupItem value={opt.value} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{opt.label}</span>
                      {opt.value === "bbdo_signature" && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          Brand
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      preview(opt.value);
                    }}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </label>
              );
            })}
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}
