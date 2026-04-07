import type { PlayerSettings } from "@/lib/profile";

export const SettingsPanel = ({
  settings,
  onChange,
}: {
  settings: PlayerSettings;
  onChange: (next: Partial<PlayerSettings>) => void;
}) => (
  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
    <h3 className="text-lg font-semibold uppercase tracking-[0.25em] text-white/80">
      Settings
    </h3>
    <div className="mt-4 space-y-4">
      <label className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-white">
        <span className="text-sm uppercase tracking-[0.2em] text-white/70">Sound FX</span>
        <input
          type="checkbox"
          checked={settings.sound}
          onChange={(event) => onChange({ sound: event.target.checked })}
          className="h-5 w-5 accent-white"
        />
      </label>
      <label className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-white">
        <span className="text-sm uppercase tracking-[0.2em] text-white/70">Haptics</span>
        <input
          type="checkbox"
          checked={settings.haptics}
          onChange={(event) => onChange({ haptics: event.target.checked })}
          className="h-5 w-5 accent-white"
        />
      </label>
    </div>
  </div>
);
