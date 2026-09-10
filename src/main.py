from fastapi import FastAPI
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
    return conn

# Definimos cómo debe ser el paquete de datos cuando guardes un peso desde el móvil
class NuevoRegistro(BaseModel):
    id_ejercicio: int
    peso: float
    repeticiones: int = 8  # Tu valor por defecto automatizado

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
    cursor.execute("SELECT fecha, peso, repeticiones FROM RegistroSerie WHERE id_ejercicio = ? ORDER BY fecha DESC", (ejercicio_id,))
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
    conn.close()
    return {"status": "success", "mensaje": "Peso registrado correctamente"} 