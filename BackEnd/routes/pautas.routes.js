const express = require('express');
const {
  getPautas,
  getPautaById,
  getImagenesPauta,
  getImagenPauta,
  createImagenesPauta,
  deleteImagenPauta,
  createPauta,
  updatePauta,
  deletePauta,
} = require('../controllers/pautas.controller');

const router = express.Router();
const { requerirEdicion } = require('../middleware/auth.middleware');

router.get('/', getPautas);
router.get('/:id/imagenes', getImagenesPauta);
router.post('/:id/imagenes', requerirEdicion, createImagenesPauta);
router.get('/:id/imagenes/:imagenId', getImagenPauta);
router.delete('/:id/imagenes/:imagenId', requerirEdicion, deleteImagenPauta);
router.get('/:id', getPautaById);
router.post('/', requerirEdicion, createPauta);
router.put('/:id', requerirEdicion, updatePauta);
router.delete('/:id', requerirEdicion, deletePauta);

module.exports = router;
