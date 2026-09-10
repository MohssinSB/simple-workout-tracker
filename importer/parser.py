import sqlite3
import re

DB_PATH = 'database/gym.db'
# Actualizado al nombre de tu archivo
NOTAS_PATH = 'importer/notas.txt'

def procesar_notas():
    conexion = sqlite3.connect(DB_PATH)
    cursor = conexion.cursor()
    
    grupo_actual_id = None

    with open(NOTAS_PATH, 'r', encoding='utf-8') as archivo:
        for linea in archivo:
            linea = linea.strip()
            if not linea:
                continue

            # 1. Detectar el Grupo Muscular (líneas que no son ejercicios)
            # Si no empieza por '*' y no tiene dos puntos, es una categoría
            if not linea.startswith('*') and ':' not in linea:
                # Quitamos el guion si existe (ej: "- PECHO" -> "PECHO") y lo capitalizamos
                nombre_grupo = linea.capitalize()
                
                cursor.execute("INSERT OR IGNORE INTO GrupoMuscular (nombre) VALUES (?)", (nombre_grupo,))
                cursor.execute("SELECT id_grupo FROM GrupoMuscular WHERE nombre = ?", (nombre_grupo,))
                grupo_actual_id = cursor.fetchone()[0]
                continue

            # 2. Detectar el Ejercicio y los datos
            if linea.startswith('*') and ':' in linea and grupo_actual_id:
                # Dividimos "* Presa banca: 80kg" -> ["* Presa banca", " 80kg"]
                partes = linea.split(':', 1)
                
                # Limpiamos el asterisco y estandarizamos el nombre (ej: "Presa Banca")
                nombre_ejercicio = partes[0].lstrip('*').strip().title()
                datos_str = partes[1].strip().lower() 

                cursor.execute("""
                    INSERT OR IGNORE INTO Ejercicio (nombre, id_grupo) 
                    VALUES (?, ?)
                """, (nombre_ejercicio, grupo_actual_id))
                
                cursor.execute("SELECT id_ejercicio FROM Ejercicio WHERE nombre = ?", (nombre_ejercicio,))
                ejercicio_id = cursor.fetchone()[0]

                # 3. Extracción inteligente de peso y repeticiones
                # Busca el primer número decimal o entero (ignora "kg" o "+ extra")
                match_peso = re.search(r'([\d\.]+)', datos_str)
                if match_peso:
                    peso = float(match_peso.group(1))
                    
                    # Busca si has especificado reps explícitas (ej: "80kg x10")
                    # Si no encuentra la "x", aplica tus 8 repeticiones por defecto
                    match_reps = re.search(r'x\s*(\d+)', datos_str)
                    repeticiones = int(match_reps.group(1)) if match_reps else 8
                    
                    cursor.execute("""
                        INSERT INTO RegistroSerie (id_ejercicio, peso, repeticiones)
                        VALUES (?, ?, ?)
                    """, (ejercicio_id, peso, repeticiones))

    conexion.commit()
    conexion.close()
    print("Archivo notas.txt procesado")

if __name__ == '__main__':
    procesar_notas()