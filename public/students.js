document.addEventListener('DOMContentLoaded', () => {
    requireAuth();

    const groupSelect = document.getElementById('groupSelect');
    const groupHint = document.getElementById('groupHint');
    const studentForm = document.getElementById('studentForm');
    const studentNameInput = document.getElementById('studentName');
    const studentPhoneInput = document.getElementById('studentPhone');
    const studentNotesInput = document.getElementById('studentNotes');
    const studentsList = document.getElementById('studentsList');

    let selectedGroupId = '';

    async function requestJson(url, options) {
        const response = await authFetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'No se pudo completar la accion');
        }

        return data;
    }

    async function loadGroups() {
        const groups = await requestJson('/api/groups');
        groupSelect.innerHTML = '<option value="">Selecciona un grupo</option>';

        groups.forEach((group) => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = `${group.unique_code} - ${group.name}`;
            groupSelect.appendChild(option);
        });

        if (groups.length === 0) {
            groupHint.textContent = 'Primero crea un grupo en Configuracion.';
        }
    }

    async function loadStudents() {
        studentsList.innerHTML = '';

        if (!selectedGroupId) {
            studentsList.innerHTML = '<li class="no-students">Selecciona un grupo para cargar estudiantes.</li>';
            return;
        }

        try {
            const students = await requestJson(`/api/students?group_id=${selectedGroupId}`);

            if (students.length === 0) {
                studentsList.innerHTML = '<li class="no-students">No hay estudiantes matriculados en este grupo.</li>';
                return;
            }

            students.forEach((student) => {
                const li = document.createElement('li');
                li.className = 'student-item';
                li.innerHTML = `
                    <div class="student-info">
                        <div class="student-avatar">${getInitials(student.name)}</div>
                        <div class="student-details">
                            <span class="student-name">${student.name}</span>
                            <span class="student-date">${formatStudentDetail(student)}</span>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-edit" data-id="${student.id}" title="Editar estudiante">Editar</button>
                        <button class="btn-delete" data-id="${student.id}" title="Eliminar estudiante">Eliminar</button>
                    </div>
                `;
                li.dataset.student = JSON.stringify(student);
                studentsList.appendChild(li);
            });

            document.querySelectorAll('.btn-edit').forEach((button) => {
                button.addEventListener('click', handleEditStudent);
            });
            document.querySelectorAll('.btn-delete').forEach((button) => {
                button.addEventListener('click', handleDeleteStudent);
            });
        } catch (error) {
            console.error('Error al cargar estudiantes:', error);
            studentsList.innerHTML = `<li class="no-students">${error.message}</li>`;
        }
    }

    function formatStudentDetail(student) {
        const parts = [];

        if (student.created_at) {
            parts.push(`Matriculado: ${new Date(student.created_at).toLocaleDateString()}`);
        }
        if (student.phone) {
            parts.push(`Cel: ${student.phone}`);
        }
        if (student.assigned_subjects) {
            parts.push(`Materias: ${student.assigned_subjects}`);
        }

        return parts.join(' | ') || 'Sin detalles adicionales';
    }

    function getInitials(name) {
        return name
            .split(' ')
            .map((word) => word[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }

    groupSelect.addEventListener('change', async () => {
        selectedGroupId = groupSelect.value;
        const selectedText = groupSelect.options[groupSelect.selectedIndex]?.textContent || '';
        groupHint.textContent = selectedGroupId
            ? `Grupo seleccionado: ${selectedText}`
            : 'Selecciona un grupo para ver o registrar estudiantes.';
        await loadStudents();
    });

    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = studentNameInput.value.trim();
        if (!name) return;

        if (!selectedGroupId) {
            alert('Primero selecciona un grupo.');
            return;
        }

        try {
            await requestJson('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group_id: selectedGroupId,
                    name,
                    phone: studentPhoneInput.value,
                    notes: studentNotesInput.value
                })
            });

            studentForm.reset();
            await loadStudents();
        } catch (error) {
            alert(error.message);
        }
    });

    async function handleEditStudent(e) {
        const studentItem = e.currentTarget.closest('.student-item');
        const student = JSON.parse(studentItem.dataset.student);

        const name = prompt('Nombre del estudiante:', student.name);
        if (name === null) return;
        const phone = prompt('Celular:', student.phone || '');
        if (phone === null) return;
        const notes = prompt('Observaciones:', student.notes || '');
        if (notes === null) return;
        const status = prompt('Estado (activo, retirado, cambiado):', student.status || 'activo');
        if (status === null) return;

        try {
            await requestJson(`/api/students/${student.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, notes, status })
            });
            await loadStudents();
        } catch (error) {
            alert(error.message);
        }
    }

    async function handleDeleteStudent(e) {
        const studentId = e.currentTarget.getAttribute('data-id');
        const studentItem = e.currentTarget.closest('.student-item');
        const name = studentItem.querySelector('.student-name').textContent;

        if (!confirm(`Eliminar a ${name}? Esta accion borrara sus calificaciones.`)) {
            return;
        }

        try {
            await requestJson(`/api/students/${studentId}`, { method: 'DELETE' });
            studentItem.style.opacity = '0';
            studentItem.style.transform = 'translateX(20px)';
            studentItem.style.transition = 'all 0.3s ease';
            setTimeout(() => {
                loadStudents();
            }, 300);
        } catch (error) {
            alert(error.message);
        }
    }

    loadGroups()
        .then(loadStudents)
        .catch((error) => {
            console.error('Error cargando grupos:', error);
            alert('No se pudo cargar la pantalla de estudiantes.');
        });
});
