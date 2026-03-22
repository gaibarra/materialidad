import os
import hashlib
from django.utils.text import slugify
from materialidad.models import LegalReferenceSource
import re

def ingest_from_docs():
    paths = [
        "/home/gaibarra/materialidad/docs/fuentes",
        "/home/gaibarra/materialidad/backend/docs/fuentes"
    ]
    
    count = 0
    for base_path in paths:
        if not os.path.exists(base_path):
            print(f"Ruta no encontrada: {base_path}")
            continue
            
        print(f"Buscando conocimiento en {base_path}...")
        
        # Recorremos archivos de texto en la carpeta de fuentes
        for root, dirs, files in os.walk(base_path):
            for file in files:
                if file.endswith((".txt", ".md")):
                    file_path = os.path.join(root, file)
                    print(f"Procesando: {file}")
                    
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            content = f.read()
                    except Exception as e:
                        print(f"Error leyendo {file}: {e}")
                        continue
                        
                    # Dividimos por títulos o secciones para crear referencias granulares
                    # Si el archivo es un dump, intentamos separar por "Articulo" o "Tema" o "TITULO"
                    sections = re.split(r"(?i)(?=\n[ \t]*(?:Articulo|Artículo|Tema|Criterio|TITULO|---))", content)
                    
                    for section in sections:
                        clean_section = section.strip()
                        if len(clean_section) < 50:
                            continue
                            
                        # Extraer un título simple para el resumen (primera línea no vacía)
                        lines = [l.strip() for l in clean_section.split("\n") if l.strip()]
                        title = lines[0][:100] if lines else "Fragmento de Cuaderno"
                        
                        # Generar hash para evitar duplicados
                        content_hash = hashlib.sha256(clean_section.encode()).hexdigest()
                        
                        # Slug único basado en archivo y hash
                        slug_suffix = hashlib.md5(clean_section.encode()).hexdigest()[:8]
                        base_slug = slugify(f"nblm-{file[:20]}-{slug_suffix}")[:250]
                        
                        try:
                            obj, created = LegalReferenceSource.objects.update_or_create(
                                slug=base_slug,
                                defaults={
                                    "ley": f"Cuaderno: {file}",
                                    "resumen": title,
                                    "contenido": clean_section,
                                    "tipo_fuente": "RESOLUCION",
                                    "hash_contenido": content_hash,
                                    "vigencia": "2025"
                                }
                            )
                            count += 1
                        except Exception as e:
                            print(f"Error en fragmento de {file}: {e}")

    print(f"Finalizado: Se han integrado/actualizado {count} fragmentos de conocimiento.")

# Ejecución inmediata para el shell
ingest_from_docs()
