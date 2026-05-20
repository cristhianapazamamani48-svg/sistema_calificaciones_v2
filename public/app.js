const URL_API_DASHBOARD = '/api/dashboard';
const URL_API_GRADES = '/api/grades';

let datosGlobales = null;

async function cargarDashboard() {
    try {
        const respuesta = await fetch(URL_API_DASHBOARD);
        datosGlobales = await respuesta.json();
        dibujarTabla(datosGlobales);
        llenarNotasExistentes(datosGlobales.notas);
        calcularTodasLasNotas();
    } catch (error) {
        console.error('Error conectando al servidor:', error);
    }
}

function dibujarTabla(datos) {
    const categoryRow = document.getElementById('categoryRow');
    const evaluationRow = document.getElementById('evaluationRow');
    const studentsBody = document.getElementById('studentsBody');

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
    categoryRow.innerHTML += '<th rowspan="2">NOTA FINAL</th>';

    datos.estudiantes.forEach((est) => {
        let fila = `<tr><td class="sticky-col">${est.name}</td>`;

        datos.evaluaciones.forEach((ev) => {
            fila += `<td>
                <input type="number" min="0" max="100" placeholder="-"
                       id="input_${est.id}_${ev.eval_id}"
                       data-student="${est.id}"
                       data-eval="${ev.eval_id}"
                       onchange="guardarYCalcular(this)">
            </td>`;
        });

        fila += `<td><strong id="final_${est.id}" style="color: #10b981; font-size: 1.2rem;">0.00</strong></td></tr>`;
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

    document.getElementById(`final_${studentId}`).innerText = notaFinal.toFixed(2);
}

cargarDashboard();
