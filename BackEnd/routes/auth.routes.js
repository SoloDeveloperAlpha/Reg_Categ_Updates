const express = require('express');
const { login, register, getUsuarios } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.get('/usuarios', getUsuarios);

module.exports = router;
