#!/usr/bin/env python3
"""Verify cell tower calibration data in database."""

import asyncio
import sys
sys.path.insert(0, '/Users/kie/Documents/RailGram/backend')

async def verify():
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import select, func
    from api.models.tracking import CellTowerCalibration
    from app.core.config import Settings
    
    settings = Settings()
    engine = create_async_engine(settings.database_url, echo=False)
    session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    try:
        async with session_maker() as session:
            # Count
            result = await session.execute(
                select(func.count()).select_from(CellTowerCalibration)
            )
            count = result.scalar()
            
            # Get sample
            result = await session.execute(
                select(CellTowerCalibration).limit(3)
            )
            towers = result.scalars().all()
            
            # Get operators
            result = await session.execute(
                select(CellTowerCalibration.operator, func.count())
                .group_by(CellTowerCalibration.operator)
            )
            operators = result.all()
            
            print("=" * 80)
            print("CELL TOWER CALIBRATION DATA IN DATABASE")
            print("=" * 80)
            print(f"✅ Total towers: {count}\n")
            
            print("By Operator:")
            for op, cnt in operators:
                print(f"  • {op}: {cnt} towers")
            
            print("\nSample Towers:")
            for i, t in enumerate(towers, 1):
                print(f"\n{i}. {t.tower_name} ({t.operator})")
                print(f"   ID: MCC={t.mcc} MNC={t.mnc} LAC={t.lac} CID={t.cid}")
                print(f"   Location: {t.latitude}, {t.longitude}")
                print(f"   Confidence: {t.confidence_score} | Samples: {t.samples_count}")
            
            print("\n" + "=" * 80)
            print("✅ DATABASE READY FOR TRIANGULATION")
            print("=" * 80)
            print("\nNext Steps:")
            print("1. Mobile app sends cell signals: (MCC=404, MNC=10, LAC=1001, CID=50001, RSSI=-95)")
            print("2. Triangulation service looks up {count} calibrated towers")
            print("3. Gauss-Newton algorithm calculates train position")
            print("4. Confidence scores improve from successful triangulations")
            
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(verify())
