from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
import psycopg2.extras
import os
from typing import Optional

app = FastAPI(
    title="API SAT 69-B y 69-B Bis",
    description="API para consultar el estatus de contribuyentes en las listas negras del SAT",
    version="2.0.0"
)

# Configurar CORS para permitir peticiones desde el frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, reemplazar con el dominio del frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración BD
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'sat_69b_db'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

def get_db_connection():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except psycopg2.Error as e:
        print(f"Error conectando a PostgreSQL: {e}")
        return None

@app.get("/")
def read_root():
    return {
        "nombre": "API SAT Artículos 69-B y 69-B Bis",
        "version": "2.0",
        "endpoints": [
            "/consultar-rfc/{rfc}",
            "/estadisticas",
            "/estadisticas/{articulo}",
            "/listar/{articulo}"
        ]
    }

@app.get("/consultar-rfc/{rfc}")
def consultar_rfc(rfc: str, articulo: Optional[str] = Query(None, description="Filtrar por '69-B' o '69-B Bis'")):
    if not rfc or len(rfc) < 12 or len(rfc) > 13:
        raise HTTPException(status_code=400, detail="Formato de RFC inválido")
    
    rfc = rfc.upper().strip()
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a la base de datos")
    
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        query = """
        SELECT rfc, razon_social, estatus, articulo, fecha_inclusion, fecha_actualizacion 
        FROM v_sat_69b_y_69bis 
        WHERE rfc = %s
        """
        params = [rfc]
        
        if articulo:
            query += " AND articulo = %s"
            params.append(articulo)
            
        cursor.execute(query, tuple(params))
        resultados = cursor.fetchall()
        
        # Obtener la fecha más reciente de actualización de la BD
        cursor.execute("""
            SELECT GREATEST(
                (SELECT MAX(fecha_actualizacion) FROM sat_articulo_69b),
                (SELECT MAX(fecha_actualizacion) FROM sat_articulo_69b_bis)
            ) AS fecha_actualizacion_bd
        """)
        row_fecha = cursor.fetchone()
        fecha_actualizacion_bd = None
        if row_fecha and row_fecha.get('fecha_actualizacion_bd'):
            fecha_actualizacion_bd = row_fecha['fecha_actualizacion_bd'].isoformat()
        
        # Formatear fechas para JSON serialization
        for row in resultados:
            if row.get('fecha_inclusion'):
                row['fecha_inclusion'] = row['fecha_inclusion'].isoformat()
            if row.get('fecha_actualizacion'):
                row['fecha_actualizacion'] = row['fecha_actualizacion'].isoformat()
                
        return {
            "rfc": rfc,
            "encontrado": len(resultados) > 0,
            "resultados": resultados,
            "fecha_actualizacion_bd": fecha_actualizacion_bd
        }
        
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.get("/estadisticas")
def estadisticas_generales():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a la base de datos")
        
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # 69-B
        cursor.execute("SELECT estatus, COUNT(*) as count FROM sat_articulo_69b GROUP BY estatus")
        stats_69b_raw = cursor.fetchall()
        stats_69b = {row['estatus']: row['count'] for row in stats_69b_raw}
        total_69b = sum(stats_69b.values())
        
        # 69-B Bis
        cursor.execute("SELECT estatus, COUNT(*) as count FROM sat_articulo_69b_bis GROUP BY estatus")
        stats_69bis_raw = cursor.fetchall()
        stats_69bis = {row['estatus']: row['count'] for row in stats_69bis_raw}
        total_69bis = sum(stats_69bis.values())
        
        return {
            "69-B": stats_69b,
            "69-B Bis": stats_69bis,
            "total_69b": total_69b,
            "total_69bis": total_69bis,
            "total_general": total_69b + total_69bis
        }
        
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.get("/estadisticas/{articulo}")
def estadisticas_articulo(articulo: str):
    if articulo not in ["69-B", "69-B Bis"]:
        raise HTTPException(status_code=400, detail="Artículo no soportado (usar '69-B' o '69-B Bis')")
        
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a la base de datos")
        
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        table = "sat_articulo_69b" if articulo == "69-B" else "sat_articulo_69b_bis"
        
        cursor.execute(f"SELECT estatus, COUNT(*) as count FROM {table} GROUP BY estatus")
        stats_raw = cursor.fetchall()
        stats = {row['estatus']: row['count'] for row in stats_raw}
        total = sum(stats.values())
        
        return {
            "articulo": articulo,
            "estadisticas": stats,
            "total": total
        }
        
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

@app.get("/listar/{articulo}")
def listar_contribuyentes(articulo: str, estatus: Optional[str] = None, limit: int = 100):
    if articulo not in ["69-B", "69-B Bis"]:
        raise HTTPException(status_code=400, detail="Artículo no soportado (usar '69-B' o '69-B Bis')")
        
    limit = min(limit, 1000)
    
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Error de conexión a la base de datos")
        
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        table = "sat_articulo_69b" if articulo == "69-B" else "sat_articulo_69b_bis"
        
        query = f"SELECT rfc, razon_social, estatus, situacion, fecha_actualizacion FROM {table}"
        params = []
        
        if estatus:
            query += " WHERE estatus = %s"
            params.append(estatus)
            
        query += " ORDER BY fecha_actualizacion DESC LIMIT %s"
        params.append(limit)
        
        cursor.execute(query, tuple(params))
        resultados = cursor.fetchall()
        
        for row in resultados:
            if row.get('fecha_actualizacion'):
                row['fecha_actualizacion'] = row['fecha_actualizacion'].isoformat()
                
        return resultados
        
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
