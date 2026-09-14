import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { notifySessionChanged, queryClient } from '../../app/query-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ConnectionError, LoadingState } from '../../components/ui/feedback';
import { ApiError } from '../../lib/api-error';
import { login, register as registerAccount } from './auth-api';
import { sessionKey, useSession } from './session';

export function AccessPage({ mode }: { mode: 'login' | 'register' }) {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const session = useSession();
  const schema = useMemo(
    () =>
      z
        .object({
          email: z.email({ error: 'invalidEmail' }).max(254, 'invalidEmail'),
          password: z.string().min(12, 'passwordLength').max(128, 'passwordLength'),
          displayName: z.string().trim().max(80, 'nameLength').optional(),
          confirmation: z.string().optional(),
        })
        .superRefine((value, context) => {
          if (mode !== 'register') return;
          if (!value.displayName)
            context.addIssue({ code: 'custom', path: ['displayName'], message: 'nameRequired' });
          if (value.password !== value.confirmation)
            context.addIssue({
              code: 'custom',
              path: ['confirmation'],
              message: 'passwordMismatch',
            });
        }),
    [mode],
  );
  type FormInput = z.input<typeof schema>;
  type FormValues = z.output<typeof schema>;
  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', displayName: '', confirmation: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      mode === 'register'
        ? registerAccount({
            email: values.email,
            password: values.password,
            displayName: values.displayName ?? '',
          })
        : login({ email: values.email, password: values.password }),
    onSuccess: async (data) => {
      await queryClient.cancelQueries();
      queryClient.clear();
      queryClient.setQueryData(sessionKey, data);
      notifySessionChanged();
      form.reset();
      navigate('/', { replace: true });
    },
  });
  if (session.isPending) return <LoadingState />;
  if (session.isError) return <ConnectionError retry={() => void session.refetch()} />;
  if (session.data) return <Navigate to="/" replace />;

  const fieldError = (field: keyof FormInput) => {
    const message = form.formState.errors[field]?.message;
    return message ? (
      <p id={`${field}-error`} className="field-error">
        {t(`validation.${message}`)}
      </p>
    ) : null;
  };
  const knownErrors: Record<string, string> = {
    INVALID_CREDENTIALS: 'invalidCredentials',
    REGISTRATION_FAILED: 'registrationFailed',
    AUTH_RATE_LIMITED: 'rateLimited',
    AUTH_BUSY: 'busy',
    INVALID_AUTH_INPUT: 'invalidInput',
    ORIGIN_REJECTED: 'originRejected',
  };
  const failureKey =
    mutation.error instanceof ApiError
      ? (knownErrors[mutation.error.code] ?? 'unexpected')
      : 'unexpected';

  return (
    <main className="access-layout">
      <section className="access-story" aria-labelledby="access-intro">
        <Link className="brand" to="/login">
          <span className="brand-mark" aria-hidden="true">
            ∑
          </span>
          {t('common:appName')}
        </Link>
        <div className="access-story-content">
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1 id="access-intro">{t('introTitle')}</h1>
          <p>{t('introDescription')}</p>
          <div className="access-illustration" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <span>↗</span>
          </div>
        </div>
        <p className="access-privacy">{t('privacy')}</p>
      </section>
      <section className="access-form-area" aria-labelledby="form-heading">
        <div className="access-form-card">
          <p className="section-kicker">
            {t(mode === 'register' ? 'registerEyebrow' : 'loginEyebrow')}
          </p>
          <h2 id="form-heading">{t(mode === 'register' ? 'registerTitle' : 'loginTitle')}</h2>
          <p className="access-form-description">
            {t(mode === 'register' ? 'registerDescription' : 'loginDescription')}
          </p>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            noValidate
            aria-busy={mutation.isPending}
          >
            <fieldset disabled={mutation.isPending}>
              {mode === 'register' && (
                <div className="form-field">
                  <label htmlFor="displayName">{t('name')}</label>
                  <Input
                    id="displayName"
                    required
                    autoComplete="name"
                    maxLength={80}
                    aria-invalid={Boolean(form.formState.errors.displayName)}
                    aria-describedby={
                      form.formState.errors.displayName ? 'displayName-error' : undefined
                    }
                    {...form.register('displayName')}
                  />
                  {fieldError('displayName')}
                </div>
              )}
              <div className="form-field">
                <label htmlFor="email">{t('email')}</label>
                <Input
                  id="email"
                  required
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  aria-invalid={Boolean(form.formState.errors.email)}
                  aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
                  {...form.register('email')}
                />
                {fieldError('email')}
              </div>
              <div className="form-field">
                <label htmlFor="password">{t('password')}</label>
                <Input
                  id="password"
                  required
                  type="password"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  maxLength={128}
                  aria-invalid={Boolean(form.formState.errors.password)}
                  aria-describedby={
                    form.formState.errors.password
                      ? 'password-error'
                      : mode === 'register'
                        ? 'password-hint'
                        : undefined
                  }
                  {...form.register('password')}
                />
                {mode === 'register' && (
                  <p id="password-hint" className="field-hint">
                    {t('passwordHint')}
                  </p>
                )}
                {fieldError('password')}
              </div>
              {mode === 'register' && (
                <div className="form-field">
                  <label htmlFor="confirmation">{t('confirmation')}</label>
                  <Input
                    id="confirmation"
                    required
                    type="password"
                    autoComplete="new-password"
                    maxLength={128}
                    aria-invalid={Boolean(form.formState.errors.confirmation)}
                    aria-describedby={
                      form.formState.errors.confirmation ? 'confirmation-error' : undefined
                    }
                    {...form.register('confirmation')}
                  />
                  {fieldError('confirmation')}
                </div>
              )}
              {mutation.isError && (
                <p className="feedback-banner feedback-banner--error" role="alert">
                  {t(`errors.${failureKey}`)}
                </p>
              )}
              <Button type="submit" className="access-submit" disabled={mutation.isPending}>
                {t(
                  mutation.isPending
                    ? 'submitting'
                    : mode === 'register'
                      ? 'registerAction'
                      : 'loginAction',
                )}
              </Button>
            </fieldset>
          </form>
          <p className="access-switch">
            {t(mode === 'register' ? 'alreadyRegistered' : 'notRegistered')}{' '}
            <Link to={mode === 'register' ? '/login' : '/register'}>
              {t(mode === 'register' ? 'loginAction' : 'registerAction')}
            </Link>
          </p>
          {mode === 'login' && (
            <details className="recovery-help">
              <summary>{t('forgotPassword')}</summary>
              <p>{t('recoveryHelp')}</p>
            </details>
          )}
        </div>
      </section>
    </main>
  );
}
