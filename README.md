# 軍團珠寶計算器 · 繁體中文（台服）版

> 這是 [Vilsol/timeless-jewels](https://github.com/Vilsol/timeless-jewels) 的 fork，加了繁體中文介面與台服交易站支援。
> 原專案採 GPL-3.0，本 fork 同樣以 GPL-3.0 釋出。

**直接使用：**

| 用途 | 網址 |
|---|---|
| 天賦樹計算器（選珠寶孔、指定/排除節點、詞綴權重） | <https://ethan91524.github.io/timeless-jewels/tree> |
| 交易搜尋器（號碼 → 交易站連結，自動分批＋防限速冷卻） | <https://ethan91524.github.io/timeless-jewels/jewel-search.html> |

**這個 fork 改了什麼**

- **繁體中文介面**：選單、按鈕、說明文字；珠寶與人名用遊戲內官方譯名（例：優雅的高傲 Elegant Hubris、卡斯皮羅 Caspiro）。
  只改顯示，網址參數與 stat id 仍用英文，**舊的分享連結不會失效**。
- **台服交易站**：平台選單新增「PC 台服」，交易連結改開 `pathofexile.tw`，
  交易狀態自動用 `available`（即刻購買以及面對面交易），聯盟改用台服清單。國際服行為未變動。
- **符合條件的號碼清單**：結果列新增「號碼」面板，列出所有符合的種子並可一鍵複製。
- **交易搜尋器**：`static/jewel-search.html`，可用網址 hash 帶入號碼
  （`#seeds=…&name=…&league=…&status=…`）；計算器結果列的「交易搜尋器」按鈕會把整批結果帶過去。
  號碼多的時候它會依交易站的查詢複雜度上限自動分批，並在每次開啟後鎖定數秒，避免被限速 60 秒。
- 交易相關改動皆有單元測試（`frontend/src/lib/trade.test.ts`，共 40 項）。

**更新方式**：推一個 `v*` tag（例如 `v1.2.1`），GitHub Actions 會自動建置並部署到 GitHub Pages。

---

# timeless-jewels [![push](https://github.com/Vilsol/timeless-jewels/actions/workflows/push.yml/badge.svg)](https://github.com/Vilsol/timeless-jewels/actions/workflows/push.yaml) ![GitHub go.mod Go version](https://img.shields.io/github/go-mod/go-version/vilsol/timeless-jewels) ![GitHub tag (latest by date)](https://img.shields.io/github/v/tag/vilsol/timeless-jewels) [![GitHub license](https://img.shields.io/github/license/Vilsol/timeless-jewels)](https://github.com/Vilsol/timeless-jewels/blob/master/LICENSE)

A simple timeless jewel calculator with a skill tree view

Hosted Version: [https://vilsol.github.io/timeless-jewels](https://vilsol.github.io/timeless-jewels)

Uses data extracted with https://github.com/Vilsol/go-pob-data

## Updates to new leagues

Whenever a new league is coming, the passive tree might get updated.
**But** it is not guaranteed to contain correct data until a game download is available.

Specifically, this project depends on the following data tables:

* Alternate Passive Additions
* Alternate Passive Skills
* Passive Skills
* Stats
* Translations
