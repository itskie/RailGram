import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def delete_test_users():
    database_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://railgram:railgram_dev@localhost:5432/railgram')
    engine = create_async_engine(database_url)
    
    async with engine.connect() as conn:
        # Delete test users
        await conn.execute(text("DELETE FROM users WHERE username IN ('railfan1', 'auditor_test_2')"))
        await conn.commit()
        print('✅ Deleted test users: railfan1, auditor_test_2')
        
        # Count remaining
        result = await conn.execute(text('SELECT COUNT(*) FROM users'))
        count = result.scalar()
        print(f'📊 Remaining users: {count}')

asyncio.run(delete_test_users())
