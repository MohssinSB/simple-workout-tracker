// db.js
// Capa de acceso a datos local. Sustituye por completo a main.py: cada función
// de aquí es el equivalente directo de un endpoint que ya conoces.

import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'gym';
const CURRENT_SCHEMA_VERSION = 1;

// Mismo contenido que database/schema.sql — se ejecuta una sola vez,
// la primera vez que se abre la app en un teléfono nuevo.
const SCHEMA_SQL = `
CREATE TABLE GrupoMuscular (
    id_grupo INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE Ejercicio (
    id_ejercicio INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    id_grupo INTEGER NOT NULL,
    FOREIGN KEY (id_grupo) REFERENCES GrupoMuscular(id_grupo) ON DELETE CASCADE
);

CREATE TABLE RegistroSerie (
    id_serie INTEGER PRIMARY KEY AUTOINCREMENT,
    id_ejercicio INTEGER NOT NULL,
    fecha DATE DEFAULT (date('now', 'localtime')),
    peso REAL NOT NULL,
    repeticiones INTEGER NOT NULL,
    FOREIGN KEY (id_ejercicio) REFERENCES Ejercicio(id_ejercicio) ON DELETE CASCADE
);
`;

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db = null;

// ---------- Arranque e inicialización ----------
// Equivalente a init_db.py, pero pensado para ejecutarse en cada apertura
// de la app (crea la base de datos solo si no existe) en vez de una vez
// manualmente desde la terminal.
export async function initDatabase() {
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
    if (isConn) {
        db = await sqlite.retrieveConnection(DB_NAME, false);
    } else {
        db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', CURRENT_SCHEMA_VERSION, false);
    }
    await db.open();

    const versionResult = await db.query('PRAGMA user_version;');
    const currentVersion = versionResult.values?.[0]?.user_version ?? 0;

    if (currentVersion === 0) {
        // Base de datos recién creada en este teléfono: crear todo el esquema.
        await db.execute(SCHEMA_SQL);
        await db.execute(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION};`);
    } else if (currentVersion < CURRENT_SCHEMA_VERSION) {
        // Aquí es donde, en el futuro, añadiremos ALTER TABLE / nuevas
        // tablas para pasar de una versión antigua del esquema a la nueva
        // SIN borrar lo que la persona ya tenía registrado. Por ejemplo:
        // if (currentVersion < 2) { await db.execute('ALTER TABLE ...'); }
        await db.execute(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION};`);
    }

    // SQLite ignora ON DELETE CASCADE si no se activa esto en cada conexión.
    await db.execute('PRAGMA foreign_keys = ON;');
}

// ---------- Helper de errores ----------
// sqlite3.IntegrityError en Python se traduce aquí en un mensaje de error
// de JS que contiene "UNIQUE constraint failed".
function esErrorDeDuplicado(error) {
    return String(error?.message || error).includes('UNIQUE constraint failed');
}

// ---------- Grupos musculares ----------
// Equivalente a GET /grupos
export async function obtenerGrupos() {
    const res = await db.query('SELECT * FROM GrupoMuscular ORDER BY nombre ASC;');
    return res.values || [];
}

// Equivalente a POST /grupos
export async function crearGrupo(nombre) {
    try {
        const res = await db.run('INSERT INTO GrupoMuscular (nombre) VALUES (?);', [nombre]);
        return { id_grupo: res.changes.lastId, nombre };
    } catch (e) {
        if (esErrorDeDuplicado(e)) throw new Error('Ya existe un grupo con ese nombre');
        throw e;
    }
}

// Equivalente a DELETE /grupos/{grupo_id}
export async function eliminarGrupo(grupoId) {
    await db.run('DELETE FROM GrupoMuscular WHERE id_grupo = ?;', [grupoId]);
}

// ---------- Ejercicios ----------
// Equivalente a GET /ejercicios/{grupo_id}
export async function obtenerEjercicios(grupoId) {
    const res = await db.query(
        'SELECT * FROM Ejercicio WHERE id_grupo = ? ORDER BY nombre ASC;',
        [grupoId]
    );
    return res.values || [];
}

// Equivalente a POST /ejercicios
export async function crearEjercicio(nombre, idGrupo) {
    try {
        const res = await db.run(
            'INSERT INTO Ejercicio (nombre, id_grupo) VALUES (?, ?);',
            [nombre, idGrupo]
        );
        return { id_ejercicio: res.changes.lastId, nombre, id_grupo: idGrupo };
    } catch (e) {
        if (esErrorDeDuplicado(e)) throw new Error('Ya existe un ejercicio con ese nombre');
        throw e;
    }
}

// Equivalente a DELETE /ejercicios/{ejercicio_id}
export async function eliminarEjercicio(ejercicioId) {
    await db.run('DELETE FROM Ejercicio WHERE id_ejercicio = ?;', [ejercicioId]);
}

// ---------- Series registradas (peso + reps) ----------
// Equivalente a GET /progreso/{ejercicio_id}
export async function obtenerProgreso(ejercicioId) {
    const res = await db.query(
        'SELECT id_serie, fecha, peso, repeticiones FROM RegistroSerie WHERE id_ejercicio = ? ORDER BY fecha DESC, id_serie DESC;',
        [ejercicioId]
    );
    return res.values || [];
}

// Equivalente a POST /registro
export async function guardarRegistro({ id_ejercicio, peso, repeticiones = 8 }) {
    const res = await db.run(
        'INSERT INTO RegistroSerie (id_ejercicio, peso, repeticiones) VALUES (?, ?, ?);',
        [id_ejercicio, peso, repeticiones]
    );
    return { id_serie: res.changes.lastId };
}

// Equivalente a DELETE /registro/{serie_id}
export async function eliminarRegistro(serieId) {
    await db.run('DELETE FROM RegistroSerie WHERE id_serie = ?;', [serieId]);
}
