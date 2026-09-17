// notasImporter.js
// Puerto directo de importer/parser.py: mismo formato de texto, misma
// lógica de detección de grupo/ejercicio/peso/reps, pero ejecutándose en
// el propio teléfono contra la base de datos local en vez de gym.db en tu PC.
//
// Formato esperado (igual que antes):
//   Pecho
//   * Press Banca: 80kg x10
//   * Press Inclinado: 60kg
//
// Una línea sin '*' y sin ':' se interpreta como grupo muscular.
// Una línea "* Nombre: datos" se interpreta como ejercicio + peso (+ reps opcionales).
// Si no se especifica "xN", se asume 8 repeticiones por defecto.

import { obtenerOCrearGrupo, obtenerOCrearEjercicio, guardarRegistro } from './db.js';

function capitalizar(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function tituloCase(str) {
    return str.replace(/\S+/g, (palabra) =>
        palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase()
    );
}

// Procesa el texto completo pegado por el usuario y devuelve un resumen
// de lo que se importó, para poder mostrarlo en la interfaz.
export async function procesarNotas(textoNotas) {
    const lineas = textoNotas.split('\n');
    let grupoActualId = null;

    let gruposCreados = 0;
    let ejerciciosCreados = 0;
    let seriesImportadas = 0;

    for (const lineaCruda of lineas) {
        const linea = lineaCruda.trim();
        if (!linea) continue;

        // 1. Detectar el Grupo Muscular (líneas que no empiezan por '*' ni tienen ':')
        if (!linea.startsWith('*') && !linea.includes(':')) {
            const nombreGrupo = capitalizar(linea);
            const grupo = await obtenerOCrearGrupo(nombreGrupo);
            grupoActualId = grupo.id_grupo;
            if (grupo.creado) gruposCreados++;
            continue;
        }

        // 2. Detectar el Ejercicio y sus datos
        if (linea.startsWith('*') && linea.includes(':') && grupoActualId) {
            const idxDosPuntos = linea.indexOf(':');
            const parteNombre = linea.slice(0, idxDosPuntos);
            const datosStr = linea.slice(idxDosPuntos + 1).trim().toLowerCase();

            const nombreEjercicio = tituloCase(parteNombre.replace(/^\*/, '').trim());

            const ejercicio = await obtenerOCrearEjercicio(nombreEjercicio, grupoActualId);
            if (ejercicio.creado) ejerciciosCreados++;

            // Extracción del peso (primer número decimal o entero de la línea)
            const matchPeso = datosStr.match(/([\d.]+)/);
            if (matchPeso) {
                const peso = parseFloat(matchPeso[1]);

                // Reps explícitas ("x10") o 8 por defecto
                const matchReps = datosStr.match(/x\s*(\d+)/);
                const repeticiones = matchReps ? parseInt(matchReps[1], 10) : 8;

                await guardarRegistro({ id_ejercicio: ejercicio.id_ejercicio, peso, repeticiones });
                seriesImportadas++;
            }
        }
    }

    return { gruposCreados, ejerciciosCreados, seriesImportadas };
}
