const express = require('express');
const {
  getActualizaciones,
  createActualizacion,
  updateActualizacion,
  getMetricasActividad,
} = require('../controllers/actualizaciones.controller');

const router = express.Router();
const { requerirAdministrador, requerirEdicion } = require('../middleware/auth.middleware');

router.get('/metricas', requerirAdministrador, getMetricasActividad);
router.get('/', getActualizaciones);
router.post('/', requerirEdicion, createActualizacion);
router.put('/:id', requerirEdicion, updateActualizacion);

module.exports = router;
