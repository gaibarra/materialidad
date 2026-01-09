from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import DEFAULT_DB_ALIAS, connections

from tenancy.models import Tenant


class Command(BaseCommand):
    help = "Crea el registro de tenant y opcionalmente la base de datos dedicada"

    def add_arguments(self, parser):
        parser.add_argument("name", help="Nombre descriptivo del tenant")
        parser.add_argument("slug", help="Slug único del tenant")
        parser.add_argument("db_name", help="Nombre de la base de datos dedicada")
        parser.add_argument("db_user", help="Usuario propietario de la base")
        parser.add_argument("db_password", help="Contraseña del usuario propietario")
        parser.add_argument("db_host", help="Host de la base de datos")
        parser.add_argument("db_port", type=int, help="Puerto del servicio")
        parser.add_argument(
            "--create-db",
            action="store_true",
            help="Ejecuta CREATE DATABASE y asignación de permisos",
        )

    def handle(self, *args, **options):
        name = options["name"]
        slug = options["slug"]
        db_name = options["db_name"]
        db_user = options["db_user"]
        db_password = options["db_password"]
        db_host = options["db_host"]
        db_port = options["db_port"]
        create_db = options["create_db"]

        tenant, created = Tenant.objects.get_or_create(
            slug=slug,
            defaults={
                "name": name,
                "db_name": db_name,
                "db_user": db_user,
                "db_password": db_password,
                "db_host": db_host,
                "db_port": db_port,
            },
        )

        if not created:
            raise CommandError("Ya existe un tenant con ese slug")

        if create_db:
            self._ensure_database_exists(db_name, db_user)

        self.stdout.write(self.style.SUCCESS(f"Tenant {tenant.slug} creado"))

    def _ensure_database_exists(self, db_name: str, owner: str) -> None:
        control_connection = connections[DEFAULT_DB_ALIAS]
        quote = control_connection.ops.quote_name
        with control_connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", [db_name])
            exists = cursor.fetchone()
            if not exists:
                cursor.execute(f"CREATE DATABASE {quote(db_name)} OWNER {quote(owner)}")
