const URL_API_DASHBOARD = '/api/dashboard';
const URL_API_GRADES = '/api/grades';

const assignmentSelect = document.getElementById('assignmentSelect');
const termSelect = document.getElementById('termSelect');
const contextTitle = document.getElementById('contextTitle');
const contextStatus = document.getElementById('contextStatus');

let datosGlobales = null;
let selectedAssignmentId = '';
let selectedTermId = '';

async function requestJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'No se pudo completar la accion');
    }

    return data;
}

async function cargarAsignaciones() {
    const assignments = await requestJson('/api/course-assignments');
    assignmentSelect.innerHTML = '<option value="">Selecciona grupo y materia</option>';

    assignments.forEach((assignment) => {
        const option = document.createElement('option');
        option.value = assignment.id;
        option.textContent = `${assignment.unique_code} - ${assignment.subject_name}`;
        option.dataset.group = assignment.group_name;
        option.dataset.subject = assignment.subject_name;
        option.dataset.campus = assignment.campus_name;
        assignmentSelect.appendChild(option);
    });

    if (assignments.length === 0) {
        contextStatus.textContent = 'Primero asocia una materia a un grupo en Configuracion.';
    }
}

async function cargarParciales() {
    selectedAssignmentId = assignmentSelect.value;
    selectedTermId = '';
    termSelect.innerHTML = '<option value="">Selecciona parcial</option>';
    limpiarTabla('Selecciona un parcial para cargar notas.');

    if (!selectedAssignmentId) {
        contextTitle.textContent = 'Selecciona una materia';
        contextStatus.textContent = 'La tabla se cargara con los estudiantes y evaluaciones configuradas.';
        return;
    }

    const selected = assignmentSelect.options[assignmentSelect.selectedIndex];
    contextTitle.textContent = `${selected.dataset.group} | ${selected.dataset.subject}`;
    contextStatus.textContent = selected.dataset.campus || '';

    const terms = await requestJson(`/api/terms?course_assignment_id=${selectedAssignmentId}`);
    terms.forEach((term) => {
        const option = document.createElement('option');
        option.value = term.id;
        option.textContent = `${term.name} (${term.official_weight} pts)`;
        option.dataset.closed = term.is_closed ? '1' : '0';
        termSelect.appendChild(option);
    });

    if (terms.length === 0) {
        limpiarTabla('Esta materia todavia no tiene parciales creados.');
    }
}

async function cargarDashboard() {
    selectedTermId = termSelect.value;

    if (!selectedAssignmentId || !selectedTermId) {
        limpiarTabla('Selecciona una materia y parcial para cargar notas.');
        return;
    }

    try {
        datosGlobales = await requestJson(`${URL_API_DASHBOARD}?course_assignment_id=${selectedAssignmentId}&term_id=${selectedTermId}`);
        dibujarTabla(datosGlobales);
        llenarNotasExistentes(datosGlobales.notas);
        calcularTodasLasNotas();
        actualizarContexto(datosGlobales.contexto);
    } catch (error) {
        console.error('Error conectando al servidor:', error);
        limpiarTabla(error.message);
    }
}

function actualizarContexto(contexto) {
    const estado = contexto.is_closed ? 'Cerrado' : 'Abierto';
    contextTitle.textContent = `${contexto.unique_code} | ${contexto.subject_name} | ${contexto.name}`;
    contextStatus.textContent = `Valor oficial: ${contexto.official_weight} puntos | Estado: ${estado}`;
}

function limpiarTabla(message) {
    const categoryRow = document.getElementById('categoryRow');
    const evaluationRow = document.getElementById('evaluationRow');
    const studentsBody = document.getElementById('studentsBody');

    categoryRow.innerHTML = '<th rowspan="2" class="sticky-col">Estudiante</th>';
    evaluationRow.innerHTML = '';
    studentsBody.innerHTML = `<tr><td class="empty-table" colspan="2">${message}</td></tr>`;
}

function dibujarTabla(datos) {
    const categoryRow = document.getElementById('categoryRow');
    const evaluationRow = document.getElementById('evaluationRow');
    const studentsBody = document.getElementById('studentsBody');

    categoryRow.innerHTML = '<th rowspan="2" class="sticky-col">Estudiante</th>';
    evaluationRow.innerHTML = '';
    studentsBody.innerHTML = '';

    if (datos.estudiantes.length === 0) {
        studentsBody.innerHTML = '<tr><td class="empty-table" colspan="2">No hay estudiantes matriculados en esta materia.</td></tr>';
        return;
    }

    if (datos.evaluaciones.length === 0) {
        studentsBody.innerHTML = '<tr><td class="empty-table" colspan="2">Este parcial no tiene evaluaciones configuradas.</td></tr>';
        return;
    }

    const categoriasAgrupadas = {};
    datos.evaluaciones.forEach((ev) => {
        if (!categoriasAgrupadas[ev.cat_id]) {
            categoriasAgrupadas[ev.cat_id] = { name: ev.category_name, weight: ev.weight_percentage, count: 0 };
        }
        categoriasAgrupadas[ev.cat_id].count++;
    });

    Object.values(categoriasAgrupadas).forEach((cat) => {
        categoryRow.innerHTML += `<th colspan="${cat.count}">${cat.name} (${cat.weight}%)</th>`;
    });

    datos.evaluaciones.forEach((ev) => {
        evaluationRow.innerHTML += `<th>${ev.eval_name}</th>`;
    });
    categoryRow.innerHTML += '<th rowspan="2">NOTA 100</th>';
    categoryRow.innerHTML += `<th rowspan="2">NOTA ${datos.contexto.official_weight}</th>`;

    datos.estudiantes.forEach((est) => {
        let fila = `<tr><td class="sticky-col">${est.name}</td>`;

        datos.evaluaciones.forEach((ev) => {
            const disabled = datos.contexto.is_closed ? 'disabled' : '';
            fila += `<td>
                <input type="number" min="0" max="100" placeholder="-"
                       id="input_${est.id}_${ev.eval_id}"
                       data-student="${est.id}"
                       data-eval="${ev.eval_id}"
                       onchange="guardarYCalcular(this)" ${disabled}>
            </td>`;
        });

        fila += `<td><strong id="final_${est.id}" class="grade-final">0.00</strong></td>`;
        fila += `<td><strong id="official_${est.id}" class="grade-official">0.00</strong></td></tr>`;
        studentsBody.innerHTML += fila;
    });
}

function llenarNotasExistentes(notas) {
    notas.forEach((nota) => {
        const input = document.getElementById(`input_${nota.student_id}_${nota.evaluation_id}`);
        if (input) {
            input.value = nota.score;
        }
    });
}

async function guardarYCalcular(inputElement) {
    const student_id = inputElement.getAttribute('data-student');
    const evaluation_id = inputElement.getAttribute('data-eval');
    let score = inputElement.value;

    if (score === '') score = 0;
    if (score > 100) { score = 100; inputElement.value = 100; }
    if (score < 0) { score = 0; inputElement.value = 0; }

    await fetch(URL_API_GRADES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id, evaluation_id, score })
    });

    calcularNotaEstudiante(student_id);
}

function calcularTodasLasNotas() {
    datosGlobales.estudiantes.forEach((est) => {
        calcularNotaEstudiante(est.id);
    });
}

function calcularNotaEstudiante(studentId) {
    let notaFinal = 0;

    const categorias = {};
    datosGlobales.evaluaciones.forEach((ev) => {
        if (!categorias[ev.cat_id]) {
            categorias[ev.cat_id] = { weight: ev.weight_percentage, evalIds: [] };
        }
        categorias[ev.cat_id].evalIds.push(ev.eval_id);
    });

    Object.values(categorias).forEach((cat) => {
        let sumaNotas = 0;

        cat.evalIds.forEach((evalId) => {
            const input = document.getElementById(`input_${studentId}_${evalId}`);
            let nota = parseFloat(input.value);
            if (isNaN(nota)) nota = 0;
            sumaNotas += nota;
        });

        const promedioCategoria = sumaNotas / cat.evalIds.length;
        const valorPonderado = promedioCategoria * (cat.weight / 100);
        notaFinal += valorPonderado;
    });

    const notaOficial = notaFinal * (Number.parseFloat(datosGlobales.contexto.official_weight) / 100);
    document.getElementById(`final_${studentId}`).innerText = notaFinal.toFixed(2);
    document.getElementById(`official_${studentId}`).innerText = notaOficial.toFixed(2);
}

assignmentSelect.addEventListener('change', () => {
    cargarParciales().catch((error) => {
        console.error('Error cargando parciales:', error);
        limpiarTabla(error.message);
    });
});

termSelect.addEventListener('change', () => {
    cargarDashboard();
});

cargarAsignaciones().catch((error) => {
    console.error('Error cargando asignaciones:', error);
    limpiarTabla(error.message);
});
