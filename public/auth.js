(function () {
    const TOKEN_KEY = 'calificaciones_v2_token';
    const USER_KEY = 'calificaciones_v2_user';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function getUser() {
        const rawUser = localStorage.getItem(USER_KEY);
        if (!rawUser) return null;

        try {
            return JSON.parse(rawUser);
        } catch (error) {
            return null;
        }
    }

    function saveSession(token, user) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    function clearSession() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    function goToLogin() {
        const currentPath = window.location.pathname;
        if (!currentPath.endsWith('/login.html')) {
            window.location.href = '/login.html';
        }
    }

    async function authFetch(url, options = {}) {
        const token = getToken();
        const headers = new Headers(options.headers || {});

        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        if (options.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            clearSession();
            goToLogin();
        }

        return response;
    }

    async function requireAuth() {
        const token = getToken();
        if (!token) {
            goToLogin();
            return null;
        }

        try {
            const response = await authFetch('/api/auth/me');
            if (!response.ok) return null;
            const data = await response.json();
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            renderUser(data.user);
            return data.user;
        } catch (error) {
            clearSession();
            goToLogin();
            return null;
        }
    }

    function renderUser(user) {
        const userBadge = document.getElementById('currentUser');
        if (userBadge && user) {
            userBadge.textContent = `${user.name} (${user.role})`;
        }

        document.querySelectorAll('.superadmin-only').forEach((element) => {
            element.style.display = user && user.role === 'superadministrador' ? 'inline-block' : 'none';
        });
    }

    function setupLogout() {
        const logoutLink = document.getElementById('logoutLink');
        if (!logoutLink) return;

        logoutLink.addEventListener('click', (event) => {
            event.preventDefault();
            clearSession();
            window.location.href = '/login.html';
        });
    }

    window.authFetch = authFetch;
    window.requireAuth = requireAuth;
    window.saveSession = saveSession;
    window.clearSession = clearSession;
    window.getCurrentUser = getUser;

    document.addEventListener('DOMContentLoaded', () => {
        renderUser(getUser());
        setupLogout();
    });
})();
