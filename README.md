# Fedatario

Plataforma de Fe Pública con IA para Corredores Públicos en México.

## Arrancar

```bash
# Instalar dependencias
npm install

# Dashboard web (puerto 3001)
npm run dev:web

# Agentes Python (puerto 5001)
cd apps/agents
pip install -r requirements.txt
uvicorn main:app --reload --port 5001
```

## Estructura
Ver `.cursor/rules/05-estructura.mdc`

## Pipeline de agentes
Ver `.cursor/rules/03-pipeline.mdc`
