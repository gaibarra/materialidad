#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script maestro para sincronizar datos del SAT artículos 69-B y 69-B Bis
Descarga, procesa y carga automáticamente en PostgreSQL
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
import os
import sys
import re
import urllib.request
from datetime import datetime
from pathlib import Path

# Configuración
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'sat_69b_db'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

DATA_DIR = '/home/gaibarra/materialidad/sat_data'
PROCESSED_DIR = '/home/gaibarra/materialidad/sat_processed'
LOG_FILE = '/home/gaibarra/materialidad/sync_log.txt'

# URLs de descarga
DOWNLOAD_URLS = {
    '69-B': {
        'Definitivos': 'http://omawww.sat.gob.mx/cifras_sat/Documents/Definitivos.csv',
        'Presuntos': 'http://omawww.sat.gob.mx/cifras_sat/Documents/Presuntos.csv',
        'Desvirtuados': 'http://omawww.sat.gob.mx/cifras_sat/Documents/Desvirtuados.csv',
        'SentenciasFavorables': 'http://omawww.sat.gob.mx/cifras_sat/Documents/SentenciasFavorables.csv',
    },
    '69-B Bis': {
        'ListadoGlobalDefinitivo': 'http://omawww.sat.gob.mx/cifras_sat/Documents/ListadoGlobalDefinitivo.csv',
    }
}

class SATSyncLogger:
    """Logger para registrar el progreso de la sincronización"""
    def __init__(self, log_file):
        self.log_file = log_file
        self.start_time = datetime.now()
        
    def log(self, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_message = f"[{timestamp}] {message}"
        print(log_message)
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(log_message + '\n')
    
    def get_duration(self):
        duration = datetime.now() - self.start_time
        return str(duration).split('.')[0]

# Inicializar logger
logger = SATSyncLogger(LOG_FILE)

def log_separator(title):
    """Imprime un separador con título"""
    logger.log("=" * 70)
    logger.log(f"  {title}")
    logger.log("=" * 70)

def download_file(url, output_path):
    """Descarga un archivo desde una URL"""
    try:
        logger.log(f"Descargando: {os.path.basename(output_path)}")
        urllib.request.urlretrieve(url, output_path)
        file_size = os.path.getsize(output_path) / (1024 * 1024)  # MB
        logger.log(f"✓ Descargado: {file_size:.2f} MB")
        return True
    except Exception as e:
        logger.log(f"✗ Error descargando {url}: {e}")
        return False

def is_valid_rfc(rfc):
    """Valida el formato de un RFC"""
    if not rfc or not isinstance(rfc, str):
        return False
    
    rfc = rfc.strip().upper()
    
    if len(rfc) not in [12, 13]:
        return False
    
    if 'XXXXXXXXXXXX' in rfc or rfc.count('X') > 2:
        return False
    
    pattern = r'^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$'
    return bool(re.match(pattern, rfc))

def process_69b_data():
    """Procesa los datos del artículo 69-B"""
    logger.log("\n>>> Procesando datos del artículo 69-B...")
    
    all_data = []
    status_mapping = {
        'Definitivos.csv': 'definitivo',
        'Presuntos.csv': 'presunto',
        'Desvirtuados.csv': 'desvirtuado',
        'SentenciasFavorables.csv': 'sentencia_favorable'
    }
    
    for filename, status in status_mapping.items():
        filepath = os.path.join(DATA_DIR, filename)
        if not os.path.exists(filepath):
            logger.log(f"  ⚠ Archivo no encontrado: {filename}")
            continue
        
        try:
            logger.log(f"  Procesando {filename}...")
            df = pd.read_csv(filepath, encoding='ISO-8859-1', skiprows=2)
            df.columns = df.columns.str.strip()
            
            if 'RFC' in df.columns and 'Nombre del Contribuyente' in df.columns:
                df_clean = df[['RFC', 'Nombre del Contribuyente', 'Situación del contribuyente']].copy()
                df_clean.columns = ['rfc', 'razon_social', 'situacion']
                df_clean['estatus'] = status
                df_clean['articulo'] = '69-B'
                df_clean['fecha_actualizacion'] = datetime.now().isoformat()
                
                df_clean['rfc'] = df_clean['rfc'].str.strip()
                df_clean['razon_social'] = df_clean['razon_social'].str.strip()
                df_clean = df_clean.dropna(subset=['rfc'])
                df_clean = df_clean[df_clean['rfc'] != '']
                df_clean = df_clean.drop_duplicates(subset=['rfc'], keep='first')
                
                logger.log(f"    ✓ {len(df_clean)} registros procesados")
                all_data.append(df_clean)
        except Exception as e:
            logger.log(f"    ✗ Error procesando {filename}: {e}")
    
    if all_data:
        df_combined = pd.concat(all_data, ignore_index=True)
        df_combined = df_combined.drop_duplicates(subset=['rfc'], keep='first')
        
        output_csv = os.path.join(PROCESSED_DIR, 'sat_69b_combined.csv')
        df_combined.to_csv(output_csv, index=False, encoding='utf-8')
        logger.log(f"  ✓ Total 69-B: {len(df_combined)} registros únicos")
        return df_combined
    
    return None

def process_69bis_data():
    """Procesa los datos del artículo 69-B Bis"""
    logger.log("\n>>> Procesando datos del artículo 69-B Bis...")
    
    filepath = os.path.join(DATA_DIR, 'ListadoGlobalDefinitivo_69Bis.csv')
    if not os.path.exists(filepath):
        logger.log(f"  ⚠ Archivo no encontrado: ListadoGlobalDefinitivo_69Bis.csv")
        return None
    
    try:
        logger.log(f"  Procesando ListadoGlobalDefinitivo_69Bis.csv...")
        df = pd.read_csv(filepath, encoding='ISO-8859-1', skiprows=2)
        df.columns = df.columns.str.strip()
        
        if 'RFC' in df.columns and 'Nombre del Contribuyente' in df.columns:
            df_clean = df[['RFC', 'Nombre del Contribuyente', 'Situación del contribuyente']].copy()
            df_clean.columns = ['rfc', 'razon_social', 'situacion']
            df_clean['estatus'] = 'definitivo'
            df_clean['articulo'] = '69-B Bis'
            df_clean['fecha_actualizacion'] = datetime.now().isoformat()
            
            df_clean['rfc'] = df_clean['rfc'].str.strip()
            df_clean['razon_social'] = df_clean['razon_social'].str.strip()
            df_clean = df_clean.dropna(subset=['rfc'])
            df_clean = df_clean[df_clean['rfc'] != '']
            df_clean = df_clean.drop_duplicates(subset=['rfc'], keep='first')
            
            logger.log(f"    ✓ {len(df_clean)} registros procesados")
            
            output_csv = os.path.join(PROCESSED_DIR, 'sat_69bis_combined.csv')
            df_clean.to_csv(output_csv, index=False, encoding='utf-8')
            return df_clean
    except Exception as e:
        logger.log(f"    ✗ Error procesando 69-B Bis: {e}")
    
    return None

def connect_to_db():
    """Conecta a la base de datos PostgreSQL"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except psycopg2.Error as e:
        logger.log(f"✗ Error conectando a PostgreSQL: {e}")
        sys.exit(1)

def create_tables(conn):
    """Crea las tablas en PostgreSQL"""
    logger.log("\n>>> Creando/actualizando tablas en PostgreSQL...")
    
    try:
        cursor = conn.cursor()
        
        # Tabla para 69-B
        sql_69b = """
        CREATE TABLE IF NOT EXISTS sat_articulo_69b (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            rfc VARCHAR(13) NOT NULL UNIQUE,
            razon_social VARCHAR(500) NOT NULL,
            estatus VARCHAR(50) NOT NULL CHECK (estatus IN ('definitivo', 'presunto', 'desvirtuado', 'sentencia_favorable')),
            situacion VARCHAR(255),
            articulo VARCHAR(20) DEFAULT '69-B',
            fecha_inclusion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_descarga TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fuente VARCHAR(100) DEFAULT 'SAT',
            version_datos VARCHAR(50),
            CONSTRAINT rfc_format CHECK (rfc ~ '^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$')
        );
        
        CREATE INDEX IF NOT EXISTS idx_69b_rfc ON sat_articulo_69b(rfc);
        CREATE INDEX IF NOT EXISTS idx_69b_estatus ON sat_articulo_69b(estatus);
        CREATE INDEX IF NOT EXISTS idx_69b_fecha ON sat_articulo_69b(fecha_actualizacion DESC);
        """
        
        cursor.execute(sql_69b)
        
        # Tabla para 69-B Bis
        sql_69bis = """
        CREATE TABLE IF NOT EXISTS sat_articulo_69b_bis (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            rfc VARCHAR(13) NOT NULL UNIQUE,
            razon_social VARCHAR(500) NOT NULL,
            estatus VARCHAR(50) NOT NULL CHECK (estatus IN ('definitivo', 'presunto', 'desvirtuado')),
            situacion VARCHAR(255),
            articulo VARCHAR(20) DEFAULT '69-B Bis',
            fecha_inclusion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fecha_descarga TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fuente VARCHAR(100) DEFAULT 'SAT',
            version_datos VARCHAR(50),
            CONSTRAINT rfc_format CHECK (rfc ~ '^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$')
        );
        
        CREATE INDEX IF NOT EXISTS idx_69bis_rfc ON sat_articulo_69b_bis(rfc);
        CREATE INDEX IF NOT EXISTS idx_69bis_estatus ON sat_articulo_69b_bis(estatus);
        CREATE INDEX IF NOT EXISTS idx_69bis_fecha ON sat_articulo_69b_bis(fecha_actualizacion DESC);
        """
        
        cursor.execute(sql_69bis)
        
        # Vista combinada
        sql_vista = """
        CREATE OR REPLACE VIEW v_sat_69b_y_69bis AS
        SELECT 
            id, rfc, razon_social, estatus, articulo, 
            fecha_inclusion, fecha_actualizacion
        FROM sat_articulo_69b
        UNION ALL
        SELECT 
            id, rfc, razon_social, estatus, articulo, 
            fecha_inclusion, fecha_actualizacion
        FROM sat_articulo_69b_bis;
        """
        
        cursor.execute(sql_vista)
        
        conn.commit()
        logger.log("  ✓ Tablas creadas/actualizadas correctamente")
        cursor.close()
        
    except psycopg2.Error as e:
        logger.log(f"  ✗ Error creando tablas: {e}")
        conn.rollback()
        sys.exit(1)

def load_data_to_db(conn, df, table_name):
    """Carga datos en la base de datos"""
    if df is None or len(df) == 0:
        logger.log(f"  ⚠ No hay datos para cargar en {table_name}")
        return 0
    
    try:
        cursor = conn.cursor()
        
        # Validar RFCs
        df['rfc_valido'] = df['rfc'].apply(is_valid_rfc)
        registros_invalidos = len(df[~df['rfc_valido']])
        df_validos = df[df['rfc_valido']].copy()
        df_validos = df_validos.drop('rfc_valido', axis=1)
        
        if len(df_validos) == 0:
            logger.log(f"  ⚠ No hay registros con RFC válido en {table_name}")
            return 0
        
        logger.log(f"  Cargando {len(df_validos)} registros en {table_name}...")
        
        # Preparar datos
        records = []
        for _, row in df_validos.iterrows():
            records.append((
                row['rfc'].strip().upper(),
                row['razon_social'].strip(),
                row['estatus'],
                row.get('situacion', None),
                row.get('fecha_actualizacion', datetime.now().isoformat())
            ))
        
        # SQL de inserción
        sql = f"""
            INSERT INTO {table_name} (rfc, razon_social, estatus, situacion, fecha_actualizacion)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (rfc) DO UPDATE SET
                razon_social = EXCLUDED.razon_social,
                estatus = EXCLUDED.estatus,
                situacion = EXCLUDED.situacion,
                fecha_actualizacion = EXCLUDED.fecha_actualizacion
        """
        
        # Insertar en lotes
        batch_size = 1000
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            execute_batch(cursor, sql, batch, page_size=1000)
        
        conn.commit()
        cursor.close()
        logger.log(f"    ✓ {len(df_validos)} registros cargados")
        return len(df_validos)
        
    except Exception as e:
        logger.log(f"    ✗ Error cargando datos: {e}")
        conn.rollback()
        return 0

def get_statistics(conn):
    """Obtiene estadísticas de la base de datos"""
    try:
        cursor = conn.cursor()
        
        logger.log("\n>>> ESTADÍSTICAS FINALES")
        logger.log("-" * 70)
        
        # Estadísticas 69-B
        cursor.execute("SELECT COUNT(*) FROM sat_articulo_69b")
        total_69b = cursor.fetchone()[0]
        logger.log(f"\nArtículo 69-B: {total_69b:,} registros")
        
        cursor.execute("""
            SELECT estatus, COUNT(*) as cantidad
            FROM sat_articulo_69b
            GROUP BY estatus
            ORDER BY cantidad DESC
        """)
        for estatus, cantidad in cursor.fetchall():
            percentage = (cantidad / total_69b * 100) if total_69b > 0 else 0
            logger.log(f"  {estatus:20s}: {cantidad:6,} ({percentage:5.1f}%)")
        
        # Estadísticas 69-B Bis
        cursor.execute("SELECT COUNT(*) FROM sat_articulo_69b_bis")
        total_69bis = cursor.fetchone()[0]
        logger.log(f"\nArtículo 69-B Bis: {total_69bis:,} registros")
        
        cursor.execute("""
            SELECT estatus, COUNT(*) as cantidad
            FROM sat_articulo_69b_bis
            GROUP BY estatus
            ORDER BY cantidad DESC
        """)
        for estatus, cantidad in cursor.fetchall():
            percentage = (cantidad / total_69bis * 100) if total_69bis > 0 else 0
            logger.log(f"  {estatus:20s}: {cantidad:6,} ({percentage:5.1f}%)")
        
        logger.log(f"\nTOTAL GENERAL: {total_69b + total_69bis:,} registros")
        logger.log("-" * 70)
        
        cursor.close()
        
    except psycopg2.Error as e:
        logger.log(f"Error obteniendo estadísticas: {e}")

def main():
    """Función principal"""
    log_separator("SINCRONIZACIÓN SAT 69-B Y 69-B BIS")
    
    # Crear directorios
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    Path(PROCESSED_DIR).mkdir(parents=True, exist_ok=True)
    
    # Paso 1: Descargar archivos
    log_separator("PASO 1: DESCARGANDO ARCHIVOS")
    
    for articulo, urls in DOWNLOAD_URLS.items():
        logger.log(f"\nDescargando {articulo}...")
        for nombre, url in urls.items():
            if articulo == '69-B':
                output_file = os.path.join(DATA_DIR, f"{nombre}.csv")
            else:
                output_file = os.path.join(DATA_DIR, f"ListadoGlobalDefinitivo_69Bis.csv")
            
            download_file(url, output_file)
    
    # Paso 2: Procesar datos
    log_separator("PASO 2: PROCESANDO DATOS")
    
    df_69b = process_69b_data()
    df_69bis = process_69bis_data()
    
    # Paso 3: Crear tablas
    log_separator("PASO 3: CREANDO TABLAS EN POSTGRESQL")
    
    conn = connect_to_db()
    create_tables(conn)
    
    # Paso 4: Cargar datos
    log_separator("PASO 4: CARGANDO DATOS EN POSTGRESQL")
    
    logger.log("\nCargando artículo 69-B...")
    load_data_to_db(conn, df_69b, 'sat_articulo_69b')
    
    logger.log("\nCargando artículo 69-B Bis...")
    load_data_to_db(conn, df_69bis, 'sat_articulo_69b_bis')
    
    # Paso 5: Estadísticas
    get_statistics(conn)
    
    conn.close()
    
    # Resumen final
    duration = logger.get_duration()
    log_separator("SINCRONIZACIÓN COMPLETADA")
    logger.log(f"Duración total: {duration}")
    logger.log(f"Archivo de log: {LOG_FILE}")

if __name__ == '__main__':
    main()
