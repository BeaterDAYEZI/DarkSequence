# -*- coding: utf-8 -*-
"""资源清单.xlsx 生成器：硬编码完整版（界面/英雄/卡牌/敌人/列车地图/UI/特效）"""
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
XLSX_OUT = ROOT / 'docs' / '美术资源清单.xlsx'


def build_xlsx():
    wb = Workbook()
    ws = wb.active
    ws.title = '资源清单'
    HEADER = ['类别', '资源名称', '建议尺寸(px)', '实际显示尺寸(px)', '使用位置', '数量', '优先级', '备注']
    header_fill = PatternFill('solid', fgColor='34344A')
    header_font = Font(name='微软雅黑', size=10, bold=True, color='FFFFFF')
    thin = Side(style='thin', color='999999')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    def style_header():
        for c in ws[1]:
            c.fill = header_fill
            c.font = header_font
            c.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            c.border = border

    def add_row(row):
        ws.append(row)
        for j, v in enumerate(row, 1):
            c = ws.cell(ws.max_row, j)
            c.font = Font(name='微软雅黑', size=10)
            c.alignment = Alignment(vertical='center', wrap_text=True)
            c.border = border

    def section(title):
        ws.append([title])
        ws.merge_cells(start_row=ws.max_row, start_column=1, end_row=ws.max_row, end_column=8)
        c = ws.cell(ws.max_row, 1)
        c.font = Font(name='微软雅黑', size=11, bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor='8A6D1D')
        c.alignment = Alignment(horizontal='center', vertical='center')

    ws.append(HEADER)
    style_header()

    section('一、界面与背景（P1-P2）')
    for r in [
        ['界面', '游戏标题背景', '1920x1080', '全屏铺满', '标题画面', '1张', 'P1', '蚀雾中的幽灵铁轨全景，底部留12%给列车剪影'],
        ['界面', '标题LOGO《暗蚀牌序》', '-', '居中', '标题画面', '1个', 'P1', '暗金描边工业哥特字体，透明底PNG'],
        ['界面', '区域背景x5', '1920x1080', '全屏铺满', '地图界面', '5张', 'P1', '枯黄平原/蚀雾沼泽/灰烬隘口/断桥深渊/星蚀山麓'],
        ['界面', '胜利结算背景', '1920x1080', '全屏', '结算界面', '1张', 'P2', '星蚀山顶氛围图'],
        ['界面', '败北结算背景', '1920x1080', '全屏', '结算界面', '1张', 'P2', '列车停摆蚀雾图'],
        ['界面', '列车车头剪影', '1600x400', '底部100%宽', '全游戏底部', '1张', 'P1', '纯黑剪影+暗金车灯，底部贴合'],
    ]:
        add_row(r)

    section('二、英雄（P0头像，P1立绘）')
    for name in ['沃里克·守夜人', '摩根·行刑者', '塞拉芬娜·鸣钟者', '奥瑞斯·观星者']:
        add_row(['英雄', name + ' 半身立绘', '800x1200', '240~360px高', '战斗/营地', '1张', 'P1', '透明底PNG，人物占画面70%'])
        add_row(['英雄', name + ' 头像', '256x256', '56x56圆形', '战斗/结算', '1张', 'P0', '头部居中占80%，圆形裁切'])

    section('三、卡牌（P0底框，P2插画）')
    for r in [
        ['卡牌', '品质底框x4（白/绿/蓝/橙）', '500x700', '92x104', '手牌/牌库', '4张', 'P0', '工业哥特边框，中间留白给插画'],
        ['卡牌', '卡背', '500x700', '92x104', '牌库', '1张', 'P0', '蚀铁纹路+骷髅齿轮'],
        ['卡牌', '专属卡插画', '500x320', '卡牌上半部', '手牌', '20张', 'P2', '4英雄x5谱系，同谱系改色调即可'],
        ['卡牌', '遗物卡插画', '500x320', '卡牌上半部', '手牌', '30+张', 'P2', '泛用/流派/风险各系列风格统一'],
    ]:
        add_row(r)

    section('四、敌人（P0普通怪，P1精英/Boss）')
    for r in [
        ['敌人', '锈蚀稻草人', '512x512', '150x150', '1号位怪', '1', 'P0', '锈镰刀+稻草，身形佝偻'],
        ['敌人', '哀嚎游魂', '512x512', '150x150', '4号位怪', '1', 'P0', '半透明灵体，长袍'],
        ['敌人', '蚀化猎犬', '512x512', '150x150', '1-2号位怪', '1', 'P0', '骨甲犬，蚀化皮肉'],
        ['敌人', '迷雾徘徊者', '512x512', '150x150', '2-3号位怪', '1', 'P0', '半透明暗影轮廓'],
        ['敌人', '被诅咒的枕木', '512x512', '150x150', '1-3号位怪', '1', 'P0', '枕木组成的扭曲生物'],
        ['敌人', '被缚的双子（笑/哭）', '512x512', '150x150', '2/3号位精英', '2', 'P1', '铁链拴着的双胞胎调度员'],
        ['敌人', '残响牧羊人（Boss）', '1024x1024', '300x300', '车尾Boss', '1', 'P1', '骑铁轨蠕虫，两阶段2张形态'],
        ['敌人', '蚀影系列占位怪', '512x512', '150x150', '区域2-5', '5', 'P2', '通用暗影怪物剪影可复用'],
    ]:
        add_row(r)

    section('五、列车与地图（P0车厢，P1背景）')
    for r in [
        ['列车', '车厢顶部x4', '800x400', '战斗1/4宽', '战斗界面', '4张', 'P0', '锈蚀铁板+符文锁链，编号灯1-4'],
        ['列车', '铁轨纹理', '平铺', '无限平铺', '战斗中线/地图', '1张', 'P2', '半透明亡灵骨骼质感'],
        ['地图', '节点图标x7', '128x128', '52x52', '地图界面', '7个', 'P0', '遭遇战/精英/事件/调度站/岔道/Boss/起点'],
        ['地图', '岔道轨道（左/右）', '-', '-', '地图界面', '2张', 'P1', '左轨暗红/右轨暗蓝'],
        ['地图', '小列车位置图标', '128x128', '40x40', '地图界面', '1个', 'P1', '车头朝上的小列车'],
    ]:
        add_row(r)

    section('六、UI组件（P0）')
    for r in [
        ['UI', '蒸汽压力表', '256x256', '110px宽', '战斗顶栏', '1张', 'P0', '蒸汽表盘，指针代码旋转'],
        ['UI', '主按钮x2（开始/通用）', '512x128', '自适应', '全界面', '2张', 'P0', '工业铆钉边框'],
        ['UI', '品质/费用角标', '64x64', '16x16', '卡牌左上', '1套', 'P0', '菱形费用角标'],
        ['UI', '魂火/能量/狂气图标', '64x64', '20x20', '战斗顶栏', '3个', 'P0', '炉火/闪电/眼睛'],
    ]:
        add_row(r)

    section('七、特效（P2，可CSS/Canvas占位）')
    for name, desc in [('觉醒', '金色蒸汽喷涌+轮廓金边'), ('暴走', '红色爆裂+暗金喷焰'),
                       ('暴击', '白色刀光十字'), ('溢伤连锁', '暗紫能量流+数值弹出'),
                       ('闪避', '残影位移'), ('魂火获得', '炉火火星粒子')]:
        add_row(['特效', name, '-', '-', '战斗内', '1套', 'P2', desc])

    widths = [8, 24, 14, 16, 16, 10, 8, 40]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = 'A2'
    wb.save(XLSX_OUT)
    print(f'[OK] Excel 已生成: {XLSX_OUT.name} ({XLSX_OUT.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    build_xlsx()
