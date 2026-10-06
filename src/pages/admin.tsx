import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useSearch } from 'wouter';
import { Eye, Package, ShoppingBag, Star, Store, Users } from 'lucide-react';
import { getGetAdminOverviewQueryKey, getGetMeQueryKey, getGetPromotionSettingsQueryKey, getListAdminProductsQueryKey, getListAdminReviewsQueryKey, getListAdminSellerReviewsQueryKey, getListAdminSellersQueryKey, getListProductsQueryKey, getListPromotionRequestsQueryKey, getListPromotionsQueryKey, useClaimAdmin, useGetAdminOverview, useGetMe, useGetPromotionSettings, useListAdminProducts, useListAdminReviews, useListAdminSellerReviews, useModerateSellerReview, useListAdminSellers, useListPromotionRequests, useModerateProduct, useModerateReview, useModerateSeller, useReviewPromotionRequest, useUpdatePromotionSettings } from '@api-client';
import { money, Notice, PageHeading } from '@/components/market';
import { Reports } from '@/components/reports';
import { apiErrorMessage } from '@/lib/payment-proof';

export default function Admin() {
  const qc = useQueryClient();
  const me = useGetMe();
  const allowed = !!me.data?.isAdmin;
  const overview = useGetAdminOverview({ query: { enabled: allowed, queryKey: getGetAdminOverviewQueryKey() } });
  const products = useListAdminProducts({ query: { enabled: allowed, queryKey: getListAdminProductsQueryKey() } });
  const sellers = useListAdminSellers({ query: { enabled: allowed, queryKey: getListAdminSellersQueryKey() } });
  const reviews = useListAdminReviews({ query: { enabled: allowed, queryKey: getListAdminReviewsQueryKey() } });
  const sellerReviews = useListAdminSellerReviews({ query: { queryKey: getListAdminSellerReviewsQueryKey(), enabled: allowed, refetchInterval: 30_000, refetchOnWindowFocus: true } });
  const modSellerReview = useModerateSellerReview();
  const [terms, setTerms] = useState('');
  const [hl, setHl] = useState<number | null>(null);
  const scrolled = useRef(false);
  const promotionSettings = useGetPromotionSettings({ query: { enabled: allowed, queryKey: getGetPromotionSettingsQueryKey() } });
  const promotionRequests = useListPromotionRequests({ query: { enabled: allowed, queryKey: getListPromotionRequestsQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const savePromotionSettings = useUpdatePromotionSettings();
  const reviewPromotion = useReviewPromotionRequest();
  const [promotionPrice, setPromotionPrice] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [verified, setVerified] = useState<number[]>([]);
  const [promotionMessage, setPromotionMessage] = useState('');
  useEffect(() => { if (promotionSettings.data) { setPromotionPrice(String(promotionSettings.data.price)); setDailyLimit(String(promotionSettings.data.dailyLimit)); setTerms(promotionSettings.data.terms || ''); } }, [promotionSettings.data]);
  const modProduct = useModerateProduct();
  const modSeller = useModerateSeller();
  const modReview = useModerateReview();
  const claim = useClaimAdmin();
  const [password, setPassword] = useState('');
  const [claimError, setClaimError] = useState('');
  const search = useSearch();
  const qs = new URLSearchParams(search);
  const reqParam = Number(qs.get('request')) || null;
  const wantPromos = qs.get('tab') === 'promotions' || !!reqParam;
  const [tab, setTab] = useState<'products'|'sellers'|'reviews'|'promotions'>(wantPromos ? 'promotions' : 'products');
  useEffect(() => { scrolled.current = false; setHl(null); if (wantPromos) setTab('promotions'); }, [search, wantPromos]);
  useEffect(() => { if (!reqParam || scrolled.current || tab !== 'promotions' || !promotionRequests.data) return; const el = document.querySelector(`[data-testid="admin-promotion-${reqParam}"]`); if (el) { scrolled.current = true; setHl(reqParam); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, [reqParam, tab, promotionRequests.data]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const act = async (key:string, action:()=>Promise<unknown>, queryKey: readonly unknown[]) => { setBusy(key);setError(''); try { await action(); qc.invalidateQueries({queryKey}); qc.invalidateQueries({queryKey:getGetAdminOverviewQueryKey()}); qc.invalidateQueries({queryKey:getListProductsQueryKey()}); if (key.startsWith('feature-')) { qc.invalidateQueries({queryKey:getListPromotionsQueryKey()}); qc.invalidateQueries({queryKey:getListPromotionRequestsQueryKey()}); } } catch { setError('No se pudo completar la acción. Intenta de nuevo.'); } finally { setBusy(''); } };
  const updatePromotionPrice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const price = Number(promotionPrice);
    const limit = Number(dailyLimit);
    setError(''); setPromotionMessage('');
    if (!Number.isFinite(price) || price < 0.01 || price > 999.99) { setError('Ingresa un precio entre S/ 0.01 y S/ 999.99.'); return; }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) { setError('Ingresa un límite diario entre 1 y 100.'); return; }
    if (terms.trim().length < 10 || terms.trim().length > 2000) { setError('Los términos deben tener entre 10 y 2000 caracteres.'); return; }
    setBusy('promotion-price');
    try {
      await savePromotionSettings.mutateAsync({ data: { price, dailyLimit: limit, terms: terms.trim() } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetPromotionSettingsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListPromotionRequestsQueryKey() }),
      ]);
      setPromotionMessage('Configuración actualizada. Las solicitudes existentes conservan el monto con el que fueron enviadas.');
    } catch (err) { setError(apiErrorMessage(err, 'No se pudo guardar el precio. Intenta otra vez.')); }
    finally { setBusy(''); }
  };
  const decidePromotion = async (id: number, status: 'approved' | 'rejected') => {
    if (status === 'approved' && !verified.includes(id)) return;
    setBusy(`promotion-${id}`); setError(''); setPromotionMessage('');
    try {
      await reviewPromotion.mutateAsync({ id, data: { status } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: getListPromotionRequestsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListAdminProductsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }),
      ]);
      setVerified(current => current.filter(value => value !== id));
      setPromotionMessage(status === 'approved' ? 'Pago verificado. El servidor destacó el producto.' : 'Solicitud rechazada. El producto no se destacó.');
    } catch (err) { setError(apiErrorMessage(err, 'No se pudo revisar la solicitud. Intenta otra vez.')); }
    finally { setBusy(''); }
  };
  const activate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClaimError('');
    try {
      await claim.mutateAsync({ data: { password } });
      setPassword('');
      await qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      setClaimError('No se pudo activar. Comprueba la clave; si todavía no está configurada o ya se usó en otra cuenta, consulta con el propietario.');
    }
  };
  if (me.isLoading) return <div className="page-wrap py-14"><div className="skeleton h-14 w-1/2 rounded-xl mb-7"/><div className="skeleton h-48 rounded-2xl"/></div>;
  if (me.isError) return <div className="page-wrap py-16"><Notice icon="error" title="No pudimos verificar tu acceso" text="Intenta cargar nuevamente tu perfil." action={<button data-testid="button-retry-admin-auth" onClick={() => me.refetch()} className="btn btn-primary">Reintentar</button>}/></div>;
  if (!allowed) return <div className="page-wrap py-16 max-w-[580px]"><Notice title="Este espacio es privado" text="Solo el propietario puede activar la administración. Una vez asignada a una cuenta, la clave no dará acceso a otras."/><form onSubmit={activate} className="panel p-6 sm:p-8 mt-6"><label htmlFor="admin-setup-password" className="label">Clave de activación del propietario</label><input id="admin-setup-password" type="password" autoComplete="off" minLength={8} maxLength={200} value={password} onChange={e => setPassword(e.target.value)} className="field" required/><p className="text-xs text-[#69807d] mt-3">Primero entra con tu cuenta personal; después ingresa aquí la clave configurada de forma privada.</p>{claimError && <p role="alert" className="text-xs text-red-700 mt-3">{claimError}</p>}<button type="submit" disabled={claim.isPending} className="btn btn-primary mt-5 w-full">{claim.isPending ? 'Activando…' : 'Activar administración'}</button></form><Link href="/" data-testid="link-admin-back" className="text-xs text-[#355c74] font-bold hover:underline mt-5 inline-block">Volver al mercado</Link></div>;
  return <div className="page-wrap py-10 sm:py-14"><PageHeading eyebrow="Espacio de administración" title="Cuidemos este mercado." description="Una mirada a lo que sucede en la comunidad y las herramientas para mantenerla segura."/>
    {error && <p role="alert" className="text-sm bg-[#f8e4df] text-[#974f42] rounded-xl p-4 mb-5">{error}</p>}
    {overview.isLoading ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">{[1,2,3,4].map(n => <div key={n} className="skeleton h-32 rounded-2xl"/>)}</div> : overview.isError ? <Notice icon="error" title="No cargaron las estadísticas" text="Vuelve a intentarlo." action={<button data-testid="button-retry-overview" className="btn btn-primary" onClick={() => overview.refetch()}>Reintentar</button>}/> : <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-10">{[{label:'Productos',value:overview.data?.products,icon:Package},{label:'Vendedores',value:overview.data?.sellers,icon:Users},{label:'Pedidos',value:overview.data?.orders,icon:ShoppingBag},{label:'Visitas a productos',value:overview.data?.totalViews,icon:Eye}].map(stat => <div key={stat.label} className="panel p-5 sm:p-6"><stat.icon size={19} className="text-[#81a668] mb-5"/><p data-testid={`text-admin-${stat.label}`} className="font-display text-3xl sm:text-4xl text-[#294d64]">{stat.value ?? '—'}</p><p className="text-xs text-[#778d88] mt-1">{stat.label}</p></div>)}</div>}
    {overview.data && <div className="grid lg:grid-cols-2 gap-5 mb-12"><div className="panel p-6"><h2 className="font-display text-xl text-[#294d64] flex items-center gap-2 mb-4"><Eye size={18} className="text-[#6e9865]"/> Más vistos</h2>{overview.data.topViewed.length ? overview.data.topViewed.slice(0,5).map((p,i) => <div key={p.id} className="flex justify-between gap-2 text-xs py-3 border-t border-[#e3eae2]"><Link href={`/product/${p.id}`} data-testid={`link-top-viewed-${p.id}`} className="hover:underline"><span className="text-[#8aa480] mr-3">{String(i+1).padStart(2,'0')}</span>{p.name}</Link><strong>{p.views} vistas</strong></div>) : <p className="text-xs text-[#7b908a]">Sin visitas todavía.</p>}</div><div className="panel p-6"><h2 className="font-display text-xl text-[#294d64] flex items-center gap-2 mb-4"><Star size={18} className="text-[#6e9865]"/> Más pedidos</h2>{overview.data.topPurchased.length ? overview.data.topPurchased.slice(0,5).map((p,i) => <div key={p.id} className="flex justify-between gap-2 text-xs py-3 border-t border-[#e3eae2]"><Link href={`/product/${p.id}`} data-testid={`link-top-purchased-${p.id}`} className="hover:underline"><span className="text-[#8aa480] mr-3">{String(i+1).padStart(2,'0')}</span>{p.name}</Link><strong>{p.purchases} pedidos</strong></div>) : <p className="text-xs text-[#7b908a]">Sin pedidos todavía.</p>}</div></div>}
     <Reports admin/>
     <div className="flex gap-2 border-b border-[#d5dfd6] mb-6 overflow-x-auto">{(['products','sellers','reviews','promotions'] as const).map(t => <button data-testid={`button-admin-tab-${t}`} key={t} onClick={() => setTab(t)} className={`px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 ${tab === t ? 'border-[#719a64] text-[#355c74]' : 'border-transparent text-[#839590]'}`}>{t === 'products' ? 'Productos' : t === 'sellers' ? 'Vendedores' : t === 'reviews' ? 'Opiniones' : 'Promociones'}{t === 'promotions' && !!promotionRequests.data?.filter(r => r.status === 'pending').length ? ` · ${promotionRequests.data.filter(r => r.status === 'pending').length}` : ''}</button>)}</div>
    {tab === 'products' && (products.isLoading ? <div className="skeleton h-48 rounded-2xl"/> : products.isError ? <Notice icon="error" title="No cargaron los productos" text="Intenta otra vez." action={<button className="btn btn-primary" data-testid="button-retry-admin-products" onClick={() => products.refetch()}>Reintentar</button>}/> : products.data?.length ? <div className="space-y-3">{products.data.map(p => <div key={p.id} data-testid={`admin-product-${p.id}`} className="panel p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><Link href={`/product/${p.id}`} data-testid={`link-admin-product-${p.id}`} className="font-display text-lg text-[#294d64] hover:underline">{p.name}</Link><p className="text-xs text-[#80918a] mt-1">{p.sellerName} · {money(p.price)} · {p.hidden ? 'Oculto' : 'Visible'}</p></div><div className="flex flex-wrap gap-2"><button data-testid={`button-feature-product-${p.id}`} disabled={!!busy} onClick={() => act(`feature-${p.id}`,() => modProduct.mutateAsync({id:p.id,data:{featured:!p.featured}}),getListAdminProductsQueryKey())} className="btn btn-plain !min-h-9 !text-[11px]">{p.featured ? 'Quitar destacado' : 'Destacar'}</button><button data-testid={`button-reviews-product-${p.id}`} disabled={!!busy} onClick={() => act(`reviews-${p.id}`,() => modProduct.mutateAsync({id:p.id,data:{reviewsEnabled:!p.reviewsEnabled}}),getListAdminProductsQueryKey())} className="btn btn-plain !min-h-9 !text-[11px]">{p.reviewsEnabled ? 'Cerrar opiniones' : 'Abrir opiniones'}</button><button data-testid={`button-hide-product-${p.id}`} disabled={!!busy} onClick={() => act(`hide-${p.id}`,() => modProduct.mutateAsync({id:p.id,data:{hidden:!p.hidden}}),getListAdminProductsQueryKey())} className="btn btn-primary !min-h-9 !text-[11px]">{p.hidden ? 'Mostrar' : 'Ocultar'}</button></div></div>)}</div> : <Notice title="Sin productos" text="Aún no hay publicaciones que moderar."/> )}
    {tab === 'sellers' && (sellers.isLoading ? <div className="skeleton h-48 rounded-2xl"/> : sellers.isError ? <Notice icon="error" title="No cargaron los vendedores" text="Intenta otra vez." action={<button className="btn btn-primary" data-testid="button-retry-admin-sellers" onClick={() => sellers.refetch()}>Reintentar</button>}/> : sellers.data?.length ? <div className="space-y-3">{sellers.data.map(s => <div key={s.id} data-testid={`admin-seller-${s.id}`} className="panel p-4 sm:p-5 flex items-center justify-between gap-4"><div className="flex gap-3 items-center"><div className="w-10 h-10 rounded-full bg-[#d9e9cf] text-[#4b7459] flex items-center justify-center font-display">{s.name.charAt(0)}</div><div><p className="font-bold text-sm text-[#294d64]">{s.name}</p><p className="text-xs text-[#81938b]">{s.apartment || 'Sin departamento'} · {s.blocked ? 'Bloqueado' : 'Activo'}</p></div></div><button data-testid={`button-block-seller-${s.id}`} disabled={!!busy || s.id === me.data?.id} onClick={() => act(`seller-${s.id}`,() => modSeller.mutateAsync({id:s.id,data:{blocked:!s.blocked}}),getListAdminSellersQueryKey())} className="btn btn-plain !text-[11px]">{s.blocked ? 'Desbloquear' : 'Bloquear'}</button></div>)}</div> : <Notice title="Sin vendedores" text="Aún no hay vecinos vendedores registrados."/> )}
    {tab === 'reviews' && <section className="mb-10"><h2 className="font-display text-2xl text-[#294d64] mb-4">Opiniones de vendedores</h2>{sellerReviews.isLoading ? <div className="skeleton h-32 rounded-2xl"/> : sellerReviews.isError ? <Notice icon="error" title="No cargaron las opiniones de vendedores" text="Intenta otra vez." action={<button className="btn btn-primary" data-testid="button-retry-admin-seller-reviews" onClick={() => sellerReviews.refetch()}>Reintentar</button>}/> : sellerReviews.data?.length ? <div className="space-y-3">{sellerReviews.data.map(r => <div key={r.id} data-testid={`admin-seller-review-${r.id}`} className="panel p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"><div><span className="chip chip-blue">Vendedor</span><p className="text-xs font-bold text-[#355c74] mt-2">{r.authorName} sobre {r.sellerName} · {r.rating}/5 · {r.hidden ? 'Oculta' : 'Visible'}</p><p className="text-sm text-[#5e7876] mt-2">{r.comment}</p></div><button data-testid={`button-hide-seller-review-${r.id}`} disabled={!!busy} onClick={() => act(`sreview-${r.id}`,() => modSellerReview.mutateAsync({id:r.id,data:{hidden:!r.hidden}}),getListAdminSellerReviewsQueryKey())} className="btn btn-plain !text-[11px] shrink-0">{r.hidden ? 'Mostrar opinión' : 'Ocultar opinión'}</button></div>)}</div> : <Notice title="Sin opiniones de vendedores" text="Aparecerán cuando los compradores califiquen pedidos entregados."/>}<h2 className="font-display text-2xl text-[#294d64] mt-10">Opiniones de productos</h2></section>}
     {tab === 'reviews' && (reviews.isLoading ? <div className="skeleton h-48 rounded-2xl"/> : reviews.isError ? <Notice icon="error" title="No cargaron las opiniones" text="Intenta otra vez." action={<button className="btn btn-primary" data-testid="button-retry-admin-reviews" onClick={() => reviews.refetch()}>Reintentar</button>}/> : reviews.data?.length ? <div className="space-y-3">{reviews.data.map(r => <div key={r.id} data-testid={`admin-review-${r.id}`} className="panel p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"><div><p className="text-xs font-bold text-[#355c74]">{r.authorName} · {r.rating}/5 · {r.hidden ? 'Oculta' : 'Visible'}</p><p className="text-sm text-[#5e7876] mt-2">{r.comment}</p><Link href={`/product/${r.productId}`} data-testid={`link-admin-review-product-${r.id}`} className="text-xs text-[#73945f] hover:underline mt-2 inline-block">Ver producto</Link></div><button data-testid={`button-hide-review-${r.id}`} disabled={!!busy} onClick={() => act(`review-${r.id}`,() => modReview.mutateAsync({id:r.id,data:{hidden:!r.hidden}}),getListAdminReviewsQueryKey())} className="btn btn-plain !text-[11px] shrink-0">{r.hidden ? 'Mostrar opinión' : 'Ocultar opinión'}</button></div>)}</div> : <Notice title="Sin opiniones" text="Cuando los vecinos compartan reseñas, podrás cuidarlas desde aquí."/> )}
     {tab === 'promotions' && <div className="space-y-6">
       <section className="panel p-5 sm:p-7"><p className="eyebrow text-[#77985d]">Configuración</p><h2 className="font-display text-2xl text-[#294d64] mt-2">Destacados del día</h2><p className="text-xs text-[#69807d] mt-2 mb-5">Los vendedores pagan manualmente a {promotionSettings.data?.paymentName} · {promotionSettings.data?.paymentNumber}. Cambiar el precio no altera solicitudes ya enviadas. {promotionSettings.data?.remaining ?? '—'} disponibles hoy.</p>{promotionSettings.isLoading ? <div className="skeleton h-12 w-56 rounded-xl"/> : promotionSettings.isError ? <Notice icon="error" title="No cargó la configuración" text="Intenta cargarla otra vez." action={<button className="btn btn-primary" onClick={() => promotionSettings.refetch()}>Reintentar</button>}/> : <form onSubmit={updatePromotionPrice} className="grid gap-3 max-w-2xl"><div className="grid sm:grid-cols-2 gap-3"><div className="flex-1"><label htmlFor="admin-promotion-price" className="label">Precio por solicitud (S/)</label><input id="admin-promotion-price" data-testid="input-admin-promotion-price" className="field" type="number" min="0.01" max="999.99" step="0.01" inputMode="decimal" value={promotionPrice} onChange={e => setPromotionPrice(e.target.value)} required/></div><div className="flex-1"><label htmlFor="admin-daily-limit" className="label">Límite diario</label><input id="admin-daily-limit" data-testid="input-admin-daily-limit" className="field" type="number" min="1" max="100" step="1" value={dailyLimit} onChange={e => setDailyLimit(e.target.value)} required/></div></div><div><label htmlFor="admin-promotion-terms" className="label">Términos y condiciones ({terms.trim().length}/2000)</label><textarea id="admin-promotion-terms" data-testid="input-admin-promotion-terms" className="field min-h-32" maxLength={2000} value={terms} onChange={e => setTerms(e.target.value)} required/></div><button data-testid="button-save-promotion-price" type="submit" disabled={!!busy} className="btn btn-primary">Guardar cambios</button></form>}</section>
       {promotionMessage && <p role="status" data-testid="status-admin-promotion" className="rounded-xl bg-[#e1efd6] text-[#3e6e4e] px-4 py-3 text-sm">{promotionMessage}</p>}
       <section><div className="mb-4"><p className="eyebrow text-[#77985d]">Revisión manual</p><h2 className="font-display text-2xl text-[#294d64] mt-2">Solicitudes de promoción</h2><p className="text-xs text-[#69807d] mt-2">Una captura no confirma el pago. Verifica la transferencia en tu cuenta antes de aprobar; el servidor destacará el producto al aprobarlo.</p></div>
        {promotionRequests.isLoading ? <div className="space-y-3"><div className="skeleton h-48 rounded-2xl"/><div className="skeleton h-48 rounded-2xl"/></div>
          : promotionRequests.isError ? <Notice icon="error" title="No cargaron las solicitudes" text="Vuelve a intentarlo." action={<button className="btn btn-primary" onClick={() => promotionRequests.refetch()}>Reintentar</button>}/>
          : promotionRequests.data?.length ? <div className="space-y-4">{[...promotionRequests.data].sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.id - a.id).map(r =>
            <article key={r.id} data-testid={`admin-promotion-${r.id}`} className={`panel p-5 sm:p-6 scroll-mt-28 ${hl === r.id ? 'ring-2 ring-[#719a64]' : ''}`}>
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <span data-testid={`status-admin-promotion-${r.id}`} className={`chip ${r.status === 'approved' ? 'chip-leaf' : 'chip-blue'}`}>{r.status === 'pending' ? 'Pendiente' : r.status === 'approved' ? 'Aprobada' : r.status === 'withdrawn' ? 'Retirada por el vendedor' : 'Rechazada'}</span>
                  <h3 className="font-display text-xl text-[#294d64] mt-3">{r.status === 'withdrawn' ? r.productName : <Link href={`/product/${r.productId}`} className="hover:underline" data-testid={`link-admin-promotion-product-${r.id}`}>{r.productName}</Link>}</h3>
                  <p className="text-xs text-[#69807d] mt-1">Vendedor: {r.sellerName} · Solicitud #{r.id}</p>
                  <p data-testid={`text-admin-promotion-amount-${r.id}`} className="font-bold text-sm text-[#355c74] mt-3">Monto al solicitar: {money(r.amount)}</p>
                  <p className="text-xs text-[#80918a] mt-1">{new Date(r.createdAt).toLocaleString('es-PE')}{r.reviewedAt ? ` · Revisada ${new Date(r.reviewedAt).toLocaleString('es-PE')}` : ''}</p>{r.terms && <details className="mt-3 text-xs text-[#5e7876]"><summary className="cursor-pointer font-bold text-[#355c74]">Términos aceptados{r.acceptedAt ? ` el ${new Date(r.acceptedAt).toLocaleString('es-PE')}` : ''}</summary><p className="whitespace-pre-line mt-2">{r.terms}</p></details>}
                </div>
                <a data-testid={`link-admin-promotion-proof-${r.id}`} href={r.proofPath} target="_blank" rel="noopener noreferrer" className="block shrink-0 w-full sm:w-32 h-32 rounded-xl overflow-hidden border border-[#cbd9cf] bg-[#e8efe4]"><img src={r.proofPath} alt={`Comprobante protegido de ${r.sellerName}`} className="w-full h-full object-contain"/></a>
              </div>
              {r.status === 'pending' && <div className="mt-5 border-t border-[#e3eae2] pt-4">
                <label className="flex gap-2 items-start text-xs text-[#47606a] cursor-pointer"><input data-testid={`checkbox-verify-promotion-${r.id}`} type="checkbox" className="mt-0.5 accent-[#355c74]" checked={verified.includes(r.id)} onChange={e => setVerified(current => e.target.checked ? [...current, r.id] : current.filter(id => id !== r.id))}/><span>Comprobé independientemente que la transferencia de {money(r.amount)} ingresó a la cuenta indicada.</span></label>
                <div className="flex flex-wrap gap-2 mt-4"><button data-testid={`button-approve-promotion-${r.id}`} disabled={!!busy || !verified.includes(r.id)} onClick={() => decidePromotion(r.id, 'approved')} className="btn btn-primary !text-xs">Confirmar pago y destacar</button><button data-testid={`button-reject-promotion-${r.id}`} disabled={!!busy} onClick={() => decidePromotion(r.id, 'rejected')} className="btn btn-plain !text-xs">Rechazar</button></div>
              </div>}
            </article>)}</div>
          : <Notice title="Sin solicitudes todavía" text="Cuando un vecino solicite destacar un producto, aparecerá aquí con su comprobante para que verifiques el pago."/>}</section>
     </div>}
    <div className="mt-12 rounded-2xl bg-[#e8efe4] p-5 flex items-center gap-3 text-xs text-[#577369]"><Store size={19} className="shrink-0"/> Las acciones de moderación afectan lo que ven los vecinos. Úsalas con criterio y transparencia.</div>
  </div>;
}