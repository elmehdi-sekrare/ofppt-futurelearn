from pathlib import Path
import re
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer


OUT = Path("docs/candidature")
DOCX = OUT / "Demande_manuscrite_EL_MEHDI_SEKRARE.docx"
PDF = OUT / "Demande_manuscrite_EL_MEHDI_SEKRARE.pdf"
UNIVERSITY = "{{UNIVERSITÉ / ÉCOLE}}"

FONT_DIR = Path(r"C:\Windows\Fonts")
pdfmetrics.registerFont(TTFont("TimesNewRoman", str(FONT_DIR / "times.ttf")))
pdfmetrics.registerFont(TTFont("TimesNewRoman-Bold", str(FONT_DIR / "timesbd.ttf")))
pdfmetrics.registerFont(TTFont("TimesNewRoman-Italic", str(FONT_DIR / "timesi.ttf")))

TITLE = "DEMANDE MANUSCRITE DE CANDIDATURE"
PROGRAM = "Bachelor en Ingénierie Informatique en Intelligence Artificielle et Sciences des Données (3IASD)"
SUBJECT = "Objet : Demande de candidature au Bachelor"
DATE_LINE = "Ben Slimane, le 2 août 2026"

BODY = [
    "Monsieur le Directeur,",
    "J’ai l’honneur de solliciter votre bienveillance afin de bien vouloir accepter ma candidature au <b>" + PROGRAM + "</b>, au sein de votre établissement.",
    "Titulaire du <b>Diplôme de Technicien Spécialisé (DTS)</b> en <b>Développement Digital – Option Web Full Stack</b>, obtenu en 2026 à l’Institut Spécialisé de Technologie Appliquée Ben Slimane (OFPPT), j’ai mené mon parcours avec assiduité et ambition. Mes résultats, de <b>15,82/20</b> en première année et <b>18,54/20</b> en deuxième année, témoignent de mon sérieux et de mon engagement. Je suis également titulaire d’un baccalauréat obtenu en 2024, avec la mention <b>Assez Bien</b>.",
    "Passionné par l’ingénierie logicielle, le développement web et l’intelligence artificielle, je souhaite poursuivre mes études afin de consolider mes compétences scientifiques et techniques, et de me préparer au métier d’ingénieur. Je suis particulièrement attiré par les domaines de la donnée et de l’intelligence artificielle, qui constituent à mes yeux des leviers essentiels de l’innovation numérique.",
    "Motivé, sérieux, autonome et toujours désireux d’apprendre, je suis convaincu que ce Bachelor correspond parfaitement à mon parcours académique ainsi qu’à mon projet professionnel. Il me permettra d’approfondir mes connaissances, de relever de nouveaux défis et de développer les compétences nécessaires pour contribuer, avec rigueur et créativité, aux projets technologiques de demain.",
    "Dans l’attente d’une réponse favorable, je vous prie d’agréer, Monsieur le Directeur, l’expression de ma très haute considération.",
]


def p_xml(text="", align="both", bold=False, size=24, space_before=0, space_after=0,
          border=False, keep=False):
    jc = {"left": "left", "right": "right", "center": "center", "both": "both"}[align]
    border_xml = ('<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="6" w:color="AEB7C2"/></w:pBdr>' if border else "")
    keep_xml = "<w:keepNext/>" if keep else ""
    properties = (
        f'<w:pPr><w:jc w:val="{jc}"/><w:spacing w:before="{space_before}" w:after="{space_after}" w:line="360" w:lineRule="auto"/>'
        f'{border_xml}{keep_xml}</w:pPr>'
    )
    if not text:
        return f'<w:p>{properties}</w:p>'
    runs = []
    for part in re.split(r"(<b>.*?</b>)", text):
        if not part:
            continue
        is_bold = bold or (part.startswith("<b>") and part.endswith("</b>"))
        visible_text = part[3:-4] if part.startswith("<b>") and part.endswith("</b>") else part
        runprops = (
            f'<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'
            f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>{"<w:b/>" if is_bold else ""}</w:rPr>'
        )
        runs.append(f'<w:r>{runprops}<w:t xml:space="preserve">{escape(visible_text)}</w:t></w:r>')
    return f'<w:p>{properties}{"".join(runs)}</w:p>'


def create_docx():
    OUT.mkdir(parents=True, exist_ok=True)
    paras = [
        p_xml(TITLE, align="center", bold=True, size=28, space_after=70, border=True, keep=True),
        p_xml(DATE_LINE, align="right", size=24, space_after=240),
        p_xml("À Monsieur le Directeur de " + UNIVERSITY, align="left", size=24, space_after=75, keep=True),
        p_xml(SUBJECT, align="left", bold=True, size=24, space_after=210, border=True, keep=True),
    ]
    for i, paragraph in enumerate(BODY):
        if i == 0:
            paras.append(p_xml(paragraph, align="left", size=24, space_after=180, keep=True))
        elif i == len(BODY) - 1:
            paras.append(p_xml(paragraph, align="both", size=24, space_after=0))
        else:
            paras.append(p_xml(paragraph, align="both", size=24, space_after=100))
    paras += [
        p_xml("", space_after=390),
        p_xml("Signature", align="right", size=24, space_after=360),
        p_xml("Nom : EL MEHDI SEKRARE", align="left", size=22, space_after=20, border=True, keep=True),
        p_xml("CNE : F145033957", align="left", size=22, space_after=20),
        p_xml("Téléphone : 0700214282", align="left", size=22, space_after=20),
        p_xml("Email : elmehdisekrare@gmail.com", align="left", size=22, space_after=0),
    ]
    document_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>{''.join(paras)}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
<w:docGrid w:linePitch="360"/></w:sectPr></w:body></w:document>'''
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>'''
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'''
    root_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'''
    doc_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'''
    core = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Demande manuscrite de candidature</dc:title><dc:creator>EL MEHDI SEKRARE</dc:creator><dc:subject>Candidature au Bachelor 3IASD</dc:subject><dc:language>fr-MA</dc:language></cp:coreProperties>'''
    app = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>'''
    with ZipFile(DOCX, "w", ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", root_rels)
        z.writestr("docProps/core.xml", core)
        z.writestr("docProps/app.xml", app)
        z.writestr("word/document.xml", document_xml)
        z.writestr("word/styles.xml", styles)
        z.writestr("word/_rels/document.xml.rels", doc_rels)


def create_pdf():
    doc = SimpleDocTemplate(str(PDF), pagesize=A4, leftMargin=2.0 * cm, rightMargin=2.0 * cm,
                            topMargin=1.8 * cm, bottomMargin=1.8 * cm)
    styles = {
        "title": ParagraphStyle("title", fontName="TimesNewRoman-Bold", fontSize=14, leading=17,
                                alignment=TA_CENTER, textColor=HexColor("#1F2B3A"), spaceAfter=8),
        "date": ParagraphStyle("date", fontName="TimesNewRoman", fontSize=12, leading=15,
                               alignment=TA_RIGHT, spaceAfter=20),
        "address": ParagraphStyle("address", fontName="TimesNewRoman", fontSize=12, leading=15,
                                  spaceAfter=7),
        "subject": ParagraphStyle("subject", fontName="TimesNewRoman-Bold", fontSize=12, leading=15,
                                  spaceAfter=16),
        "body": ParagraphStyle("body", fontName="TimesNewRoman", fontSize=12, leading=16,
                                alignment=TA_JUSTIFY, spaceAfter=10),
        "greeting": ParagraphStyle("greeting", fontName="TimesNewRoman", fontSize=12, leading=17,
                                    spaceAfter=14),
        "signature": ParagraphStyle("signature", fontName="TimesNewRoman", fontSize=12, leading=15,
                                     alignment=TA_RIGHT),
        "contact": ParagraphStyle("contact", fontName="TimesNewRoman", fontSize=11, leading=14,
                                   spaceAfter=1),
    }
    story = [
        Paragraph(TITLE, styles["title"]),
        HRFlowable(width="100%", thickness=0.7, color=HexColor("#AEB7C2"), spaceAfter=18),
        Paragraph(DATE_LINE, styles["date"]),
        Paragraph("À Monsieur le Directeur de " + UNIVERSITY, styles["address"]),
        HRFlowable(width="100%", thickness=0.55, color=HexColor("#AEB7C2"), spaceBefore=1, spaceAfter=10),
        Paragraph(SUBJECT, styles["subject"]),
        Paragraph(BODY[0], styles["greeting"]),
    ]
    for paragraph in BODY[1:]:
        story.append(Paragraph(paragraph, styles["body"]))
    story += [
        Spacer(1, 0.7 * cm),
        Paragraph("Signature", styles["signature"]),
        Spacer(1, 0.9 * cm),
        HRFlowable(width="100%", thickness=0.55, color=HexColor("#AEB7C2"), spaceAfter=8),
        Paragraph("Nom : EL MEHDI SEKRARE", styles["contact"]),
        Paragraph("CNE : F145033957", styles["contact"]),
        Paragraph("Téléphone : 0700214282", styles["contact"]),
        Paragraph("Email : elmehdisekrare@gmail.com", styles["contact"]),
    ]
    doc.build(story)


if __name__ == "__main__":
    create_docx()
    create_pdf()
    print(DOCX)
    print(PDF)
