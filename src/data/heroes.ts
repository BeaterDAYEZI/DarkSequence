// 四名残响者英雄定义
import type { HeroDef } from '../core/types';

export const HEROES: HeroDef[] = [
  {
    id: 'warwick',
    name: '沃里克',
    title: '守夜人',
    color: '#8c6d3f',
    defaultCarriage: 1,
    baseHp: 55,
    baseStats: { attack: 8, block: 10, critRate: 5 },
    attackType: 'melee',
    damageType: 'physical',
    awakening: { duration: 2 },
    obsession: {
      options: [
        { id: 'maxHp', name: '铁骨', desc: '生命上限+3', stat: 'maxHp', amount: 3 },
        { id: 'attack', name: '磨刃', desc: '攻击+1', stat: 'attack', amount: 1 },
        { id: 'blockPerTurn', name: '枕木', desc: '每回合开始获得1点格挡', stat: 'blockPerTurn', amount: 1 },
      ],
      thresholds: [
        { at: 3, id: 'ironWall', name: '铁壁', desc: '每回合开始获得2点格挡' },
        { at: 6, id: 'ember', name: '余烬', desc: '受击时10%概率返还3点伤害' },
        { at: 10, id: 'unbreakable', name: '不灭', desc: '生命上限+10' },
      ],
    },
    quote: '铁轨之下埋着我的兄弟，但我还在前行。',
    intro: '最坚固的盾。擅长吸收伤害，并通过承受攻击来为列车充能（魂火）。',
  },
  {
    id: 'morgan',
    name: '摩根',
    title: '行刑者',
    color: '#8c2f2f',
    defaultCarriage: 2,
    baseHp: 40,
    baseStats: { attack: 12, block: 4, critRate: 15 },
    attackType: 'melee',
    damageType: 'physical',
    awakening: { duration: 2 },
    obsession: {
      options: [
        { id: 'maxHp', name: '铁骨', desc: '生命上限+3', stat: 'maxHp', amount: 3 },
        { id: 'attack', name: '磨刃', desc: '攻击+1', stat: 'attack', amount: 1 },
        { id: 'blockPerTurn', name: '枕木', desc: '每回合开始获得1点格挡', stat: 'blockPerTurn', amount: 1 },
      ],
      thresholds: [
        { at: 3, id: 'thirst', name: '渴血', desc: '处决敌人后恢复3点生命' },
        { at: 6, id: 'inertia', name: '惯性', desc: '列车速度≥3时伤害+10%' },
        { at: 10, id: 'guillotine', name: '断头台', desc: '对生命<30%的目标伤害+30%' },
      ],
    },
    quote: '你问我为何嗜血？因为列车的汽笛声让我想起断头台的滑轮。',
    intro: '纯粹的物理刀刃。利用位移拉拽敌方后排，利用暴击和"溢伤连锁"一刀斩碎敌人。',
  },
  {
    id: 'serafina',
    name: '塞拉芬娜',
    title: '鸣钟者',
    color: '#7a6a9a',
    defaultCarriage: 3,
    baseHp: 35,
    baseStats: { attack: 6, block: 4, critRate: 5 },
    attackType: 'ranged',
    damageType: 'arcane',
    awakening: { duration: 2 },
    obsession: {
      options: [
        { id: 'maxHp', name: '铁骨', desc: '生命上限+3', stat: 'maxHp', amount: 3 },
        { id: 'healPower', name: '洪钟', desc: '治疗量+1', stat: 'healPower', amount: 1 },
        { id: 'blockPerTurn', name: '枕木', desc: '每回合开始获得1点格挡', stat: 'blockPerTurn', amount: 1 },
      ],
      thresholds: [
        { at: 3, id: 'requiemT', name: '安魂', desc: '治疗时额外清除目标2点狂气' },
        { at: 6, id: 'hymn', name: '圣歌', desc: '每回合开始全队获得2点格挡' },
        { at: 10, id: 'deathKnell', name: '丧钟', desc: '自身觉醒时全队恢复8点生命' },
      ],
    },
    quote: '每一段铁轨都是亡者的脊柱，我的钟声能让他们暂时安息。',
    intro: '奶妈+狂气管理员。能把队友濒临爆表的狂气"偷"走，让"觉醒"变得可控。',
  },
  {
    id: 'auris',
    name: '奥瑞斯',
    title: '观星者',
    color: '#4a6a9a',
    defaultCarriage: 4,
    baseHp: 32,
    baseStats: { attack: 10, block: 2, critRate: 10 },
    attackType: 'ranged',
    damageType: 'arcane',
    awakening: { duration: 2 },
    obsession: {
      options: [
        { id: 'maxHp', name: '铁骨', desc: '生命上限+3', stat: 'maxHp', amount: 3 },
        { id: 'attack', name: '星辉', desc: '攻击+1', stat: 'attack', amount: 1 },
        { id: 'blockPerTurn', name: '枕木', desc: '每回合开始获得1点格挡', stat: 'blockPerTurn', amount: 1 },
      ],
      thresholds: [
        { at: 3, id: 'starTrail', name: '星轨', desc: '每回合开始暴击率+3%（可叠加）' },
        { at: 6, id: 'etchedEye', name: '蚀眼', desc: '攻击被标记目标时伤害+15%' },
        { at: 10, id: 'collapse', name: '坍缩', desc: '消耗暗蚀能量的伤害额外+50%' },
      ],
    },
    quote: '蚀雾之上还有星辰，它们告诉我：列车每颠簸一次，维度就会裂开一道缝。',
    intro: '法术狙击手 + 溢出伤害的启动器。擅长多段攻击和标记，为"溢伤连锁"制造巨额的"暗蚀能量"。',
  },
];
