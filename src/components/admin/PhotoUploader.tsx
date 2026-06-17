import { useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Gallery, GalleryImage } from './types';
import { uploadToCloudinary } from './cloudinary-upload';

function Row({ img, index, onPatch, onCover, isCover }: {
  img: GalleryImage; index: number; isCover: boolean;
  onPatch: (i: number, p: Partial<GalleryImage>) => void; onCover: (src: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: img.src });
  const style = { transform: CSS.Transform.toString(transform), transition, display: 'flex', gap: '.5rem', alignItems: 'center', padding: '.4rem 0' };
  return (
    <div ref={setNodeRef} style={style}>
      <span {...attributes} {...listeners} style={{ cursor: 'grab' }}>⠿</span>
      <img src={img.src} alt="" width={64} height={64} style={{ objectFit: 'cover' }} />
      <input placeholder="alt text" value={img.alt} onChange={(e) => onPatch(index, { alt: e.target.value })} />
      <input placeholder="caption" value={img.caption ?? ''} onChange={(e) => onPatch(index, { caption: e.target.value })} />
      <select value={img.span} onChange={(e) => onPatch(index, { span: e.target.value as GalleryImage['span'] })}>
        <option value="single">single</option><option value="wide">wide</option>
      </select>
      <label><input type="radio" name="cover" checked={isCover} onChange={() => onCover(img.src)} /> cover</label>
    </div>
  );
}

export default function PhotoUploader({ value, onChange }: { value: Gallery; onChange: (g: Gallery) => void; }) {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setBusy(true); setErrors([]);
    let accumulated = [...value.images];
    let cover = value.cover;
    const failures: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const { url } = await uploadToCloudinary(file, 'mas/photos', 'image');
        accumulated = [...accumulated, { src: url, alt: '', span: 'single' }];
        if (!cover) cover = url;
      } catch (e) { failures.push(`${file.name}: ${(e as Error).message}`); }
    }
    onChange({ ...value, images: accumulated, cover });
    setErrors(failures);
    setBusy(false);
  }

  const patch = (i: number, p: Partial<GalleryImage>) =>
    onChange({ ...value, images: value.images.map((im, idx) => (idx === i ? { ...im, ...p } : im)) });

  function onDragEnd(e: any) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = value.images.findIndex((im) => im.src === active.id);
    const newIndex = value.images.findIndex((im) => im.src === over.id);
    onChange({ ...value, images: arrayMove(value.images, oldIndex, newIndex) });
  }

  return (
    <fieldset>
      <legend>Photos</legend>
      <input type="file" accept="image/*" multiple disabled={busy}
        onChange={(e) => onFiles(e.target.files)} />
      {busy && <span> uploading…</span>}
      {errors.map((err, i) => <p key={i} style={{ color: '#c00' }}>{err}</p>)}
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={value.images.map((im) => im.src)} strategy={verticalListSortingStrategy}>
          {value.images.map((img, i) => (
            <Row key={img.src} img={img} index={i} isCover={value.cover === img.src}
              onPatch={patch} onCover={(src) => onChange({ ...value, cover: src })} />
          ))}
        </SortableContext>
      </DndContext>
    </fieldset>
  );
}
