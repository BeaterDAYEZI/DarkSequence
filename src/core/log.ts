// 战斗日志：记录每回合结算序列，供 UI LogPanel 与 Boss"记忆铁轨"回溯
export interface LogEntry {
  turn: number;
  text: string;
  kind: 'info' | 'damage' | 'heal' | 'madness' | 'soulfire' | 'narration' | 'system';
}

export interface TurnRecord {
  turn: number;
  entries: LogEntry[];
  firstCardPlayed?: { heroId: string; cardId: string };  // 记忆铁轨用
  lastCardPlayed?: { heroId: string; cardId: string };   // 时空错位用
}

class CombatLog {
  private entries: LogEntry[] = [];
  private turnRecords: TurnRecord[] = [];
  maxEntries = 500;

  add(text: string, kind: LogEntry['kind'] = 'info', turn = 0): void {
    this.entries.push({ turn, text, kind });
    if (this.entries.length > this.maxEntries) this.entries.shift();
    const rec = this.currentTurnRecord(turn);
    rec?.entries.push({ turn, text, kind });
  }

  beginTurn(turn: number): void {
    if (this.turnRecords.length > 100) this.turnRecords.shift();
    this.turnRecords.push({ turn, entries: [] });
  }

  setFirstCard(turn: number, heroId: string, cardId: string): void {
    const rec = this.turnRecords.find((t) => t.turn === turn);
    if (rec) rec.firstCardPlayed = { heroId, cardId };
  }

  /** 记录某回合最后一张打出的牌（时空错位用） */
  setLastCard(turn: number, heroId: string, cardId: string): void {
    const rec = this.turnRecords.find((t) => t.turn === turn);
    if (rec) rec.lastCardPlayed = { heroId, cardId };
  }

  /** 取某回合第一张打出的牌（记忆铁轨） */
  getFirstCard(turn: number): { heroId: string; cardId: string } | undefined {
    return this.turnRecords.find((t) => t.turn === turn)?.firstCardPlayed;
  }

  /** 取某回合最后一张打出的牌（时空错位） */
  getLastCard(turn: number): { heroId: string; cardId: string } | undefined {
    return this.turnRecords.find((t) => t.turn === turn)?.lastCardPlayed;
  }

  getEntries(): readonly LogEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
    this.turnRecords = [];
  }

  private currentTurnRecord(turn: number): TurnRecord | undefined {
    if (turn === 0) return this.turnRecords[this.turnRecords.length - 1];
    let rec = this.turnRecords.find((t) => t.turn === turn);
    if (!rec) {
      rec = { turn, entries: [] };
      this.turnRecords.push(rec);
    }
    return rec;
  }
}

export const combatLog = new CombatLog();
