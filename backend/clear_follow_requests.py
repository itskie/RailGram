import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def clear_all_requests():
    database_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://railgram:railgram_dev@localhost:5432/railgram')
    engine = create_async_engine(database_url)
    
    async with engine.connect() as conn:
        result = await conn.execute(text('SELECT COUNT(*) FROM follow_requests'))
        count_before = result.scalar()
        print(f'📋 Follow requests before: {count_before}')
        
        await conn.execute(text('DELETE FROM follow_requests'))
        await conn.commit()
        
        result = await conn.execute(text('SELECT COUNT(*) FROM follow_requests'))
        count_after = result.scalar()
        print(f'✅ Deleted {count_before - count_after} follow requests')
        print(f'📋 Follow requests after: {count_after}')

asyncio.run(clear_all_requests())
