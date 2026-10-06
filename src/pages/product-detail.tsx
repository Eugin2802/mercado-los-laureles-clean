import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { useAuth } from '@clerk/react';
import { ArrowLeft, BadgeCheck, ChevronRight, MapPin, Package, ShoppingBag, Star } from 'lucide-react';
import { getGetProductQueryKey, getListReviewsQueryKey, useGetProduct, useListReviews, useTrackProductView } from '@api-client';
import { date, money, Notice } from '@/components/market';
import { OrderCheckout } from '@/components/order-checkout';

export default function ProductDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const { isSignedIn } = useAuth();
  const product = useGetProduct(id, { query: { enabled: valid, queryKey: getGetProductQueryKey(id), refetchInterval: 30_000, refetchOnWindowFocus: true } });
  const reviews = useListReviews(id, { query: { enabled: valid, queryKey: getListReviewsQueryKey(id) } });
  const track = useTrackProductView();
  const trackRef = useRef(track.mutate);
  trackRef.current = track.mutate;
  const tracked = useRef<number | null>(null);
  useEffect(() => { if (valid && product.data && tracked.current !== id) { tracked.current = id; trackRef.current({ id }); } }, [id, valid, product.data]);
  const [orderOpen, setOrderOpen] = useState(false);
  const p = product.data;
  if (!valid) return <div className="page-wrap py-16"><Notice title="Producto no encontrado" text="Parece que este enlace no corresponde a un producto." action={<Link href="/" className="btn btn-primary">Volver al mercado</Link>}/></div>;
  if (product.isLoading) return <div className="page-wrap py-10"><div className="grid md:grid-cols-2 gap-10"><div className="skeleton aspect-square rounded-[28px]"/><div className="space-y-5 pt-8"><div className="skeleton h-5 w-28 rounded"/><div className="skeleton h-14 w-4/5 rounded"/><div className="skeleton h-8 w-28 rounded"/><div className="skeleton h-32 w-full rounded"/></div></div></div>;
  if (product.isError || !p) return <div className="page-wrap py-16"><Notice icon="error" title="No pudimos abrir este producto" text="Es posible que ya no esté publicado o haya ocurrido un problema." action={<button className="btn btn-primary" data-testid="button-retry-product" onClick={() => product.refetch()}>Reintentar</button>}/></div>;
  return <div className="page-wrap pt-7 pb-10">
    <Link href="/" data-testid="link-back-market" className="text-xs text-[#64807d] font-bold flex items-center gap-1 mb-7 hover:text-[#355c74]"><ArrowLeft size={15}/> Volver al mercado</Link>
    <div className="grid lg:grid-cols-[1.02fr_.98fr] gap-8 lg:gap-14">
      <div className="aspect-[1.1] lg:aspect-square rounded-[28px] bg-[#dce9df] overflow-hidden relative">{p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_70%_25%,#d5e8bc,#a8c4bd_70%)]"><Package size={80} className="text-[#527576]"/></div>}<span className="absolute top-5 left-5 chip bg-[#f9faf1] text-[#4f736b]">{p.category}</span></div>
      <div className="lg:py-4"><div className="flex gap-2 flex-wrap mb-5">{p.sellingToday && p.available && <span className="chip chip-leaf"><span className="w-1.5 h-1.5 rounded-full bg-[#76a65b]"/> Disponible hoy</span>}<span className="chip chip-blue"><MapPin size={13}/> Los Laureles 4ta Etapa</span></div><h1 data-testid="text-product-name" className="font-display text-[42px] sm:text-[60px] leading-[1.05] tracking-tight text-[#294d64]">{p.name}</h1><div className="flex items-center gap-3 mt-4"><span className="inline-flex items-center gap-1 text-xs text-[#537765]"><Star size={15} className="fill-[#a6cd77] text-[#77a25b]"/>{p.reviewCount ? `${p.rating.toFixed(1)} · ${p.reviewCount} opiniones` : 'Aún sin opiniones'}</span><span className="text-[#c7d2c7]">|</span><span className="text-xs text-[#718682]">Publicado el {date(p.createdAt)}</span></div><p data-testid="text-product-price" className="font-display text-[36px] text-[#355c74] mt-7">{money(p.price)} <span className="text-xs font-sans text-[#7a908e] font-normal">por unidad</span></p><p className="text-sm leading-7 text-[#526e73] mt-6 whitespace-pre-line">{p.description}</p>
        <div className="border-y border-[#dce3dc] py-5 my-7 flex items-center gap-3"><div className="w-11 h-11 rounded-full bg-[#c8dfb4] text-[#3b6548] flex items-center justify-center font-display text-lg">{p.sellerName.charAt(0).toUpperCase()}</div><div><p className="text-xs text-[#849490]">Lo ofrece tu vecino</p><p className="font-bold text-sm text-[#355c74]">{p.sellerName}</p></div><BadgeCheck size={18} className="ml-auto text-[#7eaa68]"/></div>
         {p.available && p.sellingToday ? (isSignedIn ? <button data-testid="button-order" onClick={() => setOrderOpen(true)} className="btn btn-primary w-full sm:w-auto px-9 min-h-13"><ShoppingBag size={17}/> Pedir a mi vecino <ChevronRight size={17}/></button> : <Link data-testid="link-sign-in-order" href="/sign-in" className="btn btn-primary w-full sm:w-auto px-9 min-h-13"><ShoppingBag size={17}/> Ingresa para pedir <ChevronRight size={17}/></Link>) : <div className="rounded-xl bg-[#e8ece5] text-[#647b7c] p-4 text-sm">Este vecino no está vendiendo este producto por ahora. Vuelve pronto.</div>}
         <p className="text-[11px] text-[#7b908c] mt-4">Paga en efectivo o por Yape/Plin si el vendedor tiene un número configurado. Los pagos se coordinan directamente entre vecinos.</p>
      </div>
    </div>
    <section className="mt-20 max-w-[780px]"><div className="flex items-center justify-between gap-4 mb-6"><div><p className="eyebrow text-[#83a268]">La voz de los vecinos</p><h2 className="font-display text-3xl text-[#294d64] mt-2">Opiniones sinceras</h2></div>{isSignedIn ? <Link href="/orders" data-testid="link-rate-delivered-order" className="text-xs font-bold text-[#355c74] hover:underline text-right">Calificar una compra entregada en Mis pedidos</Link> : <Link href="/sign-in" data-testid="link-sign-in-rate-delivered-order" className="text-xs font-bold text-[#355c74] hover:underline text-right">Ingresa para calificar una compra entregada en Mis pedidos</Link>}</div>
      {reviews.isLoading ? <div className="space-y-3">{[1,2].map(n => <div key={n} className="skeleton h-28 rounded-xl"/>)}</div> : reviews.isError ? <Notice icon="error" title="No se cargaron las opiniones" text="Puedes intentarlo de nuevo." action={<button className="btn btn-primary" data-testid="button-retry-reviews" onClick={() => reviews.refetch()}>Reintentar</button>}/> : reviews.data?.filter(r => !r.hidden).length ? <div className="space-y-3">{reviews.data.filter(r => !r.hidden).map(r => <article key={r.id} data-testid={`review-${r.id}`} className="panel p-5"><div className="flex justify-between gap-3"><div><strong className="text-sm text-[#355c74]">{r.authorName}</strong><div className="flex mt-1">{[1,2,3,4,5].map(n => <Star key={n} size={13} className={n <= r.rating ? 'fill-[#9dbf67] text-[#799f57]' : 'text-[#ced9cb]'}/>)}</div></div><span className="text-[11px] text-[#819391]">{date(r.createdAt)}</span></div><p className="text-sm text-[#577178] mt-3 leading-relaxed">{r.comment}</p></article>)}</div> : <Notice title="Aquí empieza la conversación" text="Todavía no hay opiniones. La tuya podría ayudar a otro vecino a decidirse."/>}
    </section>
     {orderOpen && <OrderCheckout product={p} onClose={() => setOrderOpen(false)}/>}
  </div>;
}