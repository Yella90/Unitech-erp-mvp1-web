function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeInscriptionForecast(classRows = []) {
  const rows = (Array.isArray(classRows) ? classRows : []).map((row) => {
    const effectif = toNumber(row.effectif);
    const freeEffectif = Math.max(toNumber(row.free_effectif), 0);
    const inscriptionEffectif = Math.max(effectif - freeEffectif, 0);
    const mensualite = toNumber(row.mensualite);
    const fraisInscription = toNumber(row.frais_inscription);
    const attenduMensuel = mensualite * effectif;
    const attenduInscription = fraisInscription * inscriptionEffectif;

    return {
      ...row,
      effectif,
      free_effectif: freeEffectif,
      effectif_inscription: inscriptionEffectif,
      attendu_mensuel: attenduMensuel,
      attendu_inscription: attenduInscription,
      attendu_cumule: attenduMensuel,
      reste_cumule: Math.max(attenduMensuel + attenduInscription - toNumber(row.paye_cumule), 0),
    };
  });

  const totalMensuelPrevu = rows.reduce((sum, row) => sum + toNumber(row.attendu_mensuel), 0);
  const totalFraisInscriptionPrevu = rows.reduce((sum, row) => sum + toNumber(row.attendu_inscription), 0);
  const totalCumulePrevu = totalMensuelPrevu + totalFraisInscriptionPrevu;

  return {
    rows,
    totalMensuelPrevu,
    totalFraisInscriptionPrevu,
    totalCumulePrevu,
  };
}

function buildInscriptionConflictReport(studentRows = [], paymentRows = []) {
  const conflictPayments = paymentRows.filter((payment) => {
    const mois = String(payment.mois || '').trim().toLowerCase();
    if (mois !== 'inscription') return false;
    return Number(payment.eleve_id || 0) > 0;
  });

  const paymentCountByStudent = new Map();
  for (const payment of conflictPayments) {
    const key = Number(payment.eleve_id || 0);
    paymentCountByStudent.set(key, (paymentCountByStudent.get(key) || 0) + 1);
  }

  const conflictingStudents = (studentRows || [])
    .filter((student) => Number(student.exonere_frais_inscription || 0) === 1)
    .map((student) => ({
      id: student.id,
      matricule: student.matricule || null,
      nom: student.nom || '',
      prenom: student.prenom || '',
      inscriptionPayments: paymentCountByStudent.get(Number(student.id || 0)) || 0,
    }))
    .filter((student) => student.inscriptionPayments > 0);

  return {
    conflictCount: conflictingStudents.length,
    conflictingStudents,
  };
}

module.exports = {
  computeInscriptionForecast,
  buildInscriptionConflictReport,
};
