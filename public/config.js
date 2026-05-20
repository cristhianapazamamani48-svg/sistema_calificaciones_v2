document.addEventListener('DOMContentLoaded', () => {
    const subjectForm = document.getElementById('subjectForm');
    const subjectName = document.getElementById('subjectName');
    const subjectDescription = document.getElementById('subjectDescription');
    const subjectsList = document.getElementById('subjectsList');

    const groupForm = document.getElementById('groupForm');
    const campusSelect = document.getElementById('campusSelect');
    const groupsList = document.getElementById('groupsList');
    const assignmentForm = document.getElementById('assignmentForm');
    const assignmentGroupSelect = document.getElementById('assignmentGroupSelect');
    const assignmentSubjectSelect = document.getElementById('assignmentSubjectSelect');
    const assignmentsList = document.getElementById('assignmentsList');

    let cachedGroups = [];
    let cachedSubjects = [];

    const fields = {
        groupCode: document.getElementById('groupCode'),
        groupName: document.getElementById('groupName'),
        career: document.getElementById('career'),
        levelName: document.getElementById('levelName'),
        shift: document.getElementById('shift'),
        classModality: document.getElementById('classModality'),
        academicType: document.getElementById('academicType'),
        academicYear: document.getElementById('academicYear'),
        passingScore: document.getElementById('passingScore')
    };

    fields.academicYear.value = new Date().getFullYear();

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

    async function loadCampuses() {
        const campuses = await requestJson('/api/campuses');
        campusSelect.innerHTML = '<option value="">Selecciona una sede</option>';

        campuses.forEach((campus) => {
            const option = document.createElement('option');
            option.value = campus.id;
            option.textContent = campus.name;
            campusSelect.appendChild(option);
        });
    }

    async function loadSubjects() {
        const subjects = await requestJson('/api/subjects');
        cachedSubjects = subjects;
        subjectsList.innerHTML = '';
        renderSubjectOptions();

        if (subjects.length === 0) {
            subjectsList.appendChild(emptyMessage('Todavia no hay materias creadas.'));
            return;
        }

        subjects.forEach((subject) => {
            const item = document.createElement('article');
            item.className = 'config-item';

            const content = document.createElement('div');
            const title = document.createElement('strong');
            title.textContent = subject.name;
            const detail = document.createElement('span');
            detail.textContent = subject.description || 'Sin descripcion';

            const button = document.createElement('button');
            button.className = 'btn-delete';
            button.type = 'button';
            button.textContent = 'Eliminar';
            button.addEventListener('click', () => deleteSubject(subject.id, subject.name));

            content.appendChild(title);
            content.appendChild(detail);
            item.appendChild(content);
            item.appendChild(button);
            subjectsList.appendChild(item);
        });
    }

    async function loadGroups() {
        const groups = await requestJson('/api/groups');
        cachedGroups = groups;
        groupsList.innerHTML = '';
        renderGroupOptions();

        if (groups.length === 0) {
            groupsList.appendChild(emptyMessage('Todavia no hay grupos creados.'));
            return;
        }

        groups.forEach((group) => {
            const item = document.createElement('article');
            item.className = 'config-item';

            const content = document.createElement('div');
            const title = document.createElement('strong');
            title.textContent = `${group.unique_code} - ${group.name}`;
            const detail = document.createElement('span');
            detail.textContent = [
                group.campus_name,
                group.career,
                group.level_name,
                group.shift,
                group.class_modality,
                group.academic_type,
                group.academic_year
            ].filter(Boolean).join(' | ');

            const button = document.createElement('button');
            button.className = 'btn-delete';
            button.type = 'button';
            button.textContent = 'Eliminar';
            button.addEventListener('click', () => deleteGroup(group.id, group.unique_code));

            content.appendChild(title);
            content.appendChild(detail);
            item.appendChild(content);
            item.appendChild(button);
            groupsList.appendChild(item);
        });
    }

    function renderGroupOptions() {
        assignmentGroupSelect.innerHTML = '<option value="">Selecciona un grupo</option>';

        cachedGroups.forEach((group) => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = `${group.unique_code} - ${group.name}`;
            assignmentGroupSelect.appendChild(option);
        });
    }

    function renderSubjectOptions() {
        assignmentSubjectSelect.innerHTML = '<option value="">Selecciona una materia</option>';

        cachedSubjects.forEach((subject) => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            assignmentSubjectSelect.appendChild(option);
        });
    }

    async function loadAssignments() {
        const assignments = await requestJson('/api/course-assignments');
        assignmentsList.innerHTML = '';

        if (assignments.length === 0) {
            assignmentsList.appendChild(emptyMessage('Todavia no hay materias asociadas a grupos.'));
            return;
        }

        assignments.forEach((assignment) => {
            const item = document.createElement('article');
            item.className = 'config-item';

            const content = document.createElement('div');
            const title = document.createElement('strong');
            title.textContent = `${assignment.unique_code} - ${assignment.subject_name}`;
            const detail = document.createElement('span');
            detail.textContent = [
                assignment.group_name,
                assignment.campus_name,
                assignment.career,
                assignment.academic_year,
                assignment.academic_period_name
            ].filter(Boolean).join(' | ');

            const button = document.createElement('button');
            button.className = 'btn-delete';
            button.type = 'button';
            button.textContent = 'Eliminar';
            button.addEventListener('click', () => deleteAssignment(assignment.id, assignment.unique_code, assignment.subject_name));

            content.appendChild(title);
            content.appendChild(detail);
            item.appendChild(content);
            item.appendChild(button);
            assignmentsList.appendChild(item);
        });
    }

    async function deleteSubject(id, name) {
        if (!confirm(`Eliminar la materia "${name}"?`)) return;

        try {
            await requestJson(`/api/subjects/${id}`, { method: 'DELETE' });
            await loadSubjects();
            await loadAssignments();
        } catch (error) {
            alert(error.message);
        }
    }

    async function deleteGroup(id, code) {
        if (!confirm(`Eliminar el grupo "${code}"?`)) return;

        try {
            await requestJson(`/api/groups/${id}`, { method: 'DELETE' });
            await loadGroups();
            await loadAssignments();
        } catch (error) {
            alert(error.message);
        }
    }

    async function deleteAssignment(id, groupCode, subjectName) {
        if (!confirm(`Quitar "${subjectName}" del grupo "${groupCode}"?`)) return;

        try {
            await requestJson(`/api/course-assignments/${id}`, { method: 'DELETE' });
            await loadAssignments();
        } catch (error) {
            alert(error.message);
        }
    }

    subjectForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
            await requestJson('/api/subjects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: subjectName.value,
                    description: subjectDescription.value
                })
            });

            subjectForm.reset();
            await loadSubjects();
            await loadAssignments();
        } catch (error) {
            alert(error.message);
        }
    });

    groupForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
            await requestJson('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unique_code: fields.groupCode.value,
                    name: fields.groupName.value,
                    campus_id: campusSelect.value,
                    career: fields.career.value,
                    level_name: fields.levelName.value,
                    shift: fields.shift.value,
                    class_modality: fields.classModality.value,
                    academic_type: fields.academicType.value,
                    academic_year: fields.academicYear.value,
                    passing_score: fields.passingScore.value
                })
            });

            groupForm.reset();
            fields.academicYear.value = new Date().getFullYear();
            fields.passingScore.value = 61;
            await loadGroups();
            await loadAssignments();
        } catch (error) {
            alert(error.message);
        }
    });

    assignmentForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
            await requestJson('/api/course-assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group_id: assignmentGroupSelect.value,
                    subject_id: assignmentSubjectSelect.value
                })
            });

            assignmentForm.reset();
            await loadAssignments();
        } catch (error) {
            alert(error.message);
        }
    });

    Promise.all([loadCampuses(), loadSubjects(), loadGroups()])
        .then(loadAssignments)
        .catch((error) => {
        console.error('Error cargando configuracion:', error);
        alert('No se pudo cargar la configuracion inicial.');
    });
});
