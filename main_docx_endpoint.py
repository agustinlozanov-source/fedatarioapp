"""
Fragmento de main.py — reemplazar el bloque DocxInput + /docx/generar existente.
"""

# ── Imports adicionales necesarios al inicio de main.py ──────────────────────
# from agentes.agt04_redactor import generar_acta
# from agentes.firestore_mapper import firestore_to_redactor_input
# (los demás imports ya existen)

# ── Schema ────────────────────────────────────────────────────────────────────

class DocxInput(BaseModel):
    texto_acta:      str
    nombre_archivo:  str = "acta_constitutiva"
    nombres_socios:  list[str] = []
    instrumento_id:  str | None = None   # ← NUEVO: para regenerar secciones


# ── Endpoint ──────────────────────────────────────────────────────────────────

@app.post("/docx/generar")
async def docx_generar(body: DocxInput):
    try:
        from agentes.agt04_redactor import generar_acta
        from agentes.firestore_mapper import firestore_to_redactor_input
        from agentes.agt06_docx import generar_docx

        secciones = None

        # Si viene instrumento_id, regenerar secciones desde Firestore
        if body.instrumento_id:
            doc_ref = db.collection("instrumentos").document(body.instrumento_id)
            doc_snap = doc_ref.get()
            if doc_snap.exists:
                instrumento = firestore_to_redactor_input(doc_snap.to_dict())
                resultado   = generar_acta(instrumento)
                secciones   = resultado["secciones"]

        docx_bytes = generar_docx(
            texto_acta     = body.texto_acta,
            nombres_socios = body.nombres_socios or None,
            secciones      = secciones,
        )

        filename = f"{body.nombre_archivo}.docx"
        return StreamingResponse(
            io.BytesIO(docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
