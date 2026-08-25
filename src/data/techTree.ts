// 列车科技树：第三条成长线（蚀铁解锁）
import type { TechDef } from '../core/types';

export const TECHS: TechDef[] = [
  {
    id: 'tech_fragment',
    name: '蚀雾破片',
    cost: 20,
    tier: 1,
    effectId: 'fragmentPush',
    desc: '每场战斗开始时，所有敌人后退1格（原"鸣笛威慑"被动化）。',
  },
  {
    id: 'tech_boiler',
    name: '锅炉增压',
    cost: 30,
    tier: 1,
    effectId: 'initialSpeed',
    desc: '列车初始速度+1，所有"加速"牌效果+1格。',
  },
  {
    id: 'tech_armor',
    name: '装甲车厢',
    cost: 40,
    tier: 1,
    effectId: 'armorPlating',
    desc: '全队每回合获得3点格挡（列车本身的防护）。',
  },
  {
    id: 'tech_echo',
    name: '回响增幅',
    cost: 50,
    tier: 2,
    effectId: 'echoAmplify',
    desc: '每场战斗首次觉醒的持续时间延长1回合。',
  },
  {
    id: 'tech_soulfire',
    name: '魂火冷凝',
    cost: 60,
    tier: 2,
    effectId: 'soulfireCondense',
    desc: '魂火上限从100提升至150，溢伤转化魂火比例从10%提升至15%。',
  },
  {
    id: 'tech_coffin',
    name: '灵柩共鸣',
    cost: 80,
    tier: 3,
    effectId: 'coffinResonance',
    desc: '残影英雄（阵亡后）在下一场战斗开始时自动获得"复仇"×1.5倍效果。',
  },
];
