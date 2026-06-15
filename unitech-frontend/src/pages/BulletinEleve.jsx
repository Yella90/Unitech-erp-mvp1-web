import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toDataURL } from 'qrcode';
import {
  AcademicCapIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  EnvelopeIcon,
  MapPinIcon,
  MoonIcon,
  PhoneIcon,
  QrCodeIcon,
  SparklesIcon,
  SunIcon,
  TrophyIcon,
  UserCircleIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';
import { PageBanner, PageErrorState, PageLoadingState, usePageLoadingVisibility } from '../components/PageState';

function metricTone(value, thresholds = { good: 16, mid: 10 }) {
  const score = Number(value || 0);
  if (score >= thresholds.good) return 'emerald';
  if (score >= thresholds.mid) return 'amber';
  return 'rose';
}

function scoreProgress(score) {
  return Math.max(0, Math.min(100, Math.round((Number(score || 0) / 20) * 100)));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR');
}

function formatScore(value) {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toFixed(2).replace(/\.00$/, '');
}

function sanitizeFileName(value) {
  return String(value || 'bulletin')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function ProgressBar({ value, tone = 'blue' }) {
  const colors = {
    blue: 'bg-blue-600',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, darkMode = false }) {
  return (
    <div className={`premium-card rounded-2xl border p-4 shadow-sm ${darkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2 ${darkMode ? 'bg-slate-800 text-sky-300' : 'bg-sky-50 text-sky-700'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs uppercase tracking-wide ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
          <p className={`mt-1 break-words text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{value || '-'}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subValue, tone = 'blue', darkMode = false, progress = null }) {
  const palette = {
    blue: darkMode ? 'from-blue-500/20 to-cyan-500/20 text-blue-200' : 'from-blue-50 to-cyan-50 text-blue-700',
    emerald: darkMode ? 'from-emerald-500/20 to-teal-500/20 text-emerald-200' : 'from-emerald-50 to-teal-50 text-emerald-700',
    amber: darkMode ? 'from-amber-500/20 to-orange-500/20 text-amber-200' : 'from-amber-50 to-orange-50 text-amber-700',
    rose: darkMode ? 'from-rose-500/20 to-pink-500/20 text-rose-200' : 'from-rose-50 to-pink-50 text-rose-700',
  };
  return (
    <div className={`premium-card rounded-3xl border p-5 shadow-sm ${darkMode ? 'border-slate-800 bg-slate-950/80' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
          <p className={`mt-3 text-3xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{value}</p>
          {subValue ? <p className={`mt-2 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{subValue}</p> : null}
        </div>
        <div className={`rounded-2xl bg-gradient-to-br p-3 ${palette[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {progress !== null ? <div className="mt-4"><ProgressBar value={progress} tone={tone} /></div> : null}
    </div>
  );
}

function SubjectNoteCard({ row, darkMode = false }) {
  const tone = metricTone(row.moyenneClasse);
  return (
    <div className={`premium-card rounded-3xl border p-4 shadow-sm ${darkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className={`text-base font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{row.matiere}</h4>
          <p className={`mt-1 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{row.enseignant}</p>
        </div>
        <Badge tone={tone}>{row.appreciation}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={`rounded-2xl p-3 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <p className={`text-xs uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Coefficient</p>
          <p className={`mt-1 text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{row.coefficient}</p>
        </div>
        <div className={`rounded-2xl p-3 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <p className={`text-xs uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Devoir</p>
          <p className={`mt-1 text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatScore(row.devoir)}</p>
        </div>
        <div className={`rounded-2xl p-3 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <p className={`text-xs uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Composition</p>
          <p className={`mt-1 text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatScore(row.composition)}</p>
        </div>
        <div className={`rounded-2xl p-3 ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <p className={`text-xs uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>Moyenne classe</p>
          <p className={`mt-1 text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatScore(row.moyenneClasse)}</p>
        </div>
      </div>
    </div>
  );
}

function BulletinEleve() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const pageRef = useRef(null);
  const showLoading = usePageLoadingVisibility(loading);
  const trimestre = searchParams.get('trimestre') || '1';
  const annee = searchParams.get('annee') || '';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/system/bulletins/${id}`, { params: { trimestre, annee } });
      setPayload(response.data);
    } catch (err) {
      setError("Impossible de charger le bulletin de l'eleve.");
    } finally {
      setLoading(false);
    }
  }, [id, trimestre, annee]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    async function createQr() {
      if (!payload?.bulletin?.verificationCode) return;
      const yearPart = annee ? `&annee=${encodeURIComponent(annee)}` : '';
      const url = `${window.location.origin}/eleves/${id}/bulletin?trimestre=${trimestre}${yearPart}&code=${payload.bulletin.verificationCode}`;
      const dataUrl = await toDataURL(url, {
        margin: 0,
        width: 140,
        color: {
          dark: darkMode ? '#E2E8F0' : '#0F172A',
          light: darkMode ? '#0F172A' : '#FFFFFF',
        },
      });
      setQrCode(dataUrl);
    }
    createQr();
  }, [payload, id, trimestre, annee, darkMode]);

  const averages = useMemo(() => payload?.notes || [], [payload]);

  async function handleDownloadPdf() {
    if (!payload) return;
    setSuccess('');
    setError('');
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const school = payload.school || {};
      const student = payload.student || {};
      const bulletin = payload.bulletin || {};
      const stats = payload.stats || {};
      const appreciation = payload.appreciation || {};

      doc.setFillColor(15, 23, 42);
      doc.roundedRect(12, 10, pageWidth - 24, 28, 6, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(school.name || 'UNITECH ERP', 18, 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`${school.address || ''}${school.phone ? ` • ${school.phone}` : ''}${school.email ? ` • ${school.email}` : ''}`, 18, 24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
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

      const fileName = `${sanitizeFileName(student.prenom)}-${sanitizeFileName(student.nom)}-bulletin.pdf`;
      doc.save(fileName);
      setSuccess('Bulletin telecharge avec succes.');
    } catch (err) {
      setError('Erreur lors de la generation du PDF.');
    }
  }

  if (showLoading) {
    return <PageLoadingState title="Chargement du bulletin" message="Le bulletin premium est en cours de generation." />;
  }

  if (error && !payload) {
    return (
      <PageErrorState
        title="Bulletin indisponible"
        message={error}
        action={<button type="button" onClick={load} className="premium-action rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Reessayer</button>}
      />
    );
  }

  const school = payload?.school || {};
  const student = payload?.student || {};
  const stats = payload?.stats || {};
  const appreciation = payload?.appreciation || {};
  const bulletin = payload?.bulletin || {};
  const shellClass = darkMode
    ? 'bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_35%),linear-gradient(180deg,#020617,#0f172a)] text-slate-100'
    : 'bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_35%),linear-gradient(180deg,#f8fbff,#eef4ff)] text-slate-900';

  return (
    <div className={`app-page min-h-screen overflow-x-clip p-4 md:p-6 ${shellClass}`}>
      <div className="mx-auto max-w-7xl space-y-6" ref={pageRef}>
        <PageBanner tone="success" title={success ? 'Operation reussie' : ''} message={success} />
        <PageBanner tone="error" title={error && payload ? 'Action impossible' : ''} message={payload ? error : ''} />

        <div className={`premium-card overflow-hidden rounded-[32px] border shadow-xl ${darkMode ? 'border-slate-800 bg-slate-950/70' : 'border-white/70 bg-white/85 backdrop-blur-sm'}`}>
          <div className={`grid gap-4 border-b px-4 py-5 md:px-6 md:py-6 md:grid-cols-[minmax(0,1.1fr)_auto] ${darkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-white/70'}`}>
            <div className="min-w-0 flex flex-col gap-4 sm:flex-row">
              <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-blue-600 to-emerald-500 text-2xl font-bold text-white shadow-lg">
                {(school.name || 'U').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className={`text-xs uppercase tracking-[0.25em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Etablissement</p>
                <h1 className="mt-1 break-words text-2xl font-bold">{school.name || 'UNITECH ERP'}</h1>
                <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <span className="inline-flex min-w-0 items-center gap-1 break-words"><MapPinIcon className="h-4 w-4 shrink-0" /> {school.address || '-'}</span>
                  <span className="inline-flex min-w-0 items-center gap-1 break-words"><PhoneIcon className="h-4 w-4 shrink-0" /> {school.phone || '-'}</span>
                  <span className="inline-flex min-w-0 items-center gap-1 break-all"><EnvelopeIcon className="h-4 w-4 shrink-0" /> {school.email || '-'}</span>
                </div>
              </div>
            </div>

            <div className="min-w-0 flex flex-col items-start gap-3 md:items-end">
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">Annee {bulletin.schoolYear || '-'}</Badge>
                <Badge tone="emerald">Trimestre {bulletin.trimestre || '-'}</Badge>
              </div>
              <h2 className="text-left text-xl font-semibold tracking-tight md:text-right md:text-2xl">Bulletin de performance scolaire</h2>
              <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Genere le {formatDate(bulletin.generatedAt)}</p>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  onClick={() => setDarkMode((value) => !value)}
                className={`premium-action inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium ${darkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}
                >
                  {darkMode ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
                  {darkMode ? 'Mode clair' : 'Mode sombre'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                className="premium-action inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Telecharger PDF
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-4 py-5 md:px-6 md:py-6 xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              <div className={`premium-card rounded-[28px] border p-5 shadow-sm ${darkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <img
                    src={student.photo || 'https://via.placeholder.com/160x160?text=Eleve'}
                    alt="Photo eleve"
                    className="h-24 w-24 shrink-0 rounded-full border-4 border-white object-cover shadow-lg"
                  />
                  <div className="min-w-0">
                    <Badge tone={student.statut === 'actif' ? 'emerald' : 'amber'}>{student.statut || 'actif'}</Badge>
                    <h3 className="mt-3 break-words text-xl font-bold">{`${student.prenom || ''} ${student.nom || ''}`.trim()}</h3>
                    <p className={`break-all ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{student.matricule || '-'}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  <InfoCard icon={AcademicCapIcon} label="Classe" value={student.classe} darkMode={darkMode} />
                  <InfoCard icon={SparklesIcon} label="Filiere" value={student.filiere || '-'} darkMode={darkMode} />
                  <InfoCard icon={UserCircleIcon} label="Date de naissance" value={`${formatDate(student.dateNaissance)} • ${student.age || '-'} ans`} darkMode={darkMode} />
                  <InfoCard icon={CheckBadgeIcon} label="Nationalite" value={student.nationalite || '-'} darkMode={darkMode} />
                </div>
              </div>

              <div className={`premium-card rounded-[28px] border p-5 shadow-sm ${darkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div className="mb-4 flex items-center gap-2">
                  <UsersIcon className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-lg font-semibold">Parents et contacts</h3>
                </div>
                <div className="grid gap-3">
                  <InfoCard icon={UsersIcon} label="Pere" value={payload?.parents?.pere || '-'} darkMode={darkMode} />
                  <InfoCard icon={UsersIcon} label="Mere" value={payload?.parents?.mere || '-'} darkMode={darkMode} />
                  <InfoCard icon={PhoneIcon} label="Telephone" value={payload?.parents?.telephone || '-'} darkMode={darkMode} />
                  <InfoCard icon={MapPinIcon} label="Adresse" value={payload?.parents?.adresse || '-'} darkMode={darkMode} />
                  <InfoCard icon={EnvelopeIcon} label="Email" value={payload?.parents?.email || '-'} darkMode={darkMode} />
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard icon={ChartBarIcon} label="Moyenne generale" value={formatScore(stats.moyenneGenerale)} subValue="/ 20" tone={metricTone(stats.moyenneGenerale)} darkMode={darkMode} progress={scoreProgress(stats.moyenneGenerale)} />
                <StatCard icon={TrophyIcon} label="Rang" value={stats.rang ?? '-'} subValue="Dans la classe" tone="blue" darkMode={darkMode} progress={null} />
                <StatCard icon={CheckBadgeIcon} label="Presence" value={`${stats.tauxPresence ?? 0}%`} subValue="Taux de presence" tone="emerald" darkMode={darkMode} progress={stats.tauxPresence ?? 0} />
                <StatCard icon={AcademicCapIcon} label="Absences" value={stats.absences ?? 0} subValue="Nombre d'absences" tone={stats.absences > 5 ? 'rose' : 'amber'} darkMode={darkMode} progress={Math.min(100, Number(stats.absences || 0) * 5)} />
                <StatCard icon={SparklesIcon} label="Discipline" value={stats.discipline || '-'} subValue={`${stats.retards ?? 0} retard(s)`} tone="blue" darkMode={darkMode} progress={stats.discipline === 'Exemplaire' ? 100 : stats.discipline === 'Satisfaisant' ? 75 : 45} />
              </div>

              <div className={`premium-card overflow-hidden rounded-[28px] border shadow-sm ${darkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                <div className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${darkMode ? 'bg-slate-950/60' : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'}`}>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold">Tableau des notes</h3>
                    <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-white/80'}`}>Synthese detaillee par matiere</p>
                  </div>
                  <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-white/15 px-3 py-2">
                    <QrCodeIcon className="h-5 w-5 shrink-0 text-white" />
                    <span className="break-all text-xs font-medium text-white/90">{bulletin.verificationCode || '-'}</span>
                  </div>
                </div>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="min-w-[860px] w-full table-fixed border-separate border-spacing-0 text-[11px]">
                    <thead className={darkMode ? 'bg-slate-950 text-slate-300' : 'bg-slate-50 text-slate-600'}>
                      <tr>
                        {['Matiere', 'Enseignant', 'Coefficient', 'Devoir', 'Composition', 'Moyenne classe', 'Appreciation'].map((label) => (
                          <th key={label} className="border-b border-slate-200 px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em]">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {averages.map((row, index) => {
                        const tone = metricTone(row.moyenneClasse);
                        const rowClass = darkMode
                          ? index % 2 === 0 ? 'bg-slate-900/80' : 'bg-slate-950/80'
                          : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80';
                        return (
                          <tr key={`${row.matiere}-${index}`} className={`${rowClass} transition-colors hover:bg-blue-50/70 ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                            <td className="border-b border-slate-100 px-2 py-2 font-semibold text-slate-900">{row.matiere}</td>
                            <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{row.enseignant}</td>
                            <td className="border-b border-slate-100 px-2 py-2 text-slate-700">{row.coefficient}</td>
                            <td className="border-b border-slate-100 px-2 py-2 font-semibold text-slate-900">{formatScore(row.devoir)}</td>
                            <td className="border-b border-slate-100 px-2 py-2 font-semibold text-slate-900">{formatScore(row.composition)}</td>
                            <td className="border-b border-slate-100 px-2 py-2 font-semibold text-slate-900">{formatScore(row.moyenneClasse)}</td>
                            <td className="border-b border-slate-100 px-2 py-2"><Badge tone={tone}>{row.appreciation}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-4 p-4 lg:hidden">
                  {averages.map((row, index) => (
                    <SubjectNoteCard key={`${row.matiere}-${index}`} row={row} darkMode={darkMode} />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={ChartBarIcon} label="Moyenne de l'eleve" value={formatScore(stats.moyenneGenerale)} subValue="/ 20" tone={metricTone(stats.moyenneGenerale)} darkMode={darkMode} progress={scoreProgress(stats.moyenneGenerale)} />
                <StatCard icon={TrophyIcon} label="Rang dans la classe" value={stats.rang ?? '-'} subValue="Position finale" tone="blue" darkMode={darkMode} progress={null} />
                <StatCard icon={SparklesIcon} label="Plus forte moyenne" value={formatScore(stats.meilleureMoyenneClasse)} subValue="Dans la classe" tone="emerald" darkMode={darkMode} progress={scoreProgress(stats.meilleureMoyenneClasse)} />
                <StatCard icon={AcademicCapIcon} label="Plus faible moyenne" value={formatScore(stats.plusFaibleMoyenneClasse)} subValue="Dans la classe" tone="rose" darkMode={darkMode} progress={scoreProgress(stats.plusFaibleMoyenneClasse)} />
              </div>

              <div className={`grid gap-6 xl:grid-cols-[minmax(0,1fr)_190px]`}>
                <div className={`premium-card rounded-[28px] border p-6 shadow-sm ${darkMode ? 'border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950' : 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-blue-50'}`}>
                  <div className="mb-4 flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-emerald-500" />
                    <h3 className="text-lg font-semibold">Appreciation generale</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className={`text-xs uppercase tracking-wide ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Professeur principal</p>
                      <p className="mt-1 break-words font-semibold">{appreciation.professeurPrincipal || '-'}</p>
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wide ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Commentaire</p>
                      <p className="mt-1 break-words leading-7">{appreciation.commentaire || '-'}</p>
                    </div>
                    <div>
                      <p className={`text-xs uppercase tracking-wide ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Conseils pedagogiques</p>
                      <p className="mt-1 break-words leading-7">{appreciation.conseils || '-'}</p>
                    </div>
                    <div>
                      <Badge tone={metricTone(stats.moyenneGenerale)}>{appreciation.globale || '-'}</Badge>
                    </div>
                  </div>
                </div>

                <div className={`premium-card min-w-0 rounded-[28px] border p-5 shadow-sm ${darkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <QrCodeIcon className="h-5 w-5 text-emerald-500" />
                    <h3 className="font-semibold">Verification</h3>
                  </div>
                  <div className="mt-4 rounded-2xl bg-white p-3">
                    {qrCode ? <img src={qrCode} alt="QR verification" className="mx-auto h-32 w-32" /> : null}
                  </div>
                  <p className={`mt-3 break-all text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{bulletin.verificationCode || '-'}</p>
                </div>
              </div>

              <div className={`premium-card rounded-[28px] border px-4 py-5 md:px-6 shadow-sm ${darkMode ? 'border-slate-800 bg-slate-950/70' : 'border-slate-200 bg-white'}`}>
                <div className="grid gap-6 md:grid-cols-3">
                  <div>
                    <div className={`mb-10 border-b ${darkMode ? 'border-slate-700' : 'border-slate-300'}`} />
                    <p className="break-words text-sm font-semibold">Professeur principal</p>
                  </div>
                  <div>
                    <div className={`mb-10 border-b ${darkMode ? 'border-slate-700' : 'border-slate-300'}`} />
                    <p className="text-sm font-semibold">Directeur</p>
                  </div>
                  <div>
                    <div className={`mb-10 border-b ${darkMode ? 'border-slate-700' : 'border-slate-300'}`} />
                    <p className="break-words text-sm font-semibold">Parents / Tuteurs</p>
                  </div>
                </div>
                <div className={`mt-6 flex flex-wrap items-center justify-between gap-3 text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span className="break-words">Cachet numerique: {payload?.footer?.cachet || 'UNITECH ERP'}</span>
                  <span className="break-words">Coordonnees ERP: bulletin genere par UNITECH ERP</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={`premium-action rounded-2xl px-4 py-2 text-sm font-medium ${darkMode ? 'bg-slate-900 text-slate-200' : 'bg-white text-slate-700'}`}
          >
            Retour
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Trimestre</span>
            {[1, 2, 3].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSearchParams({ trimestre: String(value) })}
                className={`premium-action rounded-full px-4 py-2 text-sm font-semibold ${
                  trimestre === String(value)
                    ? 'bg-gradient-to-r from-blue-600 to-emerald-500 text-white'
                    : darkMode
                      ? 'bg-slate-900 text-slate-300'
                      : 'bg-white text-slate-700'
                }`}
              >
                T{value}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulletinEleve;
