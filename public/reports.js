const assignmentSelect = document.getElementById('assignmentSelect');
const printButton = document.getElementById('printButton');
const reportOutput = document.getElementById('reportOutput');

async function requestJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'No se pudo completar la accion');
    }

    return data;
}

async function loadAssignments() {
    const assignments = await requestJson('/api/course-assignments');
    assignmentSelect.innerHTML = '<option value="">Selecciona grupo y materia</option>';

    assignments.forEach((assignment) => {
        const option = document.createElement('option');
        option.value = assignment.id;
        option.textContent = `${assignment.unique_code} - ${assignment.subject_name}`;
        assignmentSelect.appendChild(option);
    });

    if (assignments.length === 0) {
        reportOutput.innerHTML = '<div class="report-empty">Primero asocia materias a grupos en Configuracion.</div>';
    }
}

async function loadReport() {
    const assignmentId = assignmentSelect.value;
    if (!assignmentId) {
        reportOutput.innerHTML = '<div class="report-empty">Selecciona un grupo y materia para generar el reporte.</div>';
        return;
    }

    try {
        const report = await requestJson(`/api/reports/course-assignment/${assignmentId}`);
        renderReport(report);
    } catch (error) {
        console.error('Error cargando reporte:', error);
        reportOutput.innerHTML = `<div class="report-empty">${error.message}</div>`;
    }
}

function renderReport(report) {
    const { context, terms, rows } = report;
    const generatedDate = new Date(report.generated_at).toLocaleString();
    const termHeaders = terms.map((term) => `<th>${term.name}<br><span>${term.official_weight} pts</span></th>`).join('');
    const passingScore = Number.parseFloat(context.passing_score);

    const bodyRows = rows.map((row, index) => {
        const termCells = terms.map((term) => {
            const termResult = row.terms.find((item) => item.id === term.id);
            return `<td>${termResult ? termResult.official_score.toFixed(2) : '0.00'}</td>`;
        }).join('');

        const statusClass = row.total_official >= passingScore ? 'approved' : 'risk';
        return `
            <tr>
                <td>${index + 1}</td>
                <td class="report-name">${row.name}</td>
                ${termCells}
                <td><strong>${row.total_official.toFixed(2)}</strong></td>
                <td class="${statusClass}">${row.result}</td>
            </tr>
        `;
    }).join('');

    const approved = rows.filter((row) => row.total_official >= passingScore).length;
    const risk = rows.length - approved;

    reportOutput.innerHTML = `
        <div class="report-header">
            <div>
                <h2>Instituto Tecnologico Infocal</h2>
                <p>Reporte de calificaciones</p>
            </div>
            <div class="report-meta">
                <span>Generado: ${generatedDate}</span>
                <span>Nota minima: ${context.passing_score}</span>
            </div>
        </div>

        <div class="report-context">
            <span><strong>Sede:</strong> ${context.campus_name || '-'}</span>
            <span><strong>Carrera:</strong> ${context.career || '-'}</span>
            <span><strong>Grupo:</strong> ${context.unique_code} - ${context.group_name}</span>
            <span><strong>Materia:</strong> ${context.subject_name}</span>
            <span><strong>Docente:</strong> ${context.teacher_name}</span>
            <span><strong>Gestion:</strong> ${context.academic_year || context.academic_period_name || '-'}</span>
        </div>

        <div class="report-summary">
            <div><strong>${rows.length}</strong><span>Estudiantes</span></div>
            <div><strong>${approved}</strong><span>Aprobados</span></div>
            <div><strong>${risk}</strong><span>En riesgo</span></div>
        </div>

        <table class="report-table">
            <thead>
                <tr>
                    <th>Nro</th>
                    <th>Estudiante</th>
                    ${termHeaders}
                    <th>Total</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>
                ${bodyRows || '<tr><td colspan="5">No hay estudiantes matriculados.</td></tr>'}
            </tbody>
        </table>
    `;
}

assignmentSelect.addEventListener('change', loadReport);
printButton.addEventListener('click', () => window.print());

loadAssignments().catch((error) => {
    console.error('Error cargando asignaciones:', error);
    reportOutput.innerHTML = `<div class="report-empty">${error.message}</div>`;
});
