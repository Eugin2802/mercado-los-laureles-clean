import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Copy, Minus, Plus, X } from 'lucide-react';
import { getListOrdersQueryKey, useCreateOrder, type Order, type Product } from '@api-client';
import { money } from '@/components/market';
import { PaymentProofPicker } from '@/components/payment-proof-picker';
import { apiErrorMessage, uploadPaymentProof, validPaymentProof } from '@/lib/payment-proof';
import { useFirebaseSession } from '@/components/firebase-session';
import { saveValidatedOrder } from '@/lib/firestore-orders';

export function OrderCheckout({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const createOrder = useCreateOrder();
  const firebase = useFirebaseSession();
  const submitting = useRef(false);
  const [priceSnapshot] = useState(product.price);
  const [yapeNumberSnapshot] = useState(product.yapeNumber);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [tower, setTower] = useState('');
  const [apartment, setApartment] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'digital'>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [stage, setStage] = useState<'uploading' | 'registering' | null>(null);
  const busy = stage !== null || createOrder.isPending;
  const hasDigitalNumber = /^\d{9}$/.test(yapeNumberSnapshot);
  const total = Math.round(priceSnapshot * quantity * 100) / 100;
  const tendered = Number(cashTendered);
  const changeDue = Math.round((tendered - total) * 100) / 100;
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const copyYape = async () => {
    const paymentNumber = order?.yapeNumber || yapeNumberSnapshot;
    if (!paymentNumber) return;
    try {
      await navigator.clipboard.writeText(paymentNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2300);
    } catch {
      setError('No pudimos copiar el número. Puedes anotarlo manualmente.');
    }
  };

  const submitOrder = async () => {
    if (submitting.current || busy) return;
    setError('');
    if (!tower.trim() || !apartment.trim()) {
      setError('Indica tu torre y departamento para que el vendedor pueda encontrarte.');
      return;
    }
    if (paymentMethod === 'digital' && !hasDigitalNumber) {
      setError('Este vendedor aún no configuró Yape/Plin. Elige efectivo.');
      return;
    }
    if (!online) {
      setError('Necesitas conexión a internet para registrar tu pedido.');
      return;
    }
    if (!firebase.ready) {
      setError(firebase.error || 'Estamos conectando con Firestore. Espera un momento e inténtalo nuevamente.');
      return;
    }
    if (paymentMethod === 'cash' && (!cashTendered.trim() || !Number.isFinite(tendered) || changeDue < 0)) {
      setError('Ingresa un monto en efectivo igual o mayor al total del pedido.');
      return;
    }
    if (paymentMethod === 'digital' && (!proofFile || !validPaymentProof(proofFile))) {
      setError('Adjunta un comprobante JPG, PNG o WebP de hasta 5 MB para registrar el pedido.');
      return;
    }

    submitting.current = true;
    try {
      let paymentProof: string | undefined;
      if (paymentMethod === 'digital' && proofFile) {
        setStage('uploading');
        paymentProof = await uploadPaymentProof(proofFile, 'order');
      }
      setStage('registering');
      const created = await createOrder.mutateAsync({
        data: {
          productId: product.id,
          quantity,
          note: note.trim() || undefined,
          tower: tower.trim(),
          apartment: apartment.trim(),
          paymentMethod,
          expectedUnitPrice: priceSnapshot,
          ...(paymentMethod === 'cash' ? { cashTendered: tendered } : { paymentProof }),
          ...(paymentMethod === 'digital' ? { expectedYapeNumber: yapeNumberSnapshot } : {}),
        },
      });
      setOrder(created);
      try {
        const saved = await saveValidatedOrder(created);
        setOrder(saved);
      } catch {
        setError(`Tu pedido #${created.id} ya está registrado, pero falta sincronizarlo con Firestore. No vuelvas a comprarlo: el servidor reintentará la sincronización.`);
      }
      await qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    } catch (cause) {
      setError(apiErrorMessage(cause, 'No se pudo registrar tu pedido. Intenta de nuevo.'));
    } finally {
      submitting.current = false;
      setStage(null);
    }
  };

  const sellerName = order?.sellerName || product.sellerName;
  const sellerWhatsappNumber = order ? order.sellerWhatsappNumber : product.sellerWhatsappNumber || '';
  const sellerDigits = sellerWhatsappNumber.replace(/\D/g, '');
  const whatsappNumber = sellerDigits ? (/^9\d{8}$/.test(sellerDigits) ? `51${sellerDigits}` : sellerDigits) : '';
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hola ${sellerName}, te escribo por mi pedido de ${product.name}.`)}` : '';

  return <div className="fixed inset-0 z-50 bg-[#173343]/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5" onClick={() => { if (!busy) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="Realizar pedido" className="bg-[#faf9f1] rounded-t-[28px] sm:rounded-[28px] p-6 sm:p-8 w-full max-w-[480px] shadow-2xl max-h-[95dvh] overflow-y-auto" onClick={event => event.stopPropagation()}>
      <div className="flex justify-between items-start">
        <div><p className="eyebrow text-[#80a163]">De vecino a vecino</p><h2 className="font-display text-3xl text-[#294d64] mt-2">{order ? 'Pedido registrado' : 'Confirmar pedido'}</h2></div>
        <button data-testid="button-close-order" aria-label="Cerrar" disabled={busy} onClick={onClose} className="text-[#708582] p-1"><X size={20}/></button>
      </div>
      {order ? <div className="mt-6">
        <div className="bg-[#e7f0dc] rounded-2xl p-5 text-[#3f6950] text-sm leading-relaxed">
          <Check size={24} className="mb-2"/>
          {order.paymentMethod === 'cash'
            ? `Tu pedido quedó pendiente. Puedes seguirlo en la aplicación y escribirle a tu vecino para coordinar más detalles. Ten ${money(order.cashTendered ?? tendered)} en efectivo al encontrarte; tu vuelto será ${money(Math.max(0, Math.round(((order.cashTendered ?? tendered) - order.total) * 100) / 100))}. El vendedor confirmará el pago después de recibirlo.`
            : `Tu pedido quedó pendiente. Puedes seguirlo en la aplicación y escribirle a tu vecino para coordinar más detalles. La captura adjunta no confirma que el pago se haya recibido; el vendedor debe verificarlo.`}
        </div>
        {order.paymentMethod === 'digital' && <div className="mt-5 panel p-5"><p className="text-xs text-[#79908a]">Yape/Plin del vendedor</p><div className="flex items-center justify-between gap-2 mt-2"><strong className="text-2xl text-[#355c74]">{order.yapeNumber || yapeNumberSnapshot}</strong><button data-testid="button-copy-yape" onClick={copyYape} className="btn btn-light">{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copiado' : 'Copiar'}</button></div></div>}
        {error && <p role="alert" className="text-xs text-red-700 mt-3">{error}</p>}
        <Link href={`/orders?order=${order.id}`} data-testid="link-view-orders" className="btn btn-primary w-full mt-5">Ver mis pedidos <ChevronRight size={16}/></Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold">
          <Link href={`/seller/${order.sellerId}`} data-testid="link-order-seller-store" className="text-[#355c74] hover:underline">Ver mostrador de {product.sellerStoreName || order.sellerName}</Link>
          {whatsappHref && <a data-testid="link-order-seller-whatsapp" href={whatsappHref} target="_blank" rel="noopener noreferrer" className="text-[#527b55] hover:underline">Escribir por WhatsApp</a>}
        </div>
      </div> : <div className="mt-6">
        <div className="flex justify-between text-sm border-b border-[#dbe3dc] pb-5"><span className="font-bold text-[#355c74]">{product.name}</span><span>{money(priceSnapshot)}</span></div>
        <div className="flex justify-between items-center py-5"><span className="text-sm font-bold">Cantidad</span><div className="flex items-center gap-4"><button data-testid="button-decrease-quantity" aria-label="Disminuir cantidad" className="btn btn-light !p-2 !min-h-9" disabled={quantity <= 1 || busy} onClick={() => setQuantity(quantity - 1)}><Minus size={16}/></button><strong>{quantity}</strong><button data-testid="button-increase-quantity" aria-label="Aumentar cantidad" className="btn btn-light !p-2 !min-h-9" disabled={quantity >= 99 || busy} onClick={() => setQuantity(quantity + 1)}><Plus size={16}/></button></div></div>
        <div className="grid grid-cols-2 gap-3 mb-4"><div><label className="label" htmlFor="order-tower">Torre *</label><input id="order-tower" data-testid="input-order-tower" className="field" maxLength={30} required placeholder="Ej. 16" value={tower} disabled={busy} onChange={event => setTower(event.target.value)}/></div><div><label className="label" htmlFor="order-apartment">Departamento *</label><input id="order-apartment" data-testid="input-order-apartment" className="field" maxLength={30} required placeholder="Ej. 304" value={apartment} disabled={busy} onChange={event => setApartment(event.target.value)}/></div></div>
        <label className="label" htmlFor="order-note">Nota para tu vecino (opcional)</label>
        <textarea id="order-note" data-testid="input-order-note" className="field resize-none min-h-20" maxLength={300} placeholder="Ej. Prefiero recibirlo después de las 6 p. m.; estoy disponible de 4 a 8 p. m." value={note} disabled={busy} onChange={event => setNote(event.target.value)}/>
        <p className="text-[11px] text-[#728781] mt-1 mb-4">Indica tu horario preferido o cuándo estás disponible para recibir la entrega. Máximo 300 caracteres.</p>
        <div className="flex justify-between items-center my-5 pt-5 border-t border-[#dbe3dc]"><span className="text-sm font-bold">Total del pedido</span><strong className="font-display text-2xl text-[#355c74]">{money(total)}</strong></div>
        <fieldset className="mb-4"><legend className="label">Forma de pago *</legend><div className="grid grid-cols-2 gap-2"><label className={`rounded-xl border p-3 text-sm cursor-pointer ${paymentMethod === 'cash' ? 'border-[#639363] bg-[#e9f2e1]' : 'border-[#d4dfdc]'}`}><input data-testid="input-payment-cash" type="radio" name="payment-method" checked={paymentMethod === 'cash'} disabled={busy} onChange={() => setPaymentMethod('cash')} className="mr-2"/>Efectivo</label><label className={`rounded-xl border p-3 text-sm ${hasDigitalNumber ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'} ${paymentMethod === 'digital' ? 'border-[#639363] bg-[#e9f2e1]' : 'border-[#d4dfdc]'}`}><input data-testid="input-payment-digital" type="radio" name="payment-method" checked={paymentMethod === 'digital'} disabled={!hasDigitalNumber || busy} onChange={() => setPaymentMethod('digital')} className="mr-2"/>Yape / Plin</label></div></fieldset>
        {paymentMethod === 'cash' ? <div className="mb-4"><label className="label" htmlFor="order-cash">¿Con cuánto efectivo pagarás? *</label><input id="order-cash" data-testid="input-order-cash" type="number" inputMode="decimal" min={total} step="0.01" className="field" placeholder={money(total)} value={cashTendered} disabled={busy} onChange={event => setCashTendered(event.target.value)}/><p data-testid="text-order-change" className="text-xs text-[#537765] mt-2">Vuelto: {cashTendered && Number.isFinite(tendered) && changeDue >= 0 ? money(changeDue) : 'Ingresa un monto igual o mayor al total'}</p></div> : <div className="rounded-xl bg-[#e9efe4] p-4 mb-4 text-xs text-[#547168]">
          <p className="font-bold">Paga directamente al vendedor por Yape/Plin</p><div className="flex items-center justify-between gap-2 mt-2"><strong className="text-lg text-[#355c74]">{yapeNumberSnapshot}</strong><button type="button" data-testid="button-copy-yape" onClick={copyYape} disabled={busy} className="btn btn-light">{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copiado' : 'Copiar'}</button></div>
          <p className="mt-3 mb-2">Adjunta el comprobante para registrar el pedido. La captura no confirma el pago; el vendedor verificará el abono en su propia cuenta.</p>
          <PaymentProofPicker file={proofFile} onChange={setProofFile} onError={setError} disabled={busy}/>
        </div>}
        {!hasDigitalNumber && <p className="text-xs leading-relaxed bg-[#e9efe4] rounded-xl p-4 mb-4 text-[#547168]">El vendedor aún no configuró un número de Yape/Plin. Puedes pedir y pagar en efectivo.</p>}
        <p className="text-xs leading-relaxed text-[#547168] mb-4">El vendedor verificará el pago directamente antes de marcarlo como recibido.</p>
        {!online && <p role="status" className="text-xs text-[#925f5a] mb-3">Sin conexión a internet. El pedido no se puede registrar hasta que vuelva la conexión.</p>}
        {!firebase.ready && <p role={firebase.error ? 'alert' : 'status'} className="text-xs text-[#925f5a] mb-3">{firebase.error || 'Conectando con los pedidos en Firestore…'} {firebase.error && <button type="button" onClick={firebase.retry} className="font-bold underline">Reintentar conexión</button>}</p>}
        {error && <p role="alert" className="text-xs text-red-700 mb-3">{error}</p>}
        <button data-testid="button-confirm-order" disabled={busy || !online || !firebase.ready || (paymentMethod === 'digital' && (!proofFile || !validPaymentProof(proofFile)))} onClick={submitOrder} className="btn btn-primary w-full">{stage === 'uploading' ? 'Subiendo comprobante…' : busy ? 'Registrando pedido…' : 'Confirmar pedido'}</button>
      </div>}
    </div>
  </div>;
}