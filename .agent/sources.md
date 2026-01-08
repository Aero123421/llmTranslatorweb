# API調査資料 (sources.md)

## 調査日: 2026-01-08

### 1. xAI (Grok) API
- **URL**: https://docs.x.ai/docs/api-reference
- **タイトル**: REST API Reference | xAI
- **発行元**: xAI
- **重要ポイント**: 
  - ベースURL: `https://api.x.ai`
  - Chat Completions エンドポイント: `/v1/chat/completions`
  - OpenAI API互換
  - 認証: `Authorization: Bearer <your xAI API key>`
- **実装判断への影響**: エンドポイントとモデル名を確認、問題なし

### 2. Groq API
- **URL**: https://console.groq.com/docs/api-reference
- **タイトル**: API Reference - GroqDocs  
- **発行元**: Groq
- **重要ポイント**:
  - エンドポイント: `https://api.groq.com/openai/v1/chat/completions`
  - `response_format` パラメータ対応（`json_object`型）
  - モデル名は `model` パラメータで指定
- **実装判断への影響**: 現在の実装は正しい

### 3. Cerebras API
- **URL**: https://inference-docs.cerebras.ai/api-reference/chat-completions
- **タイトル**: Chat Completions - Cerebras Inference
- **発行元**: Cerebras
- **重要ポイント**:
  - ベースURL: `https://api.cerebras.ai/v1`
  - Chat Completions: `POST /chat/completions` 
  - 利用可能モデル: `llama3.1-8b`, `llama-3.3-70b`, `qwen-3-32b`, `gpt-oss-120b`, `zai-glm-4.6`, `zai-glm-4.7`
  - OpenAI互換形式のリクエスト/レスポンス
- **実装判断への影響**: 現在の実装は正しい

### 4. Google Gemini API
- **URL**: https://ai.google.dev/gemini-api/docs?hl=ja
- **タイトル**: Gemini API | Google AI for Developers
- **発行元**: Google
- **重要ポイント**:
  - エンドポイント: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
  - **【重要】systemInstruction の形式**: オブジェクト形式 `{ parts: [{ text: "..." }] }` が必要
  - レスポンス: `candidates[0].content.parts[0].text`
  - responseMimeType: `application/json` または `text/plain`
- **実装判断への影響**: 
  - **systemInstruction の形式が間違っている可能性**: 現在は文字列を直接渡しているが、オブジェクト形式が必要

---

## 発見された問題点

### 1. Gemini API - systemInstruction の形式エラー (重大)
**現在のコード (providers.ts L376):**
```typescript
if (systemPrompt) {
  body.systemInstruction = systemPrompt  // 文字列を直接渡している
}
```

**公式ドキュメントによる正しい形式:**
```typescript
body.systemInstruction = {
  parts: [{ text: systemPrompt }]
}
```

### 2. Gemini API - レスポンスパース時のJSON抽出問題
JSONレスポンスがマークダウンコードブロックで包まれている可能性がある

### 3. エラーハンドリングの改善
APIエラー時にレスポンスボディの詳細を取得してログ出力すべき

---

## 実施した修正内容 (2026-01-08)

### 1. Gemini API - system_instruction の形式修正 (重大な修正)
**修正前:**
```typescript
body.systemInstruction = systemPrompt  // 文字列を直接渡していた（間違い）
```

**修正後（公式ドキュメント準拠）:**
```typescript
body.system_instruction = {
  parts: [
    { text: systemPrompt }
  ]
}
```

### 2. JSONパースの改善
マークダウンコードブロック（```json ... ```）で包まれたレスポンスに対応：
```typescript
// Remove markdown code blocks if present
let cleanedContent = content.trim()
if (cleanedContent.startsWith('```')) {
  cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/, '')
  cleanedContent = cleanedContent.replace(/\n?```\s*$/, '')
  cleanedContent = cleanedContent.trim()
}
```

### 3. エラーハンドリングの強化
- `handleAPIError`を非同期関数に変更
- APIエラー時にレスポンスボディの詳細をJSONまたはテキストとして取得
- 400 Bad Requestの場合に詳細なエラーメッセージを表示
- コンソールにエラー詳細を出力

### 4. 全プロバイダーのhandleAPIError呼び出しをawaitに変更
- Groq, Gemini, Cerebras, OpenAI, Grok すべてのプロバイダーで`await this.handleAPIError()`に変更

---

## 検証結果

### ビルド確認
```
npx next build
✓ Finalizing page optimization in 403.6ms
Exit code: 0
```

### 開発サーバー起動確認
```
npx next dev
▲ Next.js 16.1.1 (Turbopack)
- Local: http://localhost:3000
✓ Ready in 2.5s
```

### UI確認
- アプリケーションが正常に読み込まれることを確認
- 設定パネルで全5つのプロバイダー（Groq, Google Gemini, Cerebras, OpenAI, Grok(xAI)）が選択可能
- 各プロバイダー用のモデル選択が正しく動作

---

## 残課題/リスク
1. **実際のAPIテスト未実施**: 各プロバイダーのAPIキーがないため、実際のAPI呼び出しテストは行っていない
2. **OpenAIモデル名の確認**: `gpt-5.2`, `gpt-5-mini`は存在しない可能性あり（将来のモデル名と思われる）
3. **Grokモデル名の確認**: `grok-4-1-fast`等のモデル名は公式ドキュメントで確認が必要
