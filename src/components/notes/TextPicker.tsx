import { useMemo } from 'react';
import { BookOpen, Loader2, RefreshCw } from 'lucide-react';
import type { VolumeRow, WorkRow } from '@/lib/dbWorks';
import { sortWorks, volumeLabel } from '@/lib/works';

export interface TextSelection {
  /** Volume number, or '' for all */
  volume: string;
  /** Work id, or '' for every text in the volume */
  text: string;
}

interface TextPickerProps {
  volumes: VolumeRow[];
  works: WorkRow[];
  notesPerWork: Map<string, number>;
  notesPerVolume: Map<string, number>;
  value: TextSelection;
  onChange: (value: TextSelection) => void;
  /** Notes (and so the lists) are still loading */
  isLoading?: boolean;
  /** Loading failed; offer a retry */
  onRetry?: () => void;
}

const selectClass =
  'h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-xs '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

/** Choose a volume of the Collected Works, then one of its texts */
export function TextPicker({
  volumes, works, notesPerWork, notesPerVolume, value, onChange, isLoading, onRetry,
}: TextPickerProps) {
  // Only volumes and texts that have paragraphs
  const shownVolumes = useMemo(() => volumes.filter((v) => notesPerVolume.has(v.number)), [volumes, notesPerVolume]);
  const shownWorks = useMemo(
    () => sortWorks(works.filter((w) => notesPerWork.has(w.id)), volumes, 'volume'),
    [works, volumes, notesPerWork],
  );
  const textsInVolume = value.volume ? shownWorks.filter((w) => w.volume === value.volume) : shownWorks;

  // Without a volume, texts are grouped under their volumes
  const groups = useMemo(() => {
    const byVolume = new Map<string, WorkRow[]>();
    for (const work of shownWorks) {
      const key = work.volume ?? '';
      byVolume.set(key, [...(byVolume.get(key) ?? []), work]);
    }
    return [...byVolume].map(([number, list]) => {
      const volume = volumes.find((v) => v.number === number);
      return { label: volume ? volumeLabel(volume) : 'Outside the Collected Works', works: list };
    });
  }, [shownWorks, volumes]);

  const option = (work: WorkRow) => (
    <option key={work.id} value={work.id}>
      {work.title} ({notesPerWork.get(work.id)})
    </option>
  );

  if (shownWorks.length === 0) {
    if (!isLoading && !onRetry) return null;
    return (
      <div className="bg-muted/30 border rounded-xl p-4 flex items-center gap-2 text-sm text-muted-foreground">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading texts…
          </>
        ) : (
          <>
            Couldn't load the texts.
            <button onClick={onRetry} className="inline-flex items-center gap-1 underline hover:text-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="bg-muted/30 border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Browse by Texts</h3>
        <span className="text-xs text-muted-foreground">
          ({shownWorks.length} text{shownWorks.length !== 1 ? 's' : ''} in {shownVolumes.length} volume{shownVolumes.length !== 1 ? 's' : ''})
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Volume</span>
          <select
            className={selectClass}
            value={value.volume}
            onChange={(e) => {
              const volume = e.target.value;
              // Keep the text only if it is in the new volume
              const keep = works.find((w) => w.id === value.text)?.volume === volume;
              onChange({ volume, text: keep ? value.text : '' });
            }}
          >
            <option value="">All volumes</option>
            {shownVolumes.map((v) => (
              <option key={v.number} value={v.number}>
                {volumeLabel(v)} ({notesPerVolume.get(v.number)})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Text</span>
          <select
            className={selectClass}
            value={value.text}
            onChange={(e) => {
              const text = e.target.value;
              // Choosing a text also chooses its volume
              const volume = works.find((w) => w.id === text)?.volume ?? value.volume;
              onChange({ volume: text ? volume : value.volume, text });
            }}
          >
            <option value="">{value.volume ? `All texts in CW ${value.volume}` : 'Choose a text'}</option>
            {value.volume
              ? textsInVolume.map(option)
              : groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.works.map(option)}
                </optgroup>
              ))}
          </select>
        </label>
      </div>
    </div>
  );
}
