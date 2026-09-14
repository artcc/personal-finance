import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { components } from '@personal-finance/api-client';
import { api } from '../../lib/api';
import { ApiError, requireData } from '../../lib/api-error';
import { csrfHeaders } from '../../lib/csrf';
import { clearPrivateQueries, queryClient } from '../../app/query-client';
import { sessionKey } from '../auth/session';
import type { Session } from '../auth/session';
import { Button } from '../../components/ui/button';
import { Field, FinanceError } from '../finance/shared';

const maximumBytes = 32 * 1024 * 1024;
type Preview = components['schemas']['ImportPreviewDto'];
function jsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function DataPage() {
  const { t } = useTranslation('data');
  const session = useOutletContext<Session>();
  const [document, setDocument] = useState<Record<string, unknown> | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState<unknown>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const selection = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const sameUser = () =>
    queryClient.getQueryData<Session | null>(sessionKey)?.user.id === session.user.id;
  const download = useMutation({
    gcTime: 0,
    mutationFn: async () => requireData(await api.GET('/api/v1/data/export', { parseAs: 'blob' })),
    onSuccess: (blob) => {
      if (!sameUser()) return;
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = 'personal-finance.json';
      window.document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  const review = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      if (!document) throw new ApiError('INVALID_DATA_FILE');
      return requireData(
        await api.POST('/api/v1/data/import-preview', {
          params: { header: csrfHeaders() },
          body: document,
        }),
      );
    },
    onSuccess: (value) => {
      if (sameUser()) setPreview(value);
    },
  });
  const restore = useMutation({
    gcTime: 0,
    mutationFn: async () => {
      if (!document || !preview || !confirmed) throw new ApiError('INVALID_DATA_FILE');
      return requireData(
        await api.POST('/api/v1/data/import', {
          params: { header: csrfHeaders() },
          body: { document, fingerprint: preview.fingerprint },
        }),
      );
    },
    onSuccess: (result) => {
      if (!sameUser()) return;
      clearPrivateQueries();
      setImported(result.totalRecords);
      setDocument(null);
      setPreview(null);
      setConfirmed(false);
      setFileName('');
      if (input.current) input.current.value = '';
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'IMPORT_PREVIEW_CHANGED') {
        setPreview(null);
        setConfirmed(false);
      }
    },
  });
  const busy = review.isPending || restore.isPending || loadingFile;
  async function chooseFile(file: File | undefined): Promise<void> {
    const generation = ++selection.current;
    setFileError(null);
    setDocument(null);
    setPreview(null);
    setConfirmed(false);
    setImported(null);
    review.reset();
    restore.reset();
    setFileName(file?.name ?? '');
    if (!file) return;
    if (file.size > maximumBytes) {
      setFileError(new ApiError('DATA_FILE_TOO_LARGE'));
      return;
    }
    setLoadingFile(true);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!jsonObject(parsed)) throw new ApiError('INVALID_DATA_FILE');
      if (selection.current === generation) setDocument(parsed);
    } catch (error) {
      if (selection.current === generation)
        setFileError(error instanceof ApiError ? error : new ApiError('INVALID_DATA_FILE'));
    } finally {
      if (selection.current === generation) setLoadingFile(false);
    }
  }
  return (
    <>
      <header className="private-page-heading">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
      </header>
      <div className="data-transfer-grid">
        <section className="planning-panel">
          <h2>{t('exportTitle')}</h2>
          <p className="form-intro">{t('exportHint')}</p>
          <Button disabled={download.isPending} onClick={() => download.mutate()}>
            {t(download.isPending ? 'exporting' : 'exportAction')}
          </Button>
          {download.isError && <FinanceError error={download.error} />}
          <p className="field-hint data-transfer-note">{t('credentialsExcluded')}</p>
        </section>
        <section className="planning-panel">
          <h2>{t('importTitle')}</h2>
          <p className="form-intro">{t('importHint')}</p>
          <Field id="json-file" label={t('file')} hint={t('fileLimit')}>
            <input
              ref={input}
              id="json-file"
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
          </Field>
          {fileName && <p className="field-hint">{fileName}</p>}
          {loadingFile && <p role="status">{t('reading')}</p>}
          {fileError !== null && <FinanceError error={fileError} />}
          {review.isError && <FinanceError error={review.error} />}
          {restore.isError && <FinanceError error={restore.error} />}
          {document && !preview && (
            <Button disabled={busy} onClick={() => review.mutate()}>
              {t(review.isPending ? 'reviewing' : 'reviewAction')}
            </Button>
          )}
          {preview && (
            <section className="import-review">
              <h3>{t('reviewTitle', { count: preview.totalRecords })}</h3>
              <dl>
                {Object.entries(preview.counts)
                  .filter(([, count]) => count > 0)
                  .map(([key, count]) => (
                    <div key={key}>
                      <dt>{t(`collections.${key}`, { defaultValue: t('otherRecords') })}</dt>
                      <dd>{count}</dd>
                    </div>
                  ))}
              </dl>
              {!preview.canImport ? (
                <p className="feedback-banner feedback-banner--error" role="alert">
                  {t('workspaceNotEmpty')}
                </p>
              ) : preview.totalRecords === 0 ? (
                <p className="field-hint">{t('emptyFile')}</p>
              ) : (
                <>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={restore.isPending}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    {t('confirmImport')}
                  </label>
                  <Button disabled={!confirmed || busy} onClick={() => restore.mutate()}>
                    {t(restore.isPending ? 'importing' : 'importAction')}
                  </Button>
                </>
              )}
            </section>
          )}
          {imported !== null && (
            <p className="data-import-success" role="status">
              {t('importSuccess', { count: imported })}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
