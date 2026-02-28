import logging
from decimal import Decimal
from django.db.models import Sum, Q, F
from django.utils import timezone
from rest_framework import views, permissions, status
from rest_framework.response import Response
from materialidad.models import (
    Empresa,
    Operacion,
    Contrato,
    Proveedor,
    AlertaCSD,
    TipoAlertaCSD,
    EstatusAlertaCSD,
)

logger = logging.getLogger(__name__)

class ExecutiveDashboardSummaryView(views.APIView):
    """
    Unified endpoint for the Executive Dashboard phase 2.
    Returns:
    - active_alerts (Arts 69-B, CSD)
    - protected_value (Sum of CFDI shielded by the platform)
    - csd_risk_score (0-100 indicating risk exposure)
    - materiality_coverage (Percentage of operations with valid dossiers)
    - intangibles_valuation (Phase 1 placeholder/base calc)
    """
    
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        # En una arquitectura multi-tenant real de este SaaS asumo 
        # que el tenant viene en el request (ej. request.tenant o request.user.empresa_activa)
        # Para mantener el query acotado asumimos que leemos todas las empresas 
        # a las que tiene acceso el usuario, o la primera empresa activa.
        
        # Filtro base:
        user = request.user
        # Por ahora tomamos todas las empresas, ajusta a `request.tenant` si existe un middleware
        empresas = Empresa.objects.filter(activo=True)
        if not empresas.exists():
            return Response({"error": "No active companies found for this user."}, status=status.HTTP_404_NOT_FOUND)

        # 1. Alertas Críticas (CSD)
        alertas_base_q = AlertaCSD.objects.filter(
            empresa__in=empresas,
            estatus__in=[EstatusAlertaCSD.ACTIVA, EstatusAlertaCSD.ACLARACION]
        ).select_related('proveedor').order_by('-fecha_deteccion')
        
        alertas_q = alertas_base_q[:5]

        active_alerts = []
        for alerta in alertas_q:
            active_alerts.append({
                "id": alerta.id,
                "type": "CSD_RISK" if alerta.tipo_alerta == TipoAlertaCSD.PROPIETARIO else "69B_RISK",
                "severity": "alert",
                "title": f"Riesgo CSD: {alerta.get_tipo_alerta_display()}",
                "message": f"Proveedor {alerta.proveedor.razon_social}" if alerta.proveedor else "Riesgo en CSD propio",
                "date": alerta.fecha_deteccion.strftime('%Y-%m-%d')
            })

        # 2. Protected Value (Ahorro Protegido)
        # Sum of 'monto' strictly of operations that have been properly validated
        protected_ops = Operacion.objects.filter(
            empresa__in=empresas,
            estatus_validacion=Operacion.EstatusValidacion.VALIDADO,
            cfdi_estatus=Operacion.EstatusCFDI.VALIDO
        ).aggregate(total_protegido=Sum('monto'))
        
        protected_value = protected_ops['total_protegido'] or Decimal('0.00')

        # 3. CSD Risk Score (Exposición a EFOS/69-B)
        # Calculado base: (Monto operado riesgoso / Monto total) * 100
        total_ops_aggr = Operacion.objects.filter(empresa__in=empresas).aggregate(total=Sum('monto'))
        monto_total = total_ops_aggr['total'] or Decimal('0.00')
        
        riesgosos_aggr = Operacion.objects.filter(
            empresa__in=empresas,
            proveedor__estatus_69b__in=[
                'PRESUNTO', 'DEFINITIVO'
            ]
        ).aggregate(total=Sum('monto'))
        monto_riesgoso = riesgosos_aggr['total'] or Decimal('0.00')

        if monto_total > 0:
            csd_risk_score = round(float((monto_riesgoso / monto_total) * 100), 1)
        else:
            csd_risk_score = 0.0

        if alertas_base_q.filter(tipo_alerta=TipoAlertaCSD.PROPIETARIO).exists():
            csd_risk_score = min(csd_risk_score + 50.0, 100.0)

        # 4. Materiality Coverage
        # Porcentaje de operaciones que tienen entregables COMPLETADOS vs el total requerido
        total_ops_count = Operacion.objects.filter(empresa__in=empresas).count()
        validated_ops_count = Operacion.objects.filter(
            empresa__in=empresas, 
            estatus_validacion=Operacion.EstatusValidacion.VALIDADO
        ).count()
        
        if total_ops_count > 0:
            materiality_coverage = round((validated_ops_count / total_ops_count) * 100, 1)
        else:
            materiality_coverage = 0.0

        # 5. Intangibles Valuation (NIF C-8)
        # Sumamos contratos de tipo 'ACTIVOS' (Propiedad Intelectual / Regalías)
        intangibles_aggr = Contrato.objects.filter(
            empresa__in=empresas,
            categoria=Contrato.Categoria.ACTIVOS,
        ).aggregate(total=Sum('beneficio_economico_esperado'))
        
        intangibles_value = intangibles_aggr['total'] or Decimal('0.00')

        # 6. Portfolio Risks (Tenant Specific)
        portfolio = []
        for empresa in empresas:
            # Montos
            e_ops_aggr = Operacion.objects.filter(empresa=empresa).aggregate(total=Sum('monto'))
            e_monto_total = e_ops_aggr['total'] or Decimal('0.00')
            
            e_riesgos_aggr = Operacion.objects.filter(
                empresa=empresa,
                proveedor__estatus_69b__in=['PRESUNTO', 'DEFINITIVO']
            ).aggregate(total=Sum('monto'))
            e_monto_riesgoso = e_riesgos_aggr['total'] or Decimal('0.00')
            
            e_risk_score = round(float((e_monto_riesgoso / e_monto_total) * 100), 1) if e_monto_total > 0 else 0.0
            
            # Missing files (Operaciones - Operaciones Validadas)
            e_ops_count = Operacion.objects.filter(empresa=empresa).count()
            e_val_count = Operacion.objects.filter(
                empresa=empresa,
                estatus_validacion=Operacion.EstatusValidacion.VALIDADO
            ).count()
            missing_files = max(e_ops_count - e_val_count, 0)
            
            portfolio.append({
                "id": empresa.id,
                "name": empresa.razon_social,
                "riskScore": float(e_risk_score),
                "missingFiles": missing_files
            })
            
        # Ordenamos los más riesgosos primero (top 15)
        portfolio = sorted(portfolio, key=lambda x: x['riskScore'], reverse=True)[:15]

        # 7. Operative Workflows (Phase 4 KPIs)
        now = timezone.now()
        thirty_days_from_now = now + timezone.timedelta(days=30)
        thirty_days_ago = now - timezone.timedelta(days=30)
        
        contracts_expiring = Contrato.objects.filter(
            empresa__in=empresas,
            activo=True,
            vigencia_fin__isnull=False,
            vigencia_fin__lte=thirty_days_from_now.date(),
            vigencia_fin__gte=now.date() # Don't count already expired ones as 'expiring'
        ).count()
        
        pending_dossiers = Operacion.objects.filter(
            empresa__in=empresas,
            estatus_validacion__in=[
                Operacion.EstatusValidacion.PENDIENTE, 
                Operacion.EstatusValidacion.EN_PROCESO
            ]
        ).count()
        
        unvalidated_providers = Proveedor.objects.filter(
            operaciones__empresa__in=empresas # Solo proveedores que tengan operaciones con estas empresas
        ).filter(
            Q(ultima_validacion_sat__isnull=True) | 
            Q(ultima_validacion_sat__lt=thirty_days_ago)
        ).distinct().count()

        payload = {
            "active_alerts": active_alerts,
            "protected_value": float(protected_value),
            "csd_risk_score": float(csd_risk_score),
            "materiality_coverage": float(materiality_coverage),
            "total_ops_count": total_ops_count,
            "validated_ops_count": validated_ops_count,
            "intangibles_valuation": float(intangibles_value),
            "portfolio": portfolio,
            "contracts_expiring": contracts_expiring,
            "pending_dossiers": pending_dossiers,
            "unvalidated_providers": unvalidated_providers,
            "active_clients_count": empresas.count(),
            "timestamp": now.isoformat()
        }

        return Response(payload, status=status.HTTP_200_OK)
