import { useEffect, useState, type DragEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { validPaymentProof } from '@/lib/payment-proof';

export function PaymentProofPicker({ file, onChange, onError, disabled }: {
  file: File | null;
  onChange: (file: File | null) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const choose = (value?: File) => {
    if (!value || disabled) return;
    if (!validPaymentProof(value)) { onError('Elige una captura JPG, PNG o WebP de hasta 5 MB.'); return; }
    onError('');
    onChange(value);
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  };
  return <div
    className={`rounded-xl border-2 border-dashed p-4 text-sm ${dragging ? 'border-[#739b6b] bg-[#e8f1e2]' : 'border-[#c5d7c7] bg-[#f2f6ef]'}`}
    onDragOver={event => { event.preventDefault(); setDragging(true); }}
    onDragLeave={event => { event.preventDefault(); setDragging(false); }}
    onDrop={drop}
  >
    {preview ? <div className="flex items-start gap-3">
      <img src={preview} alt="Vista previa del comprobante" className="w-20 h-20 rounded-lg object-cover"/>
      <div className="min-w-0 flex-1"><p className="truncate">{file?.name}</p><button type="button" disabled={disabled} onClick={() => onChange(null)} className="text-xs text-[#925f5a] mt-2 flex gap-1 items-center"><X size={13}/> Quitar</button></div>
    </div> : <label className="flex items-center gap-3 cursor-pointer">
      <ImagePlus className="shrink-0 text-[#719966]" size={23}/>
      <span className="text-[#355c74] font-semibold">Subir captura o arrastrarla aquí <span className="block text-xs font-normal text-[#718780]">JPG, PNG o WebP · máximo 5 MB</span></span>
      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={disabled} onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }}/>
    </label>}
  </div>;
}