from __future__ import annotations

from .context import TenantContext


class TenantDatabaseRouter:
    tenant_apps = {"materialidad"}
    shared_models = {
        "materialidad.legalconsultation",
        "materialidad.legalreferencesource",
    }

    def _tenant_alias(self):
        return TenantContext.get_current_db_alias()

    def _is_shared_model(self, model) -> bool:
        if not model:
            return False
        return model._meta.label_lower in self.shared_models

    def _use_tenant_db(self, model) -> bool:
        if not model:
            return False
        if model._meta.app_label not in self.tenant_apps:
            return False
        return not self._is_shared_model(model)

    def db_for_read(self, model, **hints):
        if self._use_tenant_db(model):
            return self._tenant_alias() or "default"
        return "default"

    def db_for_write(self, model, **hints):
        if self._use_tenant_db(model):
            return self._tenant_alias() or "default"
        return "default"

    def allow_relation(self, obj1, obj2, **_hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        label = None
        if app_label and model_name:
            label = f"{app_label}.{model_name}".lower()
        if app_label in self.tenant_apps:
            if label and label in self.shared_models:
                return db == "default"
            alias = self._tenant_alias()
            if alias:
                return alias == db
            return db == "default"
        return db == "default"
