const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Al requerir este archivo, Node.js construirá automáticamente tus 11 tablas
const pool = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Una ruta básica de prueba
app.get('/api/estado', (req, res) => {
    res.json({ mensaje: 'Sistema de Calificaciones Operativo' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Calificaciones corriendo en el puerto ${PORT}`);
});

