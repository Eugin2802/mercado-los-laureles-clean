import { useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { useSubmitOrderFeedback, type Order } from '@api-client';
import { apiErrorMessage } from '@/lib/payment-proof';

type RatingKind = 'product' | 'seller';

export function OrderFeedback({ order, onSubmitted }: { order: Order; onSubmitted: (order: Order) => void }) {
  const feedback = useSubmitOrderFeedback();
  const submittingKinds = useRef(new Set<RatingKind>());
  const [ratings, setRatings] = useState<Record<RatingKind, number>>({ product: 0, seller: 0 });
  const [comment, setComment] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const needsProduct = !order.productReviewed;
  const needsSeller = !order.sellerReviewed;

  if (!needsProduct && !needsSeller) {
    return <div className="mx-5 sm:mx-6 mb-5 rounded-xl bg-[#eaf2e4] px-4 py-3 text-xs text-[#527559]">
      Gracias por compartir tu opinión sobre este pedido.
    </div>;
  }
  if (dismissed) return null;

  const submit = async (kind: RatingKind) => {
    if (feedback.isPending || submittingKinds.current.has(kind) || (kind === 'product' ? order.productReviewed : order.sellerReviewed)) return;
    const rating = ratings[kind];
    if (!rating) {
      setError('Elige una calificación antes de enviarla.');
      return;
    }
    setError('');
    setSuccess('');
    submittingKinds.current.add(kind);
    try {
      const updated = await feedback.mutateAsync({
        id: order.id,
        data: {
          ...(kind === 'product' ? { productRating: rating } : { sellerRating: rating }),
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        },
      });
      onSubmitted(updated);
      setRatings(current => ({ ...current, [kind]: 0 }));
      setSuccess(kind === 'product' ? 'Tu calificación del producto quedó guardada.' : 'Tu calificación del vecino quedó guardada.');
    } catch (cause) {
      setError(apiErrorMessage(cause, 'No pudimos guardar tu calificación. Intenta de nuevo.'));
    } finally {
      submittingKinds.current.delete(kind);
    }
  };

  const stars = (kind: RatingKind) => <div className="flex gap-1.5 mt-2" role="group" aria-label={kind === 'product' ? 'Calificación del producto' : 'Calificación del vendedor'}>
    {[1, 2, 3, 4, 5].map(value => <button
      key={value}
      type="button"
      data-testid={`button-order-${kind}-rating-${order.id}-${value}`}
      aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
      aria-pressed={ratings[kind] === value}
      disabled={feedback.isPending}
      onClick={() => setRatings(current => ({ ...current, [kind]: value }))}
      className="p-1"
    ><Star size={22} className={value <= ratings[kind] ? 'fill-[#9dbf67] text-[#799f57]' : 'text-[#bfcbbf]'}/></button>)}
  </div>;

  return <section className="mx-5 sm:mx-6 mb-5 rounded-2xl bg-[#f2f5ed] border border-[#e0e8dc] p-4 sm:p-5" aria-label={`Opinión del pedido ${order.id}`}>
    <div className="flex items-start justify-between gap-3">
      <div><p className="eyebrow text-[#789a62]">Pedido entregado</p><h3 className="font-display text-xl text-[#294d64] mt-1">¿Cómo fue la experiencia?</h3><p className="text-xs text-[#718780] mt-1">Tu opinión es opcional y ayuda a otros vecinos.</p></div>
      <button type="button" data-testid={`button-dismiss-order-feedback-${order.id}`} onClick={() => setDismissed(true)} className="text-xs font-bold text-[#718780] hover:underline whitespace-nowrap">Ahora no</button>
    </div>
    <div className="grid sm:grid-cols-2 gap-4 mt-4">
      <div className="rounded-xl bg-white/70 p-3">
        <p className="text-xs font-bold text-[#355c74]">Producto</p>
        {needsProduct ? <>{stars('product')}<button type="button" data-testid={`button-submit-product-rating-${order.id}`} disabled={feedback.isPending || ratings.product === 0} onClick={() => submit('product')} className="btn btn-leaf mt-3 w-full">{feedback.isPending ? 'Guardando…' : 'Calificar producto'}</button></> : <p className="text-xs text-[#527559] mt-2">Ya calificaste este producto.</p>}
      </div>
      <div className="rounded-xl bg-white/70 p-3">
        <p className="text-xs font-bold text-[#355c74]">Vecino vendedor</p>
        {needsSeller ? <>{stars('seller')}<button type="button" data-testid={`button-submit-seller-rating-${order.id}`} disabled={feedback.isPending || ratings.seller === 0} onClick={() => submit('seller')} className="btn btn-leaf mt-3 w-full">{feedback.isPending ? 'Guardando…' : 'Calificar vecino'}</button></> : <p className="text-xs text-[#527559] mt-2">Ya calificaste a este vecino.</p>}
      </div>
    </div>
    {(needsProduct || needsSeller) && <div className="mt-4"><label className="label" htmlFor={`feedback-comment-${order.id}`}>Comentario opcional</label><textarea id={`feedback-comment-${order.id}`} data-testid={`input-order-feedback-comment-${order.id}`} value={comment} onChange={event => setComment(event.target.value)} maxLength={500} className="field min-h-20 resize-y" placeholder="Comparte un detalle que pueda ayudar a otros vecinos."/></div>}
    {success && <p role="status" className="text-xs text-[#527559] mt-3">{success}</p>}
    {error && <p role="alert" className="text-xs text-red-700 mt-3">{error}</p>}
  </section>;
}