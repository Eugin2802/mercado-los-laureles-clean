import { useState } from 'react';
import { Download, ExternalLink, Sheet } from 'lucide-react';
import { downloadOrderReport, getConnectSellerGoogleUrl, getGetSellerGoogleStatusQueryKey, useDisconnectSellerGoogle, useExportAdminGoogle, useExportSellerGoogle, useGetSellerGoogleStatus } from '@api-client';
import { useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '@/lib/payment-proof';

type Format = 'csv' | 'xlsx' | 'pdf' | 'docx';
const formats: Format[] = ['csv', 'xlsx', 'pdf', 'docx'];

export function Reports({ admin = false }: { admin?: boolean }) {
  const qc = useQueryClient();
  const status = useGetSellerGoogleStatus({ query: { queryKey: getGetSellerGoogleStatusQueryKey() } });
  const exportSeller = useExportSellerGoogle();
  const disconnect = useDisconnectSellerGoogle();
  const exportAdmin = useExportAdminGoogle();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const download = async (format: Format) => {
    setError(''); setBusy(format);
    try {
      const blob = await downloadOrderReport({ format }, { credentials: 'include', responseType: 'blob' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `ventas-los-laureles.${format}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (cause) { setError(apiErrorMessage(cause, 'No pudimos descargar el reporte. Intenta nuevamente.')); }
    finally { setBusy(''); }
  };
  const googleExport = async () => {
    setError(''); setBusy('google');
    try {
      const result = admin ? await exportAdmin.mutateAsync() : await exportSeller.mutateAsync();
      setUrl(result.url);
    } catch (cause) { setError(apiErrorMessage(cause, 'No pudimos crear la hoja. Intenta nuevamente.')); }
    finally { setBusy(''); }
  };
  const googleDisconnect = async () => {
    setError(''); setBusy('disconnect');
    try {
      await disconnect.mutateAsync();
      setUrl('');
      await qc.invalidateQueries({ queryKey: getGetSellerGoogleStatusQueryKey() });
    } catch (cause) { setError(apiErrorMessage(cause, 'No pudimos desconectar Google. Intenta nuevamente.')); }
    finally { setBusy(''); }
  };
  return <section className="panel p-5 sm:p-7 max-w-[850px] mb-8" aria-label="Reportes de ventas">
    <p className="eyebrow text-[#789a62] mb-2">Tus números, a mano</p>
    <h2 className="font-display text-2xl text-[#294d64]">{admin ? 'Reporte general' : 'Historial de ventas'}</h2>
    <p className="text-xs text-[#69807d] mt-2 mb-5">{admin ? 'Descarga el historial general de pedidos para revisarlo fuera del mercado.' : 'Lleva un registro de tus pedidos y compártelo en el formato que necesites.'}</p>
    <div className="flex flex-wrap gap-2">{formats.map(format => <button key={format} data-testid={`button-download-${admin ? 'admin-' : ''}${format}`} disabled={!!busy} onClick={() => download(format)} className="btn btn-plain !text-xs"><Download size={14}/> {busy === format ? 'Preparando…' : format.toUpperCase()}</button>)}</div>
    <div className="mt-6 pt-5 border-t border-[#dce6dc]">
      <h3 className="text-sm font-bold text-[#355c74] flex items-center gap-2"><Sheet size={17}/> Google Sheets</h3>
      {status.isLoading ? <div className="skeleton h-10 w-52 rounded-xl mt-3"/> : status.isError
        ? <div className="mt-3"><p className="text-xs text-[#974f42] mb-2">No pudimos comprobar la conexión.</p><button className="btn btn-plain !text-xs" onClick={() => status.refetch()}>Reintentar</button></div>
        : <p className="text-xs text-[#69807d] mt-2 mb-3">{!status.data?.available
          ? 'Google Sheets no está disponible: faltan las credenciales de Google OAuth.'
          : status.data.connected
            ? 'Tu cuenta de Google está conectada.'
            : admin ? 'Conecta la cuenta de Google que recibirá el reporte general.'
              : 'Conecta tu cuenta para exportar tus ventas a una hoja.'}</p>}
      {status.data?.available && <div className="flex flex-wrap gap-2">{status.data.connected ? <>
        <button data-testid={`button-${admin ? 'admin' : 'seller'}-google-export`} disabled={!!busy} onClick={googleExport} className="btn btn-leaf !text-xs">{busy === 'google' ? 'Creando hoja…' : admin ? 'Exportar reporte general' : 'Exportar a Google Sheets'}</button>
        <button data-testid={`button-${admin ? 'admin' : 'seller'}-google-disconnect`} disabled={!!busy} onClick={googleDisconnect} className="btn btn-plain !text-xs">{busy === 'disconnect' ? 'Desconectando…' : 'Desconectar Google'}</button>
      </> : <a data-testid={`button-${admin ? 'admin' : 'seller'}-google-connect`} href={getConnectSellerGoogleUrl()} target="_blank" rel="noopener noreferrer" className="btn btn-leaf !text-xs">Conectar Google</a>}</div>}
      {url && <a data-testid="link-google-report" className="inline-flex items-center gap-1 text-xs font-bold text-[#355c74] hover:underline mt-4" href={url} target="_blank" rel="noopener noreferrer">Abrir hoja creada <ExternalLink size={13}/></a>}
    </div>
    {error && <p role="alert" className="text-xs text-[#974f42] bg-[#f8e5df] rounded-xl p-3 mt-4">{error}</p>}
  </section>;
}