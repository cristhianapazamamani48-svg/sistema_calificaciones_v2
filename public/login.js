const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginMessage = document.getElementById('loginMessage');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginMessage.textContent = 'Verificando credenciales...';

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: emailInput.value.trim(),
                password: passwordInput.value
            })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'No se pudo iniciar sesion');
        }

        window.saveSession(data.token, data.user);
        window.location.href = '/';
    } catch (error) {
        loginMessage.textContent = error.message;
    }
});
