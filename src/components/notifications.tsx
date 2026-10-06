import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Bell, Check, ExternalLink } from 'lucide-react';
import { getGetMeQueryKey, getGetPromotionSettingsQueryKey, getListMyProductsQueryKey, getListNotificationsQueryKey, getListOrdersQueryKey, getListProductsQueryKey, getListPromotionRequestsQueryKey, getListPromotionsQueryKey, useListNotifications, useReadNotification } from '@api-client';

export function Notifications() {
  const qc = useQueryClient();
  const notifications = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), refetchInterval: 12_000, refetchOnWindowFocus: true } });
  const read = useReadNotification();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState('');
  const seenRelevantNotificationIds = useRef<Set<number> | null>(null);
  const unread = notifications.data?.filter(item => !item.read).length ?? 0;
  useEffect(() => {
    const items = notifications.data;
    if (!items) return;
    const relevantItems = items.filter(item => item.kind === 'order_status' || item.kind === 'promotion_status' || item.kind === 'promotion');
    const previous = seenRelevantNotificationIds.current;
    if (previous) {
      const added = relevantItems.filter(item => !previous.has(item.id));
      if (added.some(item => item.kind === 'order_status')) {
        void qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      }
      if (added.some(item => item.kind === 'promotion' || item.kind === 'promotion_status')) {
        void qc.invalidateQueries({ queryKey: getListPromotionRequestsQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetPromotionSettingsQueryKey() });
      }
      if (added.some(item => item.kind === 'promotion_status')) {
        void qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        void qc.invalidateQueries({ queryKey: getListMyProductsQueryKey() });
        void qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
        void qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() });
      }
    }
    seenRelevantNotificationIds.current = new Set(relevantItems.map(item => item.id));
  }, [notifications.data, qc]);
  const internalLink = (item: NonNullable<typeof notifications.data>[number]) => {
    if (item.kind === 'promotion') return `/admin?tab=promotions&request=${item.referenceId}`;
    if (item.kind === 'order') return `/orders?tab=sales&order=${item.referenceId}`;
    if (item.kind === 'order_status') return `/orders?order=${item.referenceId}`;
    return item.link;
  };
  const expand = async (id: number, isRead: boolean) => {
    setExpanded(current => current === id ? null : id);
    if (isRead) return;
    try {
      await read.mutateAsync({ id });
      await qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
    } catch { setError('No se pudo marcar como leída. Intenta de nuevo.'); }
  };
  return <div className="relative">
    <button data-testid="button-notifications" aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`} aria-expanded={open} onClick={() => setOpen(value => !value)} className="relative p-2.5 rounded-full text-[#355c74] hover:bg-[#e6eee0]"><Bell size={19}/>{unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full px-1 bg-[#73975e] text-[#faf9f1] text-[9px] flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}</button>
    {open && <div className="fixed left-3 right-3 top-[108px] max-h-[calc(100dvh-165px)] overflow-y-auto md:absolute md:left-auto md:right-0 md:top-full md:mt-3 md:w-[370px] md:max-h-[min(72dvh,540px)] bg-[#faf9f1] border border-[#d4dfd6] shadow-[0_18px_48px_#294d6426] rounded-2xl z-50">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#e1e8df]"><h2 className="font-display text-xl text-[#294d64]">Novedades</h2><span className="text-[11px] text-[#70877a]">{unread} sin leer</span></div>
      {error && <p role="alert" className="text-xs text-[#974f42] px-5 py-3">{error}</p>}
      {notifications.isLoading ? <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl"/>)}</div> : notifications.isError ? <div className="p-5 text-xs text-[#69807d]">No pudimos cargar las novedades. <button onClick={() => notifications.refetch()} className="font-bold underline">Reintentar</button></div> : !notifications.data?.length ? <p className="p-6 text-sm text-[#69807d]">Todo al día. Las novedades de tus pedidos aparecerán aquí.</p> : <div className="divide-y divide-[#e5ebe3]">{notifications.data.map(item => <div key={item.id} className={`px-5 py-4 ${item.read ? '' : 'bg-[#eef3e9]'}`}>
        <button data-testid={`button-notification-${item.id}`} onClick={() => expand(item.id, item.read)} aria-expanded={expanded === item.id} className="w-full text-left"><span className="flex items-start justify-between gap-3"><strong className="text-sm text-[#294d64]">{item.title}</strong>{!item.read && <span className="w-2 h-2 rounded-full bg-[#719a64] shrink-0 mt-1"/>}</span><span className="text-[11px] text-[#82948b]">{new Date(item.createdAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}</span></button>
         {expanded === item.id && <div className="pt-3"><p className="text-xs text-[#5e7876] leading-relaxed">{item.detail}</p>{item.image && <a href={item.image} target="_blank" rel="noopener noreferrer" className="block mt-3" aria-label="Abrir comprobante"><img data-testid={`img-notification-${item.id}`} src={item.image} alt={`Imagen de ${item.title}`} className="w-full min-h-28 max-h-52 rounded-xl object-contain bg-[#e8efe4]"/></a>}{internalLink(item).startsWith('/') && !internalLink(item).startsWith('//') && <Link data-testid={`link-notification-${item.id}`} href={internalLink(item)} onClick={() => setOpen(false)} className="inline-flex items-center gap-1 text-xs font-bold text-[#355c74] mt-3 hover:underline">{item.kind === 'promotion' ? 'Revisar y confirmar pago para destaque' : 'Ver detalle'} <ExternalLink size={12}/></Link>}{item.read && <span className="flex items-center gap-1 text-[10px] text-[#779a69] mt-2"><Check size={11}/> Leída</span>}</div>}
      </div>)}</div>}
    </div>}
  </div>;
}