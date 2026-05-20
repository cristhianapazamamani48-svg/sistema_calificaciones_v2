document.addEventListener('DOMContentLoaded', () => {
    const studentForm = document.getElementById('studentForm');
    const studentNameInput = document.getElementById('studentName');
    const studentsList = document.getElementById('studentsList');

    async function loadStudents() {
        try {
            const response = await fetch('/api/students');
            const students = await response.json();

            studentsList.innerHTML = '';

            if (students.length === 0) {
                studentsList.innerHTML = '<li class="no-students">No hay estudiantes matriculados en este curso.</li>';
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
                            <span class="student-date">Matriculado: ${new Date(student.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <button class="btn-delete" data-id="${student.id}" title="Eliminar estudiante">Eliminar</button>
                `;
                studentsList.appendChild(li);
            });

            document.querySelectorAll('.btn-delete').forEach((button) => {
                button.addEventListener('click', handleDeleteStudent);
            });
        } catch (error) {
            console.error('Error al cargar estudiantes:', error);
        }
    }

    function getInitials(name) {
        return name
            .split(' ')
            .map((word) => word[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }

    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = studentNameInput.value.trim();
        if (!name) return;

        try {
            const response = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });

            const result = await response.json();
            if (result.success) {
                studentNameInput.value = '';
                await loadStudents();
            } else {
                alert('Error al matricular: ' + (result.error || 'Ocurrio un error'));
            }
        } catch (error) {
            console.error('Error al agregar estudiante:', error);
        }
    });

    async function handleDeleteStudent(e) {
        const studentId = e.currentTarget.getAttribute('data-id');
        const studentItem = e.currentTarget.closest('.student-item');
        const name = studentItem.querySelector('.student-name').textContent;

        if (!confirm(`Eliminar y desmatricular a ${name}? Esta accion borrara sus calificaciones.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/students/${studentId}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (result.success) {
                studentItem.style.opacity = '0';
                studentItem.style.transform = 'translateX(20px)';
                studentItem.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    loadStudents();
                }, 300);
            } else {
                alert('Error al eliminar: ' + (result.error || 'Ocurrio un error'));
            }
        } catch (error) {
            console.error('Error al eliminar estudiante:', error);
        }
    }

    loadStudents();
});
