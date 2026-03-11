# Guía de Deployment - Railway

## Paso 1: Preparar GitHub (✅ Ya hecho)
El código está pusheado a tu repo.

## Paso 2: Crear/Conectar Railway

### Opción A: Primera vez con Railway
1. Ve a https://railway.app
2. Sign in with GitHub
3. Autoriza a Railway acceder a tus repositorios

### Opción B: Ya tienes Railway
1. Ve a tu dashboard de Railway
2. Click en "New Project"

## Paso 3: Crear servicio del backend

1. **New Project** → **GitHub Repo** → Selecciona `Fedatario App`
2. Railway te preguntará qué desplegar, selecciona la carpeta: `fedatario/apps/agents`
3. Configura el **root directory**: `./apps/agents`

## Paso 4: Configurar variables de entorno

En el panel de Railway:
1. Click en la variable **Environments** del servicio
2. Agrega las siguientes variables:

### Variables obligatorias:
```
GOOGLE_APPLICATION_CREDENTIALS_JSON=<tu-json-completo-de-firebase>
ANTHROPIC_API_KEY=<tu-clave-anthropic>
```

### Variables opcionales (si necesitas):
```
PORT=5000
ENVIRONMENT=production
```

## Paso 5: Configurar comando de inicio

Railway debe ejecutar:
```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

En Railway esto generalmente se configura en:
- **Settings** → **Build** → **Start Command**
```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

## Paso 6: Obtener la URL pública

Una vez desplegado:
1. Railway te asigna una URL como: `https://xxxxx.railway.app`
2. El backend estará disponible en: `https://xxxxx.railway.app`
3. Endpoints estarán en: `https://xxxxx.railway.app/orquestador/generar`

## Paso 7: Actualizar el frontend

En la sección web, actualiza la URL del backend:
- **Busca**: referencias a `localhost:5001`
- **Reemplaza con**: `https://xxxxx.railway.app` (tu URL de Railway)

### Archivos a actualizar:
- `apps/web/src/lib/db/` - URLs de API calls
- `apps/web/src/app/api/` - Rutas proxy si las tienes

## Troubleshooting

### Error: "Cannot find requirements.txt"
Railway espera `requirements.txt` en la carpeta base del servicio. 
✅ Ya está en `./apps/agents/requirements.txt`

### Error: "Port already in use"
Railway asigna automáticamente el puerto. Asegúrate de usar `$PORT` en la variable de entorno.

### Error: "Firestore connection refused"
Verifica que tu JSON de Google Cloud esté completo y que el proyecto exista en Firebase.

### Error 500 en /auditor/verificar
Una vez en Railway podrás ver los logs completos:
- Dashboard Railway → Servicio → **Logs**
- Aquí verás el error exacto del stack trace

## Monitoreo

Railway proporciona:
- **Logs** - Ver errores en tiempo real
- **Metrics** - CPU, memoria, requests
- **Deployments** - Historial de cambios

## Próximos pasos

Cuando el backend esté funcionando en Railway:
1. Prueba los endpoints manualmente
2. Actualiza el frontend con la nueva URL
3. Prueba el flujo completo de generación de borrador
4. Deploya el frontend (puedes usar Vercel)
