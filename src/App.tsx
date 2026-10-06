import { useEffect, useRef, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/shared/keys';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Shell } from '@/components/market';
import { ErrorBoundary } from '@/components/error-boundary';
import Storefront from '@/pages/storefront';
import ProductDetail from '@/pages/product-detail';
import Sell from '@/pages/sell';
import Orders from '@/pages/orders';
import SellerStore from '@/pages/seller-store';
import Admin from '@/pages/admin';
import { FirebaseSessionProvider } from '@/components/firebase-session';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const clerkProxyOverride = import.meta.env.VITE_CLERK_PROXY_URL?.trim();
const clerkProxyUrl =
  clerkProxyOverride ||
  (import.meta.env.PROD ? `${apiBaseUrl}/api/__clerk` : undefined);
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } } });
function stripBase(path: string): string { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg`, socialButtonsPlacement: 'bottom' as const },
  variables: { colorPrimary:'#355c74', colorForeground:'#294d64', colorMutedForeground:'#658080', colorDanger:'#ad514b', colorBackground:'#faf9f1', colorInput:'#f4f7ee', colorInputForeground:'#294d64', colorNeutral:'#bacbc6', fontFamily:'DM Sans, sans-serif', borderRadius:'14px' },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#faf9f1] rounded-[24px] w-[440px] max-w-full overflow-hidden border border-[#d9e4d9] shadow-[0_20px_55px_#24465320]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#294d64] font-semibold',
    headerSubtitle: 'text-[#658080]',
    socialButtonsBlockButtonText: 'text-[#294d64] font-semibold',
    formFieldLabel: 'text-[#294d64]',
    footerActionLink: 'text-[#355c74] font-bold',
    footerActionText: 'text-[#658080]',
    dividerText: 'text-[#658080]',
    identityPreviewEditButton: 'text-[#355c74]',
    formFieldSuccessText: 'text-[#3f7858]',
    alertText: 'text-[#294d64]',
    logoBox: 'justify-start',
    logoImage: 'h-12 w-auto',
    socialButtonsBlockButton: 'bg-[#f8faf2] border border-[#cbd9cf] hover:bg-[#eaf2e4]',
    formButtonPrimary: 'bg-[#355c74] hover:bg-[#294d64] text-[#faf9f1]',
    formFieldInput: 'bg-[#f8faf2] border border-[#cbd9cf] text-[#294d64]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#dae4da]',
    alert: 'bg-[#eaf2e4]',
    otpCodeFieldInput: 'bg-[#f8faf2] text-[#294d64]',
    formFieldRow: 'text-[#294d64]',
    main: 'text-[#294d64]',
  },
};

function AuthPage({ mode }: { mode: 'in' | 'up' }) {
  return <div className="min-h-[100dvh] bg-[#dfeae0] flex flex-col"><div className="page-wrap py-6"><Link href="/" data-testid="link-auth-back" className="inline-flex items-center gap-2 text-xs font-bold text-[#355c74] hover:underline"><ArrowLeft size={15}/> Volver al mercado</Link></div><div className="flex-1 page-wrap grid lg:grid-cols-[.85fr_1.15fr] gap-8 items-center pb-12"><div className="hidden lg:block pr-10"><img src="/laureles-emblema.png" alt="Emblema Los Laureles" className="h-20 w-20 rounded-2xl object-cover mb-7"/><p className="eyebrow text-[#5f9162] mb-4">Los Laureles · 4ta Etapa</p><h1 className="font-display text-[56px] leading-[1.07] tracking-tight text-[#294d64]">{mode === 'in' ? 'Qué bueno verte de nuevo.' : 'Tu comunidad también es tu mercado.'}</h1><p className="text-[#55767b] mt-5 text-base leading-relaxed max-w-md">{mode === 'in' ? 'Ingresa para pedirle algo rico a un vecino, revisar tus pedidos o abrir tu propio mostrador.' : 'Únete para comprar y vender con la tranquilidad de estar entre vecinos.'}</p><div className="flex items-center gap-2 text-xs font-bold text-[#4e7860] mt-10"><ShieldCheck size={17}/> Un espacio cercano, para nuestra comunidad.</div></div><div><div className="lg:hidden text-center mb-8"><img src="/laureles-emblema.png" alt="Los Laureles" className="h-14 w-14 rounded-xl object-cover mx-auto mb-4"/><h1 className="font-display text-3xl text-[#294d64]">{mode === 'in' ? 'Bienvenido de vuelta' : 'Hazte parte'}</h1><p className="text-sm text-[#648080] mt-2">El mercado está a unos pasos de ti.</p></div>{mode === 'in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={`${basePath}/`}/> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/`}/>}</div></div></div>;
}
function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Shell><div className="page-wrap py-14"><div className="skeleton h-12 w-1/2 rounded-xl mb-7"/><div className="skeleton h-64 rounded-2xl"/></div></Shell>;
  if (!isSignedIn) return <Shell><div className="page-wrap py-20 max-w-[650px]"><div className="panel p-8 sm:p-12 text-center"><img src="/laureles-emblema.png" alt="" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-6"/><h1 className="font-display text-3xl text-[#294d64]">Primero, conozcámonos.</h1><p className="text-sm text-[#68817f] mt-3 mb-6 leading-relaxed">Para cuidar nuestro mercado, necesitas ingresar a tu cuenta antes de continuar.</p><Link href="/sign-in" data-testid="link-protected-sign-in" className="btn btn-primary">Ingresar a mi cuenta</Link></div></div></Shell>;
  return <Shell>{children}</Shell>;
}
function NotFound() { return <Shell><div className="page-wrap py-24 text-center"><p className="eyebrow text-[#82a265]">404 · Fuera del camino</p><h1 className="font-display text-5xl text-[#294d64] mt-3">Esta puerta no existe.</h1><p className="text-sm text-[#6d8582] my-6">Pero siempre puedes volver a donde empieza el barrio.</p><Link href="/" data-testid="link-not-found-home" className="btn btn-primary">Volver al mercado</Link></div></Shell>; }
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => { const unsubscribe = addListener(({ user }) => { const id = user?.id ?? null; if (prev.current !== undefined && prev.current !== id) qc.clear(); prev.current = id; }); return unsubscribe; }, [addListener, qc]);
  return null;
}
function Routes() { return <RoutedErrorBoundary><Switch>
  <Route path="/sign-in/*?">{() => <AuthPage mode="in"/>}</Route>
  <Route path="/sign-up/*?">{() => <AuthPage mode="up"/>}</Route>
  <Route path="/"><Shell><Storefront/></Shell></Route>
  <Route path="/product/:id"><Shell><ProductDetail/></Shell></Route>
  <Route path="/seller/:id"><Shell><SellerStore/></Shell></Route>
  <Route path="/sell"><Protected><Sell/></Protected></Route>
  <Route path="/orders"><Protected><Orders/></Protected></Route>
  <Route path="/admin"><Protected><Admin/></Protected></Route>
  <Route component={NotFound}/>
</Switch></RoutedErrorBoundary>; }
function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{signIn:{start:{title:'Bienvenido de vuelta',subtitle:'Ingresa a tu mercado vecinal'}},signUp:{start:{title:'Qué bueno tenerte aquí',subtitle:'Crea tu cuenta para conectar con tus vecinos'}}}} routerPush={(to: string) => setLocation(stripBase(to))} routerReplace={(to: string) => setLocation(stripBase(to), {replace:true})}>
    <QueryClientProvider client={queryClient}><ClerkCacheInvalidator/><FirebaseSessionProvider><Routes/></FirebaseSessionProvider></QueryClientProvider>
  </ClerkProvider>;
}
function App() { return <WouterRouter base={basePath}><ClerkProviderWithRoutes/></WouterRouter>; }
export default App;