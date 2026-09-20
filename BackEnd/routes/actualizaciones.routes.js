const express = require('express');
const {
  getActualizaciones,
  createActualizacion,
} = require('../controllers/actualizaciones.controller');

const router = express.Router();

router.get('/', getActualizaciones);
router.post('/', createActualizacion);

module.exports = router;
