-- 1. Tabla de categorías musculares
CREATE TABLE GrupoMuscular (
    id_grupo INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

-- 2. Tabla del catálogo de ejercicios
CREATE TABLE Ejercicio (
    id_ejercicio INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    id_grupo INTEGER NOT NULL,
    FOREIGN KEY (id_grupo) REFERENCES GrupoMuscular(id_grupo) ON DELETE CASCADE
);

-- 3. Tabla del registro del progreso diario
CREATE TABLE RegistroSerie (
    id_serie INTEGER PRIMARY KEY AUTOINCREMENT,
    id_ejercicio INTEGER NOT NULL,
    fecha DATE DEFAULT (date('now', 'localtime')),
    peso REAL NOT NULL,
    repeticiones INTEGER NOT NULL,
    FOREIGN KEY (id_ejercicio) REFERENCES Ejercicio(id_ejercicio) ON DELETE CASCADE
);