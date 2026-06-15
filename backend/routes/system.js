const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission, requirePermissionByMethod } = require('../middleware/authMiddleware');
const controller = require('../controllers/systemController');
const trimestreController = require('../controllers/trimestreController');

const router = express.Router();

router.use(authMiddleware);

router.get('/dashboard/summary', requirePermission('dashboard', 'read'), controller.getDashboardSummary);
router.get('/setup/context', requirePermission('students', 'read'), controller.getSetupContext);
router.get('/activity-logs', requirePermission('activity_logs', 'read'), controller.listActivityLogs);
router.post('/setup/classes', requirePermission('classes', 'create'), controller.createSetupClass);
router.post('/setup/eleves/preview', requirePermission('students', 'create'), controller.previewSetupStudents);
router.post('/setup/eleves/commit', requirePermission('students', 'create'), controller.commitSetupStudents);
router.post('/setup/eleves/manual', requirePermission('students', 'create'), controller.createSetupStudentManual);
router.get('/setup/notes/eleves', requirePermission('notes', 'read'), controller.listSetupStudentsByClass);
router.post('/setup/notes/save', requirePermission('notes', 'create'), controller.saveSetupNotes);

router.get('/school-years', requirePermission('trimestres', 'read'), controller.listSchoolYears);
router.post('/school-years', requirePermission('trimestres', 'create'), controller.createSchoolYear);
router.get('/school-years/transition-context', requirePermission('trimestres', 'read'), controller.getSchoolYearTransitionContext);
router.post('/school-years/transition', requirePermission('trimestres', 'update'), controller.transitionSchoolYear);

router.get('/trimestres', requirePermission('trimestres', 'read'), trimestreController.listTrimestres);
router.post('/trimestres', requirePermission('trimestres', 'create'), trimestreController.createTrimestre);
router.put('/trimestres/:id', requirePermission('trimestres', 'update'), trimestreController.updateTrimestre);
router.post('/trimestres/:id/recompute', requirePermission('trimestres', 'update'), trimestreController.recomputeTrimestreLoads);
router.post('/trimestres/:id/validate', requirePermission('trimestres', 'update'), trimestreController.validateTrimestre);
router.get('/trimestres/:id/workloads', requirePermission('trimestres', 'read'), trimestreController.listTrimestreWorkloads);
router.put('/trimestres/:id/workloads/:workloadId', requirePermission('trimestres', 'update'), trimestreController.updateTrimestreWorkload);

router.get('/calendar-days', requirePermission('trimestres', 'read'), trimestreController.listCalendarDays);
router.post('/calendar-days', requirePermission('trimestres', 'create'), trimestreController.createCalendarDay);
router.delete('/calendar-days/:id', requirePermission('trimestres', 'delete'), trimestreController.deleteCalendarDay);

router.get('/finances/overview', requirePermission('finances', 'read'), controller.getFinanceOverview);
router.get('/paiements', requirePermission('payments', 'read'), controller.listPaiements);
router.post('/paiements', requirePermission('payments', 'create'), controller.createPaiement);
router.post('/paiements/:id/annuler', requirePermission('payments', 'delete'), controller.cancelPaiement);
router.delete('/paiements/:id', requirePermission('payments', 'delete'), controller.deletePaiement);

router.get('/depenses', requirePermission('expenses', 'read'), controller.listDepenses);
router.post('/depenses', requirePermission('expenses', 'create'), controller.createDepense);
router.delete('/depenses/:id', requirePermission('expenses', 'delete'), controller.deleteDepense);

router.get('/salaires', requirePermission('salaries', 'read'), controller.listSalaires);
router.get('/salaires/preview-generation', requirePermission('salaries', 'read'), controller.previewSalaryGeneration);
router.post('/salaires/generate-monthly', requirePermission('salaries', 'create'), controller.generateMonthlySalaries);
router.post('/salaires/generate-hourly', requirePermission('salaries', 'create'), controller.generateHourlySalaries);
router.post('/salaires', requirePermission('salaries', 'create'), controller.createSalaire);
router.post('/salaires/:id/annuler', requirePermission('salaries', 'delete'), controller.cancelSalaire);
router.delete('/salaires/:id', requirePermission('salaries', 'delete'), controller.deleteSalaire);
router.get('/teacher-absences', requirePermission('schedules', 'read'), controller.listTeacherAbsences);
router.get('/teachers/:teacherId/trimestre-hourly-summary', requirePermission('schedules', 'read'), controller.getTeacherTrimesterHourlySummary);
router.get('/teachers/:teacherId/trimestre-absence-summary', requirePermission('schedules', 'read'), controller.getTeacherTrimesterAbsenceSummary);
router.get('/teachers/:teacherId/trimestre-monthly-summary', requirePermission('trimestres', 'read'), controller.getTeacherTrimesterMonthlySummary);
router.post('/teachers/:teacherId/absences', controller.createTeacherAbsence);
router.delete('/teacher-absences/:absenceId', controller.deleteTeacherAbsence);

router.get('/retraits', requirePermission('finances', 'read'), controller.listRetraits);
router.post('/retraits', requirePermission('finances', 'create'), controller.createRetrait);
router.delete('/retraits/:id', requirePermission('finances', 'delete'), controller.deleteRetrait);

router.get('/tresorerie', requirePermission('finances', 'read'), controller.getTresorerie);
router.get('/retards-paiement', requirePermission('finances', 'read'), controller.getRetardsPaiement);
router.get('/notifications', requirePermission('dashboard', 'read'), controller.getNotifications);
router.get('/transfer-notifications', requirePermission('transfer_notifications', 'read'), controller.getTransferNotifications);

router.get('/emplois', requirePermission('schedules', 'read'), controller.listEmplois);
router.post('/emplois', requirePermission('schedules', 'create'), controller.createEmploi);
router.put('/emplois/:id', requirePermission('schedules', 'update'), controller.updateEmploi);
router.delete('/emplois/:id', requirePermission('schedules', 'delete'), controller.deleteEmploi);

router.get('/attendance/sheet', requirePermission('attendance', 'read'), controller.getAttendanceSheet);
router.post('/attendance/sheet', requirePermission('attendance', 'create'), controller.saveAttendanceSheet);
router.get('/attendance/history/:eleveId', requirePermission('attendance', 'read'), controller.getEleveAttendanceHistory);

router.get('/notes/context', requirePermission('notes', 'read'), controller.getNotesContext);
router.get('/notes', requirePermission('notes', 'read'), controller.listNotes);
router.get('/bulletins/:id', requirePermission('bulletins', 'read'), controller.getBulletin);
router.post('/notes', requirePermission('notes', 'create'), controller.createNote);
router.delete('/notes/:id', requirePermission('notes', 'delete'), controller.deleteNote);

router.get('/transferts', requirePermission('students', 'read'), controller.listTransfers);
router.get('/transferts/options', requirePermission('students', 'read'), controller.getTransferOptions);
router.post('/transferts', requirePermission('students', 'update'), controller.createTransfer);
router.patch('/transferts/:id/status', requirePermission('students', 'update'), controller.updateTransferStatus);

router.get('/rapports', requirePermission('reports', 'read'), controller.getReports);
router.get('/sync-status', requirePermission('dashboard', 'read'), controller.getSyncStatus);
router.post('/sync-status/sync-now', requirePermission('dashboard', 'update'), controller.triggerSync);

module.exports = router;
