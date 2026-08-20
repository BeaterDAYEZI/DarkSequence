// 地图事件节点：餐车记忆 + 占位事件
import type { EventDef, TargetSelector } from '../core/types';

const ALLY_ALL: TargetSelector = { side: 'ally', mode: 'all' };
const ALLY_LOWEST: TargetSelector = { side: 'ally', mode: 'lowestHpAlly' };

export const EVENTS: EventDef[] = [
  {
    id: 'event_diningcar',
    title: '餐车记忆',
    text: '车轮与铁轨的摩擦声突然变了调子。餐车里，一盏锈蚀的吊灯自己亮了起来。某位英雄在灯光下想起了生前的一些碎片……',
    choices: [
      {
        text: '倾听记忆（全队恢复5点生命，随机英雄+10狂气）',
        effects: [
          { kind: 'heal', target: ALLY_ALL, amount: 5 },
          { kind: 'madnessGain', target: { side: 'ally', mode: 'random', count: 1 }, amount: 10 },
        ],
        note: '记忆既是慰藉，也是负担。',
      },
      {
        text: '转身离开（+8执念值）',
        effects: [],
        note: '有些门，还是不打开为好。',
      },
    ],
  },
  {
    id: 'event_trackscrap',
    title: '遗骸与碎屑',
    text: '铁轨旁躺着一具远征队残骸，蚀雾还没有完全吞掉他的行囊。',
    choices: [
      {
        text: '搜刮行囊（+10残响碎片）',
        effects: [],
        note: '死者不会介意的。大概。',
      },
      {
        text: '为他合上眼睛（+12执念值）',
        effects: [],
        note: '愿他的残响安息。',
      },
    ],
  },
  {
    id: 'event_trackghost',
    title: '轨道幽灵',
    text: '一个半透明的身影站在岔道中央，手里握着一把生锈的扳道闸。他朝列车伸出手——像是在讨要什么。',
    choices: [
      {
        text: '付出20魂火，让他铺一条临时支线（下一场战斗敌人-1）',
        effects: [{ kind: 'soulfireSteal', amount: 20 }],
        note: '支线通往哪里，连他也不知道。',
      },
      {
        text: '鸣笛致意，直接通过（+5执念值）',
        effects: [],
        note: '汽笛声穿过他的身体，像穿过一团雾。',
      },
    ],
  },
  {
    id: 'event_foggifts',
    title: '蚀雾的礼物',
    text: '蚀雾在车厢缝隙间凝聚，凝结成几块晶莹的黑色晶体，又像是某种内脏。',
    choices: [
      {
        text: '收下凝晶（+1蚀刻剂）',
        effects: [],
        note: '蚀雾的馈赠从来都有代价，只是还没到支付的时候。',
      },
      {
        text: '把凝晶丢出车外（治疗伤势最重的英雄12点）',
        effects: [{ kind: 'heal', target: ALLY_LOWEST, amount: 12 }],
        note: '晶体落地时，发出了一声微弱的叹息。',
      },
    ],
  },
];
