# -*- coding: utf-8 -*-
"""《暗蚀牌序》美术需求文档 → Word(.docx) + Excel 资源清单(.xlsx)
用法：python scripts/generate_art_docs.py
"""
import re
from pathlib import Path

from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / '美术需求文档.md'
DOCX_OUT = ROOT / 'docs' / '美术需求文档.docx'
XLSX_OUT = ROOT / 'docs' / '美术资源清单.xlsx'

ACCENT = RGBColor(0xC9, 0xA2, 0x27)
DARK = RGBColor(0x0A, 0x0A, 0x0E)
DIM = RGBColor(0x55, 0x50, 0x5F)


def parse_md(text: str):
    """把 markdown 解析成块列表：{type, content|rows}"""
    blocks = []
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            i += 1
            continue
        # 表格
        if line.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s\-:|]+\|$', lines[i + 1].strip()):
            header = [c.strip() for c in line.strip('|').split('|')]
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
                i += 1
            blocks.append({'type': 'table', 'header': header, 'rows': rows})
            continue
        # 标题
        m = re.match(r'^(#{1,4})\s+(.*)', line)
        if m:
            blocks.append({'type': 'h', 'level': len(m.group(1)), 'text': m.group(2).strip()})
            i += 1
            continue
        # 列表
        m = re.match(r'^[-*]\s+(.*)', line)
        if m:
            items = [m.group(1).strip()]
            i += 1
            while i < len(lines) and re.match(r'^[-*]\s+', lines[i]):
                items.append(re.sub(r'^[-*]\s+', '', lines[i]).strip())
                i += 1
            blocks.append({'type': 'list', 'items': items})
            continue
        # 代码块
        if line.startswith('```'):
            i += 1
            code = []
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(lines[i])
                i += 1
            i += 1
            blocks.append({'type': 'code', 'text': '\n'.join(code)})
            continue
        blocks.append({'type': 'p', 'text': line.strip()})
        i += 1
    return blocks


def set_cn_font(run, size=None, bold=None, color=None, name='微软雅黑'):
    run.font.name = name
    run._element.rPr.rFonts.set(qn('w:eastAsia'), name)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if color:
        run.font.color.rgb = color


def build_docx(blocks):
    doc = Document()
    # 页面边距
    for sec in doc.sections:
        sec.top_margin = Cm(2.0)
        sec.bottom_margin = Cm(2.0)
        sec.left_margin = Cm(2.2)
        sec.right_margin = Cm(2.2)

    style = doc.styles['Normal']
    style.font.name = '微软雅黑'
    style._element.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')
    style.font.size = Pt(10.5)

    for b in blocks:
        if b['type'] == 'h':
            h = doc.add_heading('', level=min(b['level'], 3))
            run = h.add_run(b['text'])
            set_cn_font(run, size={1: 18, 2: 14, 3: 12}.get(b['level'], 11), bold=True,
                        color=ACCENT if b['level'] == 1 else DARK)
        elif b['type'] == 'p':
            p = doc.add_paragraph()
            # 加粗 **xxx** 片段
            parts = re.split(r'(\*\*[^*]+\*\*)', b['text'])
            for part in parts:
                if part.startswith('**') and part.endswith('**'):
                    run = p.add_run(part[2:-2])
                    set_cn_font(run, bold=True)
                else:
                    run = p.add_run(part)
                    set_cn_font(run)
            p.paragraph_format.space_after = Pt(4)
        elif b['type'] == 'list':
            for item in b['items']:
                p = doc.add_paragraph(style='List Bullet')
                run = p.add_run(item)
                set_cn_font(run, size=10.5)
                p.paragraph_format.space_after = Pt(2)
        elif b['type'] == 'table':
            n_cols = len(b['header'])
            table = doc.add_table(rows=1 + len(b['rows']), cols=n_cols)
            table.style = 'Table Grid'
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            # 表头
            for j, cell_text in enumerate(b['header']):
                cell = table.cell(0, j)
                cell.text = ''
                run = cell.paragraphs[0].add_run(cell_text)
                set_cn_font(run, size=9.5, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
                shd = cell._element.get_or_add_tcPr()
                from docx.oxml import OxmlElement
                el = OxmlElement('w:shd')
                el.set(qn('w:val'), 'clear')
                el.set(qn('w:fill'), '34344A')
                shd.append(el)
            # 内容
            for i, row in enumerate(b['rows']):
                for j, cell_text in enumerate(row):
                    cell = table.cell(i + 1, j)
                    cell.text = ''
                    run = cell.paragraphs[0].add_run(cell_text)
                    set_cn_font(run, size=9.5)
            doc.add_paragraph()
        elif b['type'] == 'code':
            for line in b['text'].split('\n'):
                p = doc.add_paragraph()
                run = p.add_run(line)
                run.font.name = 'Consolas'
                run._element.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')
                run.font.size = Pt(9)
                run.font.color.rgb = DIM
                p.paragraph_format.space_after = Pt(0)

    doc.save(DOCX_OUT)
    print(f'[OK] Word 已生成: {DOCX_OUT.name} ({DOCX_OUT.stat().st_size // 1024} KB)')


def build_xlsx(blocks):
    wb = Workbook()
    ws = wb.active
    ws.title = '资源清单'

    header = ['类别', '资源名称', '建议尺寸(px)', '使用位置', '数量', '优先级', '备注']
    ws.append(header)
    header_fill = PatternFill('solid', fgColor='34344A')
    header_font = Font(name='微软雅黑', size=10, bold=True, color='FFFFFF')
    for c in ws[1]:
        c.fill = header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal='center', vertical='center')

    # 从 markdown 的"总览清单"和"分辨率与尺寸规范"表提取数据
    rows_data = []
    total = None
    dims = None
    priority = {}

    in_total = False
    in_dims = False
    for line in SRC.read_text(encoding='utf-8').split('\n'):
        line = line.strip()
        if line == '## 一、总览清单':
            in_total = True
            in_dims = False
            continue
        if line == '## 二、分辨率与尺寸规范':
            in_total = False
            in_dims = True
            continue
        if line.startswith('## ') and line not in ('## 一、总览清单', '## 二、分辨率与尺寸规范'):
            in_total = False
            in_dims = False
        if in_total and line.startswith('|') and not line.startswith('|---'):
            cells = [c.strip() for c in line.strip('|').split('|')]
            if cells[0] not in ('类别', '') and len(cells) >= 5:
                total = cells
        if in_dims and line.startswith('|') and not line.startswith('|---'):
            cells = [c.strip() for c in line.strip('|').split('|')]
            if cells[0] not in ('资源', '') and len(cells) >= 4:
                dims = cells
    # 解析优先级段落
    prio_text = SRC.read_text(encoding='utf-8')
    prio_map = {'P0': 'P0', 'P1': 'P1', 'P2': 'P2'}
    for line in prio_text.split('\n'):
        if 'P0' in line and '卡牌底框' in line:
            priority['卡牌'] = 'P0'
        if 'P0' in line and '头像' in line:
            priority['英雄头像'] = 'P0'
        if 'P1' in line and '标题' in line:
            priority['游戏标题画面'] = 'P1'

    if total:
        rows_data.append(['总览', total[1], '—', total[2], total[3], prio_map.get(total[1], 'P2'), total[4]])
    if dims:
        for row in [dims]:
            pass
        # 尺寸表直接整表放入
        for line in SRC.read_text(encoding='utf-8').split('\n'):
            line = line.strip()
            if line.startswith('|') and not line.startswith('|---') and not line.startswith('| 资源'):
                cells = [c.strip() for c in line.strip('|').split('|')]
                if len(cells) >= 5 and cells[0] not in ('资源', '类别', ''):
                    rows_data.append(['尺寸规范', cells[0], cells[1], cells[2], '—', 'P1', cells[3]])

    for row in rows_data:
        ws.append(row)

    # 敌人清单
    ws.append([])
    ws.append(['敌人美术清单', '', '', '', '', '', ''])
    ws.append(['类别', '资源名称', '建议尺寸(px)', '使用位置', '数量', '优先级', '备注'])
    enemy_section = re.search(r'## 五、敌人美术清单（区域一全量 \+ 占位）\n(.*?)(?=\n## )', prio_text, re.S)
    if enemy_section:
        for line in enemy_section.group(1).split('\n'):
            line = line.strip()
            if line.startswith('|') and not line.startswith('|---'):
                cells = [c.strip() for c in line.strip('|').split('|')]
                if cells[0] not in ('敌人', '') and len(cells) >= 4:
                    ws.append(['敌人', cells[0], cells[1], '战斗界面', cells[2], 'P0', cells[3]])

    # 列宽
    widths = [10, 20, 16, 22, 8, 8, 40]
    for i, w in enumerate(widths):
        ws.column_dimensions[chr(65 + i)].width = w
    for row in ws.iter_rows():
        for c in row:
            c.font = Font(name='微软雅黑', size=10)
            c.alignment = Alignment(vertical='center', wrap_text=True)
    thin = Side(style='thin', color='999999')
    for row in ws.iter_rows():
        for c in row:
            c.border = Border(left=thin, right=thin, top=thin, bottom=thin)

    wb.save(XLSX_OUT)
    print(f'[OK] Excel 已生成: {XLSX_OUT.name} ({XLSX_OUT.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    text = SRC.read_text(encoding='utf-8')
    blocks = parse_md(text)
    build_docx(blocks)
    build_xlsx(blocks)
    print('完成，文件位于 docs/ 目录')
