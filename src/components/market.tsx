import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth, useClerk } from '@clerk/react';
import { getGetMeQueryKey, useGetMe, type Product } from '@api-client';
import { ArrowRight, BadgeCheck, HeartHandshake, Home, LayoutDashboard, Menu, Package, Search, ShoppingBag, Star, Store, X } from 'lucide-react';
import { Notifications } from '@/components/notifications';

export const money = (value: number) => `S/ ${Number(value).toFixed(2)}`;
export const date = (value: string) => new Date(value).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
export const categories = ['Todos', 'Comida casera', 'Postres', 'Bebidas', 'Servicios', 'Ropa', 'Hogar', 'Otros'];

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isSignedIn, isLoaded } = useAuth();
  const { signOut } = useClerk();
  const { data: me } = useGetMe({ query: { enabled: !!isSignedIn, queryKey: getGetMeQueryKey() } });
  const [menu, setMenu] = useState(false);
  const nav = [
    { href: '/', label: 'Explorar', icon: Home },
    { href: '/sell', label: 'Vender', icon: Store },
    { href: '/orders', label: 'Mis pedidos', icon: ShoppingBag },
    ...(me?.isAdmin ? [{ href: '/admin', label: 'Administrar', icon: LayoutDashboard }] : []),
  ];
  return <div className="min-h-[100dvh] flex flex-col">
    <div className="bg-[#294d64] text-[#e7efde] text-center py-2 px-4 text-[11px] font-semibold tracking-wide">Un mercado entre vecinos de Los Laureles · 4ta Etapa</div>
    <header className="sticky top-0 z-40 bg-[#faf9f1]/95 backdrop-blur-md border-b border-[#d8e1db]">
      <div className="page-wrap h-[72px] flex items-center justify-between gap-4">
        <Link href="/" data-testid="link-logo" className="flex items-center gap-2 min-w-0">
          <img src="/laureles-emblema.png" alt="Emblema de Los Laureles" className="h-11 w-11 object-cover rounded-xl shadow-sm" />
          <span className="leading-none"><strong className="font-display text-[20px] sm:text-[23px] text-[#2c5065] block tracking-tight">Los Laureles</strong><small className="text-[9px] font-bold uppercase tracking-[.2em] text-[#648459]">Mercado vecinal</small></span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 bg-[#edf1e9] p-1 rounded-full">
          {nav.map(item => <Link key={item.href} href={item.href} data-testid={`link-nav-${item.label}`} className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${location === item.href ? 'bg-[#355c74] text-[#faf9f1]' : 'text-[#526e75] hover:bg-[#dbe7d4]'}`}>{item.label}</Link>)}
        </nav>
         <div className="hidden md:flex items-center gap-2">
           {isSignedIn && <Notifications/>}
          {!isLoaded ? <div className="skeleton h-10 w-28 rounded-full" /> : isSignedIn ? <><span className="text-xs text-[#66817b] hidden lg:block">Hola, {me?.name?.split(' ')[0] || 'vecino'}</span><button data-testid="button-sign-out" className="btn btn-plain" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}>Salir</button></> : <><Link href="/sign-in" data-testid="link-sign-in" className="btn btn-plain">Ingresar</Link><Link href="/sign-up" data-testid="link-sign-up" className="btn btn-primary">Unirme <ArrowRight size={14}/></Link></>}
        </div>
         <div className="md:hidden flex items-center gap-1">{isSignedIn && <Notifications/>}<button data-testid="button-menu" aria-label={menu ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setMenu(!menu)} className="p-2 rounded-xl text-[#355c74] hover:bg-[#e6eee0]">{menu ? <X size={23}/> : <Menu size={23}/>}</button></div>
      </div>
      {menu && <div className="md:hidden border-t border-[#d8e1db] bg-[#faf9f1] px-4 py-3 grid gap-1">{nav.map(item => <Link key={item.href} href={item.href} onClick={() => setMenu(false)} data-testid={`link-mobile-${item.label}`} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-[#355c74] hover:bg-[#e9efdf]"><item.icon size={18}/>{item.label}</Link>)}<div className="border-t border-[#d8e1db] pt-3 mt-2">{isSignedIn ? <button data-testid="button-mobile-sign-out" onClick={() => { setMenu(false); signOut({ redirectUrl: import.meta.env.BASE_URL }); }} className="btn btn-plain w-full">Cerrar sesión</button> : <Link href="/sign-in" onClick={() => setMenu(false)} data-testid="link-mobile-sign-in" className="btn btn-primary w-full">Ingresar a mi cuenta</Link>}</div></div>}
    </header>
    <main className="flex-1">{children}</main>
    <footer className="bg-[#294d64] text-[#e5eee9] mt-20">
      <div className="page-wrap py-12 grid md:grid-cols-[1.5fr_1fr_1fr] gap-10">
        <div><img src="/logo.svg" alt="Los Laureles" className="h-11 mb-4"/><p className="text-sm text-[#b9d0d3] max-w-xs leading-relaxed">Lo mejor de vivir cerca es descubrir todo lo que nuestros vecinos tienen para compartir.</p></div>
        <div><h3 className="font-display text-xl mb-4">A un paso de ti.</h3><p className="text-xs leading-6 text-[#b9d0d3]">Compra directamente a tus vecinos.<br/>Coordina la entrega y paga por Yape.<br/>Sin intermediarios ni vueltas.</p></div>
         <div><h3 className="font-display text-xl mb-4">Nos encontramos aquí</h3><Link href="/" data-testid="link-footer-explore" className="text-xs block mb-2 hover:underline">Explorar el mercado</Link><Link href="/sell" data-testid="link-footer-sell" className="text-xs block mb-2 hover:underline">Publicar lo que vendes</Link><Link href="/admin" className="text-xs block mb-2 hover:underline">Acceso de administración</Link><p className="text-[11px] text-[#a7c3c5] mt-6">Los Laureles · 4ta Etapa</p></div>
      </div>
    </footer>
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#faf9f1]/95 backdrop-blur-md border-t border-[#d8e1db] px-2 pb-[env(safe-area-inset-bottom)] flex justify-around">{nav.map(item => <Link key={item.href} href={item.href} data-testid={`link-bottom-${item.label}`} className={`flex flex-col items-center gap-1 py-2 px-2 min-w-[68px] text-[10px] font-bold ${location === item.href ? 'text-[#355c74]' : 'text-[#839597]'}`}><item.icon size={19} strokeWidth={location === item.href ? 2.5 : 1.8}/>{item.label}</Link>)}</nav>
  </div>;
}

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  return <div className={`panel card-lift overflow-hidden group flex flex-col ${compact ? '' : 'h-full'}`}><Link href={`/product/${product.id}`} data-testid={`card-product-${product.id}`} className="block">
    <div className={`relative overflow-hidden bg-[#dce7dd] ${compact ? 'aspect-[1.25]' : 'aspect-[1.15]'}`}>
      {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy"/> : <div className="w-full h-full flex items-center justify-center bg-[radial-gradient(circle_at_70%_25%,#d5e8bc,#a8c4bd_70%)]"><Package size={44} className="text-[#527576] opacity-70"/></div>}
      <span className="absolute top-3 left-3 chip bg-[#faf9f1] text-[#3d5a59] shadow-sm">{product.category}</span>
      {product.sellingToday && product.available && <span className="absolute bottom-3 left-3 chip chip-leaf shadow-sm"><span className="h-1.5 w-1.5 rounded-full bg-[#609c52]"/>Vende hoy</span>}
      {!product.available && <span className="absolute inset-0 bg-[#244153]/50 flex items-center justify-center text-white font-bold">No disponible</span>}
    </div>
     <div className="p-4 sm:p-5"><div className="flex justify-between gap-2 items-start"><h3 className="font-display text-[18px] sm:text-[21px] leading-tight text-[#244657] group-hover:text-[#4b7554] transition-colors">{product.name}</h3><strong data-testid={`text-price-${product.id}`} className="text-sm sm:text-base whitespace-nowrap text-[#355c74]">{money(product.price)}</strong></div></div></Link><div className="px-4 sm:px-5 -mt-1"><Link href={`/seller/${product.sellerId}`} data-testid={`link-seller-${product.id}`} className="text-xs text-[#4b7554] font-bold hover:underline inline-flex items-center gap-2 line-clamp-1">{product.sellerLogoUrl ? <img src={product.sellerLogoUrl} alt="" className="h-5 w-5 rounded-full object-cover"/> : <Store size={13}/>}{product.sellerStoreName || product.sellerName}</Link></div><div className="px-4 sm:px-5 pb-4 sm:pb-5 mt-auto"><div className="mt-4 pt-3 border-t border-[#e5e9e3] flex items-center justify-between text-[11px] text-[#678080]"><span className="inline-flex items-center gap-1"><BadgeCheck size={13} className="text-[#77a45b]"/> Mercado Los Laureles</span><span className="inline-flex items-center gap-1"><Star size={12} className="fill-[#a7cd70] text-[#719854]"/>{product.reviewCount ? `${product.rating.toFixed(1)} (${product.reviewCount})` : 'Nuevo'}</span></div></div></div>;
}

export function SkeletonGrid({ count = 4 }: { count?: number }) { return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">{Array.from({ length: count }, (_, i) => <div key={i} className="panel overflow-hidden"><div className="aspect-[1.15] skeleton"/><div className="p-4 space-y-3"><div className="skeleton h-5 w-4/5 rounded"/><div className="skeleton h-4 w-1/2 rounded"/><div className="skeleton h-4 w-full rounded"/></div></div>)}</div>; }
export function Notice({ title, text, action, icon = 'empty' }: { title: string; text: string; action?: ReactNode; icon?: 'empty' | 'error' }) { return <div className="panel px-6 py-16 text-center flex flex-col items-center"><div className="w-16 h-16 bg-[#e5efd9] rounded-2xl flex items-center justify-center mb-5 text-[#4e785b]">{icon === 'error' ? <Search size={29}/> : <HeartHandshake size={29}/>}</div><h3 className="font-display text-2xl text-[#294c60] mb-2">{title}</h3><p className="text-sm text-[#6b8282] max-w-sm leading-relaxed mb-5">{text}</p>{action}</div>; }
export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) { return <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8"><div><p className="eyebrow text-[#789b5b] mb-3">{eyebrow}</p><h1 className="font-display text-4xl sm:text-5xl tracking-tight text-[#294d64]">{title}</h1>{description && <p className="text-sm text-[#708583] mt-3 max-w-xl">{description}</p>}</div>{action}</div>; }