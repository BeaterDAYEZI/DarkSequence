// 铭刻融合特殊配方（覆盖通用规则，产出预设强力牌）
import type { FusionRecipeDef } from '../core/types';

export const FUSION_RECIPES: FusionRecipeDef[] = [
  {
    id: 'recipe_knell',
    cardA: 'serafina_requiem_orange',
    cardB: 'serafina_atonement_orange',
    resultCardId: 'fused_knell',
  },
];
