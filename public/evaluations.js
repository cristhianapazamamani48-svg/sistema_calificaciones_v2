document.addEventListener('DOMContentLoaded', () => {
    const assignmentSelect = document.getElementById('assignmentSelect');
    const assignmentHint = document.getElementById('assignmentHint');
    const termForm = document.getElementById('termForm');
    const termName = document.getElementById('termName');
    const officialWeight = document.getElementById('officialWeight');
    const termsList = document.getElementById('termsList');
    const termSelect = document.getElementById('termSelect');
    const termHint = document.getElementById('termHint');
    const categoryForm = document.getElementById('categoryForm');
    const categoryName = document.getElementById('categoryName');
    const categoryWeight = document.getElementById('categoryWeight');
    const categoryTotal = document.getElementById('categoryTotal');
    const categoriesList = document.getElementById('categoriesList');

    let selectedAssignmentId = '';
    let selectedTermId = '';
    let cachedTerms = [];

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
        cachedTerms = [];
        renderTermOptions();

        if (!selectedAssignmentId) {
            termsList.appendChild(emptyMessage('Selecciona una materia del grupo para ver sus parciales.'));
            await loadCategories();
            return;
        }

        try {
            const terms = await requestJson(`/api/terms?course_assignment_id=${selectedAssignmentId}`);
            cachedTerms = terms;
            renderTermOptions();

            if (terms.length === 0) {
                termsList.appendChild(emptyMessage('Todavia no hay parciales creados para esta materia.'));
                await loadCategories();
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

            if (!selectedTermId || !cachedTerms.some((term) => String(term.id) === String(selectedTermId))) {
                selectedTermId = String(cachedTerms[0].id);
                termSelect.value = selectedTermId;
            }

            updateTermHint();
            await loadCategories();
        } catch (error) {
            console.error('Error cargando parciales:', error);
            termsList.appendChild(emptyMessage(error.message));
            await loadCategories();
        }
    }

    function renderTermOptions() {
        termSelect.innerHTML = '<option value="">Selecciona un parcial</option>';

        cachedTerms.forEach((term) => {
            const option = document.createElement('option');
            option.value = term.id;
            option.textContent = `${term.name} (${term.official_weight} pts)`;
            option.dataset.closed = term.is_closed ? '1' : '0';
            termSelect.appendChild(option);
        });

        if (selectedTermId) {
            termSelect.value = selectedTermId;
        }
    }

    function updateTermHint() {
        const term = cachedTerms.find((item) => String(item.id) === String(selectedTermId));
        if (!term) {
            termHint.textContent = 'Selecciona un parcial para configurar sus ponderaciones.';
            return;
        }

        termHint.textContent = `${term.name} | Valor oficial: ${term.official_weight} puntos | Estado: ${term.is_closed ? 'Cerrado' : 'Abierto'}`;
    }

    async function loadCategories() {
        categoriesList.innerHTML = '';
        categoryTotal.textContent = 'Total configurado: 0%';

        if (!selectedTermId) {
            categoriesList.appendChild(emptyMessage('Selecciona un parcial para ver sus categorias.'));
            return;
        }

        try {
            const categories = await requestJson(`/api/categories?term_id=${selectedTermId}`);
            const total = categories.reduce((sum, category) => sum + Number.parseFloat(category.weight_percentage), 0);
            categoryTotal.textContent = `Total configurado: ${total.toFixed(2)}% | Restante: ${(100 - total).toFixed(2)}%`;

            if (categories.length === 0) {
                categoriesList.appendChild(emptyMessage('Todavia no hay categorias para este parcial.'));
                return;
            }

            categories.forEach((category) => {
                const item = document.createElement('article');
                item.className = 'config-item';

                const content = document.createElement('div');
                const title = document.createElement('strong');
                title.textContent = category.name;
                const detail = document.createElement('span');
                detail.textContent = `Peso: ${category.weight_percentage}%`;

                const button = document.createElement('button');
                button.className = 'btn-delete';
                button.type = 'button';
                button.textContent = 'Eliminar';
                button.addEventListener('click', () => deleteCategory(category.id, category.name));

                content.appendChild(title);
                content.appendChild(detail);
                item.appendChild(content);
                item.appendChild(button);
                categoriesList.appendChild(item);
            });
        } catch (error) {
            console.error('Error cargando categorias:', error);
            categoriesList.appendChild(emptyMessage(error.message));
        }
    }

    assignmentSelect.addEventListener('change', async () => {
        selectedAssignmentId = assignmentSelect.value;
        selectedTermId = '';
        const selected = assignmentSelect.options[assignmentSelect.selectedIndex];

        assignmentHint.textContent = selectedAssignmentId
            ? `${selected.dataset.group} | ${selected.dataset.subject} | ${selected.dataset.campus}`
            : 'Selecciona una materia asociada a un grupo.';

        await loadTerms();
    });

    termSelect.addEventListener('change', async () => {
        selectedTermId = termSelect.value;
        updateTermHint();
        await loadCategories();
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

    categoryForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!selectedTermId) {
            alert('Primero selecciona un parcial.');
            return;
        }

        try {
            await requestJson('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    term_id: selectedTermId,
                    name: categoryName.value,
                    weight_percentage: categoryWeight.value
                })
            });

            categoryForm.reset();
            await loadCategories();
        } catch (error) {
            alert(error.message);
        }
    });

    async function deleteCategory(id, name) {
        if (!confirm(`Eliminar la categoria "${name}"? Tambien se eliminaran sus evaluaciones y notas asociadas.`)) {
            return;
        }

        try {
            await requestJson(`/api/categories/${id}`, { method: 'DELETE' });
            await loadCategories();
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
