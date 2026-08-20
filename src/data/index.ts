// 数据汇总入口：全部内容数据在此加载进 registry（步骤1填充）
import { registry } from '../core/registry';

export function loadAllData(): void {
  // 步骤1：这里加载 heroes / cards / relicCards / monsters / zones / techTree / stations / events / fusionRecipes
  void registry;
}
