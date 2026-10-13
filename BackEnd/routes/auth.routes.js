const express = require('express');
const {
  getUsuarios,
  actualizarRol,
  obtenerSesion,
  updatePerfil,
} = require('../controllers/auth.controller');
const {
  requerirAdministradorGeneral,
  requerirEdicion,
} = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/sesion', obtenerSesion);
router.get('/usuarios', requerirAdministradorGeneral, getUsuarios);
router.put('/usuarios/:id/rol', requerirAdministradorGeneral, actualizarRol);
router.put('/perfil', requerirEdicion, updatePerfil);

module.exports = router;
