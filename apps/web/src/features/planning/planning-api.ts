import { useQuery } from '@tanstack/react-query';
import type { components } from '@personal-finance/api-client';
import { api } from '../../lib/api';
import { errorCode, requireData } from '../../lib/api-error';
import { queryClient } from '../../app/query-client';
import { sessionKey } from '../auth/session';
import type { Session } from '../auth/session';

export type MonthlyPlan = components['schemas']['MonthlyPlanDto'];
export type PlanSummary = components['schemas']['PlanSummaryDto'];
export type PlanIncome = components['schemas']['PlanIncomeDto'];
export type PlanCharge = components['schemas']['PlanChargeDto'];
export type PlanAllocationInput = components['schemas']['PlanAllocationInputDto'];
export type PlanTrend = components['schemas']['PlanTrendDto'];
export const monthPattern = /^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/;
export const planKey = (userId: string, month: string) => ['planning', userId, month] as const;

export function useMonthlyPlan(userId: string, month: string) {
  return useQuery({
    queryKey: planKey(userId, month),
    enabled: monthPattern.test(month),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }): Promise<MonthlyPlan | null> => {
      const response = await api.GET('/api/v1/monthly-plans', {
        signal,
        params: { query: { month } },
      });
      if (response.response.status === 404 && errorCode(response.error) === 'PLAN_NOT_FOUND')
        return null;
      return requireData(response);
    },
  });
}

export async function acceptPlan(userId: string, plan: MonthlyPlan): Promise<void> {
  if (queryClient.getQueryData<Session | null>(sessionKey)?.user.id !== userId) return;
  queryClient.setQueryData(planKey(userId, plan.month), plan);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['plan-trend', userId] }),
    queryClient.invalidateQueries({ queryKey: ['plan-history', userId, plan.id] }),
  ]);
}

export function monthLabel(month: string, locale = 'es-ES'): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}
