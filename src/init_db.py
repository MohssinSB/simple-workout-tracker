import sqlite3
import os

# Definimos rutas relativas desde la raíz del proyecto
DB_PATH = 'database/gym.db'
SCHEMA_PATH = 'database/schema.sql'

def inicializar_bd():
    # Si existe una base de datos previa, la borramos para empezar en limpio
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        
    # Conectamos (esto crea el archivo gym.db automáticamente si no existe)
    conexion = sqlite3.connect(DB_PATH)
    cursor = conexion.cursor()
    
    # Leemos el archivo SQL
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as archivo_sql:
        codigo_sql = archivo_sql.read()
        
    # Ejecutamos las sentencias
    cursor.executescript(codigo_sql)
    conexion.commit()
    conexion.close()
    
    print("Base de datos 'gym.db' creada e inicializada correctamente.")

if __name__ == '__main__':
    inicializar_bd()