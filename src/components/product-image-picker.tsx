import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ImagePlus, UploadCloud, X } from 'lucide-react';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const maxSize = 5 * 1024 * 1024;

export function ProductImagePicker({ file, imageUrl, onChange, onError, disabled }: {
  file: File | null;
  imageUrl: string;
  onChange: (file: File | null, imageUrl?: string) => void;
  onError: (message: string) => void;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const choose = (candidate?: File) => {
    if (!candidate || disabled) return;
    if (!allowedTypes.has(candidate.type)) {
      onError('Elige una imagen JPG, PNG, WebP o GIF.');
      return;
    }
    if (candidate.size === 0 || candidate.size > maxSize) {
      onError('La foto debe pesar menos de 5 MB.');
      return;
    }
    onError('');
    onChange(candidate);
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  };

  return <div>
    <p className="label" id="product-image-label">Foto del producto (opcional)</p>
    <input
      ref={input}
      data-testid="input-product-image"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      className="sr-only"
      disabled={disabled}
      aria-labelledby="product-image-label"
      onChange={event => {
        choose(event.target.files?.[0]);
        event.target.value = '';
      }}
    />
    <div
      data-testid="dropzone-product-image"
      onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={event => { event.preventDefault(); setDragging(false); }}
      onDrop={drop}
      className={`rounded-2xl border-2 border-dashed p-4 transition-colors ${dragging ? 'border-[#60945f] bg-[#e8f1e2]' : 'border-[#b9d0c2] bg-[#f2f6ef]'}`}
    >
      {preview || imageUrl ? <div className="relative">
        <img src={preview || imageUrl} alt="Vista previa de la foto del producto" className="h-40 w-full rounded-xl object-cover"/>
        <button
          type="button"
          disabled={disabled}
          onClick={() => { onChange(null, ''); if (input.current) input.current.value = ''; }}
          className="absolute right-2 top-2 rounded-full bg-[#294d64] p-2 text-white disabled:opacity-50"
          aria-label="Quitar foto"
          data-testid="button-remove-product-image"
        ><X size={16}/></button>
        <button type="button" disabled={disabled} onClick={() => input.current?.click()} className="mt-3 text-xs font-bold text-[#355c74] hover:underline disabled:opacity-50">
          Cambiar foto
        </button>
        {file && <span className="ml-3 text-xs text-[#647e76]">{file.name}</span>}
      </div> : <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="flex w-full flex-col items-center gap-2 py-6 text-center text-[#527377] disabled:opacity-50"
      >
        <span className="rounded-full bg-[#e0ecdd] p-3 text-[#4b7859]"><ImagePlus size={23}/></span>
        <span className="text-sm font-bold text-[#355c74]">Elegir una foto o arrastrarla aquí</span>
        <span className="flex items-center gap-1 text-xs"><UploadCloud size={14}/> JPG, PNG, WebP o GIF · máximo 5 MB</span>
      </button>}
    </div>
  </div>;
}