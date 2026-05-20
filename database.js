const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'calificaciones_v2_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function columnExists(connection, tableName, columnName) {
    const [rows] = await connection.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
    `, [tableName, columnName]);

    return rows.length > 0;
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
    if (await columnExists(connection, tableName, columnName)) return;
    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

async function seedCampus(connection, name) {
    await connection.query(`
        INSERT INTO campuses (name)
        SELECT ?
        WHERE NOT EXISTS (
            SELECT 1 FROM campuses WHERE name = ?
        )
    `, [name, name]);
}

async function seedDefaultUser(connection) {
    await connection.query(`
        INSERT INTO users (name, email, password, role)
        SELECT 'Docente Principal', 'docente@local.test', '1234', 'docente'
        WHERE NOT EXISTS (
            SELECT 1 FROM users WHERE email = 'docente@local.test'
        )
    `);
}

async function seedDefaultAcademicPeriod(connection) {
    await connection.query(`
        INSERT INTO academic_periods (name, start_date, end_date)
        SELECT 'Gestion 2026', '2026-01-01', '2026-12-31'
        WHERE NOT EXISTS (
            SELECT 1 FROM academic_periods WHERE name = 'Gestion 2026'
        )
    `);
}

async function initializeDatabase() {
    let connection;
    try {
        console.log('Conectando a la base de datos...');
        connection = await pool.getConnection();

        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('superadministrador', 'admin', 'docente') NOT NULL DEFAULT 'docente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS campuses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

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

        await connection.query(`
            CREATE TABLE IF NOT EXISTS academic_groups (
                id INT AUTO_INCREMENT PRIMARY KEY,
                unique_code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                campus_id INT NOT NULL,
                career VARCHAR(255) NULL,
                level_name VARCHAR(100) NULL,
                shift VARCHAR(50) NULL,
                class_modality VARCHAR(50) NULL,
                academic_type VARCHAR(50) NULL,
                academic_year INT NULL,
                passing_score DECIMAL(5,2) NOT NULL DEFAULT 61.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE RESTRICT
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS students (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NULL,
                notes TEXT NULL,
                status ENUM('activo', 'retirado', 'cambiado') NOT NULL DEFAULT 'activo',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

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

        await connection.query(`
            CREATE TABLE IF NOT EXISTS terms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                course_assignment_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                official_weight DECIMAL(5,2) NOT NULL DEFAULT 25.00,
                is_closed BOOLEAN NOT NULL DEFAULT FALSE,
                closed_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (course_assignment_id) REFERENCES course_assignments(id) ON DELETE CASCADE
            )
        `);

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

        await addColumnIfMissing(connection, 'subjects', 'description', 'TEXT NULL');
        await addColumnIfMissing(connection, 'academic_groups', 'career', 'VARCHAR(255) NULL');
        await addColumnIfMissing(connection, 'academic_groups', 'level_name', 'VARCHAR(100) NULL');
        await addColumnIfMissing(connection, 'academic_groups', 'shift', 'VARCHAR(50) NULL');
        await addColumnIfMissing(connection, 'academic_groups', 'class_modality', 'VARCHAR(50) NULL');
        await addColumnIfMissing(connection, 'academic_groups', 'academic_type', 'VARCHAR(50) NULL');
        await addColumnIfMissing(connection, 'academic_groups', 'academic_year', 'INT NULL');
        await addColumnIfMissing(connection, 'academic_groups', 'passing_score', 'DECIMAL(5,2) NOT NULL DEFAULT 61.00');
        await addColumnIfMissing(connection, 'students', 'phone', 'VARCHAR(50) NULL');
        await addColumnIfMissing(connection, 'students', 'notes', 'TEXT NULL');
        await addColumnIfMissing(connection, 'students', 'status', "ENUM('activo', 'retirado', 'cambiado') NOT NULL DEFAULT 'activo'");
        await addColumnIfMissing(connection, 'terms', 'official_weight', 'DECIMAL(5,2) NOT NULL DEFAULT 25.00');
        await addColumnIfMissing(connection, 'terms', 'is_closed', 'BOOLEAN NOT NULL DEFAULT FALSE');
        await addColumnIfMissing(connection, 'terms', 'closed_at', 'TIMESTAMP NULL');

        await seedCampus(connection, 'Sede El Alto');
        await seedCampus(connection, 'Sede Miraflores');
        await seedCampus(connection, 'Sede Ballivian');
        await seedDefaultUser(connection);
        await seedDefaultAcademicPeriod(connection);

        console.log('Estructura de base de datos V2 lista.');
    } catch (error) {
        console.error('Error inicializando BD:', error);
    } finally {
        if (connection) connection.release();
    }
}

initializeDatabase();

module.exports = pool;
