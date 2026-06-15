function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function monthStart(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function countMonthsBetweenInclusive(startDateLike, endDateLike) {
  const start = monthStart(startDateLike);
  const end = monthStart(endDateLike);
  if (!start || !end || start > end) return 0;
  return ((end.getFullYear() - start.getFullYear()) * 12) + (end.getMonth() - start.getMonth()) + 1;
}

function resolveEffectiveStartDate(dateInscription, schoolStartDate) {
  const candidates = [schoolStartDate, dateInscription]
    .map((value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    })
    .filter(Boolean);

  if (!candidates.length) {
    return new Date();
  }

  return candidates.reduce((latest, current) => (current > latest ? current : latest));
}

function computeStudentFinanceSummary({
  mensualite = 0,
  reduction = 0,
  totalVerseHorsInscription = 0,
  dateInscription = null,
  schoolStartDate = null,
  currentDate = new Date(),
}) {
  const mensualiteValue = toNumber(mensualite);
  const reductionValue = toNumber(reduction);
  const verseHorsInscriptionValue = toNumber(totalVerseHorsInscription);
  const effectiveStartDate = resolveEffectiveStartDate(dateInscription, schoolStartDate);
  const moisAttendus = countMonthsBetweenInclusive(effectiveStartDate, currentDate);
  const totalMensualitesDues = mensualiteValue * moisAttendus;
  const mensualitesNettes = Math.max(totalMensualitesDues - reductionValue, 0);
  const resteAPayer = Math.max(mensualitesNettes - verseHorsInscriptionValue, 0);
  const etatPaiement = mensualitesNettes <= 0
    ? 'paye'
    : verseHorsInscriptionValue <= 0
      ? 'non paye'
      : resteAPayer > 0
        ? 'partiel'
        : 'paye';

  return {
    effectiveStartDate,
    moisAttendus,
    mensualite: mensualiteValue,
    reduction: reductionValue,
    totalVerseHorsInscription: verseHorsInscriptionValue,
    totalMensualitesDues,
    mensualitesNettes,
    resteAPayer,
    etatPaiement,
    moisCouverts: mensualiteValue > 0 ? Math.floor(verseHorsInscriptionValue / mensualiteValue) : 0,
  };
}

module.exports = {
  countMonthsBetweenInclusive,
  computeStudentFinanceSummary,
};
