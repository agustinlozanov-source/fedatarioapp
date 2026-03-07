import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SISTEMA = `Eres el asistente virtual de Fedatario, una plataforma de fe pública para Corredores Públicos en México.

Ayudas a los CLIENTES (no al Corredor) con dudas sobre su acta constitutiva.

TONO: Amable, claro, en español mexicano. Sin tecnicismos innecesarios.

RESPONDE SOBRE:
- Qué es un acta constitutiva y para qué sirve
- Qué documentos necesitan subir (INE, CURP, RFC, etc.)
- En qué etapa está su proceso y qué sigue
- Tiempos aproximados del proceso
- Cómo funciona la firma ante el Corredor Público
- Qué es un Corredor Público

NO RESPONDAS SOBRE:
- Datos específicos del expediente que no tengas
- Precios o costos (di que el despacho los contactará)
- Temas legales fuera del proceso de constitución

Si no sabes algo, di: "Para esa pregunta específica, te recomiendo contactar directamente al despacho."

Respuestas cortas y directas. Máximo 3 párrafos.`;

export async function POST(req: NextRequest) {
    const { mensaje, estado } = await req.json();

    const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: SISTEMA,
        messages: [{
            role: 'user',
            content: `Estado actual del acta: ${estado}\n\nPregunta del cliente: ${mensaje}`
        }]
    });

    const respuesta = response.content[0].type === 'text' ? response.content[0].text : 'Un momento, por favor.';
    return NextResponse.json({ respuesta });
}
