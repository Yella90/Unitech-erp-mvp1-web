require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const auclassesRoutes = require('./routes/classes');
const elevesRoutes = require('./routes/eleves');
const enseignantsRoutes = require('./routes/enseignants');
const personnelsRoute= require('./routes/personnel')
const matiereRoute = require('./routes/matiereRoute');
const financesRoute = require('./routes/finances');
const affectationRoute=require('./routes/affectationRoute')
const administrateurRoute = require('./routes/administrateur');
const systemRoute = require('./routes/system');
const superadminRoute = require('./routes/superadmin');
const systemController = require('./controllers/systemController');
const activityLogger = require('./middleware/activityLogger');
const { ensurePostgresSchema } = require('./database/postgresSchema');
const app = express();
const frontendDistPath = path.resolve(__dirname, '..', 'unitech-frontend', 'dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');
const frontendPackageJsonPath = path.resolve(__dirname, '..', 'unitech-frontend', 'package.json');

app.use(cors());
app.use(express.json());
app.use('/api', activityLogger);

app.use('/api/auth', authRoutes);
app.use('/api/classes', auclassesRoutes);
app.use('/api/eleves', elevesRoutes);
app.use('/api/enseignants', enseignantsRoutes); 
app.use('/api/personnels',personnelsRoute);
app.use('/api/matieres', matiereRoute);
app.use('/api/finances', financesRoute);
app.use('/api/affectation',affectationRoute)
app.use('/api/administrateur', administrateurRoute);
app.use('/api/system', systemRoute);
app.use('/api/superadmin', superadminRoute);
app.get('/api/public/bulletins/:id', systemController.verifyBulletinPublic);

if (fs.existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath, { index: false }));

  app.get(/^\/(?!api|socket\.io).*/, (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    return res.sendFile(frontendIndexPath);
  });
}

const PORT = process.env.PORT || 5000;

function ensureFrontendBuild() {
  if (fs.existsSync(frontendIndexPath)) {
    return;
  }

  if (!fs.existsSync(frontendPackageJsonPath)) {
    throw new Error('Frontend introuvable: impossible de generer le build');
  }

  console.log('Build frontend manquant, generation en cours...');
  const buildResult = spawnSync('npm', ['run', 'build'], {
    cwd: path.dirname(frontendPackageJsonPath),
    stdio: 'inherit',
    shell: true,
  });

  if (buildResult.status !== 0) {
    throw new Error('Impossible de generer le build frontend');
  }
}

async function startServer() {
  ensureFrontendBuild();
  await ensurePostgresSchema();
  app.listen(PORT, () => {
    console.log(`Serveur accessible sur http://votre-ip:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Impossible de demarrer le serveur:', error);
  process.exitCode = 1;
});
