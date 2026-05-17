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


// RUTA SEMILLA: Inyecta datos de prueba para saltar a la fase de Tabla de Notas
app.get('/api/seed', async (req, res) => {
    try {
        const connection = await pool.getConnection();

        // 1. Creamos la institución y materia
        const [sede] = await connection.query('INSERT INTO campuses (name) VALUES (?)', ['Infocal El Alto']);
        const [materia] = await connection.query('INSERT INTO subjects (name) VALUES (?)', ['Sistemas Informáticos']);
        const [periodo] = await connection.query('INSERT INTO academic_periods (name, start_date, end_date) VALUES (?, ?, ?)', ['Gestión 2026', '2026-02-01', '2026-11-30']);

        // 2. Te creamos a ti y a tu clase
        const [docente] = await connection.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Tu Nombre', 'profe@infocal.edu', '1234', 'docente']);
        const [grupo] = await connection.query('INSERT INTO academic_groups (unique_code, name, campus_id) VALUES (?, ?, ?)', ['SIS-1A', '1er Año Mañana', sede.insertId]);
        const [curso] = await connection.query('INSERT INTO course_assignments (teacher_id, subject_id, group_id, academic_period_id) VALUES (?, ?, ?, ?)', [docente.insertId, materia.insertId, grupo.insertId, periodo.insertId]);
        const [parcial] = await connection.query('INSERT INTO terms (course_assignment_id, name) VALUES (?, ?)', [curso.insertId, '1er Parcial']);

        // 3. Creamos las reglas del juego (Prácticas 40%, Examen 60%)
        const [catPracticas] = await connection.query('INSERT INTO evaluation_categories (term_id, name, weight_percentage) VALUES (?, ?, ?)', [parcial.insertId, 'Prácticas', 40.00]);
        const [catExamen] = await connection.query('INSERT INTO evaluation_categories (term_id, name, weight_percentage) VALUES (?, ?, ?)', [parcial.insertId, 'Examen Final', 60.00]);

        await connection.query('INSERT INTO evaluations (category_id, name) VALUES (?, ?)', [catPracticas.insertId, 'Práctica 1 - Diagramas']);
        await connection.query('INSERT INTO evaluations (category_id, name) VALUES (?, ?)', [catPracticas.insertId, 'Práctica 2 - Código']);
        await connection.query('INSERT INTO evaluations (category_id, name) VALUES (?, ?)', [catExamen.insertId, 'Examen Teórico']);

        // 4. Inscribimos a 5 estudiantes
        const nombres = ['Ana López', 'Carlos Perez', 'Maria Gomez', 'Juan Diaz', 'Luis Torres'];
        for (let nombre of nombres) {
            const [estudiante] = await connection.query('INSERT INTO students (name) VALUES (?)', [nombre]);
            await connection.query('INSERT INTO enrollments (student_id, course_assignment_id) VALUES (?, ?)', [estudiante.insertId, curso.insertId]);
        }

        connection.release();
        res.json({ mensaje: '¡Magia realizada! Las 11 tablas han sido llenadas con datos de prueba de Infocal.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// RUTA DASHBOARD: Extrae la materia prima para armar la tabla tipo Excel
app.get('/api/dashboard', async (req, res) => {
    try {
        const connection = await pool.getConnection();

        // 1. Obtenemos a los estudiantes inscritos en este curso
        const [estudiantes] = await connection.query(`
            SELECT s.id, s.name 
            FROM students s
            JOIN enrollments e ON s.id = e.student_id
            WHERE e.course_assignment_id = 1 AND e.is_active = TRUE
        `);

        // 2. Obtenemos las columnas (Evaluaciones y el porcentaje de su categoría)
        const [evaluaciones] = await connection.query(`
            SELECT e.id as eval_id, e.name as eval_name, c.id as cat_id, c.name as category_name, c.weight_percentage 
            FROM evaluations e
            JOIN evaluation_categories c ON e.category_id = c.id
            WHERE c.term_id = 1
        `);

        // 3. Obtenemos las notas que ya existen
        const [notas] = await connection.query('SELECT student_id, evaluation_id, score FROM grades');

        connection.release();

        // Enviamos todo empaquetado al navegador web
        res.json({ estudiantes, evaluaciones, notas });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Calificaciones corriendo en el puerto ${PORT}`);
});

