// 四英雄初始卡组：A套（稳健/新手推荐）与 B套（爆发/老手推荐）
// 文档：《卡牌优化》第二部分
import type { HeroId } from '../core/types';

export type DeckChoice = 'A' | 'B';

export interface StartingDeckInfo {
  id: string;
  name: string;
  desc: string;
  strategy: string;
}

export const STARTING_DECK_INFO: Record<HeroId, { A: StartingDeckInfo; B: StartingDeckInfo }> = {
  warwick: {
    A: { id: 'A', name: '铁壁堡垒', desc: '双格挡稳如泰山，适合新手', strategy: '每回合必留1费打壁垒之盾，血量常年80%以上' },
    B: { id: 'B', name: '冲锋破坏者', desc: '双加速抢速，进攻即防御', strategy: '第一回合双列车冲锋把速度拉到3-4，全队先手' },
  },
  morgan: {
    A: { id: 'A', name: '标记处决', desc: '先挂标记再下刀子，稳定增伤', strategy: '刽子手凝视挂标记→断首斩触发处决加成' },
    B: { id: 'B', name: '血祭狂潮', desc: '双AOE堆暗蚀，指数膨胀', strategy: '血腥狂怒+链钩提速，双血祭狂欢清场' },
  },
  serafina: {
    A: { id: 'A', name: '生命守护', desc: '奶量管够，容错率极高', strategy: '专职治疗和狂气管理，无脑推图' },
    B: { id: 'B', name: '怒涛钟声', desc: '双毁灭之钟，狂气联动爆发', strategy: '刻意叠狂气让毁灭之钟伤害翻倍，安魂弥撒防失控' },
  },
  auris: {
    A: { id: 'A', name: '标记射手', desc: '双标记稳定增伤，破闪', strategy: '蚀刻标记→暗蚀射击/群星陨落' },
    B: { id: 'B', name: '禁术学者', desc: '双抽牌叠暴击，资源碾压', strategy: '前两回合禁忌知识叠暴击率，第三回合收割' },
  },
};

export const STARTING_DECKS: Record<HeroId, Record<DeckChoice, string[]>> = {
  warwick: {
    A: ['warwick_wall_white', 'warwick_wall_white', 'warwick_hammer_white', 'warwick_taunt_white', 'warwick_gasp_white'],
    B: ['warwick_charge_white', 'warwick_charge_white', 'warwick_hammer_white', 'warwick_wall_white', 'warwick_taunt_white'],
  },
  morgan: {
    A: ['morgan_gaze_white', 'morgan_gaze_white', 'morgan_decapitate_white', 'morgan_fury_white', 'morgan_hook_white'],
    B: ['morgan_carnival_white', 'morgan_carnival_white', 'morgan_decapitate_white', 'morgan_fury_white', 'morgan_hook_white'],
  },
  serafina: {
    A: ['serafina_healbell_white', 'serafina_healbell_white', 'serafina_hymn_white', 'serafina_requiem_white', 'serafina_atonement_white'],
    B: ['serafina_doombell_white', 'serafina_doombell_white', 'serafina_requiem_white', 'serafina_atonement_white', 'serafina_hymn_white'],
  },
  auris: {
    A: ['auris_etch_white', 'auris_etch_white', 'auris_darkshot_white', 'auris_phase_white', 'auris_starfall_white'],
    B: ['auris_forbidden_white', 'auris_forbidden_white', 'auris_darkshot_white', 'auris_starfall_white', 'auris_phase_white'],
  },
};

/** 起始赠卡（泛用遗物） */
export const STARTING_RELIC_BONUS = ['p01_gear', 'p02_armorplate'];
