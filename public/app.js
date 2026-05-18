const URL_API = 'http://192.168.100.77:7000/api/dashboard';

async function cargarDashboard() {
    try {
        const respuesta = await fetch(URL_API);
        const datos = await respuesta.json();
        dibujarTabla(datos);
    } catch (error) {
        console.error("Error conectando al servidor:", error);
    }
}

function dibujarTabla(datos) {
    const categoryRow = document.getElementById('categoryRow');
    const evaluationRow = document.getElementById('evaluationRow');
    const studentsBody = document.getElementById('studentsBody');

    // 1. Agrupar las categorías para el encabezado superior
    const categoriasAgrupadas = {};
    datos.evaluaciones.forEach(ev => {
        if (!categoriasAgrupadas[ev.cat_id]) {
            categoriasAgrupadas[ev.cat_id] = { name: ev.category_name, weight: ev.weight_percentage, count: 0 };
        }
        categoriasAgrupadas[ev.cat_id].count++;
    });

    Object.values(categoriasAgrupadas).forEach(cat => {
        // Le indicamos que ocupe varias columnas (colspan)
        categoryRow.innerHTML += `<th colspan="${cat.count}">${cat.name} (${cat.weight}%)</th>`;
    });

    // 2. Dibujar las sub-columnas de cada evaluación (Práctica 1, 2, etc.)
    datos.evaluaciones.forEach(ev => {
        evaluationRow.innerHTML += `<th>${ev.eval_name}</th>`;
    });

    // Columna Final
    categoryRow.innerHTML += `<th rowspan="2">NOTA FINAL</th>`;

    // 3. Dibujar a los Estudiantes y sus celdas de Input
    datos.estudiantes.forEach(est => {
        let fila = `<tr><td class="sticky-col">${est.name}</td>`;

        datos.evaluaciones.forEach(ev => {
            fila += `<td><input type="number" min="0" max="100" placeholder="-" data-student="${est.id}" data-eval="${ev.eval_id}"></td>`;
        });

        fila += `<td><strong style="color: #10b981; font-size: 1.2rem;">0.00</strong></td></tr>`;
        studentsBody.innerHTML += fila;
    });
}

// Ejecutamos la función al abrir la página
cargarDashboard();
