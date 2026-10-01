import asyncio

class OrderEventBroadcaster:
    def __init__(self):
        self.listeners: list[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        """新しいリスナー（Queue）を登録して返す"""
        queue = asyncio.Queue()
        self.listeners.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        """指定されたリスナー（Queue）を削除する"""
        if queue in self.listeners:
            self.listeners.remove(queue)

    async def broadcast(self, message: str) -> None:
        """登録されている全リスナーへメッセージを配信する"""
        for queue in self.listeners:
            await queue.put(message)

order_broadcaster = OrderEventBroadcaster()