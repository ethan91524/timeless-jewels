/**
 * 繁體中文（台服）名稱對照。
 *
 * 只影響畫面顯示：搜尋網址參數、trade stat id、wasm 呼叫一律沿用原本的英文 value，
 * 所以既有的分享連結不會失效，也不影響與上游合併。
 *
 * 名稱來源＝遊戲內物品描述（2026-08-09 對照截圖確認）。
 */

export const JEWEL_ZH: Record<string, string> = {
  'Glorious Vanity': '輝煌的虛榮',
  'Lethal Pride': '致命的驕傲',
  'Brutal Restraint': '殘酷的紀律',
  'Militant Faith': '激進的信仰',
  'Elegant Hubris': '優雅的高傲',
  'Heroic Tragedy': '英勇的悲劇'
};

export const CONQUEROR_ZH: Record<string, string> = {
  // 輝煌的虛榮
  Xibaqua: '賽巴昆',
  Zerphi: '澤佛伊',
  Doryani: '多里亞尼',
  Ahuana: '阿呼阿娜',
  // 致命的驕傲
  Kaom: '岡姆',
  Rakiata: '拉基塔',
  Kiloava: '基洛瓦',
  Akoya: '阿寇亞',
  // 殘酷的紀律
  Deshret: '迪虛瑞特',
  Balbala: '貝爾巴拉',
  Asenath: '安賽娜絲',
  Nasima: '納西瑪',
  // 激進的信仰
  Venarius: '維那利斯',
  Maxarius: '瑪薩里歐斯',
  Dominus: '神主',
  Avarius: '伊爾莉斯',
  // 優雅的高傲
  Cadiro: '卡迪羅',
  Victario: '維多里奧',
  Chitus: '切特斯',
  Caspiro: '卡斯皮羅',
  // 英勇的悲劇
  Vorana: '沃拉娜',
  Uhtred: '烏特雷',
  Medved: '梅德偉'
};

/** 珠寶顯示名：有中文就「中文 English」，沒有就原樣。 */
export const jewelLabel = (name: string): string => (JEWEL_ZH[name] ? `${JEWEL_ZH[name]} ${name}` : name);

/** 人名顯示名，同上。 */
export const conquerorLabel = (name: string): string => (CONQUEROR_ZH[name] ? `${CONQUEROR_ZH[name]} ${name}` : name);
