import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowRight, ImagePlus, Edit3, Package, Plus, Sparkles, Store, Trash2, X } from 'lucide-react';
import { getGetMeQueryKey, getGetPromotionSettingsQueryKey, getListMyProductsQueryKey, getListProductsQueryKey, getListPromotionRequestsQueryKey, getListPromotionsQueryKey, useCreateProduct, useCreatePromotionRequest, useDeleteProduct, useGetMe, useGetPromotionSettings, useListMyProducts, useListPromotionRequests, useUpdateMe, useUpdateProduct, useWithdrawPromotionRequest, type Product } from '@api-client';
import { money, Notice, PageHeading } from '@/components/market';
import { ProductImagePicker } from '@/components/product-image-picker';
import { PaymentProofPicker } from '@/components/payment-proof-picker';
import { apiErrorMessage, uploadPaymentProof } from '@/lib/payment-proof';
import { uploadMarketplaceImage } from '@/lib/product-image-upload';

type FormState = { name: string; description: string; category: string; price: string; imageUrl: string };
const blank: FormState = { name: '', description: '', category: '', price: '', imageUrl: '' };
export default function Sell() {
  const qc = useQueryClient();
  const me = useGetMe();
  const mine = useListMyProducts({ query: { queryKey: getListMyProductsQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const updateMe = useUpdateMe();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const promotionSettings = useGetPromotionSettings({ query: { queryKey: getGetPromotionSettingsQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const promotionRequests = useListPromotionRequests({ query: { queryKey: getListPromotionRequestsQueryKey(), refetchInterval: 15_000, refetchOnWindowFocus: true } });
  const createPromotion = useCreatePromotionRequest();
  const deleteProduct = useDeleteProduct();
  const withdrawPromotion = useWithdrawPromotionRequest();
  const [confirmAction, setConfirmAction] = useState<{ kind: 'product' | 'promotion'; id: number; name: string; approved?: boolean } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [promoting, setPromoting] = useState<Product | null>(null);
  const [promotionProof, setPromotionProof] = useState<File | null>(null);
  const [promotionBusy, setPromotionBusy] = useState(false);
  const [promotionError, setPromotionError] = useState('');
  const [profile, setProfile] = useState({ name: '', apartment: '', yapeNumber: '', storeName: '', storeDescription: '', whatsappNumber: '', logoUrl: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoError, setLogoError] = useState('');
  const logoInput = useRef<HTMLInputElement>(null);
  const [accepted, setAccepted] = useState<{ terms: string; price: number } | null>(null);
  useEffect(() => { if (!logoFile) { setLogoPreview(''); return; } const u = URL.createObjectURL(logoFile); setLogoPreview(u); return () => URL.revokeObjectURL(u); }, [logoFile]);
  const pickLogo = (f: File | undefined) => { if (!f) return; setLogoError(''); if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type) || f.size > 5 * 1024 * 1024) { setLogoError('El logo debe ser JPG, PNG, WebP o GIF de hasta 5 MB.'); return; } setLogoFile(f); };
  useEffect(() => { const d = promotionSettings.data; if (accepted && d && (d.terms !== accepted.terms || d.price !== accepted.price)) { setAccepted(null); setPromotionError('Las condiciones o el precio cambiaron. Revísalos y vuelve a aceptar para continuar.'); } }, [promotionSettings.data, accepted]);
  const [initialized, setInitialized] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { if (me.data && !initialized) { setProfile({ name: me.data.name || '', apartment: me.data.apartment || '', yapeNumber: me.data.yapeNumber || '', storeName: me.data.storeName || '', storeDescription: me.data.storeDescription || '', whatsappNumber: me.data.whatsappNumber || '', logoUrl: me.data.logoUrl || '' }); setInitialized(true); } }, [me.data, initialized]);
  const saveProfile = async () => { setError('');setMessage(''); if (!profile.name.trim() || profile.name.trim().length < 2) { setError('Ingresa un nombre de al menos 2 letras.'); return; } if (profile.yapeNumber && !/^\d{9}$/.test(profile.yapeNumber)) { setError('El número de Yape debe tener 9 dígitos.'); return; } if (profile.whatsappNumber && !/^\d{9}$/.test(profile.whatsappNumber)) { setError('El WhatsApp debe tener 9 dígitos.'); return; } try { let logoUrl = profile.logoUrl; if (logoFile) logoUrl = await uploadMarketplaceImage(logoFile); await updateMe.mutateAsync({ data: { name: profile.name.trim(), apartment: profile.apartment.trim(), yapeNumber: profile.yapeNumber, storeName: profile.storeName.trim(), storeDescription: profile.storeDescription.trim(), whatsappNumber: profile.whatsappNumber, logoUrl, role: 'seller' } }); setProfile(c => ({ ...c, logoUrl })); setLogoFile(null); qc.invalidateQueries({ queryKey: getGetMeQueryKey() }); qc.invalidateQueries({ queryKey: getListProductsQueryKey() }); setMessage('Tus datos ya están actualizados.'); } catch { setError('No pudimos guardar tu perfil o subir el logo. Intenta de nuevo.'); } };
  const toggleToday = async () => { if (!me.data) return; setError(''); try { await updateMe.mutateAsync({ data: { role: 'seller', sellingToday: !me.data.sellingToday } }); qc.invalidateQueries({ queryKey: getGetMeQueryKey() }); qc.invalidateQueries({ queryKey: getGetPromotionSettingsQueryKey() }); qc.invalidateQueries({ queryKey: getListProductsQueryKey() }); } catch { setError('No pudimos cambiar tu disponibilidad.'); } };
  const showForm = (p?: Product) => {
    setEditing(p || null);
    setForm(p ? {name:p.name,description:p.description,category:p.category,price:String(p.price),imageUrl:p.imageUrl || ''} : blank);
    setSelectedFile(null);
    setError('');
    setOpen(true);
  };
  const saveProduct = async () => {
    setError('');
    const price = Number(form.price);
    if (form.name.trim().length < 2 || form.description.trim().length < 2 || form.category.trim().length < 2 || !Number.isFinite(price) || price <= 0) {
      setError('Completa nombre, descripción, categoría y un precio mayor a cero.');
      return;
    }
    if (me.data?.role !== 'seller') {
      setError('Primero guarda tus datos de vendedor.');
      return;
    }
    setSaving(true);
    try {
      let imageUrl = form.imageUrl.trim();
      if (selectedFile) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(selectedFile.type) || selectedFile.size > 5 * 1024 * 1024) {
          throw new Error('Invalid image');
        }
        imageUrl = await uploadMarketplaceImage(selectedFile);
      }
      const data = { name: form.name.trim(), description: form.description.trim(), category: form.category.trim(), price, imageUrl };
      if (editing) await update.mutateAsync({ id: editing.id, data });
      else await create.mutateAsync({ data });
      await Promise.all([
        qc.invalidateQueries({ queryKey: getListMyProductsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() }),
      ]);
      setSelectedFile(null);
      setOpen(false);
      setMessage(editing ? 'Producto actualizado.' : 'Producto publicado.');
    } catch {
      setError('No pudimos subir la foto o guardar el producto. Comprueba tu conexión e inténtalo otra vez.');
    } finally {
      setSaving(false);
    }
  };
  const toggleAvailable = async (p: Product) => { setError(''); try { await update.mutateAsync({ id:p.id, data:{available:!p.available} }); qc.invalidateQueries({ queryKey:getListMyProductsQueryKey() }); qc.invalidateQueries({ queryKey:getListProductsQueryKey() }); } catch { setError('No pudimos cambiar la disponibilidad del producto.'); } };
  const requestPromotion = async () => {
    if (!promoting || promotionBusy) return;
    setPromotionError('');
    if (promotionSettings.data?.remaining === 0) { setPromotionError('Se alcanzó el límite diario de destacados. Vuelve a intentarlo mañana.'); return; }
    if (!accepted) { setPromotionError('Acepta los términos y condiciones para continuar.'); return; }
    if (!promotionProof) { setPromotionError('Adjunta una captura del pago antes de enviar tu solicitud.'); return; }
    if (promotionRequests.data?.some(r => r.productId === promoting.id && r.status === 'pending')) { setPromotionError('Ya hay una solicitud pendiente para este producto.'); return; }
    setPromotionBusy(true);
    try {
      const proofPath = await uploadPaymentProof(promotionProof, 'promotion');
      await createPromotion.mutateAsync({ data: { productId: promoting.id, proofPath, acceptedTerms: true, terms: accepted.terms, expectedPrice: accepted.price } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: getGetPromotionSettingsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListPromotionRequestsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListMyProductsQueryKey() }),
      ]);
      setPromoting(null);
      setPromotionProof(null); setAccepted(null);
      setMessage('Solicitud enviada. La administración verificará el pago antes de destacar tu producto.');
    } catch (err) {
      setPromotionError(apiErrorMessage(err, 'No pudimos enviar la solicitud. Inténtalo de nuevo.'));
    } finally { setPromotionBusy(false); }
  };
  const confirmRemoval = async () => {
    if (!confirmAction || actionBusy) return;
    setError(''); setActionBusy(true);
    try {
      if (confirmAction.kind === 'product') await deleteProduct.mutateAsync({ id: confirmAction.id });
      else await withdrawPromotion.mutateAsync({ id: confirmAction.id });
      await Promise.all([
        qc.invalidateQueries({ queryKey: getListMyProductsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() }),
        qc.invalidateQueries({ queryKey: getListPromotionRequestsQueryKey() }),
        qc.invalidateQueries({ queryKey: getGetPromotionSettingsQueryKey() }),
      ]);
      setMessage(confirmAction.kind === 'product' ? 'Producto eliminado del catálogo. Tus ventas anteriores siguen en el historial.' : 'Solicitud retirada. Si estaba aprobada, el producto ya no estará destacado por esta promoción.');
      setConfirmAction(null);
    } catch (cause) {
      setError(apiErrorMessage(cause, 'No se pudo completar la acción. Inténtalo otra vez.'));
      setConfirmAction(null);
    } finally { setActionBusy(false); }
  };
  if (me.isLoading) return <div className="page-wrap py-12 space-y-5"><div className="skeleton h-16 w-2/3 rounded-xl"/><div className="skeleton h-60 rounded-2xl"/><div className="skeleton h-48 rounded-2xl"/></div>;
  if (me.isError) return <div className="page-wrap py-16"><Notice icon="error" title="No pudimos abrir tu espacio" text="Intenta cargar tu perfil nuevamente." action={<button data-testid="button-retry-seller" className="btn btn-primary" onClick={() => me.refetch()}>Reintentar</button>}/></div>;
  if (me.data?.blocked) return <div className="page-wrap py-16"><Notice title="Tu cuenta de vendedor está pausada" text="No puedes publicar mientras esté bloqueada. Comunícate con la administración del condominio para resolverlo."/></div>;
  return <div className="page-wrap py-10 sm:py-14"><PageHeading eyebrow="Tu espacio de venta" title={`Hola, ${me.data?.name?.split(' ')[0] || 'vecino'}.`} description="Tu pequeño mostrador en Los Laureles. Organiza tus productos y avisa cuándo estás vendiendo." action={<button data-testid="button-add-product" className="btn btn-primary" onClick={() => showForm()}><Plus size={17}/> Nuevo producto</button>}/>
    {message && <p data-testid="status-seller-success" className="bg-[#e1efd6] text-[#3e6e4e] rounded-xl px-4 py-3 text-sm mb-5">{message}</p>}{error && !open && <p role="alert" className="bg-[#f8e5df] text-[#944939] rounded-xl px-4 py-3 text-sm mb-5">{error}</p>}
    <div className="grid lg:grid-cols-[.85fr_1.15fr] gap-6">
      <div className="space-y-6"><section className="bg-[#355c74] text-[#f8f9ee] rounded-[24px] p-6 sm:p-8"><div className="flex justify-between items-start"><div><span className="eyebrow text-[#bfdc9b]">Estado del día</span><h2 className="font-display text-2xl mt-2">¿Estás vendiendo hoy?</h2></div><Store className="text-[#b9dd84]"/></div><p className="text-xs text-[#c3d7d6] leading-relaxed mt-3 mb-6">Cuando activas esta opción, tus vecinos saben que pueden hacerte pedidos ahora.</p><button data-testid="button-toggle-selling-today" disabled={updateMe.isPending} onClick={toggleToday} className={`btn w-full ${me.data?.sellingToday ? 'btn-leaf' : 'btn-light'}`}>{updateMe.isPending ? 'Actualizando…' : me.data?.sellingToday ? 'Disponible hoy · Desactivar' : 'No disponible · Activar ventas'}</button></section>
       <section className="panel p-6 sm:p-7"><p className="eyebrow text-[#77985d]">Tu presentación</p><h2 className="font-display text-2xl text-[#294d64] mt-2 mb-5">Datos de vendedor</h2><div className="space-y-4"><div><label className="label" htmlFor="seller-name">Tu nombre</label><input id="seller-name" data-testid="input-seller-name" className="field" maxLength={80} value={profile.name} onChange={e => setProfile({...profile,name:e.target.value})}/></div><div><label className="label" htmlFor="seller-apartment">Departamento o referencia</label><input id="seller-apartment" data-testid="input-seller-apartment" className="field" maxLength={60} placeholder="Ej. Torre B, dpto. 304" value={profile.apartment} onChange={e => setProfile({...profile,apartment:e.target.value})}/></div><div><label className="label" htmlFor="seller-yape">Número de Yape / Plin</label><input id="seller-yape" data-testid="input-seller-yape" className="field" inputMode="numeric" maxLength={9} placeholder="9 dígitos" value={profile.yapeNumber} onChange={e => setProfile({...profile,yapeNumber:e.target.value.replace(/\D/g,'')})}/><p className="text-[11px] text-[#80948e] mt-2">Lo verán los compradores al elegir pago digital. El pago se confirma manualmente.</p></div><div className="border-t border-[#e3eae2] pt-4"><p className="label">Tu tienda</p><div className="flex gap-4 items-center mb-3"><div className="h-20 w-20 rounded-2xl bg-[#e8efe4] border border-[#cbd9cf] overflow-hidden flex items-center justify-center shrink-0">{(logoPreview || profile.logoUrl) ? <img data-testid="img-logo-preview" src={logoPreview || profile.logoUrl} alt="Logo de tu tienda" className="w-full h-full object-cover"/> : <Store size={26} className="text-[#6b9380]"/>}</div><div className="flex flex-col gap-2"><input ref={logoInput} data-testid="input-store-logo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => { pickLogo(e.target.files?.[0]); e.target.value = ''; }}/><button type="button" data-testid="button-pick-logo" className="btn btn-plain !min-h-9 !text-xs" onClick={() => logoInput.current?.click()}><ImagePlus size={14}/> {profile.logoUrl || logoFile ? 'Cambiar logo' : 'Subir logo'}</button>{(logoFile || profile.logoUrl) && <button type="button" data-testid="button-remove-logo" className="text-[11px] font-bold text-[#975342] hover:underline text-left" onClick={() => { setLogoFile(null); setProfile(c => ({ ...c, logoUrl: '' })); }}>Quitar logo</button>}</div></div>{logoError && <p role="alert" className="text-xs text-[#974f42] mb-2">{logoError}</p>}{logoFile && <p className="text-[11px] text-[#80948e] mb-2">Se subirá al guardar.</p>}<div className="space-y-4"><div><label className="label" htmlFor="store-name">Nombre de la tienda</label><input id="store-name" data-testid="input-store-name" className="field" maxLength={80} value={profile.storeName} onChange={e => setProfile({...profile,storeName:e.target.value})}/></div><div><label className="label" htmlFor="store-desc">Descripción</label><textarea id="store-desc" data-testid="input-store-description" className="field min-h-20" maxLength={500} value={profile.storeDescription} onChange={e => setProfile({...profile,storeDescription:e.target.value})}/></div><div><label className="label" htmlFor="store-wa">WhatsApp de contacto (opcional)</label><input id="store-wa" data-testid="input-store-whatsapp" className="field" inputMode="numeric" maxLength={9} placeholder="9 dígitos" value={profile.whatsappNumber} onChange={e => setProfile({...profile,whatsappNumber:e.target.value.replace(/\D/g,'')})}/><p className="text-[11px] text-[#80948e] mt-2">Se muestra públicamente en tu tienda. Es independiente de tu Yape.</p></div>{me.data && <Link href={`/seller/${me.data.id}`} data-testid="link-my-store" className="text-xs font-bold text-[#355c74] hover:underline inline-block">Ver mi tienda pública</Link>}</div></div><button data-testid="button-save-profile" onClick={saveProfile} disabled={updateMe.isPending} className="btn btn-primary w-full">{updateMe.isPending ? 'Guardando…' : 'Guardar mis datos'}</button></div></section></div>
         <section>
           <div className="flex items-end justify-between mb-4">
             <div><span className="eyebrow text-[#77985d]">Lo que compartes</span><h2 className="font-display text-2xl sm:text-3xl text-[#294d64] mt-2">Mis productos</h2></div>
             <span className="text-xs text-[#839591]">{mine.data?.length || 0} publicados</span>
           </div>
           {promotionSettings.data && <p data-testid="text-promotion-remaining" className="text-xs text-[#69807d] mb-4">{promotionSettings.data.remaining === 0 ? 'Se alcanzó el límite diario de destacados.' : `${promotionSettings.data.remaining} de ${promotionSettings.data.dailyLimit} destacados disponibles hoy.`}</p>}
           {mine.isLoading ? <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-32 rounded-2xl"/>)}</div>
             : mine.isError ? <Notice icon="error" title="No cargaron tus productos" text="Intentemos otra vez." action={<button data-testid="button-retry-mine" className="btn btn-primary" onClick={() => mine.refetch()}>Reintentar</button>}/>
             : mine.data?.length ? <div className="space-y-3">{mine.data.map(p => {
               const requests = promotionRequests.data?.filter(r => r.productId === p.id) || [];
               const latest = requests.find(r => r.status === 'pending') || [...requests].sort((a, b) => b.id - a.id)[0];
               return <div key={p.id} data-testid={`row-my-product-${p.id}`} className="panel p-3 flex gap-4">
                 <div className="w-24 h-24 rounded-xl bg-[#d9e8d5] shrink-0 overflow-hidden">{p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-[#6b9380]"><Package size={25}/></div>}</div>
                 <div className="flex-1 min-w-0 py-1">
                   <div className="flex justify-between gap-2"><Link href={`/product/${p.id}`} data-testid={`link-my-product-${p.id}`} className="font-display text-lg leading-tight text-[#294d64] hover:underline line-clamp-1">{p.name}</Link><strong className="text-xs whitespace-nowrap text-[#355c74]">{money(p.price)}</strong></div>
                   <p className="text-[11px] text-[#85968f] mt-1">{p.category} · {p.available ? 'Publicado' : 'Pausado'}</p>
                   <div className="flex flex-wrap gap-x-3 gap-y-2 mt-3">
                     <button data-testid={`button-edit-product-${p.id}`} onClick={() => showForm(p)} className="text-[11px] font-bold text-[#355c74] flex items-center gap-1 hover:underline"><Edit3 size={12}/> Editar</button>
                     <button data-testid={`button-toggle-product-${p.id}`} disabled={update.isPending} onClick={() => toggleAvailable(p)} className="text-[11px] font-bold text-[#678f56] hover:underline">{p.available ? 'Pausar' : 'Volver a publicar'}</button>
                     <button data-testid={`button-delete-product-${p.id}`} disabled={actionBusy} onClick={() => setConfirmAction({ kind: 'product', id: p.id, name: p.name })} className="text-[11px] font-bold text-[#975342] flex items-center gap-1 hover:underline"><Trash2 size={12}/> Eliminar</button>
                     {promotionRequests.isLoading ? <span className="text-[11px] text-[#85968f]">Consultando promoción…</span>
                       : promotionRequests.isError ? <button data-testid={`button-retry-promotion-${p.id}`} onClick={() => promotionRequests.refetch()} className="text-[11px] font-bold text-[#9a5c48] hover:underline">Reintentar promoción</button>
                       : latest?.status === 'pending' ? <>
                         <span data-testid={`status-promotion-${p.id}`} className="text-[11px] font-bold text-[#a46d31]">Promoción pendiente de verificación</span>
                         <button data-testid={`button-withdraw-promotion-${latest.id}`} disabled={actionBusy} onClick={() => setConfirmAction({ kind: 'promotion', id: latest.id, name: p.name })} className="text-[11px] font-bold text-[#975342] hover:underline">Retirar solicitud</button>
                       </> : p.featured ? <>
                         <span data-testid={`status-promotion-${p.id}`} className="text-[11px] font-bold text-[#557b4b]">Destacado{latest?.status === 'approved' ? ' · Aprobado' : ''}</span>
                         {latest?.status === 'approved' && <button data-testid={`button-withdraw-promotion-${latest.id}`} disabled={actionBusy} onClick={() => setConfirmAction({ kind: 'promotion', id: latest.id, name: p.name, approved: true })} className="text-[11px] font-bold text-[#975342] hover:underline">Quitar destaque</button>}
                       </> : <>
                         {latest?.status === 'approved' && <span data-testid={`status-promotion-${p.id}`} className="text-[11px] font-bold text-[#557b4b]">Promoción aprobada anteriormente</span>}
                         {latest?.status === 'withdrawn' && <span data-testid={`status-promotion-${p.id}`} className="text-[11px] font-bold text-[#85968f]">Solicitud retirada</span>}
                         <button data-testid={`button-promote-product-${p.id}`} disabled={!p.available || p.hidden || !promotionSettings.data || promotionSettings.data.remaining === 0} onClick={() => { setPromoting(p); setPromotionProof(null); setPromotionError(''); setAccepted(null); }} className="text-[11px] font-bold text-[#a46d31] flex items-center gap-1 hover:underline disabled:opacity-50"><Sparkles size={12}/>{promotionSettings.data?.remaining === 0 ? 'Límite diario alcanzado' : latest?.status === 'rejected' ? 'Rechazada · Solicitar otra vez' : !p.available || p.hidden ? 'Publica el producto para promocionarlo' : 'Solicitar destacado'}</button>
                       </>}
                   </div>
                 </div>
               </div>;
             })}</div>
             : <Notice title="Tu mostrador está listo" text="Publica tu primer producto o servicio. A veces, el primer cliente está a solo una puerta de distancia." action={<button data-testid="button-first-product" className="btn btn-primary" onClick={() => showForm()}>Publicar producto <ArrowRight size={15}/></button>}/>}
         </section>
    </div>
    {open && <div className="fixed inset-0 z-50 bg-[#173343]/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-5" onClick={() => { if (!saving) setOpen(false); }}><div role="dialog" aria-modal="true" aria-label="Formulario de producto" className="bg-[#faf9f1] rounded-t-[28px] sm:rounded-[28px] p-6 sm:p-8 w-full max-w-[560px] max-h-[95dvh] overflow-y-auto" onClick={e => e.stopPropagation()}><div className="flex justify-between mb-6"><div><p className="eyebrow text-[#80a163]">Tu mostrador</p><h2 className="font-display text-3xl text-[#294d64] mt-2">{editing ? 'Editar producto' : 'Nuevo producto'}</h2></div><button data-testid="button-close-product-form" aria-label="Cerrar" disabled={saving} onClick={() => setOpen(false)}><X size={20}/></button></div><div className="space-y-4"><div><label className="label" htmlFor="product-name">Nombre del producto</label><input id="product-name" data-testid="input-product-name" className="field" maxLength={120} value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Ej. Brownies caseros"/></div><div><label className="label" htmlFor="product-description">Descripción</label><textarea id="product-description" data-testid="input-product-description" maxLength={1000} className="field min-h-24" value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="Cuéntales qué lo hace especial..."/></div><div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="product-category">Categoría</label><input id="product-category" data-testid="input-product-category" className="field" maxLength={50} list="product-categories" value={form.category} onChange={e => setForm({...form,category:e.target.value})} placeholder="Ej. Postres"/><datalist id="product-categories">{['Comida casera','Postres','Bebidas','Servicios','Ropa','Hogar','Otros'].map(c => <option key={c} value={c}/>)}</datalist></div><div><label className="label" htmlFor="product-price">Precio (S/)</label><input id="product-price" data-testid="input-product-price" className="field" type="number" min="0.01" step="0.01" inputMode="decimal" value={form.price} onChange={e => setForm({...form,price:e.target.value})} placeholder="0.00"/></div></div><ProductImagePicker file={selectedFile} imageUrl={form.imageUrl} disabled={saving} onError={setError} onChange={(file, imageUrl) => { setSelectedFile(file); if (imageUrl !== undefined) setForm(current => ({ ...current, imageUrl })); }}/>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}<button data-testid="button-save-product" disabled={saving || create.isPending || update.isPending} onClick={saveProduct} className="btn btn-primary w-full">{saving ? selectedFile ? 'Subiendo foto y guardando…' : 'Guardando…' : editing ? 'Guardar cambios' : 'Publicar producto'}</button></div></div></div>}
     {confirmAction && <div className="fixed inset-0 z-50 bg-[#173343]/60 flex items-end sm:items-center justify-center sm:p-5" onClick={() => { if (!actionBusy) setConfirmAction(null); }}>
       <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-removal-title" className="bg-[#faf9f1] rounded-t-[28px] sm:rounded-[28px] p-6 sm:p-8 w-full max-w-[440px]" onClick={e => e.stopPropagation()}>
         <h2 id="confirm-removal-title" className="font-display text-2xl text-[#294d64]">{confirmAction.kind === 'product' ? '¿Eliminar este producto?' : confirmAction.approved ? '¿Quitar el destaque?' : '¿Retirar la solicitud?'}</h2>
         <p className="text-sm text-[#5e7876] mt-3">{confirmAction.kind === 'product' ? `“${confirmAction.name}” desaparecerá del catálogo y se retirarán sus solicitudes de destaque activas. Los pedidos existentes seguirán en Mis pedidos y deberán atenderse; el historial de ventas se conservará.` : confirmAction.approved ? `“${confirmAction.name}” dejará de estar destacado por esta promoción. El retiro no genera un reembolso automático; comunícate con la administración si corresponde.` : `La solicitud de “${confirmAction.name}” se retirará y liberará el cupo. El retiro no genera un reembolso automático; comunícate con la administración si ya pagaste.`}</p>
         <div className="flex justify-end gap-3 mt-6"><button data-testid="button-cancel-removal" disabled={actionBusy} onClick={() => setConfirmAction(null)} className="btn btn-plain">Volver</button><button data-testid="button-confirm-removal" disabled={actionBusy} onClick={confirmRemoval} className="btn btn-primary">{actionBusy ? 'Procesando…' : confirmAction.kind === 'product' ? 'Eliminar producto' : 'Retirar destaque'}</button></div>
       </div>
     </div>}
     {promoting && <div className="fixed inset-0 z-50 bg-[#173343]/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-5" onClick={() => { if (!promotionBusy) setPromoting(null); }}><div role="dialog" aria-modal="true" aria-label="Solicitar promoción" className="bg-[#faf9f1] rounded-t-[28px] sm:rounded-[28px] p-6 sm:p-8 w-full max-w-[510px] max-h-[95dvh] overflow-y-auto" onClick={e => e.stopPropagation()}><div className="flex justify-between gap-3 mb-5"><div><p className="eyebrow text-[#80a163]">Hazlo visible</p><h2 className="font-display text-3xl text-[#294d64] mt-2">Destaca tu producto</h2><p className="text-sm text-[#648080] mt-2">{promoting.name}</p></div><button data-testid="button-close-promotion" aria-label="Cerrar" disabled={promotionBusy} onClick={() => setPromoting(null)}><X size={20}/></button></div>{promotionSettings.isLoading ? <div className="skeleton h-28 rounded-xl"/> : promotionSettings.isError ? <Notice icon="error" title="No pudimos ver el costo" text="Consulta el precio antes de pagar." action={<button className="btn btn-primary" onClick={() => promotionSettings.refetch()}>Reintentar</button>}/> : <><div className="rounded-2xl bg-[#e8efe4] p-5 text-sm text-[#355c74]"><p className="text-xs uppercase tracking-widest font-bold text-[#678f56]">Pago por promoción</p><p data-testid="text-promotion-price" className="font-display text-3xl mt-2">{money(promotionSettings.data?.price ?? 0)}</p>{accepted ? <p className="mt-3">Transfiere a <strong>{promotionSettings.data?.paymentName}</strong> · <strong data-testid="text-promotion-payment-number">{promotionSettings.data?.paymentNumber}</strong></p> : <p className="mt-3 text-xs">Los datos de pago aparecen al aceptar los términos.</p>}</div><div className="mt-5 rounded-2xl border border-[#cbd9cf] p-4"><p className="text-xs uppercase tracking-widest font-bold text-[#678f56] mb-2">Términos y condiciones</p><p data-testid="text-promotion-terms" className="text-xs text-[#47606a] whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto">{promotionSettings.data?.terms}</p><label className="flex gap-2 items-start text-xs text-[#294d64] font-bold mt-4 cursor-pointer"><input data-testid="checkbox-accept-terms" type="checkbox" className="mt-0.5 accent-[#355c74]" checked={!!accepted} disabled={promotionBusy || !promotionSettings.data} onChange={e => { setPromotionError(''); setAccepted(e.target.checked && promotionSettings.data ? { terms: promotionSettings.data.terms, price: promotionSettings.data.price } : null); }}/><span>Leí y acepto estos términos y el pago de {money(promotionSettings.data?.price ?? 0)}.</span></label></div>{accepted ? <>{null}<p className="text-xs leading-relaxed text-[#69807d] my-5">{promotionSettings.data?.remaining === 0 ? 'Se alcanzó el límite diario. Vuelve mañana para solicitar un destacado.' : `${promotionSettings.data?.remaining} de ${promotionSettings.data?.dailyLimit} destacados disponibles hoy. El pago es manual: adjunta una captura; la administración verificará la transferencia antes de destacar tu producto.`}</p><PaymentProofPicker file={promotionProof} onChange={setPromotionProof} onError={setPromotionError} disabled={promotionBusy || promotionRequests.isLoading || promotionRequests.isError || promotionSettings.data?.remaining === 0}/></> : <p className="text-xs text-[#69807d] mt-4">Acepta los términos para ver los datos de pago y adjuntar tu comprobante.</p>}{promotionError && <p role="alert" data-testid="text-promotion-error" className="text-xs text-[#974f42] mt-3">{promotionError}</p>}<button data-testid="button-submit-promotion" onClick={requestPromotion} disabled={!accepted || !promotionProof || promotionBusy || promotionRequests.isLoading || promotionRequests.isError || promotionSettings.data?.remaining === 0} className="btn btn-primary w-full mt-5">{promotionBusy ? 'Subiendo comprobante…' : 'Enviar solicitud para verificar'}</button></>}</div></div>}
  </div>;
}