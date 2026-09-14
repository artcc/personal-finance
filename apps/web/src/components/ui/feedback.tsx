import { useTranslation } from 'react-i18next';
import { Button } from './button';

export function LoadingState() {
  const { t } = useTranslation('common');
  return (
    <div className="page-feedback" role="status">
      <span className="loading-indicator" aria-hidden="true" />
      <p>{t('loading')}</p>
    </div>
  );
}

export function ConnectionError({ retry }: { retry: () => void }) {
  const { t } = useTranslation('common');
  return (
    <div className="page-feedback">
      <p role="alert">{t('connectionError')}</p>
      <Button onClick={retry}>{t('retry')}</Button>
    </div>
  );
}
