import { useParams } from 'wouter';
import { MessageCircle, Star, Store } from 'lucide-react';
import { getGetSellerStoreQueryKey, useGetSellerStore } from '@api-client';
import { date, Notice, ProductCard, SkeletonGrid } from '@/components/market';

export default function SellerStorePage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const store = useGetSellerStore(id, { query: { enabled: !!id, queryKey: getGetSellerStoreQueryKey(id), refetchInterval: 30_000, refetchOnWindowFocus: true } });
  if (store.isLoading) return <div className="page-wrap py-12 space-y-5"><div className="skeleton h-40 rounded-3xl"/><SkeletonGrid/></div>;
  if (store.isError || !store.data) return <div className="page-wrap py-16"><Notice icon="error" title="No encontramos esta tienda" text="Puede que el vecino ya no venda aquí o que haya un problema de conexión." action={<button data-testid="button-retry-store" className="btn btn-primary" onClick={() => store.refetch()}>Reintentar</button>}/></div>;
  const s = store.data;
  const offline = !s.sellingToday;
  const wa = /^\d{9}$/.test(s.whatsappNumber || '') ? `https://wa.me/51${s.whatsappNumber}` : '';
  return <div className="page-wrap py-10 sm:py-14">
    <section className="bg-[#dfeae0] rounded-[28px] p-6 sm:p-9 flex flex-col sm:flex-row gap-6 sm:items-center">
      <div className="h-28 w-28 shrink-0 rounded-3xl bg-[#faf9f1] border border-[#cbd9cf] overflow-hidden flex items-center justify-center">{s.logoUrl ? <img data-testid="img-store-logo" src={s.logoUrl} alt={`Logo de ${s.name}`} className="w-full h-full object-cover"/> : <Store size={38} className="text-[#6b9380]"/>}</div>
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-[#5f9162]">Tienda vecinal</p>
        <h1 data-testid="text-store-name" className="font-display text-4xl sm:text-5xl text-[#294d64] tracking-tight mt-2 break-words">{s.name}</h1>
        <p className="text-xs text-[#5e7876] mt-2">Atendida por {s.sellerName}</p>
        {s.description && <p data-testid="text-store-description" className="text-sm text-[#527078] mt-3 max-w-xl leading-relaxed">{s.description}</p>}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <span className={`chip ${offline ? 'chip-blue' : 'chip-leaf'}`} data-testid="status-store-today">{offline ? 'Sin atender por hoy' : 'Vende hoy'}</span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#355c74]"><Star size={14} className="fill-[#a7cd70] text-[#719854]"/>{s.reviewCount ? `${s.rating.toFixed(1)} · ${s.reviewCount} opiniones` : 'Aún sin opiniones'}</span>
          {wa && <a data-testid="link-store-whatsapp" href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-light !min-h-9 !text-xs"><MessageCircle size={14}/> WhatsApp</a>}
        </div>
      </div>
    </section>
    {offline && <p data-testid="text-store-offline" className="mt-5 rounded-xl bg-[#f3ecd8] text-[#80632c] px-4 py-3 text-sm">Esta tienda no está atendiendo ahora. Puedes mirar sus productos, pero no se pueden pedir hasta que vuelva a vender.</p>}
    <section className="mt-12"><h2 className="font-display text-3xl text-[#294d64] mb-6">Productos de la tienda</h2>
      {s.products.length ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">{s.products.map(p => <ProductCard key={p.id} product={offline ? { ...p, available: false } : p}/>)}</div> : <Notice title="Sin productos por ahora" text="Esta tienda todavía no publicó nada."/>}
    </section>
    <section className="mt-14"><h2 className="font-display text-3xl text-[#294d64] mb-2">Opiniones de compradores</h2><p className="text-xs text-[#69807d] mb-5">Solo de pedidos entregados y verificados.</p>
      {s.reviews.length ? <div className="grid md:grid-cols-2 gap-3">{s.reviews.map(r => <article key={r.id} data-testid={`review-seller-${r.id}`} className="panel p-5"><div className="flex justify-between text-xs"><strong className="text-[#355c74]">{r.authorName}</strong><span className="text-[#80918a]">{date(r.createdAt)}</span></div><p className="text-xs text-[#719854] mt-1">{r.rating}/5</p>{r.comment && <p className="text-sm text-[#5e7876] mt-2">{r.comment}</p>}</article>)}</div> : <Notice title="Aún sin opiniones" text="Cuando un pedido se entregue, el comprador podrá calificar a este vecino."/>}
    </section>
  </div>;
}
