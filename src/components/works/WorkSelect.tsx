import { useMemo } from 'react';
import type { VolumeRow, WorkRow } from '@/lib/dbWorks';
import { sortWorks, volumeLabel } from '@/lib/works';

interface WorkSelectProps {
  id?: string;
  volumes: VolumeRow[];
  works: WorkRow[];
  /** Work id, or '' for none */
  value: string;
  onChange: (workId: string) => void;
  disabled?: boolean;
}

/** Pick one work, listed under its volume */
export function WorkSelect({ id, volumes, works, value, onChange, disabled }: WorkSelectProps) {
  const groups = useMemo(() => {
    const byVolume = new Map<string, WorkRow[]>();
    for (const work of sortWorks(works, volumes, 'volume')) {
      const key = work.volume ?? '';
      byVolume.set(key, [...(byVolume.get(key) ?? []), work]);
    }
    return [...byVolume].map(([number, list]) => {
      const volume = volumes.find((v) => v.number === number);
      return { label: volume ? volumeLabel(volume) : 'Outside the Collected Works', works: list };
    });
  }, [works, volumes]);

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
    >
      <option value="">Choose a text…</option>
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.works.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
