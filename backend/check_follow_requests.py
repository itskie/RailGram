import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check_follow_requests():
    database_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://railgram:railgram_dev@localhost:5432/railgram')
    engine = create_async_engine(database_url)
    
    async with engine.connect() as conn:
        result = await conn.execute(text('SELECT * FROM follow_requests'))
        rows = result.fetchall()
        print(f'📋 Follow requests in DB: {len(rows)}')
        for r in rows:
            print(f'  Follower: {r[1]}, Followed: {r[2]}, Created: {r[3]}')

asyncio.run(check_follow_requests())
