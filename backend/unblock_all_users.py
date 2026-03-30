import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def unblock_all():
    database_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://railgram:railgram_dev@localhost:5432/railgram')
    engine = create_async_engine(database_url)
    
    async with engine.connect() as conn:
        # Count before
        result = await conn.execute(text('SELECT COUNT(*) FROM blocks'))
        count_before = result.scalar()
        print(f'❌ Blocked users before: {count_before}')
        
        # Delete all blocks
        await conn.execute(text('DELETE FROM blocks'))
        await conn.commit()
        
        # Count after
        result = await conn.execute(text('SELECT COUNT(*) FROM blocks'))
        count_after = result.scalar()
        print(f'✅ Blocked users after: {count_after}')
        print(f'🎉 Unblocked {count_before - count_after} users!')

asyncio.run(unblock_all())
