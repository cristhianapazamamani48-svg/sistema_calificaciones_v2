# Cierre Sistema de Calificaciones V3

## Estado

El sistema queda preparado para operar como aplicacion Node.js desplegada en Railway, con base de datos MySQL y despliegue continuo desde GitHub.

## Produccion

- Backend: Railway, usando la variable `PORT` provista por la plataforma.
- Puerto esperado: `8080`.
- Base de datos: MySQL en Railway.
- Salud del servicio: `GET /api/health`.
- Estado funcional: `GET /api/estado`.

## Variables De Entorno

La aplicacion acepta variables `DB_*` y tambien las variables nativas habituales de Railway para MySQL:

- `MYSQL_URL`
- `MYSQLHOST`
- `MYSQLPORT`
- `MYSQLUSER`
- `MYSQLPASSWORD`
- `MYSQLDATABASE`

Variables recomendadas:

- `PORT=8080`
- `AUTH_SECRET`
- `DB_HOST` o `MYSQLHOST`
- `DB_PORT` o `MYSQLPORT`
- `DB_USER` o `MYSQLUSER`
- `DB_PASSWORD` o `MYSQLPASSWORD`
- `DB_NAME` o `MYSQLDATABASE`

En produccion, `AUTH_SECRET` es obligatorio.

## Flujo De Trabajo

1. Desarrollar y probar cambios en local.
2. Ejecutar `npm test`.
3. Confirmar cambios con Git.
4. Subir a GitHub con `git push`.
5. Railway compila y despliega automaticamente.

## Notas De Seguridad

- La pantalla de login ya no muestra credenciales de prueba.
- La carga de datos demo quedo movida a `POST /api/dev/seed`.
- En produccion, la carga demo solo funciona si `ALLOW_DEMO_SEED=true` y el usuario autenticado es `superadministrador`.
