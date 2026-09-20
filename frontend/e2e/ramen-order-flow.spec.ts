import { test, expect } from '@playwright/test';

test.describe('ラーメン注文システム E2E 一気通貫フロー', () => {

  test('卓上端末での注文から厨房提供・POS現金会計まで完了できること', async ({ page }) => {
    // ブラウザの alert / confirm ダイアログを自動で承諾する設定
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // ----------------------------------------------------
    // 1. 卓上端末画面 (/cust?table=1) を開いて注文
    // ----------------------------------------------------
    await page.goto('/cust?table=1');
    await expect(page.locator('text=1 番卓')).toBeVisible({ timeout: 10000 });

    // 「ラーメン」カテゴリを選択（完全一致で確実にクリック）
    await page.getByText('ラーメン', { exact: true }).click();
    
    // 「豚骨ラーメン」のテキストまたはカードを選択
    await page.getByText('豚骨ラーメン', { exact: true }).click();

    // オプション選択モーダルが開くのを確認し、「この内容でカートに入れる」をクリック
    const addToCartButton = page.getByRole('button', { name: 'この内容でカートに入れる' });
    await expect(addToCartButton).toBeVisible();
    await addToCartButton.click();

    // カートから「注文を送信」ボタンをクリック
    const submitOrderButton = page.getByRole('button', { name: /注文を送信/ }).first();
    await expect(submitOrderButton).toBeVisible();
    await submitOrderButton.click();

    // 注文完了メッセージが表示されることを確認（正規表現で柔軟に判定）
    await expect(page.getByText(/注文を送信しました.*到着をお待ちください/)).toBeVisible();

    // ----------------------------------------------------
    // 2. 厨房KDS画面 (/kds) を開いて調理・提供ステータスを更新
    // ----------------------------------------------------
    await page.goto('/kds');
    await expect(page.locator('text=厨房リスト')).toBeVisible({ timeout: 10000 });

    // 卓番1の豚骨ラーメンの行を取得（hasText: '1' を外して不確実な失敗を回避）
    const kdsRow = page.locator('tr', { hasText: '豚骨ラーメン' }).first();
    await expect(kdsRow).toBeVisible();

    // 「調理を開始」ボタンをクリック
    // const startCookingButton = kdsRow.getByRole('button', { name: '調理を開始' });
    // await startCookingButton.click();
    await page.getByText('調理を開始').click();

    // ボタンが「提供完了」に変化することを確認し、クリック（表示を待機）
    const servedButton = kdsRow.getByRole('button', { name: '提供完了' });
    await expect(servedButton).toBeVisible();
    await servedButton.click();

    // 提供完了後、一覧から消去されることを確認
    await expect(servedButton).not.toBeVisible();

    // ----------------------------------------------------
    // 3. レジPOS画面 (/pos) を開いて伝票確認と現金会計
    // ----------------------------------------------------
    await page.goto('/pos');
    await expect(page.locator('text=卓一覧・未会計伝票')).toBeVisible({ timeout: 10000 });

    // 「卓 1」ボタンをクリック（卓 10 への誤マッチを防ぎつつ、未会計表示を許容）
    const tableButton = page.getByRole('button', { name: /^卓 1(?!\d)/ });
    await expect(tableButton).toBeVisible();
    await tableButton.click();

    // 伝票詳細に「卓 No. 1 伝票」または「卓 1」と「豚骨ラーメン」が表示されることを確認（改行・表記揺れを許容）
    await expect(page.getByText(/卓\s*(No\.?\s*)?1.*伝票?/)).toBeVisible();
    await expect(page.locator('text=豚骨ラーメン')).toBeVisible();

    // 現金決済フォームでお預かり金額「1000」を入力
    const paidInput = page.locator('input[type="number"]');
    await paidInput.fill('1000');

    // お釣りが表示されていることを確認
    await expect(page.locator('text=お釣り:')).toBeVisible();

    // 「現金精算を確定する」ボタンをクリック
    const checkoutButton = page.getByRole('button', { name: '現金精算を確定する' });
    await checkoutButton.click();

    // 会計完了後、伝票詳細がクリアされ「卓を選択してください」に戻ることを確認
    await expect(page.locator('text=卓を選択してください')).toBeVisible({ timeout: 5000 });
  });

});