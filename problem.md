# 問題点レビュー（UI/UX・バグ・アクセシビリティ・性能・安全性）

対象: PC / タブレット / スマホ対応の翻訳アプリ  
観点: 機能バグ、UI/UX、アクセシビリティ、レスポンシブ、性能、セキュリティ

---

## 重大度: 高（機能に直接影響）

- **P1: 履歴IDの不整合で分析結果が履歴に保存されない**
  - 参照: `src/components/TranslationInterface.tsx:210-218`, `src/store/historyStore.ts:66-70`
  - 内容: `currentHistoryId` を手動生成して `setCurrentHistoryId` している一方、`addHistoryItem` が内部で別IDを生成して保存するため、`updateHistoryItem(currentHistoryId, ...)` が命中しない。
  - 影響: 翻訳直後に実行する語彙/文法/ニュアンス解析が履歴に保存されず、履歴画面で結果が欠落。
  - 改善案: `addHistoryItem` をID受け取り可能にする or `addHistoryItem` から返却されるIDを利用する設計に統一。

- **P2: スロット切替時に「カスタムモデル」UIが不一致**
  - 参照: `src/components/SettingsPanel.tsx:98-104`, `src/components/SettingsPanel.tsx:294-305`
  - 内容: `useCustomModel` / `customModel` が初期値固定のため、スロット切替後も前スロットの状態が残る。
  - 影響: 別スロットのモデル編集が意図せず上書きされたり、入力欄の表示がズレる。
  - 改善案: `activeSlotIndex` / `currentSlot` を監視して `useCustomModel`/`customModel` を同期する `useEffect` を追加。

---

## 重大度: 中（挙動・保存状態の不整合）

- **P3: 出力形式と機能トグルがローカル状態で同期されない**
  - 参照: `src/components/SettingsPanel.tsx:78-81`, `src/components/SettingsPanel.tsx:143-146`, `src/components/SettingsPanel.tsx:248`, `src/components/SettingsPanel.tsx:419-424`
  - 内容: `outputFormat` を変更しても `showWordList/showDetailedExplanation/showNuanceExplanation` がローカルで連動しない。逆も同様。
  - 影響: 画面上の表示と実際に保存される内容が一致しない。保存後も UI が古いまま残る可能性。
  - 改善案: ローカル状態で `computeOutputFormat` を使って相互同期するか、UI上でどちらかに統一。

- **P4: APIキー未設定時に「不明」エラーになる**
  - 参照: `src/components/TranslationInterface.tsx:121-187`
  - 内容: 有効なAPIキーが1件もない場合 `performRouting` が `undefined` を throw。
  - 影響: エラーメッセージが曖昧で原因が分からない。
  - 改善案: 事前にキー未設定を検出し、明示メッセージを表示。

- **P5: クリップボードコピーの失敗が黙殺される**
  - 参照: `src/components/TranslationInterface.tsx:93`, `src/components/HistoryPanel.tsx:67`
  - 内容: `navigator.clipboard.writeText` の失敗を捕捉していない。
  - 影響: HTTP環境/権限不足で失敗した際にユーザーが気付けない。
  - 改善案: `catch` でエラートーストを表示、または `document.execCommand` へのフォールバック。

---

## UI/UX・レスポンシブ（PC/タブレット/スマホ）

- **P6: Enterキーで即送信 → モバイルで改行できない**
  - 参照: `src/components/TranslationInterface.tsx:330`
  - 内容: Enterで送信、Shift+Enterで改行だがモバイルはShift入力が困難。
  - 影響: 長文入力がストレス。スマホ体験が悪化。
  - 改善案: モバイルではEnterを改行にし、送信はボタンに限定。

- **P7: テキストエリアが無制限に伸びてレイアウト破綻**
  - 参照: `src/components/TranslationInterface.tsx:81-82`
  - 内容: `scrollHeight` に合わせて高さが無制限に拡大。
  - 影響: 特にスマホで画面が極端に長くなり、操作性低下・スクロール破綻。
  - 改善案: 最大高さを設けて `overflow-auto` で内部スクロールに切替。

- **P8: `h-screen` + `fixed` ナビでモバイル表示が切れる可能性**
  - 参照: `src/app/page.tsx:120`, `src/app/page.tsx:155`
  - 内容: `h-screen` と `fixed bottom` を併用しているため、iOS/Safariのアドレスバー変化で高さ計算がズレやすい。
  - 影響: 画面下部の内容が隠れる/スクロールできない。
  - 改善案: `100dvh`/`svh` の採用、余白計算の見直し。

- **P9: 履歴ダイアログの余白が大きく、狭い画面で情報が詰まる**
  - 参照: `src/components/HistoryPanel.tsx:253-303`
  - 内容: `w-[95vw] h-[90vh]` + `p-10` 多用。
  - 影響: スマホで内容表示領域が狭くなり操作がしづらい。
  - 改善案: 画面幅に応じて `p-4` などへ縮小、レイアウトの段組み切替を導入。

- **P10: 小さい文字サイズ・薄い色が多く可読性が低い**
  - 参照: `src/components/TranslationInterface.tsx:326-331`, `src/components/HistoryPanel.tsx:228-240`, `src/components/SettingsPanel.tsx:316-329`
  - 内容: `text-[9px]〜[10px]` と `text-muted-foreground/40` の組み合わせが多い。
  - 影響: タブレット/スマホで読みにくく、アクセシビリティ基準を満たしにくい。
  - 改善案: 12–14px以上への引き上げ、コントラスト強化。

---

## アクセシビリティ（A11y）

- **P11: クリック可能なカードがキーボード操作不可**
  - 参照: `src/components/HistoryPanel.tsx:225`
  - 内容: `Card` が `onClick` だけで `role="button"`/`tabIndex` がない。
  - 影響: キーボードユーザーやスクリーンリーダーで操作しづらい。
  - 改善案: `button` 要素に変更、または `role`/`tabIndex`/`onKeyDown` を追加。

- **P12: アイコンボタンに `aria-label` がない箇所がある**
  - 参照: `src/components/TranslationInterface.tsx:288,311`, `src/app/page.tsx:129`
  - 内容: スワップボタン・読み上げボタン・モバイルのテーマ切替がラベルなし。
  - 影響: スクリーンリーダーで意味不明。
  - 改善案: `aria-label` を必ず付与。

---

## セキュリティ / プライバシー

- **P13: APIキーと翻訳履歴が localStorage に平文保存**
  - 参照: `src/store/settingsStore.ts:112-114`, `src/store/historyStore.ts:58-83`
  - 内容: 永続化が `localStorage` のため、XSSや共有端末で漏洩リスク。
  - 影響: 機密な翻訳内容やAPIキーが第三者に見られる可能性。
  - 改善案: 暗号化ストレージ、または「保存しない」モードを用意。

---

## パフォーマンス / スケール

- **P14: 大量のモーション・ブラーが低性能端末で重い可能性**
  - 参照: `src/app/page.tsx:155`, `src/components/TranslationInterface.tsx:374-381`, `src/components/HistoryPanel.tsx:253-253`
  - 内容: `backdrop-blur-3xl` や多数の `motion` がスクロール時に負荷増大。
  - 影響: スマホ/タブレットでフレーム落ちや入力遅延。
  - 改善案: モバイルではエフェクト削減、`prefers-reduced-motion` 対応。

---

## テスト/品質

- **P15: 自動テストが存在しない**
  - 参照: リポジトリ全体
  - 影響: 回帰バグが混入しやすい。
  - 改善案: 主要フロー（翻訳、履歴保存、設定保存）のE2E/単体テスト追加。

---

## 総評（要点）
- 履歴ID不整合と設定画面の状態同期は、ユーザー体験とデータ整合性に直結するため最優先で修正推奨。  
- スマホ対応は現状デザインが密度高めで、可読性・操作性が落ちやすい。  
- A11yとセキュリティ（localStorage）は早めに方針決めしておくと安全。

