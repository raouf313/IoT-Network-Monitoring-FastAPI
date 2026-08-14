"""
controllers/rapport_controller.py — Rapports + génération PDF ReportLab.
Photos stockées sur disque dans /uploads/rapport_photos/<rapport_id>/
"""
import io
import os
import uuid
import base64
from fastapi import HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER
from config.database import get_db
from models.schemas import RapportCreate, RapportRetouche, RapportStatut

# Dossier racine pour les photos (relatif au backend)
PHOTOS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads", "rapport_photos")


def _ensure_dir(rapport_id: int) -> str:
    path = os.path.join(PHOTOS_DIR, str(rapport_id))
    os.makedirs(path, exist_ok=True)
    return path


def get_rapports() -> dict:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("""SELECT r.*, u.nom technicien_nom, m.description mission_desc, COUNT(rp.id) nb_photos
        FROM rapports r LEFT JOIN utilisateurs u ON r.technicien_id=u.id
        LEFT JOIN missions m ON r.mission_id=m.id
        LEFT JOIN rapport_photos rp ON rp.rapport_id=r.id
        GROUP BY r.id ORDER BY r.date_creation DESC""")
    rows = cur.fetchall(); cur.close(); db.close()
    for r in rows:
        r["date_creation"] = r["date_creation"].isoformat()
    return {"rapports": rows}


def creer_rapport(data: RapportCreate) -> dict:
    db = get_db(); cur = db.cursor()
    cur.execute(
        "INSERT INTO rapports (titre,contenu,technicien_id,mission_id) VALUES (%s,%s,%s,%s)",
        (data.titre, data.contenu, data.technicien_id, data.mission_id)
    )
    rid = cur.lastrowid
    db.commit()

    # Stocker les photos sur disque
    if data.photos:
        photo_dir = _ensure_dir(rid)
        for photo_b64 in data.photos:
            # Extraire le header data:image/...;base64, si présent
            if "," in photo_b64:
                header, photo_b64 = photo_b64.split(",", 1)
                ext = header.split("/")[1].split(";")[0] if "/" in header else "jpg"
            else:
                ext = "jpg"
            filename = f"{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(photo_dir, filename)
            with open(filepath, "wb") as f:
                f.write(base64.b64decode(photo_b64))
            cur.execute(
                "INSERT INTO rapport_photos (rapport_id, nom_fichier) VALUES (%s, %s)",
                (rid, filename)
            )
        db.commit()

    cur.close(); db.close()
    return {"status": "ok", "rapport_id": rid}


def retouche_rapport(rid: int, data: RapportRetouche) -> dict:
    db = get_db(); cur = db.cursor()
    cur.execute(
        "UPDATE rapports SET contenu=%s, statut='soumis' WHERE id=%s AND statut='rejete'",
        (data.contenu, rid)
    )
    db.commit(); cur.close(); db.close()
    return {"status": "ok"}


def update_rapport_statut(rid: int, data: RapportStatut) -> dict:
    db = get_db(); cur = db.cursor()
    cur.execute("UPDATE rapports SET statut=%s WHERE id=%s", (data.statut, rid))
    db.commit(); cur.close(); db.close()
    return {"status": "ok"}


def get_photos(rid: int) -> dict:
    """Retourne la liste des photos avec leur URL de téléchargement."""
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute(
        "SELECT id, nom_fichier, created_at FROM rapport_photos WHERE rapport_id=%s",
        (rid,)
    )
    rows = cur.fetchall(); cur.close(); db.close()
    for r in rows:
        r["created_at"] = r["created_at"].isoformat()
        # URL relative que le frontend peut appeler
        r["url"] = f"/api/rapports/{rid}/photos/{r['id']}/file"
    return {"photos": rows}


def get_photo_file(rid: int, photo_id: int):
    """Renvoie le fichier image directement."""
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute(
        "SELECT nom_fichier FROM rapport_photos WHERE id=%s AND rapport_id=%s",
        (photo_id, rid)
    )
    row = cur.fetchone(); cur.close(); db.close()
    if not row:
        raise HTTPException(404, "Photo introuvable")
    filepath = os.path.join(PHOTOS_DIR, str(rid), row["nom_fichier"])
    if not os.path.exists(filepath):
        raise HTTPException(404, "Fichier photo introuvable sur le serveur")
    return FileResponse(filepath)


def supprimer_photo(rid: int, photo_id: int) -> dict:
    """Supprime une photo du disque et de la BD."""
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute(
        "SELECT nom_fichier FROM rapport_photos WHERE id=%s AND rapport_id=%s",
        (photo_id, rid)
    )
    row = cur.fetchone()
    if not row:
        cur.close(); db.close()
        raise HTTPException(404, "Photo introuvable")
    # Supprimer le fichier disque
    filepath = os.path.join(PHOTOS_DIR, str(rid), row["nom_fichier"])
    if os.path.exists(filepath):
        os.remove(filepath)
    cur2 = db.cursor()
    cur2.execute("DELETE FROM rapport_photos WHERE id=%s", (photo_id,))
    db.commit(); cur.close(); cur2.close(); db.close()
    return {"status": "ok"}


def generer_rapport_pdf(rid: int) -> StreamingResponse:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("""SELECT r.*, u.nom technicien_nom, u.telephone tech_tel, u.specialite tech_spec,
               m.description mission_desc, m.localisation mission_loc, m.statut mission_statut,
               p.numero_ticket panne_ticket, p.type panne_type
        FROM rapports r LEFT JOIN utilisateurs u ON r.technicien_id=u.id
        LEFT JOIN missions m ON r.mission_id=m.id LEFT JOIN pannes p ON m.panne_id=p.id
        WHERE r.id=%s""", (rid,))
    rapport = cur.fetchone(); cur.close(); db.close()
    if not rapport:
        raise HTTPException(404, "Rapport introuvable")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=2*cm, leftMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story  = []

    story.append(Paragraph("<b>TUNISIE TELECOM</b>",
        ParagraphStyle('h', fontSize=18, textColor=colors.HexColor('#E30613'), alignment=TA_CENTER)))
    story.append(Paragraph("Rapport d'Intervention Technique",
        ParagraphStyle('sub', fontSize=12, alignment=TA_CENTER)))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#E30613')))
    story.append(Spacer(1, 0.3*cm))

    meta = [
        ["Rapport N°",   f"#{rapport['id']}"],
        ["Technicien",   rapport.get('technicien_nom', 'N/A')],
        ["Spécialité",   rapport.get('tech_spec', 'N/A')],
        ["Date",         str(rapport.get('date_creation', ''))],
        ["Mission",      rapport.get('mission_desc', 'N/A')],
        ["Localisation", rapport.get('mission_loc', 'N/A')],
    ]
    table = Table(meta, colWidths=[5*cm, 12*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f5f5f5')),
        ('FONTNAME',   (0, 0), (0, -1), 'Helvetica-Bold'),
        ('GRID',       (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTSIZE',   (0, 0), (-1, -1), 10),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#fafafa')]),
    ]))
    story.append(table)
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("<b>Contenu du rapport</b>", styles['Heading2']))
    story.append(Paragraph(rapport.get('contenu', '').replace('\n', '<br/>'), styles['Normal']))
    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=rapport_{rid}.pdf"})
