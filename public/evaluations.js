document.addEventListener('DOMContentLoaded', () => {
    const evaluationForm = document.getElementById('evaluationForm');
    const evaluationNameInput = document.getElementById('evaluationName');
    const categorySelect = document.getElementById('categorySelect');
    const evaluationsContainer = document.getElementById('evaluationsContainer');

    // Función para obtener y listar las categorías en el <select>
    async function loadCategories() {
        try {
            const response = await fetch('/api/categories');
            const categories = await response.json();

            categorySelect.innerHTML = '<option value="" disabled selected>Selecciona una categoría...</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = `${cat.name} (${cat.weight_percentage}%)`;
                categorySelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error al cargar categorías:', error);
        }
    }

    // Función para obtener y listar las evaluaciones existentes agrupadas por categoría
    async function loadEvaluations() {
        try {
            const response = await fetch('/api/evaluations');
            const evaluations = await response.json();

            evaluationsContainer.innerHTML = '';

            if (evaluations.length === 0) {
                evaluationsContainer.innerHTML = '<p class="no-students">No hay evaluaciones creadas.</p>';
                return;
            }

            // Agrupar evaluaciones por categoría
            const grouped = {};
            evaluations.forEach(ev => {
                if (!grouped[ev.category_name]) {
                    grouped[ev.category_name] = [];
                }
                grouped[ev.category_name].push(ev);
            });

            // Renderizar grupos
            for (const [categoryName, evList] of Object.entries(grouped)) {
                const groupDiv = document.createElement('div');
                groupDiv.style.marginBottom = '1.5rem';

                const groupTitle = document.createElement('h4');
                groupTitle.style.color = 'var(--primary)';
                groupTitle.style.marginBottom = '0.5rem';
                groupTitle.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                groupTitle.style.paddingBottom = '0.2rem';
                groupTitle.textContent = categoryName;
                groupDiv.appendChild(groupTitle);

                const ul = document.createElement('ul');
                ul.style.listStyle = 'none';
                ul.style.padding = '0';

                evList.forEach(ev => {
                    const li = document.createElement('li');
                    li.className = 'student-item'; // Reutilizamos la misma clase CSS de las tarjetas de estudiantes
                    li.innerHTML = `
                        <div class="student-info">
                            <span class="student-name">${ev.name}</span>
                        </div>
                        <button class="btn-delete" data-id="${ev.id}" title="Eliminar evaluación">
                            🗑️
                        </button>
                    `;
                    ul.appendChild(li);
                });

                groupDiv.appendChild(ul);
                evaluationsContainer.appendChild(groupDiv);
            }

            // Asignar eventos de eliminación
            document.querySelectorAll('.btn-delete').forEach(button => {
                button.addEventListener('click', handleDeleteEvaluation);
            });
        } catch (error) {
            console.error('Error al cargar evaluaciones:', error);
        }
    }

    // Registrar nueva evaluación
    evaluationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = evaluationNameInput.value.trim();
        const category_id = categorySelect.value;

        if (!name || !category_id) return;

        try {
            const response = await fetch('/api/evaluations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, category_id })
            });

            const result = await response.json();
            if (result.success) {
                evaluationNameInput.value = '';
                categorySelect.selectedIndex = 0;
                await loadEvaluations();
            } else {
                alert('Error al registrar evaluación: ' + (result.error || 'Ocurrió un error'));
            }
        } catch (error) {
            console.error('Error al agregar evaluación:', error);
        }
    });

    // Eliminar evaluación
    async function handleDeleteEvaluation(e) {
        const id = e.currentTarget.getAttribute('data-id');
        const evItem = e.currentTarget.closest('.student-item');
        const name = evItem.querySelector('.student-name').textContent;

        if (confirm(`¿Estás seguro de que deseas eliminar la evaluación "${name}"? Esta acción borrará permanentemente todas las calificaciones asociadas a ella.`)) {
            try {
                const response = await fetch(`/api/evaluations/${id}`, {
                    method: 'DELETE'
                });
                const result = await response.json();

                if (result.success) {
                    evItem.style.opacity = '0';
                    evItem.style.transform = 'translateX(20px)';
                    evItem.style.transition = 'all 0.3s ease';
                    setTimeout(() => {
                        loadEvaluations();
                    }, 300);
                } else {
                    alert('Error al eliminar: ' + (result.error || 'Ocurrió un error'));
                }
            } catch (error) {
                console.error('Error al eliminar evaluación:', error);
            }
        }
    }

    // Carga inicial
    loadCategories();
    loadEvaluations();
});
