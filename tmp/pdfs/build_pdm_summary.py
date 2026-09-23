from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Preformatted
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/PDM_Workflow_and_Rules.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
YELLOW = colors.HexColor('#FFD400')
INK = colors.HexColor('#242629')
GREY = colors.HexColor('#62676C')
LIGHT = colors.HexColor('#F2F3F4')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleMain', fontName='Helvetica-Bold', fontSize=29, leading=33, textColor=INK, spaceAfter=16))
styles.add(ParagraphStyle(name='SubtitlePDM', fontName='Helvetica', fontSize=12, leading=18, textColor=GREY, spaceAfter=16))
styles.add(ParagraphStyle(name='SectionPDM', fontName='Helvetica-Bold', fontSize=18, leading=23, textColor=INK, spaceAfter=13))
styles.add(ParagraphStyle(name='SubPDM', fontName='Helvetica-Bold', fontSize=11.5, leading=16, textColor=INK, spaceBefore=10, spaceAfter=6))
styles.add(ParagraphStyle(name='BodyPDM', fontName='Helvetica', fontSize=9.5, leading=13.2, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name='BulletPDM', parent=styles['BodyPDM'], leftIndent=11, firstLineIndent=-9, spaceAfter=4))
styles.add(ParagraphStyle(name='CellPDM', parent=styles['BodyPDM'], fontSize=9, leading=12, spaceAfter=0))
styles.add(ParagraphStyle(name='SmallPDM', parent=styles['BodyPDM'], fontSize=8.5, leading=12, textColor=GREY))
story=[]
def p(text, style='BodyPDM'): return Paragraph(text, styles[style])
def body(text): story.append(p(text))
def sub(text): story.append(p(text,'SubPDM'))
def bullets(items):
    for item in items: story.append(p('- '+item,'BulletPDM'))
def table(headers, rows, widths):
    data=[[p('<b>'+x+'</b>','CellPDM') for x in headers]]+[[p(str(x),'CellPDM') for x in row] for row in rows]
    t=Table(data, colWidths=widths, hAlign='LEFT', repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),YELLOW),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('ROWBACKGROUNDS',(0,1),(-1,-1),[LIGHT,colors.white]),('LINEBELOW',(0,-1),(-1,-1),0.5,colors.HexColor('#D9DCDF'))]))
    story.append(t); story.append(Spacer(1,8))
def callout(text):
    t=Table([[p(text)]],colWidths=[504]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('LINEBEFORE',(0,0),(0,0),4,YELLOW),('LEFTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),5)]));story.append(t)
def page(title): story.append(PageBreak());story.append(p(title,'SectionPDM'))

story.append(Spacer(1,12))
story.append(p('PDM workflow<br/>and operating rules','TitleMain'))
story.append(p('Product Development App | re:3D<br/>Planning summary - September 23, 2026','SubtitlePDM'))
callout('<b>Purpose</b><br/>Maintain a trusted library of approved parts, assemblies, and drawings, with traceability to the changes that created them and the systems that use them.')
sub('01 / How the sections work together')
table(['Section','Responsibility'],[
('PDM Library','Released parts, assemblies, drawings, and preserved previous revisions.'),
('ECR / OCR','Proposed changes, development files, reviews, and links to affected parts.'),
('Systems','Machine versions and custom machines with exact approved configurations.'),
('Software','Software requests, bugs, and changes linked to features and systems.'),
('Odoo / Ops','Official production part numbers and names; decisions about retaining or changing numbers.'),
('Google Drive / app database','Drive stores files. The planned shared database stores identities, revisions, relationships, approvals, and history.')],[120,384])
body('<b>Core rule:</b> Each system references specific released revisions. It does not automatically adopt the newest revision of every part.')
sub('Document status')
body('This document consolidates the workflow and rules agreed in the planning discussion. The PDM library, controlled Drive storage, shared database, and release automation have not yet been implemented in the current prototype.')

page('02 / Development and release workflow')
table(['Step','Action'],[
('1. Start a change','Create or select an ECR/OCR. Select existing approved parts or create new part records.'),
('2. Prepare files','Copy the relevant released files into the ECR/OCR folder. Include referenced components needed by assemblies.'),
('3. Develop locally','Download through the app, edit in SolidWorks, and upload proposed files through the app.'),
('4. Review','Track working versions, verify identification and drawing coverage, and resolve overlapping changes.'),
('5. Approve','Engineering collectively approves the exact files, typically during an engineering meeting.'),
('6. Release','An authorized person separately selects Release. Publish the approved files and update only the selected system configurations.')],[100,404])
sub('File handling rules')
bullets(['The PDM library is protected from ordinary editing. Engineers work on copies in the ECR/OCR development folder.',
'Previous released files remain available. A new release must not erase or overwrite the historical release.',
'Browsing, copying, downloading, uploading, reviewing, and releasing should happen through the app. SolidWorks editing remains local.',
'Approval covers the exact reviewed files. Changes to those files require renewed approval.',
'An ECR/OCR must not be treated as successfully released until publication succeeds.'])
sub('Agreed change-folder structure')
story.append(Preformatted('ECR Number- Title/\n  CAD/\n    SLDASM/\n    SLDPRT/\n    STEP/\n    Drawing/\n      Machining/\n      Inspection/\n      Assembly/\n  Design Notes/\n  Supporting Files/',ParagraphStyle(name='CodePDM',fontName='Courier',fontSize=9,leading=12,textColor=INK)))
body('Use the same structure for OCRs, with the corresponding OCR number and title.')

page('03 / Part identity and naming')
sub('Internal identification before Odoo')
body('The app assigns the next available internal part number using the creator\'s initials. This extends the existing R&amp;D convention to production parts awaiting official Odoo identification.')
callout('<b>Development example</b><br/>[DC-20006] Slice Hotend Mount Rev0.1')
bullets(['Keep the internal identifier permanently, even if the owner changes or Ops later assigns an Odoo number.',
'Adding an Odoo number updates the same record. It does not create a new part or increase its revision.',
'Production parts receive official identification from Ops around ORR. R&amp;D, grant, and contract parts without official numbers retain their internal identifiers.',
'Each record preserves its originating ECR/OCR, later changes, files, approvals, and source part/revision when derived from another design.'])
sub('Official production naming')
body('Ops controls the official Odoo part number and name. Use this structure, with the applicable revision appended for CAD files:')
callout('[xxxxx] Part Name [State] [Machine] [Special modifier] Rev#<br/><br/><b>Example</b><br/>[11178] GB3+ Front Panel Bottom [Machined] [Reg/XL] [Gigabox] Rev1')
bullets(['Verify that the number and name match Odoo. Preserve the State, Machine, and applicable Special Modifier.',
'Use <b>Rev</b>, not REV.',
'Ops decides whether a changed design keeps its existing Odoo number or receives a new number.',
'Assigning the official number must not trigger uncontrolled CAD renaming. Any renaming must preserve assembly references.'])
sub('Revision or variant')
table(['Outcome','Identity and history'],[('Revise existing part','Keep the part identity and advance its revision. Retain the Odoo number if Ops agrees.'),('Create distinct variant','Assign a new internal identity with independent revision history. Preserve the source part, source revision, and ECR/OCR link.')],[130,374])

page('04 / Revisions, systems, and parallel changes')
sub('Part and assembly revision rules')
body('New parts and assemblies start development at <b>Rev0.1</b>. The first approved release becomes <b>Rev1</b>. Subsequent development uses working revisions before the next whole-number release.')
callout('<b>Example</b><br/>Released Rev4 &nbsp; &gt; &nbsp; Working Rev4.1 &nbsp; &gt; &nbsp; Working Rev4.2 &nbsp; &gt; &nbsp; Released Rev5')
bullets(['Preserve all previous released revisions and their authorizing ECR/OCR links.',
'Approval and publication are distinct. Approved files become released library files through the authorized Release action.'])
sub('New systems and machine configurations')
body('A system can combine unchanged released parts, newly developed parts, revisions of existing parts, independent variants, and linked software changes.')
bullets(['At release, explicitly select the machine versions or custom systems receiving the change.',
'Other configurations keep their existing revisions. GB5 may adopt a change while GB4 remains unchanged.',
'A part can be shared by multiple systems without receiving a new identity solely because it is reused.',
'A design release does not confirm that an already-built machine has been physically updated. Individual-machine retrofit tracking is a separate future capability.'])
sub('Concurrent ECRs / OCRs')
body('Multiple changes may modify the same source part simultaneously, including changes for different systems.')
bullets(['Flag overlapping changes and require reconciliation <b>before either affected change is released</b>.',
'Reconciliation confirms target systems, compatible or conflicting changes, and Ops\' numbering decision.',
'Reconciliation may produce separate variants; it does not require combining the designs.',
'One release must never silently replace another ECR\'s work.'])

page('05 / Drawings and drawing coverage')
body('Drawings have independent revisions and approvals. Allowed types are <b>Machining, Inspection, and Assembly</b>. Separate type folders distinguish drawings while preserving the official part name.')
table(['Field','Meaning'],[('PRT REV','Exact part or assembly revision documented by the drawing.'),('DWGREV','Approved revision of the drawing itself.'),('Filename Rev','The drawing revision for drawing files; the title block separately identifies the part revision.')],[110,394])
sub('Drawing revision rules')
bullets(['Development begins at <b>Rev0.1</b>; the first approved drawing release becomes <b>Rev1</b>.',
'Working uploads are tracked separately. Ten working uploads followed by approval advance the approved drawing revision only once.',
'Part and drawing revisions do not have to match. Different drawing types may also have different revisions.',
'Older approved drawings retain their original relationship and title-block information.'])
sub('Required review when a part changes')
table(['Decision','Required action'],[('Update required','Revise and approve the drawing.'),('Still applicable','Record Engineering approval that the unchanged drawing remains valid for the new part revision.'),('Not required','Record why this drawing type is unnecessary.')],[130,374])
body('<b>Release rule:</b> Every required drawing must be accounted for and approved for use with the part revision being released. A part does not automatically require all three drawing types.')
body('Changing the printed <b>PRT REV</b> changes the drawing file and requires approval. A still-applicable decision preserves the original file and records compatibility in the app; it does not silently change the title block.')
sub('Custom properties and title blocks')
bullets(['Fill model custom properties as completely as possible. Drawings obtain shared title-block information from those properties.',
'Parts, assemblies, and drawings retain separate Drawn, Checked, and Approved fields.',
'Drawing Type and drawing revision remain drawing-specific. Shared identification must agree with the part record and Odoo where applicable.'])

page('06 / Approval, release controls, and next decisions')
sub('Engineering approval')
body('Engineering approves collectively, typically during an engineering meeting. A person records the decision, meeting date, participants, and notes. The agreed workflow does not require every engineer to provide a separate digital sign-off.')
body('An authorized person separately selects <b>Release</b> to publish the approved package.')
sub('Required release checks')
bullets(['Engineering approval covers the exact files to be released.',
'Required Odoo identification is confirmed, or the part is classified as internal R&amp;D/contract work.',
'Concurrent changes have been reconciled.',
'Required drawing coverage is complete.',
'Target systems are explicitly selected.',
'Names, part revisions, drawing revisions, and associated records are consistent.'])
body('The release publishes approved files, records the release history, and updates the selected system configurations. Publication failures must not be represented as a completed release.')
sub('Implementation decisions still open')
table(['Topic','To be determined'],[('Permissions','Who can record Engineering approval and perform Release.'),('Internal numbering','Whether numeric sequences are shared globally or maintained separately per initials.'),('Existing records','How existing files, numbers, revisions, and configurations will be imported.'),('Storage and CAD references','Exact PDM library folder structure and assembly dependency handling.'),('Odoo connection','Manual identification entry initially versus a later integration.'),('SolidWorks automation','Which transfers, metadata checks, exports, and naming operations a future companion or add-in will automate.')],[125,379])
story.append(Spacer(1,8))
callout('<b>Implementation boundary</b><br/>These are planned operating rules. The current app remains a prototype; shared storage, controlled releases, and integrations require implementation before this can serve as the production PDM library.')
story.append(Spacer(1,9))
story.append(p('Basis: user-provided CAD naming rules, Ops naming policy (last revised May 25, 2023), drawing title-block example, and confirmed workflow decisions in this planning discussion.','SmallPDM'))

def decorate(canvas, doc):
    canvas.setFillColor(INK);canvas.setFont('Helvetica-Bold',9);canvas.drawString(54,754,'re:3D  /  PRODUCT DEVELOPMENT')
    canvas.setFillColor(YELLOW);canvas.rect(54,739,504,3,fill=1,stroke=0)
    canvas.setStrokeColor(colors.HexColor('#D9DCDF'));canvas.line(54,43,558,43)
    canvas.setFillColor(GREY);canvas.setFont('Helvetica',8);canvas.drawString(54,29,'PDM WORKFLOW & RULES  |  PLANNING SUMMARY  |  23 SEP 2026')
    canvas.drawRightString(558,29,str(doc.page))

doc=SimpleDocTemplate(str(OUT),pagesize=(612,792),rightMargin=54,leftMargin=54,topMargin=65,bottomMargin=57,title='PDM Workflow and Operating Rules',author='re:3D',subject='Planned PDM workflows, naming, revisions, drawings, approvals and releases')
doc.build(story,onFirstPage=decorate,onLaterPages=decorate)
reader=PdfReader(str(OUT))
print('Created',OUT,'pages:',len(reader.pages))
for i,page in enumerate(reader.pages): print(i+1,len(page.extract_text()),page.extract_text().splitlines()[2:4])

