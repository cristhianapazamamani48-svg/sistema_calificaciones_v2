const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'calificaciones_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initializeDatabase() {
    try {
        console.log('Conectando a la Base de Datos...');
        const connection = await pool.getConnection();

        // 1. Usuarios (Admin o Docente)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'docente') NOT NULL DEFAULT 'docente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 2. Sedes (Ej. El Alto)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS campuses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 3. Materias (Ej. Base de Datos)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 3.5 Periodos Académicos (Para separar el histórico anual)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS academic_periods (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL, 
                start_date DATE,
                end_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 4. Grupos Académicos
        await connection.query(`
            CREATE TABLE IF NOT EXISTS academic_groups (
                id INT AUTO_INCREMENT PRIMARY KEY,
                unique_code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                campus_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE RESTRICT
            )
        `);

        // 5. Estudiantes (Vuelve a ser simple y rápido)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS students (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);


        // 6. Asignaciones de Curso (Docente dicta Materia al Grupo en el Periodo X)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS course_assignments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                teacher_id INT NOT NULL,
                subject_id INT NOT NULL,
                group_id INT NOT NULL,
                academic_period_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE RESTRICT,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT,
                FOREIGN KEY (group_id) REFERENCES academic_groups(id) ON DELETE RESTRICT,
                FOREIGN KEY (academic_period_id) REFERENCES academic_periods(id) ON DELETE RESTRICT
            )
        `);

        // 7. Inscripciones 
        await connection.query(`
            CREATE TABLE IF NOT EXISTS enrollments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                course_assignment_id INT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                FOREIGN KEY (course_assignment_id) REFERENCES course_assignments(id) ON DELETE CASCADE
            )
        `);

        // 8. Parciales (Ej. 1er Parcial, borrado en cascada si se elimina el curso)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS terms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                course_assignment_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (course_assignment_id) REFERENCES course_assignments(id) ON DELETE CASCADE
            )
        `);

        // 9. Categorías de Evaluación (Ej. Prácticas 40%)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS evaluation_categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                term_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                weight_percentage DECIMAL(5,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE
            )
        `);

        // 10. Ítems de Evaluación (Ej. Práctica 1)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS evaluations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                category_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES evaluation_categories(id) ON DELETE CASCADE
            )
        `);

        // 11. Calificaciones (Con restricción UNIQUE contra duplicados)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS grades (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                evaluation_id INT NOT NULL,
                score DECIMAL(5,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
                UNIQUE(student_id, evaluation_id)
            )
        `);

        console.log('¡Estructura de Base de Datos Nivel Producción Creada Exitosamente!');
        connection.release();
    } catch (error) {
        console.error('Error inicializando BD:', error);
    }
}

initializeDatabase();

module.exports = pool;
