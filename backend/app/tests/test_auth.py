import pytest
from app.auth import SYSTEM_ACCOUNTS, generate_user_token


# =====================================================================
# 1. ログイン API (/api/v1/auth/login) の検証
# =====================================================================

@pytest.mark.parametrize("username,expected_role", [
    ("admin", "admin"),
    ("kitchen", "kitchen"),
    ("cashier", "cashier"),
    ("ADMIN", "admin"),      # 大文字小文字の正規化チェック
    (" cashier ", "cashier"), # 前後空白のトリムチェック
])
def test_login_success(client, username, expected_role):
    """
    【正常系】登録済みのアカウント（admin, kitchen, cashier）でログインし、
    JWTトークンとアカウント情報が正しく取得できること
    """
    res = client.post("/api/v1/auth/login", json={"username": username})
    assert res.status_code == 200

    data = res.json()
    assert "token" in data
    assert len(data["token"]) > 0
    assert data["role"] == expected_role
    assert data["username"] == expected_role
    assert "allowed_pages" in data
    assert isinstance(data["allowed_pages"], list)


def test_login_user_not_found(client):
    """
    【異常系】未登録のユーザー名でログインを試みた場合、404エラーになること
    """
    res = client.post("/api/v1/auth/login", json={"username": "unknown_user"})
    assert res.status_code == 404
    assert "登録されていません" in res.json()["detail"]


# =====================================================================
# 2. セッション確認 API (/api/v1/auth/me) の検証
# =====================================================================

def test_get_me_success(client):
    """
    【正常系】有効なトークンを付与して /me を呼び出した場合、
    ユーザー情報が返ること
    """
    token = generate_user_token("kitchen", "kitchen")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["username"] == "kitchen"
    assert data["role"] == "kitchen"


def test_get_me_invalid_token(client):
    """
    【異常系】不正なトークンでアクセスした場合、401エラーになること
    """
    headers = {"Authorization": "Bearer invalid.token.string"}
    res = client.get("/api/v1/auth/me", headers=headers)
    assert res.status_code == 401
    assert "認証トークンが無効または期限切れです" in res.json()["detail"]


# =====================================================================
# 3. ロール別認可ガード (require_roles) の検証
# =====================================================================

def test_unauthenticated_access_blocked(client):
    """
    【未認証】Authorizationヘッダーなしで保護されたエンドポイントにアクセスした場合、
    401または403で遮断されること
    """
    # KDS API
    res_kds = client.get("/api/v1/kds/orders")
    assert res_kds.status_code in [401, 403]

    # POS API
    res_pos = client.get("/api/v1/pos/active-tables")
    assert res_pos.status_code in [401, 403]

    # 管理画面 API
    res_admin = client.get("/api/v1/admin/analytics/summary")
    assert res_admin.status_code in [401, 403]


def test_role_authorization_kds_endpoint(client):
    """
    【認可制御: KDS】
    許可ロール: admin, kitchen
    拒否ロール: cashier
    """
    kitchen_token = generate_user_token("kitchen", "kitchen")
    cashier_token = generate_user_token("cashier", "cashier")

    # cashier は厨房APIへのアクセス権限がなく 403 になること
    res_forbidden = client.get(
        "/api/v1/kds/orders",
        headers={"Authorization": f"Bearer {cashier_token}"}
    )
    assert res_forbidden.status_code == 403
    assert "この操作には権限が必要です" in res_forbidden.json()["detail"]

    # kitchen はアクセスできること
    res_allowed = client.get(
        "/api/v1/kds/orders",
        headers={"Authorization": f"Bearer {kitchen_token}"}
    )
    assert res_allowed.status_code == 200


def test_role_authorization_pos_endpoint(client):
    """
    【認可制御: POS】
    許可ロール: admin, cashier
    拒否ロール: kitchen
    """
    kitchen_token = generate_user_token("kitchen", "kitchen")
    cashier_token = generate_user_token("cashier", "cashier")

    # kitchen はレジAPIへのアクセス権限がなく 403 になること
    res_forbidden = client.get(
        "/api/v1/pos/active-tables",
        headers={"Authorization": f"Bearer {kitchen_token}"}
    )
    assert res_forbidden.status_code == 403
    assert "この操作には権限が必要です" in res_forbidden.json()["detail"]

    # cashier はアクセスできること
    res_allowed = client.get(
        "/api/v1/pos/active-tables",
        headers={"Authorization": f"Bearer {cashier_token}"}
    )
    assert res_allowed.status_code == 200


def test_role_authorization_admin_endpoint(client):
    """
    【認可制御: 管理画面】
    許可ロール: admin のみ
    拒否ロール: kitchen, cashier
    """
    admin_token = generate_user_token("admin", "admin")
    kitchen_token = generate_user_token("kitchen", "kitchen")
    cashier_token = generate_user_token("cashier", "cashier")

    # kitchen は 403
    res_kitchen = client.get(
        "/api/v1/admin/analytics/summary",
        headers={"Authorization": f"Bearer {kitchen_token}"}
    )
    assert res_kitchen.status_code == 403

    # cashier は 403
    res_cashier = client.get(
        "/api/v1/admin/analytics/summary",
        headers={"Authorization": f"Bearer {cashier_token}"}
    )
    assert res_cashier.status_code == 403

    # admin は 200
    res_admin = client.get(
        "/api/v1/admin/analytics/summary",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_admin.status_code == 200