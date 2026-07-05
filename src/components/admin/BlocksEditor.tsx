import { useRef, useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block, BlockImage, BlockLayout } from './types';
import { newBlock, newId } from './types';
import { uploadToCloudinary } from './cloudinary-upload';
import LayoutPicker from './LayoutPicker';

interface Props {
  blocks: Block[];
  cover: string;
  onChange: (blocks: Block[]) => void;
  onCoverChange: (src: string) => void;
}

const altFromName = (name: string) => name.replace(/\.[^./\\]+$/, '');
const layoutClass = (layout: BlockLayout) => (layout === 'image-text' ? 'l-textrow' : `l-${layout}`);

const REMOVE_BTN: React.CSSProperties = {
  position: 'absolute', top: 5, right: 5, width: 18, height: 18, borderRadius: '50%',
  border: 0, background: 'rgba(0,0,0,.5)', color: '#fff', fontSize: 9,
  display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0,
};
const IMG_FILL: React.CSSProperties = {
  width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2, display: 'block',
};

function Tile({ img, cover, tall, onRemove }: {
  img: BlockImage; cover: string; tall?: boolean; onRemove: () => void;
}) {
  return (
    <div className={`t${tall ? ' tall' : ''}`}>
      <img src={img.src} alt="" style={IMG_FILL} />
      {img.src === cover && <span className="star2">★</span>}
      <button type="button" title="Remove image" onClick={onRemove} style={REMOVE_BTN}>✕</button>
    </div>
  );
}

function ImageFields({ images, blockId, updateImage }: {
  images: BlockImage[]; blockId: string;
  updateImage: (blockId: string, imgId: string, patch: Partial<BlockImage>) => void;
}) {
  if (images.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {images.map((im) => (
        <div key={im.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <input
            className="blockcap" placeholder="Caption" value={im.caption ?? ''}
            onChange={(e) => updateImage(blockId, im.id, { caption: e.target.value })}
          />
          <input
            placeholder="Alt text" value={im.alt}
            onChange={(e) => updateImage(blockId, im.id, { alt: e.target.value })}
            style={{ fontSize: 11.5, color: 'var(--faint)', background: 'transparent', border: 0, padding: '0 2px' }}
          />
        </div>
      ))}
    </div>
  );
}

function SortableBlock({
  block, cover, onLayout, onCoverToggle, onRemoveBlock, onText, updateImage, removeImage, onFilesToBlock,
}: {
  block: Block; cover: string;
  onLayout: (id: string, layout: BlockLayout, align?: 'left' | 'right') => void;
  onCoverToggle: (block: Block) => void;
  onRemoveBlock: (id: string) => void;
  onText: (id: string, text: string) => void;
  updateImage: (blockId: string, imgId: string, patch: Partial<BlockImage>) => void;
  removeImage: (blockId: string, imgId: string) => void;
  onFilesToBlock: (blockId: string, files: FileList | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const addInputRef = useRef<HTMLInputElement>(null);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1,
  };
  const hasCover = block.images.some((im) => im.src === cover);
  const first = block.images[0];

  function body() {
    if (block.layout === 'image-text') {
      return (
        <>
          <div className="tiles l-textrow">
            {first
              ? <Tile img={first} cover={cover} onRemove={() => removeImage(block.id, first.id)} />
              : <div className="t" style={{ background: 'var(--sunk)' }} />}
            <textarea
              className="input side-text" placeholder="Text beside the image…"
              value={block.text ?? ''} onChange={(e) => onText(block.id, e.target.value)}
            />
          </div>
          <ImageFields images={block.images} blockId={block.id} updateImage={updateImage} />
        </>
      );
    }

    if (block.layout === 'carousel') {
      return (
        <>
          <div className="tiles l-carousel">
            <div className="t carousel-tile" style={{ background: 'var(--sunk)' }}>
              {first && <img src={first.src} alt="" style={IMG_FILL} />}
              <span className="chev l">‹</span>
              <span className="chev r">›</span>
              {block.images.length > 0 && (
                <div className="dots" style={{ position: 'absolute', left: 0, right: 0, bottom: 7 }}>
                  {block.images.map((im, i) => <i key={im.id} className={i === 0 ? 'on' : ''} />)}
                </div>
              )}
            </div>
          </div>
          <div className="filmstrip">
            {block.images.map((im) => (
              <div
                key={im.id} className="fs"
                style={{ position: 'relative', backgroundImage: `url(${im.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              >
                <button type="button" title="Remove image" onClick={() => removeImage(block.id, im.id)} style={REMOVE_BTN}>✕</button>
              </div>
            ))}
            <button type="button" className="addfs" title="Add photos to this carousel" onClick={() => addInputRef.current?.click()}>+</button>
            <input
              ref={addInputRef} type="file" accept="image/*" multiple hidden
              onChange={(e) => { onFilesToBlock(block.id, e.target.files); e.target.value = ''; }}
            />
          </div>
          <ImageFields images={block.images} blockId={block.id} updateImage={updateImage} />
        </>
      );
    }

    // grid layouts: single | full | two | twotall | mosaic | quad
    const tall = block.layout === 'twotall';
    return (
      <>
        <div className={`tiles ${layoutClass(block.layout)}`}>
          {block.images.map((im) => (
            <Tile key={im.id} img={im} cover={cover} tall={tall} onRemove={() => removeImage(block.id, im.id)} />
          ))}
          {block.images.length === 0 && <div className="t" style={{ background: 'var(--sunk)' }} />}
        </div>
        <ImageFields images={block.images} blockId={block.id} updateImage={updateImage} />
      </>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={`block${hasCover ? ' cover' : ''}`}>
      <div className="block-head">
        <span className="grip" {...attributes} {...listeners}>⋮⋮</span>
        <LayoutPicker value={block.layout} align={block.align} onChange={(layout, align) => onLayout(block.id, layout, align)} />
        <span className="block-actions">
          <button
            type="button" className={`tinybtn${hasCover ? ' on' : ''}`}
            title={hasCover ? 'Cover photo' : 'Set as cover'} disabled={block.images.length === 0}
            onClick={() => onCoverToggle(block)}
          >
            {hasCover ? '★' : '☆'}
          </button>
          <button type="button" className="tinybtn del" title="Remove block" onClick={() => onRemoveBlock(block.id)}>✕</button>
        </span>
      </div>
      <div className="block-body">{body()}</div>
    </div>
  );
}

export default function BlocksEditor({ blocks, cover, onChange, onCoverChange }: Props) {
  // Always-current view of blocks so async upload loops append against the latest state.
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const [pending, setPending] = useState<{ id: number; name: string }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const uidRef = useRef(0);

  const startPending = (name: string) => {
    const id = ++uidRef.current;
    setPending((p) => [...p, { id, name }]);
    return id;
  };
  const endPending = (id: number) => setPending((p) => p.filter((x) => x.id !== id));

  // Dropzone: one new `single` block per uploaded file.
  async function onFiles(files: FileList | null) {
    if (!files) return;
    setErrors([]);
    for (const file of Array.from(files)) {
      const pid = startPending(file.name);
      try {
        const { url } = await uploadToCloudinary(file, 'mas/photos', 'image');
        const img: BlockImage = { id: newId(), src: url, alt: altFromName(file.name), caption: '' };
        onChange([...blocksRef.current, { ...newBlock('single'), images: [img] }]);
      } catch (e) {
        setErrors((prev) => [...prev, `${file.name}: ${(e as Error).message}`]);
      } finally {
        endPending(pid);
      }
    }
  }

  // Add more images into an existing block (carousel "+").
  async function onFilesToBlock(blockId: string, files: FileList | null) {
    if (!files) return;
    setErrors([]);
    for (const file of Array.from(files)) {
      const pid = startPending(file.name);
      try {
        const { url } = await uploadToCloudinary(file, 'mas/photos', 'image');
        const img: BlockImage = { id: newId(), src: url, alt: altFromName(file.name), caption: '' };
        onChange(blocksRef.current.map((b) => (b.id === blockId ? { ...b, images: [...b.images, img] } : b)));
      } catch (e) {
        setErrors((prev) => [...prev, `${file.name}: ${(e as Error).message}`]);
      } finally {
        endPending(pid);
      }
    }
  }

  const updateBlock = (id: string, fn: (b: Block) => Block) =>
    onChange(blocks.map((b) => (b.id === id ? fn(b) : b)));

  const onLayout = (id: string, layout: BlockLayout, align?: 'left' | 'right') =>
    updateBlock(id, (b) => ({ ...b, layout, align: align ?? b.align }));

  const onText = (id: string, text: string) => updateBlock(id, (b) => ({ ...b, text }));

  const updateImage = (blockId: string, imgId: string, patch: Partial<BlockImage>) =>
    updateBlock(blockId, (b) => ({ ...b, images: b.images.map((im) => (im.id === imgId ? { ...im, ...patch } : im)) }));

  const removeImage = (blockId: string, imgId: string) =>
    updateBlock(blockId, (b) => ({ ...b, images: b.images.filter((im) => im.id !== imgId) }));

  const removeBlock = (id: string) => onChange(blocks.filter((b) => b.id !== id));

  const addBlock = () => onChange([...blocks, newBlock('single')]);

  const onCoverToggle = (block: Block) => {
    if (block.images[0]) onCoverChange(block.images[0].src);
  };

  function onDragEnd(e: any) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    onChange(arrayMove(blocks, oldIndex, newIndex));
  }

  return (
    <div>
      <label className="dropzone" style={{ display: 'block', cursor: 'pointer' }}>
        <div className="big">Drop photos here, or click to choose</div>
        <div className="small">JPG or PNG · uploads straight to your library</div>
        <input
          type="file" accept="image/*" multiple hidden
          onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
        />
      </label>

      {pending.map((p) => (
        <p key={p.id} style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0' }}>Uploading {p.name}…</p>
      ))}
      {errors.map((err, i) => (
        <p key={i} style={{ fontSize: 12, color: '#c0453b', margin: '6px 0 0' }}>{err}</p>
      ))}

      <div className="blocks" style={{ marginTop: 12 }}>
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((b) => (
              <SortableBlock
                key={b.id} block={b} cover={cover}
                onLayout={onLayout} onCoverToggle={onCoverToggle} onRemoveBlock={removeBlock}
                onText={onText} updateImage={updateImage} removeImage={removeImage}
                onFilesToBlock={onFilesToBlock}
              />
            ))}
          </SortableContext>
        </DndContext>
        <button type="button" className="addblock" onClick={addBlock}>+ Add a block</button>
      </div>
    </div>
  );
}
