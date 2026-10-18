import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.events import order_broadcaster
from app.schemas import OrderCreateSchema, OrderCreateResponseSchema
from app.services.order_service import OrderService, OrderServiceError

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", response_model=OrderCreateResponseSchema, status_code=status.HTTP_201_CREATED)
def create_order(order_in: OrderCreateSchema, db: Session = Depends(get_db)):
    """卓上端末からの新規注文を受け付けるAPIエンドポイント"""
    try:
        new_order = OrderService.create_order(db=db, order_in=order_in)

        created_at_str = new_order.created_at.isoformat() if new_order.created_at else ""
        return {
            "id": new_order.id,
            "order_id": new_order.id,
            "table_number": new_order.table_number,
            "status": new_order.status,
            "total_price": new_order.total_price,
            "created_at": created_at_str
        }

    except OrderServiceError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"処理中にエラーが発生しました: {str(e)}"
        )


@router.get("/events/stream")
async def sse_stream():
    """フロントエンドへリアルタイムイベント(注文・在庫更新)をSSE配信するエンドポイント"""
    async def event_generator():
        queue = order_broadcaster.subscribe()
        try:
            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            order_broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )