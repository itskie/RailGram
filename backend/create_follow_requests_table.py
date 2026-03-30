import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def run():
    database_url = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://railgram:railgram_dev@localhost:5432/railgram')
    engine = create_async_engine(database_url)
    
    async with engine.connect() as conn:
        # Create table
        await conn.execute(text('''
            CREATE TABLE IF NOT EXISTS follow_requests (
                id BIGSERIAL PRIMARY KEY,
                follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                followed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(follower_id, followed_id)
            )
        '''))
        await conn.commit()
        print("✓ Table created")
        
        # Create indexes
        await conn.execute(text('CREATE INDEX IF NOT EXISTS idx_follow_requests_follower ON follow_requests(follower_id)'))
        await conn.commit()
        print("✓ Index on follower_id created")
        
        await conn.execute(text('CREATE INDEX IF NOT EXISTS idx_follow_requests_followed ON follow_requests(followed_id)'))
        await conn.commit()
        print("✓ Index on followed_id created")
        
        print("\n✅ Follow requests table setup complete!")

asyncio.run(run())
