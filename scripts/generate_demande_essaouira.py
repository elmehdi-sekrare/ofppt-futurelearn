from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


OUT = Path("docs/candidature")
FILE = OUT / "Demande_manuscrite_EST_Essaouira_EL_MEHDI_SEKRARE.docx"


def run(text, bold=False):
    props = (
        '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'
        '<w:sz w:val="24"/><w:szCs w:val="24"/>'
        + ('<w:b/>' if bold else '') + '</w:rPr>'
    )
    chunks = text.split("\t")
    runs = []
    for index, chunk in enumerate(chunks):
        if chunk:
            runs.append(f'<w:r>{props}<w:t xml:space="preserve">{escape(chunk)}</w:t></w:r>')
        if index < len(chunks) - 1:
            runs.append(f'<w:r>{props}<w:tab/></w:r>')
    return ''.join(runs)


def paragraph(runs=(), align="left", first_line=0, after=120, before=0, right_tab=False):
    tab = '<w:tabs><w:tab w:val="right" w:pos="9072"/></w:tabs>' if right_tab else ''
    props = (
        f'<w:pPr><w:jc w:val="{align}"/>{tab}'
        f'<w:ind w:firstLine="{first_line}"/>'
        f'<w:spacing w:before="{before}" w:after="{after}" w:line="276" w:lineRule="auto"/>'
        '</w:pPr>'
    )
    contents = ''.join(run(text, bold) for text, bold in runs)
    return f'<w:p>{props}{contents}</w:p>'


def blank_line():
    # A genuine blank line with the same 1.15 line-height as the document.
    return paragraph((), after=0)


def create_docx():
    OUT.mkdir(parents=True, exist_ok=True)

    header = [
        paragraph([
            ("EL MEHDI SEKRARE", False),
            ("\t", False),
            ("Benslimane, le 02 août 2026", False),
        ], after=0, right_tab=True),
        paragraph([("CNE : ", True), ("F145033957", False)], after=0),
        paragraph([("Adresse :", True)], after=0),
        paragraph([("Shems Medina,", False)], after=0),
        paragraph([("Immeuble 19, Appartement 6", False)], after=0),
        paragraph([("Benslimane, Maroc", False)], after=0),
        paragraph([], after=0),
        paragraph([("Téléphone :", True)], after=0),
        paragraph([("0700214282", False)], after=0),
        paragraph([], after=0),
        paragraph([("E-mail :", True)], after=0),
        paragraph([("elmehdisekrare@gmail.com", False)], after=0),
    ]

    recipient = [
        blank_line(), blank_line(),
        paragraph([("À Monsieur le Directeur de", False)], align="center", after=0),
        paragraph([("l'École Supérieure de Technologie d'Essaouira", False)], align="center", after=0),
        paragraph([("Université Cadi Ayyad", False)], align="center", after=0),
        blank_line(),
        paragraph([("Objet : Demande de candidature au Bachelor de l'École Supérieure de Technologie d'Essaouira", True)], after=0),
        blank_line(),
        paragraph([("Monsieur le Directeur,", False)], after=120),
    ]

    body = [
        paragraph([("J'ai l'honneur de solliciter votre haute bienveillance afin de bien vouloir accepter ma candidature pour l'accès au Bachelor de l'École Supérieure de Technologie d'Essaouira au titre de l'année universitaire 2026/2027.", False)], align="both", first_line=709),
        paragraph([("Je suis titulaire d'un Diplôme de Technicien Spécialisé (DTS) en Développement Digital – Option Web Full Stack, obtenu en 2026 à l'Institut Spécialisé de Technologie Appliquée de Ben Slimane (OFPPT). Au cours de ma formation, j'ai obtenu une moyenne de 15,82/20 en première année et de 18,54/20 en deuxième année, avec une moyenne générale de 16,10/20, ce qui témoigne de mon sérieux, de mon assiduité et de mon engagement dans mes études.", False)], align="both", first_line=709),
        paragraph([("Passionné par les nouvelles technologies, le développement logiciel et les systèmes informatiques, je souhaite poursuivre mes études supérieures afin d'approfondir mes connaissances, développer mes compétences techniques et renforcer mon parcours académique. Je suis convaincu que la formation dispensée au sein de votre établissement me permettra d'atteindre mes objectifs académiques et professionnels.", False)], align="both", first_line=709),
        paragraph([("Je joins à cette demande l'ensemble des pièces exigées pour la constitution de mon dossier de candidature.", False)], align="both", first_line=709),
        paragraph([("Dans l'attente d'une réponse favorable de votre part, je vous prie d'agréer, Monsieur le Directeur, l'expression de ma haute considération.", False)], align="both", first_line=709),
    ]

    signature = [
        blank_line(), blank_line(), blank_line(), blank_line(), blank_line(),
        paragraph([("Signature", False)], align="right", after=0),
        blank_line(), blank_line(), blank_line(),
        paragraph([("EL MEHDI SEKRARE", False)], align="right", after=0),
    ]

    document = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>{''.join(header + recipient + body + signature)}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/>
      <w:docGrid w:linePitch="276"/>
    </w:sectPr>
  </w:body>
</w:document>'''

    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'''
    root_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'''
    document_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'''
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="000000"/><w:lang w:val="fr-MA"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>'''
    core = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Demande manuscrite — EST Essaouira</dc:title><dc:creator>EL MEHDI SEKRARE</dc:creator><dc:subject>Demande de candidature au Bachelor</dc:subject><dc:language>fr-MA</dc:language></cp:coreProperties>'''
    app = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office Word</Application></Properties>'''

    with ZipFile(FILE, "w", ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types)
        docx.writestr("_rels/.rels", root_rels)
        docx.writestr("docProps/core.xml", core)
        docx.writestr("docProps/app.xml", app)
        docx.writestr("word/document.xml", document)
        docx.writestr("word/styles.xml", styles)
        docx.writestr("word/_rels/document.xml.rels", document_rels)
    print(FILE)


if __name__ == "__main__":
    create_docx()
