import pytest
import asyncio
from app.events import OrderEventBroadcaster

@pytest.mark.asyncio
async def test_order_event_broadcaster():
    broadcaster = OrderEventBroadcaster()
    
    # 1. リスナーの登録テスト
    q1 = broadcaster.subscribe()
    q2 = broadcaster.subscribe()
    assert len(broadcaster.listeners) == 2

    # 2. ブロードキャスト機能のテスト
    test_msg = "Order #123 updated"
    await broadcaster.broadcast(test_msg)

    assert await q1.get() == test_msg
    assert await q2.get() == test_msg

    # 3. 購読解除のテスト
    broadcaster.unsubscribe(q1)
    assert len(broadcaster.listeners) == 1
    assert q1 not in broadcaster.listeners