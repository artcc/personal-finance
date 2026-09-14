import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function ErrorPage() {
  const { t } = useTranslation(['common', 'errors']);
  return (
    <main className="error-page">
      <h1>{t('errors:unexpected')}</h1>
      <p>{t('errors:unexpectedHint')}</p>
      <Button asChild>
        <Link to="/">{t('backHome')}</Link>
      </Button>
    </main>
  );
}
