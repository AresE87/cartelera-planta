# Manual de usuario

Guía para personas que van a **operar** la cartelería día a día: subir contenido, cambiar layouts, enviar avisos. Sin conocimientos técnicos previos.

---

## Ingresar al panel

1. Abrí el navegador en `http://carteleria.empresa.local:8080/admin` (o la URL que te hayan pasado).
2. Ingresá con tu usuario y contraseña.
3. La primera vez, si te dieron el usuario default (`admin@cartelera.local` / `admin1234`), cambiá la contraseña desde Usuarios → Editar → Nueva contraseña.

---

## Conceptos básicos

- **Pantalla** = una TV física con un player. Puede estar en el comedor, producción, oficinas, etc.
- **Zona** = un grupo de pantallas (ej. "Comedor", "Producción", "Oficinas").
- **Media** = archivo (imagen, video, HTML) que subís para mostrar.
- **Widget** = componente dinámico (ej. "Beneficios", "Clima", "KPIs") que muestra datos actualizados automáticamente.
- **Layout** = cómo se ve una pantalla completa: qué regiones tiene y qué contenido rota en cada una.
- **Programación (schedule)** = una regla que dice "este layout se muestra en tal zona los lunes a viernes de 7 a 15hs".
- **Alerta** = comunicación urgente que se muestra inmediatamente en las pantallas indicadas.

---

## Flujo típico de uso

### 1. Subir contenido nuevo al comedor

Ejemplo: publicar el flyer de beneficios de abril.

1. **Media** → **+ Subir archivo(s)** → seleccioná el PDF/JPG/PNG.
2. **Layouts** → elegí el layout del comedor (o creá uno nuevo).
3. Editá el layout: agregá un **item** de tipo `media` en la región que prefieras.
4. **Guardar**. A los pocos segundos la pantalla del comedor ya muestra el contenido nuevo.

### 2. Programar una campaña temporal

Ejemplo: la semana de seguridad laboral, del 15 al 21 de junio, mostrar un layout especial.

1. Creá el **Layout** de la campaña.
2. **Programación** → **+ Nueva programación**.
3. Elegí:
   - Layout → el de la campaña
   - Aplicar a → Zona "Producción" (por ejemplo)
   - Prioridad → 50 (mayor que el schedule base de prioridad 10)
   - Desde → 15/06 00:00
   - Hasta → 21/06 23:59
4. **Crear**. Mientras tanto, el layout base sigue activo el resto del día.

### 3. Enviar una alerta urgente

Ejemplo: simulacro de evacuación.

1. **Alertas** → **+ Enviar alerta**.
2. Usá la plantilla "⚠ Simulacro" o armá tu mensaje.
3. Elegí severidad (`warn` para simulacro, `emergency` para real).
4. Destino: Todas las pantallas / Zona específica / Una pantalla.
5. Duración: 300 segundos (5 min) es un buen default para simulacros.
6. **🚨 Enviar**. Aparece instantáneamente como banner en todas las pantallas.

### 4. Publicar los cumpleaños del mes automáticamente

Si tenés un middleware conectado a RRHH, los cumpleaños se actualizan solos todos los días. Si no, edital manualmente:

1. **Widgets** → editá el widget "Cumpleaños del mes".
2. En el campo **Config (JSON)**, agregá/actualizá la lista de personas.
3. **Guardar**.

El layout del comedor ya está configurado para rotar este widget junto con beneficios y avisos.

---

## Emparejar una pantalla nueva

Cuando te instalan un player nuevo en una TV:

1. **Pantallas** → **+ Nueva pantalla**:
   - Nombre descriptivo (ej. "TV Comedor principal")
   - Asignale una zona
   - Resolución (1920x1080 para la mayoría)
2. Click en **Crear + generar código**. Te muestra un código de 6 caracteres (p. ej. `AB3X7K`).
3. En la pantalla física (con un teclado USB momentáneo o control remoto), va a aparecer un input — escribí el código.
4. Listo, la TV queda vinculada y empieza a mostrar el layout asignado.

Si la pantalla pierde el token (por ejemplo, le borraste la cache), simplemente regenerás el código (botón **Regenerar pairing**) y volvés a emparejar.

---

## ¿Qué ven las distintas pantallas?

La lógica que decide qué layout se muestra en cada pantalla en cada momento:

1. ¿Hay una programación **específica para esta pantalla** activa ahora? → esa gana.
2. ¿Hay una programación **para la zona** de esta pantalla activa ahora? → esa gana.
3. Si no, se usa el layout **asignado directamente** a la pantalla (sección "Asignar layout" en el detalle).
4. Si no hay nada de lo anterior, aparece "Sin layout asignado".

La prioridad de las programaciones rompe empates (mayor = gana).

---

## Atajos útiles en los displays

- **Ctrl + Shift + R** en la pantalla física → fuerza reload
- **Ctrl + Shift + U** → desvincular (pide confirmación)
- Mover el mouse → aparece la barra de estado con hora y nombre de la pantalla

---

## FAQ rápido

**¿Cómo sé si una pantalla está funcionando?**
Dashboard o Pantallas. Estado `En línea` verde = todo OK. `Offline` gris = perdió conexión hace más de 2 min.

**Una pantalla dice "Sin layout asignado" pero quiero que muestre algo.**
Abrí la pantalla (Pantallas → click en el nombre) → Asignar layout → elegí uno → automático.

**Subí una imagen pero no la veo en la pantalla.**
Las imágenes en Media son solo el almacén. Para que aparezcan, tenés que agregarlas a un layout → región → item tipo `media`.

**Un aviso se quedó zombie semanas.**
Desde Layouts, editá el layout y borrá el item. O cambiá el schedule que lo contiene.

**¿Puedo programar por días específicos?**
Sí. En Schedules, marcás los días de la semana (L, M, X, J, V, S, D) y el rango horario. Opcionalmente también un rango de fechas (Desde/Hasta) para campañas.

**¿Alguien puede ver qué se publicó?**
Todas las operaciones quedan en el `audit_log` de la base. Un admin puede verlo con SQL:
`docker exec -it cartelera-backend sqlite3 /data/cartelera.db "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50"`
