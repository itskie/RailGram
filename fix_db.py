import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def fix():
    url = os.environ["DATABASE_URL"]
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT version_num FROM alembic_version"))
        print("Before fix, versions in DB:", res.fetchall())
        await conn.execute(text("DELETE FROM alembic_version"))
        await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('b1c2d3e4f5a6')"))
        await conn.commit()
        res = await conn.execute(text("SELECT version_num FROM alembic_version"))
        print("After fix, versions in DB:", res.fetchall())

asyncio.run(fix())
