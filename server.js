const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./database');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function parseId(value) {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function requiredText(value) {
    return typeof value === 'string' && value.trim() !== '';
}

async function getDefaultTeacherId(connection) {
    const [rows] = await connection.query(
        "SELECT id FROM users WHERE role IN ('docente', 'superadministrador', 'admin') ORDER BY id ASC LIMIT 1"
    );

    if (rows.length > 0) return rows[0].id;

    const [result] = await connection.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Docente Principal', 'docente@local.test', '1234', 'docente']
    );
    return result.insertId;
}

async function getDefaultAcademicPeriodId(connection) {
    const [rows] = await connection.query('SELECT id FROM academic_periods ORDER BY id ASC LIMIT 1');

    if (rows.length > 0) return rows[0].id;

    const [result] = await connection.query(
        'INSERT INTO academic_periods (name, start_date, end_date) VALUES (?, ?, ?)',
        ['Gestion 2026', '2026-01-01', '2026-12-31']
    );
    return result.insertId;
}

app.get('/api/estado', (req, res) => {
    res.json({ mensaje: 'Sistema de Calificaciones V2 Operativo' });
});

app.get('/api/seed', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();

        const [sede] = await connection.query('INSERT INTO campuses (name) VALUES (?)', ['Sede El Alto']);
        const [materia] = await connection.query('INSERT INTO subjects (name) VALUES (?)', ['Sistemas Informaticos']);
        const [periodo] = await connection.query(
            'INSERT INTO academic_periods (name, start_date, end_date) VALUES (?, ?, ?)',
            ['Gestion 2026', '2026-02-01', '2026-11-30']
        );
        const [docente] = await connection.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            ['Tu Nombre', 'profe@infocal.edu', '1234', 'docente']
        );
        const [grupo] = await connection.query(
            'INSERT INTO academic_groups (unique_code, name, campus_id, career, level_name, shift, class_modality, academic_type, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['SIS-1A', '1er Anio Maniana', sede.insertId, 'Sistemas Informaticos', 'Primer anio', 'Maniana', 'Presencial', 'Anual', 2026]
        );
        const [curso] = await connection.query(
            'INSERT INTO course_assignments (teacher_id, subject_id, group_id, academic_period_id) VALUES (?, ?, ?, ?)',
            [docente.insertId, materia.insertId, grupo.insertId, periodo.insertId]
        );
        const [parcial] = await connection.query(
            'INSERT INTO terms (course_assignment_id, name) VALUES (?, ?)',
            [curso.insertId, '1er Parcial']
        );
        const [catPracticas] = await connection.query(
            'INSERT INTO evaluation_categories (term_id, name, weight_percentage) VALUES (?, ?, ?)',
            [parcial.insertId, 'Practicas', 40.00]
        );
        const [catExamen] = await connection.query(
            'INSERT INTO evaluation_categories (term_id, name, weight_percentage) VALUES (?, ?, ?)',
            [parcial.insertId, 'Examen Final', 60.00]
        );

        await connection.query('INSERT INTO evaluations (category_id, name) VALUES (?, ?)', [catPracticas.insertId, 'Practica 1 - Diagramas']);
        await connection.query('INSERT INTO evaluations (category_id, name) VALUES (?, ?)', [catPracticas.insertId, 'Practica 2 - Codigo']);
        await connection.query('INSERT INTO evaluations (category_id, name) VALUES (?, ?)', [catExamen.insertId, 'Examen Teorico']);

        const nombres = ['Ana Lopez', 'Carlos Perez', 'Maria Gomez', 'Juan Diaz', 'Luis Torres'];
        for (const nombre of nombres) {
            const [estudiante] = await connection.query('INSERT INTO students (name) VALUES (?)', [nombre]);
            await connection.query(
                'INSERT INTO enrollments (student_id, course_assignment_id) VALUES (?, ?)',
                [estudiante.insertId, curso.insertId]
            );
        }

        res.json({ mensaje: 'Datos de prueba creados para Infocal.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/dashboard', async (req, res) => {
    let connection;
    try {
        const courseAssignmentId = parseId(req.query.course_assignment_id);
        const termId = parseId(req.query.term_id);

        if (!courseAssignmentId || !termId) {
            return res.status(400).json({ error: 'Debe seleccionar grupo, materia y parcial' });
        }

        connection = await pool.getConnection();

        const [termRows] = await connection.query(`
            SELECT t.id, t.name, t.official_weight, t.is_closed,
                   ca.id as course_assignment_id, ca.group_id, ca.subject_id,
                   ag.unique_code, ag.name as group_name, s.name as subject_name
            FROM terms t
            JOIN course_assignments ca ON t.course_assignment_id = ca.id
            JOIN academic_groups ag ON ca.group_id = ag.id
            JOIN subjects s ON ca.subject_id = s.id
            WHERE t.id = ? AND ca.id = ?
            LIMIT 1
        `, [termId, courseAssignmentId]);

        if (termRows.length === 0) {
            return res.status(404).json({ error: 'No existe el parcial seleccionado para esa materia' });
        }

        const [estudiantes] = await connection.query(`
            SELECT DISTINCT s.id, s.name
            FROM students s
            JOIN enrollments e ON s.id = e.student_id
            WHERE e.course_assignment_id = ? AND e.is_active = TRUE
            ORDER BY s.name ASC
        `, [courseAssignmentId]);

        const [evaluaciones] = await connection.query(`
            SELECT e.id as eval_id, e.name as eval_name, c.id as cat_id, c.name as category_name, c.weight_percentage
            FROM evaluations e
            JOIN evaluation_categories c ON e.category_id = c.id
            WHERE c.term_id = ?
            ORDER BY c.id ASC, e.id ASC
        `, [termId]);

        const evaluationIds = evaluaciones.map((evaluation) => evaluation.eval_id);
        let notas = [];
        if (evaluationIds.length > 0) {
            const placeholders = evaluationIds.map(() => '?').join(', ');
            const [gradeRows] = await connection.query(
                `SELECT student_id, evaluation_id, score FROM grades WHERE evaluation_id IN (${placeholders})`,
                evaluationIds
            );
            notas = gradeRows;
        }

        res.json({ contexto: termRows[0], estudiantes, evaluaciones, notas });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/grades', async (req, res) => {
    let connection;
    try {
        const studentId = parseId(req.body.student_id);
        const evaluationId = parseId(req.body.evaluation_id);
        const score = Number.parseFloat(req.body.score);

        if (!studentId || !evaluationId || Number.isNaN(score) || score < 0 || score > 100) {
            return res.status(400).json({ error: 'Datos de calificacion invalidos' });
        }

        connection = await pool.getConnection();

        const [evaluationRows] = await connection.query(`
            SELECT e.id, t.is_closed
            FROM evaluations e
            JOIN evaluation_categories ec ON e.category_id = ec.id
            JOIN terms t ON ec.term_id = t.id
            WHERE e.id = ?
            LIMIT 1
        `, [evaluationId]);

        if (evaluationRows.length === 0) {
            return res.status(404).json({ error: 'Evaluacion no encontrada' });
        }
        if (evaluationRows[0].is_closed) {
            return res.status(400).json({ error: 'No se pueden guardar notas en un parcial cerrado' });
        }

        await connection.query(`
            INSERT INTO grades (student_id, evaluation_id, score)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE score = ?
        `, [studentId, evaluationId, score, score]);

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/students', async (req, res) => {
    let connection;
    try {
        const groupId = parseId(req.query.group_id);
        connection = await pool.getConnection();

        let estudiantes;
        if (groupId) {
            [estudiantes] = await connection.query(`
                SELECT s.id, s.name, s.phone, s.notes, s.status,
                       MIN(e.created_at) as created_at,
                       COUNT(DISTINCT e.course_assignment_id) as assigned_subjects
                FROM students s
                JOIN enrollments e ON s.id = e.student_id
                JOIN course_assignments ca ON e.course_assignment_id = ca.id
                WHERE ca.group_id = ? AND e.is_active = TRUE
                GROUP BY s.id, s.name, s.phone, s.notes, s.status
                ORDER BY s.name ASC
            `, [groupId]);
        } else {
            [estudiantes] = await connection.query(`
                SELECT s.id, s.name, s.phone, s.notes, s.status, s.created_at, 0 as assigned_subjects
                FROM students s
                ORDER BY s.name ASC
            `);
        }

        res.json(estudiantes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/students', async (req, res) => {
    let connection;
    try {
        const { name, phone, notes } = req.body;
        const groupId = parseId(req.body.group_id);
        if (!requiredText(name)) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        if (!groupId) {
            return res.status(400).json({ error: 'Debe seleccionar un grupo' });
        }

        connection = await pool.getConnection();

        const [assignments] = await connection.query(
            'SELECT id FROM course_assignments WHERE group_id = ?',
            [groupId]
        );

        if (assignments.length === 0) {
            return res.status(400).json({ error: 'El grupo seleccionado no tiene materias asociadas' });
        }

        const [estudiante] = await connection.query(
            'INSERT INTO students (name, phone, notes) VALUES (?, ?, ?)',
            [name.trim(), phone?.trim() || null, notes?.trim() || null]
        );

        for (const assignment of assignments) {
            await connection.query(
                'INSERT INTO enrollments (student_id, course_assignment_id) VALUES (?, ?)',
                [estudiante.insertId, assignment.id]
            );
        }

        res.json({
            success: true,
            message: 'Estudiante matriculado en el grupo con exito',
            id: estudiante.insertId,
            enrollments_created: assignments.length
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/students/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        const { name, phone, notes, status } = req.body;

        if (!id) return res.status(400).json({ error: 'ID invalido' });
        if (!requiredText(name)) return res.status(400).json({ error: 'El nombre es obligatorio' });

        const allowedStatuses = ['activo', 'retirado', 'cambiado'];
        const studentStatus = allowedStatuses.includes(status) ? status : 'activo';

        connection = await pool.getConnection();
        const [result] = await connection.query(
            'UPDATE students SET name = ?, phone = ?, notes = ?, status = ? WHERE id = ?',
            [name.trim(), phone?.trim() || null, notes?.trim() || null, studentStatus, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado' });
        }

        res.json({ success: true, message: 'Estudiante actualizado con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/students/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalido' });

        connection = await pool.getConnection();
        const [result] = await connection.query('DELETE FROM students WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Estudiante no encontrado' });
        }

        res.json({ success: true, message: 'Estudiante eliminado con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/campuses', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [campuses] = await connection.query('SELECT id, name FROM campuses ORDER BY name ASC');
        res.json(campuses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/subjects', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [subjects] = await connection.query('SELECT id, name, description, created_at FROM subjects ORDER BY name ASC');
        res.json(subjects);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/subjects', async (req, res) => {
    let connection;
    try {
        const { name, description } = req.body;
        if (!requiredText(name)) {
            return res.status(400).json({ error: 'El nombre de la materia es obligatorio' });
        }

        connection = await pool.getConnection();
        const [result] = await connection.query(
            'INSERT INTO subjects (name, description) VALUES (?, ?)',
            [name.trim(), description?.trim() || null]
        );

        res.json({ success: true, id: result.insertId, message: 'Materia creada con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/subjects/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        const { name, description } = req.body;

        if (!id) return res.status(400).json({ error: 'ID invalido' });
        if (!requiredText(name)) return res.status(400).json({ error: 'El nombre de la materia es obligatorio' });

        connection = await pool.getConnection();
        const [result] = await connection.query(
            'UPDATE subjects SET name = ?, description = ? WHERE id = ?',
            [name.trim(), description?.trim() || null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Materia no encontrada' });
        }

        res.json({ success: true, message: 'Materia actualizada con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/subjects/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalido' });

        connection = await pool.getConnection();
        const [result] = await connection.query('DELETE FROM subjects WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Materia no encontrada' });
        }

        res.json({ success: true, message: 'Materia eliminada con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/groups', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [groups] = await connection.query(`
            SELECT ag.id, ag.unique_code, ag.name, ag.campus_id, c.name as campus_name,
                   ag.career, ag.level_name, ag.shift, ag.class_modality, ag.academic_type,
                   ag.academic_year, ag.passing_score, ag.created_at
            FROM academic_groups ag
            JOIN campuses c ON ag.campus_id = c.id
            ORDER BY ag.academic_year DESC, c.name ASC, ag.unique_code ASC
        `);
        res.json(groups);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/groups', async (req, res) => {
    let connection;
    try {
        const {
            unique_code,
            name,
            campus_id,
            career,
            level_name,
            shift,
            class_modality,
            academic_type,
            academic_year,
            passing_score
        } = req.body;

        const campusId = parseId(campus_id);
        const year = Number.parseInt(academic_year, 10);
        const passingScore = Number.parseFloat(passing_score || 61);

        if (!requiredText(unique_code) || !requiredText(name) || !campusId) {
            return res.status(400).json({ error: 'Codigo, nombre y sede son obligatorios' });
        }
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ error: 'Gestion invalida' });
        }
        if (Number.isNaN(passingScore) || passingScore < 0 || passingScore > 100) {
            return res.status(400).json({ error: 'Nota minima invalida' });
        }

        connection = await pool.getConnection();
        const [result] = await connection.query(`
            INSERT INTO academic_groups
                (unique_code, name, campus_id, career, level_name, shift, class_modality, academic_type, academic_year, passing_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            unique_code.trim(),
            name.trim(),
            campusId,
            career?.trim() || null,
            level_name?.trim() || null,
            shift?.trim() || null,
            class_modality?.trim() || null,
            academic_type?.trim() || null,
            year,
            passingScore
        ]);

        res.json({ success: true, id: result.insertId, message: 'Grupo creado con exito' });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ya existe un grupo con ese codigo' });
        }
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/groups/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        const {
            unique_code,
            name,
            campus_id,
            career,
            level_name,
            shift,
            class_modality,
            academic_type,
            academic_year,
            passing_score
        } = req.body;

        const campusId = parseId(campus_id);
        const year = Number.parseInt(academic_year, 10);
        const passingScore = Number.parseFloat(passing_score || 61);

        if (!id) return res.status(400).json({ error: 'ID invalido' });
        if (!requiredText(unique_code) || !requiredText(name) || !campusId) {
            return res.status(400).json({ error: 'Codigo, nombre y sede son obligatorios' });
        }
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ error: 'Gestion invalida' });
        }
        if (Number.isNaN(passingScore) || passingScore < 0 || passingScore > 100) {
            return res.status(400).json({ error: 'Nota minima invalida' });
        }

        connection = await pool.getConnection();
        const [result] = await connection.query(`
            UPDATE academic_groups
            SET unique_code = ?, name = ?, campus_id = ?, career = ?, level_name = ?,
                shift = ?, class_modality = ?, academic_type = ?, academic_year = ?, passing_score = ?
            WHERE id = ?
        `, [
            unique_code.trim(),
            name.trim(),
            campusId,
            career?.trim() || null,
            level_name?.trim() || null,
            shift?.trim() || null,
            class_modality?.trim() || null,
            academic_type?.trim() || null,
            year,
            passingScore,
            id
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        res.json({ success: true, message: 'Grupo actualizado con exito' });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ya existe un grupo con ese codigo' });
        }
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/groups/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalido' });

        connection = await pool.getConnection();
        const [result] = await connection.query('DELETE FROM academic_groups WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        res.json({ success: true, message: 'Grupo eliminado con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/course-assignments', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [assignments] = await connection.query(`
            SELECT ca.id, ca.group_id, ca.subject_id, ca.teacher_id, ca.academic_period_id,
                   ag.unique_code, ag.name as group_name, ag.career, ag.academic_year,
                   c.name as campus_name, s.name as subject_name, u.name as teacher_name,
                   ap.name as academic_period_name
            FROM course_assignments ca
            JOIN academic_groups ag ON ca.group_id = ag.id
            JOIN campuses c ON ag.campus_id = c.id
            JOIN subjects s ON ca.subject_id = s.id
            JOIN users u ON ca.teacher_id = u.id
            JOIN academic_periods ap ON ca.academic_period_id = ap.id
            ORDER BY ag.academic_year DESC, ag.unique_code ASC, s.name ASC
        `);
        res.json(assignments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/course-assignments', async (req, res) => {
    let connection;
    try {
        const groupId = parseId(req.body.group_id);
        const subjectId = parseId(req.body.subject_id);

        if (!groupId || !subjectId) {
            return res.status(400).json({ error: 'Grupo y materia son obligatorios' });
        }

        connection = await pool.getConnection();

        const [existing] = await connection.query(
            'SELECT id FROM course_assignments WHERE group_id = ? AND subject_id = ? LIMIT 1',
            [groupId, subjectId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Esta materia ya esta asociada a ese grupo' });
        }

        const teacherId = await getDefaultTeacherId(connection);
        const academicPeriodId = await getDefaultAcademicPeriodId(connection);

        const [result] = await connection.query(
            'INSERT INTO course_assignments (teacher_id, subject_id, group_id, academic_period_id) VALUES (?, ?, ?, ?)',
            [teacherId, subjectId, groupId, academicPeriodId]
        );

        const [existingStudents] = await connection.query(`
            SELECT DISTINCT e.student_id
            FROM enrollments e
            JOIN course_assignments ca ON e.course_assignment_id = ca.id
            WHERE ca.group_id = ? AND e.is_active = TRUE
        `, [groupId]);

        for (const student of existingStudents) {
            await connection.query(
                'INSERT INTO enrollments (student_id, course_assignment_id) VALUES (?, ?)',
                [student.student_id, result.insertId]
            );
        }

        res.json({
            success: true,
            id: result.insertId,
            message: 'Materia asociada al grupo con exito',
            enrollments_created: existingStudents.length
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/course-assignments/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalido' });

        connection = await pool.getConnection();
        const [result] = await connection.query('DELETE FROM course_assignments WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Asociacion no encontrada' });
        }

        res.json({ success: true, message: 'Asociacion eliminada con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/reports/course-assignment/:id', async (req, res) => {
    let connection;
    try {
        const courseAssignmentId = parseId(req.params.id);
        if (!courseAssignmentId) return res.status(400).json({ error: 'ID invalido' });

        connection = await pool.getConnection();

        const [contextRows] = await connection.query(`
            SELECT ca.id as course_assignment_id, ag.id as group_id, ag.unique_code,
                   ag.name as group_name, ag.career, ag.level_name, ag.shift,
                   ag.class_modality, ag.academic_type, ag.academic_year, ag.passing_score,
                   c.name as campus_name, s.name as subject_name, u.name as teacher_name,
                   ap.name as academic_period_name
            FROM course_assignments ca
            JOIN academic_groups ag ON ca.group_id = ag.id
            JOIN campuses c ON ag.campus_id = c.id
            JOIN subjects s ON ca.subject_id = s.id
            JOIN users u ON ca.teacher_id = u.id
            JOIN academic_periods ap ON ca.academic_period_id = ap.id
            WHERE ca.id = ?
            LIMIT 1
        `, [courseAssignmentId]);

        if (contextRows.length === 0) {
            return res.status(404).json({ error: 'Materia del grupo no encontrada' });
        }

        const context = contextRows[0];

        const [students] = await connection.query(`
            SELECT DISTINCT s.id, s.name, s.phone, s.notes, s.status
            FROM students s
            JOIN enrollments e ON s.id = e.student_id
            WHERE e.course_assignment_id = ? AND e.is_active = TRUE
            ORDER BY s.name ASC
        `, [courseAssignmentId]);

        const [terms] = await connection.query(`
            SELECT id, name, official_weight, is_closed
            FROM terms
            WHERE course_assignment_id = ?
            ORDER BY id ASC
        `, [courseAssignmentId]);

        const [evaluations] = await connection.query(`
            SELECT t.id as term_id, t.name as term_name, t.official_weight,
                   ec.id as category_id, ec.name as category_name, ec.weight_percentage,
                   e.id as evaluation_id, e.name as evaluation_name
            FROM terms t
            JOIN evaluation_categories ec ON ec.term_id = t.id
            JOIN evaluations e ON e.category_id = ec.id
            WHERE t.course_assignment_id = ?
            ORDER BY t.id ASC, ec.id ASC, e.id ASC
        `, [courseAssignmentId]);

        const evaluationIds = evaluations.map((evaluation) => evaluation.evaluation_id);
        let grades = [];
        if (evaluationIds.length > 0) {
            const placeholders = evaluationIds.map(() => '?').join(', ');
            const [gradeRows] = await connection.query(
                `SELECT student_id, evaluation_id, score FROM grades WHERE evaluation_id IN (${placeholders})`,
                evaluationIds
            );
            grades = gradeRows;
        }

        const gradeMap = new Map();
        grades.forEach((grade) => {
            gradeMap.set(`${grade.student_id}_${grade.evaluation_id}`, Number.parseFloat(grade.score));
        });

        const evaluationsByTerm = {};
        evaluations.forEach((evaluation) => {
            if (!evaluationsByTerm[evaluation.term_id]) evaluationsByTerm[evaluation.term_id] = [];
            evaluationsByTerm[evaluation.term_id].push(evaluation);
        });

        const rows = students.map((student) => {
            let totalOfficial = 0;
            const termResults = terms.map((term) => {
                const termEvaluations = evaluationsByTerm[term.id] || [];
                const categories = {};

                termEvaluations.forEach((evaluation) => {
                    if (!categories[evaluation.category_id]) {
                        categories[evaluation.category_id] = {
                            weight: Number.parseFloat(evaluation.weight_percentage),
                            evaluations: []
                        };
                    }
                    categories[evaluation.category_id].evaluations.push(evaluation);
                });

                let internalScore = 0;
                Object.values(categories).forEach((category) => {
                    if (category.evaluations.length === 0) return;

                    const sum = category.evaluations.reduce((total, evaluation) => {
                        const score = gradeMap.get(`${student.id}_${evaluation.evaluation_id}`);
                        return total + (Number.isFinite(score) ? score : 0);
                    }, 0);
                    const average = sum / category.evaluations.length;
                    internalScore += average * (category.weight / 100);
                });

                const officialScore = internalScore * (Number.parseFloat(term.official_weight) / 100);
                totalOfficial += officialScore;

                return {
                    id: term.id,
                    name: term.name,
                    official_weight: Number.parseFloat(term.official_weight),
                    is_closed: Boolean(term.is_closed),
                    internal_score: Number(internalScore.toFixed(2)),
                    official_score: Number(officialScore.toFixed(2))
                };
            });

            const passingScore = Number.parseFloat(context.passing_score);
            return {
                id: student.id,
                name: student.name,
                phone: student.phone,
                status: student.status,
                terms: termResults,
                total_official: Number(totalOfficial.toFixed(2)),
                result: totalOfficial >= passingScore ? 'Aprobado' : 'En riesgo'
            };
        });

        res.json({
            generated_at: new Date().toISOString(),
            context,
            terms,
            rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/reports/term/:id', async (req, res) => {
    let connection;
    try {
        const termId = parseId(req.params.id);
        if (!termId) return res.status(400).json({ error: 'ID invalido' });

        connection = await pool.getConnection();

        const [contextRows] = await connection.query(`
            SELECT t.id as term_id, t.name as term_name, t.official_weight, t.is_closed,
                   ca.id as course_assignment_id, ag.id as group_id, ag.unique_code,
                   ag.name as group_name, ag.career, ag.level_name, ag.shift,
                   ag.class_modality, ag.academic_type, ag.academic_year, ag.passing_score,
                   c.name as campus_name, s.name as subject_name, u.name as teacher_name,
                   ap.name as academic_period_name
            FROM terms t
            JOIN course_assignments ca ON t.course_assignment_id = ca.id
            JOIN academic_groups ag ON ca.group_id = ag.id
            JOIN campuses c ON ag.campus_id = c.id
            JOIN subjects s ON ca.subject_id = s.id
            JOIN users u ON ca.teacher_id = u.id
            JOIN academic_periods ap ON ca.academic_period_id = ap.id
            WHERE t.id = ?
            LIMIT 1
        `, [termId]);

        if (contextRows.length === 0) {
            return res.status(404).json({ error: 'Parcial no encontrado' });
        }

        const context = contextRows[0];

        const [students] = await connection.query(`
            SELECT DISTINCT s.id, s.name, s.phone, s.status
            FROM students s
            JOIN enrollments e ON s.id = e.student_id
            WHERE e.course_assignment_id = ? AND e.is_active = TRUE
            ORDER BY s.name ASC
        `, [context.course_assignment_id]);

        const [evaluations] = await connection.query(`
            SELECT ec.id as category_id, ec.name as category_name, ec.weight_percentage,
                   e.id as evaluation_id, e.name as evaluation_name
            FROM evaluation_categories ec
            JOIN evaluations e ON e.category_id = ec.id
            WHERE ec.term_id = ?
            ORDER BY ec.id ASC, e.id ASC
        `, [termId]);

        const evaluationIds = evaluations.map((evaluation) => evaluation.evaluation_id);
        let grades = [];
        if (evaluationIds.length > 0) {
            const placeholders = evaluationIds.map(() => '?').join(', ');
            const [gradeRows] = await connection.query(
                `SELECT student_id, evaluation_id, score FROM grades WHERE evaluation_id IN (${placeholders})`,
                evaluationIds
            );
            grades = gradeRows;
        }

        const gradeMap = new Map();
        grades.forEach((grade) => {
            gradeMap.set(`${grade.student_id}_${grade.evaluation_id}`, Number.parseFloat(grade.score));
        });

        const categories = {};
        evaluations.forEach((evaluation) => {
            if (!categories[evaluation.category_id]) {
                categories[evaluation.category_id] = {
                    id: evaluation.category_id,
                    name: evaluation.category_name,
                    weight_percentage: Number.parseFloat(evaluation.weight_percentage),
                    evaluations: []
                };
            }
            categories[evaluation.category_id].evaluations.push(evaluation);
        });

        const rows = students.map((student) => {
            let internalScore = 0;
            const gradeValues = {};

            Object.values(categories).forEach((category) => {
                const sum = category.evaluations.reduce((total, evaluation) => {
                    const score = gradeMap.get(`${student.id}_${evaluation.evaluation_id}`);
                    gradeValues[evaluation.evaluation_id] = Number.isFinite(score) ? score : null;
                    return total + (Number.isFinite(score) ? score : 0);
                }, 0);

                const average = category.evaluations.length > 0 ? sum / category.evaluations.length : 0;
                internalScore += average * (category.weight_percentage / 100);
            });

            const officialScore = internalScore * (Number.parseFloat(context.official_weight) / 100);

            return {
                id: student.id,
                name: student.name,
                phone: student.phone,
                grades: gradeValues,
                internal_score: Number(internalScore.toFixed(2)),
                official_score: Number(officialScore.toFixed(2))
            };
        });

        res.json({
            generated_at: new Date().toISOString(),
            context,
            categories: Object.values(categories),
            evaluations,
            rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/terms', async (req, res) => {
    let connection;
    try {
        const courseAssignmentId = parseId(req.query.course_assignment_id);
        if (!courseAssignmentId) {
            return res.status(400).json({ error: 'Debe seleccionar una materia de un grupo' });
        }

        connection = await pool.getConnection();
        const [terms] = await connection.query(`
            SELECT id, course_assignment_id, name, official_weight, is_closed, closed_at, created_at
            FROM terms
            WHERE course_assignment_id = ?
            ORDER BY id ASC
        `, [courseAssignmentId]);

        res.json(terms);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/terms', async (req, res) => {
    let connection;
    try {
        const courseAssignmentId = parseId(req.body.course_assignment_id);
        const officialWeight = Number.parseFloat(req.body.official_weight || 25);
        const { name } = req.body;

        if (!courseAssignmentId || !requiredText(name)) {
            return res.status(400).json({ error: 'Materia del grupo y nombre del parcial son obligatorios' });
        }
        if (Number.isNaN(officialWeight) || officialWeight <= 0 || officialWeight > 100) {
            return res.status(400).json({ error: 'Valor oficial del parcial invalido' });
        }

        connection = await pool.getConnection();
        const [assignment] = await connection.query(
            'SELECT id FROM course_assignments WHERE id = ? LIMIT 1',
            [courseAssignmentId]
        );

        if (assignment.length === 0) {
            return res.status(404).json({ error: 'La materia del grupo no existe' });
        }

        const [result] = await connection.query(
            'INSERT INTO terms (course_assignment_id, name, official_weight) VALUES (?, ?, ?)',
            [courseAssignmentId, name.trim(), officialWeight]
        );

        res.json({ success: true, id: result.insertId, message: 'Parcial creado con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/terms/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        const officialWeight = Number.parseFloat(req.body.official_weight || 25);
        const { name } = req.body;

        if (!id) return res.status(400).json({ error: 'ID invalido' });
        if (!requiredText(name)) return res.status(400).json({ error: 'El nombre del parcial es obligatorio' });
        if (Number.isNaN(officialWeight) || officialWeight <= 0 || officialWeight > 100) {
            return res.status(400).json({ error: 'Valor oficial del parcial invalido' });
        }

        connection = await pool.getConnection();
        const [termRows] = await connection.query('SELECT is_closed FROM terms WHERE id = ? LIMIT 1', [id]);
        if (termRows.length === 0) return res.status(404).json({ error: 'Parcial no encontrado' });
        if (termRows[0].is_closed) return res.status(400).json({ error: 'No se puede editar un parcial cerrado' });

        await connection.query(
            'UPDATE terms SET name = ?, official_weight = ? WHERE id = ?',
            [name.trim(), officialWeight, id]
        );

        res.json({ success: true, message: 'Parcial actualizado con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.patch('/api/terms/:id/status', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        const isClosed = Boolean(req.body.is_closed);
        if (!id) return res.status(400).json({ error: 'ID invalido' });

        connection = await pool.getConnection();

        if (isClosed) {
            const [categorySummary] = await connection.query(`
                SELECT COALESCE(SUM(weight_percentage), 0) as total, COUNT(*) as categories_count
                FROM evaluation_categories
                WHERE term_id = ?
            `, [id]);
            const total = Number.parseFloat(categorySummary[0].total);
            const categoriesCount = Number.parseInt(categorySummary[0].categories_count, 10);

            if (categoriesCount === 0) {
                return res.status(400).json({ error: 'No puedes cerrar un parcial sin categorias' });
            }
            if (Math.abs(total - 100) > 0.0001) {
                return res.status(400).json({ error: `No puedes cerrar el parcial: las ponderaciones suman ${total}% y deben sumar 100%` });
            }

            const [evaluationSummary] = await connection.query(`
                SELECT COUNT(e.id) as evaluations_count
                FROM evaluation_categories ec
                LEFT JOIN evaluations e ON e.category_id = ec.id
                WHERE ec.term_id = ?
            `, [id]);
            const evaluationsCount = Number.parseInt(evaluationSummary[0].evaluations_count, 10);

            if (evaluationsCount === 0) {
                return res.status(400).json({ error: 'No puedes cerrar un parcial sin evaluaciones' });
            }
        }

        const [result] = await connection.query(
            'UPDATE terms SET is_closed = ?, closed_at = ? WHERE id = ?',
            [isClosed, isClosed ? new Date() : null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Parcial no encontrado' });
        }

        res.json({ success: true, message: isClosed ? 'Parcial cerrado' : 'Parcial reabierto' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/terms/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalido' });

        connection = await pool.getConnection();
        const [result] = await connection.query('DELETE FROM terms WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Parcial no encontrado' });
        }

        res.json({ success: true, message: 'Parcial eliminado con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/categories', async (req, res) => {
    let connection;
    try {
        const termId = parseId(req.query.term_id) || 1;
        connection = await pool.getConnection();
        const [categories] = await connection.query(`
            SELECT id, name, weight_percentage
            FROM evaluation_categories
            WHERE term_id = ?
            ORDER BY id ASC
        `, [termId]);
        res.json(categories);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/categories', async (req, res) => {
    let connection;
    try {
        const termId = parseId(req.body.term_id);
        const weight = Number.parseFloat(req.body.weight_percentage);
        const { name } = req.body;

        if (!termId || !requiredText(name)) {
            return res.status(400).json({ error: 'Parcial y nombre de categoria son obligatorios' });
        }
        if (Number.isNaN(weight) || weight <= 0 || weight > 100) {
            return res.status(400).json({ error: 'El porcentaje debe estar entre 0 y 100' });
        }

        connection = await pool.getConnection();

        const [termRows] = await connection.query(
            'SELECT id, is_closed FROM terms WHERE id = ? LIMIT 1',
            [termId]
        );
        if (termRows.length === 0) {
            return res.status(404).json({ error: 'Parcial no encontrado' });
        }
        if (termRows[0].is_closed) {
            return res.status(400).json({ error: 'No se pueden modificar ponderaciones de un parcial cerrado' });
        }

        const [sumRows] = await connection.query(
            'SELECT COALESCE(SUM(weight_percentage), 0) as total FROM evaluation_categories WHERE term_id = ?',
            [termId]
        );
        const currentTotal = Number.parseFloat(sumRows[0].total);

        if (currentTotal + weight > 100.0001) {
            return res.status(400).json({
                error: `La suma de ponderaciones no puede superar 100%. Actualmente tienes ${currentTotal}%`
            });
        }

        const [result] = await connection.query(
            'INSERT INTO evaluation_categories (term_id, name, weight_percentage) VALUES (?, ?, ?)',
            [termId, name.trim(), weight]
        );

        res.json({ success: true, id: result.insertId, message: 'Categoria creada con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/categories/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        const weight = Number.parseFloat(req.body.weight_percentage);
        const { name } = req.body;

        if (!id) return res.status(400).json({ error: 'ID invalido' });
        if (!requiredText(name)) return res.status(400).json({ error: 'El nombre de categoria es obligatorio' });
        if (Number.isNaN(weight) || weight <= 0 || weight > 100) {
            return res.status(400).json({ error: 'El porcentaje debe estar entre 0 y 100' });
        }

        connection = await pool.getConnection();
        const [categoryRows] = await connection.query(`
            SELECT ec.term_id, t.is_closed
            FROM evaluation_categories ec
            JOIN terms t ON ec.term_id = t.id
            WHERE ec.id = ?
            LIMIT 1
        `, [id]);

        if (categoryRows.length === 0) return res.status(404).json({ error: 'Categoria no encontrada' });
        if (categoryRows[0].is_closed) {
            return res.status(400).json({ error: 'No se pueden modificar ponderaciones de un parcial cerrado' });
        }

        const [sumRows] = await connection.query(
            'SELECT COALESCE(SUM(weight_percentage), 0) as total FROM evaluation_categories WHERE term_id = ? AND id <> ?',
            [categoryRows[0].term_id, id]
        );
        const totalWithoutCurrent = Number.parseFloat(sumRows[0].total);
        if (totalWithoutCurrent + weight > 100.0001) {
            return res.status(400).json({
                error: `La suma de ponderaciones no puede superar 100%. Sin esta categoria tienes ${totalWithoutCurrent}%`
            });
        }

        await connection.query(
            'UPDATE evaluation_categories SET name = ?, weight_percentage = ? WHERE id = ?',
            [name.trim(), weight, id]
        );

        res.json({ success: true, message: 'Categoria actualizada con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/categories/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalido' });

        connection = await pool.getConnection();

        const [categoryRows] = await connection.query(`
            SELECT ec.id, t.is_closed
            FROM evaluation_categories ec
            JOIN terms t ON ec.term_id = t.id
            WHERE ec.id = ?
            LIMIT 1
        `, [id]);

        if (categoryRows.length === 0) {
            return res.status(404).json({ error: 'Categoria no encontrada' });
        }
        if (categoryRows[0].is_closed) {
            return res.status(400).json({ error: 'No se pueden modificar ponderaciones de un parcial cerrado' });
        }

        const [result] = await connection.query('DELETE FROM evaluation_categories WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Categoria no encontrada' });
        }

        res.json({ success: true, message: 'Categoria eliminada con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/evaluations', async (req, res) => {
    let connection;
    try {
        const categoryId = parseId(req.query.category_id);
        const termId = parseId(req.query.term_id) || 1;
        connection = await pool.getConnection();

        let evaluaciones;
        if (categoryId) {
            [evaluaciones] = await connection.query(`
                SELECT e.id, e.name, e.category_id, c.name as category_name
                FROM evaluations e
                JOIN evaluation_categories c ON e.category_id = c.id
                WHERE e.category_id = ?
                ORDER BY e.name ASC
            `, [categoryId]);
        } else {
            [evaluaciones] = await connection.query(`
                SELECT e.id, e.name, e.category_id, c.name as category_name
                FROM evaluations e
                JOIN evaluation_categories c ON e.category_id = c.id
                WHERE c.term_id = ?
                ORDER BY c.name ASC, e.name ASC
            `, [termId]);
        }

        res.json(evaluaciones);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/evaluations', async (req, res) => {
    let connection;
    try {
        const categoryId = parseId(req.body.category_id);
        const { name } = req.body;
        if (!categoryId || !requiredText(name)) {
            return res.status(400).json({ error: 'La categoria y el nombre son obligatorios' });
        }

        connection = await pool.getConnection();

        const [categoryRows] = await connection.query(`
            SELECT ec.id, t.is_closed
            FROM evaluation_categories ec
            JOIN terms t ON ec.term_id = t.id
            WHERE ec.id = ?
            LIMIT 1
        `, [categoryId]);

        if (categoryRows.length === 0) {
            return res.status(404).json({ error: 'Categoria no encontrada' });
        }
        if (categoryRows[0].is_closed) {
            return res.status(400).json({ error: 'No se pueden modificar evaluaciones de un parcial cerrado' });
        }

        const [result] = await connection.query(
            'INSERT INTO evaluations (category_id, name) VALUES (?, ?)',
            [categoryId, name.trim()]
        );

        res.json({ success: true, id: result.insertId, message: 'Evaluacion creada con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/evaluations/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        const { name } = req.body;

        if (!id) return res.status(400).json({ error: 'ID invalido' });
        if (!requiredText(name)) return res.status(400).json({ error: 'El nombre es obligatorio' });

        connection = await pool.getConnection();

        const [evaluationRows] = await connection.query(`
            SELECT e.id, t.is_closed
            FROM evaluations e
            JOIN evaluation_categories ec ON e.category_id = ec.id
            JOIN terms t ON ec.term_id = t.id
            WHERE e.id = ?
            LIMIT 1
        `, [id]);

        if (evaluationRows.length === 0) return res.status(404).json({ error: 'Evaluacion no encontrada' });
        if (evaluationRows[0].is_closed) {
            return res.status(400).json({ error: 'No se pueden modificar evaluaciones de un parcial cerrado' });
        }

        await connection.query('UPDATE evaluations SET name = ? WHERE id = ?', [name.trim(), id]);
        res.json({ success: true, message: 'Evaluacion actualizada con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/evaluations/:id', async (req, res) => {
    let connection;
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID invalido' });

        connection = await pool.getConnection();

        const [evaluationRows] = await connection.query(`
            SELECT e.id, t.is_closed
            FROM evaluations e
            JOIN evaluation_categories ec ON e.category_id = ec.id
            JOIN terms t ON ec.term_id = t.id
            WHERE e.id = ?
            LIMIT 1
        `, [id]);

        if (evaluationRows.length === 0) {
            return res.status(404).json({ error: 'Evaluacion no encontrada' });
        }
        if (evaluationRows[0].is_closed) {
            return res.status(400).json({ error: 'No se pueden modificar evaluaciones de un parcial cerrado' });
        }

        const [result] = await connection.query('DELETE FROM evaluations WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Evaluacion no encontrada' });
        }

        res.json({ success: true, message: 'Evaluacion eliminada con exito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor de Calificaciones V2 corriendo en el puerto ${PORT}`);
});
