import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check_users():
    database_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://railgram:railgram_dev@localhost:5432/railgram')
    engine = create_async_engine(database_url)
    
    async with engine.connect() as conn:
        # Count total users
        result = await conn.execute(text('SELECT COUNT(*) FROM users'))
        count = result.scalar()
        print(f'\n📊 Total Users: {count}')
        
        # Get all users
        result = await conn.execute(text('''
            SELECT id, username, email, is_private, created_at 
            FROM users 
            ORDER BY created_at DESC
        '''))
        rows = result.fetchall()
        
        print('\n' + '='*100)
        print(f'{"ID":<38} {"Username":<20} {"Email":<30} {"Private":<8} {"Created"}')
        print('='*100)
        
        for r in rows:
            user_id = str(r[0])[:36]
            username = r[1][:18] if len(r[1]) > 18 else r[1]
            email = r[2][:28] if len(r[2]) > 28 else r[2]
            is_private = 'Yes' if r[3] else 'No'
            created = r[4]
            print(f'{user_id:<38} {username:<20} {email:<30} {is_private:<8} {created}')
        
        print('='*100)

asyncio.run(check_users())
