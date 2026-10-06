import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Check, Clock3, MessageCircle, Package, ShoppingBag, X } from 'lucide-react';
import { getGetProductQueryKey, getGetSellerStoreQueryKey, getListOrdersQueryKey, getListProductsQueryKey, getListReviewsQueryKey, useConfirmOrderPayment, useGetMe, useSubmitOrderProof, useUpdateOrder, type Order } from '@api-client';
import { date, money, Notice, PageHeading } from '@/components/market';
import { Reports } from '@/components/reports';
import { PaymentProofPicker } from '@/components/payment-proof-picker';
import { OrderFeedback } from '@/components/order-feedback';
import { apiErrorMessage, uploadPaymentProof } from '@/lib/payment-proof';
import { useFirestoreOrders } from '@/lib/firestore-orders';

const labels: Record<string, string> = { pending: 'Pedido recibido', paid: 'Pago recibido', preparing: 'En preparación', en_route: 'En camino', completed: 'Entregado', cancelled: 'Cancelado' };
const stages = ['received', 'preparing', 'en_route', 'delivered'] as const;
const stageLabels = ['Recibido', 'Preparando', 'En camino', 'Entregado'];
const limaDay = (value: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const weekStart = (day: string) => {
  const start = new Date(`${day}T00:00:00Z`);
  const weekday = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (weekday + 6) % 7);
  return start.toISOString().slice(0, 10);
};
const towerLabel = (tower: string) => /^torre\s*/i.test(tower) ? tower : `Torre ${tower}`;
const whatsappHref = (number: string, sellerName: string, productName: string) => {
  const digits = number.replace(/\D/g, '');
  const formatted = /^9\d{8}$/.test(digits) ? `51${digits}` : digits;
  return formatted ? `https://wa.me/${formatted}?text=${encodeURIComponent(`Hola ${sellerName}, te escribo por mi pedido de ${productName}.`)}` : '';
};

export default function Orders() {
  const qc = useQueryClient();
  const me = useGetMe();
  const orders = useFirestoreOrders();
  const update = useUpdateOrder();
  const confirmPayment = useConfirmOrderPayment();
  const submitProof = useSubmitOrderProof();
  const [tab, setTab] = useState<'purchases' | 'sales'>(() => new URLSearchParams(window.location.search).get('tab') === 'sales' ? 'sales' : 'purchases');
  const [error, setError] = useState('');
  const [files, setFiles] = useState<Record<number, File | null>>({});
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ order: Order; status: 'payment' | 'preparing' | 'en_route' | 'completed' | 'cancelled' } | null>(null);
  const orderParam = new URLSearchParams(window.location.search).get('order');
  const requestedOrderId = orderParam && /^\d+$/.test(orderParam) ? Number(orderParam) : null;
  const sales = (orders.data || []).filter(o => o.sellerId === me.data?.id).sort((a, b) => {
    const byTime = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return byTime || a.id - b.id;
  });
  const list = tab === 'sales' ? sales : (orders.data || []).filter(o => o.buyerId === me.data?.id);
  useEffect(() => {
    if (!requestedOrderId || !orders.data || !me.data) return;
    const requested = orders.data.find(order => order.id === requestedOrderId);
    if (requested?.sellerId === me.data.id && requested.buyerId !== me.data.id) setTab('sales');
    else if (requested?.buyerId === me.data.id) setTab('purchases');
  }, [me.data, orders.data, requestedOrderId]);
  useEffect(() => {
    if (!requestedOrderId || orders.isLoading || !orders.data || !me.data) return;
    const currentList = tab === 'sales'
      ? orders.data.filter(order => order.sellerId === me.data?.id)
      : orders.data.filter(order => order.buyerId === me.data?.id);
    if (!currentList.some(order => order.id === requestedOrderId)) return;
    document.getElementById(`order-${requestedOrderId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [me.data, orders.data, orders.isLoading, requestedOrderId, tab]);
  const today = limaDay(new Date());
  const completed = sales.filter(o => o.status === 'completed' && !Number.isNaN(new Date(o.completedAt || o.createdAt).getTime()));
  const periods = [
    { label: 'Hoy', matches: (day: string) => day === today },
    { label: 'Esta semana', matches: (day: string) => day >= weekStart(today) && day <= today },
    { label: 'Este mes', matches: (day: string) => day.slice(0, 7) === today.slice(0, 7) && day <= today },
  ];
  const change = async () => {
    if (!confirm) return;
    setError('');
    try {
      const changed = confirm.status === 'payment'
        ? await confirmPayment.mutateAsync({ id: confirm.order.id })
        : await update.mutateAsync({ id: confirm.order.id, data: { status: confirm.status } });
      orders.patch(changed);
      await qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      setConfirm(null);
    } catch (cause) { setError(apiErrorMessage(cause, 'No pudimos actualizar el pedido. Intenta de nuevo.')); setConfirm(null); }
  };
  const attachProof = async (order: Order) => {
    const file = files[order.id];
    if (!file) { setError('Elige una captura antes de adjuntarla.'); return; }
    setError('');
    setUploadingId(order.id);
    try {
      const proofPath = await uploadPaymentProof(file, 'order');
      const changed = await submitProof.mutateAsync({ id: order.id, data: { proofPath } });
      orders.patch(changed);
      setFiles(current => ({ ...current, [order.id]: null }));
      await qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    } catch (cause) { setError(apiErrorMessage(cause, 'No pudimos adjuntar el comprobante. Intenta de nuevo.')); }
    finally { setUploadingId(null); }
  };
  const onFeedbackSubmitted = (updated: Order) => {
    orders.patch(updated);
    qc.setQueryData<Order[]>(getListOrdersQueryKey(), current => current?.map(order => order.id === updated.id ? updated : order));
    void qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetProductQueryKey(updated.productId) });
    void qc.invalidateQueries({ queryKey: getListReviewsQueryKey(updated.productId) });
    void qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
    void qc.invalidateQueries({ queryKey: getGetSellerStoreQueryKey(updated.sellerId) });
  };

  return <div className="page-wrap py-10 sm:py-14">
    <PageHeading eyebrow="Tus intercambios" title="Mis pedidos." description="Cada pedido es una conversación entre vecinos. Aquí puedes seguirlos sin perder el hilo."/>
    <div className="flex gap-2 mb-7 border-b border-[#d4ded6]">
      <button data-testid="button-tab-purchases" onClick={() => setTab('purchases')} className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${tab === 'purchases' ? 'border-[#639363] text-[#355c74]' : 'border-transparent text-[#84958e]'}`}><ShoppingBag size={16} className="inline mr-2"/>Mis compras</button>
      <button data-testid="button-tab-sales" onClick={() => setTab('sales')} className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${tab === 'sales' ? 'border-[#639363] text-[#355c74]' : 'border-transparent text-[#84958e]'}`}><Package size={16} className="inline mr-2"/>Mis ventas</button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-xl p-4 mb-5">{error}</p>}
    {orders.isLoading || me.isLoading ? <div className="space-y-4">{[1, 2, 3].map(n => <div key={n} className="skeleton h-44 rounded-2xl"/>)}</div> : orders.isError || me.isError ? <Notice icon="error" title="No pudimos cargar tus pedidos" text={orders.error || 'Comprueba tu conexión e inténtalo otra vez.'} action={<button data-testid="button-retry-orders" className="btn btn-primary" onClick={() => { orders.refetch(); me.refetch(); }}>Reintentar</button>}/> : <>
      {tab === 'sales' && <section className="max-w-[850px] mb-7" aria-label="Ventas completadas">
        <p className="eyebrow text-[#789a62] mb-3">Ventas completadas · ingresos brutos</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{periods.map(period => {
          const matching = completed.filter(o => period.matches(limaDay(new Date(o.completedAt || o.createdAt))));
          return <div key={period.label} className="panel p-4 sm:p-5"><p className="text-xs text-[#718780]">{period.label}</p><strong className="font-display text-2xl text-[#355c74] block mt-1">{money(matching.reduce((sum, o) => sum + o.total, 0))}</strong><p className="text-xs text-[#718780] mt-1">{matching.length} {matching.length === 1 ? 'venta completada' : 'ventas completadas'}</p></div>;
        })}</div>
        <p className="text-[11px] text-[#7b908c] mt-2">Totales según la fecha de entrega en Lima (pedidos antiguos: fecha del pedido); ingresos brutos, no ganancias.</p>
      </section>}
      {tab === 'sales' && <Reports/>}
       {list.length ? <div className="space-y-4 max-w-[850px]">{list.map((o, index) => <article key={o.id} id={`order-${o.id}`} data-testid={`order-${o.id}`} className={`panel overflow-hidden transition-shadow ${requestedOrderId === o.id ? 'ring-2 ring-[#79a66a] shadow-[0_0_0_5px_#79a66a22]' : ''}`}>
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {tab === 'sales' && <span data-testid={`text-delivery-sequence-${o.id}`} className="chip chip-leaf">Entrega {index + 1}</span>}
               <span className={`chip ${o.status === 'completed' ? 'chip-leaf' : 'chip-blue'}`}>{o.status === 'pending' ? <Clock3 size={12}/> : <Check size={12}/>} {labels[o.status] || o.status}</span>
              <span className="text-[11px] text-[#83958e]">Pedido #{o.id} · {date(o.createdAt)}</span>
            </div>
            <Link href={`/product/${o.productId}`} data-testid={`link-order-product-${o.id}`} className="font-display text-xl text-[#294d64] hover:underline">{o.productName}</Link>
            <p className="text-xs text-[#788f89] mt-1">{o.quantity} {o.quantity === 1 ? 'unidad' : 'unidades'}</p>
          </div>
          <strong className="font-display text-2xl text-[#355c74] shrink-0">{money(o.total)}</strong>
        </div>
        {o.status !== 'cancelled' && <div className="mx-5 sm:mx-6 mb-4" aria-label={`Progreso del pedido ${o.id}`}><div className="grid grid-cols-4 gap-1">{stages.map((stage, i) => { const current = stages.indexOf(o.preparationStatus); const reached = i <= (current < 0 ? 0 : current); return <div key={stage} className="min-w-0"><div className={`h-1.5 rounded-full ${reached ? 'bg-[#78a264]' : 'bg-[#dce7dd]'}`}/><p className={`mt-2 text-[10px] sm:text-xs ${reached ? 'font-bold text-[#355c74]' : 'text-[#80948e]'}`}>{stageLabels[i]}</p></div>; })}</div><p className="text-[11px] text-[#69807d] mt-3">Pago: {o.paymentConfirmedAt || o.status === 'paid' ? `confirmado${o.paymentConfirmedAt ? ` · ${date(o.paymentConfirmedAt)}` : ''}` : 'pendiente de confirmación'}</p></div>}
        <div className="mx-5 sm:mx-6 mb-4 px-4 py-3 bg-[#eef3e9] rounded-xl text-xs text-[#607a75] space-y-1">
          <p data-testid={`text-buyer-${o.id}`}><strong>Comprador:</strong> {o.buyerName}</p>
          <p data-testid={`text-address-${o.id}`}><strong>Entrega:</strong> {towerLabel(o.tower)} · Departamento {o.apartment}</p>
          <p data-testid={`text-method-${o.id}`}><strong>Pago:</strong> {o.paymentMethod === 'cash' ? 'Efectivo' : 'Yape / Plin'}</p>
          {o.paymentMethod === 'cash' ? <p data-testid={`text-cash-${o.id}`}><strong>Efectivo:</strong> {o.cashTendered != null ? money(o.cashTendered) : 'No registrado'} · <strong>Vuelto:</strong> {o.cashTendered != null ? money(Math.max(0, Math.round((o.cashTendered - o.total) * 100) / 100)) : 'No registrado'}</p> : <p data-testid={`text-yape-order-${o.id}`}><strong>Yape/Plin del vendedor:</strong> {o.yapeNumber || 'Número no registrado'}</p>}
          {o.note && <p><strong>Nota:</strong> {o.note}</p>}
          {o.completedAt && <p><strong>Entregado:</strong> {date(o.completedAt)}</p>}
           {tab === 'purchases' && o.sellerWhatsappNumber?.trim() && <p><strong>Contacto:</strong> <a data-testid={`link-contact-seller-${o.id}`} href={whatsappHref(o.sellerWhatsappNumber, o.sellerName, o.productName)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-[#355c74] hover:underline"><MessageCircle size={13}/> Escribir al vendedor</a></p>}
        </div>
        {o.paymentProof && <div className="px-5 sm:px-6 pb-4"><p className="label">Comprobante adjunto</p><a data-testid={`link-proof-${o.id}`} href={o.paymentProof} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 text-xs font-bold text-[#355c74] hover:underline"><img data-testid={`img-proof-${o.id}`} src={o.paymentProof} alt={`Comprobante del pedido ${o.id}`} className="w-16 h-16 object-cover rounded-lg border border-[#d4dfdc]"/> Abrir comprobante</a></div>}
         {tab === 'purchases' && ['pending', 'preparing', 'en_route'].includes(o.status) && !o.paymentConfirmedAt && <>
          <div className="px-5 sm:px-6 pb-4"><div className="rounded-xl bg-[#e6efe0] p-4 text-xs text-[#3e6856]">
            {o.paymentMethod === 'digital' ? <><p className="font-bold mb-1">Paga directamente al vendedor por Yape/Plin</p><p className="font-display text-xl text-[#355c74]">{o.yapeNumber || 'Número no registrado'}</p><p className="text-[11px] text-[#698079] mt-1">{o.paymentProof ? 'El comprobante adjunto sirve como referencia, pero no confirma automáticamente el pago.' : 'Puedes adjuntar un comprobante como referencia; el vendedor comprobará el pago en su propia cuenta antes de confirmarlo.'}</p></> : <><p className="font-bold mb-1">Pago en efectivo al encontrarse</p><p>Prepara {o.cashTendered != null ? money(o.cashTendered) : money(o.total)}. El vendedor confirmará cuando reciba el dinero.</p></>}
          </div></div>
          {o.paymentMethod === 'digital' && <div className="px-5 sm:px-6 pb-4 space-y-3"><p className="label">{o.paymentProof ? 'Reemplazar comprobante (opcional)' : 'Adjuntar comprobante (opcional)'}</p><PaymentProofPicker file={files[o.id] ?? null} onChange={file => setFiles(current => ({ ...current, [o.id]: file }))} onError={setError} disabled={uploadingId === o.id}/>{files[o.id] && <button data-testid={`button-submit-proof-${o.id}`} disabled={uploadingId !== null} onClick={() => attachProof(o)} className="btn btn-leaf">{uploadingId === o.id ? 'Adjuntando…' : 'Adjuntar captura'}</button>}</div>}
           {o.status === 'pending' && <div className="px-5 sm:px-6 pb-5"><button data-testid={`button-cancel-purchase-${o.id}`} onClick={() => setConfirm({ order: o, status: 'cancelled' })} className="text-xs font-bold text-[#925f5a] hover:underline">Cancelar mi pedido</button></div>}
        </>}
         {tab === 'sales' && ['pending', 'paid', 'preparing', 'en_route'].includes(o.status) && <div className="px-5 sm:px-6 pb-5 flex flex-wrap gap-2">
           {!o.paymentConfirmedAt && o.status !== 'paid' && (o.paymentMethod !== 'cash' || o.status !== 'pending') && <button data-testid={`button-confirm-payment-${o.id}`} onClick={() => setConfirm({ order: o, status: 'payment' })} className="btn btn-leaf">Confirmar pago recibido</button>}
           {(o.status === 'pending' || o.status === 'paid') && <button data-testid={`button-prepare-${o.id}`} onClick={() => setConfirm({ order: o, status: 'preparing' })} className="btn btn-primary">Empezar preparación</button>}
           {o.status === 'preparing' && <button data-testid={`button-en-route-${o.id}`} onClick={() => setConfirm({ order: o, status: 'en_route' })} className="btn btn-primary">Marcar en camino</button>}
           {o.status === 'en_route' && <button data-testid={`button-complete-${o.id}`} disabled={!o.paymentConfirmedAt} title={!o.paymentConfirmedAt ? 'Confirma el pago antes de entregar' : undefined} onClick={() => setConfirm({ order: o, status: 'completed' })} className="btn btn-primary">Marcar entregado</button>}
          <button data-testid={`button-cancel-${o.id}`} onClick={() => setConfirm({ order: o, status: 'cancelled' })} className="btn btn-plain"><X size={14}/> Cancelar pedido</button>
        </div>}
         {tab === 'purchases' && o.status === 'completed' && <OrderFeedback order={o} onSubmitted={onFeedbackSubmitted}/>}
      </article>)}</div> : <Notice title={tab === 'purchases' ? 'Todavía no tienes compras' : 'Aún no hay ventas'} text={tab === 'purchases' ? 'Date una vuelta por el mercado. Algo rico o útil puede estar esperándote.' : 'Cuando un vecino pida uno de tus productos, aparecerá aquí.'} action={<Link href={tab === 'purchases' ? '/' : '/sell'} data-testid="link-orders-empty-action" className="btn btn-primary">{tab === 'purchases' ? 'Explorar productos' : 'Ver mi mostrador'}</Link>}/>}
    </>}
     {confirm && <div className="fixed inset-0 z-50 bg-[#173343]/60 flex items-center justify-center p-4" onClick={() => setConfirm(null)}><div role="alertdialog" aria-modal="true" className="bg-[#faf9f1] rounded-[24px] p-7 w-full max-w-[420px]" onClick={e => e.stopPropagation()}><p className="eyebrow text-[#789a62]">Confirmar cambio</p><h2 className="font-display text-2xl text-[#294d64] mt-2">{confirm.status === 'payment' ? '¿Recibiste el pago?' : confirm.status === 'preparing' ? '¿Empiezas a preparar?' : confirm.status === 'en_route' ? '¿Ya va en camino?' : confirm.status === 'completed' ? '¿Ya entregaste el pedido?' : '¿Cancelar este pedido?'}</h2><p className="text-sm text-[#69807d] mt-3">Pedido #{confirm.order.id} · {confirm.order.productName}. {confirm.status === 'payment' ? confirm.order.paymentMethod === 'cash' ? 'Confirma únicamente después de recibir el efectivo y entregar el vuelto correspondiente.' : 'Comprueba el pago en tu propia cuenta de Yape o Plin. La captura no verifica el pago automáticamente.' : 'Este cambio se reflejará para ambos vecinos.'}</p><div className="flex gap-2 justify-end mt-6"><button data-testid="button-dismiss-order-confirm" onClick={() => setConfirm(null)} className="btn btn-plain">Volver</button><button data-testid="button-apply-order-status" disabled={update.isPending || confirmPayment.isPending} onClick={change} className="btn btn-primary">{update.isPending || confirmPayment.isPending ? 'Actualizando…' : 'Confirmar'}</button></div></div></div>}
  </div>;
}