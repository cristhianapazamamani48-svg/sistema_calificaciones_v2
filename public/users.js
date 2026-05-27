document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = await requireAuth();
    const userForm = document.getElementById('userForm');
    const usersList = document.getElementById('usersList');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const userPassword = document.getElementById('userPassword');
    const userRole = document.getElementById('userRole');

    if (!currentUser || currentUser.role !== 'superadministrador') {
        usersList.innerHTML = '<p class="empty-message">Solo el superadministrador puede administrar usuarios.</p>';
        userForm.querySelectorAll('input, select, button').forEach((element) => {
            element.disabled = true;
        });
        return;
    }

    async function requestJson(url, options) {
        const response = await authFetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'No se pudo completar la accion');
        }

        return data;
    }

    async function loadUsers() {
        const users = await requestJson('/api/users');
        usersList.innerHTML = '';

        users.forEach((user) => {
            const item = document.createElement('div');
            item.className = 'config-item';
            item.innerHTML = `
                <div>
                    <strong>${user.name}</strong>
                    <span>${user.email} | ${user.role}</span>
                </div>
                <div class="item-actions">
                    <button type="button" data-action="edit" data-id="${user.id}" class="btn-edit">Editar</button>
                    <button type="button" data-action="delete" data-id="${user.id}" class="btn-delete">Eliminar</button>
                </div>
            `;

            item.querySelector('[data-action="edit"]').addEventListener('click', () => editUser(user));
            item.querySelector('[data-action="delete"]').addEventListener('click', () => deleteUser(user));
            usersList.appendChild(item);
        });
    }

    async function editUser(user) {
        const name = prompt('Nombre:', user.name);
        if (name === null) return;
        const email = prompt('Correo:', user.email);
        if (email === null) return;
        const role = prompt('Rol: superadministrador, admin o docente', user.role);
        if (role === null) return;
        const password = prompt('Nueva contrasena (dejar vacio para no cambiar):', '');
        if (password === null) return;

        try {
            await requestJson(`/api/users/${user.id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, email, role, password })
            });
            await loadUsers();
        } catch (error) {
            alert(error.message);
        }
    }

    async function deleteUser(user) {
        if (!confirm(`Eliminar usuario ${user.name}?`)) return;

        try {
            await requestJson(`/api/users/${user.id}`, { method: 'DELETE' });
            await loadUsers();
        } catch (error) {
            alert(error.message);
        }
    }

    userForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        try {
            await requestJson('/api/users', {
                method: 'POST',
                body: JSON.stringify({
                    name: userName.value,
                    email: userEmail.value,
                    password: userPassword.value,
                    role: userRole.value
                })
            });
            userForm.reset();
            userRole.value = 'docente';
            await loadUsers();
        } catch (error) {
            alert(error.message);
        }
    });

    loadUsers().catch((error) => {
        usersList.innerHTML = `<p class="empty-message">${error.message}</p>`;
    });
});
