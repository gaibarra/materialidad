import logging
from django.core.management.base import BaseCommand
from materialidad.models import Proveedor
from materialidad.services import trigger_validacion_proveedor

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Ejecuta la re-validación del artículo 69-B para todos los proveedores activos.'

    def handle(self, *args, **options):
        self.stdout.write("Iniciando proceso de re-validación de proveedores (69-B)...")
        proveedores = Proveedor.objects.all()
        total = proveedores.count()
        enviados = 0
        errores = 0

        for proveedor in proveedores.iterator():
            empresa = proveedor.empresas.first()
            if not empresa:
                self.stdout.write(self.style.WARNING(f"Proveedor {proveedor.rfc} sin empresa asociada, omitiendo."))
                continue

            try:
                # Disparar validación (flujo n8n o lógica intera)
                trigger_validacion_proveedor(proveedor=proveedor, empresa=empresa)
                enviados += 1
            except Exception as e:
                msg = f"Error al procesar proveedor {proveedor.rfc}: {str(e)}"
                logger.error(msg)
                self.stdout.write(self.style.ERROR(msg))
                errores += 1

        resumen = f"Re-validación completada. Se dispararon {enviados} envíos exitosos y {errores} errores (de {total} proveedores)."
        
        if errores > 0:
            self.stdout.write(self.style.WARNING(resumen))
        else:
            self.stdout.write(self.style.SUCCESS(resumen))
            
        logger.info(resumen)
