document.addEventListener('DOMContentLoaded', () => {
    const evaluationForm = document.getElementById('evaluationForm');
    const evaluationNameInput = document.getElementById('evaluationName');
    const categorySelect = document.getElementById('categorySelect');
    const evaluationsContainer = document.getElementById('evaluationsContainer');

    async function loadCategories() {
        try {
            const response = await fetch('/api/categories');
            const categories = await response.json();

            categorySelect.innerHTML = '<option value="" disabled selected>Selecciona una categoria...</option>';
            categories.forEach((cat) => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = `${cat.name} (${cat.weight_percentage}%)`;
                categorySelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error al cargar categorias:', error);
        }
    }

    async function loadEvaluations() {
        try {
            const response = await fetch('/api/evaluations');
            const evaluations = await response.json();

            evaluationsContainer.innerHTML = '';

            if (evaluations.length === 0) {
                evaluationsContainer.innerHTML = '<p class="no-students">No hay evaluaciones creadas.</p>';
                return;
            }

            const grouped = {};
            evaluations.forEach((ev) => {
                if (!grouped[ev.category_name]) {
                    grouped[ev.category_name] = [];
                }
                grouped[ev.category_name].push(ev);
            });

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

                evList.forEach((ev) => {
                    const li = document.createElement('li');
                    li.className = 'student-item';
                    li.innerHTML = `
                        <div class="student-info">
                            <span class="student-name">${ev.name}</span>
                        </div>
                        <button class="btn-delete" data-id="${ev.id}" title="Eliminar evaluacion">Eliminar</button>
                    `;
                    ul.appendChild(li);
                });

                groupDiv.appendChild(ul);
                evaluationsContainer.appendChild(groupDiv);
            }

            document.querySelectorAll('.btn-delete').forEach((button) => {
                button.addEventListener('click', handleDeleteEvaluation);
            });
        } catch (error) {
            console.error('Error al cargar evaluaciones:', error);
        }
    }

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
                alert('Error al registrar evaluacion: ' + (result.error || 'Ocurrio un error'));
            }
        } catch (error) {
            console.error('Error al agregar evaluacion:', error);
        }
    });

    async function handleDeleteEvaluation(e) {
        const id = e.currentTarget.getAttribute('data-id');
        const evItem = e.currentTarget.closest('.student-item');
        const name = evItem.querySelector('.student-name').textContent;

        if (!confirm(`Eliminar la evaluacion "${name}"? Esta accion borrara sus calificaciones asociadas.`)) {
            return;
        }

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
                alert('Error al eliminar: ' + (result.error || 'Ocurrio un error'));
            }
        } catch (error) {
            console.error('Error al eliminar evaluacion:', error);
        }
    }

    loadCategories();
    loadEvaluations();
});
