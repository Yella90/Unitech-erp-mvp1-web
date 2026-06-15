const systemController = require('./systemController');

exports.addUtilisateur = systemController.addUser;
exports.getUtilisateurs = systemController.getUsers;
exports.updateUtilisateur = systemController.updateUser;
exports.deleteUtilisateur = systemController.deleteUser;
