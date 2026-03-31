import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def update_constraint():
    database_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://railgram:railgram_dev@localhost:5432/railgram')
    engine = create_async_engine(database_url)
    
    async with engine.connect() as conn:
        # Drop old constraint
        await conn.execute(text('''
            ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check
        '''))
        await conn.commit()
        print('✅ Dropped old constraint')
        
        # Add new constraint with follow_request
        await conn.execute(text('''
            ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
            CHECK (notif_type IN ('follow', 'follow_request', 'like_post', 'comment_post', 
                                  'like_reel', 'comment_reel', 'mention', 'reply_post', 
                                  'reply_reel', 'like_comment'))
        '''))
        await conn.commit()
        print('✅ Added new constraint with follow_request')
        
        print('\n✅ Database constraint updated successfully!')

asyncio.run(update_constraint())
