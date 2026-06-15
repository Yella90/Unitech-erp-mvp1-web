import autoTable from 'jspdf-autotable';

export function formatScore(value) {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toFixed(2).replace(/\.00$/, '');
}

export function renderBulletinPdfPage(doc, { payload, qrCode = '' }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const school = payload?.school || {};
  const student = payload?.student || {};
  const bulletin = payload?.bulletin || {};
  const stats = payload?.stats || {};
  const averages = payload?.notes || [];

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(12, 10, pageWidth - 24, 28, 6, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(school.name || 'UNITECH ERP', 18, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${school.address || ''}${school.phone ? ` • ${school.phone}` : ''}${school.email ? ` • ${school.email}` : ''}`, 18, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Annee scolaire: ${bulletin.schoolYear || '-'} • Trimestre: ${bulletin.trimestre || '-'}`, pageWidth - 18, 18, { align: 'right' });
  doc.text(`Genere le: ${formatDate(bulletin.generatedAt)}`, pageWidth - 18, 24, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${student.prenom || ''} ${student.nom || ''}`.trim(), 18, 48);
  doc.setFont('helvetica', 'normal');
  doc.text(`Matricule: ${student.matricule || '-'}`, 18, 53);
  doc.text(`Classe: ${student.classe || '-'}`, 18, 58);
  doc.text(`Filiere: ${student.filiere || '-'}`, 18, 63);

  if (qrCode) {
    doc.addImage(qrCode, 'PNG', pageWidth - 42, 44, 24, 24);
  }

  autoTable(doc, {
    startY: 72,
    head: [[
      'Matiere',
      'Enseignant',
      'Coefficient',
      'Devoir',
      'Composition',
      'Moyenne classe',
      'Appreciation',
    ]],
    body: averages.map((item) => [
      item.matiere,
      item.enseignant,
      String(item.coefficient),
      formatScore(item.devoir),
      formatScore(item.composition),
      formatScore(item.moyenneClasse),
      item.appreciation,
    ]),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.4, overflow: 'linebreak', lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: [29, 78, 216], textColor: [255, 255, 255] },
    margin: { left: 12, right: 12 },
  });

  const finalY = doc.lastAutoTable.finalY + 8;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, finalY, pageWidth - 24, 30, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Synthese generale', 16, finalY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Moyenne eleve: ${formatScore(stats.moyenneGenerale)} / 20`, 16, finalY + 13);
  doc.text(`Rang: ${stats.rang ?? '-'}`, pageWidth / 2, finalY + 13, { align: 'center' });
  doc.text(`Plus forte moyenne: ${formatScore(stats.meilleureMoyenneClasse)}`, 16, finalY + 19);
  doc.text(`Plus faible moyenne: ${formatScore(stats.plusFaibleMoyenneClasse)}`, pageWidth / 2, finalY + 19, { align: 'center' });

  const footerY = 275;
  doc.setDrawColor(203, 213, 225);
  doc.line(18, footerY, 58, footerY);
  doc.line(pageWidth / 2 - 20, footerY, pageWidth / 2 + 20, footerY);
  doc.line(pageWidth - 58, footerY, pageWidth - 18, footerY);
  doc.setFontSize(8);
  doc.text('Professeur principal', 38, footerY + 5, { align: 'center' });
  doc.text('Direction', pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text('Parents / Tuteurs', pageWidth - 38, footerY + 5, { align: 'center' });
  doc.text(`Code verification: ${bulletin.verificationCode || '-'}`, pageWidth / 2, 287, { align: 'center' });
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR');
}
