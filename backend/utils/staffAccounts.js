const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { normalizeRole } = require('../middleware/authMiddleware');

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function toSlugFragment(value, fallback = 'USER') {
  const raw = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();
  return raw.slice(0, 4) || fallback;
}

function buildGeneratedPassword({ schoolName, fullName, matricule, role }) {
  const schoolCode = toSlugFragment(schoolName, 'ECO');
  const nameCode = toSlugFragment(fullName, 'USER');
  const matriculeCode = String(matricule || '0000').replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || '0000';
  const roleCode = toSlugFragment(role, 'STF').slice(0, 3);
  const randomCode = Math.floor(100 + Math.random() * 900);
  return `${schoolCode}${roleCode}${nameCode}${matriculeCode}!${randomCode}`;
}

function resolvePersonnelRole(poste) {
  const normalized = String(poste || '').trim().toLowerCase();
  if (normalized.includes('directeur')) return 'directeur';
  if (normalized.includes('promoteur')) return 'promoteur';
  if (normalized.includes('comptable')) return 'comptable';
  if (normalized.includes('secretaire')) return 'secretaire';
  if (normalized.includes('censeur')) return 'censeur';
  if (normalized.includes('surveillant')) return 'surveillant';
  return 'personnel';
}

async function getSchoolName(schoolId) {
  const row = await get('SELECT name FROM schools WHERE id = ?', [schoolId]);
  return row?.name || 'Ecole';
}

async function ensureUserEmailAvailable(email, ignoreUserId = null) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('EMAIL_REQUIRED');
  }

  const row = await get('SELECT id, school_id FROM users WHERE lower(trim(email)) = ?', [normalizedEmail]);
  if (row && (!ignoreUserId || Number(row.id) !== Number(ignoreUserId))) {
    throw new Error('USER_EMAIL_EXISTS');
  }
}

async function createStaffUserAccount({ schoolId, name, email, phone, matricule, role }) {
  const normalizedRole = normalizeRole(role);
  const schoolName = await getSchoolName(schoolId);
  const generatedPassword = buildGeneratedPassword({
    schoolName,
    fullName: name,
    matricule,
    role: normalizedRole,
  });
  const hashedPassword = await bcrypt.hash(generatedPassword, 10);
  const result = await run(
    `INSERT INTO users (name, email, password, role, school_id, phone, matricule, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [name, String(email || '').trim().toLowerCase(), hashedPassword, normalizedRole, schoolId, phone || null, matricule || null]
  );

  return {
    id: result.id,
    email: String(email || '').trim().toLowerCase(),
    role: normalizedRole,
    generatedPassword,
  };
}

async function findStaffUserAccount({ schoolId, email, matricule }) {
  return get(
    `SELECT id, email, matricule, role
     FROM users
     WHERE school_id = ?
       AND (
         lower(trim(email)) = lower(trim(?))
         OR (matricule IS NOT NULL AND matricule = ?)
       )
     ORDER BY id ASC
     LIMIT 1`,
    [schoolId, email || '', matricule || null]
  );
}

async function syncStaffUserAccount({ schoolId, previousEmail, previousMatricule, name, email, phone, matricule, role }) {
  const normalizedRole = normalizeRole(role);
  const existingUser = await get(
    `SELECT id FROM users
     WHERE school_id = ?
       AND (
         lower(trim(email)) = lower(trim(?))
         OR (matricule IS NOT NULL AND matricule = ?)
       )
     ORDER BY id ASC
     LIMIT 1`,
    [schoolId, previousEmail || email, previousMatricule || matricule || null]
  );

  if (!existingUser) return null;

  await ensureUserEmailAvailable(email, existingUser.id);
  await run(
    `UPDATE users
     SET name = ?, email = ?, role = ?, phone = ?, matricule = ?
     WHERE id = ? AND school_id = ?`,
    [name, String(email || '').trim().toLowerCase(), normalizedRole, phone || null, matricule || null, existingUser.id, schoolId]
  );

  return { id: existingUser.id, email: String(email || '').trim().toLowerCase(), role: normalizedRole };
}

async function deleteStaffUserAccount({ schoolId, email, matricule }) {
  await run(
    `DELETE FROM users
     WHERE school_id = ?
       AND (
         lower(trim(email)) = lower(trim(?))
         OR (matricule IS NOT NULL AND matricule = ?)
       )`,
    [schoolId, email || '', matricule || null]
  );
}

module.exports = {
  buildGeneratedPassword,
  createStaffUserAccount,
  deleteStaffUserAccount,
  ensureUserEmailAvailable,
  findStaffUserAccount,
  resolvePersonnelRole,
  syncStaffUserAccount,
};
