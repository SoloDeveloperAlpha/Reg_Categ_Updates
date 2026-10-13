const express = require('express');
const {
  getActualizaciones,
  createActualizacion,
} = require('../controllers/actualizaciones.controller');

const router = express.Router();
const { requerirEdicion } = require('../middleware/auth.middleware');

router.get('/', getActualizaciones);
router.post('/', requerirEdicion, createActualizacion);

module.exports = router;
