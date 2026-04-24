# Plan de acción — Cartelería digital de planta

**Proyecto:** Implementación de sistema de cartelería digital para TVs de planta industrial
**Solicitado por:** Stefany Roman Aguiar / Ernesto Farías Merladett
**Responsable técnico:** [a completar]
**Fecha de elaboración:** abril 2026
**Duración estimada total:** 14-18 semanas hasta operación plena
**Primer hito visible (PoC comedor):** 4-6 semanas

---

## 1. Resumen ejecutivo

Implementar un sistema de cartelería digital que permita gestionar de forma centralizada el contenido mostrado en las TVs smart de planta, con capacidad de enviar comunicaciones sincrónicas (en tiempo real) y asincrónicas (programadas), agrupación por zonas, roles de administración, e integración con sistemas internos de la empresa.

**Estrategia elegida:** Xibo (open source, self-hosted) como motor base + capa a medida para integraciones y widgets específicos del negocio. Toda la infraestructura corre on-premise, sin costos recurrentes de licenciamiento y con soberanía total de datos.

**Primer entregable:** cartelera digital operativa en el comedor mostrando beneficios (caso presentado por Stefany), como prueba de concepto antes de escalar al resto de la planta.

---

## 2. Objetivos y alcance

### 2.1 Objetivos principales

- Centralizar la gestión de contenido de todas las TVs de planta en una única plataforma web
- Habilitar envío de comunicaciones urgentes con push en tiempo real a las pantallas
- Permitir programación de contenido por fecha, hora, zona y pantalla específica
- Gestionar permisos por área (RRHH, producción, seguridad, comunicaciones internas)
- Integrar con sistemas internos para mostrar data en vivo (beneficios, cumpleaños, KPIs, alertas)
- Mantener operación ininterrumpida incluso ante cortes de red (cache local en players)

### 2.2 Fuera de alcance (fase inicial)

- Señalización en puntos de venta externos
- Contenido interactivo (touch screens)
- Streaming de video en vivo desde cámaras
- Sistema de reservas de salas asociado a pantallas

Estos ítems pueden evaluarse para fases posteriores.

### 2.3 Referencia externa

Como indicó Ernesto, CCU tiene implementada una solución de este tipo en otras operaciones. Contactar a Catalina y Manuela para conocer: stack utilizado, aprendizajes, errores a evitar, y volúmenes operativos de referencia.

---

## 3. Arquitectura de la solución

**Stack tecnológico:**

- **Motor base:** Xibo CMS 4.x (open source, self-hosted) — gestión de contenido, scheduling, distribución a players, roles y permisos, monitoreo, push en tiempo real vía XMR
- **Infraestructura:** Ubuntu Server 24.04 LTS sobre hardware existente, Docker + Docker Compose para servicios containerizados, Caddy como reverse proxy
- **Players:** Android TV boxes o Raspberry Pi 4/5 conectados por HDMI a cada TV smart de planta (las TVs funcionan como "monitores tontos" — no se depende del SO de la TV)
- **Capa a medida:** widgets HTML5 custom + middleware de integración con sistemas internos, desarrollados sobre la API de Xibo
- **Red:** LAN corporativa, DNS interno, IP fija del server, sin exposición a internet pública

**Beneficios clave de este stack:**

- Cero costo de licenciamiento por pantalla (vs. USD 8-15/pantalla/mes de soluciones SaaS)
- Independencia total de proveedor
- Data de la empresa nunca sale de la red interna
- Podemos customizar todo lo que haga falta sin pedir features a nadie
- Las herramientas actuales de IA (Claude Code) nos permiten desarrollar la capa custom en tiempos razonables

---

## 4. Fases del proyecto

### FASE 0 — Alineación y preparación (semana 1-2)

**Objetivo:** dejar todo el contexto resuelto antes de tocar un solo fierro.

| Tarea | Responsable | Output |
|-------|-------------|--------|
| Kickoff con Stefany, Ernesto, RRHH, Producción | TI | Acta con alcance acordado |
| Contacto con Catalina y Manuela (CCU) | TI + Ernesto | Minuta con aprendizajes y recomendaciones |
| Relevamiento físico de TVs existentes | TI + Mantenimiento | Inventario con ubicación, modelo, estado, conectividad de red disponible |
| Identificación de ubicaciones para pantallas nuevas (si aplica) | Stefany + líderes de área | Lista priorizada |
| Definición de casos de uso por zona | Stefany + RRHH + Producción | Matriz de contenidos por pantalla/zona |
| Identificación de stakeholders y administradores por área | Stefany | Lista de usuarios y roles previstos |
| Aprobación de presupuesto de hardware | Ernesto | OK para compras |

**Entregable de la fase:** documento de alcance firmado + inventario + decisión go/no-go para Fase 1.

---

### FASE 1 — Infraestructura base (semana 2-3)

**Objetivo:** dejar el server operativo con todos los servicios base listos para hostear Xibo.

| Tarea | Detalle | Responsable |
|-------|---------|-------------|
| Preservar licencia Windows 11 Pro | Linkear a cuenta Microsoft, anotar product key | TI |
| Backup de datos del server actual | Documentos, configs, credenciales | TI |
| Instalación de Ubuntu Server 24.04 LTS | Según guía técnica detallada | TI |
| Configuración de red, IP fija, DNS interno | Registro `carteleria.empresa.local` apuntando al server | TI + Redes |
| Hardening: SSH con claves, firewall UFW, fail2ban | Seguridad básica obligatoria para server 24/7 | TI |
| Updates automáticos de seguridad | `unattended-upgrades` configurado | TI |
| Instalación Docker + Docker Compose | Stack base para todas las apps | TI |
| Instalación Caddy (reverse proxy) | Ruteo por subdominio, TLS interno | TI |
| Configuración de backups automáticos | Cron nocturno a NAS / disco externo | TI |
| Monitoreo básico (opcional: Uptime Kuma) | Alerta si algún servicio cae | TI |

**Criterio de éxito:** poder hacer `ssh server-apps` desde otra máquina, levantar un container de prueba, y ver logs centralizados.

---

### FASE 2 — Xibo CMS + Prueba de concepto en comedor (semana 3-5)

**Objetivo:** validar que el motor funciona en el contexto real y dejar operativa la primera cartelera (comedor, caso presentado por Stefany).

**Tareas de software:**

1. Deploy de Xibo via docker-compose oficial en `/opt/xibo`
2. Configuración inicial del CMS: usuarios, roles, permisos, branding corporativo
3. Creación de grupos de pantallas (zonas): Comedor, Producción, Oficinas, Seguridad
4. Primera layout: cartelera del comedor con secciones para beneficios, avisos generales, cumpleaños del mes

**Tareas de hardware:**

5. Compra de 1 Android TV box o Raspberry Pi 5 para el comedor (ver sección 5 — lista de compras)
6. Instalación física: montaje, conexión HDMI a la TV, conexión de red (ethernet preferido, WiFi si no hay opción), fuente de alimentación
7. Instalación y configuración del Xibo Player en el device
8. Linking del player al CMS y asignación a la zona "Comedor"

**Tareas de contenido y operación:**

9. Subida del primer batch de contenidos (beneficios del mes, avisos)
10. Training a Stefany (o quien vaya a administrar) en el uso del CMS — 2 sesiones de ~1 hora
11. Documentación de procedimientos operativos: cómo subir contenido, cómo programar, cómo enviar urgencia

**Criterio de éxito:** Stefany (o la persona designada) puede subir una nueva comunicación al comedor sin ayuda técnica, y ésta aparece en la TV en el horario programado.

---

### FASE 3 — Validación operativa del PoC (semana 5-7)

**Objetivo:** operación real en comedor por 2 semanas, detectar problemas antes de escalar.

| Actividad | Detalle |
|-----------|---------|
| Operación supervisada | RRHH / Comunicaciones usa el sistema a diario |
| Recolección de feedback | Entrevistas con administradores y observación del personal en comedor |
| Ajustes de contenido y timing | Duración de slides, velocidad de rotación, tipografías |
| Prueba de emergency override | Simular envío de comunicación urgente |
| Prueba de resiliencia | Desconectar red del player y verificar que sigue mostrando contenido cacheado |
| Documentación final de procedimientos | Manual de usuario para admins |
| Retrospectiva técnica | ¿Qué salió bien? ¿Qué ajustar antes de escalar? |

**Criterio de éxito:** el comedor operando de forma estable durante 2 semanas sin intervención técnica, con contenido actualizándose regularmente por personal no-técnico.

---

### FASE 4 — Desarrollo a medida (semana 5-9, en paralelo con Fase 3)

**Objetivo:** construir los widgets e integraciones que son específicos del negocio y que Xibo vanilla no cubre.

Priorizar según valor inmediato:

**Prioridad 1 (máximo valor):**

- **Widget "Beneficios"** — vista dinámica que consume data de un endpoint interno y rota los beneficios vigentes con diseño corporativo. Reemplaza al PDF/imagen estática que se sube hoy.
- **Widget "Cumpleaños del mes"** — lee de RRHH (SAP o HRIS que usen) y genera automáticamente la vista sin intervención manual
- **Template corporativo** — layout base con header, footer, colores y tipografías de la empresa para que cualquier contenido nuevo herede el branding

**Prioridad 2:**

- **Widget "Avisos de RRHH"** — sección con novedades de gestión de personas (capacitaciones, eventos, cambios de políticas)
- **Middleware de integración** — servicio intermedio (Node.js o Python) que lee de sistemas internos y alimenta Xibo DataSets. Una sola capa que después sirve para todos los widgets nuevos.

**Prioridad 3 (fase 5 o posterior):**

- **Widget "KPIs de producción"** — data en vivo desde MES/SCADA (requiere coordinación con el área de Producción e Ingeniería)
- **Widget "Alertas de seguridad"** — integración con sistemas de seguridad industrial para push inmediato ante incidentes
- **Widget "Indicadores de calidad"** — según indicadores que defina Calidad

**Criterio de éxito:** la cartelera del comedor opera con los widgets de beneficios y cumpleaños actualizándose automáticamente desde los sistemas internos, sin intervención manual.

---

### FASE 5 — Rollout a planta (semana 8-12)

**Objetivo:** instalar cartelería en todas las ubicaciones aprobadas y dejar el sistema operando a escala.

**Planificación del rollout:**

1. Priorización de ubicaciones según impacto (alta visibilidad > baja visibilidad)
2. Compra de players e insumos para el lote completo (ver sección 5)
3. Coordinación con Mantenimiento / Eléctrica para instalaciones físicas (tomacorrientes, puntos de red, soportes si hacen falta)
4. Verificación de cobertura de red en cada ubicación (WiFi si no hay ethernet) — coordinación con Redes
5. Instalación física progresiva — 2-4 pantallas por semana
6. Configuración de zonas y scheduling específico por área
7. Training a administradores secundarios por área (no solo RRHH — también Producción, Seguridad, etc.)

**Agrupación sugerida de zonas:**

- Comedor (contenido general + beneficios + RRHH)
- Líneas de producción (KPIs + avisos operativos + seguridad)
- Oficinas administrativas (comunicaciones corporativas)
- Ingresos / áreas de tránsito (bienvenida + información general)
- Sala de descanso / vestuarios (mezcla de corporativo + recreativo)

**Criterio de éxito:** todas las pantallas del lote instaladas, conectadas al CMS, reportando online, y con contenido propio de cada zona.

---

### FASE 6 — Integraciones avanzadas (semana 12-18)

**Objetivo:** sumar las integraciones en vivo que requieren coordinación con sistemas productivos.

| Integración | Sistema fuente | Complejidad | Coordinación requerida |
|-------------|----------------|-------------|------------------------|
| KPIs de producción | MES / SCADA | Alta | Producción, Automatización |
| Alertas de seguridad industrial | Sistema de seguridad | Alta | HSE / Seguridad |
| Indicadores de calidad | Sistema de calidad | Media | Calidad |
| Avisos de mantenimiento | CMMS | Media | Mantenimiento |
| Comunicaciones dirigidas por turno | Sistema de turnos / RRHH | Media | RRHH |

Cada integración es un proyecto chico en sí: relevamiento de API disponible, desarrollo del middleware, creación del widget, pruebas, puesta en producción. Estimar 2-3 semanas por integración según complejidad.

**Criterio de éxito:** al menos 2 integraciones avanzadas operativas mostrando data en vivo.

---

### FASE 7 — Operación sostenida y mejora continua (ongoing)

**Objetivo:** garantizar que el sistema funciona de forma estable y evoluciona según necesidades.

Actividades permanentes:

- **Monitoreo diario** — dashboard de estado de pantallas (cuáles están online, contenido actual, alertas)
- **Backups verificados** — no solo que corran, sino restaurar uno cada cierto tiempo para confirmar que funcionan
- **Updates de seguridad** — automáticos para el SO, manuales controlados para Xibo y widgets
- **Mantenimiento físico** — limpieza de pantallas, verificación de cables, reemplazo de players si fallan
- **Gestión de usuarios** — altas, bajas, cambios de rol
- **Roadmap de nuevos widgets** — evaluación trimestral de solicitudes de las áreas
- **Métricas de uso** — cuántos contenidos se publican, qué áreas son más activas, cuánto contenido desactualizado detectar

---

## 5. Lista de compras

Todos los precios son estimaciones en USD — verificar con proveedores al momento de la compra.

### 5.1 Hardware por pantalla

Por cada TV que se sume al sistema:

| Ítem | Opción económica | Opción recomendada | Notas |
|------|------------------|---------------------|-------|
| Player (device) | Android TV box (USD 40-60) | Raspberry Pi 5 8GB kit (USD 100-130) | Raspberry es más estable y mantenible a largo plazo; Android TV arranca más rápido |
| Tarjeta SD / almacenamiento | — | microSD 64GB A2 (USD 15) | Solo para Raspberry |
| Cable HDMI | USD 5-10 | Cable con filtro (USD 15) | Largo según montaje |
| Cable de red Cat6 | USD 5-20 | — | Longitud según tendido |
| Fuente de alimentación | Incluida | USD 15 si no | Verificar amperaje |
| Soporte VESA para player | USD 10-20 | — | Si se monta oculto detrás de la TV |

**Costo estimado por pantalla:** USD 80-180 según opción elegida.

### 5.2 Hardware centralizado (una única vez)

| Ítem | Estimado | Notas |
|------|----------|-------|
| Server | Ya disponible | PC existente con specs sobradas |
| Disco externo para backups | USD 80-120 | 2TB USB 3.0 |
| UPS para server | USD 100-200 | Idealmente — server 24/7 sin UPS es riesgoso |
| Switch de red adicional (si hace falta) | USD 50-200 | Según cobertura actual |

### 5.3 Estimación de hardware por escala

Para dimensionar el pedido según la cantidad de pantallas:

| Cantidad de pantallas | Costo estimado hardware | Notas |
|-----------------------|-------------------------|-------|
| 1 (PoC comedor) | USD 150-200 | Para validar el motor |
| 5 (primer rollout) | USD 600-900 | Comedor + áreas clave |
| 10 | USD 1.100-1.700 | Cobertura de planta |
| 20 | USD 2.100-3.400 | Cobertura total ampliada |

### 5.4 Software

- **Xibo CMS:** USD 0 (open source)
- **Ubuntu Server:** USD 0
- **Docker, Caddy, fail2ban, etc.:** USD 0
- **Claude Code (para desarrollo):** requiere cuenta Pro/Max/Team de Anthropic — verificar con plan actual de la empresa

### 5.5 Servicios externos (opcionales)

- **Suscripción a soporte comercial de Xibo** — opcional, útil en fase avanzada si surgen bugs críticos. USD 20-100/mes según plan.
- **DNS dinámico externo** — solo si eventualmente se quiere acceso remoto administrativo. USD 0-30/año.

---

## 6. Equipo y responsabilidades

| Rol | Responsabilidad | Dedicación |
|-----|-----------------|------------|
| TI (desarrollo/infra) | Implementación técnica end-to-end | ~60-80% durante fases 1-5, ~20% en operación |
| Stefany / RRHH | Sponsor del caso de uso comedor, gestión de contenido de beneficios | ~20% durante implementación, 5-10% ongoing |
| Ernesto | Sponsor ejecutivo, aprobaciones, contacto con CCU | Puntual |
| Comunicaciones internas | Administración principal del CMS, curaduría de contenido | ~10-20% ongoing |
| Mantenimiento / Eléctrica | Instalaciones físicas, tomas, soportes | Puntual por instalación |
| Redes | Cobertura de red en cada ubicación, configuración DNS interno | Puntual |
| Producción / HSE / Calidad | Stakeholders para fases de integración avanzada | Según fase |

---

## 7. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Cobertura de red WiFi insuficiente en planta | Media | Alto | Relevamiento previo (Fase 0), priorizar ethernet cableado donde se pueda |
| Pantallas en áreas sin alimentación eléctrica adecuada | Media | Medio | Coordinar con Mantenimiento en Fase 0, posible cableado nuevo |
| Resistencia al cambio por parte de usuarios actuales (pendrive) | Media | Medio | Training temprano, mantener workflow actual funcionando durante la transición |
| APIs de sistemas internos no disponibles o no documentadas | Alta | Alto | Relevamiento temprano con dueños de sistemas; plan B: DataSets manuales de Xibo |
| Cuello de botella en el único responsable de TI | Alta | Alto | Documentación exhaustiva desde el día 1; backup humano identificado |
| Fallo de hardware en server (disco, RAM, etc.) | Baja | Crítico | UPS, backups verificados, plan de restore documentado |
| Demora en compra de hardware por burocracia interna | Media | Medio | Iniciar proceso de compra en Fase 0, no en Fase 2 |
| Contenido desactualizado en pantallas (cartelera "zombie") | Alta | Bajo | Alertas automáticas si contenido lleva N días sin actualizar; gobernanza clara |

---

## 8. Criterios de éxito del proyecto

**Técnicos:**

- Uptime de Xibo CMS > 99% mensual
- Tiempo de propagación de una comunicación urgente < 30 segundos a todas las pantallas
- Cero pérdidas de data en 6 meses de operación
- Tiempo de restauración desde backup < 2 horas

**De negocio:**

- Stefany (o quien administre) puede publicar contenido sin ayuda técnica después del training
- Reducción a cero del uso de pendrives para gestión de contenido de las pantallas migradas
- Al menos 2 áreas de la empresa (además de RRHH) usando activamente el sistema al finalizar el rollout
- Comunicaciones urgentes de seguridad pueden emitirse en minutos, no horas

**De adopción:**

- Al menos 80% de las pantallas objetivo migradas al nuevo sistema al cierre del proyecto
- Frecuencia de publicación de contenido nuevo > 3 veces por semana en pantallas activas

---

## 9. Cronograma resumido

```
Semana    1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18
──────────────────────────────────────────────────────────────
Fase 0    ██ ██
Fase 1       ██ ██
Fase 2          ██ ██ ██
Fase 3                ██ ██
Fase 4             ██ ██ ██ ██ ██
Fase 5                   ██ ██ ██ ██ ██
Fase 6                            ██ ██ ██ ██ ██ ██ ██
Fase 7 (ongoing)                              ██ ██ ██ ██
```

**Hitos visibles para stakeholders:**

- **Semana 5:** cartelera del comedor operativa (demo para Ernesto)
- **Semana 7:** PoC validado con 2 semanas de operación real (reporte a dirección)
- **Semana 9:** widgets de beneficios y cumpleaños automatizados (fin del esfuerzo manual)
- **Semana 12:** rollout completo de pantallas (anuncio empresa)
- **Semana 18:** primera integración avanzada en producción (KPIs o seguridad)

---

## 10. Próximos pasos inmediatos

Para desbloquear el arranque, lo que se necesita esta semana:

1. **Aprobación formal del plan** por Ernesto
2. **Reunión de kickoff** con Stefany, RRHH y Comunicaciones para cerrar alcance del PoC
3. **Contacto con Catalina y Manuela (CCU)** — idealmente una videollamada de 45 min
4. **Solicitud de compra inicial** — al menos 1 player + accesorios para el comedor (USD ~150-200), para no depender del proceso de compra masiva
5. **Coordinación con Redes** — verificar cobertura en el comedor y comenzar relevamiento del resto
6. **Bloquear 2-3 días de la semana 2-3** para la migración del server a Ubuntu (requiere acceso físico)

Con estos 6 puntos desbloqueados, la Fase 1 puede arrancar en la semana 2.

---

**Documento sujeto a revisión y ajuste al finalizar cada fase.** La duración de cada fase puede variar según hallazgos del relevamiento inicial (Fase 0) y la disponibilidad real de recursos.
