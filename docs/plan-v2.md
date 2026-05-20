# Sistema de Calificaciones V2

## Objetivo

Construir un sistema personal de control academico para docente, orientado inicialmente al Instituto Tecnologico Infocal, pero preparado para crecer en futuras versiones.

El sistema reemplazara el manejo manual en Excel por una aplicacion donde el docente pueda crear sus grupos, materias, estudiantes, parciales, ponderaciones, notas y reportes.

## Contexto Inicial

El sistema sera usado inicialmente por un docente de la carrera de Sistemas Informaticos. No sera, por ahora, un sistema institucional abierto a estudiantes.

Las subsedes iniciales son:

- Sede El Alto
- Sede Miraflores
- Sede Ballivian

El docente podra crear sus propios datos academicos porque el sistema puede usarse despues en otros institutos, carreras o contextos.

## Roles

Roles iniciales:

- Superadministrador
- Docente

Al inicio ambos roles pueden tener permisos similares. En etapas posteriores se separaran permisos como administracion de usuarios, eliminacion de datos, auditoria o configuracion global.

## Conceptos Academicos

### Modalidad De Clases

Modalidades previstas:

- Presencial
- Virtual
- Semipresencial

Infocal maneja actualmente presencial y virtual, pero el sistema debe permitir crecer.

### Tipo Academico

Tipos previstos:

- Anual
- Semestral
- Modular

El sistema debe permitir configurar libremente la cantidad de parciales, evaluaciones oficiales o etapas de cada grupo/materia.

Plantillas sugeridas:

- Anual: 4 parciales
- Semestral: 2 parciales y examen final
- Modular: estructura configurable segun duracion del modulo

## Grupos

Un grupo representa una combinacion academica como sede, carrera, nivel, turno, modalidad, gestion y codigo.

Ejemplo:

```text
Codigo: SCA29.1
Sede: Sede El Alto
Carrera: Sistemas Informaticos
Nivel: Primer anio
Turno: Maniana
Modalidad: Presencial
Tipo academico: Anual
Gestion: 2026
```

El codigo del grupo sera escrito manualmente por el docente.

Un grupo puede tener varias materias.

## Materias

El docente podra crear sus propias materias.

Ejemplos:

- Taller de Sistemas Operativos
- Ensamblaje de Computadores
- Base de Datos
- Programacion

Las materias se podran asociar a uno o varios grupos.

## Estudiantes

Por ahora, el registro obligatorio del estudiante sera solamente el nombre completo.

Datos opcionales previstos:

- Celular
- Observaciones
- Estado: activo, retirado, cambiado
- Fecha de registro

Regla inicial:

- Cuando un estudiante se inscribe en un grupo, queda inscrito automaticamente al grupo completo.
- En una version posterior se podra elegir en que materias especificas participa.

## Cambios De Grupo

Un estudiante puede cambiar de grupo, sede, turno o modalidad.

Regla prevista:

- Si el estudiante cambia despues o cerca del cierre de un parcial, mantiene las notas del parcial anterior en el grupo anterior.
- El cambio aplica desde el siguiente parcial.
- El sistema debe conservar historial de cambios.

## Notas Y Parciales

Las notas internas se registran sobre 100 puntos.

En modalidad anual, cada parcial oficial vale 25 puntos. La nota interna se convierte proporcionalmente.

Ejemplo:

```text
Nota interna del parcial: 80 / 100
Valor oficial del parcial: 25
Nota convertida: 20 / 25
```

La nota final anual suma 100 puntos:

```text
Parcial 1: 25
Parcial 2: 25
Parcial 3: 25
Parcial 4: 25
Total: 100
```

La nota minima de aprobacion debe ser configurable. Para Sistemas Informaticos se usara inicialmente 61 puntos.

## Ponderaciones

Cada parcial puede tener sus propias categorias de evaluacion.

Ejemplo:

```text
Parcial 1
Temas: 30%
Practicas: 20%
Investigacion: 10%
Examen: 40%
```

Las categorias internas de un parcial deben sumar 100%.

Dentro de cada categoria pueden existir varias evaluaciones.

Ejemplo:

```text
Temas
- Tema 1
- Tema 2
- Tema 3

Practicas
- Practica 1
- Practica 2
```

El docente decide que categorias y evaluaciones existiran en cada parcial.

## Cierre De Parcial

El sistema debe permitir cerrar y reabrir parciales.

Reglas iniciales:

- Parcial abierto: se pueden editar notas, categorias, ponderaciones y evaluaciones.
- Parcial cerrado: se conserva la nota calculada y convertida.
- Parcial reabierto: se permite corregir notas o estructura si el docente lo necesita.

## Reportes

Los reportes PDF deben tener formato institucional.

Datos esperados en reportes:

- Nombre de Infocal
- Sede
- Carrera
- Grupo
- Codigo del grupo
- Materia
- Docente
- Gestion
- Parcial
- Fecha de generacion
- Tabla de notas
- Categorias y evaluaciones
- Nota parcial interna
- Nota convertida
- Estado aprobado/reprobado cuando corresponda

Reportes deseados:

- Tabla de notas por parcial
- Reporte de aprobados y reprobados
- Reporte final de gestion o periodo
- Reporte de temas/evaluaciones avanzadas

## Orden De Desarrollo Sugerido

1. Documentar reglas funcionales de la V2.
2. Corregir textos y codificacion visual.
3. Crear modelo base para usuarios, sedes, carreras, materias, grupos y asociaciones grupo-materia.
4. Crear pantallas CRUD de materias y grupos.
5. Crear inscripcion de estudiantes por grupo.
6. Crear configuracion de parciales por materia/grupo.
7. Crear categorias de ponderacion y evaluaciones por parcial.
8. Rehacer tabla de notas para que use grupo, materia y parcial seleccionados.
9. Agregar cierre y reapertura de parciales.
10. Agregar reportes PDF institucionales.
11. Agregar autenticacion y permisos mas detallados.

## Decision Actual

La V2 debe dejar de depender de valores fijos como `course_assignment_id = 1` y `term_id = 1`.

El sistema debe avanzar hacia una estructura donde el docente seleccione:

```text
Sede -> Carrera -> Grupo -> Materia -> Parcial
```

y desde ahi pueda configurar ponderaciones, registrar notas y generar reportes.
