const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function addMonths(date, months) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const next = new Date(date);
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
}

function differenceInCalendarMonths(from, to) {
  if (!(from instanceof Date) || !(to instanceof Date)) return 0;
  let diff = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) diff -= 1;
  return diff;
}

function getRemainingDuration(from, to) {
  if (!(from instanceof Date) || !(to instanceof Date)) {
    return {
      monthsRemaining: null,
      daysRemaining: null,
      remainingUnit: null,
      remainingValue: null,
    };
  }

  const diffMs = to.getTime() - from.getTime();
  if (diffMs <= 0) {
    return {
      monthsRemaining: 0,
      daysRemaining: 0,
      remainingUnit: 'days',
      remainingValue: 0,
    };
  }

  const daysRemaining = Math.max(1, Math.ceil(diffMs / DAY_MS));
  const monthsRemaining = Math.max(0, differenceInCalendarMonths(from, to));

  if (monthsRemaining > 0) {
    return {
      monthsRemaining,
      daysRemaining,
      remainingUnit: 'months',
      remainingValue: monthsRemaining,
    };
  }

  return {
    monthsRemaining: 0,
    daysRemaining,
    remainingUnit: 'days',
    remainingValue: daysRemaining,
  };
}

function formatDateDisplay(value) {
  const date = parseDateOnly(value);
  if (!date) return '-';
  return date.toLocaleDateString('fr-FR');
}

function buildSubscriptionAccessStatus(subscription, now = new Date()) {
  if (!subscription) return null;

  const status = String(subscription.status || 'pending').trim().toLowerCase() || 'pending';
  const billingCycle = String(subscription.billing_cycle || '').trim().toLowerCase() || 'monthly';
  const createdAt = parseDateOnly(subscription.created_at) || parseDateOnly(now) || new Date();
  const startsAt = parseDateOnly(subscription.starts_at) || createdAt;
  const rawExpiresAt = parseDateOnly(subscription.expires_at);
  const fallbackExpiryMonths = billingCycle === 'annual' ? 12 : 1;
  const effectiveExpiresAt = rawExpiresAt || addMonths(startsAt, fallbackExpiryMonths);
  const nowDate = parseDateOnly(now) || new Date();

  const isPending = status === 'pending';
  const isActive = status === 'active';
  const isSuspended = status === 'suspended';
  const isExpired = status === 'expired' || (isActive && effectiveExpiresAt && nowDate > effectiveExpiresAt);
  const graceEndsAt = addMonths(createdAt, 1);
  const daysUntilCutoff = graceEndsAt ? Math.max(0, Math.ceil((graceEndsAt.getTime() - nowDate.getTime()) / DAY_MS)) : null;
  const remainingDuration = effectiveExpiresAt ? getRemainingDuration(nowDate, effectiveExpiresAt) : {
    monthsRemaining: null,
    daysRemaining: null,
    remainingUnit: null,
    remainingValue: null,
  };
  const daysRemaining = remainingDuration.daysRemaining;
  const monthsRemaining = remainingDuration.monthsRemaining;
  const remainingUnit = remainingDuration.remainingUnit;
  const remainingValue = remainingDuration.remainingValue;

  let accessBlocked = false;
  let code = null;
  let message = '';
  let level = 'info';

  if (isPending) {
    if (graceEndsAt && nowDate > graceEndsAt) {
      accessBlocked = true;
      code = 'SUBSCRIPTION_PENDING_EXPIRED';
      level = 'danger';
      message = "Accès suspendu: l'abonnement est resté en attente plus d'un mois.";
    } else {
      level = 'warning';
      message = graceEndsAt
        ? `Abonnement en attente. L'accès restera ouvert jusqu'au ${formatDateDisplay(graceEndsAt)} (${daysUntilCutoff} jour(s) restants).`
        : "Abonnement en attente. L'accès est temporairement autorisé.";
    }
  } else if (isActive) {
    if (isExpired) {
      accessBlocked = true;
      code = 'SUBSCRIPTION_EXPIRED';
      level = 'danger';
      message = "Accès suspendu: l'abonnement est arrivé à expiration.";
    } else {
      level = 'success';
      if (remainingUnit === 'months' && remainingValue !== null) {
        message = `Abonnement actif. Il reste ${remainingValue} mois avant la fin (${formatDateDisplay(effectiveExpiresAt)}).`;
      } else if (remainingUnit === 'days' && remainingValue !== null) {
        message = `Abonnement actif. Il reste ${remainingValue} jour(s) avant la fin (${formatDateDisplay(effectiveExpiresAt)}).`;
      } else {
        message = 'Abonnement actif.';
      }
    }
  } else if (isSuspended) {
    accessBlocked = true;
    code = 'SUBSCRIPTION_SUSPENDED';
    level = 'danger';
    message = "Accès suspendu: l'abonnement est suspendu.";
  } else if (isExpired) {
    accessBlocked = true;
    code = 'SUBSCRIPTION_EXPIRED';
    level = 'danger';
    message = "Accès suspendu: l'abonnement est expiré.";
  }

  return {
    status,
    planName: subscription.plan_name || subscription.plan_code || null,
    planCode: subscription.plan_code || null,
    billingCycle,
    createdAt: subscription.created_at || null,
    startsAt: subscription.starts_at || null,
    expiresAt: effectiveExpiresAt ? effectiveExpiresAt.toISOString().slice(0, 10) : null,
    graceEndsAt: graceEndsAt ? graceEndsAt.toISOString().slice(0, 10) : null,
    daysUntilCutoff,
    daysRemaining,
    monthsRemaining,
    remainingUnit,
    remainingValue,
    accessBlocked,
    code,
    message,
    level,
  };
}

module.exports = {
  buildSubscriptionAccessStatus,
  addMonths,
  getRemainingDuration,
};
