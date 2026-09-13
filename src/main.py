from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3

app = FastAPI(title="Workout Tracker API")

# Configurar CORS para permitir que el frontend web/móvil se conecte sin bloqueos de seguridad
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = 'database/gym.db'

# Función auxiliar para conectar a la base de datos y formatear a diccionario
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Sin esto, SQLite ignora el ON DELETE CASCADE de schema.sql
    # y al borrar un grupo/ejercicio te quedarían filas huérfanas.
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

# Definimos cómo debe ser el paquete de datos cuando guardes un peso desde el móvil
class NuevoRegistro(BaseModel):
    id_ejercicio: int
    peso: float
    repeticiones: int = 8  # Tu valor por defecto automatizado

class NuevoGrupo(BaseModel):
    nombre: str

class NuevoEjercicio(BaseModel):
    nombre: str
    id_grupo: int

@app.get("/grupos")
def obtener_grupos():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM GrupoMuscular ORDER BY nombre ASC")
    grupos = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return grupos

@app.get("/ejercicios/{grupo_id}")
def obtener_ejercicios(grupo_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Ejercicio WHERE id_grupo = ? ORDER BY nombre ASC", (grupo_id,))
    ejercicios = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return ejercicios

@app.get("/progreso/{ejercicio_id}")
def obtener_progreso(ejercicio_id: int):
    conn = get_db()
    cursor = conn.cursor()
    # Traemos el historial ordenado por el más reciente
    # (incluye id_serie para poder borrar una serie concreta desde el frontend)
    cursor.execute(
        "SELECT id_serie, fecha, peso, repeticiones FROM RegistroSerie WHERE id_ejercicio = ? ORDER BY fecha DESC, id_serie DESC",
        (ejercicio_id,)
    )
    progreso = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return progreso

@app.post("/registro")
def guardar_registro(registro: NuevoRegistro):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO RegistroSerie (id_ejercicio, peso, repeticiones) VALUES (?, ?, ?)",
        (registro.id_ejercicio, registro.peso, registro.repeticiones)
    )
    conn.commit()
    nuevo_id = cursor.lastrowid
    conn.close()
    return {"status": "success", "mensaje": "Peso registrado correctamente", "id_serie": nuevo_id}


@app.delete("/registro/{serie_id}")
def eliminar_registro(serie_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM RegistroSerie WHERE id_serie = ?", (serie_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@app.post("/grupos")
def crear_grupo(grupo: NuevoGrupo):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO GrupoMuscular (nombre) VALUES (?)", (grupo.nombre,))
        conn.commit()
        nuevo_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Ya existe un grupo con ese nombre")
    conn.close()
    return {"id_grupo": nuevo_id, "nombre": grupo.nombre}


@app.delete("/grupos/{grupo_id}")
def eliminar_grupo(grupo_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM GrupoMuscular WHERE id_grupo = ?", (grupo_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}


@app.post("/ejercicios")
def crear_ejercicio(ejercicio: NuevoEjercicio):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO Ejercicio (nombre, id_grupo) VALUES (?, ?)",
            (ejercicio.nombre, ejercicio.id_grupo)
        )
        conn.commit()
        nuevo_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=400, detail="Ya existe un ejercicio con ese nombre")
    conn.close()
    return {"id_ejercicio": nuevo_id, "nombre": ejercicio.nombre, "id_grupo": ejercicio.id_grupo}


@app.delete("/ejercicios/{ejercicio_id}")
def eliminar_ejercicio(ejercicio_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM Ejercicio WHERE id_ejercicio = ?", (ejercicio_id,))
    conn.commit()
    conn.close()
    return {"status": "success"}