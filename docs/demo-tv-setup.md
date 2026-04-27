# Demo TV Local

Runbook para levantar la app en una PC de escritorio y probarla desde TVs o celulares dentro de la misma red.

## Objetivo

Usar la PC como servidor local de demo, con una URL corta para cargar en la TV:

- Display moderno: `http://tv.ccu.uy`
- Display moderno directo: `http://tv.ccu.uy/display/`
- Admin: `http://tv.ccu.uy/admin/`
- TV antigua: `http://tv.ccu.uy/display/tv.html?v=3`

En la demo de planta se uso DNS interno `tv.ccu.uy -> 192.168.132.23`.

## DNS

Crear un registro Host (A) en el DNS interno:

```text
Nombre: tv
FQDN:   tv.ccu.uy
IP:     192.168.132.23
```

Validar desde una PC cliente:

```cmd
nslookup tv.ccu.uy
```

Debe responder la IP de la PC que corre la app.

## Configuracion local

Crear un archivo `.env` local en la raiz del repo. Este archivo esta ignorado por Git y no debe subirse.

```env
NODE_ENV=production
PORT=80
HOST=0.0.0.0
PUBLIC_URL=http://tv.ccu.uy
ROOT_REDIRECT=/display/
DB_PATH=./data/cartelera.db
UPLOADS_DIR=./data/uploads
JWT_SECRET=<secreto-local-largo>
```

Notas:

- `PORT=80` permite escribir `http://tv.ccu.uy` sin puerto.
- `ROOT_REDIRECT=/display/` hace que la raiz abra el player, no el admin.
- Para operar desde la PC, entrar a `http://tv.ccu.uy/admin/`.

## Build y arranque directo

Desde PowerShell en la raiz del repo:

```powershell
cd backend
npm ci --no-audit --no-fund
npm run build
Copy-Item src\db\schema.sql dist\db\schema.sql -Force
cd ..\admin
npm ci --no-audit --no-fund
npm run build
cd ..
node backend\dist\index.js
```

Para dejarlo corriendo en segundo plano durante el demo:

```powershell
Start-Process node -ArgumentList "backend\dist\index.js" -WorkingDirectory "C:\Users\eatrujil\Documents\cartelera-planta" -WindowStyle Hidden
```

## Firewall

Abrir el puerto 80 en Windows:

```cmd
netsh advfirewall firewall add rule name="Cartelera Demo 80" dir=in action=allow protocol=TCP localport=80
```

Si se usa un puerto alternativo, por ejemplo 8502:

```cmd
netsh advfirewall firewall add rule name="Cartelera Demo 8502" dir=in action=allow protocol=TCP localport=8502
```

## Emparejamiento

1. Abrir `http://tv.ccu.uy/admin/`.
2. Ir a Pantallas.
3. Crear o seleccionar una pantalla.
4. Generar codigo de emparejamiento.
5. En la TV abrir:
   - Moderna: `http://tv.ccu.uy`
   - Antigua: `http://tv.ccu.uy/display/tv.html?v=3`
6. Escribir el codigo de 6 caracteres.

La version `tv.html` existe para navegadores muy viejos que no soportan JavaScript moderno ni CSS actual. Para TVs 4K modernas conviene usar siempre `/display/`.

## Troubleshooting

### La PC abre pero celular/TV no

- Confirmar que el celular o TV este en la misma red real que la PC.
- Verificar que el DNS resuelve: `nslookup tv.ccu.uy`.
- Probar por IP: `http://192.168.132.23`.
- Revisar firewall de Windows.
- Revisar si la WiFi tiene client isolation o bloqueo entre clientes.

### Chrome muestra connection refused

El DNS funciona, pero no hay proceso escuchando en el puerto. Validar:

```powershell
netstat -ano | findstr ":80"
```

Y health check:

```powershell
curl http://tv.ccu.uy/api/health
```

### La TV antigua queda en blanco o no responde el boton

- Usar `http://tv.ccu.uy/display/tv.html?v=3`.
- Cambiar el `v=3` por otro numero para saltar cache del navegador.
- Si el navegador tiene boton de recargar, usarlo despues de cambiar la URL.

### Despues de reiniciar la PC no funciona

El arranque directo con Node no queda instalado como servicio. Hay que volver a iniciar el proceso o configurar una tarea programada/systemd equivalente para produccion.

## Estado recomendado para produccion

Para produccion real, usar Docker Compose o un servicio administrado, TLS, backups automatizados y monitoreo. El modo directo en Windows es util para demo y validacion en planta, no para operacion sostenida.
