document.addEventListener('DOMContentLoaded', () => {
    const assignmentSelect = document.getElementById('assignmentSelect');
    const assignmentHint = document.getElementById('assignmentHint');
    const termForm = document.getElementById('termForm');
    const termName = document.getElementById('termName');
    const officialWeight = document.getElementById('officialWeight');
    const termsList = document.getElementById('termsList');

    let selectedAssignmentId = '';

    async function requestJson(url, options) {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'No se pudo completar la accion');
        }

        return data;
    }

    function emptyMessage(text) {
        const p = document.createElement('p');
        p.className = 'empty-message';
        p.textContent = text;
        return p;
    }

    async function loadAssignments() {
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
            assignmentHint.textContent = 'Primero asocia una materia a un grupo en Configuracion.';
        }
    }

    async function loadTerms() {
        termsList.innerHTML = '';

        if (!selectedAssignmentId) {
            termsList.appendChild(emptyMessage('Selecciona una materia del grupo para ver sus parciales.'));
            return;
        }

        try {
            const terms = await requestJson(`/api/terms?course_assignment_id=${selectedAssignmentId}`);

            if (terms.length === 0) {
                termsList.appendChild(emptyMessage('Todavia no hay parciales creados para esta materia.'));
                return;
            }

            terms.forEach((term) => {
                const item = document.createElement('article');
                item.className = 'config-item';

                const content = document.createElement('div');
                const title = document.createElement('strong');
                title.textContent = term.name;

                const detail = document.createElement('span');
                const status = term.is_closed ? 'Cerrado' : 'Abierto';
                detail.textContent = `Valor oficial: ${term.official_weight} puntos | Estado: ${status}`;

                const actions = document.createElement('div');
                actions.className = 'item-actions';

                const toggleButton = document.createElement('button');
                toggleButton.className = term.is_closed ? 'btn-secondary' : 'btn-primary-soft';
                toggleButton.type = 'button';
                toggleButton.textContent = term.is_closed ? 'Reabrir' : 'Cerrar';
                toggleButton.addEventListener('click', () => toggleTermStatus(term.id, !term.is_closed));

                const deleteButton = document.createElement('button');
                deleteButton.className = 'btn-delete';
                deleteButton.type = 'button';
                deleteButton.textContent = 'Eliminar';
                deleteButton.addEventListener('click', () => deleteTerm(term.id, term.name));

                actions.appendChild(toggleButton);
                actions.appendChild(deleteButton);
                content.appendChild(title);
                content.appendChild(detail);
                item.appendChild(content);
                item.appendChild(actions);
                termsList.appendChild(item);
            });
        } catch (error) {
            console.error('Error cargando parciales:', error);
            termsList.appendChild(emptyMessage(error.message));
        }
    }

    assignmentSelect.addEventListener('change', async () => {
        selectedAssignmentId = assignmentSelect.value;
        const selected = assignmentSelect.options[assignmentSelect.selectedIndex];

        assignmentHint.textContent = selectedAssignmentId
            ? `${selected.dataset.group} | ${selected.dataset.subject} | ${selected.dataset.campus}`
            : 'Selecciona una materia asociada a un grupo.';

        await loadTerms();
    });

    termForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!selectedAssignmentId) {
            alert('Primero selecciona una materia del grupo.');
            return;
        }

        try {
            await requestJson('/api/terms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    course_assignment_id: selectedAssignmentId,
                    name: termName.value,
                    official_weight: officialWeight.value
                })
            });

            termForm.reset();
            officialWeight.value = 25;
            await loadTerms();
        } catch (error) {
            alert(error.message);
        }
    });

    async function toggleTermStatus(id, isClosed) {
        const action = isClosed ? 'cerrar' : 'reabrir';
        if (!confirm(`Deseas ${action} este parcial?`)) return;

        try {
            await requestJson(`/api/terms/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_closed: isClosed })
            });
            await loadTerms();
        } catch (error) {
            alert(error.message);
        }
    }

    async function deleteTerm(id, name) {
        if (!confirm(`Eliminar el parcial "${name}"? Tambien se eliminaran sus categorias, evaluaciones y notas asociadas.`)) {
            return;
        }

        try {
            await requestJson(`/api/terms/${id}`, { method: 'DELETE' });
            await loadTerms();
        } catch (error) {
            alert(error.message);
        }
    }

    loadAssignments()
        .then(loadTerms)
        .catch((error) => {
            console.error('Error cargando evaluaciones:', error);
            alert('No se pudo cargar la pantalla de evaluaciones.');
        });
});
